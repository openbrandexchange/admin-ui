import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { Asset, PortalProductSummary } from '../../api/types'
import { localized } from '../../lib/localized'
import { humanize } from '../../lib/prefs'
import { portalProductQuery } from '../../queries/portal'
import { Button, Loading, buttonClass, cx } from '../../ui/controls'
import { Dialog, ErrorNote } from '../../ui/feedback'
import { IconCheck, IconImage, IconPlus } from '../../ui/icons'
import { SizesTable } from '../shared/ArticleData'
import { byColour } from './Gallery'

/** The essentials of an article without leaving the grid: images, key data, sizes and EANs. */
export function QuickView({ summary, onClose, selected, onToggle }: { summary: PortalProductSummary | null; onClose: () => void; selected: boolean; onToggle: () => void }) {
  const { i18n } = useTranslation()
  const name = summary ? localized(summary.name, i18n.language) : ''
  return (
    <Dialog open={!!summary} onClose={onClose} title={name} size="xl" hideTitle>
      {summary && <QuickViewBody key={summary.id} summary={summary} name={name} selected={selected} onToggle={onToggle} onClose={onClose} />}
    </Dialog>
  )
}

function QuickViewBody({ summary, name, selected, onToggle, onClose }: { summary: PortalProductSummary; name: string; selected: boolean; onToggle: () => void; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const product = useQuery(portalProductQuery(summary.id))
  const groups = product.data ? byColour(product.data.assets) : new Map<string, Asset[]>()
  const codes = [...groups.keys()]
  const [colour, setColour] = useState<string | null>(null)
  const current = colour ?? codes[0] ?? ''
  const images = groups.get(current) ?? []
  const [active, setActive] = useState(0)
  const image = images[Math.min(active, Math.max(0, images.length - 1))]
  const colourName = (code: string) => {
    const v = product.data?.variants.find((x) => x.color.code === code)
    return (v && localized(v.color.name, lang)) || code || t('portal.product.allColours')
  }
  const rows = [...(product.data?.variants ?? [])].sort((a, b) => a.color.code.localeCompare(b.color.code)).map((v) => ({ ...v, key: v.id, ean: v.gtin_original ?? v.gtin ?? null }))
  const facts = [
    summary.brand.name,
    summary.item_type && t(`enum.itemType.${summary.item_type}`, { defaultValue: humanize(summary.item_type) }),
    summary.season,
    summary.collection,
  ].filter(Boolean)

  return (
    <div className="grid @container md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="space-y-3 bg-[var(--img-bg)] p-3 md:p-4">
        <div className="relative aspect-[4/5] overflow-hidden">
          {image ? (
            <img src={image.renditions.web.url} alt={localized(image.alt_text, lang) || `${summary.style_number} ${colourName(current)} ${image.position}`} className="product-img size-full" />
          ) : summary.thumb_url ? (
            <img src={summary.thumb_url} alt="" className="product-img size-full" />
          ) : (
            <div className="grid size-full place-items-center text-stone-400">
              <IconImage size={36} />
            </div>
          )}
        </div>
        {images.length > 1 && (
          <ul className="flex gap-2 overflow-x-auto scrollbar-none" aria-label={t('portal.product.images')}>
            {images.map((a, i) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  aria-label={t('portal.product.showImage', { n: a.position })}
                  aria-current={i === active}
                  className={cx('block size-16 overflow-hidden border-2', i === active ? 'border-stone-900' : 'border-transparent opacity-80 hover:opacity-100')}
                >
                  <img src={a.renditions.thumb.url} alt="" loading="lazy" className="product-img size-full" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-5 p-5 md:p-7">
        <div className="space-y-2 pe-10">
          <p className="text-sm text-stone-500 tabular">{summary.style_number}</p>
          <p className="display text-3xl text-stone-900" aria-hidden="true">
            {name}
          </p>
          <p className="text-sm text-stone-600">{facts.join(' · ')}</p>
        </div>
        {codes.length > 1 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-stone-800">{t('portal.product.colours')}</p>
            <div className="flex flex-wrap gap-2">
              {codes.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={c === current}
                  onClick={() => {
                    setColour(c)
                    setActive(0)
                  }}
                  className={cx('h-9 rounded-full border px-3.5 text-sm', c === current ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 bg-white text-stone-800 hover:border-stone-500')}
                >
                  {colourName(c)}
                </button>
              ))}
            </div>
          </div>
        )}
        {product.isPending ? (
          <Loading />
        ) : product.isError ? (
          <ErrorNote error={product.error} onRetry={() => void product.refetch()} />
        ) : (
          <>
            {product.data.description && <p className="line-clamp-4 text-sm leading-relaxed text-stone-700">{localized(product.data.description, lang)}</p>}
            {rows.length > 0 && (
              <div className="max-h-64 overflow-y-auto">
                <SizesTable caption={t('portal.product.sizes')} colourName={colourName} rows={rows} measurements={false} />
              </div>
            )}
          </>
        )}
        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          <Button variant={selected ? 'secondary' : 'primary'} onClick={onToggle}>
            {selected ? <IconCheck size={16} /> : <IconPlus size={16} />}
            {selected ? t('portal.product.inSelection') : t('portal.product.addToSelection')}
          </Button>
          <Link to="/products/$id" params={{ id: summary.id }} className={buttonClass('secondary')} onClick={onClose}>
            {t('portal.tile.openArticle')}
          </Link>
        </div>
      </div>
    </div>
  )
}
