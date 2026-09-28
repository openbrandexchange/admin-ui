import { useTranslation } from 'react-i18next'
import type { FacetValue, Facets } from '../../api/types'
import { localized } from '../../lib/localized'
import { humanize } from '../../lib/prefs'
import type { CatalogSearch } from '../../router'
import { cx } from '../../ui/controls'

type ArrayKey = 'brand_id' | 'item_type' | 'color' | 'season' | 'collection' | 'target_group'

const GROUPS: { key: ArrayKey; facet: keyof Facets; enumPrefix?: string }[] = [
  { key: 'brand_id', facet: 'brands' },
  { key: 'item_type', facet: 'item_types', enumPrefix: 'enum.itemType' },
  { key: 'target_group', facet: 'target_groups', enumPrefix: 'enum.targetGroup' },
  { key: 'color', facet: 'colors' },
  { key: 'season', facet: 'seasons' },
  { key: 'collection', facet: 'collections' },
]

export function useFacetLabel() {
  const { t, i18n } = useTranslation()
  return (v: FacetValue, enumPrefix?: string) => {
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
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">{t('portal.filters.new')}</legend>
        <div className="flex flex-wrap gap-1.5">
          {([undefined, '7', '30', '90'] as const).map((n) => (
            <button
              key={n ?? 'all'}
              type="button"
              aria-pressed={search.new === n}
              onClick={() => onChange({ ...search, new: n })}
              className={cx('rounded-full border px-3 py-1 text-xs font-medium', search.new === n ? 'border-accent bg-accent text-accent-contrast' : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50')}
            >
              {n ? t('portal.filters.lastDays', { count: Number(n) }) : t('portal.filters.anytime')}
            </button>
          ))}
        </div>
      </fieldset>
      {GROUPS.map(({ key, facet, enumPrefix }) => {
        const values = facets?.[facet] ?? []
        const chosen = search[key] ?? []
        if (!values.length && !chosen.length) return null
        return (
          <fieldset key={key}>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">{t(`portal.filters.${key}`)}</legend>
            <ul className="max-h-56 space-y-1 overflow-y-auto pr-1">
              {values.map((v) => {
                const on = chosen.includes(v.value)
                return (
                  <li key={v.value}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-stone-100">
                      <input
                        type="checkbox"
                        className="size-4 accent-accent"
                        checked={on}
                        onChange={() => onChange({ ...search, [key]: on ? chosen.filter((x) => x !== v.value) : [...chosen, v.value] })}
                      />
                      <span className="flex-1 truncate">{label(v, enumPrefix)}</span>
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

export const activeFilterCount = (s: CatalogSearch) => GROUPS.reduce((n, g) => n + (s[g.key]?.length ?? 0), 0) + (s.new ? 1 : 0)
