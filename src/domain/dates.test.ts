import { formatAge, formatDate, isValidIsoDate, todayIso, yearsAgoIso } from './dates'

describe('todayIso', () => {
  it('uses the local calendar date, zero-padded', () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})

describe('isValidIsoDate', () => {
  it.each(['2024-02-29', '2026-11-02'])('accepts %s', (v) => expect(isValidIsoDate(v)).toBe(true))
  it.each(['2025-02-29', '2026-13-01', '2026-1-1', '', 'tomorrow'])('rejects %s', (v) =>
    expect(isValidIsoDate(v)).toBe(false),
  )
})

describe('yearsAgoIso', () => {
  it('subtracts whole years', () => {
    expect(yearsAgoIso(50, new Date(2026, 10, 2))).toBe('1976-11-02')
  })
})

describe('formatAge', () => {
  it('formats years and months', () => {
    expect(formatAge('2020-01-15', '2023-03-20')).toBe('3 y 2 m')
  })
  it('omits zero months', () => {
    expect(formatAge('2020-03-20', '2023-03-20')).toBe('3 y')
  })
  it('does not count a month until its day has been reached', () => {
    expect(formatAge('2023-01-20', '2023-03-19')).toBe('1 month')
  })
  it('handles under a month and unknown dates', () => {
    expect(formatAge('2023-03-10', '2023-03-20')).toBe('Under 1 month')
    expect(formatAge(null)).toBe('Age unknown')
    expect(formatAge('garbage', '2023-03-20')).toBe('Age unknown')
  })
})

describe('formatDate', () => {
  it('is stable regardless of timezone (no UTC round trip)', () => {
    expect(formatDate('2013-01-01')).toBe('1 Jan 2013')
  })
  it('explains missing dates', () => {
    expect(formatDate(undefined)).toBe('Date not recorded')
  })
})
