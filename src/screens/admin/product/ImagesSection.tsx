import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { AdminAsset, AssetData, IngestRecord, VariantData } from '../../../api/types'
import { localized } from '../../../lib/localized'
import { humanize } from '../../../lib/prefs'
import { uploadAssetFiles } from '../../../lib/upload'
import { settingsQuery, type useProductMutations } from '../../../queries/admin'
import { Badge, Button, Section, cx } from '../../../ui/controls'
import { ConfirmButton, ErrorNote, Notice } from '../../../ui/feedback'
import { IconArrowDown, IconArrowUp, IconImage, IconSparkle, IconUpload } from '../../../ui/icons'
import { AssetDialog } from './AssetDialog'

type M = ReturnType<typeof useProductMutations>

const assetData = (a: AdminAsset) => a.record.data as unknown as AssetData

type UploadState = { name: string; status: 'working' | 'done' | 'error'; error?: unknown }

export function ImagesSection({ productExternalId, styleNumber, variants, assets, mutations }: { productExternalId: string; styleNumber: string; variants: IngestRecord[]; assets: AdminAsset[]; mutations: M }) {
  const { t, i18n } = useTranslation()
  const settings = useQuery(settingsQuery)
  const serverRenders = settings.data?.node?.renditions_server_generated ?? true
  const [editing, setEditing] = useState<AdminAsset | null>(null)
  const [uploads, setUploads] = useState<UploadState[]>([])

  const colourNames = new Map<string, string>()
  for (const v of variants) {
    const d = v.data as unknown as VariantData
    if (!colourNames.has(d.color.code)) colourNames.set(d.color.code, localized(d.color.name, i18n.language) || d.color.code)
  }
  const groups = new Map<string, AdminAsset[]>()
  for (const code of colourNames.keys()) groups.set(code, [])
  for (const a of assets) {
    const k = assetData(a).color_code ?? ''
    groups.set(k, [...(groups.get(k) ?? []), a])
  }
  if (!groups.size) groups.set('', [])
  for (const list of groups.values()) list.sort((a, b) => (assetData(a).position ?? 0) - (assetData(b).position ?? 0))

  async function addFiles(colour: string, files: File[]) {
    const list = groups.get(colour) ?? []
    let next = Math.max(0, ...list.map((a) => assetData(a).position ?? 0)) + 1
    setUploads(files.map((f) => ({ name: f.name, status: 'working' })))
    for (const [i, file] of files.entries()) {
      const position = next++
      try {
        const fileRefs = await uploadAssetFiles(file, serverRenders)
        await mutations.putAsset.mutateAsync({
          id: `${styleNumber}_${colour || 'ALL'}_${position}`,
          body: { product_external_id: productExternalId, color_code: colour || null, role: 'packshot', view: null, position, filename: file.name, files: fileRefs },
        })
        setUploads((u) => u.map((x, j) => (j === i ? { ...x, status: 'done' } : x)))
      } catch (error) {
        setUploads((u) => u.map((x, j) => (j === i ? { ...x, status: 'error', error } : x)))
      }
    }
  }

  function move(list: AdminAsset[], index: number, delta: number, colour: string) {
    const ids = list.map((a) => a.record.external_id)
    const [item] = ids.splice(index, 1)
    ids.splice(index + delta, 0, item)
    mutations.reorder.mutate({ color: colour || null, ids })
  }

  return (
    <Section title={t('product.images')} description={serverRenders ? t('product.imagesHint') : t('product.imagesHintClient')}>
      {uploads.length > 0 && (
        <ul className="space-y-1 text-sm" aria-live="polite">
          {uploads.map((u, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className={cx('size-2 rounded-full', u.status === 'done' ? 'bg-emerald-500' : u.status === 'error' ? 'bg-red-500' : 'animate-pulse bg-stone-400')} />
              <span className="font-mono text-xs">{u.name}</span>
              <span className="text-xs text-stone-500">{t(`product.upload.${u.status}`)}</span>
              {u.error ? <ErrorNote error={u.error} className="py-0.5" /> : null}
            </li>
          ))}
        </ul>
      )}
      {[...groups.entries()].map(([colour, list]) => (
        <div key={colour || 'all'} className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">
              {colour ? colourNames.get(colour) ?? colour : t('portal.product.allColours')} {colour && <span className="text-xs font-normal text-stone-500">{colour}</span>}
            </h3>
            <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-control border border-stone-300 bg-white px-2.5 text-sm font-medium shadow-xs hover:bg-stone-50 focus-within:outline-2 focus-within:outline-accent">
              <IconUpload size={16} />
              {t('product.addImages')}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/tiff"
                multiple
                className="sr-only"
                onChange={(e) => {
                  const files = [...(e.target.files ?? [])]
                  e.target.value = ''
                  if (files.length) void addFiles(colour, files)
                }}
              />
            </label>
          </div>
          {list.length === 0 ? (
            <p className="text-sm text-stone-500">{t('product.noImagesColour')}</p>
          ) : (
            <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {list.map((a, i) => {
                const d = assetData(a)
                const thumb = a.renditions?.thumb?.url ?? a.renditions?.web?.url
                return (
                  <li key={a.record.external_id} className="overflow-hidden rounded-lg border border-stone-200 bg-white">
                    <button type="button" className="block w-full" onClick={() => setEditing(a)} aria-label={t('product.editImage', { n: d.position })}>
                      <div className="relative aspect-[4/5] bg-stone-100">
                        {thumb ? <img src={thumb} alt="" loading="lazy" className="size-full object-contain" /> : <IconImage className="absolute inset-0 m-auto text-stone-400" />}
                        <span className="absolute left-1.5 top-1.5 rounded bg-white/90 px-1.5 text-xs font-semibold tabular">{d.position}</span>
                      </div>
                    </button>
                    <div className="space-y-1 p-2">
                      <p className="truncate text-xs text-stone-600">
                        {t(`enum.role.${d.role ?? 'packshot'}`, { defaultValue: humanize(d.role ?? 'packshot') })}
                        {d.view && ` · ${t(`enum.view.${d.view}`, { defaultValue: humanize(d.view) })}`}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {a.record.status === 'unpublished' && <Badge>{t('catalog.unpublished')}</Badge>}
                        {!!a.record.missing_files?.length && <Badge tone="amber">{t('product.missingFiles')}</Badge>}
                        {(d.provenance?.ai_generated || d.provenance?.ai_edited) && (
                          <Badge tone="blue">
                            <IconSparkle size={12} />
                            {t('product.ai')}
                          </Badge>
                        )}
                        {d.rights?.embargo_until && new Date(d.rights.embargo_until) > new Date() && <Badge tone="amber">{t('portal.product.embargo')}</Badge>}
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" disabled={i === 0 || mutations.reorder.isPending} onClick={() => move(list, i, -1, colour)} aria-label={t('product.moveEarlier')}>
                          <IconArrowUp size={14} className="-rotate-90" />
                        </Button>
                        <Button size="sm" variant="ghost" disabled={i === list.length - 1 || mutations.reorder.isPending} onClick={() => move(list, i, 1, colour)} aria-label={t('product.moveLater')}>
                          <IconArrowDown size={14} className="-rotate-90" />
                        </Button>
                        <span className="flex-1" />
                        <ConfirmButton size="sm" label={t('common.delete')} title={t('product.deleteImageTitle')} body={t('product.deleteImageBody')} confirmLabel={t('common.delete')} onConfirm={() => mutations.deleteAsset.mutateAsync(a.record.external_id)} />
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      ))}
      <ErrorNote error={mutations.reorder.error} />
      {!serverRenders && <Notice>{t('product.clientRenditions')}</Notice>}
      {editing && <AssetDialog asset={editing} serverRenders={serverRenders} mutations={mutations} onClose={() => setEditing(null)} />}
    </Section>
  )
}
