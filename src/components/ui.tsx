import { useId, type ComponentProps, type ReactNode } from 'react'

/** Small, dependency-free primitives. Styling lives here so features stay readable. */

type ButtonVariant = 'primary' | 'secondary' | 'ghost'
type ButtonSize = 'md' | 'sm'

const buttonStyles: Record<ButtonVariant, string> = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 disabled:bg-brand-700/50',
  secondary: 'bg-white text-slate-800 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:text-slate-400',
  ghost: 'text-brand-700 hover:bg-brand-50 disabled:text-slate-400',
}

// 40px touch targets; single-line labels that never shrink or wrap.
const buttonSizes: Record<ButtonSize, string> = {
  md: 'h-10 px-4 py-2',
  sm: 'h-9 px-3 py-1.5',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  children,
  disabled,
  ...props
}: ComponentProps<'button'> & { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors disabled:cursor-not-allowed ${buttonSizes[size]} ${buttonStyles[variant]} ${className}`}
      {...props}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  )
}

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

interface FieldChrome {
  label: string
  error?: string | undefined
  hint?: string | undefined
}

export const inputClass =
  'block h-10 w-full rounded-lg border-0 bg-white px-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-brand-700 aria-[invalid=true]:ring-red-500'

function Field({
  label,
  error,
  hint,
  htmlFor,
  describedBy,
  children,
}: FieldChrome & { htmlFor: string; describedBy: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-[13px] font-medium text-slate-600">
        {label}
      </label>
      {children}
      {error ? (
        <p id={describedBy} className="mt-1 text-xs text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={describedBy} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export function TextField({ label, error, hint, id, ...props }: ComponentProps<'input'> & FieldChrome) {
  const auto = useId()
  const fieldId = id ?? auto
  const describedBy = `${fieldId}-desc`
  return (
    <Field label={label} error={error} hint={hint} htmlFor={fieldId} describedBy={describedBy}>
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? describedBy : undefined}
        className={inputClass}
        {...props}
      />
    </Field>
  )
}

export function SelectField({
  label,
  error,
  hint,
  id,
  children,
  ...props
}: ComponentProps<'select'> & FieldChrome) {
  const auto = useId()
  const fieldId = id ?? auto
  const describedBy = `${fieldId}-desc`
  return (
    <Field label={label} error={error} hint={hint} htmlFor={fieldId} describedBy={describedBy}>
      <select
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? describedBy : undefined}
        className={inputClass}
        {...props}
      >
        {children}
      </select>
    </Field>
  )
}

export function Alert({
  tone = 'error',
  children,
  action,
}: {
  tone?: 'error' | 'warning'
  children: ReactNode
  action?: ReactNode
}) {
  const palette =
    tone === 'error' ? 'bg-red-50 text-red-700 ring-red-200' : 'bg-amber-50 text-amber-900 ring-amber-200'
  return (
    <div role="alert" className={`flex items-start justify-between gap-3 rounded-lg p-3 text-sm ring-1 ${palette}`}>
      <div>{children}</div>
      {action}
    </div>
  )
}

/**
 * One flat level of elevation: a bordered white panel. Sections inside a panel
 * are separated with hairline dividers, never with nested bordered cards.
 */
export function Panel({ className = '', children, ...props }: ComponentProps<'section'>) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white ${className}`} {...props}>
      {children}
    </section>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded bg-slate-200 ${className}`} />
}

export function LoadingBlock({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center gap-2 p-6 text-sm text-slate-500">
      <Spinner />
      <span>{label}</span>
    </div>
  )
}
