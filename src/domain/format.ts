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

/** Most recent visit across all of an owner's pets. */
export function lastOwnerVisit(owner: Owner): Visit | undefined {
  return sortVisitsNewestFirst(owner.pets.flatMap((p) => p.visits))[0]
}

/** "(608) 555-1023" for a 10-digit number; anything else is shown exactly as stored. */
export function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '')
  return d.length === 10 && d === raw.trim() ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : raw
}

/** Pet type names come from the server in lower case ("cat"). */
export const titleCase = (s: string): string => s.charAt(0).toLocaleUpperCase() + s.slice(1)

export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`

/** "Samantha (Cat), Max (Cat)" */
export const petSummary = (owner: Pick<Owner, 'pets'>): string =>
  owner.pets.map((p) => `${p.name} (${titleCase(p.type.name)})`).join(', ')
