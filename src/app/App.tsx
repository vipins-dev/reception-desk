import { lazy } from 'react'
import { Route, Routes } from 'react-router'
import { OwnerWorkspace } from '@/features/owner/OwnerWorkspace'
import { Alert } from '@/components/ui'
import { DeskLayout, EmptyDesk, PickAPet } from './DeskLayout'

// Code-split by route. The shell, search and owner view are the hot path and
// load eagerly; the form-heavy screens (react-hook-form + their pet/visit UI)
// are fetched the first time they are opened. <Suspense> boundaries live in
// DeskLayout and OwnerWorkspace so the search pane never blinks.
const NewOwnerPane = lazy(() => import('@/features/owner/NewOwnerPane').then((m) => ({ default: m.NewOwnerPane })))
const NewPetPane = lazy(() => import('@/features/pet/NewPetPane').then((m) => ({ default: m.NewPetPane })))
const PetPane = lazy(() => import('@/features/pet/PetPane').then((m) => ({ default: m.PetPane })))

/**
 *   /                              empty desk
 *   /owners/new                    create owner
 *   /owners/:ownerId               owner + pets, pick a pet
 *   /owners/:ownerId/pets/new      add pet to this owner
 *   /owners/:ownerId/pets/:petId   pet, register visit, history
 *
 * All routes render inside DeskLayout, so the search pane never goes away.
 * Router-agnostic: main.tsx supplies BrowserRouter, tests supply MemoryRouter.
 */
export function App() {
  return (
    <Routes>
      <Route element={<DeskLayout />}>
        <Route index element={<EmptyDesk />} />
        <Route path="owners/new" element={<NewOwnerPane />} />
        <Route path="owners/:ownerId" element={<OwnerWorkspace />}>
          <Route index element={<PickAPet />} />
          <Route path="pets/new" element={<NewPetPane />} />
          <Route path="pets/:petId" element={<PetPane />} />
        </Route>
        <Route
          path="*"
          element={
            <div className="p-6">
              <Alert>Page not found.</Alert>
            </div>
          }
        />
      </Route>
    </Routes>
  )
}
