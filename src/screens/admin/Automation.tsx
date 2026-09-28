import { tabListKeys } from '../../ui/feedback'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import type { AutomationTab } from '../../router'
import { settingsQuery } from '../../queries/admin'
import { PageHeader, cx } from '../../ui/controls'
import { ImportSourcesTab } from './automation/ImportSourcesTab'
import { IngestTokensTab } from './automation/IngestTokensTab'
import { RecipesTab } from './automation/RecipesTab'
import { WebhooksTab } from './automation/WebhooksTab'

const TABS: AutomationTab[] = ['sources', 'tokens', 'recipes', 'webhooks']

/** Everything that makes publishing happen by itself. */
export function AutomationScreen() {
  const { t } = useTranslation()
  const { tab = 'sources' } = useSearch({ from: '/admin/automation' })
  const navigate = useNavigate({ from: '/admin/automation' })
  const settings = useQuery(settingsQuery)
  // A token created on the Tokens tab fills in the recipes until the page is left.
  const [freshToken, setFreshToken] = useState<string | undefined>()
  const nodeUrl = settings.data?.node?.public_url ?? window.location.origin
  return (
    <div className="space-y-6">
      <PageHeader title={t('automation.title')} description={t('automation.intro')} />
      <div role="tablist" aria-label={t('automation.title')} className="flex flex-wrap gap-1 border-b border-stone-200">
        {TABS.map((id) => (
          <Link
            key={id}
            role="tab"
            onKeyDown={tabListKeys}
            aria-selected={tab === id}
            to="/admin/automation"
            search={{ tab: id === 'sources' ? undefined : id }}
            className={cx('-mb-px border-b-2 px-3 py-2 text-sm font-medium', tab === id ? 'border-accent text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-800')}
          >
            {t(`automation.tab.${id}`)}
          </Link>
        ))}
      </div>
      <div role="tabpanel">
        {tab === 'sources' && <ImportSourcesTab />}
        {tab === 'tokens' && (
          <IngestTokensTab
            nodeUrl={nodeUrl}
            onCreated={(secret) => {
              setFreshToken(secret)
            }}
            onShowRecipes={() => void navigate({ search: { tab: 'recipes' } })}
          />
        )}
        {tab === 'recipes' && <RecipesTab nodeUrl={nodeUrl} token={freshToken} />}
        {tab === 'webhooks' && <WebhooksTab />}
      </div>
    </div>
  )
}
