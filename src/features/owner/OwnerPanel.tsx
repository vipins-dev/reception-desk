import { useState } from 'react'
import { Link, NavLink } from 'react-router'
import type { ApiError } from '@/api/client'
import type { Owner } from '@/api/types'
import { paths } from '@/app/routes'
import { Alert, Button, Card } from '@/components/ui'
import { formatAge, formatDate } from '@/domain/dates'
import { lastVisit, ownerFullName } from '@/domain/format'
import { useOwnersStore } from '@/stores/ownerStore'
import { useToastStore } from '@/stores/toastStore'
import { OwnerForm } from './OwnerForm'

interface Props {
  owner: Owner
  /** Set when the last refresh failed but we still have older data to show. */
  staleError: ApiError | null
  onRetry: () => void
}

export function OwnerPanel({ owner, staleError, onRetry }: Props) {
  const [editing, setEditing] = useState(false)
  const update = useOwnersStore((s) => s.update)
  const toast = useToastStore((s) => s.push)

  return (
    <div className="space-y-4">
      {staleError && (
        <Alert tone="warning" action={<Button variant="secondary" onClick={onRetry}>Retry</Button>}>
          Could not refresh this owner — showing the last data we have. {staleError.message}
        </Alert>
      )}

      <Card
        title={ownerFullName(owner)}
        actions={
          !editing && (
            <Button variant="ghost" onClick={() => setEditing(true)}>
              Edit owner
            </Button>
          )
        }
      >
        {editing ? (
          <OwnerForm
            mode="edit"
            initial={{
              firstName: owner.firstName,
              lastName: owner.lastName,
              address: owner.address,
              city: owner.city,
              telephone: owner.telephone,
            }}
            onCancel={() => setEditing(false)}
            onSubmit={async (fields) => {
              await update(owner.id, fields)
              toast('Owner details saved')
              setEditing(false)
            }}
          />
        ) : (
          <dl className="grid grid-cols-[5.5rem_1fr] gap-y-1.5 text-sm">
            <dt className="text-slate-500">Phone</dt>
            <dd>
              <a className="text-brand-700 hover:underline" href={`tel:${owner.telephone}`}>
                {owner.telephone}
              </a>
            </dd>
            <dt className="text-slate-500">Address</dt>
            <dd>{owner.address}</dd>
            <dt className="text-slate-500">City</dt>
            <dd>{owner.city}</dd>
            <dt className="text-slate-500">Owner ID</dt>
            <dd>#{owner.id}</dd>
          </dl>
        )}
      </Card>

      <Card
        title={`Pets (${owner.pets.length})`}
        actions={
          <Link
            to={paths.newPet(owner.id)}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
          >
            + Add pet
          </Link>
        }
      >
        {owner.pets.length === 0 ? (
          <p className="text-sm text-slate-500">No pets registered yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {owner.pets.map((pet) => {
              const last = lastVisit(pet)
              return (
                <li key={pet.id}>
                  <NavLink
                    to={paths.pet(owner.id, pet.id)}
                    className={({ isActive }) =>
                      `block rounded-md px-3 py-2 text-sm ring-1 ring-inset ${
                        isActive ? 'bg-brand-50 ring-brand-600' : 'ring-slate-200 hover:bg-slate-50'
                      }`
                    }
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-medium">{pet.name}</span>
                      <span className="text-xs text-slate-500">{pet.type.name}</span>
                    </span>
                    <span className="block text-xs text-slate-500">
                      {formatAge(pet.birthDate)} · {last ? `last visit ${formatDate(last.date)}` : 'no visits yet'}
                    </span>
                  </NavLink>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
