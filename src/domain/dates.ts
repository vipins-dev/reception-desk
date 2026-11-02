import type { IsoDate } from '@/api/types'

/**
 * Calendar-date helpers. The API speaks `YYYY-MM-DD` strings with no timezone,
 * so we keep them as strings and compare them lexicographically instead of
 * round-tripping through `Date` (which shifts days around DST / UTC offsets).
 */

const pad = (n: number): string => String(n).padStart(2, '0')

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Today in the *browser's* local calendar. */
export function todayIso(now: Date = new Date()): IsoDate {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function isValidIsoDate(value: string): boolean {
  const m = ISO_DATE.exec(value)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const probe = new Date(y, mo - 1, d)
  return probe.getFullYear() === y && probe.getMonth() === mo - 1 && probe.getDate() === d
}

export function yearsAgoIso(years: number, now: Date = new Date()): IsoDate {
  const d = new Date(now.getFullYear() - years, now.getMonth(), now.getDate())
  return todayIso(d)
}

function parts(iso: IsoDate): { y: number; m: number; d: number } | null {
  const m = ISO_DATE.exec(iso)
  return m ? { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null
}

export function formatDate(iso: IsoDate | null | undefined): string {
  if (!iso) return 'Date not recorded'
  const p = parts(iso)
  if (!p) return iso
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(p.y, p.m - 1, p.d),
  )
}

/** "3 y 2 m", "5 months", "Under 1 month" — enough for a vet receptionist. */
export function formatAge(birth: IsoDate | null | undefined, today: IsoDate = todayIso()): string {
  const b = birth ? parts(birth) : null
  const t = parts(today)
  if (!b || !t) return 'Age unknown'
  let months = (t.y - b.y) * 12 + (t.m - b.m)
  if (t.d < b.d) months -= 1
  if (months < 0) return 'Not born yet'
  if (months < 1) return 'Under 1 month'
  const years = Math.floor(months / 12)
  const rest = months % 12
  if (years === 0) return `${rest} month${rest === 1 ? '' : 's'}`
  return rest === 0 ? `${years} y` : `${years} y ${rest} m`
}
