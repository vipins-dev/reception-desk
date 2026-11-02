import { create } from 'zustand'
import * as api from '@/api/petclinic'
import { ApiError, isAbortError } from '@/api/client'
import type {
  CreatedPet,
  CreatedVisit,
  Owner,
  OwnerFields,
  OwnerId,
  PetFields,
  PetId,
  Pet,
  VisitFields,
} from '@/api/types'
import { useSearchStore } from './searchStore'

/**
 * Owner aggregate cache.
 *
 * `GET /owners/{id}` returns the owner *with* pets and every visit, so one
 * request gives the receptionist the whole picture. Pets and visits are
 * therefore not cached separately: they are read out of the owner (see
 * `selectPet`), which means there is exactly one copy of each fact and nothing
 * to keep in sync.
 *
 * Writes are pessimistic: send, then re-read the owner. Two of the three PUTs
 * answer 204 with no body, and the create-pet response is not a trustworthy
 * source of truth (see README "API problems"), so the re-read is both the simplest
 * and the safest way to show what the server actually stored.
 */

export interface OwnerRecord {
  /** `owner` can be present together with `error`: last known data, refresh failed. */
  status: 'loading' | 'ready' | 'error'
  owner: Owner | null
  error: ApiError | null
}

interface OwnersState {
  records: Readonly<Record<number, OwnerRecord>>

  /** Fetch (or re-fetch) an owner. Cached data stays visible while refreshing. */
  load: (id: OwnerId) => Promise<void>

  create: (fields: OwnerFields) => Promise<Owner>
  update: (id: OwnerId, fields: OwnerFields) => Promise<void>
  addPet: (ownerId: OwnerId, fields: PetFields) => Promise<CreatedPet>
  updatePet: (ownerId: OwnerId, petId: PetId, fields: PetFields) => Promise<void>
  addVisit: (ownerId: OwnerId, petId: PetId, fields: VisitFields) => Promise<CreatedVisit>
}

const toApiError = (e: unknown): ApiError =>
  e instanceof ApiError ? e : new ApiError('network', 'Something went wrong', { cause: e })

export const useOwnersStore = create<OwnersState>()((set, get) => {
  const inflight = new Map<number, AbortController>()

  const patch = (id: number, next: Partial<OwnerRecord>) =>
    set((s) => {
      const prev = s.records[id] ?? { status: 'loading', owner: null, error: null }
      return { records: { ...s.records, [id]: { ...prev, ...next } } }
    })

  /** Re-read after a successful write. A failed refresh must not fail the write. */
  const reload = (id: OwnerId) => get().load(id)

  return {
    records: {},

    load: async (id) => {
      inflight.get(id)?.abort()
      const controller = new AbortController()
      inflight.set(id, controller)
      patch(id, { status: get().records[id]?.owner ? 'ready' : 'loading', error: null })
      try {
        const owner = await api.getOwner(id, controller.signal)
        if (controller.signal.aborted) return
        patch(id, { status: 'ready', owner, error: null })
      } catch (e) {
        if (isAbortError(e) || controller.signal.aborted) return
        patch(id, { status: 'error', error: toApiError(e) })
      } finally {
        if (inflight.get(id) === controller) inflight.delete(id)
      }
    },

    create: async (fields) => {
      const owner = await api.createOwner(fields)
      set((s) => ({
        records: { ...s.records, [owner.id]: { status: 'ready', owner, error: null } },
      }))
      void useSearchStore.getState().refresh()
      return owner
    },

    update: async (id, fields) => {
      await api.updateOwner(id, fields)
      await reload(id)
      void useSearchStore.getState().refresh()
    },

    addPet: async (ownerId, fields) => {
      const pet = await api.addPet(ownerId, fields)
      await reload(ownerId)
      return pet
    },

    updatePet: async (ownerId, petId, fields) => {
      await api.updatePet(ownerId, petId, fields)
      await reload(ownerId)
    },

    addVisit: async (ownerId, petId, fields) => {
      const visit = await api.addVisit(ownerId, petId, fields)
      await reload(ownerId)
      return visit
    },
  }
})

export const selectOwnerRecord = (id: OwnerId | null) => (s: OwnersState) =>
  id === null ? undefined : s.records[id]

export const findPet = (owner: Owner | null | undefined, petId: PetId | null): Pet | undefined =>
  owner && petId !== null ? owner.pets.find((p) => p.id === petId) : undefined
