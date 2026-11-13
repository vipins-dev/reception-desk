import type { z } from 'zod'
import { ProblemDetailSchema, type ProblemDetail } from './types'

/** Relative by default so the dev server / the host's rewrite rule keeps us same-origin. */
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '/petclinic/api'

/** Normal requests give up after 15 seconds. */
export const REQUEST_TIMEOUT_MS = 15_000
/**
 * Reads that can be the first request after the backend has been idle (the owner
 * list, an owner opened from a link) wait longer: a sleeping free-tier backend
 * needs up to about a minute to wake, and the request is simply held until it does.
 */
export const FIRST_LOAD_TIMEOUT_MS = 90_000

export type ApiErrorKind =
  /** Could not reach the server, or the request timed out. */
  | 'network'
  /** The server answered with a non-2xx status. */
  | 'http'
  /** 2xx, but the body did not match the contract we rely on. */
  | 'invalid-response'

/**
 * The one error type that leaves the API layer. UI code branches on `kind` /
 * `status` and shows `message`; it never inspects `Response` objects or
 * server-specific JSON.
 */
export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number | undefined
  /** Server-side validation messages keyed by form field (when attributable). */
  readonly fieldErrors: Readonly<Record<string, string>>

  constructor(
    kind: ApiErrorKind,
    message: string,
    options: { status?: number; fieldErrors?: Record<string, string>; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause })
    this.name = 'ApiError'
    this.kind = kind
    this.status = options.status
    this.fieldErrors = options.fieldErrors ?? {}
  }

  get isNotFound(): boolean {
    return this.status === 404
  }
}

/** Duck-typed: DOMException identity differs across realms (e.g. jsdom vs Node). */
export const isAbortError = (e: unknown): boolean =>
  typeof e === 'object' && e !== null && (e as { name?: unknown }).name === 'AbortError'

type Query = Record<string, string | number | undefined>

interface RequestOptions<S extends z.ZodType | undefined> {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  query?: Query
  body?: unknown
  signal?: AbortSignal | undefined
  /** Schema for the success body. Omit for endpoints that return 204. */
  schema?: S
  /** How long to wait before giving up. Default: `REQUEST_TIMEOUT_MS`. */
  timeoutMs?: number
}

function buildUrl(path: string, query?: Query): string {
  const url = `${API_BASE_URL}${path}`
  if (!query) return url
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${url}?${qs}` : url
}

/**
 * The API reports validation failures in a few shapes:
 *  - `{ field, defaultMessage }` from Bean Validation (MethodArgumentNotValid)
 *  - `[Path '/lastName'] ...` strings from the OpenAPI request validator
 * Map both onto `{ lastName: "..." }` so forms can show them next to the input.
 */
export function fieldErrorsFromProblem(problem: ProblemDetail): Record<string, string> {
  const out: Record<string, string> = {}
  for (const item of problem.schemaValidationErrors ?? []) {
    const message = item.defaultMessage ?? item.message
    if (!message) continue
    const field = item.field ?? /\[Path '\/([\w.]+)'\]/.exec(item.message ?? '')?.[1]
    if (field && !(field in out)) out[field] = message
  }
  return out
}

async function readProblem(response: Response): Promise<ProblemDetail | undefined> {
  try {
    const parsed = ProblemDetailSchema.safeParse(await response.json())
    return parsed.success ? parsed.data : undefined
  } catch {
    return undefined // empty body (the API answers some 404s with none) or HTML from a proxy
  }
}

function httpMessage(status: number, problem: ProblemDetail | undefined): string {
  if (status === 404) return problem?.detail ?? 'Not found'
  // 502/503/504 come from a proxy (Vite in dev, the host's rewrite rule in production) when the backend is down or restarting.
  if (status === 502 || status === 503 || status === 504) {
    return 'Cannot reach the PetClinic backend. Check that it is running, then retry.'
  }
  if (status >= 500) return 'The clinic server had a problem. Please try again.'
  return problem?.detail ?? `Request failed (${status})`
}

export async function request<S extends z.ZodType>(
  path: string,
  options: RequestOptions<S> & { schema: S },
): Promise<z.output<S>>
export async function request(path: string, options?: RequestOptions<undefined>): Promise<void>
export async function request(
  path: string,
  options: RequestOptions<z.ZodType | undefined> = {},
): Promise<unknown> {
  const { method = 'GET', query, body, signal, schema, timeoutMs = REQUEST_TIMEOUT_MS } = options
  const timeout = AbortSignal.timeout(timeoutMs)
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout

  let response: Response
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      signal: combined,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : null,
    })
  } catch (cause) {
    if (signal?.aborted) throw cause // caller cancelled: not an error to report
    const timedOut = timeout.aborted
    throw new ApiError(
      'network',
      timedOut
        ? 'The server took too long to respond.'
        : 'Cannot reach the clinic server. Check your connection and try again.',
      { cause },
    )
  }

  if (!response.ok) {
    const problem = await readProblem(response)
    throw new ApiError('http', httpMessage(response.status, problem), {
      status: response.status,
      fieldErrors: problem ? fieldErrorsFromProblem(problem) : {},
    })
  }

  if (!schema) return undefined

  let json: unknown
  try {
    json = await response.json()
  } catch (cause) {
    throw new ApiError('invalid-response', 'The server sent an unreadable response.', { cause })
  }
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    throw new ApiError('invalid-response', 'The server sent data in an unexpected format.', {
      cause: parsed.error,
    })
  }
  return parsed.data
}
