import { useEffect, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { countryName, formatRelative } from '../../lib/format'
import { accessRequestsQuery, retailersQuery } from '../../queries/admin'
import { Badge, Loading, PageHeader, buttonClass, cx } from '../../ui/controls'
import { EmptyState, ErrorNote, LoadMore, Notice } from '../../ui/feedback'
import { IconPlus, IconSearch } from '../../ui/icons'

export function RetailersScreen() {
  const { t, i18n } = useTranslation()
  const search = useSearch({ from: '/admin/retailers' })
  const navigate = useNavigate({ from: '/admin/retailers' })
  const retailers = useInfiniteQuery(retailersQuery(search))
  const pending = useInfiniteQuery(accessRequestsQuery('pending'))
  const [q, setQ] = useState(search.q ?? '')
  useEffect(() => {
    if ((search.q ?? '') === q.trim()) return
    const id = setTimeout(() => void navigate({ search: (s) => ({ ...s, q: q.trim() || undefined }), replace: true }), 300)
    return () => clearTimeout(id)
  }, [q, search.q, navigate])
  const items = retailers.data?.pages.flatMap((p) => p.items) ?? []
  const pendingCount = pending.data?.pages[0]?.items.length ?? 0
  const lang = i18n.language
  return (
    <div className="space-y-5">
      <PageHeader
        title={t('retailers.title')}
        description={t('retailers.intro')}
        actions={
          <Link to="/admin/retailers/new" className={buttonClass('primary')}>
            <IconPlus size={16} />
            {t('retailers.add')}
          </Link>
        }
      />
      {pendingCount > 0 && (
        <Notice>
          {t('retailers.pending', { count: pendingCount })}{' '}
          <Link to="/admin/requests" className="font-medium underline">
            {t('dashboard.review')}
          </Link>
        </Notice>
      )}
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
          <input type="search" className="input pl-10" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('retailers.search')} aria-label={t('retailers.search')} />
        </div>
        <select className="input w-auto" aria-label={t('retailers.status')} value={search.status ?? ''} onChange={(e) => void navigate({ search: (s) => ({ ...s, status: (e.target.value || undefined) as 'active' | 'blocked' | undefined }), replace: true })}>
          <option value="">{t('retailers.allStatuses')}</option>
          <option value="active">{t('retailers.active')}</option>
          <option value="blocked">{t('retailers.blocked')}</option>
        </select>
      </div>
      {retailers.isPending ? (
        <Loading />
      ) : retailers.isError ? (
        <ErrorNote error={retailers.error} />
      ) : items.length === 0 ? (
        <EmptyState title={t('retailers.emptyTitle')}>{t('retailers.empty')}</EmptyState>
      ) : (
        <ul className={cx('divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white', retailers.isPlaceholderData && 'opacity-60')}>
          {items.map((r) => (
            <li key={r.id}>
              <Link to="/admin/retailers/$id" params={{ id: r.id }} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-stone-50">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.name}</p>
                  <p className="text-xs text-stone-500">
                    {[r.reference && t('retailers.ref', { ref: r.reference }), countryName(r.country, lang), t('retailers.accounts', { count: r.user_count ?? 0 }), t('retailers.keys', { count: r.api_client_count ?? 0 })].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <span className="text-xs text-stone-500">{r.last_activity_at ? formatRelative(r.last_activity_at, lang) : t('retailers.noActivity')}</span>
                {r.status === 'blocked' && <Badge tone="red">{t('retailers.blocked')}</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <LoadMore hasNext={!!retailers.hasNextPage} fetching={retailers.isFetchingNextPage} onMore={() => void retailers.fetchNextPage()} />
    </div>
  )
}
