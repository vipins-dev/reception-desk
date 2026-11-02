import { delay, http, HttpResponse } from 'msw'
import { asOwnerId, asPetId } from '@/api/types'
import { BASE, db } from '@/test/fakeBackend'
import { server } from '@/test/server'
import { useOwnersStore } from './ownerStore'
import { usePetTypeStore } from './petTypeStore'
import { useSearchStore } from './searchStore'

describe('searchStore', () => {
  it('browses all owners for an empty query', async () => {
    await useSearchStore.getState().run()
    const s = useSearchStore.getState()
    expect(s.result.status).toBe('ready')
    expect(s.owners.map((o) => o.lastName)).toEqual(['Franklin', 'Davis', 'Davis', 'Coleman'])
    expect(s.totalElements).toBe(4)
  })

  it('searches by last-name prefix and tolerates lowercase input', async () => {
    useSearchStore.getState().setQuery('dav')
    await useSearchStore.getState().run()
    expect(useSearchStore.getState().owners.map((o) => o.firstName)).toEqual(['Betty', 'Harold'])
  })

  it('treats "no match" as an empty ready state, not an error', async () => {
    useSearchStore.getState().setQuery('Zzz')
    await useSearchStore.getState().run()
    expect(useSearchStore.getState()).toMatchObject({ result: { status: 'ready' }, owners: [], totalElements: 0 })
  })

  it('lets only the newest request win when responses arrive out of order', async () => {
    server.use(
      http.get(`${BASE}/v2/owners`, async ({ request }) => {
        const q = new URL(request.url).searchParams.get('lastName')
        if (q === 'D') await delay(80) // the slow, stale response
        const owners = q === 'D' ? db.owners : db.owners.filter((o) => o.lastName.startsWith(q ?? ''))
        return HttpResponse.json({
          content: owners.map((o) => ({ ...o, pets: [] })),
          page: 0,
          size: 10,
          totalElements: owners.length,
          totalPages: 1,
        })
      }),
    )
    const store = useSearchStore.getState()
    store.setQuery('D')
    const slow = store.run()
    store.setQuery('Franklin')
    const fast = store.run()
    await Promise.all([slow, fast])
    expect(useSearchStore.getState().owners.map((o) => o.lastName)).toEqual(['Franklin'])
    expect(useSearchStore.getState().resultsFor).toBe('Franklin')
  })

  it('keeps showing the previous results when a search fails, and records the error', async () => {
    await useSearchStore.getState().run()
    server.use(http.get(`${BASE}/v2/owners`, () => new HttpResponse(null, { status: 500 })))
    await useSearchStore.getState().run()
    const s = useSearchStore.getState()
    expect(s.result.status).toBe('error')
    expect(s.owners).toHaveLength(4)
  })

  it('refresh() does nothing until a search has been made', async () => {
    let calls = 0
    server.use(http.get(`${BASE}/v2/owners`, () => (calls++, HttpResponse.json({ content: [], page: 0, size: 10, totalElements: 0, totalPages: 0 }))))
    await useSearchStore.getState().refresh()
    expect(calls).toBe(0)
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

  it('refreshes the search list after creating an owner', async () => {
    useSearchStore.getState().setQuery('Newman')
    await useSearchStore.getState().run()
    expect(useSearchStore.getState().totalElements).toBe(0)
    await useOwnersStore.getState().create({ firstName: 'Ned', lastName: 'Newman', address: 'a', city: 'c', telephone: '6085550199' })
    await vi.waitFor(() => expect(useSearchStore.getState().totalElements).toBe(1))
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
