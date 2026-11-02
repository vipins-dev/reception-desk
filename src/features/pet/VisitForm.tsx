import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import type { VisitFields } from '@/api/types'
import { Alert, Button, TextField } from '@/components/ui'
import { applyApiError } from '@/components/serverErrors'
import { todayIso } from '@/domain/dates'
import { toVisitFields, visitFormSchema, type VisitFormValues } from '@/domain/validation'

const SERVER_FIELDS = { date: 'date', description: 'description' } as const

/**
 * Always visible on the pet screen: registering a visit is the most common
 * action at the desk, so it is one field and one button away.
 */
export function VisitForm({ onSubmit }: { onSubmit: (fields: VisitFields) => Promise<void> }) {
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<VisitFormValues>({
    resolver: standardSchemaResolver(visitFormSchema),
    defaultValues: { date: todayIso(), description: '' },
  })

  const submit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await onSubmit(toVisitFields(values))
      resetField('description') // keeps the date: visits are often entered in a batch
      setFocus('description')
    } catch (e) {
      setFormError(applyApiError(e, setError, SERVER_FIELDS))
    }
  })

  return (
    <form onSubmit={submit} noValidate aria-label="Register visit" className="space-y-3">
      {formError && <Alert>{formError}</Alert>}
      <div className="grid grid-cols-[10rem_1fr] gap-3">
        <TextField label="Visit date" type="date" error={errors.date?.message} {...register('date')} />
        <TextField
          label="Reason / notes"
          autoComplete="off"
          placeholder="e.g. rabies shot"
          error={errors.description?.message}
          {...register('description')}
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting}>
          Register visit
        </Button>
      </div>
    </form>
  )
}
