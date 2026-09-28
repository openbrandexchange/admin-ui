// i18next setup. English ships in the main bundle (source + fallback); the other 24 languages
// are separate chunks loaded on demand. The choice is remembered per browser.
import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '../locales/en.json'
import { isLang, pickLanguage, SOURCE_LANG, type Lang } from './languages'

export const STORAGE_KEY = 'obx.lang'

const loaders = import.meta.glob<{ default: Record<string, unknown> }>(['../locales/*.json', '!../locales/en.json'])

function stored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/** Remembered choice, else the browser's languages, else English. */
export function detectLanguage(): Lang {
  const saved = stored()
  if (isLang(saved)) return saved
  const prefs = typeof navigator !== 'undefined' ? (navigator.languages?.length ? navigator.languages : [navigator.language]) : []
  return pickLanguage(prefs.filter(Boolean))
}

async function ensureLoaded(lang: Lang) {
  if (lang === SOURCE_LANG || i18next.hasResourceBundle(lang, 'translation')) return
  const load = loaders[`../locales/${lang}.json`]
  if (!load) return
  const mod = await load()
  i18next.addResourceBundle(lang, 'translation', mod.default, true, true)
}

let ready: Promise<unknown> | null = null

export function initI18n(lang: Lang = detectLanguage()) {
  ready ??= i18next
    .use(initReactI18next)
    .init({
      resources: { en: { translation: en } },
      lng: SOURCE_LANG,
      fallbackLng: SOURCE_LANG,
      interpolation: { escapeValue: false },
      returnNull: false,
      showSupportNotice: false,
    })
    .then(() => setLanguage(lang, { remember: false }))
  return ready
}

/** Switch the UI language; `remember` stores it (an explicit user choice). */
export async function setLanguage(lang: Lang, { remember = true } = {}) {
  await ensureLoaded(lang)
  await i18next.changeLanguage(lang)
  if (typeof document !== 'undefined') document.documentElement.lang = lang
  if (remember) {
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      /* private mode */
    }
  }
}

export function currentLanguage(): Lang {
  const l = i18next.resolvedLanguage ?? i18next.language
  return isLang(l) ? l : SOURCE_LANG
}

export { i18next }
