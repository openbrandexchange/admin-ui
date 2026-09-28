// Product text (LocalizedText) fallback, the same rule in every node and in this UI:
//   the user's language → English → the first available language.
// A regional tag counts for its base language ("de-CH" serves a German reader) when the
// exact tag is missing.
import type { LocalizedText } from '../api/types'

export function localized(text: LocalizedText | null | undefined, lang: string): string {
  if (!text) return ''
  const keys = Object.keys(text)
  if (!keys.length) return ''
  const base = lang.split('-')[0]
  const pick =
    (text[lang] !== undefined && lang) ||
    keys.find((k) => k.split('-')[0] === base) ||
    (text.en !== undefined && 'en') ||
    keys.find((k) => k.startsWith('en-')) ||
    keys[0]
  return text[pick] ?? ''
}

/** Remove empty values so a LocalizedText stays valid (minProperties 1) or becomes null. */
export function cleanLocalized(text: Record<string, string>): LocalizedText | null {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(text)) if (v.trim()) out[k] = v.trim()
  return Object.keys(out).length ? out : null
}
