import { asOwnerId, asPetId, asPetTypeId, asVisitId, type Owner, type Visit } from '@/api/types'
import { formatPhone, lastOwnerVisit, petSummary, plural, sortVisitsNewestFirst, titleCase } from './format'

const visit = (id: number, date: string | null, petId = 1): Visit => ({
  id: asVisitId(id),
  petId: asPetId(petId),
  date,
  description: `v${id}`,
})

describe('sortVisitsNewestFirst', () => {
  it('orders by date descending, breaks ties by id, and puts undated visits last', () => {
    const sorted = sortVisitsNewestFirst([visit(1, '2013-01-01'), visit(2, null), visit(3, '2013-01-04'), visit(4, '2013-01-04')])
    expect(sorted.map((v) => v.id)).toEqual([4, 3, 1, 2])
  })

  it('does not mutate its input', () => {
    const input = [visit(1, '2013-01-01'), visit(2, '2014-01-01')]
    sortVisitsNewestFirst(input)
    expect(input.map((v) => v.id)).toEqual([1, 2])
  })
})

describe('formatPhone', () => {
  it('formats exactly ten digits the way people say them', () => {
    expect(formatPhone('6085551023')).toBe('(608) 555-1023')
  })
  it('leaves anything else exactly as stored', () => {
    expect(formatPhone('12345')).toBe('12345')
    expect(formatPhone('(608) 555-1023')).toBe('(608) 555-1023')
    expect(formatPhone('+16085551023')).toBe('+16085551023')
  })
})

describe('small text helpers', () => {
  it('capitalises pet type names, which the server stores in lower case', () => {
    expect(titleCase('cat')).toBe('Cat')
    expect(titleCase('')).toBe('')
  })
  it('pluralises counts', () => {
    expect(plural(1, 'pet')).toBe('1 pet')
    expect(plural(0, 'pet')).toBe('0 pets')
    expect(plural(2, 'registered owner')).toBe('2 registered owners')
  })
})

const owner = (pets: Owner['pets']): Owner => ({
  id: asOwnerId(1),
  firstName: 'Jean',
  lastName: 'Coleman',
  address: 'a',
  city: 'c',
  telephone: '6085552654',
  pets,
})
const pet = (id: number, name: string, type: string, visits: Visit[] = []) => ({
  id: asPetId(id),
  name,
  birthDate: '2012-09-04',
  type: { id: asPetTypeId(1), name: type },
  visits,
})

describe('petSummary and lastOwnerVisit', () => {
  const jean = owner([pet(7, 'Samantha', 'cat', [visit(1, '2013-01-01', 7)]), pet(8, 'Max', 'cat', [visit(2, '2013-01-03', 8)])])

  it('lists pets with their species', () => {
    expect(petSummary(jean)).toBe('Samantha (Cat), Max (Cat)')
    expect(petSummary(owner([]))).toBe('')
  })

  it('finds the newest visit across all pets', () => {
    expect(lastOwnerVisit(jean)?.id).toBe(2)
    expect(lastOwnerVisit(owner([pet(9, 'Rex', 'dog')]))).toBeUndefined()
  })
})
