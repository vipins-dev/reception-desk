import { memo, useEffect, useRef, type FormEvent } from 'react'
import { NavLink, useNavigate } from 'react-router'
import type { Owner } from '@/api/types'
import { paths } from '@/app/routes'
import { Alert, Button, Spinner } from '@/components/ui'
import { normalizeLastNameQuery } from '@/domain/validation'
import { useSearchStore } from '@/stores/searchStore'

export const SEARCH_DEBOUNCE_MS = 250

/**
 * `SearchPane` re-renders on every keystroke (the input is controlled by the
 * store), but the `owners` objects only change when a response arrives. Memoising
 * the row means typing re-renders just the input, not every result row with its
 * pet list. This is the one place in the app where memoisation is measurably
 * useful; elsewhere renders are cheap and `memo` would only add noise.
 */
const OwnerRow = memo(function OwnerRow({ owner: o }: { owner: Owner }) {
  return (
    <li>
      <NavLink
        to={paths.owner(o.id)}
        className={({ isActive }) =>
          `block rounded-md px-3 py-2 text-sm ring-1 ring-inset ${
            isActive ? 'bg-brand-50 ring-brand-600' : 'bg-white ring-slate-200 hover:bg-slate-50'
          }`
        }
      >
        <span className="block font-medium">
          {o.lastName}, {o.firstName}
        </span>
        <span className="block text-xs text-slate-500">
          {o.telephone} · {o.city}
        </span>
        {o.pets.length > 0 && (
          <span className="block truncate text-xs text-slate-500">
            Pets: {o.pets.map((p) => p.name).join(', ')}
          </span>
        )}
      </NavLink>
    </li>
  )
})

/**
 * Always on screen, so the receptionist can switch customer at any moment
 * without leaving the current context. Typing searches (debounced); Enter
 * opens the first match; "no match" offers to create the owner right there.
 */
export function SearchPane() {
  const navigate = useNavigate()
  const query = useSearchStore((s) => s.query)
  const owners = useSearchStore((s) => s.owners)
  const result = useSearchStore((s) => s.result)
  const page = useSearchStore((s) => s.page)
  const totalPages = useSearchStore((s) => s.totalPages)
  const totalElements = useSearchStore((s) => s.totalElements)
  const resultsFor = useSearchStore((s) => s.resultsFor)
  const setQuery = useSearchStore((s) => s.setQuery)
  const run = useSearchStore((s) => s.run)

  // First search (browse all) fires immediately; later ones wait for a pause in typing.
  const isFirstRun = useRef(true)
  useEffect(() => {
    const delay = isFirstRun.current ? 0 : SEARCH_DEBOUNCE_MS
    isFirstRun.current = false
    const timer = setTimeout(() => void run(0), delay)
    return () => clearTimeout(timer)
  }, [query, run])

  const loading = result.status === 'loading'
  const showEmpty = result.status === 'ready' && owners.length === 0
  const typed = resultsFor?.trim() ?? ''

  const openFirst = (e: FormEvent) => {
    e.preventDefault()
    const first = owners[0]
    if (first && resultsFor === query && result.status === 'ready') void navigate(paths.owner(first.id))
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <form onSubmit={openFirst} role="search" className="space-y-1">
        <label htmlFor="owner-search" className="block text-sm font-medium text-slate-700">
          Find owner
        </label>
        <div className="relative">
          <input
            id="owner-search"
            type="search"
            autoFocus
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Last name, e.g. Davis"
            className="block w-full rounded-md border-0 bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-brand-600"
          />
          {loading && (
            <span className="absolute right-3 top-2.5 text-slate-400">
              <Spinner className="h-4 w-4" />
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500">Matches the start of the last name. Press Enter to open the first result.</p>
      </form>

      <Button variant="secondary" onClick={() => void navigate(paths.newOwner)}>
        + New owner
      </Button>

      <div aria-live="polite" className="text-xs text-slate-500">
        {result.status === 'ready' && !showEmpty && (
          <span>
            {totalElements} {totalElements === 1 ? 'owner' : 'owners'}
            {typed ? ` starting with “${typed}”` : ''}
          </span>
        )}
      </div>

      {result.status === 'error' && (
        <Alert action={<Button variant="secondary" onClick={() => void run(page)}>Retry</Button>}>
          {result.error.message}
        </Alert>
      )}

      {showEmpty && (
        <div className="rounded-md bg-white p-4 text-sm shadow-sm ring-1 ring-slate-200">
          <p className="font-medium">{typed ? `No owner found for “${typed}”.` : 'No owners yet.'}</p>
          <p className="mt-1 text-slate-500">Check the spelling, or register a new customer.</p>
          <Button className="mt-3" onClick={() => void navigate(paths.newOwner)}>
            {typed ? `Create owner “${normalizeLastNameQuery(typed)}”` : 'Create owner'}
          </Button>
        </div>
      )}

      {owners.length > 0 && (
        <ul aria-label="Owners" aria-busy={loading} className={`space-y-1 ${loading ? 'opacity-60' : ''}`}>
          {owners.map((o) => (
            <OwnerRow key={o.id} owner={o} />
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <nav aria-label="Search results pages" className="mt-auto flex items-center justify-between pt-2">
          <Button variant="secondary" disabled={page === 0 || loading} onClick={() => void run(page - 1)}>
            Previous
          </Button>
          <span className="text-xs text-slate-500">
            Page {page + 1} of {totalPages}
          </span>
          <Button variant="secondary" disabled={page + 1 >= totalPages || loading} onClick={() => void run(page + 1)}>
            Next
          </Button>
        </nav>
      )}
    </div>
  )
}
