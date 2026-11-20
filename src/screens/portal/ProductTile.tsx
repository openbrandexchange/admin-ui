import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { PortalProductSummary } from '../../api/types'
import { useTheme } from '../../lib/branding'
import { localized } from '../../lib/localized'
import type { Density } from '../../lib/theme'
import { portalProductQuery } from '../../queries/portal'
import { cx } from '../../ui/controls'
import { IconCheck, IconEye, IconImage } from '../../ui/icons'

/** Grid columns per density, by the width of the portal (container queries, so the Appearance preview's phone frame lays out as a phone). */
export const GRID: Record<Density, string> = {
  compact: 'grid-cols-3 gap-x-3 gap-y-6 @3xl:grid-cols-4 @5xl:grid-cols-4 @7xl:grid-cols-6',
  comfortable: 'grid-cols-2 gap-x-4 gap-y-8 @3xl:grid-cols-3 @7xl:grid-cols-4',
  editorial: 'grid-cols-1 gap-x-6 gap-y-12 @[30rem]:grid-cols-2 @7xl:grid-cols-3',
}

/**
 * An article in the grid: the image first. Hover (or focus) shows the next image of the same
 * colour; the colour swatches switch the image; "Quick view" opens the essentials in a dialog.
 */
export function ProductTile({
  product,
  selected,
  onToggle,
  density,
  onQuickView,
}: {
  product: PortalProductSummary
  selected: boolean
  onToggle?: () => void
  density: Density
  onQuickView?: () => void
}) {
  const { t, i18n } = useTranslation()
  const qc = useQueryClient()
  const theme = useTheme()
  const name = localized(product.name, i18n.language)
  const [colour, setColour] = useState<string | null>(null)
  // The article's images arrive with its detail, fetched when the pointer or focus first comes near.
  const detail = useQuery({ ...portalProductQuery(product.id), enabled: false })
  const warm = () => void qc.prefetchQuery({ ...portalProductQuery(product.id), staleTime: 60_000 })
  const activeColour = colour ?? product.colors[0]?.code ?? null
  const swatch = product.colors.find((c) => c.code === colour)
  const first = (colour && swatch?.thumb_url) || product.thumb_url
  const sameColour = detail.data?.assets.filter((a) => (a.color_code ?? '') === (activeColour ?? '')).sort((a, b) => a.position - b.position) ?? []
  const second = sameColour[1]?.renditions.thumb.url ?? null
  const compact = density === 'compact'
  const boxed = theme.cardStyle !== 'plain'
  const shown = product.colors.slice(0, compact ? 4 : 6)

  return (
    <article className={cx('group relative flex h-full flex-col', boxed && 'card overflow-hidden', selected && 'ring-2 ring-accent ring-offset-2 ring-offset-stone-50')} onPointerEnter={warm} onFocus={warm}>
      <div className={cx('relative aspect-[4/5] overflow-hidden', boxed ? 'bg-[var(--img-bg)]' : 'img-frame')}>
        <Link to="/products/$id" params={{ id: product.id }} className="block size-full" aria-label={`${name} · ${product.style_number}`}>
          {first ? (
            <>
              <img src={first} alt="" loading="lazy" decoding="async" className="product-img size-full transition-transform duration-700 ease-out group-hover:scale-[1.03] motion-reduce:group-hover:scale-100" />
              {second && !colour && (
                <img src={second} alt="" loading="lazy" decoding="async" className="product-img absolute inset-0 size-full opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-within:opacity-100" />
              )}
            </>
          ) : (
            <div className="grid size-full place-items-center text-stone-400">
              <IconImage size={28} />
            </div>
          )}
        </Link>
        {onToggle && (
          <label
            className={cx(
              'absolute left-2 top-2 grid size-9 cursor-pointer place-items-center rounded-full border shadow-sm backdrop-blur transition-opacity has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent',
              // Out of the way until the pointer is on the tile (always there on touch screens and once selected).
              selected ? 'border-accent bg-accent text-accent-contrast' : 'border-stone-300 bg-white/90 text-transparent hover:text-stone-500 @5xl:opacity-0 @5xl:group-hover:opacity-100 @5xl:has-[:focus-visible]:opacity-100 [@media(hover:none)]:opacity-100',
            )}
          >
            <input type="checkbox" className="sr-only" checked={selected} onChange={onToggle} aria-label={t('portal.tile.select', { name: `${product.style_number} ${name}` })} />
            <IconCheck size={18} />
          </label>
        )}
        {onQuickView && !compact && (
          <button
            type="button"
            onClick={onQuickView}
            className="absolute inset-x-3 bottom-3 inline-flex h-10 items-center justify-center gap-2 rounded-control bg-white/95 text-sm font-medium text-stone-900 shadow-sm backdrop-blur transition-all duration-200 hover:bg-white focus-visible:opacity-100 @5xl:translate-y-2 @5xl:opacity-0 @5xl:group-hover:translate-y-0 @5xl:group-hover:opacity-100 @5xl:focus-visible:translate-y-0 [@media(hover:none)]:translate-y-0 [@media(hover:none)]:opacity-100"
          >
            <IconEye size={16} />
            {t('portal.tile.quickView')}
            <span className="sr-only">: {name}</span>
          </button>
        )}
      </div>
      <div className={cx('flex flex-1 flex-col', boxed ? 'p-3' : 'pt-3', compact ? 'gap-0.5' : 'gap-1')}>
        <h3 className={cx('line-clamp-2 text-stone-900', compact ? 'text-xs font-medium' : density === 'editorial' ? 'display text-xl' : 'text-sm font-medium')}>
          <Link to="/products/$id" params={{ id: product.id }} tabIndex={-1} className="hover:underline hover:underline-offset-4">
            {name}
          </Link>
        </h3>
        <p className={cx('text-stone-500 tabular', compact ? 'text-[11px]' : 'text-xs')}>
          {product.style_number}
          {!compact && product.season && <span> · {product.season}</span>}
        </p>
        {shown.length > 1 && (
          <div role="group" className={cx('flex flex-wrap items-center', compact ? 'mt-1 gap-0.5' : 'mt-2 gap-1')} aria-label={t('portal.tile.colours', { count: product.colors.length })}>
            {shown.map((c) => {
              const label = localized(c.name, i18n.language) || c.code
              return (
                <button
                    key={c.code}
                    type="button"
                    aria-label={t('portal.tile.showColour', { colour: label })}
                    aria-pressed={activeColour === c.code}
                    title={label}
                    onMouseEnter={() => setColour(c.code)}
                    onFocus={() => setColour(c.code)}
                    onClick={() => setColour(c.code)}
                    className="grid size-6 place-items-center rounded-full"
                  >
                    <span
                      className={cx('block overflow-hidden rounded-full border bg-stone-100', compact ? 'size-3.5' : 'size-4.5', activeColour === c.code ? 'border-stone-900 ring-1 ring-stone-900 ring-offset-1 ring-offset-white' : 'border-stone-300')}
                    >
                      {c.thumb_url && <img src={c.thumb_url} alt="" loading="lazy" className="size-full scale-[2.6] object-cover" />}
                    </span>
                </button>
              )
            })}
            {product.colors.length > shown.length && <span className="text-[11px] text-stone-500">+{product.colors.length - shown.length}</span>}
          </div>
        )}
      </div>
    </article>
  )
}
