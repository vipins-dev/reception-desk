import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { ApiError } from '@/api/client'

/**
 * Show a failed submit to the user. Errors the server attributed to a known
 * form field are placed on that field; anything left over becomes a
 * form-level message (returned, or `null` when every error found a field).
 *
 * `fieldMap` translates API property names to form field names where they
 * differ (e.g. the API's `type` becomes the form's `typeId`).
 */
export function applyApiError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fieldMap: Readonly<Record<string, Path<T>>>,
): string | null {
  if (!(error instanceof ApiError)) return 'Something went wrong. Please try again.'
  const entries = Object.entries(error.fieldErrors)
  let placed = 0
  for (const [apiField, message] of entries) {
    const formField = fieldMap[apiField]
    if (formField) {
      setError(formField, { type: 'server', message })
      placed += 1
    }
  }
  return entries.length > 0 && placed === entries.length ? null : error.message
}
