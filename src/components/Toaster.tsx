import { useEffect } from 'react'
import { useToastStore, type Toast } from '@/stores/toastStore'
import { CheckIcon } from './icons'

const TOAST_MS = 4000

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss)
  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast.id, dismiss])
  return (
    <div className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg">
      <CheckIcon className="h-4 w-4 shrink-0 text-emerald-400" />
      {toast.message}
    </div>
  )
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  )
}
