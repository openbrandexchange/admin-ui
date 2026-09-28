// The 25 UI languages (EU official languages that have a national market for brands, plus
// Norwegian Bokmål). English is the source; nl, de and fr get extra care (primary markets).

export const LANGUAGES = [
  { code: 'bg', name: 'Български', script: 'Cyrl' },
  { code: 'cs', name: 'Čeština', script: 'Latn' },
  { code: 'da', name: 'Dansk', script: 'Latn' },
  { code: 'de', name: 'Deutsch', script: 'Latn' },
  { code: 'el', name: 'Ελληνικά', script: 'Grek' },
  { code: 'en', name: 'English', script: 'Latn' },
  { code: 'es', name: 'Español', script: 'Latn' },
  { code: 'et', name: 'Eesti', script: 'Latn' },
  { code: 'fi', name: 'Suomi', script: 'Latn' },
  { code: 'fr', name: 'Français', script: 'Latn' },
  { code: 'ga', name: 'Gaeilge', script: 'Latn' },
  { code: 'hr', name: 'Hrvatski', script: 'Latn' },
  { code: 'hu', name: 'Magyar', script: 'Latn' },
  { code: 'it', name: 'Italiano', script: 'Latn' },
  { code: 'lt', name: 'Lietuvių', script: 'Latn' },
  { code: 'lv', name: 'Latviešu', script: 'Latn' },
  { code: 'mt', name: 'Malti', script: 'Latn' },
  { code: 'nb', name: 'Norsk bokmål', script: 'Latn' },
  { code: 'nl', name: 'Nederlands', script: 'Latn' },
  { code: 'pl', name: 'Polski', script: 'Latn' },
  { code: 'pt', name: 'Português', script: 'Latn' },
  { code: 'ro', name: 'Română', script: 'Latn' },
  { code: 'sk', name: 'Slovenčina', script: 'Latn' },
  { code: 'sl', name: 'Slovenščina', script: 'Latn' },
  { code: 'sv', name: 'Svenska', script: 'Latn' },
] as const

export type Lang = (typeof LANGUAGES)[number]['code']

export const LANG_CODES: readonly Lang[] = LANGUAGES.map((l) => l.code)

export const SOURCE_LANG: Lang = 'en'

export function isLang(code: string | null | undefined): code is Lang {
  return !!code && (LANG_CODES as readonly string[]).includes(code)
}

/**
 * Best UI language for a list of preferences (Accept-Language / navigator.languages order).
 * "nl-BE" → nl, "no"/"nn" → nb (Norwegian readers read Bokmål), unknown → en.
 */
export function pickLanguage(preferences: readonly string[]): Lang {
  for (const raw of preferences) {
    const base = raw.trim().toLowerCase().split(/[-_]/)[0]
    const code = base === 'no' || base === 'nn' ? 'nb' : base
    if (isLang(code)) return code
  }
  return SOURCE_LANG
}

/**
 * CSV delimiter for exports. Excel in most European locales expects a semicolon (the comma is
 * the decimal separator there); English, Irish and Maltese Excel expect a comma.
 */
export function csvDelimiter(lang: string): 'comma' | 'semicolon' {
  return ['en', 'ga', 'mt'].includes(lang) ? 'comma' : 'semicolon'
}
