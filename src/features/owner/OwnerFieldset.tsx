import type { UseFormRegisterReturn } from 'react-hook-form'
import { TextField } from '@/components/ui'
import type { OwnerFormValues } from '@/domain/validation'

export type OwnerKey = keyof OwnerFormValues

interface Props {
  /** `register` of whichever form hosts these fields (edit form or New Owner drawer). */
  field: (name: OwnerKey) => UseFormRegisterReturn
  error: (name: OwnerKey) => string | undefined
  autoFocusField?: OwnerKey
}

/** The five owner fields, shared by the inline edit form and the New Owner drawer. */
export function OwnerFieldset({ field, error, autoFocusField }: Props) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="First name"
          autoComplete="off"
          placeholder="Sarah"
          autoFocus={autoFocusField === 'firstName'}
          error={error('firstName')}
          {...field('firstName')}
        />
        <TextField
          label="Last name"
          autoComplete="off"
          placeholder="Keller"
          autoFocus={autoFocusField === 'lastName'}
          error={error('lastName')}
          {...field('lastName')}
        />
      </div>
      <TextField
        label="Street address"
        autoComplete="off"
        placeholder="412 Oakridge Way"
        autoFocus={autoFocusField === 'address'}
        error={error('address')}
        {...field('address')}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="City" autoComplete="off" error={error('city')} {...field('city')} />
        <TextField
          label="Telephone (10 digits)"
          type="tel"
          autoComplete="off"
          placeholder="6085550194"
          error={error('telephone')}
          {...field('telephone')}
        />
      </div>
    </>
  )
}
