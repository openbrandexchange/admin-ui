import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearch } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useBranding, useLogin, useSession } from '../../queries/session'
import { setLanguage } from '../../i18n'
import { isLang } from '../../i18n/languages'
import { localized } from '../../lib/localized'
import { portalText, usePortalTitle } from '../../lib/branding'
import type { PublicBranding } from '../../api/types'
import { PublicFrame } from '../../shell/PublicShell'
import { Button, TextField } from '../../ui/controls'
import { ErrorNote, Notice } from '../../ui/feedback'
import { PublicCard } from './PublicCard'
import { DemoSignIn } from './DemoSignIn'
import { demoOf } from '../../lib/demo'

export function LoginScreen() {
  const { t, i18n } = useTranslation()
  const search = useSearch({ from: '/public/login' })
  const navigate = useNavigate()
  const session = useSession()
  const branding = useBranding()
  const title = usePortalTitle(branding.data)
  const login = useLogin()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  if (session.data?.authenticated && !login.isPending) {
    return <Navigate to={search.redirect ?? (session.data.user?.role === 'admin' ? '/admin' : '/')} replace />
  }

  const { heading, intro } = loginTexts(branding.data, title.full, i18n.language, t)
  const demo = demoOf(branding.data)
  // A demo portal has no accounts with passwords: only the one-click sign-in.
  if (demo) return <DemoSignIn demo={demo} />

  return (
    <>
      <PublicCard title={heading} intro={intro}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            login.mutate(
              { email: email.trim(), password },
              {
                onSuccess: async (s) => {
                  // An explicit choice on this device wins; otherwise follow the account's language.
                  const lang = s.user?.language
                  if (isLang(lang) && !localStorage.getItem('obx.lang')) await setLanguage(lang, { remember: false })
                  void navigate({ to: search.redirect ?? (s.user?.role === 'admin' ? '/admin' : '/') })
                },
              },
            )
          }}
        >
          <TextField label={t('fields.email')} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          <TextField label={t('fields.password')} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <ErrorNote error={login.error} />
          <Button type="submit" variant="primary" className="w-full" loading={login.isPending}>
            {t('login.submit')}
          </Button>
          <p className="text-center text-sm">
            <Link to="/forgot-password" className="text-stone-600 underline underline-offset-2 hover:text-stone-900">
              {t('login.forgot')}
            </Link>
          </p>
        </form>
      </PublicCard>
      {branding.data?.access_requests_enabled && (
        <p className="text-center text-sm text-stone-600">
          {t('login.noAccount')}{' '}
          <Link to="/request-access" className="font-medium text-accent-strong underline underline-offset-2">
            {t('login.requestAccess')}
          </Link>
        </p>
      )}
      {import.meta.env.VITE_OBX_MOCK && (
        <Notice>
          <strong>Demo</strong> · admin@kestrel.example / kestrel-admin-2026 · buyer@shop.example / kestrel-shop-2026
        </Notice>
      )}
    </>
  )
}

/** The login page's title and text: the brand's own (Appearance), else the welcome text, else ours. */
function loginTexts(b: PublicBranding | undefined, portal: string, lang: string, t: (k: string, o?: Record<string, unknown>) => string) {
  const heading = portalText(b?.login?.title, lang, b?.default_language) || t('login.title', { portal })
  const intro = portalText(b?.login?.text, lang, b?.default_language) || localized(b?.welcome_text, lang) || t('login.intro')
  return { heading, intro }
}

/** The login page as retailers will see it, for the Appearance preview (the form does nothing). */
export function LoginPreview({ branding }: { branding: PublicBranding }) {
  const { t, i18n } = useTranslation()
  const title = usePortalTitle(branding)
  const { heading, intro } = loginTexts(branding, title.full, i18n.language, t)
  return (
    <PublicFrame branding={branding}>
      <PublicCard title={heading} intro={intro}>
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()} aria-label={t('appearance.preview.loginForm')}>
          <TextField label={t('fields.email')} type="email" autoComplete="off" readOnly value="" tabIndex={-1} />
          <TextField label={t('fields.password')} type="password" autoComplete="off" readOnly value="" tabIndex={-1} />
          <Button type="submit" variant="primary" className="w-full" tabIndex={-1}>
            {t('login.submit')}
          </Button>
          <p className="text-center text-sm text-stone-600 underline underline-offset-2">{t('login.forgot')}</p>
        </form>
      </PublicCard>
      {branding.access_requests_enabled && (
        <p className="text-center text-sm text-stone-600">
          {t('login.noAccount')} <span className="font-medium text-accent-strong underline underline-offset-2">{t('login.requestAccess')}</span>
        </p>
      )}
    </PublicFrame>
  )
}
