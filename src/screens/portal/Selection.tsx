import { useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { localized } from '../../lib/localized'
import { portalProductQuery, useClearSelection, useSelection, useSetSelection, useViewer } from '../../queries/portal'
import { Button, Loading } from '../../ui/controls'
import { ConfirmButton, EmptyState, ErrorNote, Notice } from '../../ui/feedback'
import { IconDownload, IconImage, IconTrash } from '../../ui/icons'
import { BackgroundZipDialog, CsvButton, DownloadButton, VariantHelp, VariantPicker, useVariant } from './DownloadTools'

const SHOW_STEP = 48

export function SelectionScreen() {
  const { t, i18n } = useTranslation()
  const selection = useSelection()
  const viewer = useViewer()
  const setSelection = useSetSelection()
  const clear = useClearSelection()
  const [variant] = useVariant()
  const [shown, setShown] = useState(SHOW_STEP)
  const [jobOpen, setJobOpen] = useState(false)
  const ids = selection.data?.product_ids ?? []
  const products = useQueries({ queries: ids.slice(0, shown).map((id) => portalProductQuery(id)) })

  if (selection.isPending) return <Loading />
  if (selection.isError) return <ErrorNote error={selection.error} />

  const images = selection.data.image_count
  const syncMax = viewer.data?.limits?.sync_zip_max_images ?? 400
  const tooBig = images > syncMax

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('portal.selection.title')}</h1>
          <p className="text-sm text-stone-600">{t('portal.selection.summary', { count: ids.length, images })}</p>
        </div>
        {ids.length > 0 && (
          <ConfirmButton
            label={
              <>
                <IconTrash size={16} />
                {t('portal.selection.clear')}
              </>
            }
            title={t('portal.selection.clearTitle')}
            body={t('portal.selection.clearBody')}
            confirmLabel={t('portal.selection.clear')}
            onConfirm={() => clear.mutateAsync()}
            size="sm"
          />
        )}
      </div>

      {ids.length === 0 ? (
        <EmptyState
          title={t('portal.selection.emptyTitle')}
          action={
            <Link to="/" className="text-sm font-medium text-accent-strong underline underline-offset-2">
              {t('portal.selection.browse')}
            </Link>
          }
        >
          {t('portal.selection.empty')}
        </EmptyState>
      ) : (
        <>
          <div className="card space-y-4 p-5">
            <h2 className="font-semibold">{t('portal.selection.download')}</h2>
            <VariantPicker />
            <VariantHelp />
            <div className="flex flex-wrap gap-2">
              {tooBig ? (
                <Button variant="primary" onClick={() => setJobOpen(true)}>
                  <IconDownload size={16} />
                  {t('portal.selection.prepareZip')}
                </Button>
              ) : (
                <DownloadButton variant="primary" path="/admin/api/portal/selection/download.zip" query={{ variant }} fallbackName="selection.zip">
                  {t('portal.selection.zip', { count: images })}
                </DownloadButton>
              )}
              <CsvButton path="/admin/api/portal/selection/data.csv">{t('portal.selection.csv')}</CsvButton>
            </div>
            {tooBig && <Notice>{t('portal.selection.tooBig', { max: syncMax })}</Notice>}
          </div>

          <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
            {ids.slice(0, shown).map((id, i) => {
              const p = products[i]?.data
              return (
                <li key={id} className="flex items-center gap-4 px-4 py-3">
                  <div className="size-14 shrink-0 overflow-hidden rounded-md bg-stone-100">
                    {p?.assets[0] ? <img src={p.assets[0].renditions.thumb.url} alt="" className="size-full object-contain" loading="lazy" /> : <IconImage className="m-4 text-stone-400" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    {p ? (
                      <Link to="/products/$id" params={{ id }} className="block truncate font-medium hover:underline">
                        <span className="mr-2 font-mono text-xs text-stone-500">{p.style_number}</span>
                        {localized(p.name, i18n.language)}
                      </Link>
                    ) : (
                      <span className="text-sm text-stone-400">{products[i]?.isError ? t('portal.selection.unavailable') : t('common.loading')}</span>
                    )}
                    {p && <p className="text-xs text-stone-500">{t('portal.tile.images', { count: p.assets.length })}</p>}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setSelection.mutate(ids.filter((x) => x !== id))} aria-label={t('portal.selection.remove', { name: p?.style_number ?? id })}>
                    <IconTrash size={16} />
                  </Button>
                </li>
              )
            })}
          </ul>
          {shown < ids.length && (
            <div className="flex justify-center">
              <Button onClick={() => setShown(shown + SHOW_STEP)}>{t('common.loadMore')}</Button>
            </div>
          )}
        </>
      )}
      <BackgroundZipDialog open={jobOpen} onClose={() => setJobOpen(false)} title={t('portal.selection.prepareZip')} description={t('portal.jobs.intro')} input={{ source: 'selection' }} />
    </div>
  )
}
