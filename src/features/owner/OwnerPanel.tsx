import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router'
import type { ApiError } from '@/api/client'
import type { Owner } from '@/api/types'
import { paths } from '@/app/routes'
import { CheckIcon, CopyIcon, PencilIcon, PlusIcon } from '@/components/icons'
import { Alert, Button, Panel } from '@/components/ui'
import { formatAge, formatDate } from '@/domain/dates'
import { formatPhone, lastVisit, plural, titleCase } from '@/domain/format'
import { PetForm } from '@/features/pet/PetForm'
import { useOwnersStore } from '@/stores/ownerStore'
import { useToastStore } from '@/stores/toastStore'
import { OwnerForm } from './OwnerForm'

interface Props {
  owner: Owner
  /** Set when the last refresh failed but we still have older data to show. */
  staleError: ApiError | null
  onRetry: () => void
  className?: string
}

/** One click copies the number to say or paste elsewhere; the icon confirms for two seconds. */
function CopyPhoneButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const toast = useToastStore((s) => s.push)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  return (
    <>
      <button
        type="button"
        aria-label="Copy telephone number"
        onClick={() => {
          navigator.clipboard.writeText(text).then(
            () => setCopied(true),
            () => toast('Could not copy the number'),
          )
        }}
        className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
      >
        {copied ? <CheckIcon className="h-4 w-4 text-emerald-700" /> : <CopyIcon />}
      </button>
      <span role="status" className="sr-only">
        {copied ? 'Telephone number copied' : ''}
      </span>
    </>
  )
}

/**
 * Middle pane: who the owner is (editable in place) and their pets (add in
 * place, pick one to open it on the right). One flat panel; sections are
 * separated by a hairline, not by nested cards.
 */
export function OwnerPanel({ owner, staleError, onRetry, className = '' }: Props) {
  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)
  const navigate = useNavigate()
  const update = useOwnersStore((s) => s.update)
  const addPet = useOwnersStore((s) => s.addPet)
  const toast = useToastStore((s) => s.push)

  return (
    <Panel aria-label="Owner" className={`overflow-hidden lg:overflow-y-auto ${className}`}>
      {staleError && (
        <div className="p-4 pb-0">
          <Alert tone="warning" action={<Button variant="secondary" size="sm" onClick={onRetry}>Retry</Button>}>
            Could not refresh this owner — showing the last data we have. {staleError.message}
          </Alert>
        </div>
      )}

      <div className="p-5">
        {editing ? (
          <OwnerForm
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
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <h2 className="font-display text-2xl font-bold text-slate-900">
                    {owner.firstName} {owner.lastName}
                  </h2>
                  <span className="num text-sm text-slate-400">#{owner.id}</span>
                </div>
                <p className="mt-1 text-slate-600">
                  {owner.address} · {owner.city}
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                <PencilIcon />
                Edit Owner
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
              <a className="num text-slate-900 hover:underline" href={`tel:${owner.telephone}`}>
                {formatPhone(owner.telephone)}
              </a>
              <CopyPhoneButton text={formatPhone(owner.telephone)} />
              <span className="text-slate-500">· {plural(owner.pets.length, 'registered pet')}</span>
            </div>
          </>
        )}
      </div>

      <div className="border-t border-slate-200">
        <div className="flex items-center justify-between gap-2 p-5 pb-3">
          <h3 className="font-display text-lg font-semibold text-slate-900">
            Pets <span className="num ml-1 text-sm font-normal text-slate-500">{owner.pets.length}</span>
          </h3>
          <Button variant="ghost" size="sm" className="bg-brand-50" disabled={adding} onClick={() => setAdding(true)}>
            <PlusIcon />
            Add Pet
          </Button>
        </div>

        {adding && (
          <div className="mx-5 mb-3 rounded-lg bg-slate-50 p-4">
            <h4 className="mb-3 font-display text-sm font-semibold text-slate-800">New pet for {owner.firstName}</h4>
            <PetForm
              mode="create"
              onCancel={() => setAdding(false)}
              onSubmit={async (fields) => {
                const pet = await addPet(owner.id, fields)
                toast(`${pet.name} added`)
                setAdding(false)
                void navigate(paths.pet(owner.id, pet.id))
              }}
            />
          </div>
        )}

        {owner.pets.length === 0 ? (
          !adding && (
            <div className="space-y-3 px-5 pb-6 pt-2 text-center">
              <p className="text-sm text-slate-500">No pets registered yet.</p>
              <Button onClick={() => setAdding(true)}>Register First Pet</Button>
            </div>
          )
        ) : (
          <ul aria-label="Pets">
            {owner.pets.map((pet) => {
              const last = lastVisit(pet)
              return (
                <li key={pet.id}>
                  <NavLink
                    to={paths.pet(owner.id, pet.id)}
                    className={({ isActive }) =>
                      `block border-y px-5 py-3 ${
                        isActive ? 'border-brand-600 bg-brand-50/70' : 'border-transparent border-b-slate-200 hover:bg-slate-50'
                      }`
                    }
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span>
                        <span className="font-semibold text-slate-900">{pet.name}</span>{' '}
                        <span className="text-sm text-slate-500">{titleCase(pet.type.name)}</span>
                      </span>
                      <span className="num text-xs text-slate-500">{plural(pet.visits.length, 'visit')}</span>
                    </span>
                    <span className="block text-[13px] text-slate-500">
                      Born <span className="num">{formatDate(pet.birthDate)}</span> · {formatAge(pet.birthDate)} ·{' '}
                      {last ? (
                        <>
                          Last visit <span className="num">{formatDate(last.date)}</span>
                        </>
                      ) : (
                        'No visits yet'
                      )}
                    </span>
                  </NavLink>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Panel>
  )
}
