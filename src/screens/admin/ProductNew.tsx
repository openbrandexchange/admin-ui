import { Link, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useCreateProduct } from '../../queries/admin'
import { PageHeader, Section } from '../../ui/controls'
import { IconChevronLeft } from '../../ui/icons'
import { ProductForm } from './product/ProductForm'

export function ProductNewScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const create = useCreateProduct()
  return (
    <div className="max-w-3xl">
      <PageHeader
        back={
          <Link to="/admin/catalog" className="inline-flex items-center gap-1 text-sm text-stone-600">
            <IconChevronLeft size={16} />
            {t('catalog.title')}
          </Link>
        }
        title={t('catalog.newProduct')}
        description={t('product.newIntro')}
      />
      <Section title={t('product.details')}>
        <ProductForm
          submitLabel={t('product.create')}
          pending={create.isPending}
          error={create.error}
          onSubmit={(body) =>
            create.mutate(
              { id: body.style_number, body: { ...body, status: 'unpublished' } },
              { onSuccess: () => void navigate({ to: '/admin/catalog/$externalId', params: { externalId: body.style_number } }) },
            )
          }
        />
      </Section>
    </div>
  )
}
