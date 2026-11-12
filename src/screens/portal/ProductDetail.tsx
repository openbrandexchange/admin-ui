import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import type { Asset, ProductDetail } from '../../api/types'
import { countryName, formatDate } from '../../lib/format'
import { localized } from '../../lib/localized'
import { humanize } from '../../lib/prefs'
import { portalProductQuery, useSelection, useSetSelection, useViewer } from '../../queries/portal'
import { Badge, Button, Loading, cx } from '../../ui/controls'
import { EmptyState, ErrorNote, tabListKeys } from '../../ui/feedback'
import { IconCheck, IconChevronLeft, IconImage, IconPlus, IconSparkle } from '../../ui/icons'
import { FeatureList, LabelInfo, MeasurementsTable, SizesTable } from '../shared/ArticleData'
import { DownloadButton, VariantHelp, VariantPicker, useVariant } from './DownloadTools'

export function PortalProductScreen() {
  const { id } = useParams({ from: '/portal/products/$id' })
  const product = useQuery(portalProductQuery(id))
  if (product.isPending) return <Loading />
  if (product.isError)
    return (
      <div className="space-y-4">
        <BackLink />
        <ErrorNote error={product.error} onRetry={() => void product.refetch()} />
      </div>
    )
  return (
    <div className="space-y-6">
      <BackLink />
      <Product product={product.data} />
    </div>
  )
}

function BackLink() {
  const { t } = useTranslation()
  return (
    <Link to="/" className="inline-flex items-center gap-1 text-sm text-stone-600 hover:text-stone-900">
      <IconChevronLeft size={16} />
      {t('portal.product.back')}
    </Link>
  )
}

/** Colour groups in feed order (colour code, then position). */
function byColour(assets: Asset[]) {
  const groups = new Map<string, Asset[]>()
  for (const a of assets) {
    const k = a.color_code ?? ''
    groups.set(k, [...(groups.get(k) ?? []), a])
  }
  for (const list of groups.values()) list.sort((a, b) => a.position - b.position)
  return groups
}

function Product({ product }: { product: ProductDetail }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const viewer = useViewer()
  const selection = useSelection()
  const setSelection = useSetSelection()
  const [variant] = useVariant()
  const groups = byColour(product.assets)
  const colourCodes = [...groups.keys()]
  const [colour, setColour] = useState(colourCodes[0] ?? '')
  const images = groups.get(colour) ?? []
  const [active, setActive] = useState(0)
  const current = images[Math.min(active, images.length - 1)]
  const brand = viewer.data?.brands.find((b) => b.id === product.brand_id)
  const selected = selection.data?.product_ids.includes(product.id) ?? false
  const colourName = (code: string) => {
    const v = product.variants.find((x) => x.color.code === code)
    return (v && localized(v.color.name, lang)) || code || t('portal.product.allColours')
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <section aria-label={t('portal.product.images')} className="min-w-0 space-y-3">
        {colourCodes.length > 1 && (
          <div role="tablist" aria-label={t('portal.product.colours')} className="flex flex-wrap gap-2">
            {colourCodes.map((c) => (
              <button
                key={c}
                type="button"
                role="tab"
                onKeyDown={tabListKeys}
                aria-selected={c === colour}
                onClick={() => {
                  setColour(c)
                  setActive(0)
                }}
                className={cx('rounded-full border px-3 py-1 text-sm', c === colour ? 'border-accent bg-accent-soft font-medium text-accent-strong' : 'border-stone-300 bg-white')}
              >
                {colourName(c)}
              </button>
            ))}
          </div>
        )}
        <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-stone-200 bg-white">
          {current ? (
            <img src={current.renditions.web.url} alt={localized(current.alt_text, lang) || `${product.style_number} ${colourName(colour)} ${current.position}`} className="size-full object-contain" />
          ) : (
            <div className="grid size-full place-items-center text-stone-400">
              <IconImage size={40} />
            </div>
          )}
          {current && (current.provenance.ai_generated || current.provenance.ai_edited) && (
            <span className="absolute left-3 top-3">
              <Badge tone="blue">
                <IconSparkle size={14} />
                {current.provenance.ai_generated ? t('portal.product.aiGenerated') : t('portal.product.aiEdited')}
              </Badge>
            </span>
          )}
        </div>
        {images.length > 1 && (
          <ul className="flex gap-2 overflow-x-auto pb-1">
            {images.map((a, i) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  aria-label={t('portal.product.showImage', { n: a.position })}
                  aria-current={i === active}
                  className={cx('block size-20 overflow-hidden rounded-lg border bg-white', i === active ? 'border-accent ring-2 ring-accent' : 'border-stone-200')}
                >
                  <img src={a.renditions.thumb.url} alt="" loading="lazy" className="size-full object-contain" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {current && <ImageFacts asset={current} />}
        {current && (
          <DownloadButton path={`/admin/api/portal/assets/${encodeURIComponent(current.id)}/download`} query={{ variant }} fallbackName={current.filename}>
            {t('portal.product.downloadImage')}
          </DownloadButton>
        )}
      </section>

      <section className="min-w-0 space-y-6">
        <div className="space-y-2">
          <p className="font-mono text-sm text-stone-500">{product.style_number}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{localized(product.name, lang)}</h1>
          <div className="flex flex-wrap gap-1.5">
            {brand && <Badge tone="accent">{brand.name}</Badge>}
            {product.item_type && <Badge>{t(`enum.itemType.${product.item_type}`, { defaultValue: humanize(product.item_type) })}</Badge>}
            {product.item_subtype && <Badge>{t(`enum.itemSubtype.${product.item_subtype}`, { defaultValue: humanize(product.item_subtype) })}</Badge>}
            {product.target_group && <Badge>{t(`enum.targetGroup.${product.target_group}`, { defaultValue: humanize(product.target_group) })}</Badge>}
            {product.season && <Badge>{product.season}</Badge>}
            {product.collection && <Badge>{product.collection}</Badge>}
          </div>
          {product.description && <p className="whitespace-pre-line text-sm text-stone-700">{localized(product.description, lang)}</p>}
        </div>

        <div className="card space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={selected ? 'secondary' : 'primary'}
              onClick={() => {
                const ids = selection.data?.product_ids ?? []
                setSelection.mutate(selected ? ids.filter((x) => x !== product.id) : [...ids, product.id])
              }}
            >
              {selected ? <IconCheck size={16} /> : <IconPlus size={16} />}
              {selected ? t('portal.product.inSelection') : t('portal.product.addToSelection')}
            </Button>
            {product.assets.length > 0 && (
              <DownloadButton variant="secondary" path={`/admin/api/portal/products/${encodeURIComponent(product.id)}/download.zip`} query={{ variant }} fallbackName={`${product.style_number}.zip`}>
                {t('portal.product.downloadAll', { count: product.assets.length })}
              </DownloadButton>
            )}
          </div>
          <VariantPicker />
          <VariantHelp />
        </div>

        <Details product={product} colourName={colourName} />
      </section>
      {product.assets.length === 0 && (
        <div className="lg:col-span-2">
          <EmptyState title={t('portal.product.noImages')}>{t('portal.product.noImagesHint')}</EmptyState>
        </div>
      )}
    </div>
  )
}

function ImageFacts({ asset }: { asset: Asset }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const r = asset.rights
  const embargo = r.embargo_until && new Date(r.embargo_until) > new Date()
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs text-stone-600">
      <dt className="font-medium text-stone-500">{t('portal.product.imageKind')}</dt>
      <dd>
        {t(`enum.role.${asset.role}`, { defaultValue: humanize(asset.role) })}
        {asset.view && ` · ${t(`enum.view.${asset.view}`, { defaultValue: humanize(asset.view) })}`} · {asset.width}×{asset.height}
      </dd>
      <dt className="font-medium text-stone-500">{t('portal.product.usage')}</dt>
      <dd>
        {r.channels.map((c) => t(`enum.channel.${c}`, { defaultValue: humanize(c) })).join(', ') || '—'}
        {' · '}
        {r.territories?.length ? r.territories.map((c) => countryName(c, lang)).join(', ') : t('portal.product.worldwide')}
      </dd>
      {embargo && (
        <>
          <dt className="font-medium text-amber-700">{t('portal.product.embargo')}</dt>
          <dd className="text-amber-800">{t('portal.product.embargoUntil', { date: formatDate(r.embargo_until, lang, true) })}</dd>
        </>
      )}
      {r.expires_at && (
        <>
          <dt className="font-medium text-stone-500">{t('portal.product.expires')}</dt>
          <dd>{formatDate(r.expires_at, lang)}</dd>
        </>
      )}
      {r.credit && (
        <>
          <dt className="font-medium text-stone-500">{t('portal.product.credit')}</dt>
          <dd>{r.credit}</dd>
        </>
      )}
      {r.license === 'custom' && r.license_text && (
        <>
          <dt className="font-medium text-stone-500">{t('portal.product.licence')}</dt>
          <dd className="whitespace-pre-line">{r.license_text}</dd>
        </>
      )}
      {(asset.provenance.ai_generated || asset.provenance.ai_edited) && (
        <>
          <dt className="font-medium text-sky-700">{t('portal.product.ai')}</dt>
          <dd>{asset.provenance.ai_generated ? t('portal.product.aiGeneratedHelp') : t('portal.product.aiEditedHelp')}</dd>
        </>
      )}
    </dl>
  )
}

function Details({ product, colourName }: { product: ProductDetail; colourName: (c: string) => string }) {
  const { t } = useTranslation()
  const variants = [...product.variants].sort((a, b) => a.color.code.localeCompare(b.color.code))
  const rows = variants.map((v) => ({ ...v, key: v.id, ean: v.gtin_original ?? v.gtin ?? null }))
  return (
    <div className="space-y-6">
      <LabelInfo product={product} />
      {variants.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold">{t('portal.product.sizes')}</h2>
          <SizesTable caption={t('portal.product.sizes')} colourName={colourName} rows={rows} measurements={false} />
        </div>
      )}
      <MeasurementsTable rows={rows} colourName={colourName} />
      <FeatureList features={product.features} />
    </div>
  )
}
