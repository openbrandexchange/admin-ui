import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { InviteResult } from '../../../api/types'
import { formatDate, formatRelative } from '../../../lib/format'
import { emailProblem } from '../../../lib/validate'
import { useUserMutations, usersQuery } from '../../../queries/admin'
import { useSession } from '../../../queries/session'
import { Badge, Button, Loading, Section, TextField } from '../../../ui/controls'
import { ConfirmButton, ErrorNote } from '../../../ui/feedback'
import { IconPlus } from '../../../ui/icons'
import { InviteLink } from '../RetailerDetail'
import { UserStatusButton } from '../../shared/UserStatusButton'

/** The brand's own colleagues with admin access. */
export function TeamTab() {
  const { t, i18n } = useTranslation()
  const session = useSession()
  const users = useQuery(usersQuery({ role: 'admin' }))
  const m = useUserMutations()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [touched, setTouched] = useState(false)
  const [invite, setInvite] = useState<InviteResult | null>(null)
  const me = session.data?.user?.id
  const lang = i18n.language
  return (
    <Section title={t('settings.team')} description={t('settings.teamHint')}>
      {invite && <InviteLink result={invite} />}
      {users.isPending ? (
        <Loading />
      ) : users.isError ? (
        <ErrorNote error={users.error} onRetry={() => void users.refetch()} />
      ) : (
        <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200">
          {users.data.items.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {u.name || u.email} {u.id === me && <span className="text-xs text-stone-500">({t('users.you')})</span>}
                </p>
                <p className="text-xs text-stone-500">
                  {u.email} · {u.status === 'invited' ? t('users.invitedUntil', { date: formatDate(u.invite_expires_at, lang) }) : u.last_login_at ? t('users.lastLogin', { when: formatRelative(u.last_login_at, lang) }) : t('users.neverLoggedIn')}
                </p>
              </div>
              <Badge tone={u.status === 'active' ? 'green' : u.status === 'blocked' ? 'red' : 'amber'}>{t(`users.status.${u.status}`)}</Badge>
              {u.id !== me && (
                <>
                  {u.status === 'invited' ? (
                    <Button size="sm" onClick={() => m.resend.mutate(u.id, { onSuccess: setInvite })}>
                      {t('users.resend')}
                    </Button>
                  ) : (
                    <UserStatusButton user={u} />
                  )}
                  <ConfirmButton size="sm" label={t('common.delete')} title={t('users.deleteTitle', { email: u.email })} body={t('users.deleteAdminBody')} confirmLabel={t('common.delete')} onConfirm={() => m.remove.mutateAsync(u.id)} />
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex flex-wrap items-end gap-2"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          setTouched(true)
          if (emailProblem(email)) return
          m.invite.mutate(
            { email: email.trim(), name: name.trim() || undefined, role: 'admin', language: lang },
            {
              onSuccess: (r) => {
                setInvite(r)
                setEmail('')
                setName('')
                setTouched(false)
              },
            },
          )
        }}
      >
        <TextField className="min-w-52 flex-1" label={t('fields.email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={touched && emailProblem(email) ? t('validate.email') : null} />
        <TextField className="min-w-40 flex-1" label={t('fields.nameOptional')} value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" loading={m.invite.isPending}>
          <IconPlus size={16} />
          {t('users.inviteColleague')}
        </Button>
      </form>
      <ErrorNote error={m.invite.error ?? m.update.error ?? m.remove.error ?? m.resend.error} />
    </Section>
  )
}
