import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { ApiError } from '../../api/client'
import type { ImportRowError } from '../../api/types'
import { formatDate, formatNumber } from '../../lib/format'
import { saveBlob } from '../../lib/download'
import { usePref } from '../../lib/prefs'
import { csvDelimiter } from '../../i18n/languages'
import { fetchAllImportErrors, importErrorsQuery, importRunQuery } from '../../queries/admin'
import { Badge, Button, Loading, PageHeader, Section, Segmented, Spinner } from '../../ui/controls'
import { ErrorNote, LoadMore, Notice } from '../../ui/feedback'
import { IconChevronLeft, IconDownload } from '../../ui/icons'
import { MEASUREMENTS, WARNING_CODES } from '../../lib/vocab'
import { LabelWarningText } from '../shared/ArticleData'
import { RUN_TONE } from './Imports'

const isLabelWarning = (e: ImportRowError) => e.severity === 'warning' && (WARNING_CODES as readonly string[]).includes(e.obx_error)

const FIELD_LABELS: Record<string, string> = {
  brand: 'fields.brand',
  style_number: 'fields.styleNumber',
  name: 'fields.name',
  description: 'fields.description',
  item_type: 'fields.itemType',
  item_subtype: 'fields.itemSubtype',
  target_group: 'fields.targetGroup',
  season: 'fields.season',
  collection: 'fields.collection',
  materials: 'fields.materials',
  contains_animal_origin: 'fields.animalOrigin',
  footwear_materials: 'article.footwear',
  care: 'fields.care',
  country_of_origin: 'fields.countryOfOrigin',
  certifications: 'article.certifications',
  dpp_url: 'fields.dppUrl',
  gtin: 'glossary.ean',
  ean: 'glossary.ean',
  sku: 'fields.sku',
  color_code: 'fields.colourCode',
  color_name: 'fields.colourName',
  color_family: 'article.colourFamily',
  supplier_color: 'fields.supplierColour',
  size: 'fields.size',
  size_length: 'fields.secondSize',
  size_system: 'fields.sizeSystem',
}

/** A column of the import file as people know it: "EAN", "Name (de)", "Wheels"; else as written. */
export function useColumnLabel() {
  const { t } = useTranslation()
  return (column: string | null | undefined): string => {
    if (!column) return ''
    const [key, lang] = column.trim().toLowerCase().replace(/[ -]/g, '_').split(':')
    let label: string | undefined
    if (key === 'feature' && lang) return t(`article.feature.${lang}`, { defaultValue: column })
    if (FIELD_LABELS[key]) label = t(FIELD_LABELS[key])
    else if ((MEASUREMENTS as readonly string[]).includes(key)) label = t(`product.measure.${key}`)
    if (!label) return column
    return lang ? `${label} (${lang})` : label
  }
}

/** The cell a node names at the start of `detail` (spec import-format.md §5.5), and the rest of the text. */
export function splitLocator(detail: string | null | undefined): { header?: string; letter?: string; text: string } {
  const d = detail ?? ''
  const m = /^(?:row \d+(?:, |: ))?(?:column (?:(.+?) )?\(([A-Z]{1,3})\): |column ([A-Z]{1,3}): )?/.exec(d)
  if (!m || !m[0]) return { text: d }
  return { header: m[1], letter: m[2] ?? m[3], text: d.slice(m[0].length) }
}

const EXCEL_ERROR = /^#(N\/A|REF!|VALUE!|DIV\/0!|NAME\?|NUM!|NULL!|SPILL!|CALC!|GETTING_DATA|FIELD!|BLOCKED!|CONNECT!|BUSY!|UNKNOWN!)/

/** The plain-language title of a row problem; Excel conversion errors get their own. */
export function problemKey(e: ImportRowError): string {
  if (e.obx_error === 'validation_failed' && /\.xlsx$/i.test(e.file) && e.value) {
    if (EXCEL_ERROR.test(e.value)) return 'importErrors.cellError'
    if (e.value.startsWith('=')) return 'importErrors.formula'
  }
  return `importErrors.${e.obx_error}`
}

/** "Row 12, column EAN (C)" from an import problem. */
export function useWhere() {
  const { t } = useTranslation()
  const label = useColumnLabel()
  return (e: ImportRowError) => {
    const loc = splitLocator(e.detail)
    const col = label(e.column ?? loc.header)
    if (e.row != null && col) return loc.letter ? t('imports.cell', { row: e.row, column: col, letter: loc.letter }) : t('imports.rowColumn', { row: e.row, column: col })
    if (e.row != null) return t('imports.row', { n: e.row })
    if (col || loc.letter) return loc.letter ? t('imports.columnAt', { column: col || loc.letter, letter: loc.letter }) : col
    return ''
  }
}

function ErrorRow({ e, where, span }: { e: ImportRowError; where: string; span: number }) {
  const { t } = useTranslation()
  const label = isLabelWarning(e)
  const title = t(problemKey(e), { defaultValue: '' })
  const detail = splitLocator(e.detail).text
  return (
    <tr className={e.severity === 'error' ? 'bg-red-50/40' : 'bg-amber-50/40'}>
      <td className="px-3 py-2 align-top">
        <Badge tone={e.severity === 'error' ? 'red' : 'amber'}>{label ? t('labelWarning.badge') : t(`imports.severity.${e.severity}`)}</Badge>
      </td>
      {span > 0 && (
        <td rowSpan={span} className="px-3 py-2 align-top text-sm">
          <span className="block font-medium">{where}</span>
          <span className="block font-mono text-xs text-stone-500">{e.file}</span>
        </td>
      )}
      <td className="px-3 py-2 align-top font-mono text-xs break-all">{e.value ?? ''}</td>
      <td className="px-3 py-2 align-top text-sm">
        {label ? (
          <LabelWarningText code={e.obx_error} />
        ) : (
          <>
            <span className="block">{title || detail}</span>
            {title && detail && <span className="block text-xs text-stone-500">{detail}</span>}
          </>
        )}
      </td>
    </tr>
  )
}

type Order = 'row' | 'problem'
const ORDERS = ['row', 'problem'] as const

function sortErrors(items: ImportRowError[], order: Order, title: (e: ImportRowError) => string) {
  const letter = (e: ImportRowError) => splitLocator(e.detail).letter ?? ''
  const byPlace = (a: ImportRowError, b: ImportRowError) =>
    a.file.localeCompare(b.file) || (a.row ?? 0) - (b.row ?? 0) || letter(a).length - letter(b).length || letter(a).localeCompare(letter(b))
  return [...items].sort((a, b) =>
    order === 'row' ? byPlace(a, b) : (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1) || title(a).localeCompare(title(b)) || byPlace(a, b),
  )
}

/** The whole list as CSV in the reader's language, for working through it in a spreadsheet. */
async function downloadErrorList(id: string, t: TFunction, where: (e: ImportRowError) => string, lang: string) {
  const items = await fetchAllImportErrors(id)
  const sep = csvDelimiter(lang) === 'semicolon' ? ';' : ','
  // A cell that starts with = + - @ gets a leading ' so a spreadsheet never runs it.
  const cell = (v: unknown) => {
    let s = v == null ? '' : String(v)
    if (/^[=+\-@]/.test(s)) s = `'${s}`
    return /[";,\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const rows = [
    ['file', 'row', 'column', 'where', 'severity', 'problem', 'detail', 'value', 'code'],
    ...sortErrors(items, 'row', () => '').map((e) => {
      const title = t(problemKey(e), { defaultValue: '' })
      return [e.file, e.row, e.column, where(e), t(`imports.severity.${e.severity}`), title || splitLocator(e.detail).text, splitLocator(e.detail).text, e.value, e.obx_error]
    }),
  ]
  saveBlob(new Blob(['﻿' + rows.map((r) => r.map(cell).join(sep)).join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' }), `import-${id}-problems.csv`)
}

export function ImportRunScreen() {
  const { t, i18n } = useTranslation()
  const { id } = useParams({ from: '/admin/imports/$id' })
  const run = useQuery(importRunQuery(id))
  const finished = run.data && (run.data.status === 'succeeded' || run.data.status === 'failed')
  const errors = useInfiniteQuery({ ...importErrorsQuery(id), enabled: !!finished && ((run.data?.counts.errors ?? 0) + (run.data?.counts.warnings ?? 0) > 0 || run.data?.status === 'failed' || !!run.data?.errors_preview?.length) })
  const [order, setOrder] = usePref<Order>('obx.importOrder', ORDERS, 'row')
  const where = useWhere()
  const list = useMutation({ mutationFn: () => downloadErrorList(id, t, where, i18n.language) })
  const back = (
    <Link to="/admin/imports" className="inline-flex items-center gap-1 text-sm text-stone-600">
      <IconChevronLeft size={16} />
      {t('imports.title')}
    </Link>
  )
  if (run.isPending) return <Loading />
  if (run.isError)
    return (
      <div className="space-y-4">
        {back}
        <ErrorNote error={run.error} onRetry={() => void run.refetch()} />
      </div>
    )
  const r = run.data
  const c = r.counts
  const lang = i18n.language
  const tiles: [string, number, string?][] = [
    [t('imports.count.rows'), c.rows],
    [t('imports.count.files'), c.files],
    [t('imports.count.created'), c.created, 'text-emerald-700'],
    [t('imports.count.updated'), c.updated],
    [t('imports.count.unchanged'), c.unchanged, 'text-stone-500'],
    [t('imports.count.unpublished'), c.unpublished],
    [t('imports.count.errors'), c.errors, c.errors ? 'text-red-700' : undefined],
    [t('imports.count.warnings'), c.warnings, c.warnings ? 'text-amber-700' : undefined],
  ]
  const errorItems = errors.data?.pages.flatMap((p) => p.items) ?? r.errors_preview ?? []
  // Grouped by row: the place is shown once for all problems of the same row and column.
  const sorted = sortErrors(errorItems, order, (e) => t(problemKey(e), { defaultValue: e.obx_error })).map((e) => ({ e, place: where(e), span: 1 }))
  for (let i = sorted.length - 1; i > 0; i--)
    if (order === 'row' && sorted[i].e.file === sorted[i - 1].e.file && sorted[i].place === sorted[i - 1].place) {
      sorted[i - 1].span += sorted[i].span
      sorted[i].span = 0
    }
  return (
    <div className="space-y-6">
      <PageHeader
        back={back}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {t(`imports.trigger.${r.trigger}`)}
            <Badge tone={RUN_TONE[r.status]}>{t(`imports.status.${r.status}`)}</Badge>
            {r.dry_run && <Badge tone="blue">{t('imports.checkOnly')}</Badge>}
          </span>
        }
        description={`${formatDate(r.created_at, lang, true)}${r.mode === 'mirror' ? ` · ${t('imports.modeMirror')}` : ''}`}
      />
      {!finished && (
        <Notice>
          <span className="inline-flex items-center gap-2" aria-live="polite">
            <Spinner size={16} />
            {t('imports.working')}
          </span>
        </Notice>
      )}
      {r.dry_run && finished && <Notice>{t('imports.dryRunDone')}</Notice>}
      {r.status === 'failed' && r.error && <ErrorNote error={new ApiError(r.error.status, r.error)} />}
      {r.status === 'succeeded' && !r.dry_run && c.errors === 0 && !errorItems.some((e) => e.severity === 'error') && <Notice tone="ok">{t('imports.allGood')}</Notice>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(([label, value, cls]) => (
          <div key={label} className="card p-3">
            <p className="text-xs text-stone-500">{label}</p>
            <p className={`text-xl font-semibold tabular ${cls ?? ''}`}>{formatNumber(value, lang)}</p>
          </div>
        ))}
      </div>

      {(c.errors > 0 || c.warnings > 0 || errorItems.length > 0) && (
        <Section title={t('imports.problems')} description={c.errors > 0 || errorItems.some((e) => e.severity === 'error') ? t('imports.problemsHint') : undefined}>
          {errorItems.some(isLabelWarning) && (
            <div className="mb-3">
              <Notice tone="warn">
                <span className="block font-semibold">{t('labelWarning.title')}</span>
                {t('labelWarning.intro')}
              </Notice>
            </div>
          )}
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <Segmented label={t('imports.order')} value={order} onChange={setOrder} options={ORDERS.map((o) => ({ value: o, label: t(`imports.by.${o}`) }))} />
            <span className="inline-flex flex-col gap-1">
              <Button size="sm" loading={list.isPending} onClick={() => list.mutate()}>
                <IconDownload size={16} />
                {t('imports.downloadList')}
              </Button>
              <ErrorNote error={list.error} />
            </span>
          </div>
          <div role="region" tabIndex={0} aria-label={t('imports.problems')} className="overflow-x-auto rounded-lg border border-stone-200">
            <table className="w-full text-left">
              <thead className="bg-stone-50 text-xs text-stone-500">
                <tr>
                  <th className="px-3 py-2 font-medium" />
                  <th className="px-3 py-2 font-medium">{t('imports.where')}</th>
                  <th className="px-3 py-2 font-medium">{t('imports.value')}</th>
                  <th className="px-3 py-2 font-medium">{t('imports.problem')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {sorted.map(({ e, place, span }, i) => (
                  <ErrorRow key={i} e={e} where={place} span={span} />
                ))}
              </tbody>
            </table>
          </div>
          <LoadMore hasNext={!!errors.hasNextPage} fetching={errors.isFetchingNextPage} onMore={() => void errors.fetchNextPage()} />
        </Section>
      )}

      {r.files && r.files.length > 0 && (
        <Section title={t('imports.filesTitle')}>
          <ul className="text-sm">
            {r.files.map((f) => (
              <li key={f.name} className="font-mono text-xs">
                {f.name}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}
