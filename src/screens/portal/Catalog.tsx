import { useEffect, useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import type { PortalFilter } from '../../api/types'
import { formatNumber } from '../../lib/format'
import { usePref, sinceDays } from '../../lib/prefs'
import { facetsQuery, fetchAllProductIds, portalProductsQuery, useSelection, useSetSelection, useViewer } from '../../queries/portal'
import type { CatalogSearch } from '../../router'
import { Button, Loading, Segmented, cx } from '../../ui/controls'
import { EmptyState, ErrorNote, LoadMore, Notice } from '../../ui/feedback'
import { IconDownload, IconSearch } from '../../ui/icons'
import { BackgroundZipDialog, CsvButton } from './DownloadTools'
import { FilterPanel, activeFilterCount } from './Filters'
import { ProductTile } from './ProductTile'

export function toFilter(s: CatalogSearch): PortalFilter {
  const { new: days, ...rest } = s
  return { ...rest, updated_since: days ? sinceDays(Number(days)) : undefined }
}

const MAX_SELECTION = 1000

export function CatalogScreen() {
  const { t, i18n } = useTranslation()
  const search = useSearch({ from: '/portal/' })
  const navigate = useNavigate({ from: '/' })
  const filter = toFilter(search)
  const products = useInfiniteQuery(portalProductsQuery(filter))
  const facets = useQuery(facetsQuery(filter))
  const viewer = useViewer()
  const selection = useSelection()
  const setSelection = useSetSelection()
  const [dense, setDense] = usePref<'comfortable' | 'compact'>('obx.density', ['comfortable', 'compact'], 'comfortable')
  const [showFilters, setShowFilters] = useState(false)
  const [zipOpen, setZipOpen] = useState(false)
  const [q, setQ] = useState(search.q ?? '')

  // Keep the URL (the source of truth for filters) in step with the search box, debounced.
  useEffect(() => {
    if ((search.q ?? '') === q.trim()) return
    const id = setTimeout(() => void navigate({ search: (s: CatalogSearch) => ({ ...s, q: q.trim() || undefined }), replace: true }), 300)
    return () => clearTimeout(id)
  }, [q, search.q, navigate])

  const selected = new Set(selection.data?.product_ids ?? [])
  const items = products.data?.pages.flatMap((p) => p.items) ?? []
  const total = products.data?.pages[0]?.total ?? 0
  const max = viewer.data?.limits?.selection_max_products ?? MAX_SELECTION

  const selectAll = useMutation({
    mutationFn: async () => {
      const ids = await fetchAllProductIds(filter, max)
      const merged = [...new Set([...selected, ...ids])].slice(0, max)
      await setSelection.mutateAsync(merged)
      return merged.length
    },
  })

  const toggle = (id: string) => {
    const next = selected.has(id) ? [...selected].filter((x) => x !== id) : [...selected, id]
    if (next.length > max) return
    setSelection.mutate(next)
  }

  const update = (next: CatalogSearch) => void navigate({ search: next, replace: true })
  const nFilters = activeFilterCount(search)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 basis-72">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('portal.catalog.searchPlaceholder')}
            aria-label={t('portal.catalog.search')}
            className="input h-11 pl-10"
          />
        </div>
        <Button className="lg:hidden" aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)}>
          {t('portal.filters.title')}
          {nFilters > 0 && <span className="rounded-full bg-accent px-1.5 text-xs text-accent-contrast">{nFilters}</span>}
        </Button>
        <Segmented
          label={t('portal.catalog.density')}
          value={dense}
          onChange={setDense}
          options={[
            { value: 'comfortable', label: t('portal.catalog.comfortable') },
            { value: 'compact', label: t('portal.catalog.compact') },
          ]}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[14rem_1fr]">
        <aside className={cx('lg:block', showFilters ? 'block' : 'hidden')} aria-label={t('portal.filters.title')}>
          <FilterPanel facets={facets.data} search={search} onChange={update} />
          {nFilters > 0 && (
            <button type="button" className="mt-4 text-sm text-stone-600 underline underline-offset-2" onClick={() => update({ q: search.q })}>
              {t('portal.filters.clear')}
            </button>
          )}
        </aside>

        <section aria-labelledby="results-heading" className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 id="results-heading" className="text-sm text-stone-600" aria-live="polite">
              {products.isPending ? t('common.loading') : t('portal.catalog.count', { count: total, formatted: formatNumber(total, i18n.language) })}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => selectAll.mutate()} loading={selectAll.isPending} disabled={!total}>
                {t('portal.catalog.selectAll', { count: Math.min(total, max) })}
              </Button>
              <Button size="sm" onClick={() => setZipOpen(true)} disabled={!total}>
                <IconDownload size={16} />
                {t('portal.catalog.downloadAll')}
              </Button>
              <CsvButton path="/admin/api/portal/products/data.csv" query={{ q: filter.q, brand_id: filter.brand_id, updated_since: filter.updated_since }}>
                {t('portal.catalog.csv')}
              </CsvButton>
            </div>
          </div>
          {selectAll.isSuccess && <Notice tone="ok">{t('portal.catalog.selectedAll', { count: selectAll.data })}</Notice>}
          <ErrorNote error={selectAll.error ?? setSelection.error} />
          {total > max && selectAll.isSuccess && <Notice tone="warn">{t('portal.catalog.selectionCap', { max })}</Notice>}

          {products.isPending ? (
            <Loading />
          ) : products.isError ? (
            <ErrorNote error={products.error} />
          ) : items.length === 0 ? (
            <EmptyState title={t('portal.catalog.emptyTitle')}>{nFilters || search.q ? t('portal.catalog.emptyFiltered') : t('portal.catalog.empty')}</EmptyState>
          ) : (
            <ul
              className={cx('grid gap-3 transition-opacity', products.isPlaceholderData && 'opacity-60', dense === 'compact' ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-7' : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4')}
              aria-label={t('portal.catalog.results')}
            >
              {items.map((p) => (
                <li key={p.id}>
                  <ProductTile product={p} dense={dense === 'compact'} selected={selected.has(p.id)} onToggle={() => toggle(p.id)} />
                </li>
              ))}
            </ul>
          )}
          <LoadMore hasNext={!!products.hasNextPage} fetching={products.isFetchingNextPage} onMore={() => void products.fetchNextPage()} />
        </section>
      </div>

      {selected.size > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
          <Link to="/selection" className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-contrast shadow-lg">
            {t('portal.catalog.selectedPill', { count: selected.size })}
          </Link>
        </div>
      )}

      <BackgroundZipDialog
        open={zipOpen}
        onClose={() => setZipOpen(false)}
        title={t('portal.catalog.downloadAllTitle', { count: total })}
        description={t('portal.catalog.downloadAllIntro')}
        input={{ source: 'filter', filter }}
      />
    </div>
  )
}
