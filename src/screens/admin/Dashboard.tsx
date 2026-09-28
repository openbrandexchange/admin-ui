import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { formatNumber, formatRelative } from '../../lib/format'
import { accessRequestsQuery, importRunsQuery, ingestTokensQuery, importSourcesQuery, productCountQuery, retailersQuery, settingsQuery, statEventsQuery, statsQuery } from '../../queries/admin'
import { useSession } from '../../queries/session'
import { Loading, Section, cx } from '../../ui/controls'
import { EmptyState } from '../../ui/feedback'
import { IconCheck } from '../../ui/icons'
import { EventLine } from './Stats'

function Tile({ label, value, to, search, tone }: { label: string; value: number | undefined; to: string; search?: Record<string, string>; tone?: 'amber' }) {
  const { i18n } = useTranslation()
  return (
    <Link to={to} search={search} className="card block p-4 hover:shadow-md">
      <p className="text-xs font-medium text-stone-500">{label}</p>
      <p className={cx('mt-1 text-2xl font-semibold tabular', tone === 'amber' && value ? 'text-amber-700' : 'text-stone-900')}>{value === undefined ? '…' : formatNumber(value, i18n.language)}</p>
    </Link>
  )
}

export function DashboardScreen() {
  const { t, i18n } = useTranslation()
  const session = useSession()
  const total = useQuery(productCountQuery({}))
  const visible = useQuery(productCountQuery({ visibility: 'visible' }))
  const hidden = useQuery(productCountQuery({ visibility: 'hidden' }))
  const pendingFiles = useQuery(productCountQuery({ visibility: 'pending_files' }))
  const requests = useInfiniteQuery(accessRequestsQuery('pending'))
  const retailers = useInfiniteQuery(retailersQuery({}))
  const stats = useQuery(statsQuery(30))
  const events = useInfiniteQuery(statEventsQuery({}))
  const tokens = useQuery(ingestTokensQuery)
  const sources = useQuery(importSourcesQuery)
  const runs = useInfiniteQuery(importRunsQuery)
  const settings = useQuery(settingsQuery)

  const pending = requests.data?.pages[0]?.items ?? []
  const steps = [
    { done: (total.data ?? 0) > 0, label: t('dashboard.step.import'), to: '/admin/imports' },
    { done: !!settings.data?.branding?.logo_url || !!settings.data?.branding?.welcome_text, label: t('dashboard.step.look'), to: '/admin/settings' },
    { done: (retailers.data?.pages[0]?.items.length ?? 0) > 0, label: t('dashboard.step.retailer'), to: '/admin/retailers' },
    {
      done: (tokens.data?.items.some((x) => x.status === 'active') ?? false) || (sources.data?.items.length ?? 0) > 0,
      label: t('dashboard.step.automate'),
      to: '/admin/automation',
    },
  ]
  const lastRun = runs.data?.pages[0]?.items[0]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('dashboard.hello', { name: session.data?.user?.name?.split(' ')[0] ?? '' })}</h1>
        <p className="mt-1 text-sm text-stone-600">{t('dashboard.intro')}</p>
      </div>

      {steps.some((s) => !s.done) && (
        <Section title={t('dashboard.getStarted')} description={t('dashboard.getStartedHint')}>
          <ol className="grid gap-2 sm:grid-cols-2">
            {steps.map((s, i) => (
              <li key={s.to}>
                <Link to={s.to} className={cx('flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm', s.done ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-stone-200 hover:bg-stone-50')}>
                  <span className={cx('grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold', s.done ? 'bg-emerald-600 text-white' : 'bg-stone-200 text-stone-700')}>
                    {s.done ? <IconCheck size={14} /> : i + 1}
                  </span>
                  {s.label}
                </Link>
              </li>
            ))}
          </ol>
        </Section>
      )}

      <section aria-labelledby="health" className="space-y-3">
        <h2 id="health" className="text-sm font-semibold text-stone-700">
          {t('dashboard.health')}
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile label={t('dashboard.products')} value={total.data} to="/admin/catalog" />
          <Tile label={t('dashboard.visible')} value={visible.data} to="/admin/catalog" search={{ visibility: 'visible' }} />
          <Tile label={t('dashboard.waitingImages')} value={pendingFiles.data} to="/admin/catalog" search={{ visibility: 'pending_files' }} tone="amber" />
          <Tile label={t('dashboard.hidden')} value={hidden.data} to="/admin/catalog" search={{ visibility: 'hidden' }} />
        </div>
        {lastRun && (
          <p className="text-xs text-stone-500">
            {t('dashboard.lastImport', { when: formatRelative(lastRun.created_at, i18n.language) })}{' '}
            <Link to="/admin/imports/$id" params={{ id: lastRun.id }} className="underline underline-offset-2">
              {t(`imports.status.${lastRun.status}`)}
              {lastRun.counts.errors > 0 && ` · ${t('imports.errorsCount', { count: lastRun.counts.errors })}`}
            </Link>
          </p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title={t('dashboard.requests')}
          actions={
            <Link to="/admin/requests" className="text-sm text-stone-600 underline underline-offset-2">
              {t('common.viewAll')}
            </Link>
          }
        >
          {requests.isPending ? (
            <Loading />
          ) : pending.length === 0 ? (
            <p className="text-sm text-stone-500">{t('dashboard.noRequests')}</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {pending.slice(0, 5).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{r.retailer.name}</span>
                    <span className="block truncate text-xs text-stone-500">
                      {r.contact.name} · {formatRelative(r.created_at, i18n.language)}
                    </span>
                  </span>
                  <Link to="/admin/requests" className="shrink-0 text-sm font-medium text-accent-strong underline underline-offset-2">
                    {t('dashboard.review')}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title={t('dashboard.activity')}
          description={stats.data ? t('dashboard.activitySummary', { downloads: stats.data.totals.downloads, images: stats.data.totals.images, retailers: stats.data.totals.active_retailers }) : undefined}
          actions={
            <Link to="/admin/stats" className="text-sm text-stone-600 underline underline-offset-2">
              {t('common.viewAll')}
            </Link>
          }
        >
          {events.isPending ? (
            <Loading />
          ) : (events.data?.pages[0]?.items.length ?? 0) === 0 ? (
            <EmptyState title={t('dashboard.noActivity')}>{t('dashboard.noActivityHint')}</EmptyState>
          ) : (
            <ul className="divide-y divide-stone-100">
              {events.data!.pages[0].items.slice(0, 8).map((e) => (
                <EventLine key={e.id} event={e} />
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  )
}
