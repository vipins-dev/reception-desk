import { useEffect, useId, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { useNavigate } from 'react-router'
import { paths } from '@/app/routes'
import { XIcon } from '@/components/icons'
import { applyApiError } from '@/components/serverErrors'
import { Alert, Button, LoadingBlock, SelectField, TextField } from '@/components/ui'
import { todayIso, yearsAgoIso } from '@/domain/dates'
import { titleCase } from '@/domain/format'
import { draftFromQuery } from '@/domain/search'
import {
  newOwnerFormSchema,
  toOwnerFields,
  toPetFields,
  type NewOwnerFormValues,
} from '@/domain/validation'
import { useOwnersStore } from '@/stores/ownerStore'
import { usePetTypeStore } from '@/stores/petTypeStore'
import { useSearchStore } from '@/stores/searchStore'
import { useToastStore } from '@/stores/toastStore'
import { OwnerFieldset, type OwnerKey } from './OwnerFieldset'

const OWNER_SERVER_FIELDS = {
  firstName: 'firstName',
  lastName: 'lastName',
  address: 'address',
  city: 'city',
  telephone: 'telephone',
} as const

const EMPTY: NewOwnerFormValues = {
  firstName: '',
  lastName: '',
  address: '',
  city: '',
  telephone: '',
  withPet: true,
  petName: '',
  petBirthDate: '',
  petTypeId: '',
}

/** Put the cursor on the first thing still missing after the search text was carried over. */
function firstEmptyField(v: NewOwnerFormValues): OwnerKey {
  return !v.firstName ? 'firstName' : !v.lastName ? 'lastName' : 'address'
}

/**
 * Slide-over for registering a walk-in: owner details and, optionally, their
 * first pet in one pass. It opens on top of the current screen (`?new=owner`),
 * prefilled from whatever was typed in the search box, and finishes by opening
 * the new record in the Front Desk.
 */
export function NewOwnerDrawer({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const titleId = useId()
  const create = useOwnersStore((s) => s.create)
  const addPet = useOwnersStore((s) => s.addPet)
  const toast = useToastStore((s) => s.push)
  const types = usePetTypeStore((s) => s.types)
  const typesStatus = usePetTypeStore((s) => s.status)
  const loadTypes = usePetTypeStore((s) => s.load)
  const [formError, setFormError] = useState<string | null>(null)
  // The search text is read once, when the drawer opens.
  const [defaults] = useState<NewOwnerFormValues>(() => ({
    ...EMPTY,
    ...draftFromQuery(useSearchStore.getState().query),
  }))

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<NewOwnerFormValues>({
    resolver: standardSchemaResolver(newOwnerFormSchema),
    defaultValues: defaults,
  })
  const withPet = useWatch({ control, name: 'withPet' })

  useEffect(() => {
    if (withPet) void loadTypes()
  }, [withPet, loadTypes])

  // Escape closes; focus goes back to what opened the drawer.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })
  useEffect(() => {
    const opener = document.activeElement
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [])

  const submit = handleSubmit(async (values) => {
    setFormError(null)
    let owner
    try {
      owner = await create(toOwnerFields(values))
    } catch (e) {
      setFormError(applyApiError(e, setError, OWNER_SERVER_FIELDS))
      return
    }
    if (!values.withPet) {
      toast(`Owner ${owner.firstName} ${owner.lastName} registered`)
      void navigate(paths.owner(owner.id))
      return
    }
    try {
      const pet = await addPet(
        owner.id,
        toPetFields({ name: values.petName, birthDate: values.petBirthDate, typeId: values.petTypeId }, types),
      )
      toast(`${owner.firstName} ${owner.lastName} and ${pet.name} registered`)
      void navigate(paths.pet(owner.id, pet.id))
    } catch {
      // The owner exists now; do not make the receptionist type them again.
      toast(`Owner registered, but ${values.petName} could not be added. Add the pet from the owner screen.`)
      void navigate(paths.owner(owner.id))
    }
  })

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="animate-drawer absolute inset-y-0 right-0 flex w-full max-w-lg flex-col border-l border-slate-200 bg-white"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div>
            <h2 id={titleId} className="font-display text-xl font-bold text-slate-900">
              Register New Owner
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">Create a client record and optionally register their first pet.</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={submit} noValidate aria-label="New owner" className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {formError && <Alert>{formError}</Alert>}
            <h3 className="font-display text-sm font-semibold text-slate-800">Owner details</h3>
            <OwnerFieldset
              field={(n) => register(n)}
              error={(n) => errors[n]?.message}
              autoFocusField={firstEmptyField(defaults)}
            />

            <div className="border-t border-slate-200 pt-4">
              <label className="flex cursor-pointer items-start justify-between gap-4">
                <span>
                  <span className="block text-sm font-semibold text-slate-900">Also register their pet now</span>
                  <span className="block text-xs text-slate-500">Uncheck if you only need to save the owner profile first.</span>
                </span>
                <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-brand-700" {...register('withPet')} />
              </label>
            </div>

            {withPet &&
              (typesStatus === 'error' ? (
                <Alert action={<Button variant="secondary" size="sm" onClick={() => void loadTypes()}>Retry</Button>}>
                  Could not load the list of species.
                </Alert>
              ) : typesStatus !== 'ready' ? (
                <LoadingBlock label="Loading species…" />
              ) : (
                <div className="space-y-3">
                  <TextField
                    label="Pet name"
                    autoComplete="off"
                    placeholder="Milo"
                    error={errors.petName?.message}
                    {...register('petName')}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <SelectField label="Species" error={errors.petTypeId?.message} {...register('petTypeId')}>
                      <option value="">Select…</option>
                      {types.map((t) => (
                        <option key={t.id} value={String(t.id)}>
                          {titleCase(t.name)}
                        </option>
                      ))}
                    </SelectField>
                    <TextField
                      label="Birth date"
                      type="date"
                      min={yearsAgoIso(50)}
                      max={todayIso()}
                      error={errors.petBirthDate?.message}
                      {...register('petBirthDate')}
                    />
                  </div>
                </div>
              ))}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 p-4">
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Create &amp; Open Record
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
