import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../../api/client'
import type { IngestRecord, VariantData } from '../../../api/types'
import { cleanLocalized, localized } from '../../../lib/localized'
import { gtinValid } from '../../../lib/validate'
import type { useProductMutations } from '../../../queries/admin'
import { Badge, Button, Checkbox, Section, SelectField, TextField } from '../../../ui/controls'
import { ConfirmButton, Dialog, EmptyState, ErrorNote } from '../../../ui/feedback'
import { IconPlus } from '../../../ui/icons'
import { formatMeasurement, measurementsFrom } from '../../../lib/article'
import { humanize } from '../../../lib/prefs'
import { COLOUR_FAMILIES, MEASUREMENTS, type MeasurementKey } from '../../../lib/vocab'
import { SizesTable } from '../../shared/ArticleData'
import { LocalizedInput } from './LocalizedInput'

type M = ReturnType<typeof useProductMutations>

export function VariantsSection({ productExternalId, variants, mutations }: { productExternalId: string; variants: IngestRecord[]; mutations: M }) {
  const { t, i18n } = useTranslation()
  const [editing, setEditing] = useState<IngestRecord | 'new' | null>(null)
  const sorted = [...variants].sort((a, b) => {
    const x = a.data as unknown as VariantData
    const y = b.data as unknown as VariantData
    return x.color.code.localeCompare(y.color.code) || (x.size ?? '').localeCompare(y.size ?? '', undefined, { numeric: true })
  })
  return (
    <Section
      title={t('product.sizes')}
      description={t('product.sizesHint')}
      actions={
        <Button size="sm" onClick={() => setEditing('new')}>
          <IconPlus size={16} />
          {t('product.addSize')}
        </Button>
      }
    >
      {sorted.length === 0 ? (
        <EmptyState title={t('product.noSizes')}>{t('product.noSizesHint')}</EmptyState>
      ) : (
        <SizesTable
          caption={t('product.sizes')}
          colourName={(code) => {
            const v = sorted.find((x) => (x.data as unknown as VariantData).color.code === code)
            return (v && localized((v.data as unknown as VariantData).color.name, i18n.language)) || code
          }}
          rows={sorted.map((v) => {
            const d = v.data as unknown as VariantData
            return { ...d, key: v.external_id, ean: d.gtin ?? null }
          })}
          actions={(row) => {
            const v = sorted.find((x) => x.external_id === row.key)!
            return (
              <>
                {v.status === 'unpublished' && <Badge>{t('catalog.unpublished')}</Badge>}{' '}
                <Button size="sm" variant="ghost" onClick={() => setEditing(v)}>
                  {t('common.edit')}
                </Button>
              </>
            )
          }}
        />
      )}
      {editing && <VariantDialog productExternalId={productExternalId} record={editing === 'new' ? null : editing} mutations={mutations} onClose={() => setEditing(null)} />}
    </Section>
  )
}

function VariantDialog({ productExternalId, record, mutations, onClose }: { productExternalId: string; record: IngestRecord | null; mutations: M; onClose: () => void }) {
  const { t } = useTranslation()
  const d = (record?.data ?? {}) as Partial<VariantData>
  const [gtin, setGtin] = useState(d.gtin ?? '')
  const [sku, setSku] = useState(d.sku ?? '')
  const [code, setCode] = useState(d.color?.code ?? '')
  const [colourName, setColourName] = useState<Record<string, string>>({ ...(d.color?.name ?? {}) })
  const [supplierColour, setSupplierColour] = useState(d.color?.supplier_color ?? '')
  const [size, setSize] = useState(d.size ?? '')
  const [sizeSystem, setSizeSystem] = useState(d.size_system ?? '')
  const [sizeLength, setSizeLength] = useState(d.size_length ?? '')
  const [family, setFamily] = useState<string>(d.color?.family ?? '')
  const [measures, setMeasures] = useState<Partial<Record<MeasurementKey, string>>>(Object.fromEntries(MEASUREMENTS.map((k) => [k, formatMeasurement(d.measurements, k)])))
  const parsedMeasures = measurementsFrom(measures)
  const [published, setPublished] = useState(record ? record.status === 'published' : true)
  const [touched, setTouched] = useState(false)
  const put = mutations.putVariant
  const server = put.error instanceof ApiError ? put.error.fieldErrors() : {}
  const digits = gtin.replace(/\s/g, '')
  const gtinErr = touched && digits && !gtinValid(digits) ? t('product.gtinInvalid') : (server['/gtin'] ?? (put.error instanceof ApiError && put.error.code === 'gtin_conflict' ? t('errors.gtin_conflict') : undefined))
  const codeErr = touched && !code.trim() ? t('validate.required') : null
  const measureErr = (k: MeasurementKey) => (!parsedMeasures.ok && parsedMeasures.key === k ? (k === 'strap_length_cm' ? t('product.strapInvalid') : t('product.numberInvalid')) : (server[`/measurements/${k}`] ?? null))
  // Key convention: the GTIN as supplied, else style-colour-size.
  const externalId = record?.external_id ?? (digits || [productExternalId, code.trim(), size.trim()].filter(Boolean).join('-'))

  return (
    <Dialog
      open
      wide
      onClose={onClose}
      title={record ? t('product.editSize') : t('product.addSize')}
      footer={
        <>
          {record && (
            <ConfirmButton
              label={t('common.delete')}
              title={t('product.deleteSizeTitle')}
              body={t('product.deleteSizeBody')}
              confirmLabel={t('common.delete')}
              onConfirm={async () => {
                await mutations.deleteVariant.mutateAsync(record.external_id)
                onClose()
              }}
            />
          )}
          <span className="flex-1" />
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            variant="primary"
            loading={put.isPending}
            onClick={() => {
              setTouched(true)
              if (!code.trim() || (digits && !gtinValid(digits)) || !parsedMeasures.ok) return
              put.mutate(
                {
                  id: externalId,
                  body: {
                    product_external_id: productExternalId,
                    gtin: digits || null,
                    sku: sku.trim() || null,
                    color: { code: code.trim(), name: cleanLocalized(colourName), supplier_color: supplierColour.trim() || null, family: (family || null) as VariantData['color']['family'] },
                    size: size.trim() || null,
                    size_length: sizeLength.trim() || null,
                    size_system: sizeSystem.trim() || null,
                    measurements: parsedMeasures.ok ? parsedMeasures.value : null,
                    status: published ? 'published' : 'unpublished',
                  },
                },
                { onSuccess: onClose },
              )
            }}
          >
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={t('glossary.ean')} hint={t('product.gtinHint')} inputMode="numeric" value={gtin} onChange={(e) => setGtin(e.target.value)} error={gtinErr} className="[&_input]:font-mono" disabled={!!record && !!d.gtin && record.external_id === d.gtin} />
        <TextField label={t('fields.sku')} value={sku} onChange={(e) => setSku(e.target.value)} />
        <TextField label={t('fields.colourCode')} hint={t('product.colourCodeHint')} value={code} onChange={(e) => setCode(e.target.value)} error={codeErr} />
        <TextField label={t('fields.supplierColour')} value={supplierColour} onChange={(e) => setSupplierColour(e.target.value)} />
        <TextField label={t('fields.size')} value={size} onChange={(e) => setSize(e.target.value)} placeholder="M, 42, 32/34" />
        <TextField label={t('fields.secondSize')} hint={t('product.secondSizeHint')} value={sizeLength} onChange={(e) => setSizeLength(e.target.value)} placeholder="34, B" />
        <TextField label={t('fields.sizeSystem')} value={sizeSystem} onChange={(e) => setSizeSystem(e.target.value)} placeholder="EU, INT, UK" />
        <SelectField label={t('article.colourFamily')} hint={t('product.colourFamilyHint')} value={family} onChange={(e) => setFamily(e.target.value)}>
          <option value="">—</option>
          {COLOUR_FAMILIES.map((f) => (
            <option key={f} value={f}>
              {t(`enum.colourFamily.${f}`, { defaultValue: humanize(f) })}
            </option>
          ))}
        </SelectField>
      </div>
      <LocalizedInput label={t('fields.colourName')} value={colourName} onChange={setColourName} />
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('article.measurements')}</legend>
        <p className="text-xs text-stone-500">{t('product.measurementsHint')}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {MEASUREMENTS.map((k) => (
            <TextField key={k} label={t(`product.measure.${k}`)} inputMode="decimal" value={measures[k] ?? ''} onChange={(e) => setMeasures({ ...measures, [k]: e.target.value })} error={measureErr(k)} placeholder={k === 'strap_length_cm' ? '80-130' : undefined} />
          ))}
        </div>
      </fieldset>
      <Checkbox label={t('product.sizePublished')} checked={published} onChange={(e) => setPublished(e.target.checked)} />
      <ErrorNote error={put.error ?? mutations.deleteVariant.error} />
    </Dialog>
  )
}
