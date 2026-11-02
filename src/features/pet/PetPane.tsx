import { useState } from 'react'
import { usePetIdParam } from '@/app/routes'
import { Alert, Button, Card } from '@/components/ui'
import { formatAge, formatDate } from '@/domain/dates'
import { sortVisitsNewestFirst } from '@/domain/format'
import { findPet, useOwnersStore } from '@/stores/ownerStore'
import { useToastStore } from '@/stores/toastStore'
import { useOwnerContext } from '../owner/OwnerWorkspace'
import { PetForm } from './PetForm'
import { VisitForm } from './VisitForm'

/** Route `/owners/:ownerId/pets/:petId`: pet details, register-visit form and history. */
export function PetPane() {
  const { owner } = useOwnerContext()
  const petId = usePetIdParam()
  const pet = findPet(owner, petId)
  const [editing, setEditing] = useState(false)
  const updatePet = useOwnersStore((s) => s.updatePet)
  const addVisit = useOwnersStore((s) => s.addVisit)
  const toast = useToastStore((s) => s.push)

  if (!pet) {
    return <Alert>This pet does not belong to {owner.firstName} {owner.lastName}.</Alert>
  }

  const visits = sortVisitsNewestFirst(pet.visits)

  return (
    // `key` resets the edit toggle and any form state when switching pets.
    <div key={pet.id} className="space-y-4">
      <Card
        title={pet.name}
        actions={
          !editing && (
            <Button variant="ghost" onClick={() => setEditing(true)}>
              Edit pet
            </Button>
          )
        }
      >
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
          <dl className="grid grid-cols-[5.5rem_1fr] gap-y-1.5 text-sm">
            <dt className="text-slate-500">Type</dt>
            <dd>{pet.type.name}</dd>
            <dt className="text-slate-500">Born</dt>
            <dd>
              {formatDate(pet.birthDate)} <span className="text-slate-500">({formatAge(pet.birthDate)})</span>
            </dd>
          </dl>
        )}
      </Card>

      <Card title="Register visit">
        <VisitForm
          onSubmit={async (fields) => {
            await addVisit(owner.id, pet.id, fields)
            toast(`Visit registered for ${pet.name}`)
          }}
        />
      </Card>

      <Card title={`Visit history (${visits.length})`}>
        {visits.length === 0 ? (
          <p className="text-sm text-slate-500">No previous visits.</p>
        ) : (
          <ol className="divide-y divide-slate-100">
            {visits.map((v) => (
              <li key={v.id} className="flex gap-4 py-2 text-sm">
                <time className="w-28 shrink-0 text-slate-500" dateTime={v.date ?? undefined}>
                  {formatDate(v.date)}
                </time>
                <span>{v.description}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  )
}
