import { Suspense, lazy, useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { PlusIcon, StethoscopeIcon } from '@/components/icons'
import { Toaster } from '@/components/Toaster'
import { Button, LoadingBlock } from '@/components/ui'
import { useDirectoryStore } from '@/stores/directoryStore'
import { paths, useNewOwnerDrawer } from './routes'

const NewOwnerDrawer = lazy(() => import('@/features/owner/NewOwnerDrawer').then((m) => ({ default: m.NewOwnerDrawer })))

/** Refresh the owner list when the tab comes back, but not more often than this. */
const REFRESH_AFTER_MS = 30_000

const TABS = [
  { label: 'Front Desk', to: paths.home },
  { label: "Today's Visits", to: paths.visits },
  { label: 'All Owners', to: paths.allOwners },
] as const

/** Front Desk covers `/` and everything under `/owners/…`, but not the `/owners` list itself. */
function isActiveTab(to: string, pathname: string): boolean {
  if (to === paths.home) return pathname === '/' || pathname.startsWith('/owners/')
  return pathname === to
}

/**
 * The frame around every screen: a 64px header (brand, three views, one
 * primary action), the New Owner drawer, and toasts. It also loads the owner
 * directory once, so every view works from the same list.
 */
export function AppShell() {
  const { pathname } = useLocation()
  const load = useDirectoryStore((s) => s.load)
  const drawer = useNewOwnerDrawer()

  useEffect(() => {
    void load()
  }, [load])

  // Another receptionist may have added someone while this tab was in the background.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - useDirectoryStore.getState().loadedAt > REFRESH_AFTER_MS) {
        void load({ silent: true })
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-3 px-4 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:gap-4">
          <Link
            to={paths.home}
            aria-label="PetClinic Desk home"
            className="flex shrink-0 items-center gap-2 justify-self-start whitespace-nowrap"
          >
            <StethoscopeIcon className="h-6 w-6 text-brand-700" />
            <span className="hidden font-display text-lg font-bold text-slate-900 sm:inline">PetClinic Desk</span>
          </Link>

          <nav aria-label="Views" className="flex h-16 min-w-0 items-stretch gap-4 overflow-x-auto sm:gap-6">
            {TABS.map((tab) => {
              const active = isActiveTab(tab.to, pathname)
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center whitespace-nowrap border-b-2 px-1 text-sm font-medium transition-colors ${
                    active
                      ? 'border-brand-700 text-brand-700'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </Link>
              )
            })}
          </nav>

          <Button onClick={drawer.open} aria-label="New Owner" className="justify-self-end">
            <PlusIcon />
            <span className="hidden sm:inline">New Owner</span>
          </Button>
        </div>
      </header>

      <main className="min-w-0 flex-1">
        <Suspense fallback={<LoadingBlock label="Loading…" />}>
          <Outlet />
        </Suspense>
      </main>

      {drawer.isOpen && (
        <Suspense fallback={null}>
          <NewOwnerDrawer onClose={drawer.close} />
        </Suspense>
      )}
      <Toaster />
    </div>
  )
}
