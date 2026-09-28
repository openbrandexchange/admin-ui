import { useTranslation } from 'react-i18next'
import type { Settings } from '../../../api/types'
import { formatBytes, formatRelative } from '../../../lib/format'
import { Badge, CopyButton, Section } from '../../../ui/controls'

/** Read-only facts about this installation, and how to point your own domain at it. */
export function SystemTab({ settings }: { settings: Settings }) {
  const { t, i18n } = useTranslation()
  const n = settings.node ?? {}
  const rows: [string, React.ReactNode][] = [
    [t('settings.address'), n.public_url ? <span className="flex items-center gap-2 font-mono text-xs">{n.public_url} <CopyButton value={n.public_url} /></span> : '—'],
    [t('settings.softwareAddress'), n.discovery_url ? <span className="flex items-center gap-2 font-mono text-xs">{n.discovery_url} <CopyButton value={n.discovery_url} /></span> : '—'],
    [t('settings.software'), `${n.software ?? '—'} ${n.version ?? ''}`],
    [t('settings.email'), n.email_configured ? <Badge tone="green">{t('settings.emailOn')}</Badge> : <Badge tone="amber">{t('settings.emailOff')}</Badge>],
    [t('settings.imageVersions'), n.renditions_server_generated ? t('settings.imageVersionsServer') : t('settings.imageVersionsBrowser')],
    [t('settings.maxUpload'), formatBytes(n.max_upload_bytes, i18n.language) || '—'],
  ]
  // Nodes on ordinary web hosting need a cron job; show its address again after installation.
  if (n.cron?.url) {
    rows.push([
      t('settings.cron'),
      <div className="space-y-1">
        <span className="flex items-center gap-2 font-mono text-xs break-all">
          {n.cron.url} <CopyButton value={n.cron.url} />
        </span>
        <p className="text-xs text-stone-500">{t('settings.cronHint')}</p>
        <p className="text-xs text-stone-500">{n.cron.last_run_at ? t('settings.cronLastRun', { when: formatRelative(n.cron.last_run_at, i18n.language) }) : t('settings.cronNever')}</p>
      </div>,
    ])
  }
  return (
    <>
      <Section title={t('settings.system')} description={t('settings.systemHint')}>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[12rem_1fr]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-medium text-stone-600">{k}</dt>
              <dd className="min-w-0">{v}</dd>
            </div>
          ))}
        </dl>
        {!n.email_configured && <p className="text-xs text-stone-500">{t('settings.emailOffHint')}</p>}
      </Section>
      <Section title={t('settings.domain')} description={t('settings.domainHint')}>
        {n.custom_domain_help ? <div className="whitespace-pre-wrap rounded-lg bg-stone-50 p-4 text-sm text-stone-700">{n.custom_domain_help}</div> : <p className="text-sm text-stone-500">{t('settings.domainNone')}</p>}
      </Section>
    </>
  )
}
