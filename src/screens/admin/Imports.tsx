import { useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import type { ImportRun } from '../../api/types'
import { downloadFile } from '../../lib/download'
import { formatBytes, formatRelative } from '../../lib/format'
import { collectImportFiles, prepareImages, startImport, type ImportFiles, type UploadProgress } from '../../lib/upload'
import { excelTemplateUrls, importRunsQuery, importTemplateUrl, settingsQuery } from '../../queries/admin'
import { Badge, Button, Checkbox, Loading, PageHeader, Section, Segmented, cx } from '../../ui/controls'
import { EmptyState, ErrorNote, LoadMore, Notice } from '../../ui/feedback'
import { IconDownload, IconFile, IconImage, IconUpload } from '../../ui/icons'

export const RUN_TONE: Record<ImportRun['status'], 'neutral' | 'blue' | 'green' | 'red'> = { queued: 'neutral', running: 'blue', succeeded: 'green', failed: 'red' }

export function RunSummary({ run }: { run: ImportRun }) {
  const { t } = useTranslation()
  const c = run.counts
  return (
    <span className="text-xs text-stone-500">
      {t('imports.summary', { created: c.created, updated: c.updated, unchanged: c.unchanged })}
      {c.unpublished > 0 && ` · ${t('imports.unpublishedCount', { count: c.unpublished })}`}
      {c.errors > 0 && <span className="text-red-700"> · {t('imports.errorsCount', { count: c.errors })}</span>}
      {c.warnings > 0 && <span className="text-amber-700"> · {t('imports.warningsCount', { count: c.warnings })}</span>}
    </span>
  )
}

function DropZone({ onFiles, disabled }: { onFiles: (files: File[]) => void; disabled: boolean }) {
  const { t } = useTranslation()
  const [over, setOver] = useState(false)
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        if (!disabled) onFiles([...e.dataTransfer.files])
      }}
      className={cx('flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors', over ? 'border-accent bg-accent-soft' : 'border-stone-300 bg-stone-50')}
    >
      <IconUpload size={28} className="text-stone-400" />
      <p className="text-sm font-medium">{t('imports.drop')}</p>
      <p className="max-w-md text-xs text-stone-500">{t('imports.dropHint')}</p>
      <label className={cx('inline-flex h-10 cursor-pointer items-center gap-2 rounded-control bg-white px-4 text-sm font-medium shadow-xs ring-1 ring-stone-300 focus-within:outline-2 focus-within:outline-accent', disabled && 'pointer-events-none opacity-50')}>
        {t('imports.choose')}
        <input
          type="file"
          multiple
          accept=".csv,.xlsx,.zip,image/*,.tif,.tiff"
          className="sr-only"
          data-testid="import-file-input"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])]
            e.target.value = ''
            if (files.length) onFiles(files)
          }}
        />
      </label>
    </div>
  )
}

function UploadCard() {
  const { t, i18n } = useTranslation()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const settings = useQuery(settingsQuery)
  const serverRenders = settings.data?.node?.renditions_server_generated ?? true
  const [files, setFiles] = useState<ImportFiles | null>(null)
  const [mode, setMode] = useState<'upsert' | 'mirror'>('upsert')
  const [dryRun, setDryRun] = useState(false)
  const [massOk, setMassOk] = useState(false)
  const [phase, setPhase] = useState<{ step: 'images'; p: UploadProgress } | { step: 'csv'; fraction: number } | null>(null)

  const collect = useMutation({ mutationFn: collectImportFiles, onSuccess: setFiles })
  const run = useMutation({
    mutationFn: async () => {
      if (!files) throw new Error('no files')
      const prepared = await prepareImages(files.images, serverRenders, (p) => setPhase({ step: 'images', p }))
      const failed = prepared.filter((x) => x.error)
      setPhase({ step: 'csv', fraction: 0 })
      const result = await startImport(
        {
          csv: files.csv,
          assetsCsv: files.assetsCsv,
          manifest: prepared.flatMap((x) => (x.entry ? [x.entry] : [])),
          options: { mode, dry_run: dryRun, ...(mode === 'mirror' && massOk && { allow_mass_unpublish: true }) },
        },
        (fraction) => setPhase({ step: 'csv', fraction }),
      )
      return { result, failed }
    },
    onSuccess: ({ result }) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'imports'] })
      void navigate({ to: '/admin/imports/$id', params: { id: result.id } })
    },
    onSettled: () => setPhase(null),
  })

  const busy = collect.isPending || run.isPending
  const nothing = files && !files.csv && !files.assetsCsv && files.images.length === 0

  return (
    <Section
      title={t('imports.uploadTitle')}
      description={t('imports.uploadIntro')}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="font-medium text-stone-800">{t('imports.templates')}</span>
        {(['products', 'assets'] as const).map((k) => (
          <a key={k} href={excelTemplateUrls[k]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent-strong underline underline-offset-2">
            <IconDownload size={16} />
            {t(`imports.excel.${k}`)}
          </a>
        ))}
        <Button size="sm" variant="ghost" onClick={() => void downloadFile(importTemplateUrl, undefined, 'products-template.csv')}>
          <IconDownload size={16} />
          {t('imports.template')}
        </Button>
      </div>
      <DropZone onFiles={(f) => collect.mutate(f)} disabled={busy} />
      <ErrorNote error={collect.error} />
      {files && (
        <div className="space-y-4">
          <ul className="space-y-1 text-sm">
            {files.csv && (
              <li className="flex items-center gap-2">
                <IconFile size={16} className="text-stone-400" /> {files.csv.name} <span className="text-xs text-stone-500">{formatBytes(files.csv.size, i18n.language)}</span>
              </li>
            )}
            {files.assetsCsv && (
              <li className="flex items-center gap-2">
                <IconFile size={16} className="text-stone-400" /> {files.assetsCsv.name}
              </li>
            )}
            {files.images.length > 0 && (
              <li className="flex items-center gap-2">
                <IconImage size={16} className="text-stone-400" /> {t('imports.imagesFound', { count: files.images.length })}
              </li>
            )}
            {files.ignored.length > 0 && <li className="text-xs text-stone-500">{t('imports.ignored', { count: files.ignored.length, names: files.ignored.slice(0, 5).join(', ') })}</li>}
          </ul>
          {files.otherSheets.length > 0 && <Notice tone="warn">{t('imports.otherSheet', { names: files.otherSheets.slice(0, 5).join(', ') })}</Notice>}
          {nothing && <Notice tone="warn">{t('imports.nothing')}</Notice>}
          <div className="space-y-2">
            <Segmented
              label={t('imports.mode')}
              value={mode}
              onChange={setMode}
              options={[
                { value: 'upsert', label: t('imports.modeUpsert') },
                { value: 'mirror', label: t('imports.modeMirror') },
              ]}
            />
            <p className="text-xs text-stone-500">{mode === 'upsert' ? t('imports.modeUpsertHint') : t('imports.modeMirrorHint')}</p>
            {mode === 'mirror' && <Checkbox label={t('imports.massOk')} hint={t('imports.massOkHint')} checked={massOk} onChange={(e) => setMassOk(e.target.checked)} />}
          </div>
          <Checkbox label={t('imports.dryRun')} hint={t('imports.dryRunHint')} checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
          {phase && (
            <div className="space-y-1" aria-live="polite">
              <p className="text-sm">
                {phase.step === 'images'
                  ? t(serverRenders ? 'imports.progressImages' : 'imports.progressImagesClient', { done: phase.p.done, total: phase.p.total, uploaded: phase.p.uploaded })
                  : t('imports.progressCsv', { pct: Math.round(phase.fraction * 100) })}
              </p>
              <div className="h-1.5 overflow-hidden rounded-full bg-stone-100" role="progressbar" aria-label={t('imports.progress')}>
                <div className="h-full bg-accent transition-all" style={{ width: `${phase.step === 'images' ? (phase.p.total ? (phase.p.done / phase.p.total) * 100 : 0) : phase.fraction * 100}%` }} />
              </div>
            </div>
          )}
          <ErrorNote error={run.error} />
          <div className="flex gap-2">
            <Button variant="primary" loading={run.isPending} disabled={!!nothing} onClick={() => run.mutate()}>
              {dryRun ? t('imports.startCheck') : t('imports.start')}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setFiles(null)}>
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      )}
      <div className="space-y-1.5 rounded-lg bg-stone-50 p-3 text-sm text-stone-600">
        <h3 className="font-medium text-stone-800">{t('imports.namingTitle')}</h3>
        <p>{t('imports.namingIntro')}</p>
        <p className="font-mono text-xs text-stone-800">
          <span className="font-semibold">KO-1001_NVY_1.jpg</span> · KO-1001_NVY_2_back.jpg · KO-1003_RST_3_model.png
        </p>
        <p className="text-xs">{t('imports.namingHint')}</p>
      </div>
    </Section>
  )
}

export function ImportsScreen() {
  const { t, i18n } = useTranslation()
  const runs = useInfiniteQuery(importRunsQuery)
  const items = runs.data?.pages.flatMap((p) => p.items) ?? []
  return (
    <div className="space-y-6">
      <PageHeader
        title={t('imports.title')}
        description={t('imports.intro')}
        actions={
          <Link to="/admin/automation" className="text-sm text-stone-600 underline underline-offset-2">
            {t('imports.automateLink')}
          </Link>
        }
      />
      <UploadCard />
      <Section title={t('imports.history')}>
        {runs.isPending ? (
          <Loading />
        ) : runs.isError ? (
          <ErrorNote error={runs.error} onRetry={() => void runs.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState title={t('imports.emptyTitle')}>{t('imports.empty')}</EmptyState>
        ) : (
          <ul className="divide-y divide-stone-100">
            {items.map((r) => (
              <li key={r.id}>
                <Link to="/admin/imports/$id" params={{ id: r.id }} className="flex flex-wrap items-center gap-3 py-2.5 hover:bg-stone-50">
                  <Badge tone={RUN_TONE[r.status]}>{t(`imports.status.${r.status}`)}</Badge>
                  <span className="text-sm">
                    {t(`imports.trigger.${r.trigger}`)}
                    {r.dry_run && <span className="text-stone-500"> · {t('imports.checkOnly')}</span>}
                    {r.mode === 'mirror' && <span className="text-stone-500"> · {t('imports.modeMirror')}</span>}
                  </span>
                  <RunSummary run={r} />
                  <span className="ml-auto text-xs text-stone-500">{formatRelative(r.created_at, i18n.language)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <LoadMore hasNext={!!runs.hasNextPage} fetching={runs.isFetchingNextPage} onMore={() => void runs.fetchNextPage()} />
      </Section>
    </div>
  )
}
