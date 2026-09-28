import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import type { ProductData } from '../../api/types'
import { localized } from '../../lib/localized'
import { adminProductQuery, useProductMutations } from '../../queries/admin'
import { Loading, PageHeader, Section, Switch } from '../../ui/controls'
import { ConfirmButton, ErrorNote, Notice } from '../../ui/feedback'
import { IconChevronLeft, IconEye } from '../../ui/icons'
import { StatusBadges } from './Catalog'
import { ImagesSection } from './product/ImagesSection'
import { ProductForm } from './product/ProductForm'
import { VariantsSection } from './product/VariantsSection'

export function ProductEditScreen() {
  const { t, i18n } = useTranslation()
  const { externalId } = useParams({ from: '/admin/catalog/$externalId' })
  const navigate = useNavigate()
  const product = useQuery(adminProductQuery(externalId))
  const m = useProductMutations(externalId)

  const back = (
    <Link to="/admin/catalog" className="inline-flex items-center gap-1 text-sm text-stone-600">
      <IconChevronLeft size={16} />
      {t('catalog.title')}
    </Link>
  )
  if (product.isPending) return <Loading />
  if (product.isError)
    return (
      <div className="space-y-4">
        {back}
        <ErrorNote error={product.error} />
      </div>
    )

  const { record, variants, assets } = product.data
  const data = record.data as unknown as ProductData
  const published = record.status === 'published'

  return (
    <div className="space-y-6">
      <PageHeader
        back={back}
        title={
          <>
            <span className="mr-2 font-mono text-base text-stone-500">{data.style_number}</span>
            {localized(data.name, i18n.language)}
          </>
        }
        actions={
          record.visibility === 'visible' ? (
            <Link to="/products/$id" params={{ id: record.id }} className="inline-flex items-center gap-1.5 text-sm text-stone-600 underline underline-offset-2">
              <IconEye size={16} />
              {t('product.viewInPortal')}
            </Link>
          ) : undefined
        }
      />

      <Section title={t('product.publication')} description={t('product.publicationHint')} actions={<StatusBadges status={record.status} visibility={record.visibility} />}>
        <Switch checked={published} onChange={(v) => m.setStatus.mutate(v ? 'published' : 'unpublished')} label={t('product.publishedSwitch')} hint={published ? t('product.publishedOn') : t('product.publishedOff')} />
        {published && record.visibility === 'pending_files' && <Notice tone="warn">{t('product.pendingFilesHint')}</Notice>}
        <ErrorNote error={m.setStatus.error} />
      </Section>

      <Section title={t('product.details')}>
        <ProductForm key={record.etag} initial={data} lockStyle submitLabel={t('common.save')} pending={m.put.isPending} error={m.put.error} saved={m.put.isSuccess} onSubmit={(body) => m.put.mutate(body)} />
      </Section>

      <VariantsSection productExternalId={externalId} variants={variants} mutations={m} />
      <ImagesSection productExternalId={externalId} styleNumber={data.style_number} variants={variants} assets={assets} mutations={m} />

      <Section title={t('product.dangerZone')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-prose text-sm text-stone-600">{t('product.deleteHint')}</p>
          <ConfirmButton
            label={t('product.delete')}
            title={t('product.deleteTitle', { style: data.style_number })}
            body={t('product.deleteBody')}
            confirmLabel={t('product.delete')}
            onConfirm={async () => {
              await m.remove.mutateAsync()
              await navigate({ to: '/admin/catalog' })
            }}
          />
        </div>
      </Section>
    </div>
  )
}
