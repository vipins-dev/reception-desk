import { useState } from 'react'
import { usePetIdParam } from '@/app/routes'
import { PencilIcon } from '@/components/icons'
import { Alert, Button, Panel } from '@/components/ui'
import { formatAge, formatDate, todayIso } from '@/domain/dates'
import { ownerFullName, plural, sortVisitsNewestFirst, titleCase } from '@/domain/format'
import { findPet, useOwnersStore } from '@/stores/ownerStore'
import { useToastStore } from '@/stores/toastStore'
import { useOwnerContext } from '../owner/OwnerWorkspace'
import { PetForm } from './PetForm'
import { VisitForm } from './VisitForm'

/**
 * Right pane, route `/owners/:ownerId/pets/:petId`: the pet (editable in
 * place), the always-ready visit form, and the visit history.
 */
export function PetPane() {
  const { owner } = useOwnerContext()
  const petId = usePetIdParam()
  const pet = findPet(owner, petId)
  const [editing, setEditing] = useState(false)
  const updatePet = useOwnersStore((s) => s.updatePet)
  const addVisit = useOwnersStore((s) => s.addVisit)
  const toast = useToastStore((s) => s.push)

  if (!pet) {
    return <Alert>This pet does not belong to {ownerFullName(owner)}.</Alert>
  }

  const visits = sortVisitsNewestFirst(pet.visits)
  const today = todayIso()

  return (
    // `key` resets the edit toggle and any form state when switching pets.
    <Panel key={pet.id} aria-label="Pet" className="overflow-hidden lg:h-full lg:overflow-y-auto">
      <div className="p-5">
        {editing ? (
          <PetForm
            mode="edit"
            initial={{ name: pet.name, birthDate: pet.birthDate ?? '', typeId: String(pet.type.id) }}
            onCancel={() => setEditing(false)}
            onSubmit={async (fields) => {
              await updatePet(owner.id, pet.id, fields)
              toast('Pet details saved')
              setEditing(false)
            }}
          />
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <h2 className="font-display text-xl font-bold text-slate-900">{pet.name}</h2>
                <span className="text-slate-500">{titleCase(pet.type.name)}</span>
              </div>
              <p className="mt-1 text-[13px] text-slate-500">
                Born <span className="num">{formatDate(pet.birthDate)}</span> · {formatAge(pet.birthDate)} · Owner:{' '}
                {ownerFullName(owner)}
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              <PencilIcon />
              Edit Pet
            </Button>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 p-5">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h3 className="font-display text-lg font-semibold text-slate-900">Register New Visit</h3>
          <span className="text-sm text-slate-500">For {pet.name}</span>
        </div>
        <VisitForm
          onSubmit={async (fields) => {
            await addVisit(owner.id, pet.id, fields)
          }}
        />
      </div>

      <div className="border-t border-slate-200 p-5">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h3 className="font-display text-lg font-semibold text-slate-900">Previous Visits</h3>
          <span className="num text-sm text-slate-500">{plural(visits.length, 'record')}</span>
        </div>
        {visits.length === 0 ? (
          <div className="rounded-lg bg-slate-50 p-6 text-center">
            <p className="font-display font-semibold text-slate-800">No visits recorded for {pet.name}</p>
            <p className="mt-1 text-sm text-slate-500">Use the form above to log {pet.name}&rsquo;s first clinic visit.</p>
          </div>
        ) : (
          <ol aria-label="Previous visits" className="divide-y divide-slate-200 border-y border-slate-200">
            {visits.map((v) => (
              <li key={v.id} className="flex gap-4 py-3 text-sm">
                <div className="w-28 shrink-0">
                  <time className="num text-slate-700" dateTime={v.date ?? undefined}>
                    {formatDate(v.date)}
                  </time>
                  {v.date === today && <span className="block text-xs font-medium text-brand-700">Today</span>}
                </div>
                <span className="text-slate-900">{v.description}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Panel>
  )
}
