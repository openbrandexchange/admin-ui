import { useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Link, useSearch } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import type { AdminAccessRequest, InviteResult } from '../../api/types'
import { countryName, formatDate, formatRelative } from '../../lib/format'
import { accessRequestsQuery, brandsQuery, retailersQuery, useAccessRequestMutations } from '../../queries/admin'
import { Badge, Button, Checkbox, Loading, PageHeader, SelectField, TextArea, cx } from '../../ui/controls'
import { Dialog, EmptyState, ErrorNote, LoadMore, Notice } from '../../ui/feedback'
import { InviteLink } from './RetailerDetail'

type Status = 'pending' | 'approved' | 'rejected'

function ApproveDialog({ req, onClose, onDone }: { req: AdminAccessRequest; onClose: () => void; onDone: (r: { invite?: InviteResult; retailerId: string }) => void }) {
  const { t } = useTranslation()
  const brands = useQuery(brandsQuery)
  const retailers = useInfiniteQuery(retailersQuery({ q: req.retailer.name.slice(0, 40) }))
  const m = useAccessRequestMutations()
  const [link, setLink] = useState('')
  const requested = req.requested_brand_ids ?? []
  const [chosen, setChosen] = useState<string[]>(requested)
  const [invite, setInvite] = useState(req.access.includes('portal'))
  const [apiKey, setApiKey] = useState(req.access.includes('api'))
  const brandList = brands.data?.items ?? []
  const matches = retailers.data?.pages[0]?.items ?? []
  return (
    <Dialog
      open
      onClose={onClose}
      title={t('requests.approveTitle', { name: req.retailer.name })}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            variant="primary"
            loading={m.approve.isPending}
            onClick={() =>
              m.approve.mutate(
                { id: req.id, body: { ...(link && { retailer_id: link }), brand_ids: chosen.length ? chosen : null, invite_portal_user: invite, create_api_client: apiKey } },
                { onSuccess: (res) => onDone({ invite: res.invite, retailerId: res.retailer.id }) },
              )
            }
          >
            {t('requests.approve')}
          </Button>
        </>
      }
    >
      {matches.length > 0 && (
        <SelectField label={t('requests.linkTo')} hint={t('requests.linkToHint')} value={link} onChange={(e) => setLink(e.target.value)}>
          <option value="">{t('requests.newRetailer')}</option>
          {matches.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
              {r.reference ? ` (${r.reference})` : ''}
            </option>
          ))}
        </SelectField>
      )}
      {brandList.length > 1 && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t('retailers.brandsLabel')}</legend>
          <p className="text-xs text-stone-500">{t('requests.brandsHint')}</p>
          {brandList.map((b) => (
            <Checkbox key={b.id} label={(b.data as { name?: string }).name ?? b.external_id} checked={chosen.includes(b.id)} onChange={(e) => setChosen(e.target.checked ? [...chosen, b.id] : chosen.filter((x) => x !== b.id))} />
          ))}
        </fieldset>
      )}
      <Checkbox label={t('requests.invite', { email: req.contact.email })} hint={t('requests.inviteHint')} checked={invite} onChange={(e) => setInvite(e.target.checked)} />
      <Checkbox label={t('requests.createKey')} hint={t('requests.createKeyHint')} checked={apiKey} onChange={(e) => setApiKey(e.target.checked)} />
      <ErrorNote error={m.approve.error} />
    </Dialog>
  )
}

function RejectDialog({ req, onClose }: { req: AdminAccessRequest; onClose: () => void }) {
  const { t } = useTranslation()
  const m = useAccessRequestMutations()
  const [reason, setReason] = useState('')
  return (
    <Dialog
      open
      onClose={onClose}
      title={t('requests.rejectTitle', { name: req.retailer.name })}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="danger" loading={m.reject.isPending} onClick={() => m.reject.mutate({ id: req.id, reason: reason.trim() || null }, { onSuccess: onClose })}>
            {t('requests.reject')}
          </Button>
        </>
      }
    >
      <TextArea label={t('requests.reason')} hint={t('requests.reasonHint')} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={2000} />
      <ErrorNote error={m.reject.error} />
    </Dialog>
  )
}

type Approval = { name: string; invite?: InviteResult; retailerId: string }

function RequestCard({ req, onApproved }: { req: AdminAccessRequest; onApproved: (a: Approval) => void }) {
  const { t, i18n } = useTranslation()
  const brands = useQuery(brandsQuery)
  const [dialog, setDialog] = useState<'approve' | 'reject' | null>(null)
  const lang = i18n.language
  const brandName = (id: string) => (brands.data?.items.find((b) => b.id === id)?.data as { name?: string } | undefined)?.name ?? id
  return (
    <li className="card space-y-3 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{req.retailer.name}</p>
          <p className="text-sm text-stone-600">
            {req.contact.name} · <a href={`mailto:${req.contact.email}`} className="underline underline-offset-2">{req.contact.email}</a>
            {req.contact.phone && ` · ${req.contact.phone}`}
          </p>
          <p className="text-xs text-stone-500">
            {[
              req.retailer.website,
              req.retailer.country && countryName(req.retailer.country, lang),
              req.retailer.vat_number && t('requests.vat', { vat: req.retailer.vat_number }),
              req.retailer.reference && t('retailers.ref', { ref: req.retailer.reference }),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <span className="text-xs text-stone-500" title={formatDate(req.created_at, lang, true)}>
          {formatRelative(req.created_at, lang)}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {req.access.map((a) => (
          <Badge key={a} tone="accent">
            {a === 'portal' ? t('requests.wantsPortal') : t('glossary.apiKey')}
          </Badge>
        ))}
        {req.requested_brand_ids?.map((b) => <Badge key={b}>{brandName(b)}</Badge>)}
      </div>
      {req.message && <blockquote className="border-l-2 border-stone-200 pl-3 text-sm whitespace-pre-line text-stone-700">{req.message}</blockquote>}
      {req.status === 'pending' && (
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => setDialog('approve')}>
            {t('requests.approve')}
          </Button>
          <Button variant="danger" onClick={() => setDialog('reject')}>
            {t('requests.reject')}
          </Button>
        </div>
      )}
      {req.status !== 'pending' && (
        <p className="text-xs text-stone-500">
          {t(`requests.decided.${req.status}`, { date: formatDate(req.decided_at, lang) })}
          {req.reason && ` · “${req.reason}”`}
          {req.retailer_id && (
            <>
              {' · '}
              <Link to="/admin/retailers/$id" params={{ id: req.retailer_id }} className="underline">
                {t('requests.openRetailer')}
              </Link>
            </>
          )}
        </p>
      )}
      {dialog === 'approve' && (
        <ApproveDialog
          req={req}
          onClose={() => setDialog(null)}
          onDone={(r) => {
            setDialog(null)
            onApproved({ ...r, name: req.retailer.name })
          }}
        />
      )}
      {dialog === 'reject' && <RejectDialog req={req} onClose={() => setDialog(null)} />}
    </li>
  )
}

export function AccessRequestsScreen() {
  const { t } = useTranslation()
  const { status = 'pending' } = useSearch({ from: '/admin/requests' })
  const requests = useInfiniteQuery(accessRequestsQuery(status))
  const [approved, setApproved] = useState<Approval | null>(null)
  const items = requests.data?.pages.flatMap((p) => p.items) ?? []
  return (
    <div className="space-y-5">
      <PageHeader title={t('requests.title')} description={t('requests.intro')} />
      {approved && (
        <div className="space-y-2">
          <Notice tone="ok">
            {t('requests.approved', { name: approved.name })}{' '}
            <Link to="/admin/retailers/$id" params={{ id: approved.retailerId }} className="font-medium underline">
              {t('requests.openRetailer')}
            </Link>
          </Notice>
          {approved.invite && <InviteLink result={approved.invite} />}
        </div>
      )}
      <div role="tablist" className="flex gap-1 border-b border-stone-200">
        {(['pending', 'approved', 'rejected'] as Status[]).map((s) => (
          <Link key={s} role="tab" aria-selected={status === s} to="/admin/requests" search={{ status: s === 'pending' ? undefined : s }} className={cx('-mb-px border-b-2 px-3 py-2 text-sm font-medium', status === s ? 'border-accent' : 'border-transparent text-stone-500')}>
            {t(`requests.tab.${s}`)}
          </Link>
        ))}
      </div>
      {requests.isPending ? (
        <Loading />
      ) : requests.isError ? (
        <ErrorNote error={requests.error} />
      ) : items.length === 0 ? (
        <EmptyState title={t(`requests.empty.${status}`)}>{status === 'pending' ? t('requests.emptyHint') : null}</EmptyState>
      ) : (
        <ul className="space-y-3">
          {items.map((r) => (
            <RequestCard key={r.id} req={r} onApproved={setApproved} />
          ))}
        </ul>
      )}
      <LoadMore hasNext={!!requests.hasNextPage} fetching={requests.isFetchingNextPage} onMore={() => void requests.fetchNextPage()} />
    </div>
  )
}
