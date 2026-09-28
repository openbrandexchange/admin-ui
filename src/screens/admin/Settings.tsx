import { Link, useSearch } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { SettingsTab } from '../../router'
import { settingsQuery } from '../../queries/admin'
import { Loading, PageHeader, cx } from '../../ui/controls'
import { ErrorNote, tabListKeys } from '../../ui/feedback'
import { PasswordSection, ProfileSection } from '../shared/AccountForms'
import { BrandTab } from './settings/BrandTab'
import { DefaultsTab } from './settings/DefaultsTab'
import { PortalTab } from './settings/PortalTab'
import { SystemTab } from './settings/SystemTab'
import { TeamTab } from './settings/TeamTab'

const TABS: SettingsTab[] = ['brand', 'portal', 'defaults', 'team', 'account', 'system']

export function SettingsScreen() {
  const { t } = useTranslation()
  const { tab = 'brand' } = useSearch({ from: '/admin/settings' })
  const settings = useQuery(settingsQuery)
  return (
    <div className="space-y-6">
      <PageHeader title={t('settings.title')} />
      <div role="tablist" aria-label={t('settings.title')} className="flex flex-wrap gap-1 border-b border-stone-200">
        {TABS.map((id) => (
          <Link key={id} role="tab" onKeyDown={tabListKeys} aria-selected={tab === id} to="/admin/settings" search={{ tab: id === 'brand' ? undefined : id }} className={cx('-mb-px border-b-2 px-3 py-2 text-sm font-medium', tab === id ? 'border-accent text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-800')}>
            {t(`settings.tab.${id}`)}
          </Link>
        ))}
      </div>
      <div role="tabpanel" className="max-w-3xl space-y-6">
        {tab === 'account' ? (
          <>
            <ProfileSection />
            <PasswordSection />
          </>
        ) : tab === 'team' ? (
          <TeamTab />
        ) : settings.isPending ? (
          <Loading />
        ) : settings.isError ? (
          <ErrorNote error={settings.error} onRetry={() => void settings.refetch()} />
        ) : tab === 'brand' ? (
          <BrandTab settings={settings.data} />
        ) : tab === 'portal' ? (
          <PortalTab settings={settings.data} />
        ) : tab === 'defaults' ? (
          <DefaultsTab settings={settings.data} />
        ) : (
          <SystemTab settings={settings.data} />
        )}
      </div>
    </div>
  )
}
