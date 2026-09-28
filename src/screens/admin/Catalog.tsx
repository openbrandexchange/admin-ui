import { useEffect, useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import type { AdminProductSummary } from '../../api/types'
import { formatNumber, formatRelative } from '../../lib/format'
import { localized } from '../../lib/localized'
import { adminProductsQuery, brandsQuery } from '../../queries/admin'
import type { AdminCatalogSearch } from '../../router'
import { Badge, Loading, PageHeader, buttonClass, cx } from '../../ui/controls'
import { EmptyState, ErrorNote, LoadMore } from '../../ui/feedback'
import { IconImage, IconPlus, IconSearch, IconUpload } from '../../ui/icons'

export function StatusBadges({ status, visibility }: { status: string; visibility: string }) {
  const { t } = useTranslation()
  return (
    <span className="flex flex-wrap gap-1">
      {status === 'published' ? <Badge tone="green">{t('catalog.published')}</Badge> : <Badge>{t('catalog.unpublished')}</Badge>}
      {status === 'published' && visibility === 'pending_files' && <Badge tone="amber">{t('catalog.waitingImages')}</Badge>}
      {status === 'published' && visibility === 'hidden' && <Badge tone="amber">{t('catalog.hidden')}</Badge>}
    </span>
  )
}

function Row({ p }: { p: AdminProductSummary }) {
  const { t, i18n } = useTranslation()
  return (
    <li>
      <Link to="/admin/catalog/$externalId" params={{ externalId: p.external_id }} className="flex items-center gap-4 px-4 py-3 hover:bg-stone-50">
        <div className="size-12 shrink-0 overflow-hidden rounded-md bg-stone-100">
          {p.thumb_url ? <img src={p.thumb_url} alt="" loading="lazy" className="size-full object-contain" /> : <IconImage className="m-3 text-stone-400" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            <span className="mr-2 font-mono text-xs text-stone-500">{p.style_number}</span>
            {localized(p.name, i18n.language)}
          </p>
          <p className="text-xs text-stone-500">
            {t('catalog.variants', { count: p.variant_count })} · {t('portal.tile.images', { count: p.asset_count })}
            {!!p.pending_asset_count && ` · ${t('catalog.pendingImages', { count: p.pending_asset_count })}`} · {formatRelative(p.updated_at, i18n.language)}
          </p>
        </div>
        <StatusBadges status={p.status} visibility={p.visibility} />
      </Link>
    </li>
  )
}

export function AdminCatalogScreen() {
  const { t, i18n } = useTranslation()
  const search = useSearch({ from: '/admin/catalog' })
  const navigate = useNavigate({ from: '/admin/catalog' })
  const brands = useQuery(brandsQuery)
  const products = useInfiniteQuery(adminProductsQuery(search))
  const [q, setQ] = useState(search.q ?? '')
  useEffect(() => {
    if ((search.q ?? '') === q.trim()) return
    const id = setTimeout(() => void navigate({ search: (s: AdminCatalogSearch) => ({ ...s, q: q.trim() || undefined }), replace: true }), 300)
    return () => clearTimeout(id)
  }, [q, search.q, navigate])
  const set = (patch: Partial<AdminCatalogSearch>) => void navigate({ search: (s: AdminCatalogSearch) => ({ ...s, ...patch }), replace: true })
  const items = products.data?.pages.flatMap((p) => p.items) ?? []
  const total = products.data?.pages[0]?.total ?? 0
  const filtered = !!(search.q || search.status || search.visibility || search.brand)

  return (
    <div>
      <PageHeader
        title={t('catalog.title')}
        description={t('catalog.intro')}
        actions={
          <>
            <Link to="/admin/imports" className={buttonClass('secondary')}>
              <IconUpload size={16} />
              {t('catalog.import')}
            </Link>
            <Link to="/admin/catalog/new" className={buttonClass('primary')}>
              <IconPlus size={16} />
              {t('catalog.newProduct')}
            </Link>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
          <input type="search" className="input pl-10" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('catalog.searchPlaceholder')} aria-label={t('catalog.search')} />
        </div>
        <select className="input w-auto" value={search.status ?? ''} onChange={(e) => set({ status: (e.target.value || undefined) as AdminCatalogSearch['status'] })} aria-label={t('catalog.filterStatus')}>
          <option value="">{t('catalog.allStatuses')}</option>
          <option value="published">{t('catalog.published')}</option>
          <option value="unpublished">{t('catalog.unpublished')}</option>
        </select>
        <select className="input w-auto" value={search.visibility ?? ''} onChange={(e) => set({ visibility: (e.target.value || undefined) as AdminCatalogSearch['visibility'] })} aria-label={t('catalog.filterVisibility')}>
          <option value="">{t('catalog.anyVisibility')}</option>
          <option value="visible">{t('catalog.visibleToRetailers')}</option>
          <option value="pending_files">{t('catalog.waitingImages')}</option>
          <option value="hidden">{t('catalog.hidden')}</option>
        </select>
        {(brands.data?.items.length ?? 0) > 1 && (
          <select className="input w-auto" value={search.brand ?? ''} onChange={(e) => set({ brand: e.target.value || undefined })} aria-label={t('fields.brand')}>
            <option value="">{t('catalog.allBrands')}</option>
            {brands.data!.items.map((b) => (
              <option key={b.external_id} value={b.external_id}>
                {(b.data as { name?: string }).name ?? b.external_id}
              </option>
            ))}
          </select>
        )}
      </div>
      <p className="mb-2 text-sm text-stone-600" aria-live="polite">
        {!products.isPending && t('portal.catalog.count', { count: total, formatted: formatNumber(total, i18n.language) })}
      </p>
      {products.isPending ? (
        <Loading />
      ) : products.isError ? (
        <ErrorNote error={products.error} onRetry={() => void products.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={filtered ? t('portal.catalog.emptyTitle') : t('catalog.emptyTitle')}
          action={
            !filtered && (
              <Link to="/admin/imports" className={buttonClass('primary')}>
                {t('catalog.import')}
              </Link>
            )
          }
        >
          {filtered ? t('portal.catalog.emptyFiltered') : t('catalog.empty')}
        </EmptyState>
      ) : (
        <ul className={cx('divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white transition-opacity', products.isPlaceholderData && 'opacity-60')}>
          {items.map((p) => (
            <Row key={p.id} p={p} />
          ))}
        </ul>
      )}
      <LoadMore hasNext={!!products.hasNextPage} fetching={products.isFetchingNextPage} onMore={() => void products.fetchNextPage()} />
    </div>
  )
}
