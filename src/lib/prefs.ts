// Per-browser UI preferences (density, download variant). Never server state.
import { useSyncExternalStore } from 'react'

function read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return allowed.includes(v as T) ? (v as T) : fallback
  } catch {
    return fallback
  }
}

// One value per key for the whole page: every component that reads a preference sees a change made
// anywhere else at once (the variant picked in a dialog is the variant the dialog downloads).
const memory = new Map<string, string>()
const listeners = new Map<string, Set<() => void>>()

function subscribe(key: string, fn: () => void) {
  let set = listeners.get(key)
  if (!set) listeners.set(key, (set = new Set()))
  set.add(fn)
  return () => void set.delete(fn)
}

export function usePref<T extends string>(key: string, allowed: readonly T[], fallback: T): [T, (v: T) => void] {
  const value = useSyncExternalStore(
    (fn) => subscribe(key, fn),
    () => {
      const v = memory.get(key)
      return v !== undefined && allowed.includes(v as T) ? (v as T) : read(key, allowed, fallback)
    },
  )
  return [
    value,
    (v: T) => {
      memory.set(key, v)
      try {
        localStorage.setItem(key, v)
      } catch {
        /* private mode: the choice still holds for this page */
      }
      for (const fn of listeners.get(key) ?? []) fn()
    },
  ]
}

/** Test helper: forget in-page preferences (localStorage is cleared separately). */
export function resetPrefs() {
  memory.clear()
}

/** Start of the UTC day `days` ago: stable within a day, so it can live in query keys and URLs. */
export function sinceDays(days: number, now = Date.now()): string {
  const d = new Date(now - days * 86_400_000)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString().replace('.000Z', 'Z')
}

/** Readable fallback for enum keys the UI has no label for: "t_shirt" → "T shirt". */
export const humanize = (key: string) => (key ? key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ') : key)
