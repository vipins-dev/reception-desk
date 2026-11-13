import { delay, http, HttpResponse } from 'msw'
import { asOwnerId, asPetId } from '@/api/types'
import { BASE, db } from '@/test/fakeBackend'
import { server } from '@/test/server'
import { DIRECTORY_MAX_PAGES, useDirectoryStore } from './directoryStore'
import { useOwnersStore } from './ownerStore'
import { usePetTypeStore } from './petTypeStore'
import { useSearchStore } from './searchStore'

const cachedLastNames = () =>
  Object.values(useOwnersStore.getState().records).map((r) => r.owner?.lastName)

const page = (content: unknown[], pageNo: number, totalPages: number, size = 100) => ({
  content,
  page: pageNo,
  size,
  totalElements: content.length * totalPages,
  totalPages,
})

describe('searchStore', () => {
  it('holds the query and the species chip, nothing else', () => {
    useSearchStore.getState().setQuery('dav')
    useSearchStore.getState().setSpecies('dogs')
    expect(useSearchStore.getState()).toMatchObject({ query: 'dav', species: 'dogs' })
  })
})

describe('directoryStore', () => {
  it('loads every owner into the owner cache and becomes ready', async () => {
    await useDirectoryStore.getState().load()
    expect(useDirectoryStore.getState()).toMatchObject({ status: 'ready', error: null, truncated: false })
    expect(cachedLastNames()).toEqual(['Franklin', 'Davis', 'Davis', 'Coleman'])
    expect(useOwnersStore.getState().records[6]?.owner?.pets.map((p) => p.name)).toEqual(['Samantha', 'Max'])
  })

  it('follows every page of the list', async () => {
    const seen: string[] = []
    server.use(
      http.get(`${BASE}/v2/owners`, ({ request }) => {
        const n = Number(new URL(request.url).searchParams.get('page'))
        seen.push(`page ${n}`)
        const half = db.owners.slice(n * 2, n * 2 + 2).map((o) => ({ ...o, pets: [] }))
        return HttpResponse.json(page(half, n, 2, 2))
      }),
    )
    await useDirectoryStore.getState().load()
    expect(seen).toEqual(['page 0', 'page 1'])
    expect(cachedLastNames()).toHaveLength(4)
  })

  it('stops at the safety cap and says the list is partial', async () => {
    let calls = 0
    server.use(
      http.get(`${BASE}/v2/owners`, () => {
        calls++
        return HttpResponse.json(page([{ ...db.owners[0]!, pets: [] }], calls - 1, DIRECTORY_MAX_PAGES + 5))
      }),
    )
    await useDirectoryStore.getState().load()
    expect(calls).toBe(DIRECTORY_MAX_PAGES)
    expect(useDirectoryStore.getState().truncated).toBe(true)
  })

  it('records an error, and a retry recovers', async () => {
    server.use(http.get(`${BASE}/v2/owners`, () => new HttpResponse(null, { status: 500 }), { once: true }))
    await useDirectoryStore.getState().load()
    expect(useDirectoryStore.getState().status).toBe('error')
    await useDirectoryStore.getState().load()
    expect(useDirectoryStore.getState().status).toBe('ready')
  })

  it('a silent refresh keeps the list on screen, picks up new owners, and ignores failures', async () => {
    await useDirectoryStore.getState().load()
    db.owners.push({ id: 50, firstName: 'New', lastName: 'Arrival', address: 'a', city: 'c', telephone: '6085550150' })
    await useDirectoryStore.getState().load({ silent: true })
    expect(cachedLastNames()).toContain('Arrival')

    server.use(http.get(`${BASE}/v2/owners`, () => HttpResponse.error()))
    const loading = useDirectoryStore.getState().load({ silent: true })
    expect(useDirectoryStore.getState().status).toBe('ready') // never flips to "loading"
    await loading
    expect(useDirectoryStore.getState()).toMatchObject({ status: 'ready', error: null })
    expect(cachedLastNames()).toHaveLength(5)
  })

  it('does not let a slow list overwrite an owner that was re-read after the list was requested', async () => {
    server.use(
      http.get(`${BASE}/v2/owners`, async () => {
        const stale = db.owners.map((o) => ({ ...o, pets: [] })) // snapshot taken when the request arrives
        await delay(80)
        return HttpResponse.json(page(stale, 0, 1))
      }),
    )
    const slowList = useDirectoryStore.getState().load()
    await new Promise((r) => setTimeout(r, 10)) // the list request is now in flight
    await useOwnersStore.getState().update(asOwnerId(6), {
      firstName: 'Jeanne',
      lastName: 'Coleman',
      address: '105 N. Lake St.',
      city: 'Monona',
      telephone: '6085552654',
    })
    await slowList
    expect(useOwnersStore.getState().records[6]?.owner?.firstName).toBe('Jeanne')
    expect(useOwnersStore.getState().records[1]?.owner?.firstName).toBe('George') // the others did arrive
  })
})

describe('ownersStore', () => {
  const id = asOwnerId(6)

  it('loads an owner with pets and visits in one request', async () => {
    await useOwnersStore.getState().load(id)
    const rec = useOwnersStore.getState().records[id]
    expect(rec?.status).toBe('ready')
    expect(rec?.owner?.pets.map((p) => p.name)).toEqual(['Samantha', 'Max'])
    expect(rec?.owner?.pets[1]?.visits).toHaveLength(2)
  })

  it('records a 404 as an error with no owner', async () => {
    await useOwnersStore.getState().load(asOwnerId(999))
    const rec = useOwnersStore.getState().records[999]
    expect(rec).toMatchObject({ status: 'error', owner: null })
    expect(rec?.error?.isNotFound).toBe(true)
  })

  it('re-reads the owner after a write so the UI shows what the server stored', async () => {
    await useOwnersStore.getState().load(id)
    await useOwnersStore.getState().addVisit(id, asPetId(7), { date: '2026-11-02', description: 'checkup' })
    const pet = useOwnersStore.getState().records[id]?.owner?.pets.find((p) => p.id === 7)
    expect(pet?.visits.map((v) => v.description)).toContain('checkup')
  })

  it('does not apply a write that the server rejected', async () => {
    await useOwnersStore.getState().load(id)
    await expect(
      useOwnersStore.getState().update(id, { firstName: 'X1', lastName: 'Coleman', address: 'a', city: 'c', telephone: '6085550199' }),
    ).rejects.toMatchObject({ status: 400 })
    expect(useOwnersStore.getState().records[id]?.owner?.firstName).toBe('Jean')
  })

  it('keeps last-known data (status "error") when a refresh fails', async () => {
    await useOwnersStore.getState().load(id)
    server.use(http.get(`${BASE}/owners/6`, () => HttpResponse.error()))
    await useOwnersStore.getState().load(id)
    const rec = useOwnersStore.getState().records[id]
    expect(rec?.status).toBe('error')
    expect(rec?.owner?.lastName).toBe('Coleman')
  })

  it('a successful write is still successful if the follow-up refresh fails', async () => {
    await useOwnersStore.getState().load(id)
    server.use(http.get(`${BASE}/owners/6`, () => HttpResponse.error()))
    await expect(
      useOwnersStore.getState().addVisit(id, asPetId(7), { date: '2026-11-02', description: 'x' }),
    ).resolves.toMatchObject({ id: expect.any(Number) })
    expect(db.visits.some((v) => v.description === 'x')).toBe(true)
  })

  it('puts a newly created owner straight into the cache, where every list is derived from', async () => {
    const owner = await useOwnersStore.getState().create({ firstName: 'Ned', lastName: 'Newman', address: 'a', city: 'c', telephone: '6085550199' })
    expect(useOwnersStore.getState().records[owner.id]).toMatchObject({ status: 'ready', owner: { lastName: 'Newman' } })
  })
})

describe('petTypeStore', () => {
  it('shares one request between concurrent callers and caches the result', async () => {
    let calls = 0
    server.use(
      http.get(`${BASE}/pettypes`, () => {
        calls++
        return HttpResponse.json([{ id: 1, name: 'cat' }])
      }),
    )
    await Promise.all([usePetTypeStore.getState().load(), usePetTypeStore.getState().load()])
    await usePetTypeStore.getState().load()
    expect(calls).toBe(1)
    expect(usePetTypeStore.getState().types).toEqual([{ id: 1, name: 'cat' }])
  })

  it('can retry after a failure', async () => {
    server.use(http.get(`${BASE}/pettypes`, () => new HttpResponse(null, { status: 500 }), { once: true }))
    await usePetTypeStore.getState().load()
    expect(usePetTypeStore.getState().status).toBe('error')
    await usePetTypeStore.getState().load()
    expect(usePetTypeStore.getState().status).toBe('ready')
  })
})
