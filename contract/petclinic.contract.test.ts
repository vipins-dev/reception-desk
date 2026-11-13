import * as api from '@/api/petclinic'
import { API_BASE_URL, ApiError } from '@/api/client'
import { PetTypeSchema, type OwnerFields, type PetType } from '@/api/types'
import { todayIso } from '@/domain/dates'

/**
 * Contract tests against a real Spring PetClinic REST backend.
 *
 * Two kinds of test live here:
 *  1. "the app works against the real server": the app's own API client and
 *     zod schemas parse real responses.
 *  2. "API quirk" tests: pin down the backend behaviour that the README lists
 *     under "API problems". If one of them starts failing, the backend changed
 *     (ideally: fixed) and the README + workaround should be revisited.
 */

const run = Date.now().toString(36).replace(/[0-9]/g, (d) => 'abcdefghij'[Number(d)] ?? 'x')
const lastName = `Contract${run.charAt(0).toUpperCase()}${run.slice(1)}`.replace(/[^\p{L}]/gu, '')

const ownerFields = (over: Partial<OwnerFields> = {}): OwnerFields => ({
  firstName: 'Casey',
  lastName,
  address: '1 Test Way',
  city: 'Testville',
  telephone: '6085550100',
  ...over,
})

const raw = (path: string, init?: RequestInit) => fetch(`${API_BASE_URL}${path}`, init)
const postJson = (path: string, body: unknown) =>
  raw(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

/**
 * Cleaning up, with care. The tests delete what they create, but on this
 * backend deleting an owner also deletes the *pet type* of each of their pets,
 * and the database then deletes every pet of that type (see Q11): one delete
 * can erase all the cats in the clinic. So the tests never give their pets a
 * real type such as "cat". Every pet they create uses a pet type made for this
 * run, which is removed together with the test data. A run leaves the backend
 * as it found it and cannot touch the seed owners, pets or types.
 * (The app itself never deletes anything, so this lives here, not in `src/api`.)
 */
const createdOwnerIds: number[] = []
const createdTypeIds: number[] = []

const createOwner = async (over: Partial<OwnerFields> = {}) => {
  const owner = await api.createOwner(ownerFields(over))
  createdOwnerIds.push(owner.id)
  return owner
}

const createPetType = async (name: string): Promise<PetType> => {
  const res = await postJson('/pettypes', { name })
  const type = PetTypeSchema.parse(await res.json())
  createdTypeIds.push(type.id)
  return type
}

/** The pet type every pet in these tests uses. */
let petType: PetType

beforeAll(async () => {
  petType = await createPetType(`contract-${run}`)
})

afterAll(async () => {
  // One at a time: each delete cascades into the type and its pets.
  for (const id of createdOwnerIds) await raw(`/owners/${id}`, { method: 'DELETE' }).catch(() => undefined)
  for (const id of createdTypeIds) await raw(`/pettypes/${id}`, { method: 'DELETE' }).catch(() => undefined)
})

describe('real backend: happy path through the app API client', () => {
  it('lists pet types', async () => {
    const types = await api.listPetTypes()
    expect(types.map((t) => t.name)).toEqual(expect.arrayContaining(['cat', 'dog']))
  })

  it('owner → pet → visit lifecycle, as the receptionist would do it', async () => {
    const owner = await createOwner()
    expect(owner.pets).toEqual([])

    const created = await api.addPet(owner.id, { name: 'Pixel', birthDate: '2022-03-04', type: petType })
    expect(created.name).toBe('Pixel')

    await api.addVisit(owner.id, created.id, { date: todayIso(), description: 'first checkup' })

    const reread = await api.getOwner(owner.id)
    const pet = reread.pets.find((p) => p.id === created.id)
    expect(pet).toMatchObject({ name: 'Pixel', type: { name: petType.name } }) // type.name present on re-read
    expect(pet?.visits.map((v) => v.description)).toEqual(['first checkup'])

    await api.updateOwner(owner.id, ownerFields({ city: 'Newtown' }))
    expect((await api.getOwner(owner.id)).city).toBe('Newtown')

    await api.updatePet(owner.id, created.id, { name: 'Pixie', birthDate: '2022-03-04', type: petType })
    expect((await api.getOwner(owner.id)).pets[0]?.name).toBe('Pixie')
  })

  it('finds the owner by last-name prefix through /v2/owners, with pets included', async () => {
    const page = await api.searchOwners({ lastName, page: 0, size: 10 }) // full unique name: shorter prefixes also match leftovers from earlier runs
    expect(page.content.some((o) => o.lastName === lastName)).toBe(true)
    expect(page.totalElements).toBeGreaterThanOrEqual(1)
  })

  it('maps server-side validation errors onto form fields', async () => {
    const error = await createOwner({ telephone: 'not-digits' }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(400)
    expect((error as ApiError).fieldErrors).toHaveProperty('telephone')
  })
})

describe('API quirks the frontend works around (documented in README "API problems")', () => {
  it('Q1: /v2/owners answers 200 + empty page when nothing matches', async () => {
    const page = await api.searchOwners({ lastName: 'Zzzzqqqq', page: 0, size: 10 })
    expect(page).toMatchObject({ content: [], totalElements: 0 })
  })

  it('Q2: the v1 list answers 404 (not an empty array) when nothing matches', async () => {
    const res = await raw('/owners?lastName=Zzzzqqqq')
    expect(res.status).toBe(404)
  })

  it('Q3: last-name search is case-sensitive', async () => {
    const lower = await api.searchOwners({ lastName: lastName.toLowerCase(), page: 0, size: 10 })
    expect(lower.content.some((o) => o.lastName === lastName)).toBe(false)
  })

  it('Q4: search is by last name only (first name / phone are not searchable)', async () => {
    const byFirst = await api.searchOwners({ lastName: 'Casey', page: 0, size: 10 })
    expect(byFirst.content.every((o) => o.lastName.startsWith('Casey'))).toBe(true)
  })

  it('Q5: PUT owner / PUT pet answer 204 with no body', async () => {
    const owner = await createOwner()
    const res = await raw(`/owners/${owner.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ownerFields({ city: 'Elsewhere' })),
    })
    expect(res.status).toBe(204)
    expect(await res.text()).toBe('')
  })

  it('Q6: a visit can be registered against another owner\'s pet (ownerId in the path is not checked)', async () => {
    const a = await createOwner({ firstName: 'Ann' })
    const b = await createOwner({ firstName: 'Bob' })
    const petOfB = await api.addPet(b.id, { name: 'Rex', birthDate: '2020-01-01', type: petType })
    const res = await raw(`/owners/${a.id}/pets/${petOfB.id}/visits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: todayIso(), description: 'wrong owner in the URL' }),
    })
    expect(res.status).toBe(201)
  })

  it('Q7: a visit for a pet that does not exist is reported as 404 via a data-integrity handler', async () => {
    const owner = await createOwner()
    const res = await raw(`/owners/${owner.id}/pets/99999999/visits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: todayIso(), description: 'ghost pet' }),
    })
    expect(res.status).toBe(404)
  })

  it('Q8: pet birth date rules are only visible as 400 messages (future / older than 50 years)', async () => {
    const owner = await createOwner()
    const future = await api
      .addPet(owner.id, { name: 'Marty', birthDate: '2999-01-01', type: petType })
      .catch((e: unknown) => e as ApiError)
    expect(future).toBeInstanceOf(ApiError)
    expect((future as ApiError).status).toBe(400)
  })

  it('Q9: the create-pet response echoes the full type (observed; an earlier source reading suggested it might not)', async () => {
    const owner = await createOwner()
    const res = await postJson(`/owners/${owner.id}/pets`, { name: 'Echo', birthDate: '2022-03-04', type: petType })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { type?: { name?: string | null } }
    expect(body.type?.name).toBe(petType.name)
  })

  it('Q10: the entity requires EXACTLY 10 phone digits but OpenAPI allows 1-20, so short numbers fail with a 500, not a 400', async () => {
    const res = await raw('/owners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ownerFields({ telephone: '12345' })),
    })
    expect(res.status).toBe(500)
    expect(((await res.json()) as { title?: string }).title).toBe('ConstraintViolationException')
  })

  it('Q11: deleting an owner deletes the pet types of their pets, and with them every pet of those types', async () => {
    // Uses a pet type made here: against a seed type such as "cat" this would erase real pets.
    const doomed = await createPetType(`contract-cascade-${run}`)
    const ann = await createOwner({ firstName: 'Ann' })
    const bob = await createOwner({ firstName: 'Bob' })
    await api.addPet(ann.id, { name: 'Gone', birthDate: '2022-03-04', type: doomed })
    await api.addPet(bob.id, { name: 'Innocent', birthDate: '2022-03-04', type: doomed })

    const res = await raw(`/owners/${ann.id}`, { method: 'DELETE' })
    expect(res.status).toBe(204)
    expect((await api.listPetTypes()).some((t) => t.id === doomed.id)).toBe(false) // Ann's pet took its type with it
    expect((await api.getOwner(bob.id)).pets).toEqual([]) // and Bob's pet of the same type went too
  })
})
