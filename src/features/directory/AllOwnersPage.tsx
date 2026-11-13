import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import type { Owner } from '@/api/types'
import { paths, useNewOwnerDrawer } from '@/app/routes'
import { SearchIcon } from '@/components/icons'
import { Alert, Button, Panel, Skeleton, inputClass } from '@/components/ui'
import { formatPhone, petSummary, plural } from '@/domain/format'
import { filterOwners } from '@/domain/search'
import { useAllOwners, useDirectoryStore } from '@/stores/directoryStore'
import { useSearchStore } from '@/stores/searchStore'

const visitCount = (o: Owner): number => o.pets.reduce((n, p) => n + p.visits.length, 0)

/** The whole client directory as a table. Any row opens that owner in the Front Desk. */
export function AllOwnersPage() {
  const navigate = useNavigate()
  const drawer = useNewOwnerDrawer()
  const status = useDirectoryStore((s) => s.status)
  const error = useDirectoryStore((s) => s.error)
  const load = useDirectoryStore((s) => s.load)
  const query = useSearchStore((s) => s.query)
  const setQuery = useSearchStore((s) => s.setQuery)

  const all = useAllOwners()
  const owners = useMemo(() => filterOwners(all, query, 'all'), [all, query])
  const typed = query.trim()
  const loading = status === 'idle' || (status === 'loading' && all.length === 0)

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">All Clinic Owners</h1>
          <p className="mt-1 text-sm text-slate-500">
            Complete client directory ({plural(all.length, 'registered owner')}). Click any row to open in Front Desk.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <SearchIcon className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="search"
            aria-label="Search directory"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search directory…"
            className={`${inputClass} pl-9`}
          />
        </div>
      </div>

      {status === 'error' && (
        <Alert action={<Button variant="secondary" size="sm" onClick={() => void load()}>Retry</Button>}>
          {error?.message ?? 'Could not load owners.'}
        </Alert>
      )}

      <Panel className="overflow-x-auto">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs font-semibold text-slate-500">
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Telephone</th>
              <th className="px-4 py-3">Address</th>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3">Registered pets</th>
              <th className="px-4 py-3 text-right">Visits</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 5 }, (_, i) => (
                <tr key={i} aria-hidden="true" className="border-t border-slate-200">
                  <td colSpan={7} className="px-4 py-3">
                    <Skeleton className="h-5 w-full" />
                  </td>
                </tr>
              ))}
            {owners.map((o) => (
              <tr
                key={o.id}
                onClick={() => void navigate(paths.owner(o.id))}
                className="cursor-pointer border-t border-slate-200 hover:bg-slate-50"
              >
                <td className="px-4 py-3 font-semibold text-slate-900">
                  <Link to={paths.owner(o.id)} onClick={(e) => e.stopPropagation()} className="hover:underline">
                    {o.firstName} {o.lastName}
                  </Link>
                </td>
                <td className="num px-4 py-3 text-slate-600">{formatPhone(o.telephone)}</td>
                <td className="px-4 py-3 text-slate-600">{o.address}</td>
                <td className="px-4 py-3 text-slate-600">{o.city}</td>
                <td className="px-4 py-3 text-slate-600">{o.pets.length > 0 ? petSummary(o) : 'No pets'}</td>
                <td className="num px-4 py-3 text-right text-slate-600">{visitCount(o)}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    to={paths.owner(o.id)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Open ${o.firstName} ${o.lastName}`}
                    className="font-semibold text-brand-700 hover:underline"
                  >
                    Open <span aria-hidden="true">↗</span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && status !== 'error' && owners.length === 0 && (
          <div className="space-y-3 border-t border-slate-200 p-8 text-center">
            <p className="font-display font-semibold text-slate-800">
              {all.length === 0 ? 'No owners yet.' : `No owner matches “${typed}”.`}
            </p>
            <Button onClick={drawer.open}>{typed ? `Create “${typed}”` : 'Register New Client'}</Button>
          </div>
        )}
      </Panel>
    </div>
  )
}
