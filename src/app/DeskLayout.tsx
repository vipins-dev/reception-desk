import { Suspense } from 'react'
import { Link, Outlet } from 'react-router'
import { SearchPane } from '@/features/search/SearchPane'
import { Toaster } from '@/components/Toaster'
import { LoadingBlock } from '@/components/ui'
import { paths } from './routes'

/**
 * The persistent frame of the application: search is always on the left, and
 * the right-hand side shows whatever the receptionist is working on. Nothing
 * here unmounts when the customer changes, so search text and results survive.
 */
export function DeskLayout() {
  return (
    <div className="flex min-h-full flex-col lg:h-screen">
      <header className="flex items-center gap-3 bg-brand-700 px-4 py-2.5 text-white">
        <Link to={paths.home} className="text-base font-semibold tracking-tight">
          🐾 Reception Desk
        </Link>
        <span className="text-xs text-brand-100">PetClinic</span>
      </header>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[21rem_minmax(0,1fr)]">
        <aside aria-label="Owner search" className="border-b border-slate-200 bg-slate-50 lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <SearchPane />
        </aside>
        <main className="min-w-0 lg:overflow-y-auto">
          <Suspense fallback={<LoadingBlock label="Loading…" />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <Toaster />
    </div>
  )
}

export function EmptyDesk() {
  return (
    <div className="grid h-full place-items-center p-10 text-center text-slate-500">
      <div>
        <p className="text-lg font-medium text-slate-700">Who is at the desk?</p>
        <p className="mt-1 text-sm">Search for an owner on the left, or register a new customer.</p>
      </div>
    </div>
  )
}

export function PickAPet() {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
      Select a pet to see its history and register a visit.
    </div>
  )
}
