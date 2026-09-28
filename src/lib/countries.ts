import type { Lang } from '../i18n/languages'
// Countries offered in address-like fields (names come from Intl.DisplayNames in the UI
// language). EU + EEA + neighbours where most retailers of European brands are.
export const COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO',
  'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'CH', 'GB', 'AD', 'MC', 'SM', 'AL', 'BA', 'ME', 'MK', 'RS', 'TR', 'UA', 'US', 'CA', 'AU', 'JP',
] as const

// The UI language most people in a country read, for smart defaults such as the language of
// an invitation to a shop there. Countries with several languages get the largest one; the
// admin can always pick another.
const COUNTRY_LANGUAGE: Record<string, Lang> = {
  AT: 'de', DE: 'de', LI: 'de', CH: 'de', BE: 'nl', NL: 'nl', FR: 'fr', LU: 'fr', MC: 'fr', IT: 'it', SM: 'it', ES: 'es', AD: 'es', PT: 'pt',
  PL: 'pl', CZ: 'cs', SK: 'sk', SI: 'sl', HR: 'hr', HU: 'hu', RO: 'ro', BG: 'bg', GR: 'el', CY: 'el', DK: 'da', SE: 'sv', NO: 'nb', FI: 'fi',
  EE: 'et', LV: 'lv', LT: 'lt', MT: 'mt', IE: 'en', GB: 'en', US: 'en', CA: 'en', AU: 'en',
}

export function countryLanguage(country: string | null | undefined, fallback: Lang): Lang {
  return (country && COUNTRY_LANGUAGE[country.toUpperCase()]) || fallback
}
