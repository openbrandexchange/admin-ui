import { Link, Outlet, useNavigate } from '@tanstack/react-router'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useState, type ReactNode } from 'react'
import { useApplyBranding } from '../lib/branding'
import { accessRequestsQuery, settingsQuery } from '../queries/admin'
import { sessionQuery, useLogout } from '../queries/session'
import { buttonClass, cx } from '../ui/controls'
import { IconBolt, IconBox, IconChart, IconCog, IconEye, IconHome, IconInbox, IconLogout, IconMenu, IconUpload, IconUsers, IconX } from '../ui/icons'
import { BrandMark, LanguageSwitcher, WorksWithBadge, SkipLink } from './common'

const linkCls = 'flex items-center gap-3 rounded-control px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900'
const activeCls = 'bg-white text-stone-900 shadow-xs ring-1 ring-stone-200 hover:bg-white'

export function AdminShell() {
  const { t } = useTranslation()
  const settings = useQuery(settingsQuery)
  const session = useQuery(sessionQuery)
  const pending = useInfiniteQuery(accessRequestsQuery('pending'))
  const logout = useLogout()
  const navigate = useNavigate()
  const [menu, setMenu] = useState(false)
  const name = settings.data?.branding?.display_name ?? settings.data?.company?.name ?? ''
  useApplyBranding(settings.data?.branding?.accent_color, name ? `${name} · ${t('admin.title')}` : t('admin.title'))
  const pendingCount = pending.data?.pages[0]?.items.length ?? 0

  const links: { to: string; label: string; icon: ReactNode; exact?: boolean; badge?: number }[] = [
    { to: '/admin', label: t('admin.nav.dashboard'), icon: <IconHome size={18} />, exact: true },
    { to: '/admin/catalog', label: t('admin.nav.catalog'), icon: <IconBox size={18} /> },
    { to: '/admin/imports', label: t('admin.nav.imports'), icon: <IconUpload size={18} /> },
    { to: '/admin/automation', label: t('admin.nav.automation'), icon: <IconBolt size={18} /> },
    { to: '/admin/retailers', label: t('admin.nav.retailers'), icon: <IconUsers size={18} /> },
    { to: '/admin/requests', label: t('admin.nav.requests'), icon: <IconInbox size={18} />, badge: pendingCount },
    { to: '/admin/stats', label: t('admin.nav.stats'), icon: <IconChart size={18} /> },
    { to: '/admin/settings', label: t('admin.nav.settings'), icon: <IconCog size={18} /> },
  ]

  const nav = (
    <nav aria-label={t('admin.nav.label')} className="space-y-0.5">
      {links.map((l) => (
        <Link key={l.to} to={l.to} onClick={() => setMenu(false)} activeOptions={{ exact: l.exact, includeSearch: false }} className={linkCls} activeProps={{ className: activeCls }}>
          {l.icon}
          <span className="flex-1">{l.label}</span>
          {!!l.badge && (
            <span className="rounded-full bg-accent px-1.5 text-xs text-accent-contrast tabular" aria-label={t('admin.nav.pendingCount', { count: l.badge })}>
              {l.badge}
            </span>
          )}
        </Link>
      ))}
    </nav>
  )

  const footer = (
    <div className="space-y-3 border-t border-stone-200 pt-4">
      <Link to="/" className={cx(linkCls)}>
        <IconEye size={18} />
        {t('admin.nav.viewPortal')}
      </Link>
      <div className="px-3">
        <LanguageSwitcher className="max-w-full" />
      </div>
      {/* Its own row: "Log out" is long in several languages and must never wrap next to the language picker. */}
      <button type="button" className={cx(linkCls, 'w-full')} onClick={() => logout.mutate(undefined, { onSettled: () => navigate({ to: '/login' }) })}>
        <IconLogout size={18} />
        <span className="min-w-0 flex-1 truncate text-left">{t('common.logout')}</span>
      </button>
      <p className="truncate px-3 text-xs text-stone-500">{session.data?.user?.email}</p>
    </div>
  )

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <SkipLink />
      <aside className="hidden border-r border-stone-200 bg-stone-100/60 lg:flex lg:flex-col lg:gap-6 lg:px-3 lg:py-5 lg:sticky lg:top-0 lg:h-dvh">
        <Link to="/admin" className="flex items-center gap-3 px-3">
          <BrandMark name={name} logo={settings.data?.branding?.logo_url} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{name}</span>
            <span className="block text-xs text-stone-500">{t('admin.title')}</span>
          </span>
        </Link>
        <div className="flex-1 overflow-y-auto">{nav}</div>
        {footer}
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-stone-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
          <Link to="/admin" className="flex items-center gap-2">
            <BrandMark name={name} logo={settings.data?.branding?.logo_url} />
            <span className="text-sm font-semibold">{name}</span>
          </Link>
          <button type="button" className={buttonClass('ghost', 'sm')} aria-expanded={menu} aria-controls="admin-menu" onClick={() => setMenu(!menu)}>
            {menu ? <IconX /> : <IconMenu />}
            <span className="sr-only">{t('common.menu')}</span>
          </button>
        </header>
        {menu && (
          <div id="admin-menu" className="border-b border-stone-200 bg-stone-50 px-3 py-3 lg:hidden">
            {nav}
            <div className="mt-3">{footer}</div>
          </div>
        )}
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-8 sm:py-8">
          <Outlet />
        </main>
        <footer className="flex justify-center py-6">
          <WorksWithBadge />
        </footer>
      </div>
    </div>
  )
}
