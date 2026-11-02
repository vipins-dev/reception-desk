import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import type { OwnerFields } from '@/api/types'
import { Alert, Button, TextField } from '@/components/ui'
import { applyApiError } from '@/components/serverErrors'
import { ownerFormSchema, toOwnerFields, type OwnerFormValues } from '@/domain/validation'

const EMPTY: OwnerFormValues = { firstName: '', lastName: '', address: '', city: '', telephone: '' }

const SERVER_FIELDS = {
  firstName: 'firstName',
  lastName: 'lastName',
  address: 'address',
  city: 'city',
  telephone: 'telephone',
} as const

interface Props {
  mode: 'create' | 'edit'
  initial?: Partial<OwnerFormValues>
  onSubmit: (fields: OwnerFields) => Promise<void>
  onCancel: () => void
}

export function OwnerForm({ mode, initial, onSubmit, onCancel }: Props) {
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<OwnerFormValues>({
    resolver: standardSchemaResolver(ownerFormSchema),
    defaultValues: { ...EMPTY, ...initial },
  })

  const submit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await onSubmit(toOwnerFields(values))
    } catch (e) {
      setFormError(applyApiError(e, setError, SERVER_FIELDS))
    }
  })

  return (
    <form onSubmit={submit} noValidate aria-label={mode === 'create' ? 'New owner' : 'Edit owner'} className="space-y-3">
      {formError && <Alert>{formError}</Alert>}
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="First name"
          autoComplete="off"
          autoFocus={mode === 'create' && !initial?.lastName}
          error={errors.firstName?.message}
          {...register('firstName')}
        />
        <TextField
          label="Last name"
          autoComplete="off"
          autoFocus={mode === 'create' && !!initial?.lastName}
          error={errors.lastName?.message}
          {...register('lastName')}
        />
      </div>
      <TextField label="Address" autoComplete="off" error={errors.address?.message} {...register('address')} />
      <TextField label="City" autoComplete="off" error={errors.city?.message} {...register('city')} />
      <TextField
        label="Phone"
        type="tel"
        autoComplete="off"
        hint="10 digits. Spaces, dashes and brackets are removed."
        error={errors.telephone?.message}
        {...register('telephone')}
      />
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {mode === 'create' ? 'Create owner' : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}
