import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { IngestScope, IngestTokenWithSecret } from '../../../api/types'
import { formatDate, formatRelative } from '../../../lib/format'
import { brandsQuery, ingestTokensQuery, useIngestTokenMutations } from '../../../queries/admin'
import { Badge, Button, Checkbox, Loading, SecretOnce, Section, TextField } from '../../../ui/controls'
import { ConfirmButton, EmptyState, ErrorNote } from '../../../ui/feedback'
import { IconKey, IconPlus } from '../../../ui/icons'

const SCOPES: IngestScope[] = ['ingest:read', 'ingest:write', 'ingest:delete']

function Created({ created, nodeUrl, onRecipes, onDone }: { created: IngestTokenWithSecret; nodeUrl: string; onRecipes: () => void; onDone: () => void }) {
  const { t } = useTranslation()
  return (
    <SecretOnce label={t('tokens.secret', { name: created.token.name })} value={created.secret}>
      <p className="text-xs text-amber-950">{t('tokens.useWith', { url: nodeUrl })}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="primary" onClick={onRecipes}>
          {t('tokens.showRecipes')}
        </Button>
        <Button size="sm" onClick={onDone}>
          {t('apiKeys.savedIt')}
        </Button>
      </div>
    </SecretOnce>
  )
}

/** Keys for the brand's own systems (PIM, ERP, the obx tool, n8n …) to publish automatically. */
export function IngestTokensTab({ nodeUrl, onCreated, onShowRecipes }: { nodeUrl: string; onCreated: (secret: string) => void; onShowRecipes: () => void }) {
  const { t, i18n } = useTranslation()
  const tokens = useQuery(ingestTokensQuery)
  const brands = useQuery(brandsQuery)
  const m = useIngestTokenMutations()
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<IngestScope[]>(['ingest:read', 'ingest:write'])
  const [onlyBrands, setOnlyBrands] = useState<string[]>([])
  const [expires, setExpires] = useState('')
  const [shown, setShown] = useState<IngestTokenWithSecret | null>(null)
  const lang = i18n.language
  const show = (r: IngestTokenWithSecret) => {
    setShown(r)
    onCreated(r.secret)
  }
  const brandList = brands.data?.items ?? []

  return (
    <div className="space-y-6">
      <p className="max-w-prose text-sm text-stone-600">{t('tokens.intro')}</p>
      {shown && <Created created={shown} nodeUrl={nodeUrl} onRecipes={onShowRecipes} onDone={() => setShown(null)} />}
      {tokens.isPending ? (
        <Loading />
      ) : tokens.isError ? (
        <ErrorNote error={tokens.error} />
      ) : tokens.data.items.length === 0 ? (
        <EmptyState title={t('tokens.emptyTitle')}>{t('tokens.empty')}</EmptyState>
      ) : (
        <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
          {tokens.data.items.map((tk) => (
            <li key={tk.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <IconKey className="text-stone-400" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {tk.name} {tk.status !== 'active' && <Badge tone="red">{t(`tokens.status.${tk.status}`)}</Badge>}
                </p>
                <p className="font-mono text-xs text-stone-500">{tk.prefix}…</p>
                <p className="text-xs text-stone-500">
                  {tk.scopes.map((s) => t(`tokens.scope.${s}`)).join(', ')}
                  {tk.brand_external_ids?.length ? ` · ${tk.brand_external_ids.join(', ')}` : ` · ${t('tokens.allBrands')}`}
                  {' · '}
                  {tk.last_used_at ? t('apiKeys.lastUsed', { when: formatRelative(tk.last_used_at, lang) }) : t('apiKeys.neverUsed')}
                  {tk.expires_at && ` · ${t('tokens.expires', { date: formatDate(tk.expires_at, lang) })}`}
                </p>
              </div>
              {tk.status === 'active' && (
                <>
                  <ConfirmButton size="sm" variant="secondary" label={t('apiKeys.rotate')} title={t('apiKeys.rotateTitle')} body={t('tokens.rotateBody')} confirmLabel={t('apiKeys.rotate')} onConfirm={async () => show(await m.rotate.mutateAsync(tk.id))} />
                  <ConfirmButton size="sm" label={t('apiKeys.revoke')} title={t('apiKeys.revokeTitle')} body={t('tokens.revokeBody')} confirmLabel={t('apiKeys.revoke')} onConfirm={() => m.revoke.mutateAsync(tk.id)} />
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <Section title={t('tokens.new')} description={t('tokens.newHint')}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim() || !scopes.length) return
            m.create.mutate(
              { name: name.trim(), scopes, brand_external_ids: onlyBrands.length ? onlyBrands : null, expires_at: expires ? new Date(expires + 'T23:59:59Z').toISOString() : null },
              {
                onSuccess: (r) => {
                  show(r)
                  setName('')
                },
              },
            )
          }}
        >
          <TextField label={t('tokens.name')} hint={t('tokens.nameHint')} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('tokens.namePlaceholder')} />
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t('tokens.may')}</legend>
            {SCOPES.map((s) => (
              <Checkbox key={s} label={t(`tokens.scope.${s}`)} hint={t(`tokens.scopeHint.${s}`)} checked={scopes.includes(s)} onChange={(e) => setScopes(e.target.checked ? [...scopes, s] : scopes.filter((x) => x !== s))} />
            ))}
          </fieldset>
          {brandList.length > 1 && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t('tokens.brands')}</legend>
              <p className="text-xs text-stone-500">{t('tokens.brandsHint')}</p>
              {brandList.map((b) => (
                <Checkbox
                  key={b.external_id}
                  label={(b.data as { name?: string }).name ?? b.external_id}
                  checked={onlyBrands.includes(b.external_id)}
                  onChange={(e) => setOnlyBrands(e.target.checked ? [...onlyBrands, b.external_id] : onlyBrands.filter((x) => x !== b.external_id))}
                />
              ))}
            </fieldset>
          )}
          <TextField label={t('tokens.expiresLabel')} hint={t('tokens.expiresHint')} type="date" value={expires} onChange={(e) => setExpires(e.target.value)} className="max-w-60" />
          <ErrorNote error={m.create.error ?? m.rotate.error ?? m.revoke.error} />
          <Button type="submit" variant="primary" loading={m.create.isPending} disabled={!name.trim() || !scopes.length}>
            <IconPlus size={16} />
            {t('tokens.create')}
          </Button>
        </form>
      </Section>
    </div>
  )
}
