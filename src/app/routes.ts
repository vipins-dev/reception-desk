import { useParams } from 'react-router'
import { OwnerIdSchema, PetIdSchema, type OwnerId, type PetId } from '@/api/types'

/** The URL is the source of truth for "which owner / pet is on screen". */
export const paths = {
  home: '/',
  newOwner: '/owners/new',
  owner: (id: OwnerId) => `/owners/${id}`,
  newPet: (id: OwnerId) => `/owners/${id}/pets/new`,
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
