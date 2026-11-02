import { create } from 'zustand'
import * as api from '@/api/petclinic'
import { ApiError, isAbortError } from '@/api/client'
import type { Owner } from '@/api/types'
import { normalizeLastNameQuery } from '@/domain/validation'

export const SEARCH_PAGE_SIZE = 10

/**
 * A discriminated union: `error` only exists in the error state, so the UI
 * cannot render an error message while showing a spinner, and TypeScript
 * enforces it.
 */
type SearchResult =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'error'; error: ApiError }

interface SearchState {
  /** What the receptionist typed (raw, so the input stays controlled). */
  query: string
  /** Zero-based page of the *last requested* search. */
  page: number
  /** Last successful page of owners. Kept while a newer search is loading. */
  owners: Owner[]
  totalElements: number
  totalPages: number
  /** The query the visible `owners` were fetched for. */
  resultsFor: string | null
  result: SearchResult

  setQuery: (query: string) => void
  /** Run the search for the current query (page 0 unless given). */
  run: (page?: number) => Promise<void>
  /** Re-run the last search in place, e.g. after an owner was created/edited. */
  refresh: () => Promise<void>
}

const initial = {
  query: '',
  page: 0,
  owners: [] as Owner[],
  totalElements: 0,
  totalPages: 0,
  resultsFor: null as string | null,
  result: { status: 'idle' } as SearchResult,
}

export const useSearchStore = create<SearchState>()((set, get) => {
  // Only the newest request may write to the store. Earlier ones are aborted
  // and, if they still resolve, ignored — a slow "Da" response must never
  // overwrite the "Davis" results the receptionist is looking at.
  let inflight: AbortController | null = null

  return {
    ...initial,

    setQuery: (query) => set({ query }),

    run: async (page = 0) => {
      const query = get().query
      inflight?.abort()
      const controller = new AbortController()
      inflight = controller
      set({ page, result: { status: 'loading' } })
      try {
        const data = await api.searchOwners(
          { lastName: normalizeLastNameQuery(query), page, size: SEARCH_PAGE_SIZE },
          controller.signal,
        )
        if (controller.signal.aborted) return
        set({
          owners: data.content,
          totalElements: data.totalElements,
          totalPages: data.totalPages,
          resultsFor: query,
          result: { status: 'ready' },
        })
      } catch (e) {
        if (isAbortError(e) || controller.signal.aborted) return
        const error = e instanceof ApiError ? e : new ApiError('network', 'Search failed', { cause: e })
        set({ result: { status: 'error', error } })
      }
    },

    refresh: () => (get().result.status === 'idle' ? Promise.resolve() : get().run(get().page)),
  }
})
