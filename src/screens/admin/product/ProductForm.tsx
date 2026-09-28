import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../../api/client'
import type { ProductInput } from '../../../api/types'
import { COUNTRIES } from '../../../lib/countries'
import { countryName } from '../../../lib/format'
import { cleanLocalized } from '../../../lib/localized'
import { formatMaterials, parseMaterials, unbalancedParts } from '../../../lib/materials'
import { humanize } from '../../../lib/prefs'
import { urlProblem } from '../../../lib/validate'
import { CARE_GROUPS, ITEM_TYPES, TARGET_GROUPS } from '../../../lib/vocab'
import { brandsQuery } from '../../../queries/admin'
import { Button, Saved, SelectField, TextField } from '../../../ui/controls'
import { ErrorNote } from '../../../ui/feedback'
import { LocalizedInput } from './LocalizedInput'

type Props = {
  initial?: ProductInput
  /** Style number is the product's key; it cannot change after creation. */
  lockStyle?: boolean
  submitLabel: string
  pending: boolean
  error: unknown
  saved?: boolean
  onSubmit: (body: ProductInput) => void
}

export function ProductForm({ initial, lockStyle, submitLabel, pending, error, saved, onSubmit }: Props) {
  const { t, i18n } = useTranslation()
  const brands = useQuery(brandsQuery)
  const [style, setStyle] = useState(initial?.style_number ?? '')
  const [brand, setBrand] = useState(initial?.brand_external_id ?? '')
  const [name, setName] = useState<Record<string, string>>({ ...(initial?.name ?? {}) })
  const [description, setDescription] = useState<Record<string, string>>({ ...(initial?.description ?? {}) })
  const [itemType, setItemType] = useState(initial?.item_type ?? '')
  const [targetGroup, setTargetGroup] = useState(initial?.target_group ?? '')
  const [season, setSeason] = useState(initial?.season ?? '')
  const [collection, setCollection] = useState(initial?.collection ?? '')
  const [materials, setMaterials] = useState(formatMaterials(initial?.materials))
  const [care, setCare] = useState<string[]>(initial?.care?.map((c) => c.code) ?? [])
  const [origin, setOrigin] = useState(initial?.country_of_origin ?? '')
  const [dpp, setDpp] = useState(initial?.dpp_url ?? '')
  const [touched, setTouched] = useState(false)

  const parsed = parseMaterials(materials)
  const server = error instanceof ApiError ? error.fieldErrors() : {}
  const nameValue = cleanLocalized(name)
  const errs = {
    style: touched && !style.trim() ? t('validate.required') : server['/style_number'],
    name: touched && !nameValue ? t('validate.required') : server['/name'],
    materials: !parsed.ok ? t('product.materialsInvalid', { part: parsed.error }) : server['/materials'],
    dpp: touched && dpp.trim() && urlProblem(dpp) ? t('validate.url') : server['/dpp_url'],
    brand: server['/brand_external_id'],
  }
  const brandList = brands.data?.items ?? []
  const lang = i18n.language
  const sorted = (keys: readonly string[], prefix: string) =>
    keys.map((k) => ({ k, label: t(`${prefix}.${k}`, { defaultValue: humanize(k) }) })).sort((a, b) => a.label.localeCompare(b.label, lang))

  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        setTouched(true)
        if (!style.trim() || !nameValue || !parsed.ok || (dpp.trim() && urlProblem(dpp))) return
        const cleanDescription = cleanLocalized(description)
        onSubmit({
          ...(brand && { brand_external_id: brand }),
          style_number: style.trim(),
          name: nameValue,
          description: cleanDescription,
          item_type: itemType || null,
          target_group: targetGroup || null,
          season: season.trim() || null,
          collection: collection.trim() || null,
          materials: parsed.value,
          care: care.length ? care.map((code) => ({ code })) : null,
          country_of_origin: origin || null,
          dpp_url: dpp.trim() || null,
          ...(initial?.attributes && { attributes: initial.attributes }),
          ...(initial?.gpc_brick && { gpc_brick: initial.gpc_brick }),
        })
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={t('fields.styleNumber')} hint={lockStyle ? t('product.styleLocked') : t('product.styleHint')} value={style} onChange={(e) => setStyle(e.target.value)} disabled={lockStyle} error={errs.style} className="[&_input]:font-mono" />
        {brandList.length > 1 && (
          <SelectField label={t('fields.brand')} value={brand} onChange={(e) => setBrand(e.target.value)} error={errs.brand}>
            <option value="">—</option>
            {brandList.map((b) => (
              <option key={b.external_id} value={b.external_id}>
                {(b.data as { name?: string }).name ?? b.external_id}
              </option>
            ))}
          </SelectField>
        )}
      </div>
      <LocalizedInput label={t('fields.name')} value={name} onChange={setName} error={errs.name} requiredFirst />
      <LocalizedInput label={t('fields.description')} value={description} onChange={setDescription} multiline />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label={t('fields.itemType')} value={itemType} onChange={(e) => setItemType(e.target.value)}>
          <option value="">—</option>
          {itemType && !ITEM_TYPES.includes(itemType as never) && <option value={itemType}>{humanize(itemType)}</option>}
          {sorted(ITEM_TYPES, 'enum.itemType').map(({ k, label }) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </SelectField>
        <SelectField label={t('fields.targetGroup')} value={targetGroup} onChange={(e) => setTargetGroup(e.target.value)}>
          <option value="">—</option>
          {TARGET_GROUPS.map((k) => (
            <option key={k} value={k}>
              {t(`enum.targetGroup.${k}`)}
            </option>
          ))}
        </SelectField>
        <TextField label={t('fields.season')} hint={t('product.seasonHint')} value={season} onChange={(e) => setSeason(e.target.value)} />
        <TextField label={t('fields.collection')} value={collection} onChange={(e) => setCollection(e.target.value)} />
      </div>
      <TextField
        label={t('fields.materials')}
        hint={
          parsed.ok && parsed.value && unbalancedParts(parsed.value).length
            ? t('product.materialsNot100', { parts: unbalancedParts(parsed.value).join(', ') })
            : t('product.materialsHint')
        }
        value={materials}
        onChange={(e) => setMaterials(e.target.value)}
        error={errs.materials}
        placeholder="outer: 65% cotton, 35% polyamide; lining: 100% polyester"
        className="[&_input]:font-mono"
      />
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">{t('fields.care')}</legend>
        <p className="text-xs text-stone-500">{t('product.careHint')}</p>
        {Object.entries(CARE_GROUPS).map(([group, codes]) => (
          <div key={group}>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">{t(`product.careGroup.${group}`)}</p>
            <div className="flex flex-wrap gap-1.5">
              {codes.map((c) => {
                const on = care.includes(c)
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setCare(on ? care.filter((x) => x !== c) : [...care, c])}
                    className={on ? 'rounded-full border border-accent bg-accent px-2.5 py-1 text-xs text-accent-contrast' : 'rounded-full border border-stone-300 bg-white px-2.5 py-1 text-xs text-stone-700 hover:bg-stone-50'}
                  >
                    {t(`enum.care.${c}`, { defaultValue: humanize(c) })}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label={t('fields.countryOfOrigin')} value={origin} onChange={(e) => setOrigin(e.target.value)}>
          <option value="">—</option>
          {[...new Set([...COUNTRIES, 'CN', 'IN', 'BD', 'VN', 'KH', 'PK', 'MA', 'TN', 'LK', 'ID', 'MM', origin].filter(Boolean))]
            .map((c) => ({ c, n: countryName(c, lang) }))
            .sort((a, b) => a.n.localeCompare(b.n, lang))
            .map(({ c, n }) => (
              <option key={c} value={c}>
                {n}
              </option>
            ))}
        </SelectField>
        <TextField label={t('fields.dppUrl')} hint={t('product.dppHint')} type="url" value={dpp} onChange={(e) => setDpp(e.target.value)} error={errs.dpp} placeholder="https://" />
      </div>
      <ErrorNote error={error} />
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" loading={pending}>
          {submitLabel}
        </Button>
        <Saved show={!!saved} />
      </div>
    </form>
  )
}
