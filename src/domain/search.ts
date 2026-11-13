import type { IsoDate, Owner, Pet, Visit } from '@/api/types'
import type { OwnerFormValues } from './validation'

/**
 * Searching and grouping owners in the browser.
 *
 * The API can only search by last-name prefix (case-sensitive), but the desk
 * needs "Name, phone, city, or pet". The app therefore loads the owner list once
 * (see `directoryStore`) and filters it here. These are pure functions over the
 * owners already in memory, which keeps them easy to test.
 */

export type SpeciesFilter = 'all' | 'dogs' | 'cats' | 'other'
export type SpeciesGroup = Exclude<SpeciesFilter, 'all'>

export const SPECIES_FILTERS: readonly { value: SpeciesFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'dogs', label: 'Dogs' },
  { value: 'cats', label: 'Cats' },
  { value: 'other', label: 'Other' },
]

export function speciesGroup(pet: Pet): SpeciesGroup {
  const name = pet.type.name.toLowerCase()
  return name === 'dog' ? 'dogs' : name === 'cat' ? 'cats' : 'other'
}

/** Case- and accent-insensitive: "jose" finds "José". */
const fold = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

const digitsOf = (s: string): string => s.replace(/\D/g, '')

/**
 * Does one typed word match this owner's `text` fields or phone number?
 * Three or more digits match inside the phone number, so "555-1023" and
 * "(608) 555" both work. One or two digits are too short to mean a phone
 * number yet, so they do not narrow anything: typing a number digit by digit
 * must not flash "no owner found" at the first keystroke.
 */
function wordMatches(word: string, text: readonly string[], phone: string): boolean {
  if (text.some((t) => t.includes(word))) return true
  const digits = digitsOf(word)
  if (digits.length === 0) return false
  if (digits.length < 3) return !/\p{L}/u.test(word)
  return phone.includes(digits)
}

/**
 * Every word of the query must match something about the owner: first name,
 * last name, city, a pet's name, or (digits) the phone number.
 */
export function matchesQuery(owner: Owner, query: string): boolean {
  const words = fold(query).split(/[\s,]+/).filter(Boolean)
  const text = [owner.firstName, owner.lastName, owner.city, ...owner.pets.map((p) => p.name)].map(fold)
  const phone = digitsOf(owner.telephone)
  return words.every((word) => wordMatches(word, text, phone))
}

export const matchesSpecies = (owner: Owner, species: SpeciesFilter): boolean =>
  species === 'all' || owner.pets.some((p) => speciesGroup(p) === species)

/** Alphabetical by last name, then first name; the id keeps the order stable. */
export function sortOwners(owners: readonly Owner[]): Owner[] {
  const collator = new Intl.Collator(undefined, { sensitivity: 'base' })
  return [...owners].sort(
    (a, b) => collator.compare(a.lastName, b.lastName) || collator.compare(a.firstName, b.firstName) || a.id - b.id,
  )
}

export const filterOwners = (owners: readonly Owner[], query: string, species: SpeciesFilter): Owner[] =>
  sortOwners(owners.filter((o) => matchesSpecies(o, species) && matchesQuery(o, query)))

/** A visit together with the pet and owner it belongs to (visits only carry a pet id). */
export interface VisitEntry {
  owner: Owner
  pet: Pet
  visit: Visit
}

/** Every visit of every pet, newest first (undated visits last, ties by id). */
export function allVisits(owners: readonly Owner[]): VisitEntry[] {
  const found: VisitEntry[] = owners.flatMap((owner) =>
    owner.pets.flatMap((pet) => pet.visits.map((visit) => ({ owner, pet, visit }))),
  )
  return found.sort((a, b) => {
    const da = a.visit.date ?? ''
    const db = b.visit.date ?? ''
    return da === db ? b.visit.id - a.visit.id : da < db ? 1 : -1
  })
}

/** Visits dated `today`. */
export const visitsOn = (entries: readonly VisitEntry[], today: IsoDate): VisitEntry[] =>
  entries.filter((e) => e.visit.date === today)

/** The Today's Visits filter box: pet, owner, phone (digits) or the visit note. */
export function matchesVisitQuery({ owner, pet, visit }: VisitEntry, query: string): boolean {
  const words = fold(query).split(/[\s,]+/).filter(Boolean)
  const text = [pet.name, pet.type.name, owner.firstName, owner.lastName, visit.description].map(fold)
  const phone = digitsOf(owner.telephone)
  return words.every((word) => wordMatches(word, text, phone))
}

const capitalise = (s: string): string => s.charAt(0).toLocaleUpperCase() + s.slice(1)

/**
 * What to prefill in the New Owner form when the search found nobody:
 * digits become the phone number ("608 555 0101"), one word the last name
 * ("smith") and two or more words first name + last name ("sam smith").
 */
export function draftFromQuery(query: string): Partial<OwnerFormValues> {
  const q = query.trim()
  if (!q) return {}
  if (/^[\d\s().-]+$/.test(q) && digitsOf(q).length > 0) return { telephone: q }
  const [first, ...rest] = q.split(/\s+/).map(capitalise)
  if (rest.length === 0) return { lastName: first ?? '' }
  return { firstName: first ?? '', lastName: rest.join(' ') }
}
