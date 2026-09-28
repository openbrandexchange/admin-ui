import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { api, req } from '../../api/client'
import { passwordProblem } from '../../lib/validate'
import { useSessionSetter } from '../../queries/session'
import { Button, Loading, TextField } from '../../ui/controls'
import { ErrorNote, Notice } from '../../ui/feedback'
import { NewPasswordFields } from './Password'
import { PublicCard } from './PublicCard'

/** /invite/{token}: the link from the invitation e-mail. Choose a password and you're in. */
export function InviteScreen() {
  const { t, i18n } = useTranslation()
  const { token } = useParams({ from: '/public/invite/$token' })
  const navigate = useNavigate()
  const setSession = useSessionSetter()
  const invite = useQuery({
    queryKey: ['invite', token],
    queryFn: () => req(() => api.GET('/admin/api/invites/{token}', { params: { path: { token } } })),
    retry: false,
  })
  const [name, setName] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [touched, setTouched] = useState(false)
  const accept = useMutation({
    mutationFn: () =>
      req(() =>
        api.POST('/admin/api/invites/{token}/accept', {
          params: { path: { token } },
          body: { password, language: i18n.language, ...(name?.trim() && { name: name.trim() }) },
        }),
      ),
    onSuccess: (s) => {
      setSession(s)
      void navigate({ to: s.user?.role === 'admin' ? '/admin' : '/' })
    },
  })

  if (invite.isPending) return <Loading />
  if (invite.isError)
    return (
      <PublicCard title={t('invite.invalidTitle')}>
        <Notice tone="warn">{t('invite.invalid')}</Notice>
        <p className="text-sm">
          <Link to="/login" className="underline underline-offset-2">
            {t('password.backToLogin')}
          </Link>
        </p>
      </PublicCard>
    )

  const inv = invite.data
  const displayName = name ?? inv.name ?? ''
  return (
    <PublicCard
      title={t('invite.title')}
      intro={inv.retailer_name ? t('invite.introRetailer', { retailer: inv.retailer_name }) : t('invite.introAdmin')}
    >
      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          setTouched(true)
          if (!passwordProblem(password) && password === confirm && displayName.trim()) accept.mutate()
        }}
      >
        <TextField label={t('fields.email')} value={inv.email} readOnly disabled />
        <TextField label={t('fields.yourName')} value={displayName} onChange={(e) => setName(e.target.value)} autoComplete="name" error={touched && !displayName.trim() ? t('validate.required') : null} />
        <NewPasswordFields password={password} setPassword={setPassword} confirm={confirm} setConfirm={setConfirm} touched={touched} />
        <ErrorNote error={accept.error} />
        <Button type="submit" variant="primary" className="w-full" loading={accept.isPending}>
          {t('invite.submit')}
        </Button>
      </form>
    </PublicCard>
  )
}
