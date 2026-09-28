// Per-browser UI preferences (density, download variant). Never server state.
import { useState } from 'react'

function read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return allowed.includes(v as T) ? (v as T) : fallback
  } catch {
    return fallback
  }
}

export function usePref<T extends string>(key: string, allowed: readonly T[], fallback: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => read(key, allowed, fallback))
  return [
    value,
    (v: T) => {
      setValue(v)
      try {
        localStorage.setItem(key, v)
      } catch {
        /* private mode */
      }
    },
  ]
}

/** Start of the UTC day `days` ago: stable within a day, so it can live in query keys and URLs. */
export function sinceDays(days: number, now = Date.now()): string {
  const d = new Date(now - days * 86_400_000)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString().replace('.000Z', 'Z')
}

/** Readable fallback for enum keys the UI has no label for: "t_shirt" → "T shirt". */
export const humanize = (key: string) => (key ? key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ') : key)
