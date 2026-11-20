import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../../api/client'
import { brandingImageUrl } from '../../../lib/branding'
import { formatBytes } from '../../../lib/format'
import { brandingImagesQuery, useBrandingImageMutations } from '../../../queries/admin'
import { Badge, Loading, Section } from '../../../ui/controls'
import { ConfirmButton, ErrorNote } from '../../../ui/feedback'
import { UploadButton } from './fields'

/** The images of the login page and the start page: upload, see where they are used, delete. */
export function ImageLibrary({ used }: { used: Set<string> }) {
  const { t, i18n } = useTranslation()
  const images = useQuery(brandingImagesQuery)
  const { remove } = useBrandingImageMutations()
  const [conflict, setConflict] = useState<string | null>(null)
  return (
    <Section title={t('appearance.images.title')} description={t('appearance.images.hint')} actions={<UploadButton multiple />}>
      {conflict && (
        <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {conflict}
        </p>
      )}
      {images.isPending ? (
        <Loading />
      ) : images.isError ? (
        <ErrorNote error={images.error} onRetry={() => void images.refetch()} />
      ) : !images.data.items.length ? (
        <p className="text-sm text-stone-600">{t('appearance.images.empty')}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3" aria-label={t('appearance.images.title')}>
          {images.data.items.map((img) => {
            const inUse = used.has(img.id) || !!img.used
            return (
              <li key={img.id} className="space-y-2">
                <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
                  <img src={brandingImageUrl(img.id, img.url) ?? ''} alt={t('appearance.images.alt', { width: img.width, height: img.height })} loading="lazy" className="size-full object-cover" />
                  {inUse && (
                    <span className="absolute left-2 top-2">
                      <Badge tone="accent">{t('appearance.images.used')}</Badge>
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-stone-600 tabular">
                    {img.width}×{img.height} · {formatBytes(img.bytes, i18n.language)}
                  </p>
                  <ConfirmButton
                    size="sm"
                    label={t('common.delete')}
                    title={t('appearance.images.deleteTitle')}
                    body={inUse ? t('appearance.images.deleteUsed') : t('appearance.images.deleteBody')}
                    confirmLabel={t('common.delete')}
                    onConfirm={async () => {
                      setConflict(null)
                      try {
                        await remove.mutateAsync(img.id)
                      } catch (e) {
                        if (e instanceof ApiError && e.status === 409) {
                          setConflict(t('appearance.images.conflict'))
                          return
                        }
                        throw e
                      }
                    }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}
