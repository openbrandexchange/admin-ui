// Locale-aware formatting with Intl, following the UI language.

export function formatDate(iso: string | null | undefined, lang: string, withTime = false): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(lang, withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(d)
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
]

/** "3 days ago", "in 2 hours" … */
export function formatRelative(iso: string | null | undefined, lang: string, now = Date.now()): string {
  if (!iso) return ''
  const diff = (new Date(iso).getTime() - now) / 1000
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
  for (const [unit, secs] of UNITS) if (Math.abs(diff) >= secs) return rtf.format(Math.round(diff / secs), unit)
  return rtf.format(0, 'minute')
}

export function formatNumber(n: number | null | undefined, lang: string): string {
  return n == null ? '' : new Intl.NumberFormat(lang).format(n)
}

export function formatBytes(bytes: number | null | undefined, lang: string): string {
  if (bytes == null) return ''
  const units = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const
  let v = bytes
  let i = 0
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000
    i++
  }
  return new Intl.NumberFormat(lang, { style: 'unit', unit: units[i], unitDisplay: 'short', maximumFractionDigits: i ? 1 : 0 }).format(v)
}

/** Country name in the UI language ("NL" → "Nederland"). */
export function countryName(code: string | null | undefined, lang: string): string {
  if (!code) return ''
  try {
    return new Intl.DisplayNames([lang], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

/** Language name in the UI language ("de" → "Duits"). */
export function languageName(code: string, lang: string): string {
  try {
    return new Intl.DisplayNames([lang], { type: 'language' }).of(code) ?? code
  } catch {
    return code
  }
}

export const isoDaysAgo = (days: number, now = Date.now()) => new Date(now - days * 24 * 3600 * 1000).toISOString()
