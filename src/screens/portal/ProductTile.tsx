import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import type { PortalProductSummary } from '../../api/types'
import { localized } from '../../lib/localized'
import { cx } from '../../ui/controls'
import { IconCheck, IconImage } from '../../ui/icons'

export function ProductTile({ product, selected, onToggle, dense }: { product: PortalProductSummary; selected: boolean; onToggle: () => void; dense: boolean }) {
  const { t, i18n } = useTranslation()
  const name = localized(product.name, i18n.language)
  return (
    <article className={cx('group relative overflow-hidden rounded-xl border bg-white shadow-xs transition-shadow hover:shadow-md', selected ? 'border-accent ring-2 ring-accent' : 'border-stone-200')}>
      <Link to="/products/$id" params={{ id: product.id }} className="block">
        <div className="aspect-[4/5] bg-stone-100">
          {product.thumb_url ? (
            <img src={product.thumb_url} alt="" loading="lazy" decoding="async" className="size-full object-contain" />
          ) : (
            <div className="grid size-full place-items-center text-stone-400">
              <IconImage size={28} />
            </div>
          )}
        </div>
        <div className={cx('space-y-0.5', dense ? 'p-2' : 'p-3')}>
          <p className="font-mono text-xs text-stone-500">{product.style_number}</p>
          <h3 className={cx('line-clamp-2 font-medium text-stone-900', dense ? 'text-xs' : 'text-sm')}>{name}</h3>
          {!dense && (
            <p className="text-xs text-stone-500">
              {product.brand.name} · {t('portal.tile.colours', { count: product.colors.length })} · {t('portal.tile.images', { count: product.image_count })}
            </p>
          )}
        </div>
      </Link>
      <label className={cx('absolute left-2 top-2 grid size-9 cursor-pointer place-items-center rounded-lg border bg-white/95 shadow-sm', selected ? 'border-accent bg-accent text-accent-contrast' : 'border-stone-300 text-transparent hover:text-stone-400')}>
        <input type="checkbox" className="sr-only" checked={selected} onChange={onToggle} aria-label={t('portal.tile.select', { name: `${product.style_number} ${name}` })} />
        <IconCheck size={18} />
      </label>
    </article>
  )
}
