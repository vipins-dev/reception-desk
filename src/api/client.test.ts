import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { BASE } from '@/test/fakeBackend'
import { ApiError, FIRST_LOAD_TIMEOUT_MS, REQUEST_TIMEOUT_MS, fieldErrorsFromProblem, isAbortError, request } from './client'
import { addVisit, getOwner, listOwners, searchOwners } from './petclinic'
import { OwnerSchema, asOwnerId, asPetId } from './types'

const caught = async (p: Promise<unknown>): Promise<ApiError> => {
  try {
    await p
  } catch (e) {
    expect(e).toBeInstanceOf(ApiError)
    return e as ApiError
  }
  throw new Error('expected the request to fail')
}

describe('request()', () => {
  it('returns validated data with branded ids and defaults missing arrays', async () => {
    server.use(
      http.get(`${BASE}/owners/7`, () =>
        HttpResponse.json({ id: 7, firstName: 'A', lastName: 'B', address: 'x', city: 'y', telephone: '1' }),
      ),
    )
    const owner = await getOwner(asOwnerId(7))
    expect(owner.id).toBe(7)
    expect(owner.pets).toEqual([]) // `pets` missing on the wire becomes []
  })

  it('maps a 404 with an EMPTY body (the v1 list endpoint does this) to ApiError.isNotFound', async () => {
    server.use(http.get(`${BASE}/owners/9`, () => new HttpResponse(null, { status: 404 })))
    const e = await caught(getOwner(asOwnerId(9)))
    expect(e).toMatchObject({ kind: 'http', status: 404, isNotFound: true })
  })

  it('does not leak server internals on 5xx', async () => {
    server.use(
      http.get(`${BASE}/owners/1`, () =>
        HttpResponse.json({ status: 500, detail: 'NullPointerException at Foo.java:42' }, { status: 500 }),
      ),
    )
    const e = await caught(getOwner(asOwnerId(1)))
    expect(e.message).toBe('The clinic server had a problem. Please try again.')
  })

  it('survives non-JSON error bodies from a proxy and says the backend is unreachable', async () => {
    server.use(http.get(`${BASE}/owners/1`, () => new HttpResponse('<html>Bad gateway</html>', { status: 502 })))
    const e = await caught(getOwner(asOwnerId(1)))
    expect(e).toMatchObject({ kind: 'http', status: 502 })
    expect(e.message).toBe('Cannot reach the PetClinic backend. Check that it is running, then retry.')
  })

  it('reports an unreachable server as a network error', async () => {
    server.use(http.get(`${BASE}/owners/1`, () => HttpResponse.error()))
    const e = await caught(getOwner(asOwnerId(1)))
    expect(e.kind).toBe('network')
    expect(e.message).toMatch(/cannot reach/i)
  })

  it('rejects a 200 whose body breaks the contract instead of passing it on', async () => {
    server.use(http.get(`${BASE}/owners/1`, () => HttpResponse.json({ id: 'one' })))
    const e = await caught(getOwner(asOwnerId(1)))
    expect(e.kind).toBe('invalid-response')
  })

  it('surfaces caller cancellation as an AbortError, not an ApiError', async () => {
    server.use(http.get(`${BASE}/v2/owners`, async () => new Promise(() => {})))
    const controller = new AbortController()
    const pending = searchOwners({ lastName: 'D', page: 0, size: 10 }, controller.signal)
    controller.abort()
    await expect(pending).rejects.toSatisfy(isAbortError)
  })

  it('sends JSON bodies with the right verb and path', async () => {
    let seen: { url: string; body: unknown; type: string | null } | undefined
    server.use(
      http.post(`${BASE}/owners/1/pets/2/visits`, async ({ request }) => {
        seen = { url: request.url, body: await request.json(), type: request.headers.get('content-type') }
        return HttpResponse.json({ id: 5, petId: 2, date: '2026-01-01', description: 'x' }, { status: 201 })
      }),
    )
    await addVisit(asOwnerId(1), asPetId(2), { date: '2026-01-01', description: 'x' })
    expect(seen).toEqual({
      url: `${BASE}/owners/1/pets/2/visits`,
      body: { date: '2026-01-01', description: 'x' },
      type: 'application/json',
    })
  })
})

describe('timeouts', () => {
  it('gives up after the per-request timeout, with a clear message', async () => {
    server.use(http.get(`${BASE}/owners/1`, () => new Promise(() => {})))
    const e = await caught(request('/owners/1', { schema: OwnerSchema, timeoutMs: 30 }))
    expect(e).toMatchObject({ kind: 'network', message: 'The server took too long to respond.' })
  })

  it('lets first loads wait for a sleeping backend, but not ordinary writes', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout')
    await getOwner(asOwnerId(6))
    await listOwners(0, 100)
    await addVisit(asOwnerId(6), asPetId(8), { date: '2026-01-01', description: 'x' })
    expect(timeout.mock.calls.map((c) => c[0])).toEqual([FIRST_LOAD_TIMEOUT_MS, FIRST_LOAD_TIMEOUT_MS, REQUEST_TIMEOUT_MS])
    expect(FIRST_LOAD_TIMEOUT_MS).toBeGreaterThan(REQUEST_TIMEOUT_MS)
  })
})

describe('fieldErrorsFromProblem', () => {
  it('reads Bean Validation messages (field + defaultMessage)', () => {
    expect(
      fieldErrorsFromProblem({ schemaValidationErrors: [{ field: 'telephone', defaultMessage: 'must match digits', message: "Field 'telephone' ..." }] }),
    ).toEqual({ telephone: 'must match digits' })
  })

  it("reads OpenAPI-validator messages like [Path '/lastName'] ...", () => {
    expect(
      fieldErrorsFromProblem({ schemaValidationErrors: [{ message: "[Path '/lastName'] Instance type (null) does not match" }] }),
    ).toEqual({ lastName: "[Path '/lastName'] Instance type (null) does not match" })
  })

  it('keeps the first message per field and ignores unattributable ones', () => {
    expect(
      fieldErrorsFromProblem({
        schemaValidationErrors: [
          { field: 'name', defaultMessage: 'first' },
          { field: 'name', defaultMessage: 'second' },
          { message: 'something general' },
        ],
      }),
    ).toEqual({ name: 'first' })
  })
})
