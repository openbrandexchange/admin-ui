import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { portalApiClientsQuery, usePortalApiClientMutations, useViewer } from '../../queries/portal'
import { Loading, Section } from '../../ui/controls'
import { ErrorNote } from '../../ui/feedback'
import { PasswordSection, ProfileSection } from '../shared/AccountForms'
import { ApiKeyList } from '../shared/ApiKeys'

export function AccountScreen() {
  const { t } = useTranslation()
  const viewer = useViewer()
  const selfService = !!viewer.data?.permissions.api_self_service && !viewer.data.preview
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('account.title')}</h1>
      {viewer.data?.retailer && <p className="text-sm text-stone-600">{t('account.retailer', { retailer: viewer.data.retailer.name })}</p>}
      <ProfileSection />
      <PasswordSection />
      {selfService && <PortalApiKeys />}
    </div>
  )
}

function PortalApiKeys() {
  const { t } = useTranslation()
  const clients = useQuery(portalApiClientsQuery)
  const m = usePortalApiClientMutations()
  return (
    <Section title={t('glossary.apiKey')} description={t('account.apiKeysHint')}>
      {clients.isPending ? <Loading /> : clients.isError ? <ErrorNote error={clients.error} onRetry={() => void clients.refetch()} /> : <ApiKeyList clients={clients.data.items} create={m.create} rotate={m.rotate} revoke={m.revoke} />}
    </Section>
  )
}
