// The article data of spec 0.2 (protocol.md §5.9) as people read it: the label information in
// label order, sizes with their measurements, and the features. Shared by the retailer's
// article page and the brand's article screen, so both show exactly the same thing.
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Measurements, ProductInput, VariantInput } from '../../api/types'
import type { LabelWarning } from '../../lib/article'
import { countryName } from '../../lib/format'
import { localized } from '../../lib/localized'
import { normaliseMaterials } from '../../lib/materials'
import { humanize } from '../../lib/prefs'
import { certificationName, FEATURE_KEYS, FEATURES, FOOTWEAR_PARTS, type MeasurementKey } from '../../lib/vocab'

/** The fields both a protocol Product and a stored ProductInput have. */
export type ArticleFields = Pick<ProductInput, 'materials' | 'contains_animal_origin' | 'footwear_materials' | 'care' | 'country_of_origin' | 'certifications' | 'features' | 'dpp_url'>
export type SizeRow = Pick<VariantInput, 'color' | 'size' | 'size_length' | 'size_system' | 'measurements' | 'sku'> & { key: string; ean: string | null; badge?: ReactNode }

function Item({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div>
      <dt className="font-semibold">{label}</dt>
      <dd className="mt-1 space-y-0.5 text-stone-700">{children}</dd>
    </div>
  )
}

const hasLabel = (p: ArticleFields) => !!(p.materials?.length || p.contains_animal_origin || p.footwear_materials || p.care?.length || p.country_of_origin || p.certifications?.length)

/** Composition, animal origin, footwear materials, care, origin and certifications, in that order. Only what is present. */
export function LabelInfo({ product, heading = true }: { product: ArticleFields; heading?: boolean }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const materials = normaliseMaterials(product.materials)
  const fm = product.footwear_materials
  if (!hasLabel(product) && !product.dpp_url) return null
  return (
    <section aria-labelledby={heading ? 'label-info' : undefined} className="space-y-3">
      {heading && (
        <h2 id="label-info" className="text-sm font-semibold">
          {t('article.label')}
        </h2>
      )}
      <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
        {(materials || product.contains_animal_origin) && (
          <Item label={t('article.composition')}>
            {materials?.map((m) => (
              <p key={m.part}>
                {(materials.length > 1 || m.part !== 'main') && <span className="text-stone-500">{t(`enum.part.${m.part}`, { defaultValue: humanize(m.part) })}: </span>}
                {m.fibers
                  .map((f) => {
                    const marks = [f.recycled && t('article.recycled'), f.organic && t('article.organic')].filter(Boolean)
                    return `${new Intl.NumberFormat(lang).format(f.percentage)}% ${t(`enum.fibre.${f.fiber}`, { defaultValue: humanize(f.fiber).toLowerCase() })}${marks.length ? ` (${marks.join(', ')})` : ''}`
                  })
                  .join(', ')}
              </p>
            ))}
            {product.contains_animal_origin && <p className="font-medium text-stone-900">{t('article.animalOrigin')}</p>}
          </Item>
        )}
        {fm && FOOTWEAR_PARTS.some((k) => fm[k]) && (
          <Item label={t('article.footwear')}>
            {FOOTWEAR_PARTS.filter((k) => fm[k]).map((k) => (
              <p key={k}>
                <span className="text-stone-500">{t(`article.footwearPart.${k}`)}: </span>
                {t(`enum.footwearMaterial.${fm[k]}`, { defaultValue: humanize(String(fm[k])) })}
              </p>
            ))}
          </Item>
        )}
        {product.care?.length ? (
          <Item label={t('portal.product.care')}>
            <ol className="list-disc space-y-0.5 pl-4">
              {product.care.map((c) => (
                <li key={c.code}>{localized(c.text, lang) || t(`enum.care.${c.code}`, { defaultValue: humanize(c.code) })}</li>
              ))}
            </ol>
          </Item>
        ) : null}
        {product.country_of_origin && <Item label={t('portal.product.origin')}>{countryName(product.country_of_origin, lang)}</Item>}
        {product.certifications?.length ? (
          <Item label={t('article.certifications')}>
            <ul className="space-y-0.5">
              {product.certifications.map((c, i) => (
                <li key={`${c.scheme}-${i}`}>
                  <span className="font-medium text-stone-900">{certificationName(c.scheme)}</span>
                  {c.licence_number && <span className="font-mono text-xs"> {c.licence_number}</span>}
                  <span className="text-stone-500"> · {t(`article.certScope.${c.scope}`)}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-stone-500">{t('article.certNote')}</p>
          </Item>
        ) : null}
        {product.dpp_url && (
          <Item label={t('portal.product.passport')}>
            <a href={product.dpp_url} target="_blank" rel="noopener noreferrer" className="text-accent-strong underline underline-offset-2">
              {t('portal.product.passportOpen')}
            </a>
          </Item>
        )}
      </dl>
    </section>
  )
}

/** Features as "label: value" pairs; registry keys first, in registry order. */
export function FeatureList({ features }: { features: ProductInput['features'] }) {
  const { t, i18n } = useTranslation()
  if (!features) return null
  const keys = [...FEATURE_KEYS.filter((k) => k in features), ...Object.keys(features).filter((k) => !(FEATURE_KEYS as string[]).includes(k)).sort()]
  if (!keys.length) return null
  const value = (key: string, v: unknown): string => {
    if (Array.isArray(v)) return v.map((x) => value(key, x)).join(', ')
    if (typeof v === 'boolean') return v ? t('article.yes') : t('article.no')
    if (typeof v === 'number') return new Intl.NumberFormat(i18n.language).format(v)
    const def = (FEATURES as Record<string, { type: string }>)[key]
    return def && def.type !== 'integer' ? t(`enum.feature.${key}.${v}`, { defaultValue: humanize(String(v)) }) : String(v)
  }
  return (
    <section aria-labelledby="features" className="space-y-2">
      <h2 id="features" className="text-sm font-semibold">
        {t('article.features')}
      </h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {keys.map((k) => (
          <div key={k} className="contents">
            <dt className="text-stone-500">{t(`article.feature.${k}`, { defaultValue: humanize(k) })}</dt>
            <dd className="text-stone-800">{value(k, features[k])}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/**
 * The brand's own extra fields (Product.attributes): its key as a label, texts in the reader's
 * language, yes/no and numbers formatted for it.
 */
export function AttributeList({ attributes }: { attributes: ProductInput['attributes'] }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const keys = Object.keys(attributes ?? {})
    .filter((k) => attributes![k] !== null && attributes![k] !== '')
    .sort()
  if (!keys.length) return null
  const value = (v: unknown) =>
    typeof v === 'boolean' ? (v ? t('article.yes') : t('article.no')) : typeof v === 'number' ? new Intl.NumberFormat(lang).format(v) : typeof v === 'object' ? localized(v as Record<string, string>, lang) : String(v)
  return (
    <section aria-labelledby="attributes" className="space-y-2">
      <h2 id="attributes" className="text-sm font-semibold">
        {t('article.attributes')}
      </h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {keys.map((k) => (
          <div key={k} className="contents">
            <dt className="text-stone-500">{humanize(k)}</dt>
            <dd className="text-stone-800">{value(attributes![k])}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/** The size as people say it: "32/34" when there is a second size. */
export const sizeLabel = (v: Pick<VariantInput, 'size' | 'size_length'>) => [v.size, v.size_length].filter(Boolean).join('/') || '—'

type Column = { key: string; label: string; cell: (m: Measurements) => string }

function useMeasurementColumns(rows: Measurements[]): Column[] {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const nf = (unit: string, long = false) => new Intl.NumberFormat(lang, { style: 'unit', unit, unitDisplay: long ? 'long' : 'short', maximumFractionDigits: 2 })
  const num = new Intl.NumberFormat(lang, { maximumFractionDigits: 2 })
  const cm = nf('centimeter')
  const has = (...keys: MeasurementKey[]) => rows.some((m) => keys.some((k) => m[k] != null))
  const one = (k: MeasurementKey, f: Intl.NumberFormat) => (m: Measurements) => (m[k] != null ? f.format(m[k] as number) : '')
  const cols: Column[] = []
  if (has('height_cm', 'width_cm', 'depth_cm'))
    cols.push({
      key: 'dims',
      label: t('article.dimensions'),
      cell: (m) => {
        if (m.height_cm == null && m.width_cm == null && m.depth_cm == null) return ''
        const parts = [m.height_cm, m.width_cm, m.depth_cm].map((v) => (v == null ? '–' : num.format(v)))
        return `${parts.join(' × ')} ${cm.formatToParts(1).find((p) => p.type === 'unit')?.value ?? 'cm'}`
      },
    })
  if (has('weight_kg')) cols.push({ key: 'weight', label: t('article.weight'), cell: one('weight_kg', nf('kilogram')) })
  if (has('volume_l', 'volume_expanded_l')) {
    const l = nf('liter')
    cols.push({
      key: 'volume',
      label: t('article.volume'),
      cell: (m) => [m.volume_l != null && l.format(m.volume_l), m.volume_expanded_l != null && t('article.volumeExpanded', { volume: l.format(m.volume_expanded_l) })].filter(Boolean).join(' · '),
    })
  }
  if (has('handle_drop_cm')) cols.push({ key: 'handle', label: t('article.handleDrop'), cell: one('handle_drop_cm', cm) })
  if (has('strap_length_cm'))
    cols.push({
      key: 'strap',
      label: t('article.strapLength'),
      cell: (m) => (m.strap_length_cm ? (m.strap_length_cm.min === m.strap_length_cm.max ? cm.format(m.strap_length_cm.min) : cm.formatRange(m.strap_length_cm.min, m.strap_length_cm.max)) : ''),
    })
  if (has('laptop_max_inch')) {
    const inch = nf('inch', true)
    cols.push({ key: 'laptop', label: t('article.laptop'), cell: (m) => (m.laptop_max_inch != null ? t('article.laptopUpTo', { size: inch.format(m.laptop_max_inch) }) : '') })
  }
  if (has('heel_height_cm')) cols.push({ key: 'heel', label: t('article.heelHeight'), cell: one('heel_height_cm', cm) })
  if (has('shaft_height_cm')) cols.push({ key: 'shaft', label: t('article.shaftHeight'), cell: one('shaft_height_cm', cm) })
  if (has('inseam_cm')) cols.push({ key: 'inseam', label: t('article.inseam'), cell: one('inseam_cm', cm) })
  return cols
}

/**
 * The sizes table: colour (with colour family), size (with second size), EAN, SKU, and a
 * column per measurement that any size has.
 */
export function SizesTable({ rows, colourName, caption, actions, measurements = true }: { rows: SizeRow[]; colourName: (code: string) => string; caption: string; actions?: (row: SizeRow) => ReactNode; measurements?: boolean }) {
  const { t } = useTranslation()
  const measured = measurements ? rows.map((r) => r.measurements).filter((m): m is Measurements => !!m) : []
  const cols = useMeasurementColumns(measured)
  const families = rows.some((r) => r.color.family)
  const th = 'px-3 py-2 font-medium whitespace-nowrap'
  const td = 'px-3 py-1.5 align-top'
  return (
    <div role="region" tabIndex={0} aria-label={caption} className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-stone-50 text-left text-xs text-stone-500">
          <tr>
            <th className={th}>{t('fields.colour')}</th>
            {families && <th className={th}>{t('article.colourFamily')}</th>}
            <th className={th}>{t('fields.size')}</th>
            <th className={th}>{t('glossary.ean')}</th>
            <th className={th}>{t('fields.sku')}</th>
            {cols.map((c) => (
              <th key={c.key} className={th}>
                {c.label}
              </th>
            ))}
            {actions && <th className={th} />}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {rows.map((r) => (
            <tr key={r.key}>
              <td className={td}>
                {colourName(r.color.code)} <span className="text-xs text-stone-500">{r.color.code}</span>
              </td>
              {families && <td className={td}>{r.color.family ? t(`enum.colourFamily.${r.color.family}`, { defaultValue: humanize(r.color.family) }) : ''}</td>}
              <td className={`${td} whitespace-nowrap`}>
                {sizeLabel(r)}
                {r.size_system && <span className="text-xs text-stone-500"> {r.size_system}</span>}
              </td>
              <td className={`${td} font-mono text-xs tabular`}>{r.ean ?? '—'}</td>
              <td className={`${td} font-mono text-xs whitespace-nowrap`}>{r.sku ?? ''}</td>
              {cols.map((c) => (
                <td key={c.key} className={`${td} whitespace-nowrap tabular`}>
                  {r.measurements ? c.cell(r.measurements) : ''}
                </td>
              ))}
              {actions && <td className={`${td} whitespace-nowrap text-right`}>{actions(r)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Measurements per size, for narrow layouts: one row per size (and colour, when the colours
 * differ), a column per measurement any size has. Identical rows are shown once.
 */
export function MeasurementsTable({ rows, colourName }: { rows: SizeRow[]; colourName: (code: string) => string }) {
  const { t } = useTranslation()
  const withM = rows.filter((r) => r.measurements && Object.keys(r.measurements).length)
  const cols = useMeasurementColumns(withM.map((r) => r.measurements!))
  if (!withM.length || !cols.length) return null
  const perColour = new Set(withM.map((r) => r.color.code)).size > 1 && new Set(withM.map((r) => JSON.stringify([sizeLabel(r), r.measurements]))).size > new Set(withM.map((r) => sizeLabel(r))).size
  const seen = new Set<string>()
  const unique = withM.filter((r) => {
    const k = JSON.stringify([perColour ? r.color.code : '', sizeLabel(r), r.measurements])
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  const th = 'px-3 py-2 font-medium whitespace-nowrap'
  const td = 'px-3 py-1.5 align-top whitespace-nowrap tabular'
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">{t('article.measurements')}</h2>
      <div role="region" tabIndex={0} aria-label={t('article.measurements')} className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs text-stone-500">
            <tr>
              {perColour && <th className={th}>{t('fields.colour')}</th>}
              <th className={th}>{t('fields.size')}</th>
              {cols.map((c) => (
                <th key={c.key} className={th}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {unique.map((r) => (
              <tr key={r.key}>
                {perColour && <td className={td}>{colourName(r.color.code)}</td>}
                <td className={td}>{sizeLabel(r)}</td>
                {cols.map((c) => (
                  <td key={c.key} className={td}>
                    {c.cell(r.measurements!)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Label completeness warnings with a plain explanation and the legal basis. Never blocking. */
export function LabelWarnings({ warnings }: { warnings: LabelWarning[] }) {
  const { t } = useTranslation()
  if (!warnings.length) return null
  return (
    <div role="note" className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
      <p className="font-semibold">{t('labelWarning.title')}</p>
      <p>{t('labelWarning.intro')}</p>
      <ul className="space-y-1.5">
        {warnings.map((w) => (
          <li key={w.code + (w.part ?? '')}>
            <LabelWarningText code={w.code} part={w.part} />
          </li>
        ))}
      </ul>
    </div>
  )
}

export function LabelWarningText({ code, part }: { code: string; part?: string }) {
  const { t } = useTranslation()
  return (
    <>
      <span className="block font-medium">
        {t(`importErrors.${code}`)}
        {part && ` (${t(`enum.part.${part}`, { defaultValue: humanize(part) })})`}
      </span>
      <span className="block">{t(`labelWarning.${code}.why`)}</span>
      <span className="block text-xs opacity-80">{t(`labelWarning.${code}.law`)}</span>
    </>
  )
}
