import { asOwnerId, asPetId, asPetTypeId, asVisitId, type Owner } from '@/api/types'
import {
  allVisits,
  draftFromQuery,
  filterOwners,
  matchesQuery,
  matchesSpecies,
  matchesVisitQuery,
  sortOwners,
  speciesGroup,
  visitsOn,
} from './search'

let nextId = 1
const pet = (name: string, type: string, visits: { date: string | null; description: string }[] = []) => ({
  id: asPetId(nextId++),
  name,
  birthDate: '2012-09-04',
  type: { id: asPetTypeId(1), name: type },
  visits: visits.map((v) => ({ id: asVisitId(nextId++), petId: asPetId(nextId), ...v })),
})
const owner = (id: number, firstName: string, lastName: string, city: string, telephone: string, pets: Owner['pets'] = []): Owner => ({
  id: asOwnerId(id),
  firstName,
  lastName,
  address: '1 Main St',
  city,
  telephone,
  pets,
})

const george = owner(1, 'George', 'Franklin', 'Madison', '6085551023', [pet('Leo', 'cat')])
const betty = owner(2, 'Betty', 'Davis', 'Sun Prairie', '6085551749', [pet('Basil', 'hamster')])
const jose = owner(3, 'José', 'Álvarez', 'Monona', '6085552654', [pet('Rex', 'dog'), pet('Samantha', 'cat')])
const harold = owner(4, 'Harold', 'Davis', 'Windsor', '6085553198', [])
const owners = [george, betty, jose, harold]

describe('matchesQuery', () => {
  it('matches first name, last name, city and pet name, ignoring case', () => {
    expect(matchesQuery(george, 'george')).toBe(true)
    expect(matchesQuery(george, 'FRANK')).toBe(true)
    expect(matchesQuery(george, 'madi')).toBe(true)
    expect(matchesQuery(george, 'leo')).toBe(true)
    expect(matchesQuery(george, 'bas')).toBe(false)
  })

  it('needs every word to match something (first + last name together)', () => {
    expect(matchesQuery(george, 'george franklin')).toBe(true)
    expect(matchesQuery(george, 'franklin, george')).toBe(true)
    expect(matchesQuery(george, 'george davis')).toBe(false)
  })

  it('ignores accents in both directions', () => {
    expect(matchesQuery(jose, 'jose alvarez')).toBe(true)
    expect(matchesQuery(jose, 'José Álvarez')).toBe(true)
  })

  it('finds a phone number however it is typed, from three digits up', () => {
    expect(matchesQuery(george, '608')).toBe(true)
    expect(matchesQuery(george, '555-1023')).toBe(true)
    expect(matchesQuery(george, '(608) 555 1023')).toBe(true)
    expect(matchesQuery(george, '999')).toBe(false)
  })

  it('does not narrow on one or two digits: that is not a phone number yet', () => {
    expect(matchesQuery(george, '5')).toBe(true)
    expect(matchesQuery(george, '55')).toBe(true)
    expect(matchesQuery(george, '555')).toBe(true)
    expect(matchesQuery(george, '999')).toBe(false)
  })

  it('still matches short words that contain letters as text', () => {
    expect(matchesQuery(george, 'x')).toBe(false)
    expect(matchesQuery(george, 'g5')).toBe(false)
  })

  it('matches everyone for an empty or blank query', () => {
    expect(matchesQuery(george, '')).toBe(true)
    expect(matchesQuery(george, '   ')).toBe(true)
  })
})

describe('species filter', () => {
  it('groups pet types into dogs, cats and other', () => {
    expect(speciesGroup(pet('a', 'dog'))).toBe('dogs')
    expect(speciesGroup(pet('a', 'Cat'))).toBe('cats')
    expect(speciesGroup(pet('a', 'hamster'))).toBe('other')
  })

  it('keeps owners who have at least one pet of that kind', () => {
    expect(matchesSpecies(jose, 'dogs')).toBe(true)
    expect(matchesSpecies(jose, 'cats')).toBe(true)
    expect(matchesSpecies(jose, 'other')).toBe(false)
    expect(matchesSpecies(harold, 'other')).toBe(false)
    expect(matchesSpecies(harold, 'all')).toBe(true)
  })
})

describe('sortOwners and filterOwners', () => {
  it('sorts by last name, then first name, ignoring accents and case', () => {
    expect(sortOwners(owners).map((o) => o.firstName)).toEqual(['José', 'Betty', 'Harold', 'George'])
  })

  it('does not mutate its input', () => {
    const copy = [...owners]
    sortOwners(owners)
    expect(owners).toEqual(copy)
  })

  it('combines the query and the species chip', () => {
    expect(filterOwners(owners, 'davis', 'all').map((o) => o.firstName)).toEqual(['Betty', 'Harold'])
    expect(filterOwners(owners, 'davis', 'other').map((o) => o.firstName)).toEqual(['Betty'])
    expect(filterOwners(owners, '', 'cats').map((o) => o.firstName)).toEqual(['José', 'George'])
    expect(filterOwners(owners, 'zzz', 'all')).toEqual([])
  })
})

describe('visits across owners', () => {
  const rex = pet('Rex', 'dog', [
    { date: '2026-11-13', description: 'limping' },
    { date: '2026-11-01', description: 'shots' },
  ])
  const milo = pet('Milo', 'cat', [
    { date: '2026-11-13', description: 'annual exam' },
    { date: null, description: 'old record' },
  ])
  const a = owner(10, 'Ann', 'Adams', 'Madison', '6085550001', [rex])
  const b = owner(11, 'Bob', 'Baker', 'Monona', '6085550002', [milo])

  it('lists every visit newest first, undated ones last', () => {
    expect(allVisits([a, b]).map((e) => e.visit.description)).toEqual(['annual exam', 'limping', 'shots', 'old record'])
  })

  it('carries the pet and owner with each visit', () => {
    const first = allVisits([a, b])[0]
    expect(first?.pet.name).toBe('Milo')
    expect(first?.owner.lastName).toBe('Baker')
  })

  it("keeps only the visits dated today", () => {
    expect(visitsOn(allVisits([a, b]), '2026-11-13').map((e) => e.pet.name)).toEqual(['Milo', 'Rex'])
    expect(visitsOn(allVisits([a, b]), '2030-01-01')).toEqual([])
  })

  it('filters by pet, owner, species, note and phone digits', () => {
    const entries = allVisits([a, b])
    const names = (q: string) => entries.filter((e) => matchesVisitQuery(e, q)).map((e) => e.pet.name)
    expect(names('rex')).toEqual(['Rex', 'Rex'])
    expect(names('baker')).toEqual(['Milo', 'Milo'])
    expect(names('annual')).toEqual(['Milo'])
    expect(names('cat')).toEqual(['Milo', 'Milo'])
    expect(names('555-0001')).toEqual(['Rex', 'Rex'])
    expect(names('')).toHaveLength(4)
  })
})

describe('draftFromQuery (prefill for "Create <search>")', () => {
  it('uses one word as the last name, capitalised', () => {
    expect(draftFromQuery('smith')).toEqual({ lastName: 'Smith' })
  })
  it('uses two or more words as first name and last name', () => {
    expect(draftFromQuery('sam smith')).toEqual({ firstName: 'Sam', lastName: 'Smith' })
    expect(draftFromQuery('mary ann de vries')).toEqual({ firstName: 'Mary', lastName: 'Ann De Vries' })
  })
  it('uses digits as the telephone number, as typed', () => {
    expect(draftFromQuery('608 555 0101')).toEqual({ telephone: '608 555 0101' })
    expect(draftFromQuery('(608) 555-0101')).toEqual({ telephone: '(608) 555-0101' })
  })
  it('prefills nothing for an empty search', () => {
    expect(draftFromQuery('   ')).toEqual({})
  })
})
