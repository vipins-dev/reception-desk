import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import type { PetFields, PetType } from '@/api/types'
import { Alert, Button, LoadingBlock, SelectField, TextField } from '@/components/ui'
import { applyApiError } from '@/components/serverErrors'
import { todayIso, yearsAgoIso } from '@/domain/dates'
import { petFormSchema, toPetFields, type PetFormValues } from '@/domain/validation'
import { usePetTypeStore } from '@/stores/petTypeStore'

const EMPTY: PetFormValues = { name: '', birthDate: '', typeId: '' }

// The API calls the field `type`; the form edits it as `typeId`.
const SERVER_FIELDS = { name: 'name', birthDate: 'birthDate', type: 'typeId' } as const

interface Props {
  mode: 'create' | 'edit'
  initial?: Partial<PetFormValues>
  onSubmit: (fields: PetFields) => Promise<void>
  onCancel: () => void
}

/**
 * Pet types are reference data from the server. The form is only rendered
 * once they are loaded: an uncontrolled <select> applies its default value
 * when it mounts, so mounting it before its <option>s exist would silently
 * show "Select…" while editing a pet that already has a type.
 */
export function PetForm(props: Props) {
  const types = usePetTypeStore((s) => s.types)
  const status = usePetTypeStore((s) => s.status)
  const load = usePetTypeStore((s) => s.load)

  useEffect(() => {
    void load()
  }, [load])

  if (status === 'error') {
    return (
      <Alert
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void load()}>
              Retry
            </Button>
            <Button variant="secondary" onClick={props.onCancel}>
              Cancel
            </Button>
          </div>
        }
      >
        Could not load the list of pet types.
      </Alert>
    )
  }
  if (status !== 'ready') return <LoadingBlock label="Loading pet types…" />
  return <PetFormFields {...props} types={types} />
}

function PetFormFields({ mode, initial, onSubmit, onCancel, types }: Props & { types: readonly PetType[] }) {
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PetFormValues>({
    resolver: standardSchemaResolver(petFormSchema),
    defaultValues: { ...EMPTY, ...initial },
  })

  const submit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await onSubmit(toPetFields(values, types))
    } catch (e) {
      setFormError(applyApiError(e, setError, SERVER_FIELDS))
    }
  })

  return (
    <form onSubmit={submit} noValidate aria-label={mode === 'create' ? 'New pet' : 'Edit pet'} className="space-y-3">
      {formError && <Alert>{formError}</Alert>}
      <TextField
        label="Pet name"
        autoComplete="off"
        autoFocus={mode === 'create'}
        error={errors.name?.message}
        {...register('name')}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Birth date"
          type="date"
          min={yearsAgoIso(50)}
          max={todayIso()}
          error={errors.birthDate?.message}
          {...register('birthDate')}
        />
        <SelectField label="Type" error={errors.typeId?.message} {...register('typeId')}>
          <option value="">Select…</option>
          {types.map((t) => (
            <option key={t.id} value={String(t.id)}>
              {t.name}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {mode === 'create' ? 'Add pet' : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}
