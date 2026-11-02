import type { Owner, Pet, Visit } from '@/api/types'

export const ownerFullName = (o: Pick<Owner, 'firstName' | 'lastName'>): string =>
  `${o.firstName} ${o.lastName}`

/** Newest first; visits with no date sink to the bottom; ties broken by id. */
export function sortVisitsNewestFirst(visits: readonly Visit[]): Visit[] {
  return [...visits].sort((a, b) => {
    const da = a.date ?? ''
    const db = b.date ?? ''
    if (da !== db) return da < db ? 1 : -1
    return b.id - a.id
  })
}

export const lastVisit = (pet: Pet): Visit | undefined => sortVisitsNewestFirst(pet.visits)[0]
