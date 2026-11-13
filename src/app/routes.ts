import { useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { OwnerIdSchema, PetIdSchema, type OwnerId, type PetId } from '@/api/types'

/** The URL is the source of truth for "which owner / pet is on screen". */
export const paths = {
  home: '/',
  allOwners: '/owners',
  visits: '/visits',
  owner: (id: OwnerId) => `/owners/${id}`,
  pet: (ownerId: OwnerId, petId: PetId) => `/owners/${ownerId}/pets/${petId}`,
} as const

const DIGITS = /^\d+$/

/** `null` means the param is absent *or malformed* — callers render "not found". */
export function useOwnerIdParam(): OwnerId | null {
  const { ownerId } = useParams()
  if (ownerId === undefined || !DIGITS.test(ownerId)) return null
  const parsed = OwnerIdSchema.safeParse(Number(ownerId))
  return parsed.success ? parsed.data : null
}

export function usePetIdParam(): PetId | null {
  const { petId } = useParams()
  if (petId === undefined || !DIGITS.test(petId)) return null
  const parsed = PetIdSchema.safeParse(Number(petId))
  return parsed.success ? parsed.data : null
}

const NEW_OWNER_PARAM = 'new'

/**
 * The New Owner drawer is a `?new=owner` flag on whatever page is open, so it
 * slides over the current screen without changing what is selected behind it.
 */
export function useNewOwnerDrawer() {
  const [params, setParams] = useSearchParams()
  const isOpen = params.get(NEW_OWNER_PARAM) === 'owner'
  const open = useCallback(
    () =>
      setParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set(NEW_OWNER_PARAM, 'owner')
        return next
      }),
    [setParams],
  )
  const close = useCallback(
    () =>
      setParams((prev) => {
        const next = new URLSearchParams(prev)
        next.delete(NEW_OWNER_PARAM)
        return next
      }),
    [setParams],
  )
  return { isOpen, open, close }
}
