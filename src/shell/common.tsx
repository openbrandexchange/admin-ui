import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { LANGUAGES, isLang } from '../i18n/languages'
import { setLanguage } from '../i18n'
import { sessionQuery, useUpdateMe } from '../queries/session'
import { IconGlobe } from '../ui/icons'
import { cx } from '../ui/controls'

/** Language picker: every UI language in its own name. Remembered in the browser and, when logged in, on the account. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { t, i18n } = useTranslation()
  const session = useQuery(sessionQuery)
  const updateMe = useUpdateMe()
  return (
    <label className={cx('relative inline-flex items-center gap-1.5 text-sm text-stone-600', className)}>
      <IconGlobe size={16} />
      <span className="sr-only">{t('common.language')}</span>
      <select
        value={i18n.language}
        onChange={async (e) => {
          const lang = e.target.value
          if (!isLang(lang)) return
          await setLanguage(lang)
          if (session.data?.authenticated) updateMe.mutate({ language: lang })
        }}
        className="appearance-none bg-transparent pr-1 font-medium text-stone-700 hover:text-stone-900 cursor-pointer"
        data-testid="language-switcher"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  )
}

/** The only place the project name appears to users: a small footer badge. */
export function WorksWithBadge() {
  const { t } = useTranslation()
  return (
    <a
      href="https://openbrandexchange.com"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] text-stone-500 hover:text-stone-700"
    >
      <svg width="12" height="12" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="currentColor" />
        <path d="M9 16h14M16 9v14" stroke="white" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {t('common.worksWith')}
    </a>
  )
}

export function BrandMark({ name, logo, size = 'md' }: { name: string; logo?: string | null; size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'h-14' : 'h-9'
  if (logo)
    return (
      <span className={cx('inline-flex items-center rounded-md bg-white px-1.5', box)}>
        <img src={logo} alt={name} className="max-h-full w-auto max-w-40 object-contain" />
      </span>
    )
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true" className={cx('grid aspect-square place-items-center rounded-lg bg-accent font-semibold text-accent-contrast', box, size === 'lg' ? 'text-xl' : 'text-sm')}>
        {name.trim().charAt(0).toUpperCase() || '·'}
      </span>
    </span>
  )
}

/** First focusable element on every page: jumps past the header and menu to the content. */
export function SkipLink() {
  const { t } = useTranslation()
  return (
    <a href="#main" onClick={(e) => (e.preventDefault(), document.getElementById('main')?.focus())} className="sr-only z-50 rounded-control bg-white px-4 py-2 text-sm font-medium text-stone-900 shadow-lg focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4">
      {t('common.skipToContent')}
    </a>
  )
}
