import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../../api/client'
import type { IngestRecord, VariantData } from '../../../api/types'
import { cleanLocalized, localized } from '../../../lib/localized'
import { gtinValid } from '../../../lib/validate'
import type { useProductMutations } from '../../../queries/admin'
import { Badge, Button, Checkbox, Section, TextField } from '../../../ui/controls'
import { ConfirmButton, Dialog, EmptyState, ErrorNote } from '../../../ui/feedback'
import { IconPlus } from '../../../ui/icons'
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-stone-500">
              <tr>
                <th className="py-1.5 pr-3 font-medium">{t('fields.colour')}</th>
                <th className="py-1.5 pr-3 font-medium">{t('fields.size')}</th>
                <th className="py-1.5 pr-3 font-medium">{t('glossary.ean')}</th>
                <th className="py-1.5 pr-3 font-medium">{t('fields.sku')}</th>
                <th className="py-1.5 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {sorted.map((v) => {
                const d = v.data as unknown as VariantData
                return (
                  <tr key={v.external_id}>
                    <td className="py-1.5 pr-3">
                      {localized(d.color.name, i18n.language) || d.color.code} <span className="text-xs text-stone-400">{d.color.code}</span>
                    </td>
                    <td className="py-1.5 pr-3">{d.size ?? '—'}</td>
                    <td className="py-1.5 pr-3 font-mono text-xs">{d.gtin ?? '—'}</td>
                    <td className="py-1.5 pr-3 font-mono text-xs">{d.sku ?? ''}</td>
                    <td className="py-1.5 text-right">
                      {v.status === 'unpublished' && <Badge>{t('catalog.unpublished')}</Badge>}{' '}
                      <Button size="sm" variant="ghost" onClick={() => setEditing(v)}>
                        {t('common.edit')}
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
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
  const [published, setPublished] = useState(record ? record.status === 'published' : true)
  const [touched, setTouched] = useState(false)
  const put = mutations.putVariant
  const server = put.error instanceof ApiError ? put.error.fieldErrors() : {}
  const digits = gtin.replace(/\s/g, '')
  const gtinErr = touched && digits && !gtinValid(digits) ? t('product.gtinInvalid') : (server['/gtin'] ?? (put.error instanceof ApiError && put.error.code === 'gtin_conflict' ? t('errors.gtin_conflict') : undefined))
  const codeErr = touched && !code.trim() ? t('validate.required') : null
  // Key convention: the GTIN as supplied, else style-colour-size.
  const externalId = record?.external_id ?? (digits || [productExternalId, code.trim(), size.trim()].filter(Boolean).join('-'))

  return (
    <Dialog
      open
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
              if (!code.trim() || (digits && !gtinValid(digits))) return
              put.mutate(
                {
                  id: externalId,
                  body: {
                    product_external_id: productExternalId,
                    gtin: digits || null,
                    sku: sku.trim() || null,
                    color: { code: code.trim(), name: cleanLocalized(colourName), supplier_color: supplierColour.trim() || null },
                    size: size.trim() || null,
                    size_system: sizeSystem.trim() || null,
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
        <TextField label={t('fields.sizeSystem')} value={sizeSystem} onChange={(e) => setSizeSystem(e.target.value)} placeholder="EU, INT, UK" />
      </div>
      <LocalizedInput label={t('fields.colourName')} value={colourName} onChange={setColourName} />
      <Checkbox label={t('product.sizePublished')} checked={published} onChange={(e) => setPublished(e.target.checked)} />
      <ErrorNote error={put.error ?? mutations.deleteVariant.error} />
    </Dialog>
  )
}
