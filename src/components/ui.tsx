import { useId, type ComponentProps, type ReactNode } from 'react'

/** Small, dependency-free primitives. Styling lives here so features stay readable. */

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

const buttonStyles: Record<ButtonVariant, string> = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 disabled:bg-brand-700/50',
  secondary: 'bg-white text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50 disabled:text-slate-400',
  ghost: 'text-brand-700 hover:bg-brand-50 disabled:text-slate-400',
}

export function Button({
  variant = 'primary',
  loading = false,
  className = '',
  children,
  disabled,
  ...props
}: ComponentProps<'button'> & { variant?: ButtonVariant; loading?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed ${buttonStyles[variant]} ${className}`}
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

const inputClass =
  'block w-full rounded-md border-0 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-brand-600 aria-[invalid=true]:ring-red-500'

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
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error ? (
        <p id={describedBy} className="mt-1 text-xs text-red-700">
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
    tone === 'error' ? 'bg-red-50 text-red-800 ring-red-200' : 'bg-amber-50 text-amber-900 ring-amber-200'
  return (
    <div role="alert" className={`flex items-start justify-between gap-3 rounded-md p-3 text-sm ring-1 ${palette}`}>
      <div>{children}</div>
      {action}
    </div>
  )
}

export function Card({
  title,
  actions,
  children,
  className = '',
}: {
  title?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200 ${className}`}>
      {(title || actions) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {actions}
        </header>
      )}
      {children}
    </section>
  )
}

export function LoadingBlock({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center gap-2 p-6 text-sm text-slate-500">
      <Spinner />
      <span>{label}</span>
    </div>
  )
}
