import { lazy } from 'react'
import { Route, Routes } from 'react-router'
import { OwnerWorkspace } from '@/features/owner/OwnerWorkspace'
import { Alert } from '@/components/ui'
import { AppShell } from './AppShell'
import { EmptyDesk, FrontDesk, PickAPet } from './FrontDesk'

// Code-split by route. The shell, lookup and owner view are the hot path and
// load eagerly; the pet pane (visit + pet forms) and the two directory pages
// are fetched the first time they are opened. <Suspense> boundaries live in
// AppShell, FrontDesk and OwnerWorkspace so the lookup never blinks.
const PetPane = lazy(() => import('@/features/pet/PetPane').then((m) => ({ default: m.PetPane })))
const AllOwnersPage = lazy(() => import('@/features/directory/AllOwnersPage').then((m) => ({ default: m.AllOwnersPage })))
const VisitsPage = lazy(() => import('@/features/directory/VisitsPage').then((m) => ({ default: m.VisitsPage })))

/**
 *   /                              Front Desk, nothing selected
 *   /owners/:ownerId               Front Desk: owner + pets, pick a pet
 *   /owners/:ownerId/pets/:petId   Front Desk: pet, register visit, history
 *   /owners                        All Owners
 *   /visits                        Today's Visits
 *   ?new=owner (any page)          New Owner drawer
 *
 * Router-agnostic: main.tsx supplies BrowserRouter, tests supply MemoryRouter.
 */
export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route element={<FrontDesk />}>
          <Route index element={<EmptyDesk />} />
          <Route path="owners/:ownerId" element={<OwnerWorkspace />}>
            <Route index element={<PickAPet />} />
            <Route path="pets/:petId" element={<PetPane />} />
          </Route>
        </Route>
        <Route path="owners" element={<AllOwnersPage />} />
        <Route path="visits" element={<VisitsPage />} />
        <Route
          path="*"
          element={
            <div className="mx-auto max-w-[1440px] p-4">
              <Alert>Page not found.</Alert>
            </div>
          }
        />
      </Route>
    </Routes>
  )
}
