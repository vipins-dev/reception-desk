import { create } from 'zustand'

export interface Toast {
  id: number
  message: string
}

interface ToastState {
  toasts: Toast[]
  push: (message: string) => void
  dismiss: (id: number) => void
}

let nextId = 1

/** Confirmation messages ("Visit registered") that should not block the workflow. */
export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  push: (message) => set((s) => ({ toasts: [...s.toasts, { id: nextId++, message }] })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
