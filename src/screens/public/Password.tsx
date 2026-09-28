import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { api, req } from '../../api/client'
import { passwordProblem } from '../../lib/validate'
import { useSessionSetter } from '../../queries/session'
import { Button, TextField } from '../../ui/controls'
import { ErrorNote, Notice } from '../../ui/feedback'
import { PublicCard } from './PublicCard'

export function ForgotPasswordScreen() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const send = useMutation({ mutationFn: () => req(() => api.POST('/admin/api/password/forgot', { body: { email: email.trim() } })) })
  return (
    <PublicCard title={t('password.forgotTitle')} intro={t('password.forgotIntro')}>
      {send.isSuccess ? (
        <Notice tone="ok">{t('password.forgotSent')}</Notice>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            send.mutate()
          }}
        >
          <TextField label={t('fields.email')} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          <ErrorNote error={send.error} />
          <Button type="submit" variant="primary" className="w-full" loading={send.isPending}>
            {t('password.forgotSubmit')}
          </Button>
        </form>
      )}
      <p className="text-center text-sm">
        <Link to="/login" className="text-stone-600 underline underline-offset-2">
          {t('password.backToLogin')}
        </Link>
      </p>
    </PublicCard>
  )
}

/** Shared "choose a password" form (reset link and invitation). */
export function NewPasswordFields({ password, setPassword, confirm, setConfirm, touched, serverError }: { password: string; setPassword: (v: string) => void; confirm: string; setConfirm: (v: string) => void; touched: boolean; serverError?: string }) {
  const { t } = useTranslation()
  const pw = passwordProblem(password)
  return (
    <>
      <TextField label={t('fields.newPassword')} hint={t('validate.passwordRule')} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={(touched && pw ? t(pw) : null) ?? serverError} />
      <TextField label={t('fields.passwordConfirm')} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={touched && confirm !== password ? t('validate.passwordMismatch') : null} />
    </>
  )
}

export function ResetPasswordScreen() {
  const { t } = useTranslation()
  const { token } = useParams({ from: '/public/reset-password/$token' })
  const navigate = useNavigate()
  const setSession = useSessionSetter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [touched, setTouched] = useState(false)
  const reset = useMutation({
    mutationFn: () => req(() => api.POST('/admin/api/password/reset', { body: { token, password } })),
    onSuccess: (s) => {
      setSession(s)
      void navigate({ to: s.user?.role === 'admin' ? '/admin' : '/' })
    },
  })
  return (
    <PublicCard title={t('password.resetTitle')} intro={t('password.resetIntro')}>
      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          setTouched(true)
          if (!passwordProblem(password) && password === confirm) reset.mutate()
        }}
      >
        <NewPasswordFields password={password} setPassword={setPassword} confirm={confirm} setConfirm={setConfirm} touched={touched} />
        <ErrorNote error={reset.error} />
        <Button type="submit" variant="primary" className="w-full" loading={reset.isPending}>
          {t('password.resetSubmit')}
        </Button>
      </form>
    </PublicCard>
  )
}
