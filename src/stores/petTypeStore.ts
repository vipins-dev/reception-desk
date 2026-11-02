import { create } from 'zustand'
import * as api from '@/api/petclinic'
import { ApiError } from '@/api/client'
import type { PetType } from '@/api/types'

/** Reference data: loaded once, shared by every pet form. */
interface PetTypeState {
  types: PetType[]
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: ApiError | null
  /** Safe to call from any component; concurrent calls share one request. */
  load: () => Promise<void>
}

export const usePetTypeStore = create<PetTypeState>()((set, get) => {
  let pending: Promise<void> | null = null

  return {
    types: [],
    status: 'idle',
    error: null,

    load: () => {
      if (get().status === 'ready') return Promise.resolve()
      if (pending) return pending
      set({ status: 'loading', error: null })
      pending = api
        .listPetTypes()
        .then((types) => set({ types, status: 'ready' }))
        .catch((e: unknown) =>
          set({
            status: 'error',
            error: e instanceof ApiError ? e : new ApiError('network', 'Could not load pet types', { cause: e }),
          }),
        )
        .finally(() => {
          pending = null
        })
      return pending
    },
  }
})
