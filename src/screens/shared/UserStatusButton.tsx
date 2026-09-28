import { useTranslation } from 'react-i18next'
import type { User } from '../../api/types'
import { useUserMutations } from '../../queries/admin'
import { Button } from '../../ui/controls'
import { ConfirmButton, ErrorNote } from '../../ui/feedback'

/** Block (asks first: the person is logged out at once) or unblock an account. */
export function UserStatusButton({ user }: { user: User }) {
  const { t } = useTranslation()
  const m = useUserMutations()
  if (user.status === 'blocked')
    return (
      <span className="inline-flex flex-col gap-1">
        <Button size="sm" variant="ghost" loading={m.update.isPending} onClick={() => m.update.mutate({ id: user.id, patch: { status: 'active' } })}>
          {t('users.unblock')}
        </Button>
        <ErrorNote error={m.update.error} className="max-w-xs" />
      </span>
    )
  return (
    <ConfirmButton
      size="sm"
      variant="secondary"
      label={t('users.block')}
      title={t('users.blockTitle', { email: user.email })}
      body={t('users.blockBody')}
      confirmLabel={t('users.block')}
      onConfirm={() => m.update.mutateAsync({ id: user.id, patch: { status: 'blocked' } })}
    />
  )
}
