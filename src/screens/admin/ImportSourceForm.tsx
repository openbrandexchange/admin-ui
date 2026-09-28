import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../api/client'
import type { ImportSource, ImportSourceInput } from '../../api/types'
import { urlProblem } from '../../lib/validate'
import { importSourcesQuery, useImportSourceMutations } from '../../queries/admin'
import { Button, Checkbox, Loading, PageHeader, Section, Segmented, SelectField, TextArea, TextField } from '../../ui/controls'
import { ErrorNote, Notice } from '../../ui/feedback'
import { IconChevronLeft } from '../../ui/icons'
import { TestResult } from './automation/ImportSourcesTab'

type Kind = 'https_url' | 'sftp' | 's3'
type Freq = 'manual' | 'hourly' | 'daily' | 'weekly'

export function ImportSourceNewScreen() {
  return <SourceForm />
}

export function ImportSourceEditScreen() {
  const { id } = useParams({ from: '/admin/automation/sources/$id' })
  const sources = useQuery(importSourcesQuery)
  if (sources.isPending) return <Loading />
  if (sources.isError) return <ErrorNote error={sources.error} onRetry={() => void sources.refetch()} />
  const source = sources.data.items.find((s) => s.id === id)
  if (!source) return <ErrorNote error={new ApiError(404, null)} />
  return <SourceForm source={source} />
}

function SourceForm({ source }: { source?: ImportSource }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const m = useImportSourceMutations()
  const cfg = (source?.config ?? {}) as Record<string, unknown>
  const set = source?.credentials_set ?? {}
  const [name, setName] = useState(source?.name ?? '')
  const [kind, setKind] = useState<Kind>(source?.kind ?? 'https_url')
  const [freq, setFreq] = useState<Freq>(source?.schedule.frequency ?? 'daily')
  const [time, setTime] = useState(source?.schedule.time ?? '02:30')
  const [weekday, setWeekday] = useState(source?.schedule.weekday ?? 1)
  const [mode, setMode] = useState<'upsert' | 'mirror'>(source?.mode ?? 'upsert')
  const [massOk, setMassOk] = useState(source?.allow_mass_unpublish ?? false)
  const [url, setUrl] = useState(String(cfg.url ?? ''))
  const [imagesUrl, setImagesUrl] = useState(String(cfg.images_url ?? ''))
  const [header, setHeader] = useState('')
  const [host, setHost] = useState(String(cfg.host ?? ''))
  const [port, setPort] = useState(String(cfg.port ?? '22'))
  const [username, setUsername] = useState(String(cfg.username ?? ''))
  const [path, setPath] = useState(String(cfg.path ?? '/'))
  const [password, setPassword] = useState('')
  const [privateKey, setPrivateKey] = useState('')
  const [endpoint, setEndpoint] = useState(String(cfg.endpoint ?? ''))
  const [region, setRegion] = useState(String(cfg.region ?? 'auto'))
  const [bucket, setBucket] = useState(String(cfg.bucket ?? ''))
  const [prefix, setPrefix] = useState(String(cfg.prefix ?? ''))
  const [pathStyle, setPathStyle] = useState(Boolean(cfg.path_style))
  const [accessKey, setAccessKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [touched, setTouched] = useState(false)

  const save = source ? m.update : m.create
  const server = save.error instanceof ApiError ? save.error.fieldErrors() : {}
  const unsafe = save.error instanceof ApiError && save.error.code === 'unsafe_url'
  const urlErr = touched && kind === 'https_url' && urlProblem(url) ? t('validate.url') : unsafe ? t('errors.unsafe_url') : server['/config/url']

  function build(): ImportSourceInput | null {
    if (!name.trim()) return null
    // On an update the body is a merge patch: a field that no longer applies is sent as null.
    const unset = source ? null : undefined
    const schedule = {
      frequency: freq,
      time: freq === 'daily' || freq === 'weekly' ? time : unset,
      weekday: freq === 'weekly' ? weekday : unset,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }
    let config: Record<string, unknown>
    const credentials: Record<string, unknown> = {}
    if (kind === 'https_url') {
      if (urlProblem(url)) return null
      config = { kind, url: url.trim(), images_url: imagesUrl.trim() || null }
      if (header.trim()) {
        const i = header.indexOf(':')
        credentials.headers = i > 0 ? { [header.slice(0, i).trim()]: header.slice(i + 1).trim() } : { Authorization: header.trim() }
      }
    } else if (kind === 'sftp') {
      if (!host.trim() || !username.trim() || !path.trim()) return null
      config = { kind, host: host.trim(), port: Number(port) || 22, username: username.trim(), path: path.trim(), host_key_fingerprint: cfg.host_key_fingerprint ?? null }
      if (password) credentials.password = password
      if (privateKey.trim()) credentials.private_key = privateKey
    } else {
      if (!bucket.trim()) return null
      config = { kind, endpoint: endpoint.trim() || null, region: region.trim() || 'auto', bucket: bucket.trim(), prefix: prefix.trim(), path_style: pathStyle }
      if (accessKey.trim()) credentials.access_key_id = accessKey.trim()
      if (secretKey) credentials.secret_access_key = secretKey
    }
    return {
      name: name.trim(),
      ...(source ? {} : { kind }),
      enabled: source?.enabled ?? true,
      schedule: schedule as never,
      mode,
      allow_mass_unpublish: mode === 'mirror' && massOk,
      config: config as never,
      ...(Object.keys(credentials).length ? { credentials: credentials as never } : {}),
    }
  }

  const stored = (flag: boolean | undefined) => (flag ? t('sources.stored') : undefined)
  const back = (
    <Link to="/admin/automation" className="inline-flex items-center gap-1 text-sm text-stone-600">
      <IconChevronLeft size={16} />
      {t('automation.title')}
    </Link>
  )

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader back={back} title={source ? source.name : t('sources.add')} description={t('sources.formIntro')} />
      <form
        className="space-y-6"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          setTouched(true)
          const body = build()
          if (!body) return
          if (source) m.update.mutate({ id: source.id, patch: body }, { onSuccess: () => void navigate({ to: '/admin/automation' }) })
          else m.create.mutate(body, { onSuccess: () => void navigate({ to: '/admin/automation' }) })
        }}
      >
        <Section title={t('sources.where')}>
          <TextField label={t('fields.name')} hint={t('sources.nameHint')} value={name} onChange={(e) => setName(e.target.value)} error={touched && !name.trim() ? t('validate.required') : null} />
          {!source && (
            <Segmented
              label={t('sources.kindLabel')}
              value={kind}
              onChange={setKind}
              options={(['https_url', 'sftp', 's3'] as const).map((k) => ({ value: k, label: t(`sources.kind.${k}`) }))}
            />
          )}
          {kind === 'https_url' && (
            <>
              <TextField label={t('sources.url')} hint={t('sources.urlHint')} type="url" value={url} onChange={(e) => setUrl(e.target.value)} error={urlErr} placeholder="https://" />
              <TextField label={t('sources.imagesUrl')} hint={t('sources.imagesUrlHint')} type="url" value={imagesUrl} onChange={(e) => setImagesUrl(e.target.value)} placeholder="https://" />
              <TextField label={t('sources.header')} hint={stored(!!set.headers?.length) ?? t('sources.headerHint')} value={header} onChange={(e) => setHeader(e.target.value)} placeholder="Authorization: Bearer …" autoComplete="off" />
            </>
          )}
          {kind === 'sftp' && (
            <>
              <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
                <TextField label={t('sources.host')} value={host} onChange={(e) => setHost(e.target.value)} error={touched && !host.trim() ? t('validate.required') : null} placeholder="sftp.example.com" />
                <TextField label={t('sources.port')} inputMode="numeric" value={port} onChange={(e) => setPort(e.target.value)} />
              </div>
              <TextField label={t('sources.username')} value={username} onChange={(e) => setUsername(e.target.value)} error={touched && !username.trim() ? t('validate.required') : null} autoComplete="off" />
              <TextField label={t('fields.password')} hint={stored(set.password)} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
              <TextArea label={t('sources.privateKey')} hint={stored(set.private_key) ?? t('sources.privateKeyHint')} value={privateKey} onChange={(e) => setPrivateKey(e.target.value)} className="[&_textarea]:font-mono [&_textarea]:text-xs" />
              <TextField label={t('sources.folder')} hint={t('sources.folderHint')} value={path} onChange={(e) => setPath(e.target.value)} />
              {typeof cfg.host_key_fingerprint === 'string' && <p className="font-mono text-xs text-stone-500">{t('sources.hostKey', { fp: cfg.host_key_fingerprint })}</p>}
            </>
          )}
          {kind === 's3' && (
            <>
              <TextField label={t('sources.endpoint')} hint={t('sources.endpointHint')} type="url" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="https://<account>.r2.cloudflarestorage.com" />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label={t('sources.bucket')} value={bucket} onChange={(e) => setBucket(e.target.value)} error={touched && !bucket.trim() ? t('validate.required') : null} />
                <TextField label={t('sources.region')} value={region} onChange={(e) => setRegion(e.target.value)} />
              </div>
              <TextField label={t('sources.prefix')} hint={t('sources.prefixHint')} value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="exports/obx/" />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label={t('sources.accessKey')} hint={stored(set.access_key_id)} value={accessKey} onChange={(e) => setAccessKey(e.target.value)} autoComplete="off" />
                <TextField label={t('sources.secretKey')} hint={stored(set.secret_access_key)} type="password" value={secretKey} onChange={(e) => setSecretKey(e.target.value)} autoComplete="new-password" />
              </div>
              <Checkbox label={t('sources.pathStyle')} hint={t('sources.pathStyleHint')} checked={pathStyle} onChange={(e) => setPathStyle(e.target.checked)} />
            </>
          )}
          <p className="text-xs text-stone-500">{t('sources.secretsNote')}</p>
        </Section>

        <Section title={t('sources.when')}>
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField label={t('sources.frequency')} value={freq} onChange={(e) => setFreq(e.target.value as Freq)}>
              {(['hourly', 'daily', 'weekly', 'manual'] as const).map((f) => (
                <option key={f} value={f}>
                  {t(`sources.freq.${f}`)}
                </option>
              ))}
            </SelectField>
            {freq === 'weekly' && (
              <SelectField label={t('sources.day')} value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <option key={d} value={d}>
                    {t(`sources.weekday.${d}`)}
                  </option>
                ))}
              </SelectField>
            )}
            {(freq === 'daily' || freq === 'weekly') && <TextField label={t('sources.time')} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}
          </div>
          <div className="space-y-2">
            <Segmented label={t('imports.mode')} value={mode} onChange={setMode} options={[{ value: 'upsert', label: t('imports.modeUpsert') }, { value: 'mirror', label: t('imports.modeMirror') }]} />
            <p className="text-xs text-stone-500">{mode === 'upsert' ? t('imports.modeUpsertHint') : t('imports.modeMirrorHint')}</p>
            {mode === 'mirror' && <Checkbox label={t('imports.massOk')} hint={t('imports.massOkHint')} checked={massOk} onChange={(e) => setMassOk(e.target.checked)} />}
          </div>
        </Section>

        <ErrorNote error={save.error} />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="primary" loading={save.isPending}>
            {source ? t('common.save') : t('sources.create')}
          </Button>
          {source && (
            <Button loading={m.test.isPending} onClick={() => m.test.mutate(source.id)}>
              {t('sources.test')}
            </Button>
          )}
        </div>
        {!source && <Notice>{t('sources.testAfterSave')}</Notice>}
        {m.test.data && <TestResult result={m.test.data} />}
        <ErrorNote error={m.test.error} />
      </form>
    </div>
  )
}
