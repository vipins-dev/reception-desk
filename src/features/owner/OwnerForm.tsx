import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import type { OwnerFields } from '@/api/types'
import { Alert, Button } from '@/components/ui'
import { applyApiError } from '@/components/serverErrors'
import { ownerFormSchema, toOwnerFields, type OwnerFormValues } from '@/domain/validation'
import { OwnerFieldset } from './OwnerFieldset'

const SERVER_FIELDS = {
  firstName: 'firstName',
  lastName: 'lastName',
  address: 'address',
  city: 'city',
  telephone: 'telephone',
} as const

interface Props {
  initial: OwnerFormValues
  onSubmit: (fields: OwnerFields) => Promise<void>
  onCancel: () => void
}

/** The inline "Edit Owner" form: it replaces the owner summary in place. */
export function OwnerForm({ initial, onSubmit, onCancel }: Props) {
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<OwnerFormValues>({
    resolver: standardSchemaResolver(ownerFormSchema),
    defaultValues: initial,
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
    <form onSubmit={submit} noValidate aria-label="Edit owner" className="space-y-3">
      {formError && <Alert>{formError}</Alert>}
      <OwnerFieldset field={(n) => register(n)} error={(n) => errors[n]?.message} autoFocusField="firstName" />
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          Save Changes
        </Button>
      </div>
    </form>
  )
}
