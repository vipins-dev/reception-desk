import { Suspense } from 'react'
import { Outlet } from 'react-router'
import { LoadingBlock, Panel } from '@/components/ui'
import { LookupPane } from '@/features/lookup/LookupPane'

/**
 * The Front Desk: lookup on the left, and on the right whatever the receptionist
 * is working on (owner and pets, then the open pet). Nothing here unmounts when
 * the customer changes, so the search text and results survive. On a 1440px
 * screen the three panes are 3 / 4 / 5 of 12 columns; below `lg` they stack.
 */
export function FrontDesk() {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-4 p-4 lg:h-[calc(100vh-4rem)] lg:grid-cols-12">
      <LookupPane className="lg:col-span-3" />
      <div className="min-w-0 lg:col-span-9 lg:min-h-0">
        <Suspense fallback={<LoadingBlock label="Loading…" />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  )
}

export function EmptyDesk() {
  return (
    <Panel className="grid h-full min-h-64 place-items-center p-10 text-center">
      <div>
        <p className="font-display text-lg font-semibold text-slate-800">Who is at the desk?</p>
        <p className="mt-1 text-sm text-slate-500">
          Search for an owner on the left, or register a new customer.
        </p>
      </div>
    </Panel>
  )
}

export function PickAPet() {
  return (
    <Panel className="grid min-h-48 place-items-center p-8 text-center text-sm text-slate-500 lg:h-full">
      Select a pet to see its details and register a visit.
    </Panel>
  )
}
