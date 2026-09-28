import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { WebhookSubscription } from '../../../api/types'
import { formatRelative } from '../../../lib/format'
import { urlProblem } from '../../../lib/validate'
import { useWebhookMutations, webhookDeliveriesQuery, webhooksQuery, type AdminWebhookEvent } from '../../../queries/admin'
import { Badge, Button, Checkbox, Loading, SecretOnce, Section, TextField } from '../../../ui/controls'
import { ConfirmButton, EmptyState, ErrorNote, Notice } from '../../../ui/feedback'
import { IconPlus } from '../../../ui/icons'

const EVENTS: AdminWebhookEvent[] = ['access_request.created', 'import_run.completed', 'ingest_job.completed']

function Deliveries({ id }: { id: string }) {
  const { t, i18n } = useTranslation()
  const q = useQuery(webhookDeliveriesQuery(id))
  if (q.isPending) return <Loading />
  if (q.isError) return <ErrorNote error={q.error} onRetry={() => void q.refetch()} />
  if (!q.data.items.length) return <p className="text-xs text-stone-500">{t('webhooks.noDeliveries')}</p>
  return (
    <ul className="space-y-1 text-xs">
      {q.data.items.map((d) => (
        <li key={d.id} className="flex flex-wrap gap-2">
          <Badge tone={d.success ? 'green' : 'red'}>{d.status_code ?? '—'}</Badge>
          <span className="font-mono">{d.event_type}</span>
          <span className="text-stone-500">{formatRelative(d.at, i18n.language)}</span>
          {d.duration_ms != null && <span className="text-stone-500">{d.duration_ms} ms</span>}
          {d.error && <span className="text-red-700">{d.error}</span>}
        </li>
      ))}
    </ul>
  )
}

function Hook({ w }: { w: WebhookSubscription }) {
  const { t, i18n } = useTranslation()
  const m = useWebhookMutations()
  const [open, setOpen] = useState(false)
  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-sm">{w.url}</p>
          <p className="text-xs text-stone-500">
            {w.events.map((e) => t(`webhooks.event.${e}`, { defaultValue: e })).join(', ')}
            {w.last_delivery_at && ` · ${t('webhooks.last', { when: formatRelative(w.last_delivery_at, i18n.language), status: w.last_status ?? '—' })}`}
          </p>
        </div>
        {w.status === 'disabled' ? <Badge tone="amber">{t('webhooks.disabled')}</Badge> : <Badge tone="green">{t('webhooks.active')}</Badge>}
        <Button size="sm" loading={m.test.isPending} onClick={() => m.test.mutate(w.id, { onSuccess: () => setOpen(true) })}>
          {t('webhooks.test')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => m.update.mutate({ id: w.id, patch: { status: w.status === 'active' ? 'disabled' : 'active' } })}>
          {w.status === 'active' ? t('webhooks.pause') : t('webhooks.resume')}
        </Button>
        <Button size="sm" variant="ghost" aria-expanded={open} onClick={() => setOpen(!open)}>
          {t('webhooks.deliveries')}
        </Button>
        <ConfirmButton size="sm" label={t('common.delete')} title={t('webhooks.deleteTitle')} body={t('webhooks.deleteBody')} confirmLabel={t('common.delete')} onConfirm={() => m.remove.mutateAsync(w.id)} />
      </div>
      {m.test.data && <Notice tone={m.test.data.success ? 'ok' : 'warn'}>{m.test.data.success ? t('webhooks.testOk', { status: m.test.data.status_code }) : t('webhooks.testFailed', { error: m.test.data.error ?? m.test.data.status_code })}</Notice>}
      <ErrorNote error={m.test.error ?? m.update.error} />
      {open && <Deliveries id={w.id} />}
    </li>
  )
}

/** Tell the brand's own systems when something happens (a retailer asks for access, an import finished). */
export function WebhooksTab() {
  const { t } = useTranslation()
  const hooks = useQuery(webhooksQuery)
  const m = useWebhookMutations()
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState<AdminWebhookEvent[]>(['access_request.created', 'import_run.completed'])
  const [secret, setSecret] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)
  const urlErr = touched && urlProblem(url) ? t('validate.url') : m.create.error && (m.create.error as { code?: string }).code === 'unsafe_url' ? t('errors.unsafe_url') : null
  return (
    <div className="space-y-6">
      <p className="max-w-prose text-sm text-stone-600">{t('webhooks.intro')}</p>
      {secret && (
        <SecretOnce label={t('webhooks.secret')} value={secret}>
          <p className="text-xs text-amber-950">{t('webhooks.secretHint')}</p>
          <Button size="sm" onClick={() => setSecret(null)}>
            {t('apiKeys.savedIt')}
          </Button>
        </SecretOnce>
      )}
      {hooks.isPending ? (
        <Loading />
      ) : hooks.isError ? (
        <ErrorNote error={hooks.error} onRetry={() => void hooks.refetch()} />
      ) : hooks.data.items.length === 0 ? (
        <EmptyState title={t('webhooks.emptyTitle')}>{t('webhooks.empty')}</EmptyState>
      ) : (
        <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
          {hooks.data.items.map((w) => (
            <Hook key={w.id} w={w} />
          ))}
        </ul>
      )}
      <Section title={t('webhooks.new')}>
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            setTouched(true)
            if (urlProblem(url) || !events.length) return
            m.create.mutate(
              { url: url.trim(), events },
              {
                onSuccess: (w) => {
                  setSecret(w.secret ?? null)
                  setUrl('')
                  setTouched(false)
                },
              },
            )
          }}
        >
          <TextField label={t('webhooks.url')} hint={t('webhooks.urlHint')} type="url" value={url} onChange={(e) => setUrl(e.target.value)} error={urlErr} placeholder="https://" />
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t('webhooks.events')}</legend>
            {EVENTS.map((ev) => (
              <Checkbox key={ev} label={t(`webhooks.event.${ev}`)} checked={events.includes(ev)} onChange={(e) => setEvents(e.target.checked ? [...events, ev] : events.filter((x) => x !== ev))} />
            ))}
          </fieldset>
          <ErrorNote error={m.create.error} />
          <Button type="submit" variant="primary" loading={m.create.isPending}>
            <IconPlus size={16} />
            {t('webhooks.create')}
          </Button>
        </form>
      </Section>
    </div>
  )
}
