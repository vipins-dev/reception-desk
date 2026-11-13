import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { paths } from '@/app/routes'
import { SearchIcon } from '@/components/icons'
import { Alert, Button, Panel, Skeleton, inputClass } from '@/components/ui'
import { WakingNote } from '@/components/WakingNote'
import { formatDate, todayIso } from '@/domain/dates'
import { formatPhone, titleCase } from '@/domain/format'
import { allVisits, matchesVisitQuery, visitsOn } from '@/domain/search'
import { useAllOwners, useDirectoryStore } from '@/stores/directoryStore'

type Scope = 'today' | 'all'

/**
 * Today's Visits: the day's visits across all pets, derived from the owners the
 * app already has (the API cannot list visits by date). "All History" shows
 * every visit ever recorded. Any row opens that owner and pet in the Front Desk.
 */
export function VisitsPage() {
  const navigate = useNavigate()
  const status = useDirectoryStore((s) => s.status)
  const error = useDirectoryStore((s) => s.error)
  const load = useDirectoryStore((s) => s.load)
  const owners = useAllOwners()
  const [scope, setScope] = useState<Scope>('today')
  const [filter, setFilter] = useState('')

  const everything = useMemo(() => allVisits(owners), [owners])
  const today = todayIso()
  const todays = useMemo(() => visitsOn(everything, today), [everything, today])
  const rows = useMemo(
    () => (scope === 'today' ? todays : everything).filter((e) => matchesVisitQuery(e, filter)),
    [scope, todays, everything, filter],
  )
  const loading = status === 'idle' || (status === 'loading' && owners.length === 0)

  const scopes: { value: Scope; label: string }[] = [
    { value: 'today', label: `Today (${todays.length})` },
    { value: 'all', label: `All History (${everything.length})` },
  ]

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Today&rsquo;s Visits</h1>
          <p className="mt-1 text-sm text-slate-500">
            Select any visit row to jump directly to that owner and pet in the Front Desk workspace.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-64">
            <SearchIcon className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="search"
              aria-label="Filter visits"
              autoComplete="off"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter visits…"
              className={`${inputClass} pl-9`}
            />
          </div>
          <div role="group" aria-label="Which visits" className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
            {scopes.map((s) => (
              <button
                key={s.value}
                type="button"
                aria-pressed={scope === s.value}
                onClick={() => setScope(s.value)}
                className={`num h-8 whitespace-nowrap rounded-md px-3 text-[13px] font-medium ${
                  scope === s.value ? 'bg-white text-brand-700 ring-1 ring-slate-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && <WakingNote />}

      {status === 'error' && (
        <Alert action={<Button variant="secondary" size="sm" onClick={() => void load()}>Retry</Button>}>
          {error?.message ?? 'Could not load visits.'}
        </Alert>
      )}

      <Panel className="overflow-x-auto">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs font-semibold text-slate-500">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Pet</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Clinical note / reason</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 4 }, (_, i) => (
                <tr key={i} aria-hidden="true" className="border-t border-slate-200">
                  <td colSpan={6} className="px-4 py-3">
                    <Skeleton className="h-5 w-full" />
                  </td>
                </tr>
              ))}
            {rows.map(({ owner, pet, visit }) => (
              <tr
                key={visit.id}
                onClick={() => void navigate(paths.pet(owner.id, pet.id))}
                className="cursor-pointer border-t border-slate-200 hover:bg-slate-50"
              >
                <td className="num px-4 py-3 text-slate-600">{formatDate(visit.date)}</td>
                <td className="px-4 py-3">
                  <span className="font-semibold text-slate-900">{pet.name}</span>{' '}
                  <span className="text-xs text-slate-500">{titleCase(pet.type.name)}</span>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {owner.firstName} {owner.lastName}
                </td>
                <td className="num px-4 py-3 text-slate-600">{formatPhone(owner.telephone)}</td>
                <td className="px-4 py-3 text-slate-900">{visit.description}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    to={paths.pet(owner.id, pet.id)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Open ${pet.name}, ${owner.firstName} ${owner.lastName}`}
                    className="font-semibold text-brand-700 hover:underline"
                  >
                    Open <span aria-hidden="true">↗</span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && status !== 'error' && rows.length === 0 && (
          <div className="space-y-3 border-t border-slate-200 p-8 text-center">
            <p className="font-display font-semibold text-slate-800">
              {filter.trim()
                ? 'No visits match that filter.'
                : scope === 'today'
                  ? 'No visits registered today.'
                  : 'No visits recorded yet.'}
            </p>
            {!filter.trim() && (
              <p className="text-sm text-slate-500">Register a visit from the Front Desk and it will appear here.</p>
            )}
            <Link
              to={paths.home}
              className="inline-flex h-10 items-center rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800"
            >
              Go to Front Desk
            </Link>
          </div>
        )}
      </Panel>
    </div>
  )
}
