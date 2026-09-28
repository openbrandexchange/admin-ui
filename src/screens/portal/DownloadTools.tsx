// Download helpers shared by the portal screens: variant choice, one-click downloads with
// inline errors, and background jobs for large sets.
import { useState, type ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { downloadFile } from '../../lib/download'
import { usePref } from '../../lib/prefs'
import { csvDelimiter } from '../../i18n/languages'
import { useCreateDownloadJob, useViewer } from '../../queries/portal'
import type { DownloadJobInput } from '../../api/types'
import { Button, Checkbox, Segmented } from '../../ui/controls'
import { Dialog, ErrorNote, Notice } from '../../ui/feedback'
import { IconDownload } from '../../ui/icons'

export type DownloadVariant = 'original' | 'web' | 'square'
const VARIANTS = ['original', 'web', 'square'] as const

/** The remembered variant, never "original" when the viewer may not download originals. */
export function useVariant(): [DownloadVariant, (v: DownloadVariant) => void, DownloadVariant[]] {
  const viewer = useViewer()
  const allowed: DownloadVariant[] = viewer.data?.permissions.original_download ? [...VARIANTS] : ['web', 'square']
  const [v, setV] = usePref<DownloadVariant>('obx.variant', VARIANTS, allowed[0])
  return [allowed.includes(v) ? v : allowed[0], setV, allowed]
}

export function VariantPicker() {
  const { t } = useTranslation()
  const [variant, setVariant, allowed] = useVariant()
  return (
    <Segmented
      label={t('portal.variant.label')}
      value={variant}
      onChange={setVariant}
      options={allowed.map((v) => ({ value: v, label: t(`portal.variant.${v}`) }))}
    />
  )
}

export function VariantHelp() {
  const { t } = useTranslation()
  const [, , allowed] = useVariant()
  return (
    <ul className="space-y-0.5 text-xs text-stone-500">
      {allowed.map((v) => (
        <li key={v}>
          <strong className="font-medium text-stone-700">{t(`portal.variant.${v}`)}</strong> — {t(`portal.variant.${v}Help`)}
        </li>
      ))}
    </ul>
  )
}

/** A button that downloads an API file and shows problems inline next to it. */
export function DownloadButton({
  path,
  query,
  children,
  variant = 'secondary',
  size = 'md',
  fallbackName,
}: {
  path: string
  query?: Record<string, unknown>
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md'
  fallbackName: string
}) {
  const dl = useMutation({ mutationFn: () => downloadFile(path, query, fallbackName) })
  return (
    <span className="inline-flex flex-col gap-1">
      <Button variant={variant} size={size} loading={dl.isPending} onClick={() => dl.mutate()}>
        <IconDownload size={16} />
        {children}
      </Button>
      {dl.error && <ErrorNote error={dl.error} className="max-w-xs" />}
    </span>
  )
}

/** Article data as CSV; hidden when the brand switched article data export off. */
export function CsvButton({ path, query, children }: { path: string; query?: Record<string, unknown>; children: ReactNode }) {
  const { i18n } = useTranslation()
  const viewer = useViewer()
  if (!viewer.data?.permissions.article_data_export) return null
  return (
    <DownloadButton path={path} query={{ ...query, delimiter: csvDelimiter(i18n.language) }} fallbackName="products.csv">
      {children}
    </DownloadButton>
  )
}

/** "Prepare a zip" dialog for big sets: built in the background, the user gets an e-mail. */
export function BackgroundZipDialog({
  open,
  onClose,
  input,
  title,
  description,
}: {
  open: boolean
  onClose: () => void
  input: Omit<DownloadJobInput, 'variant' | 'include_data_csv'>
  title: ReactNode
  description?: ReactNode
}) {
  const { t } = useTranslation()
  const [variant] = useVariant()
  const viewer = useViewer()
  const [withCsv, setWithCsv] = useState(true)
  const create = useCreateDownloadJob()
  const canCsv = !!viewer.data?.permissions.article_data_export
  const close = () => {
    create.reset()
    onClose()
  }
  return (
    <Dialog
      open={open}
      onClose={close}
      title={title}
      footer={
        create.isSuccess ? (
          <Link to="/downloads" className="inline-flex h-10 items-center rounded-control bg-accent px-4 text-sm font-medium text-accent-contrast">
            {t('portal.jobs.goToDownloads')}
          </Link>
        ) : (
          <>
            <Button onClick={close}>{t('common.cancel')}</Button>
            <Button variant="primary" loading={create.isPending} onClick={() => create.mutate({ ...input, variant, include_data_csv: canCsv && withCsv })}>
              {t('portal.jobs.start')}
            </Button>
          </>
        )
      }
    >
      {create.isSuccess ? (
        <Notice tone="ok">{t('portal.jobs.started')}</Notice>
      ) : (
        <>
          {description && <p className="text-sm text-stone-600">{description}</p>}
          <div className="space-y-2">
            <VariantPicker />
            <VariantHelp />
          </div>
          {canCsv && <Checkbox label={t('portal.jobs.includeCsv')} checked={withCsv} onChange={(e) => setWithCsv(e.target.checked)} />}
          <ErrorNote error={create.error} />
        </>
      )}
    </Dialog>
  )
}
