// Inline validation shared by forms. Returns a message key or null.
type MsgKey = string

export const PASSWORD_MIN = 10
export const PASSWORD_MAX = 72

export function passwordProblem(pw: string): MsgKey | null {
  if (pw.length < PASSWORD_MIN) return 'validate.passwordShort'
  if (pw.length > PASSWORD_MAX) return 'validate.passwordLong'
  return null
}

export function emailProblem(email: string): MsgKey | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? null : 'validate.email'
}

export function urlProblem(url: string, { httpsOnly = false } = {}): MsgKey | null {
  try {
    const u = new URL(url.trim())
    if (httpsOnly ? u.protocol !== 'https:' : !/^https?:$/.test(u.protocol)) return 'validate.url'
    return null
  } catch {
    return 'validate.url'
  }
}

/**
 * A website typed without its scheme ("www.kestrel.example") gets https:// in front, the way a
 * browser's address bar reads it. Anything that already has a scheme is left alone.
 */
export function withScheme(url: string): string {
  const v = url.trim()
  if (!v || /^[a-z][a-z0-9+.-]*:\/\//i.test(v)) return v
  return 'https://' + v.replace(/^\/+/, '')
}

export function hexProblem(hex: string): MsgKey | null {
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? null : 'validate.hex'
}

/** Brand external id convention: slug of the name. */
export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200)
}

/** Split pasted EAN/GTIN text on anything that is not a digit (same rule as the node). */
export function splitCodes(text: string): string[] {
  return text.split(/[^0-9]+/).filter(Boolean)
}

/** GS1 check digit (mod 10) for GTIN-8/12/13/14. */
export function gtinValid(code: string): boolean {
  if (!/^(\d{8}|\d{12,14})$/.test(code)) return false
  const digits = code.split('').map(Number)
  const check = digits.pop()!
  let sum = 0
  digits.reverse().forEach((d, i) => (sum += d * (i % 2 === 0 ? 3 : 1)))
  return (10 - (sum % 10)) % 10 === check
}

/**
 * The default external id of a variant (spec import-format.md §1.2.1):
 * `<style_number>-<color_code>-<size>[-<size_length>]`, empty size and size_length left out,
 * control characters and `/` replaced by `_`, nothing else changed (spaces stay). Never the GTIN.
 */
export function defaultVariantId(style: string, colour: string, size?: string | null, sizeLength?: string | null): string {
  // eslint-disable-next-line no-control-regex
  return [style, colour, size, sizeLength].map((x) => (x ?? '').trim()).filter((x, i) => i < 2 || x).join('-').replace(/[\u0000-\u001f\u007f/]/g, '_')
}

/**
 * A language tag in canonical case (LanguageTag in the spec: language, optional script,
 * optional region as two letters or three digits: nl, de-CH, zh-Hant, sr-Latn-RS, es-419),
 * or null when it is not of that form. `_` is read as `-`.
 */
export function canonicalLanguageTag(input: string): string | null {
  const parts = input.trim().replace(/_/g, '-').split('-')
  const [lang, ...rest] = parts
  if (!/^[a-z]{2,3}$/i.test(lang ?? '')) return null
  const out = [lang.toLowerCase()]
  let i = 0
  if (rest[i] && /^[a-z]{4}$/i.test(rest[i])) out.push(rest[i][0].toUpperCase() + rest[i++].slice(1).toLowerCase())
  if (rest[i] && /^([a-z]{2}|[0-9]{3})$/i.test(rest[i])) out.push(rest[i++].toUpperCase())
  if (i !== rest.length) return null
  const tag = out.join('-')
  return /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-([A-Z]{2}|[0-9]{3}))?$/.test(tag) ? tag : null
}
