import { asPetId, asVisitId, type Visit } from '@/api/types'
import { sortVisitsNewestFirst } from './format'

const visit = (id: number, date: string | null): Visit => ({
  id: asVisitId(id),
  petId: asPetId(1),
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
