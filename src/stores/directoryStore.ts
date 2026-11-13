import { useMemo } from 'react'
import { create } from 'zustand'
import * as api from '@/api/petclinic'
import { ApiError, isAbortError } from '@/api/client'
import type { Owner } from '@/api/types'
import { filterOwners, sortOwners } from '@/domain/search'
import { useOwnersStore } from './ownerStore'
import { useSearchStore } from './searchStore'

/**
 * The owner directory: "has the whole list been loaded, and did it work?".
 *
 * The API can only search by last name, so the desk loads every owner once and
 * searches in the browser. The owners themselves go into `ownerStore` (one copy
 * of each fact); this store only tracks the loading state. That is fine for a
 * clinic with hundreds of owners; thousands would need the server-side `q`
 * search proposed in the README.
 */

export const DIRECTORY_PAGE_SIZE = 100
/** Safety cap: 20 pages of 100 owners. Beyond it the directory says it is partial. */
export const DIRECTORY_MAX_PAGES = 20

type DirectoryStatus = 'idle' | 'loading' | 'ready' | 'error'

interface DirectoryState {
  status: DirectoryStatus
  error: ApiError | null
  /** True when the clinic has more owners than the safety cap loads. */
  truncated: boolean
  /** When the last successful load was requested (ms); drives refresh-on-focus. */
  loadedAt: number
  /**
   * Load (or reload) every owner. `silent` keeps the current list on screen and
   * ignores failures: used for background refreshes.
   */
  load: (options?: { silent?: boolean }) => Promise<void>
}

export const useDirectoryStore = create<DirectoryState>()((set, get) => {
  let inflight: AbortController | null = null

  return {
    status: 'idle',
    error: null,
    truncated: false,
    loadedAt: 0,

    load: async ({ silent = false } = {}) => {
      inflight?.abort()
      const controller = new AbortController()
      inflight = controller
      const requestedAt = Date.now()
      if (!(silent && get().status === 'ready')) set({ status: 'loading', error: null })
      try {
        const owners: Owner[] = []
        let totalPages = 1
        for (let page = 0; page < Math.min(totalPages, DIRECTORY_MAX_PAGES); page++) {
          const data = await api.listOwners(page, DIRECTORY_PAGE_SIZE, controller.signal)
          if (controller.signal.aborted) return
          owners.push(...data.content)
          totalPages = data.totalPages
        }
        useOwnersStore.getState().ingest(owners, requestedAt)
        set({ status: 'ready', error: null, truncated: totalPages > DIRECTORY_MAX_PAGES, loadedAt: requestedAt })
      } catch (e) {
        if (isAbortError(e) || controller.signal.aborted) return
        if (silent && get().status === 'ready') return
        set({ status: 'error', error: e instanceof ApiError ? e : new ApiError('network', 'Could not load owners', { cause: e }) })
      }
    },
  }
})

/** Every owner the app knows about, from the owner cache. */
export function useAllOwners(): Owner[] {
  const records = useOwnersStore((s) => s.records)
  return useMemo(() => sortOwners(Object.values(records).flatMap((r) => (r.owner ? [r.owner] : []))), [records])
}

/**
 * The owners matching the search box and species chip. Memoised because it
 * re-runs on every keystroke and sorts + scans the whole directory.
 */
export function useFilteredOwners(): Owner[] {
  const all = useAllOwners()
  const query = useSearchStore((s) => s.query)
  const species = useSearchStore((s) => s.species)
  return useMemo(() => filterOwners(all, query, species), [all, query, species])
}
