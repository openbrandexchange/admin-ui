import { useState } from 'react'
import type { UseMutationResult } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { ApiClient, ApiClientWithSecret } from '../../api/types'
import { formatRelative } from '../../lib/format'
import { Badge, Button, CopyButton, SecretOnce, TextField } from '../../ui/controls'
import { ConfirmButton, EmptyState, ErrorNote } from '../../ui/feedback'
import { IconKey, IconPlus } from '../../ui/icons'

/** What a developer needs, shown once right after creating or rotating an API key. */
export function ApiKeyCreated({ created, onDone }: { created: ApiClientWithSecret; onDone: () => void }) {
  const { t } = useTranslation()
  const curl = `curl -s -X POST ${created.token_endpoint} \\
  -d grant_type=client_credentials \\
  -d client_id=${created.client.client_id} \\
  -d client_secret=${created.client_secret}`
  return (
    <SecretOnce label={t('apiKeys.secret')} value={created.client_secret}>
      <dl className="grid gap-2 text-xs text-amber-950 sm:grid-cols-[auto_1fr]">
        <dt className="font-semibold">{t('apiKeys.clientId')}</dt>
        <dd className="font-mono break-all">{created.client.client_id}</dd>
        <dt className="font-semibold">{t('apiKeys.tokenUrl')}</dt>
        <dd className="font-mono break-all">{created.token_endpoint}</dd>
        <dt className="font-semibold">{t('apiKeys.discovery')}</dt>
        <dd className="font-mono break-all">{created.discovery_url}</dd>
      </dl>
      <details className="text-xs">
        <summary className="cursor-pointer font-medium text-amber-950">{t('apiKeys.forDevelopers')}</summary>
        <pre tabIndex={0} className="mt-2 overflow-x-auto rounded bg-stone-900 p-3 text-[11px] text-stone-100">{curl}</pre>
        <CopyButton value={curl} />
      </details>
      <Button size="sm" variant="primary" onClick={onDone}>
        {t('apiKeys.savedIt')}
      </Button>
    </SecretOnce>
  )
}

export function ApiKeyList({
  clients,
  create,
  rotate,
  revoke,
  canCreate = true,
}: {
  clients: ApiClient[]
  create: UseMutationResult<ApiClientWithSecret, Error, string>
  rotate: UseMutationResult<ApiClientWithSecret, Error, string>
  revoke: UseMutationResult<unknown, Error, string>
  canCreate?: boolean
}) {
  const { t, i18n } = useTranslation()
  const [name, setName] = useState('')
  const [shown, setShown] = useState<ApiClientWithSecret | null>(null)
  const active = clients.filter((c) => c.status === 'active')
  return (
    <div className="space-y-4">
      {shown && <ApiKeyCreated created={shown} onDone={() => setShown(null)} />}
      {active.length === 0 ? (
        <EmptyState title={t('apiKeys.emptyTitle')}>{t('apiKeys.empty')}</EmptyState>
      ) : (
        <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200">
          {active.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <IconKey className="text-stone-400" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{c.name}</p>
                <p className="font-mono text-xs text-stone-500">{c.client_id}</p>
                <p className="text-xs text-stone-500">
                  {c.last_used_at ? t('apiKeys.lastUsed', { when: formatRelative(c.last_used_at, i18n.language) }) : t('apiKeys.neverUsed')}
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                {c.scopes.includes('media:original') && <Badge>{t('apiKeys.originals')}</Badge>}
              </div>
              <ConfirmButton
                size="sm"
                variant="secondary"
                label={t('apiKeys.rotate')}
                title={t('apiKeys.rotateTitle')}
                body={t('apiKeys.rotateBody')}
                confirmLabel={t('apiKeys.rotate')}
                onConfirm={async () => setShown(await rotate.mutateAsync(c.id))}
              />
              <ConfirmButton size="sm" label={t('apiKeys.revoke')} title={t('apiKeys.revokeTitle')} body={t('apiKeys.revokeBody')} confirmLabel={t('apiKeys.revoke')} onConfirm={() => revoke.mutateAsync(c.id)} />
            </li>
          ))}
        </ul>
      )}
      {canCreate && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim()) return
            create.mutate(name.trim(), {
              onSuccess: (r) => {
                setShown(r)
                setName('')
              },
            })
          }}
        >
          <TextField className="min-w-60 flex-1" label={t('apiKeys.name')} hint={t('apiKeys.nameHint')} value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" loading={create.isPending} disabled={!name.trim()}>
            <IconPlus size={16} />
            {t('apiKeys.create')}
          </Button>
        </form>
      )}
      <ErrorNote error={create.error ?? rotate.error ?? revoke.error} />
    </div>
  )
}
