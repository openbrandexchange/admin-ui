import { useEffect, useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import type { PortalFilter, PortalProductSummary } from '../../api/types'
import { usePreview, useTheme } from '../../lib/branding'
import { formatNumber } from '../../lib/format'
import { usePref, sinceDays } from '../../lib/prefs'
import type { Density } from '../../lib/theme'
import { facetsQuery, fetchAllProductIds, portalProductsQuery, useSelection, useSetSelection, useViewer } from '../../queries/portal'
import { catalogSearch, type CatalogSearch } from '../../router'
import { Button, Loading, Segmented, cx } from '../../ui/controls'
import { Dialog, EmptyState, ErrorNote, LoadMore, Notice } from '../../ui/feedback'
import { IconDownload, IconSearch, IconX } from '../../ui/icons'
import { BackgroundZipDialog, CsvButton } from './DownloadTools'
import { ActiveFilters, FilterPanel, activeFilterCount } from './Filters'
import { GRID, ProductTile } from './ProductTile'
import { QuickView } from './QuickView'

export function toFilter(s: CatalogSearch): PortalFilter {
  const { new: days, ...rest } = s
  return { ...rest, updated_since: days ? sinceDays(Number(days)) : undefined }
}

const MAX_SELECTION = 1000
const DENSITIES = ['compact', 'comfortable', 'editorial'] as const

/** The selection as a set, with a toggle that respects the selection's limit. */
export function useSelectionToggle() {
  const viewer = useViewer()
  const selection = useSelection()
  const setSelection = useSetSelection()
  const selected = new Set(selection.data?.product_ids ?? [])
  const max = viewer.data?.limits?.selection_max_products ?? MAX_SELECTION
  const [full, setFull] = useState(false)
  const toggle = (id: string) => {
    const next = selected.has(id) ? [...selected].filter((x) => x !== id) : [...selected, id]
    setFull(next.length > max)
    if (next.length > max) return
    setSelection.mutate(next)
  }
  return { selected, toggle, full, max, error: setSelection.error, setSelection }
}

export function CatalogScreen() {
  const { t, i18n } = useTranslation()
  // The catalogue answers at /catalog and, without start page blocks, at / (same search).
  const search = catalogSearch(useSearch({ strict: false }) as Record<string, unknown>)
  const navigate = useNavigate()
  const preview = usePreview()
  const theme = useTheme()
  const filter = toFilter(search)
  const products = useInfiniteQuery(portalProductsQuery(filter))
  const facets = useQuery(facetsQuery(filter))
  const { selected, toggle, full, max, error: toggleError, setSelection } = useSelectionToggle()
  const [pref, setPref] = usePref<Density>('obx.density', DENSITIES, theme.density)
  // The brand's choice in the preview; the retailer's own choice in the portal.
  const density = preview ? theme.density : pref
  const [showFilters, setShowFilters] = useState(false)
  const [zipOpen, setZipOpen] = useState(false)
  const [quick, setQuick] = useState<PortalProductSummary | null>(null)
  const [q, setQ] = useState(search.q ?? '')

  // Keep the URL (the source of truth for filters) in step with the search box, debounced.
  useEffect(() => {
    if ((search.q ?? '') === q.trim()) return
    const id = setTimeout(() => void navigate({ to: '.', search: (s: CatalogSearch) => ({ ...s, q: q.trim() || undefined }), replace: true }), 300)
    return () => clearTimeout(id)
  }, [q, search.q, navigate])

  const items = products.data?.pages.flatMap((p) => p.items) ?? []
  const total = products.data?.pages[0]?.total ?? 0

  const selectAll = useMutation({
    mutationFn: async () => {
      const ids = await fetchAllProductIds(filter, max)
      const merged = [...new Set([...selected, ...ids])].slice(0, max)
      await setSelection.mutateAsync(merged)
      return merged.length
    },
  })

  const update = (next: CatalogSearch) => void navigate({ to: '.', search: next, replace: true })
  const nFilters = activeFilterCount(search)
  const clear = () => update({ q: search.q })

  const panel = <FilterPanel facets={facets.data} search={search} onChange={update} />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 space-y-1">
          <h1 className="display text-3xl text-stone-900 @[40rem]:text-4xl">{t('portal.catalog.title')}</h1>
          <p id="results-heading" tabIndex={-1} className="text-sm text-stone-600 outline-none" aria-live="polite">
            {products.isPending ? t('common.loading') : t('portal.catalog.count', { count: total, formatted: formatNumber(total, i18n.language) })}
          </p>
        </div>
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

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 basis-64">
          <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500" size={18} />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('portal.catalog.searchPlaceholder')}
            aria-label={t('portal.catalog.search')}
            className="input h-11 pl-11"
          />
        </div>
        <Button className="@5xl:hidden" aria-haspopup="dialog" onClick={() => setShowFilters(true)}>
          {t('portal.filters.title')}
          {nFilters > 0 && <span className="rounded-full bg-accent px-1.5 text-xs text-accent-contrast">{nFilters}</span>}
        </Button>
        <Segmented
          label={t('portal.catalog.density')}
          value={density}
          onChange={setPref}
          options={[
            { value: 'compact', label: t('portal.catalog.compact') },
            { value: 'comfortable', label: t('portal.catalog.comfortable') },
            { value: 'editorial', label: t('portal.catalog.editorial') },
          ]}
        />
      </div>

      <div className="grid gap-8 @5xl:grid-cols-[15rem_1fr] @7xl:gap-12">
        {/* Wide screens: the filters stay in view while the grid scrolls. */}
        <aside id="filters" tabIndex={-1} className="hidden outline-none @5xl:sticky @5xl:top-24 @5xl:block @5xl:max-h-[calc(100dvh-7rem)] @5xl:self-start @5xl:overflow-y-auto @5xl:pr-2" aria-label={t('portal.filters.title')}>
          {panel}
        </aside>

        <section aria-labelledby="results-heading" className="min-w-0 space-y-5">
          <ActiveFilters facets={facets.data} search={search} onChange={update} onClear={clear} />
          {selectAll.isSuccess && <Notice tone="ok">{t('portal.catalog.selectedAll', { count: selectAll.data })}</Notice>}
          <ErrorNote error={selectAll.error ?? toggleError} />
          {total > max && selectAll.isSuccess && <Notice tone="warn">{t('portal.catalog.selectionCap', { max })}</Notice>}
          {full && <Notice tone="warn">{t('portal.catalog.selectionFull', { max })}</Notice>}

          {products.isPending ? (
            <Loading />
          ) : products.isError ? (
            <ErrorNote error={products.error} onRetry={() => void products.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState title={t('portal.catalog.emptyTitle')}>{nFilters || search.q ? t('portal.catalog.emptyFiltered') : t('portal.catalog.empty')}</EmptyState>
          ) : (
            <ul className={cx('grid transition-opacity', products.isPlaceholderData && 'opacity-60', GRID[density])} aria-label={t('portal.catalog.results')}>
              {items.map((p) => (
                <li key={p.id}>
                  <ProductTile product={p} density={density} selected={selected.has(p.id)} onToggle={() => toggle(p.id)} onQuickView={() => setQuick(p)} />
                </li>
              ))}
            </ul>
          )}
          <LoadMore hasNext={!!products.hasNextPage} fetching={products.isFetchingNextPage} onMore={() => void products.fetchNextPage()} />
        </section>
      </div>

      {selected.size > 0 && (
        <div className="pointer-events-none sticky bottom-4 z-30 flex justify-center">
          <Link to="/selection" className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-contrast shadow-lg">
            {t('portal.catalog.selectedPill', { count: selected.size })}
          </Link>
        </div>
      )}

      {/* Narrow screens: the same filters in a sheet. */}
      <Dialog
        open={showFilters}
        onClose={() => setShowFilters(false)}
        title={t('portal.filters.title')}
        size="sheet"
        footer={
          <>
            {nFilters > 0 && (
              <Button onClick={clear}>
                <IconX size={16} />
                {t('portal.filters.clear')}
              </Button>
            )}
            <Button
              variant="primary"
              onClick={() => {
                setShowFilters(false)
                const h = document.getElementById('results-heading')
                h?.focus({ preventScroll: true })
                h?.scrollIntoView({ block: 'start' })
              }}
            >
              {t('portal.filters.showCount', { count: total })}
            </Button>
          </>
        }
      >
        {panel}
      </Dialog>

      <QuickView summary={quick} onClose={() => setQuick(null)} selected={!!quick && selected.has(quick.id)} onToggle={() => quick && toggle(quick.id)} />

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
