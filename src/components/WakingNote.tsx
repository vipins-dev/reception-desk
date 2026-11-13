import { useEffect, useState } from 'react'

/** After this long without an answer, say what is probably going on. */
export const WAKING_NOTE_AFTER_MS = 4_000

/**
 * Shown while the first load is still waiting. A free-tier backend that has been
 * idle can take up to a minute to wake, and silent placeholders for that long
 * look broken. Mount it only while loading; it appears after a few seconds.
 */
export function WakingNote() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), WAKING_NOTE_AFTER_MS)
    return () => clearTimeout(timer)
  }, [])
  if (!visible) return null
  return (
    <p role="status" className="rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-800">
      Waking up the server… If it has been idle this can take up to a minute.
    </p>
  )
}
