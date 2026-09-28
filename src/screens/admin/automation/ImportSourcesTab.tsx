import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import type { ImportSource } from '../../../api/types'
import { formatBytes, formatRelative } from '../../../lib/format'
import { importSourcesQuery, useImportSourceMutations } from '../../../queries/admin'
import { Badge, Button, Loading, Switch, buttonClass } from '../../../ui/controls'
import { ConfirmButton, EmptyState, ErrorNote, Notice } from '../../../ui/feedback'
import { IconPlus } from '../../../ui/icons'
import { RUN_TONE, RunSummary } from '../Imports'

export function useScheduleText() {
  const { t } = useTranslation()
  return (s: ImportSource['schedule']) => {
    if (s.frequency === 'manual') return t('sources.freq.manual')
    if (s.frequency === 'hourly') return t('sources.freq.hourly')
    if (s.frequency === 'daily') return t('sources.freq.dailyAt', { time: s.time ?? '02:00' })
    return t('sources.freq.weeklyAt', { day: t(`sources.weekday.${s.weekday ?? 1}`), time: s.time ?? '02:00' })
  }
}

function where(s: ImportSource): string {
  const c = s.config as Record<string, unknown>
  if (s.kind === 'https_url') return String(c.url ?? '')
  if (s.kind === 'sftp') return `${c.username ?? ''}@${c.host ?? ''}:${c.path ?? ''}`
  return `${c.bucket ?? ''}/${c.prefix ?? ''}`
}

function SourceCard({ s }: { s: ImportSource }) {
  const { t, i18n } = useTranslation()
  const m = useImportSourceMutations()
  const schedule = useScheduleText()
  const [test, setTest] = useState<Awaited<ReturnType<typeof m.test.mutateAsync>> | null>(null)
  const lang = i18n.language
  return (
    <li className="card space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{s.name}</p>
          <p className="truncate font-mono text-xs text-stone-500">
            {t(`sources.kind.${s.kind}`)} · {where(s)}
          </p>
          <p className="text-xs text-stone-500">
            {schedule(s.schedule)} · {s.mode === 'mirror' ? t('imports.modeMirror') : t('imports.modeUpsert')}
            {s.next_run_at && s.enabled && ` · ${t('sources.next', { when: formatRelative(s.next_run_at, lang) })}`}
          </p>
        </div>
        <div className="w-44">
          <Switch checked={s.enabled} onChange={(v) => m.update.mutate({ id: s.id, patch: { enabled: v } })} label={s.enabled ? t('sources.on') : t('sources.off')} />
        </div>
      </div>
      {s.last_run && (
        <Link to="/admin/imports/$id" params={{ id: s.last_run.id }} className="flex flex-wrap items-center gap-2 text-sm hover:underline">
          <Badge tone={RUN_TONE[s.last_run.status]}>{t(`imports.status.${s.last_run.status}`)}</Badge>
          <span className="text-xs text-stone-500">{formatRelative(s.last_run.created_at, lang)}</span>
          <RunSummary run={s.last_run} />
        </Link>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="primary" loading={m.run.isPending} onClick={() => m.run.mutate({ id: s.id })}>
          {t('sources.runNow')}
        </Button>
        <Button size="sm" loading={m.test.isPending} onClick={() => m.test.mutate(s.id, { onSuccess: setTest })}>
          {t('sources.test')}
        </Button>
        <Link to="/admin/automation/sources/$id" params={{ id: s.id }} className={buttonClass('ghost', 'sm')}>
          {t('common.edit')}
        </Link>
        <span className="flex-1" />
        <ConfirmButton size="sm" label={t('common.delete')} title={t('sources.deleteTitle', { name: s.name })} body={t('sources.deleteBody')} confirmLabel={t('common.delete')} onConfirm={() => m.remove.mutateAsync(s.id)} />
      </div>
      {m.run.isSuccess && (
        <Notice tone="ok">
          {t('sources.started')}{' '}
          <Link to="/admin/imports/$id" params={{ id: m.run.data.id }} className="font-medium underline">
            {t('sources.follow')}
          </Link>
        </Notice>
      )}
      {test && <TestResult result={test} />}
      <ErrorNote error={m.run.error ?? m.test.error ?? m.update.error} />
    </li>
  )
}

export function TestResult({ result }: { result: { ok: boolean; message?: string | null; host_key_fingerprint?: string | null; files: { name: string; bytes: number }[] } }) {
  const { t, i18n } = useTranslation()
  return (
    <Notice tone={result.ok ? 'ok' : 'warn'}>
      <p className="font-medium">{result.ok ? t('sources.testOk', { count: result.files.length }) : t('sources.testFailed')}</p>
      {result.message && <p className="text-xs">{result.message}</p>}
      {result.host_key_fingerprint && <p className="font-mono text-xs">{t('sources.hostKey', { fp: result.host_key_fingerprint })}</p>}
      {result.files.length > 0 && (
        <ul className="mt-1 max-h-40 overflow-y-auto font-mono text-xs">
          {result.files.map((f) => (
            <li key={f.name}>
              {f.name} <span className="opacity-60">{formatBytes(f.bytes, i18n.language)}</span>
            </li>
          ))}
        </ul>
      )}
    </Notice>
  )
}

export function ImportSourcesTab() {
  const { t } = useTranslation()
  const sources = useQuery(importSourcesQuery)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-sm text-stone-600">{t('sources.intro')}</p>
        <Link to="/admin/automation/sources/new" className={buttonClass('primary')}>
          <IconPlus size={16} />
          {t('sources.add')}
        </Link>
      </div>
      {sources.isPending ? (
        <Loading />
      ) : sources.isError ? (
        <ErrorNote error={sources.error} onRetry={() => void sources.refetch()} />
      ) : sources.data.items.length === 0 ? (
        <EmptyState title={t('sources.emptyTitle')}>{t('sources.empty')}</EmptyState>
      ) : (
        <ul className="space-y-3">
          {sources.data.items.map((s) => (
            <SourceCard key={s.id} s={s} />
          ))}
        </ul>
      )}
    </div>
  )
}
