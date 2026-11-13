import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import type { VisitFields } from '@/api/types'
import { CalendarPlusIcon, CheckIcon } from '@/components/icons'
import { Alert, Button, TextField } from '@/components/ui'
import { applyApiError } from '@/components/serverErrors'
import { todayIso } from '@/domain/dates'
import { toVisitFields, visitFormSchema, type VisitFormValues } from '@/domain/validation'

const SERVER_FIELDS = { date: 'date', description: 'description' } as const

/** The most common reasons, one click away; they fill the note so it can still be edited. */
export const VISIT_TEMPLATES = [
  'Annual wellness exam',
  'Vaccination booster',
  'Follow-up recheck',
  'Dental check & cleaning',
  'Urgent triage consult',
] as const

const CONFIRMATION_MS = 4000

/**
 * Always visible on the pet pane: registering a visit is the most common
 * action at the desk, so it is one field and one button away.
 */
export function VisitForm({ onSubmit }: { onSubmit: (fields: VisitFields) => Promise<void> }) {
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    setValue,
    getValues,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<VisitFormValues>({
    resolver: standardSchemaResolver(visitFormSchema),
    defaultValues: { date: todayIso(), description: '' },
  })

  useEffect(() => {
    if (!confirmed) return
    const timer = setTimeout(() => setConfirmed(false), CONFIRMATION_MS)
    return () => clearTimeout(timer)
  }, [confirmed])

  const submit = handleSubmit(async (values) => {
    setFormError(null)
    setConfirmed(false)
    try {
      await onSubmit(toVisitFields(values))
      resetField('description') // keeps the date: visits are often entered in a batch
      setFocus('description')
      setConfirmed(true)
    } catch (e) {
      setFormError(applyApiError(e, setError, SERVER_FIELDS))
    }
  })

  const applyTemplate = (text: string) => {
    const current = getValues('description').trim()
    setValue('description', current ? `${current}; ${text}` : text, { shouldDirty: true, shouldValidate: true })
    setFocus('description')
  }

  return (
    <form onSubmit={submit} noValidate aria-label="Register visit" className="space-y-3">
      {formError && <Alert>{formError}</Alert>}
      <div className="grid gap-3 sm:grid-cols-[11rem_1fr]">
        <TextField label="Visit date" type="date" error={errors.date?.message} {...register('date')} />
        <TextField
          label="Reason / clinical note"
          autoComplete="off"
          placeholder="Reason for visit or symptoms…"
          error={errors.description?.message}
          {...register('description')}
        />
      </div>
      <div role="group" aria-label="Quick-fill notes" className="flex flex-wrap gap-2">
        {VISIT_TEMPLATES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => applyTemplate(t)}
            className="h-8 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 hover:border-slate-300 hover:bg-slate-50"
          >
            + {t}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-end gap-3 pt-1">
        <span role="status" className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
          {confirmed && (
            <>
              <CheckIcon className="h-4 w-4" />
              Visit registered
            </>
          )}
        </span>
        <Button type="submit" loading={isSubmitting}>
          <CalendarPlusIcon />
          Register Visit
        </Button>
      </div>
    </form>
  )
}
