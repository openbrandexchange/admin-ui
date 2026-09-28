import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../api/client'
import type { ImportRowError } from '../../api/types'
import { formatDate, formatNumber } from '../../lib/format'
import { importErrorsQuery, importRunQuery } from '../../queries/admin'
import { Badge, Loading, PageHeader, Section, Spinner } from '../../ui/controls'
import { ErrorNote, LoadMore, Notice } from '../../ui/feedback'
import { IconChevronLeft } from '../../ui/icons'
import { RUN_TONE } from './Imports'

function ErrorRow({ e }: { e: ImportRowError }) {
  const { t } = useTranslation()
  return (
    <tr className={e.severity === 'error' ? 'bg-red-50/40' : 'bg-amber-50/40'}>
      <td className="px-3 py-2 align-top">
        <Badge tone={e.severity === 'error' ? 'red' : 'amber'}>{t(`imports.severity.${e.severity}`)}</Badge>
      </td>
      <td className="px-3 py-2 align-top font-mono text-xs">
        {e.file}
        {e.row != null && <span className="text-stone-500"> · {t('imports.row', { n: e.row })}</span>}
      </td>
      <td className="px-3 py-2 align-top font-mono text-xs">{e.column ?? ''}</td>
      <td className="px-3 py-2 align-top font-mono text-xs break-all">{e.value ?? ''}</td>
      <td className="px-3 py-2 align-top text-sm">
        <span className="block">{t(`importErrors.${e.obx_error}`, { defaultValue: '' }) || e.detail}</span>
        {t(`importErrors.${e.obx_error}`, { defaultValue: '' }) && <span className="block text-xs text-stone-500">{e.detail}</span>}
      </td>
    </tr>
  )
}

export function ImportRunScreen() {
  const { t, i18n } = useTranslation()
  const { id } = useParams({ from: '/admin/imports/$id' })
  const run = useQuery(importRunQuery(id))
  const finished = run.data && (run.data.status === 'succeeded' || run.data.status === 'failed')
  const errors = useInfiniteQuery({ ...importErrorsQuery(id), enabled: !!finished && (run.data?.counts.errors ?? 0) + (run.data?.counts.warnings ?? 0) > 0 })
  const back = (
    <Link to="/admin/imports" className="inline-flex items-center gap-1 text-sm text-stone-600">
      <IconChevronLeft size={16} />
      {t('imports.title')}
    </Link>
  )
  if (run.isPending) return <Loading />
  if (run.isError)
    return (
      <div className="space-y-4">
        {back}
        <ErrorNote error={run.error} onRetry={() => void run.refetch()} />
      </div>
    )
  const r = run.data
  const c = r.counts
  const lang = i18n.language
  const tiles: [string, number, string?][] = [
    [t('imports.count.rows'), c.rows],
    [t('imports.count.files'), c.files],
    [t('imports.count.created'), c.created, 'text-emerald-700'],
    [t('imports.count.updated'), c.updated],
    [t('imports.count.unchanged'), c.unchanged, 'text-stone-500'],
    [t('imports.count.unpublished'), c.unpublished],
    [t('imports.count.errors'), c.errors, c.errors ? 'text-red-700' : undefined],
    [t('imports.count.warnings'), c.warnings, c.warnings ? 'text-amber-700' : undefined],
  ]
  const errorItems = errors.data?.pages.flatMap((p) => p.items) ?? r.errors_preview ?? []
  return (
    <div className="space-y-6">
      <PageHeader
        back={back}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {t(`imports.trigger.${r.trigger}`)}
            <Badge tone={RUN_TONE[r.status]}>{t(`imports.status.${r.status}`)}</Badge>
            {r.dry_run && <Badge tone="blue">{t('imports.checkOnly')}</Badge>}
          </span>
        }
        description={`${formatDate(r.created_at, lang, true)}${r.mode === 'mirror' ? ` · ${t('imports.modeMirror')}` : ''}`}
      />
      {!finished && (
        <Notice>
          <span className="inline-flex items-center gap-2" aria-live="polite">
            <Spinner size={16} />
            {t('imports.working')}
          </span>
        </Notice>
      )}
      {r.dry_run && finished && <Notice>{t('imports.dryRunDone')}</Notice>}
      {r.status === 'failed' && r.error && <ErrorNote error={new ApiError(r.error.status, r.error)} />}
      {r.status === 'succeeded' && !r.dry_run && c.errors === 0 && <Notice tone="ok">{t('imports.allGood')}</Notice>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(([label, value, cls]) => (
          <div key={label} className="card p-3">
            <p className="text-xs text-stone-500">{label}</p>
            <p className={`text-xl font-semibold tabular ${cls ?? ''}`}>{formatNumber(value, lang)}</p>
          </div>
        ))}
      </div>

      {(c.errors > 0 || c.warnings > 0) && (
        <Section title={t('imports.problems')} description={c.errors > 0 ? t('imports.problemsHint') : undefined}>
          <div role="region" tabIndex={0} aria-label={t('imports.problems')} className="overflow-x-auto rounded-lg border border-stone-200">
            <table className="w-full text-left">
              <thead className="bg-stone-50 text-xs text-stone-500">
                <tr>
                  <th className="px-3 py-2 font-medium" />
                  <th className="px-3 py-2 font-medium">{t('imports.where')}</th>
                  <th className="px-3 py-2 font-medium">{t('imports.column')}</th>
                  <th className="px-3 py-2 font-medium">{t('imports.value')}</th>
                  <th className="px-3 py-2 font-medium">{t('imports.problem')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {errorItems.map((e, i) => (
                  <ErrorRow key={i} e={e} />
                ))}
              </tbody>
            </table>
          </div>
          <LoadMore hasNext={!!errors.hasNextPage} fetching={errors.isFetchingNextPage} onMore={() => void errors.fetchNextPage()} />
        </Section>
      )}

      {r.files && r.files.length > 0 && (
        <Section title={t('imports.filesTitle')}>
          <ul className="text-sm">
            {r.files.map((f) => (
              <li key={f.name} className="font-mono text-xs">
                {f.name}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}
