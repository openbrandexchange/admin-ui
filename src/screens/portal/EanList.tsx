import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { localized } from '../../lib/localized'
import { splitCodes } from '../../lib/validate'
import { useGtinLookup, useSelection, useSetSelection, useViewer } from '../../queries/portal'
import { Badge, Button, CopyButton } from '../../ui/controls'
import { ErrorNote, Notice } from '../../ui/feedback'
import { IconDownload, IconImage, IconPlus } from '../../ui/icons'
import { BackgroundZipDialog } from './DownloadTools'

/** Paste a list of EANs (from an order, an Excel column …) and get the matching products. */
export function EanListScreen() {
  const { t, i18n } = useTranslation()
  const [text, setText] = useState('')
  const lookup = useGtinLookup()
  const viewer = useViewer()
  const selection = useSelection()
  const setSelection = useSetSelection()
  const [jobOpen, setJobOpen] = useState(false)
  const [added, setAdded] = useState<number | null>(null)
  const codes = splitCodes(text)
  const max = viewer.data?.limits?.gtin_lookup_max ?? 2000
  const result = lookup.data
  const unmatched = result?.results.filter((r) => r.status === 'unmatched') ?? []
  const invalid = result?.results.filter((r) => r.status === 'invalid') ?? []
  const matched = result?.results.filter((r) => r.status === 'matched') ?? []
  const productIds = result?.products.map((p) => p.id) ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('portal.ean.title')}</h1>
        <p className="mt-1 max-w-prose text-sm text-stone-600">{t('portal.ean.intro')}</p>
      </div>
      <form
        className="card space-y-3 p-5"
        onSubmit={(e) => {
          e.preventDefault()
          setAdded(null)
          lookup.mutate(text)
        }}
      >
        <label htmlFor="ean-input" className="block text-sm font-medium">
          {t('portal.ean.label')}
        </label>
        <textarea
          id="ean-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          className="input font-mono text-sm"
          placeholder={'2000100101018\n2000100101025; 2000100101032'}
          aria-describedby="ean-count"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p id="ean-count" className="text-xs text-stone-500" aria-live="polite">
            {t('portal.ean.detected', { count: codes.length })}
            {codes.length > max && <span className="ml-2 font-medium text-red-700">{t('portal.ean.tooMany', { max })}</span>}
          </p>
          <Button type="submit" variant="primary" loading={lookup.isPending} disabled={!codes.length || codes.length > max}>
            {t('portal.ean.submit')}
          </Button>
        </div>
        <ErrorNote error={lookup.error} />
      </form>

      {result && (
        <section className="space-y-4" aria-labelledby="ean-results">
          <h2 id="ean-results" className="sr-only">
            {t('portal.ean.results')}
          </h2>
          <div className="flex flex-wrap gap-2">
            <Badge tone="green">{t('portal.ean.matched', { count: matched.length })}</Badge>
            <Badge tone={unmatched.length ? 'amber' : 'neutral'}>{t('portal.ean.unmatched', { count: unmatched.length })}</Badge>
            {invalid.length > 0 && <Badge tone="red">{t('portal.ean.invalid', { count: invalid.length })}</Badge>}
          </div>

          {productIds.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                loading={setSelection.isPending}
                onClick={() => {
                  const current = selection.data?.product_ids ?? []
                  const next = [...new Set([...current, ...productIds])]
                  setSelection.mutate(next, { onSuccess: (s) => setAdded(s.product_ids.length - current.length) })
                }}
              >
                <IconPlus size={16} />
                {t('portal.ean.addAll', { count: productIds.length })}
              </Button>
              <Button onClick={() => setJobOpen(true)}>
                <IconDownload size={16} />
                {t('portal.ean.downloadAll')}
              </Button>
            </div>
          )}
          {added !== null && (
            <Notice tone="ok">
              {t('portal.ean.added', { count: added })}{' '}
              <Link to="/selection" className="font-medium underline">
                {t('portal.ean.viewSelection')}
              </Link>
            </Notice>
          )}

          {(unmatched.length > 0 || invalid.length > 0) && (
            <div className="card space-y-2 p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{t('portal.ean.notFoundTitle')}</h3>
                <CopyButton value={[...unmatched, ...invalid].map((r) => r.input).join('\n')} label={t('portal.ean.copyNotFound')} />
              </div>
              <p className="text-xs text-stone-500">{t('portal.ean.notFoundHint')}</p>
              <ul className="flex flex-wrap gap-1.5 font-mono text-xs">
                {unmatched.map((r) => (
                  <li key={r.input} className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-900">
                    {r.input}
                  </li>
                ))}
                {invalid.map((r) => (
                  <li key={r.input} className="rounded bg-red-50 px-1.5 py-0.5 text-red-800" title={t('portal.ean.invalidHint')}>
                    {r.input}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {result.products.map((p) => (
              <li key={p.id} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                <Link to="/products/$id" params={{ id: p.id }} className="block">
                  <div className="aspect-[4/5] bg-stone-100">
                    {p.assets?.[0] ? <img src={p.assets[0].renditions.thumb.url} alt="" className="size-full object-contain" loading="lazy" /> : <IconImage className="m-auto mt-10 text-stone-400" />}
                  </div>
                  <div className="p-2">
                    <p className="font-mono text-xs text-stone-500">{p.style_number}</p>
                    <p className="line-clamp-2 text-sm">{localized(p.name, i18n.language)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <BackgroundZipDialog open={jobOpen} onClose={() => setJobOpen(false)} title={t('portal.ean.downloadAll')} description={t('portal.jobs.intro')} input={{ source: 'products', product_ids: productIds }} />
    </div>
  )
}
