import { useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import type { DownloadEvent, Stats } from '../../api/types'
import { formatDate, formatNumber, formatRelative } from '../../lib/format'
import { localized } from '../../lib/localized'
import { statEventsQuery, statsQuery } from '../../queries/admin'
import { Loading, PageHeader, Section, Segmented } from '../../ui/controls'
import { EmptyState, ErrorNote, LoadMore } from '../../ui/feedback'

type Days = 7 | 30 | 90 | 365

export function EventLine({ event: e }: { event: DownloadEvent }) {
  const { t, i18n } = useTranslation()
  return (
    <li className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="min-w-0">
        <span className="block truncate">
          <span className="font-medium">{e.retailer_name ?? e.actor_name ?? t('stats.unknown')}</span>{' '}
          <span className="text-stone-600">{t(`stats.kind.${e.kind}`, { defaultValue: t('stats.unknown') })}</span>
          {!!e.files && e.files > 1 && <span className="text-stone-500"> · {t('portal.tile.images', { count: e.files })}</span>}
          {e.variant && <span className="text-stone-500"> · {t(`portal.variant.${e.variant}`, { defaultValue: e.variant })}</span>}
        </span>
        <span className="block text-xs text-stone-500">{e.actor_type === 'api_client' ? t('stats.viaApi') : t('stats.viaPortal')}</span>
      </span>
      <time dateTime={e.at} className="shrink-0 text-xs text-stone-500" title={formatDate(e.at, i18n.language, true)}>
        {formatRelative(e.at, i18n.language)}
      </time>
    </li>
  )
}

function Chart({ stats }: { stats: Stats }) {
  const { t, i18n } = useTranslation()
  const max = Math.max(1, ...stats.by_day.map((d) => d.images))
  return (
    <figure className="space-y-2">
      <div className="flex h-40 items-end gap-px" aria-hidden="true">
        {stats.by_day.map((d) => (
          <div key={d.date} className="flex-1 rounded-t bg-accent/80 hover:bg-accent" style={{ height: `${Math.max(2, (d.images / max) * 100)}%` }} title={`${formatDate(d.date, i18n.language)}: ${d.images}`} />
        ))}
      </div>
      <figcaption className="text-xs text-stone-500">{t('stats.chartCaption')}</figcaption>
      <table className="sr-only">
        <caption>{t('stats.chartCaption')}</caption>
        <tbody>
          {stats.by_day.map((d) => (
            <tr key={d.date}>
              <th>{formatDate(d.date, i18n.language)}</th>
              <td>{d.downloads}</td>
              <td>{d.images}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

export function StatsScreen() {
  const { t, i18n } = useTranslation()
  const [days, setDays] = useState<Days>(30)
  const stats = useQuery(statsQuery(days))
  const events = useInfiniteQuery(statEventsQuery({}))
  const lang = i18n.language
  const tiles = stats.data
    ? [
        [t('stats.downloads'), stats.data.totals.downloads],
        [t('stats.images'), stats.data.totals.images],
        [t('stats.csv'), stats.data.totals.csv_exports],
        [t('stats.api'), stats.data.totals.api_downloads],
        [t('stats.activeRetailers'), stats.data.totals.active_retailers],
      ]
    : []
  return (
    <div className="space-y-6">
      <PageHeader
        title={t('stats.title')}
        description={t('stats.intro')}
        actions={
          <Segmented<`${Days}`>
            label={t('stats.period')}
            value={`${days}`}
            onChange={(v) => setDays(Number(v) as Days)}
            options={(['7', '30', '90', '365'] as const).map((d) => ({ value: d, label: t('stats.days', { count: Number(d) }) }))}
          />
        }
      />
      {stats.isPending ? (
        <Loading />
      ) : stats.isError ? (
        <ErrorNote error={stats.error} onRetry={() => void stats.refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {tiles.map(([label, value]) => (
              <div key={label} className="card p-4">
                <p className="text-xs font-medium text-stone-500">{label}</p>
                <p className="mt-1 text-2xl font-semibold tabular">{formatNumber(value as number, lang)}</p>
              </div>
            ))}
          </div>
          <Section title={t('stats.perDay')}>
            <Chart stats={stats.data} />
          </Section>
          <div className="grid gap-6 lg:grid-cols-2">
            <Section title={t('stats.topRetailers')}>
              {stats.data.top_retailers.length === 0 ? (
                <p className="text-sm text-stone-500">{t('stats.none')}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-stone-500">
                    <tr>
                      <th className="py-1 font-medium">{t('fields.retailer')}</th>
                      <th className="py-1 text-right font-medium">{t('stats.downloads')}</th>
                      <th className="py-1 text-right font-medium">{t('stats.images')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {stats.data.top_retailers.map((r) => (
                      <tr key={r.retailer_id}>
                        <td className="py-1.5">
                          <Link to="/admin/retailers/$id" params={{ id: r.retailer_id }} className="hover:underline">
                            {r.name}
                          </Link>
                        </td>
                        <td className="py-1.5 text-right tabular">{formatNumber(r.downloads, lang)}</td>
                        <td className="py-1.5 text-right tabular">{formatNumber(r.images, lang)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>
            <Section title={t('stats.topProducts')}>
              {stats.data.top_products.length === 0 ? (
                <p className="text-sm text-stone-500">{t('stats.none')}</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-stone-100">
                    {stats.data.top_products.map((p) => (
                      <tr key={p.product_id}>
                        <td className="py-1.5 font-mono text-xs text-stone-500">{p.style_number}</td>
                        <td className="py-1.5">{localized(p.name, lang)}</td>
                        <td className="py-1.5 text-right tabular">{formatNumber(p.downloads, lang)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>
          </div>
        </>
      )}
      <Section title={t('stats.log')} description={t('stats.logHint')}>
        {events.isPending ? (
          <Loading />
        ) : (events.data?.pages[0]?.items.length ?? 0) === 0 ? (
          <EmptyState title={t('dashboard.noActivity')}>{t('dashboard.noActivityHint')}</EmptyState>
        ) : (
          <>
            <ul className="divide-y divide-stone-100">{events.data!.pages.flatMap((p) => p.items).map((e) => <EventLine key={e.id} event={e} />)}</ul>
            <LoadMore hasNext={!!events.hasNextPage} fetching={events.isFetchingNextPage} onMore={() => void events.fetchNextPage()} />
          </>
        )}
      </Section>
    </div>
  )
}
