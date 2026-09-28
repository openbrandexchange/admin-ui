import { useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import type { InviteResult, Retailer } from '../../api/types'
import { formatDate, formatRelative } from '../../lib/format'
import { emailProblem } from '../../lib/validate'
import { apiClientsQuery, brandsQuery, retailerQuery, statEventsQuery, useApiClientMutations, useRetailerMutations, useUserMutations, usersQuery } from '../../queries/admin'
import { Badge, Button, Checkbox, CopyButton, Loading, PageHeader, Saved, Section, SelectField, TextField } from '../../ui/controls'
import { ConfirmButton, EmptyState, ErrorNote, LoadMore, Notice } from '../../ui/feedback'
import { IconChevronLeft, IconPlus } from '../../ui/icons'
import { ApiKeyList } from '../shared/ApiKeys'
import { RetailerFields } from './RetailerNew'
import { EventLine } from './Stats'
import { UserStatusButton } from '../shared/UserStatusButton'

export function RetailerDetailScreen() {
  const { t, i18n } = useTranslation()
  const { id } = useParams({ from: '/admin/retailers/$id' })
  const retailer = useQuery(retailerQuery(id))
  const m = useRetailerMutations()
  const back = (
    <Link to="/admin/retailers" className="inline-flex items-center gap-1 text-sm text-stone-600">
      <IconChevronLeft size={16} />
      {t('retailers.title')}
    </Link>
  )
  if (retailer.isPending) return <Loading />
  if (retailer.isError)
    return (
      <div className="space-y-4">
        {back}
        <ErrorNote error={retailer.error} onRetry={() => void retailer.refetch()} />
      </div>
    )
  const r = retailer.data
  return (
    <div className="space-y-6">
      <PageHeader
        back={back}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {r.name}
            {r.status === 'blocked' ? <Badge tone="red">{t('retailers.blocked')}</Badge> : <Badge tone="green">{t('retailers.active')}</Badge>}
          </span>
        }
        description={t('retailers.since', { date: formatDate(r.created_at, i18n.language) })}
      />
      {r.status === 'blocked' && <Notice tone="warn">{t('retailers.blockedHint')}</Notice>}
      <Accounts retailer={r} />
      <AccessSection retailer={r} />
      <Keys retailer={r} />
      <Section title={t('retailers.details')}>
        <RetailerFields key={r.name + r.reference} initial={r} submitLabel={t('common.save')} pending={m.update.isPending} error={m.update.error} saved={m.update.isSuccess} onSubmit={(patch) => m.update.mutate({ id: r.id, patch })} />
      </Section>
      <Activity retailerId={r.id} />
      <Danger retailer={r} />
    </div>
  )
}

function AccessSection({ retailer: r }: { retailer: Retailer }) {
  const { t } = useTranslation()
  const brands = useQuery(brandsQuery)
  const m = useRetailerMutations()
  const [all, setAll] = useState(r.brand_ids == null)
  const [chosen, setChosen] = useState<string[]>(r.brand_ids ?? [])
  const [originals, setOriginals] = useState(r.allow_original === false ? 'never' : 'follow')
  const list = brands.data?.items ?? []
  return (
    <Section title={t('retailers.access')} description={t('retailers.accessHint')}>
      {list.length > 1 && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t('retailers.brandsLabel')}</legend>
          <Checkbox label={t('retailers.allBrands')} hint={t('retailers.allBrandsHint')} checked={all} onChange={(e) => setAll(e.target.checked)} />
          {!all &&
            list.map((b) => (
              <Checkbox key={b.id} className="ml-6" label={(b.data as { name?: string }).name ?? b.external_id} checked={chosen.includes(b.id)} onChange={(e) => setChosen(e.target.checked ? [...chosen, b.id] : chosen.filter((x) => x !== b.id))} />
            ))}
        </fieldset>
      )}
      <SelectField label={t('retailers.originals')} hint={t('retailers.originalsHint')} value={originals} onChange={(e) => setOriginals(e.target.value)} className="max-w-md">
        <option value="follow">{t('retailers.originalsFollow')}</option>
        <option value="never">{t('retailers.originalsNever')}</option>
      </SelectField>
      <ErrorNote error={m.update.error} />
      <div className="flex items-center gap-3">
        <Button variant="primary" loading={m.update.isPending} onClick={() => m.update.mutate({ id: r.id, patch: { brand_ids: all ? null : chosen, allow_original: originals === 'never' ? false : null } })}>
          {t('common.save')}
        </Button>
        <Saved show={m.update.isSuccess} />
      </div>
    </Section>
  )
}

export function InviteLink({ result }: { result: InviteResult }) {
  const { t, i18n } = useTranslation()
  return (
    <Notice tone="ok">
      <p>{result.email_sent ? t('users.inviteSent', { email: result.user.email }) : t('users.inviteNoMail', { email: result.user.email })}</p>
      {!result.email_sent && (
        <div className="mt-2 flex items-center gap-2">
          <input readOnly value={result.invite_url} className="input font-mono text-xs" onFocus={(e) => e.currentTarget.select()} aria-label={t('users.inviteLink')} />
          <CopyButton value={result.invite_url} />
        </div>
      )}
      <p className="mt-1 text-xs">{t('users.inviteValid', { date: formatDate(result.expires_at, i18n.language) })}</p>
    </Notice>
  )
}

function Accounts({ retailer: r }: { retailer: Retailer }) {
  const { t, i18n } = useTranslation()
  const users = useQuery(usersQuery({ retailer_id: r.id, role: 'retailer' }))
  const m = useUserMutations()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [touched, setTouched] = useState(false)
  const [lastInvite, setLastInvite] = useState<InviteResult | null>(null)
  const lang = i18n.language
  return (
    <Section title={t('users.retailerAccounts')} description={t('users.retailerAccountsHint')}>
      {lastInvite && <InviteLink result={lastInvite} />}
      {users.isPending ? (
        <Loading />
      ) : users.isError ? (
        <ErrorNote error={users.error} onRetry={() => void users.refetch()} />
      ) : users.data.items.length === 0 ? (
        <p className="text-sm text-stone-500">{t('users.none')}</p>
      ) : (
        <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200">
          {users.data.items.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{u.name || u.email}</p>
                <p className="text-xs text-stone-500">
                  {u.email} ·{' '}
                  {u.status === 'invited'
                    ? t('users.invitedUntil', { date: formatDate(u.invite_expires_at, lang) })
                    : u.last_login_at
                      ? t('users.lastLogin', { when: formatRelative(u.last_login_at, lang) })
                      : t('users.neverLoggedIn')}
                </p>
              </div>
              <Badge tone={u.status === 'active' ? 'green' : u.status === 'blocked' ? 'red' : 'amber'}>{t(`users.status.${u.status}`)}</Badge>
              {u.status === 'invited' && (
                <Button size="sm" loading={m.resend.isPending && m.resend.variables === u.id} onClick={() => m.resend.mutate(u.id, { onSuccess: setLastInvite })}>
                  {t('users.resend')}
                </Button>
              )}
              {u.status !== 'invited' && (
                <UserStatusButton user={u} />
              )}
              <ConfirmButton size="sm" label={t('common.delete')} title={t('users.deleteTitle', { email: u.email })} body={t('users.deleteBody')} confirmLabel={t('common.delete')} onConfirm={() => m.remove.mutateAsync(u.id)} />
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
            { email: email.trim(), name: name.trim() || undefined, role: 'retailer', retailer_id: r.id },
            {
              onSuccess: (res) => {
                setLastInvite(res)
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
          {t('users.invite')}
        </Button>
      </form>
      <ErrorNote error={m.invite.error ?? m.update.error ?? m.resend.error} />
    </Section>
  )
}

function Keys({ retailer: r }: { retailer: Retailer }) {
  const { t } = useTranslation()
  const clients = useQuery(apiClientsQuery(r.id))
  const m = useApiClientMutations()
  const create = useMutation({ mutationFn: (name: string) => m.create.mutateAsync({ retailer_id: r.id, name }) })
  return (
    <Section title={t('glossary.apiKey')} description={t('retailers.keysHint')}>
      {clients.isPending ? <Loading /> : clients.isError ? <ErrorNote error={clients.error} onRetry={() => void clients.refetch()} /> : <ApiKeyList clients={clients.data.items} create={create} rotate={m.rotate} revoke={m.revoke} />}
    </Section>
  )
}

function Activity({ retailerId }: { retailerId: string }) {
  const { t } = useTranslation()
  const events = useInfiniteQuery(statEventsQuery({ retailer_id: retailerId }))
  const items = events.data?.pages.flatMap((p) => p.items) ?? []
  return (
    <Section title={t('retailers.activity')}>
      {events.isPending ? (
        <Loading />
      ) : items.length === 0 ? (
        <EmptyState title={t('dashboard.noActivity')}>{t('retailers.noActivityHint')}</EmptyState>
      ) : (
        <>
          <ul className="divide-y divide-stone-100">
            {items.map((e) => (
              <EventLine key={e.id} event={e} />
            ))}
          </ul>
          <LoadMore hasNext={!!events.hasNextPage} fetching={events.isFetchingNextPage} onMore={() => void events.fetchNextPage()} />
        </>
      )}
    </Section>
  )
}

function Danger({ retailer: r }: { retailer: Retailer }) {
  const { t } = useTranslation()
  const m = useRetailerMutations()
  const navigate = useNavigate()
  const blocked = r.status === 'blocked'
  return (
    <Section title={t('product.dangerZone')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-sm text-stone-600">{blocked ? t('retailers.unblockHint') : t('retailers.blockHint')}</p>
        <ConfirmButton
          variant={blocked ? 'secondary' : 'danger'}
          label={blocked ? t('retailers.unblock') : t('retailers.block')}
          title={blocked ? t('retailers.unblockTitle', { name: r.name }) : t('retailers.blockTitle', { name: r.name })}
          body={blocked ? t('retailers.unblockBody') : t('retailers.blockBody')}
          confirmLabel={blocked ? t('retailers.unblock') : t('retailers.block')}
          onConfirm={() => m.update.mutateAsync({ id: r.id, patch: { status: blocked ? 'active' : 'blocked' } })}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-4">
        <p className="max-w-prose text-sm text-stone-600">{t('retailers.deleteHint')}</p>
        <ConfirmButton
          label={t('retailers.delete')}
          title={t('retailers.deleteTitle', { name: r.name })}
          body={t('retailers.deleteBody')}
          confirmLabel={t('retailers.delete')}
          onConfirm={async () => {
            await m.remove.mutateAsync(r.id)
            await navigate({ to: '/admin/retailers' })
          }}
        />
      </div>
    </Section>
  )
}
