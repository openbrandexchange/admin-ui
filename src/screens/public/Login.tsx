import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearch } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useBranding, useLogin, useSession } from '../../queries/session'
import { setLanguage } from '../../i18n'
import { isLang } from '../../i18n/languages'
import { localized } from '../../lib/localized'
import { usePortalTitle } from '../../lib/branding'
import { Button, TextField } from '../../ui/controls'
import { ErrorNote, Notice } from '../../ui/feedback'
import { PublicCard } from './PublicCard'

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

  const welcome = localized(branding.data?.welcome_text, i18n.language)

  return (
    <>
      <PublicCard title={t('login.title', { portal: title.full })} intro={welcome || t('login.intro')}>
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
