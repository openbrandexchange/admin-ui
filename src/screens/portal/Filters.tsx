import { useTranslation } from 'react-i18next'
import type { FacetValue, Facets } from '../../api/types'
import { localized } from '../../lib/localized'
import { humanize } from '../../lib/prefs'
import { QUALIFIERS } from '../../lib/vocab'
import type { CatalogSearch } from '../../router'
import { cx } from '../../ui/controls'
import { IconX } from '../../ui/icons'
import { useTermLabel, type TermFamily } from '../shared/ArticleData'

type ArrayKey = 'brand_id' | 'item_type' | 'color' | 'season' | 'collection' | 'target_group' | 'qualifier'

const GROUPS: { key: ArrayKey; facet: keyof Facets; enumPrefix?: string; family?: TermFamily }[] = [
  { key: 'brand_id', facet: 'brands' },
  { key: 'item_type', facet: 'item_types', enumPrefix: 'enum.itemType' },
  { key: 'target_group', facet: 'target_groups', enumPrefix: 'enum.targetGroup' },
  { key: 'color', facet: 'colors' },
  { key: 'season', facet: 'seasons' },
  { key: 'collection', facet: 'collections' },
  // Material claims (organic, recycled, post-consumer, ...). Optional in the API: a node that
  // sends no `qualifiers` facet gets no group.
  { key: 'qualifier', facet: 'qualifiers', family: 'qualifier' },
]

const byVocabulary = (values: FacetValue[]) => {
  const rank = (v: FacetValue) => ((QUALIFIERS as readonly string[]).includes(v.value) ? (QUALIFIERS as readonly string[]).indexOf(v.value) : QUALIFIERS.length)
  return [...values].sort((a, b) => rank(a) - rank(b) || a.value.localeCompare(b.value))
}

export function useFacetLabel() {
  const { t, i18n } = useTranslation()
  const term = useTermLabel()
  return (v: FacetValue, enumPrefix?: string, family?: TermFamily) => {
    if (family) {
      // A term: the node's name in the reader's language, else the UI's word, capitalised as a list item.
      const s = term(family, { code: v.value, name: typeof v.label === 'object' ? v.label : null })
      return s.charAt(0).toLocaleUpperCase(i18n.language) + s.slice(1)
    }
    if (enumPrefix) return t(`${enumPrefix}.${v.value}`, { defaultValue: typeof v.label === 'string' ? v.label : humanize(v.value) })
    if (typeof v.label === 'string') return v.label
    if (v.label) return localized(v.label, i18n.language)
    return v.value
  }
}

export function FilterPanel({ facets, search, onChange }: { facets: Facets | undefined; search: CatalogSearch; onChange: (next: CatalogSearch) => void }) {
  const { t } = useTranslation()
  const label = useFacetLabel()
  return (
    <div className="divide-y divide-stone-200 [&>fieldset]:py-4 [&>fieldset:first-child]:pt-0">
      <fieldset>
        <legend className="mb-2.5 text-sm font-semibold text-stone-900">{t('portal.filters.new')}</legend>
        <div className="flex flex-wrap gap-1.5">
          {([undefined, '7', '30', '90'] as const).map((n) => (
            <button
              key={n ?? 'all'}
              type="button"
              aria-pressed={search.new === n}
              onClick={() => onChange({ ...search, new: n })}
              className={cx('h-8 rounded-full border px-3 text-xs font-medium', search.new === n ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 bg-white text-stone-700 hover:border-stone-500')}
            >
              {n ? t('portal.filters.lastDays', { count: Number(n) }) : t('portal.filters.anytime')}
            </button>
          ))}
        </div>
      </fieldset>
      {GROUPS.map(({ key, facet, enumPrefix, family }) => {
        // Claims in the vocabulary's order (organic, in conversion, recycled, pre-/post-consumer, ...), so related ones stay together.
        const values = family === 'qualifier' ? byVocabulary(facets?.[facet] ?? []) : (facets?.[facet] ?? [])
        const chosen = search[key] ?? []
        if (!values.length && !chosen.length) return null
        return (
          <fieldset key={key}>
            <legend className="mb-2 text-sm font-semibold text-stone-900">{t(`portal.filters.${key}`)}</legend>
            <ul className="max-h-56 space-y-1 overflow-y-auto pr-1">
              {values.map((v) => {
                const on = chosen.includes(v.value)
                return (
                  <li key={v.value}>
                    <label className="flex min-h-8 cursor-pointer items-center gap-2.5 rounded-md px-1 py-1 text-sm text-stone-700 hover:text-stone-900">
                      <input
                        type="checkbox"
                        className="size-4 accent-accent"
                        checked={on}
                        onChange={() => onChange({ ...search, [key]: on ? chosen.filter((x) => x !== v.value) : [...chosen, v.value] })}
                      />
                      <span className="flex-1 truncate">{label(v, enumPrefix, family)}</span>
                      <span className="text-xs text-stone-500 tabular">{v.count}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </fieldset>
        )
      })}
    </div>
  )
}

/** The chosen filter values as removable chips above the grid. */
export function ActiveFilters({ facets, search, onChange, onClear }: { facets: Facets | undefined; search: CatalogSearch; onChange: (next: CatalogSearch) => void; onClear: () => void }) {
  const { t } = useTranslation()
  const label = useFacetLabel()
  const chips: { key: string; text: string; remove: () => void }[] = []
  if (search.new) chips.push({ key: 'new', text: t('portal.filters.lastDays', { count: Number(search.new) }), remove: () => onChange({ ...search, new: undefined }) })
  for (const { key, facet, enumPrefix, family } of GROUPS) {
    for (const value of search[key] ?? []) {
      const v = facets?.[facet]?.find((x) => x.value === value) ?? { value, count: 0 }
      chips.push({ key: `${key}:${value}`, text: label(v, enumPrefix, family), remove: () => onChange({ ...search, [key]: (search[key] ?? []).filter((x) => x !== value) }) })
    }
  }
  if (!chips.length) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ul className="contents" aria-label={t('portal.filters.active')}>
        {chips.map((c) => (
          <li key={c.key}>
            <button type="button" onClick={c.remove} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-stone-300 bg-white pr-2 pl-3 text-xs font-medium text-stone-800 hover:border-stone-500">
              {c.text}
              <IconX size={14} />
              <span className="sr-only">{t('portal.filters.remove')}</span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onClear} className="h-8 px-2 text-xs text-stone-600 underline underline-offset-2 hover:text-stone-900">
        {t('portal.filters.clear')}
      </button>
    </div>
  )
}

export const activeFilterCount = (s: CatalogSearch) => GROUPS.reduce((n, g) => n + (s[g.key]?.length ?? 0), 0) + (s.new ? 1 : 0)
