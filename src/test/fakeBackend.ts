import { http, HttpResponse } from 'msw'
import { todayIso, yearsAgoIso } from '@/domain/dates'

/**
 * An in-memory stand-in for Spring PetClinic REST, used by the integration
 * tests through MSW. It reproduces the behaviour the frontend depends on
 * (paging, case-sensitive prefix search, 204 on PUT, ProblemDetail errors with
 * `schemaValidationErrors`) so tests exercise real request/response shapes
 * rather than mocked functions. Behaviour that is only *assumed* about the
 * real server is covered by `contract/` tests against the real thing.
 */

export const BASE = 'http://localhost:9966/petclinic/api'

interface DbVisit { id: number; petId: number; date: string; description: string }
interface DbPet { id: number; ownerId: number; name: string; birthDate: string; typeId: number }
interface DbOwner { id: number; firstName: string; lastName: string; address: string; city: string; telephone: string }

export const PET_TYPES = [
  { id: 1, name: 'cat' },
  { id: 2, name: 'dog' },
  { id: 3, name: 'lizard' },
  { id: 4, name: 'snake' },
  { id: 5, name: 'bird' },
  { id: 6, name: 'hamster' },
]

const seedOwners = (): DbOwner[] => [
  { id: 1, firstName: 'George', lastName: 'Franklin', address: '110 W. Liberty St.', city: 'Madison', telephone: '6085551023' },
  { id: 2, firstName: 'Betty', lastName: 'Davis', address: '638 Cardinal Ave.', city: 'Sun Prairie', telephone: '6085551749' },
  { id: 4, firstName: 'Harold', lastName: 'Davis', address: '563 Friendly St.', city: 'Windsor', telephone: '6085553198' },
  { id: 6, firstName: 'Jean', lastName: 'Coleman', address: '105 N. Lake St.', city: 'Monona', telephone: '6085552654' },
]
const seedPets = (): DbPet[] => [
  { id: 1, ownerId: 1, name: 'Leo', birthDate: '2010-09-07', typeId: 1 },
  { id: 2, ownerId: 2, name: 'Basil', birthDate: '2012-08-06', typeId: 6 },
  { id: 5, ownerId: 4, name: 'Iggy', birthDate: '2010-11-30', typeId: 3 },
  { id: 7, ownerId: 6, name: 'Samantha', birthDate: '2012-09-04', typeId: 1 },
  { id: 8, ownerId: 6, name: 'Max', birthDate: '2012-09-04', typeId: 1 },
]
const seedVisits = (): DbVisit[] => [
  { id: 1, petId: 7, date: '2013-01-01', description: 'rabies shot' },
  { id: 2, petId: 8, date: '2013-01-02', description: 'rabies shot' },
  { id: 3, petId: 8, date: '2013-01-03', description: 'neutered' },
  { id: 4, petId: 7, date: '2013-01-04', description: 'spayed' },
]

export const db = {
  owners: seedOwners(),
  pets: seedPets(),
  visits: seedVisits(),
  nextId: { owner: 100, pet: 100, visit: 100 },
}

export function resetBackend(): void {
  db.owners = seedOwners()
  db.pets = seedPets()
  db.visits = seedVisits()
  db.nextId = { owner: 100, pet: 100, visit: 100 }
}

const typeOf = (id: number) => PET_TYPES.find((t) => t.id === id) ?? PET_TYPES[0]!
const visitDto = (v: DbVisit) => ({ id: v.id, petId: v.petId, date: v.date, description: v.description })
const petDto = (p: DbPet) => ({
  id: p.id,
  ownerId: p.ownerId,
  name: p.name,
  birthDate: p.birthDate,
  type: typeOf(p.typeId),
  visits: db.visits.filter((v) => v.petId === p.id).map(visitDto),
})
const ownerDto = (o: DbOwner) => ({ ...o, pets: db.pets.filter((p) => p.ownerId === o.id).map(petDto) })

function problem(status: number, detail: string, errors: { field: string; defaultMessage: string }[] = []) {
  return HttpResponse.json(
    {
      type: `${BASE}/x`,
      title: 'Problem',
      status,
      detail,
      timestamp: new Date().toISOString(),
      schemaValidationErrors: errors.map((e) => ({
        message: `Field '${e.field}' ${e.defaultMessage}`,
        field: e.field,
        defaultMessage: e.defaultMessage,
      })),
    },
    { status },
  )
}

// The real entity enforces exactly 10 digits but OpenAPI only says digits, so a
// 5-digit number passes request validation and then fails with a 500.
const entityViolation = () =>
  HttpResponse.json(
    { status: 500, title: 'ConstraintViolationException', detail: 'An unexpected error occurred while processing your request', schemaValidationErrors: [] },
    { status: 500 },
  )
const hasValidEntityPhone = (b: Record<string, unknown>) => typeof b.telephone === 'string' && /^[0-9]{10}$/.test(b.telephone)

const NAME = /^\p{L}+([ '-]\p{L}+){0,2}\.?$/u

function validateOwner(b: Record<string, unknown>) {
  const errors: { field: string; defaultMessage: string }[] = []
  for (const f of ['firstName', 'lastName'] as const) {
    if (typeof b[f] !== 'string' || !NAME.test(b[f] as string)) errors.push({ field: f, defaultMessage: 'must match the name pattern' })
  }
  for (const f of ['address', 'city'] as const) {
    if (typeof b[f] !== 'string' || (b[f] as string).length === 0) errors.push({ field: f, defaultMessage: 'must not be empty' })
  }
  if (typeof b.telephone !== 'string' || !/^[0-9]+$/.test(b.telephone)) {
    errors.push({ field: 'telephone', defaultMessage: 'must match "^[0-9]*$"' })
  }
  return errors
}

function validatePet(b: Record<string, unknown>) {
  const errors: { field: string; defaultMessage: string }[] = []
  if (typeof b.name !== 'string' || b.name.length === 0) errors.push({ field: 'name', defaultMessage: 'must not be empty' })
  const bd = b.birthDate
  if (typeof bd !== 'string') errors.push({ field: 'birthDate', defaultMessage: 'must not be null' })
  else if (bd > todayIso()) errors.push({ field: 'birthDate', defaultMessage: 'Birth date cannot be in the future' })
  else if (bd < yearsAgoIso(50)) errors.push({ field: 'birthDate', defaultMessage: 'Birth date cannot be older than 50 years' })
  return errors
}

export const handlers = [
  // GET /v2/owners — case-sensitive prefix match, ordered by id, 200 + empty page when nothing matches.
  http.get(`${BASE}/v2/owners`, ({ request }) => {
    const url = new URL(request.url)
    const lastName = url.searchParams.get('lastName') ?? ''
    const page = Number(url.searchParams.get('page') ?? 0)
    const size = Number(url.searchParams.get('size') ?? 20)
    const matches = db.owners.filter((o) => o.lastName.startsWith(lastName)).sort((a, b) => a.id - b.id)
    return HttpResponse.json({
      // like the real server (pets are EAGER), pages carry full pets + visits
      content: matches.slice(page * size, page * size + size).map(ownerDto),
      page,
      size,
      totalElements: matches.length,
      totalPages: Math.ceil(matches.length / size),
    })
  }),

  http.get(`${BASE}/owners/:id`, ({ params }) => {
    const owner = db.owners.find((o) => o.id === Number(params.id))
    return owner ? HttpResponse.json(ownerDto(owner)) : problem(404, 'Owner not found')
  }),

  http.post(`${BASE}/owners`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    const errors = validateOwner(body)
    if (errors.length) return problem(400, 'The request contains invalid or missing parameters', errors)
    if (!hasValidEntityPhone(body)) return entityViolation()
    const owner = { ...(body as Omit<DbOwner, 'id'>), id: db.nextId.owner++ }
    db.owners.push(owner)
    return HttpResponse.json(ownerDto(owner), { status: 201 })
  }),

  http.put(`${BASE}/owners/:id`, async ({ params, request }) => {
    const owner = db.owners.find((o) => o.id === Number(params.id))
    if (!owner) return problem(404, 'Owner not found')
    const body = (await request.json()) as Record<string, unknown>
    const errors = validateOwner(body)
    if (errors.length) return problem(400, 'The request contains invalid or missing parameters', errors)
    if (!hasValidEntityPhone(body)) return entityViolation()
    Object.assign(owner, body)
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(`${BASE}/owners/:id/pets`, async ({ params, request }) => {
    const owner = db.owners.find((o) => o.id === Number(params.id))
    if (!owner) return problem(404, 'Owner not found')
    const body = (await request.json()) as { name: string; birthDate: string; type: { id: number } }
    const errors = validatePet(body as unknown as Record<string, unknown>)
    if (errors.length) return problem(400, 'The request contains invalid or missing parameters', errors)
    const pet: DbPet = { id: db.nextId.pet++, ownerId: owner.id, name: body.name, birthDate: body.birthDate, typeId: body.type.id }
    db.pets.push(pet)
    return HttpResponse.json(petDto(pet), { status: 201 })
  }),

  http.put(`${BASE}/owners/:ownerId/pets/:petId`, async ({ params, request }) => {
    const pet = db.pets.find((p) => p.id === Number(params.petId) && p.ownerId === Number(params.ownerId))
    if (!pet) return problem(404, 'Pet not found')
    const body = (await request.json()) as { name: string; birthDate: string; type: { id: number } }
    const errors = validatePet(body as unknown as Record<string, unknown>)
    if (errors.length) return problem(400, 'The request contains invalid or missing parameters', errors)
    Object.assign(pet, { name: body.name, birthDate: body.birthDate, typeId: body.type.id })
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(`${BASE}/owners/:ownerId/pets/:petId/visits`, async ({ params, request }) => {
    const pet = db.pets.find((p) => p.id === Number(params.petId))
    if (!pet) return problem(404, 'Pet not found')
    const body = (await request.json()) as { date: string; description: string }
    if (!body.description) return problem(400, 'The request contains invalid or missing parameters', [{ field: 'description', defaultMessage: 'must not be empty' }])
    const visit = { id: db.nextId.visit++, petId: pet.id, date: body.date, description: body.description }
    db.visits.push(visit)
    return HttpResponse.json(visitDto(visit), { status: 201 })
  }),

  http.get(`${BASE}/pettypes`, () => HttpResponse.json(PET_TYPES)),
]
