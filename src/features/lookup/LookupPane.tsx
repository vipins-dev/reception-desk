import { memo, useEffect, useRef, type FormEvent } from 'react'
import { NavLink, useNavigate } from 'react-router'
import type { Owner } from '@/api/types'
import { paths, useNewOwnerDrawer } from '@/app/routes'
import { SearchIcon, UserPlusIcon, XIcon } from '@/components/icons'
import { Alert, Button, Panel, Skeleton } from '@/components/ui'
import { formatPhone, petSummary, plural } from '@/domain/format'
import { SPECIES_FILTERS } from '@/domain/search'
import { DIRECTORY_MAX_PAGES, DIRECTORY_PAGE_SIZE, useAllOwners, useDirectoryStore, useFilteredOwners } from '@/stores/directoryStore'
import { useSearchStore } from '@/stores/searchStore'

/**
 * Typing re-renders the list (the filter changes) but each owner object only
 * changes when it is re-read from the server. Memoising the row keeps the rows
 * that survive a keystroke from re-rendering with their pet list. This is the
 * one place where memoisation is measurably useful.
 */
const OwnerRow = memo(function OwnerRow({ owner: o }: { owner: Owner }) {
  return (
    <li>
      <NavLink
        to={paths.owner(o.id)}
        className={({ isActive }) =>
          `block border-b px-4 py-3 ${
            isActive ? 'border-brand-600 bg-brand-50/70' : 'border-slate-200 hover:bg-slate-50'
          }`
        }
      >
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate font-semibold text-slate-900">
            {o.firstName} {o.lastName}
          </span>
          <span className="num shrink-0 text-xs text-slate-500">{plural(o.pets.length, 'pet')}</span>
        </span>
        <span className="block text-[13px] text-slate-600">
          <span className="num">{formatPhone(o.telephone)}</span> · {o.city}
        </span>
        <span className="block truncate text-[13px] text-slate-500">{o.pets.length > 0 ? petSummary(o) : 'No pets yet'}</span>
      </NavLink>
    </li>
  )
})

function RowSkeletons() {
  return (
    <div role="status" aria-label="Loading owners" className="space-y-px">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="space-y-2 border-b border-slate-200 px-4 py-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  )
}

/**
 * Always on screen, so the receptionist can switch customer at any moment
 * without leaving the current context. Typing filters the whole directory by
 * name, phone, city or pet; Enter opens the first match; `/` focuses the box;
 * "no match" offers to create that owner right there.
 */
export function LookupPane({ className = '' }: { className?: string }) {
  const navigate = useNavigate()
  const drawer = useNewOwnerDrawer()
  const inputRef = useRef<HTMLInputElement>(null)

  const status = useDirectoryStore((s) => s.status)
  const error = useDirectoryStore((s) => s.error)
  const truncated = useDirectoryStore((s) => s.truncated)
  const load = useDirectoryStore((s) => s.load)
  const query = useSearchStore((s) => s.query)
  const species = useSearchStore((s) => s.species)
  const setQuery = useSearchStore((s) => s.setQuery)
  const setSpecies = useSearchStore((s) => s.setSpecies)

  const all = useAllOwners()
  const owners = useFilteredOwners()
  const typed = query.trim()
  const filtering = typed !== '' || species !== 'all'

  // `/` jumps to the search box, as long as the receptionist is not typing somewhere else.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable="true"]')) return
      e.preventDefault()
      inputRef.current?.focus()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const openFirst = (e: FormEvent) => {
    e.preventDefault()
    const first = owners[0]
    if (first) void navigate(paths.owner(first.id))
  }

  const loading = status === 'idle' || (status === 'loading' && all.length === 0)
  const noMatches = !loading && status !== 'error' && owners.length === 0

  return (
    <Panel aria-label="Client lookup" className={`flex flex-col overflow-hidden lg:min-h-0 ${className}`}>
      <div className="space-y-3 border-b border-slate-200 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-slate-900">Client Lookup</h2>
          <span aria-live="polite" className="num text-xs text-slate-500">
            {status === 'ready' || all.length > 0
              ? filtering
                ? `${owners.length} of ${plural(all.length, 'owner')}`
                : plural(all.length, 'owner')
              : ''}
          </span>
        </div>

        <form onSubmit={openFirst} role="search">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              ref={inputRef}
              type="search"
              aria-label="Search owners by name, phone, city, or pet name"
              autoFocus
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && query) setQuery('')
              }}
              placeholder="Name, phone, city, or pet…"
              className="block h-10 w-full rounded-lg border-0 bg-slate-50 pl-9 pr-9 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-brand-700 [&::-webkit-search-cancel-button]:hidden"
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setQuery('')
                  inputRef.current?.focus()
                }}
                className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <XIcon />
              </button>
            ) : (
              <kbd
                title="Press / to search"
                className="num pointer-events-none absolute right-3 top-2.5 rounded border border-slate-300 px-1.5 text-xs text-slate-400"
              >
                /
              </kbd>
            )}
          </div>
        </form>

        <div role="group" aria-label="Filter by species" className="grid grid-cols-4 gap-1 rounded-lg bg-slate-100 p-1">
          {SPECIES_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={species === f.value}
              onClick={() => setSpecies(f.value)}
              className={`h-8 rounded-md text-[13px] font-medium transition-colors ${
                species === f.value
                  ? 'bg-white text-brand-700 ring-1 ring-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stacked (below lg) the list is capped so the owner and pet panes stay within reach. */}
      <div className="max-h-96 min-h-0 flex-1 overflow-y-auto lg:max-h-none">
        {loading && <RowSkeletons />}

        {status === 'error' && (
          <div className="p-4">
            <Alert action={<Button variant="secondary" size="sm" onClick={() => void load()}>Retry</Button>}>
              {error?.message ?? 'Could not load owners.'}
            </Alert>
          </div>
        )}

        {noMatches && (
          <div className="space-y-3 p-6 text-center">
            <p className="font-display font-semibold text-slate-800">
              {all.length === 0
                ? 'No owners yet.'
                : typed
                  ? `No owner matches “${typed}”.`
                  : `No owners with ${species === 'other' ? 'other pets' : species}.`}
            </p>
            <p className="text-sm text-slate-500">
              {all.length === 0
                ? 'Register the first customer to get started.'
                : 'Check the spelling, or register a new customer.'}
            </p>
            <Button onClick={drawer.open}>{typed ? `Create “${typed}”` : 'Register New Client'}</Button>
          </div>
        )}

        {owners.length > 0 && (
          <ul aria-label="Owners">
            {owners.map((o) => (
              <OwnerRow key={o.id} owner={o} />
            ))}
          </ul>
        )}

        {truncated && (
          <p className="p-4 text-xs text-amber-800">
            Showing the first {DIRECTORY_MAX_PAGES * DIRECTORY_PAGE_SIZE} owners only. Search by last name to find others.
          </p>
        )}
      </div>

      <div className="border-t border-slate-200 p-3">
        <Button variant="secondary" onClick={drawer.open} className="w-full">
          <UserPlusIcon />
          Register New Client
        </Button>
      </div>
    </Panel>
  )
}
