import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../../api/client'
import type { ProductInput } from '../../../api/types'
import { COUNTRIES } from '../../../lib/countries'
import { countryName } from '../../../lib/format'
import { cleanLocalized } from '../../../lib/localized'
import { careInLabelOrder } from '../../../lib/materials'
import { humanize } from '../../../lib/prefs'
import { urlProblem } from '../../../lib/validate'
import { formatCertifications, parseCertifications, type FootwearMaterials } from '../../../lib/article'
import { CARE_GROUPS, FOOTWEAR_ITEM_TYPES, FOOTWEAR_MATERIALS, FOOTWEAR_PARTS, ITEM_SUBTYPES, ITEM_TYPES, TARGET_GROUPS } from '../../../lib/vocab'
import { brandsQuery } from '../../../queries/admin'
import { Button, Saved, SelectField, TextField } from '../../../ui/controls'
import { ErrorNote } from '../../../ui/feedback'
import { LocalizedInput } from './LocalizedInput'
import { MaterialsEditor, materialsFrom, rowsFrom } from './MaterialsEditor'

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
  const [itemSubtype, setItemSubtype] = useState(initial?.item_subtype ?? '')
  const [animal, setAnimal] = useState(initial?.contains_animal_origin == null ? '' : initial.contains_animal_origin ? 'yes' : 'no')
  const [footwear, setFootwear] = useState<Record<string, string>>({ ...Object.fromEntries(FOOTWEAR_PARTS.map((k) => [k, initial?.footwear_materials?.[k] ?? ''])) })
  const [certs, setCerts] = useState(formatCertifications(initial?.certifications))
  const [targetGroup, setTargetGroup] = useState(initial?.target_group ?? '')
  const [season, setSeason] = useState(initial?.season ?? '')
  const [collection, setCollection] = useState(initial?.collection ?? '')
  const [materials, setMaterials] = useState(() => rowsFrom(initial?.materials))
  const [care, setCare] = useState<string[]>(initial?.care?.map((c) => c.code) ?? [])
  const careText = Object.fromEntries((initial?.care ?? []).filter((c) => c.text).map((c) => [c.code, c.text]))
  const [origin, setOrigin] = useState(initial?.country_of_origin ?? '')
  const [dpp, setDpp] = useState(initial?.dpp_url ?? '')
  const [touched, setTouched] = useState(false)

  const parsed = materialsFrom(materials)
  const parsedCerts = parseCertifications(certs)
  const subtypes: readonly string[] = (ITEM_SUBTYPES as Record<string, readonly string[]>)[itemType] ?? []
  const showFootwear = (FOOTWEAR_ITEM_TYPES as readonly string[]).includes(itemType) || FOOTWEAR_PARTS.some((k) => footwear[k])
  const server = error instanceof ApiError ? error.fieldErrors() : {}
  const nameValue = cleanLocalized(name)
  const errs = {
    style: touched && !style.trim() ? t('validate.required') : server['/style_number'],
    name: touched && !nameValue ? t('validate.required') : server['/name'],
    materials: server['/materials'],
    certs: !parsedCerts.ok ? t('product.certificationsInvalid', { entry: parsedCerts.error }) : server['/certifications'],
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
        if (!style.trim() || !nameValue || !parsed.ok || !parsedCerts.ok || (dpp.trim() && urlProblem(dpp))) return
        const fm = FOOTWEAR_PARTS.some((k) => footwear[k]) ? (Object.fromEntries(FOOTWEAR_PARTS.map((k) => [k, footwear[k] || null])) as FootwearMaterials) : null
        const cleanDescription = cleanLocalized(description)
        onSubmit({
          ...(brand && { brand_external_id: brand }),
          style_number: style.trim(),
          name: nameValue,
          description: cleanDescription,
          item_type: itemType || null,
          item_subtype: itemSubtype || null,
          target_group: targetGroup || null,
          season: season.trim() || null,
          collection: collection.trim() || null,
          materials: parsed.value,
          contains_animal_origin: animal ? animal === 'yes' : null,
          footwear_materials: fm,
          // Codes only (the node adds names, categories and symbols), in label order; the brand's own text stays.
          care: care.length ? careInLabelOrder(care).map((code) => ({ code, ...(careText[code] && { text: careText[code] }) })) : null,
          country_of_origin: origin || null,
          certifications: parsedCerts.ok ? parsedCerts.value : null,
          dpp_url: dpp.trim() || null,
          // Features are shown on the article screen and kept as they are when saving.
          ...(initial?.features && { features: initial.features }),
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
        {(subtypes.length > 0 || itemSubtype) && (
          <SelectField label={t('fields.itemSubtype')} value={itemSubtype} onChange={(e) => setItemSubtype(e.target.value)}>
            <option value="">—</option>
            {itemSubtype && !subtypes.includes(itemSubtype) && <option value={itemSubtype}>{t(`enum.itemSubtype.${itemSubtype}`, { defaultValue: humanize(itemSubtype) })}</option>}
            {sorted(subtypes, 'enum.itemSubtype').map(({ k, label }) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </SelectField>
        )}
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
      <MaterialsEditor rows={materials} onChange={setMaterials} showErrors={touched} error={errs.materials} />
      <SelectField label={t('fields.animalOrigin')} hint={t('product.animalOriginHint')} value={animal} onChange={(e) => setAnimal(e.target.value)}>
        <option value="">{t('article.notStated')}</option>
        <option value="yes">{t('article.yes')}</option>
        <option value="no">{t('article.no')}</option>
      </SelectField>
      {showFootwear && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t('article.footwear')}</legend>
          <p className="text-xs text-stone-500">{t('product.footwearHint')}</p>
          <div className="grid gap-4 sm:grid-cols-3">
            {FOOTWEAR_PARTS.map((k) => (
              <SelectField key={k} label={t(`article.footwearPart.${k}`)} value={footwear[k]} onChange={(e) => setFootwear({ ...footwear, [k]: e.target.value })}>
                <option value="">—</option>
                {FOOTWEAR_MATERIALS.map((m) => (
                  <option key={m} value={m}>
                    {t(`enum.footwearMaterial.${m}`)}
                  </option>
                ))}
              </SelectField>
            ))}
          </div>
        </fieldset>
      )}
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
        <TextField label={t('article.certifications')} hint={t('product.certificationsHint')} value={certs} onChange={(e) => setCerts(e.target.value)} error={errs.certs} placeholder="gots:CU 123456; rws:CU 654321 (material)" className="sm:col-span-2 [&_input]:font-mono" />
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
