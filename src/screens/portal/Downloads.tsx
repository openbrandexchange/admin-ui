import { useTranslation } from 'react-i18next'
import type { DownloadJob } from '../../api/types'
import { formatBytes, formatDate, formatRelative } from '../../lib/format'
import { useDownloadJobs } from '../../queries/portal'
import { Badge, Loading } from '../../ui/controls'
import { EmptyState, ErrorNote } from '../../ui/feedback'
import { DownloadButton } from './DownloadTools'

const TONE: Record<DownloadJob['status'], 'neutral' | 'blue' | 'green' | 'red'> = {
  queued: 'neutral',
  running: 'blue',
  succeeded: 'green',
  failed: 'red',
  expired: 'neutral',
}

/** Background zips (big selections, EAN lists, "download everything"). Polls while one is running. */
export function DownloadsScreen() {
  const { t, i18n } = useTranslation()
  const jobs = useDownloadJobs()
  const lang = i18n.language
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('portal.jobs.title')}</h1>
        <p className="mt-1 max-w-prose text-sm text-stone-600">{t('portal.jobs.intro')}</p>
      </div>
      {jobs.isPending ? (
        <Loading />
      ) : jobs.isError ? (
        <ErrorNote error={jobs.error} />
      ) : jobs.data.items.length === 0 ? (
        <EmptyState title={t('portal.jobs.emptyTitle')}>{t('portal.jobs.empty')}</EmptyState>
      ) : (
        <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
          {jobs.data.items.map((j) => {
            const pct = j.progress.total ? Math.round((j.progress.done / j.progress.total) * 100) : null
            return (
              <li key={j.id} className="flex flex-wrap items-center gap-4 px-4 py-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium">
                    {t(`portal.jobs.source.${j.source}`)} · {t(`portal.variant.${j.variant}`)}
                  </p>
                  <p className="text-xs text-stone-500">
                    {formatRelative(j.created_at, lang)}
                    {j.files != null && ` · ${t('portal.tile.images', { count: j.files })}`}
                    {j.bytes != null && ` · ${formatBytes(j.bytes, lang)}`}
                    {j.expires_at && j.status === 'succeeded' && ` · ${t('portal.jobs.expires', { date: formatDate(j.expires_at, lang) })}`}
                  </p>
                  {(j.status === 'running' || j.status === 'queued') && (
                    <div className="h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-stone-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? undefined} aria-label={t('portal.jobs.progress')}>
                      <div className="h-full bg-accent transition-all" style={{ width: `${pct ?? 5}%` }} />
                    </div>
                  )}
                  {j.error && <p className="text-xs text-red-700">{j.error}</p>}
                </div>
                <Badge tone={TONE[j.status]}>{t(`portal.jobs.status.${j.status}`)}</Badge>
                {j.status === 'succeeded' && (
                  <DownloadButton variant="primary" size="sm" path={`/admin/api/portal/download-jobs/${encodeURIComponent(j.id)}/file`} fallbackName="download.zip">
                    {t('portal.jobs.download')}
                  </DownloadButton>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
