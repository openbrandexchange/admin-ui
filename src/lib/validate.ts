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
