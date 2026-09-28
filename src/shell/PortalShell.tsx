import { Link, Outlet, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { useApplyBranding, usePortalTitle } from '../lib/branding'
import { selectionQuery, viewerQuery } from '../queries/portal'
import { sessionQuery, useLogout } from '../queries/session'
import { Loading, cx, buttonClass } from '../ui/controls'
import { ErrorNote } from '../ui/feedback'
import { IconBarcode, IconDownload, IconGrid, IconList, IconLogout, IconMenu, IconUser, IconX } from '../ui/icons'
import { BrandMark, LanguageSwitcher, WorksWithBadge } from './common'

const navCls = 'inline-flex items-center gap-2 rounded-control px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900'
const activeCls = 'bg-accent-soft text-accent-strong hover:bg-accent-soft hover:text-accent-strong'

export function PortalShell() {
  const { t } = useTranslation()
  const viewer = useQuery(viewerQuery)
  const session = useQuery(sessionQuery)
  const selection = useQuery(selectionQuery)
  const logout = useLogout()
  const navigate = useNavigate()
  const [menu, setMenu] = useState(false)
  const branding = viewer.data?.branding
  const title = usePortalTitle(branding)
  useApplyBranding(branding?.accent_color, title.full)

  if (viewer.isPending) return <Loading />
  if (viewer.isError) return <div className="p-6"><ErrorNote error={viewer.error} onRetry={() => void viewer.refetch()} /></div>

  const count = selection.data?.product_ids.length ?? viewer.data.selection_count ?? 0
  const links = [
    { to: '/' as const, label: t('portal.nav.catalog'), icon: <IconGrid size={16} />, exact: true },
    { to: '/ean' as const, label: t('portal.nav.ean'), icon: <IconBarcode size={16} /> },
    { to: '/selection' as const, label: t('portal.nav.selection'), icon: <IconList size={16} />, badge: count },
    { to: '/downloads' as const, label: t('portal.nav.downloads'), icon: <IconDownload size={16} /> },
    { to: '/account' as const, label: t('portal.nav.account'), icon: <IconUser size={16} /> },
  ]

  return (
    <div className="flex min-h-dvh flex-col">
      {viewer.data.preview && (
        <div className="bg-stone-900 px-4 py-2 text-center text-sm text-white" role="status">
          {t('portal.preview.banner')}{' '}
          <Link to="/admin" className="font-semibold underline underline-offset-2">
            {t('portal.preview.back')}
          </Link>
        </div>
      )}
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-3" aria-label={title.full}>
            <BrandMark name={title.brand} logo={branding?.logo_url} />
            <span className="hidden truncate text-sm sm:block">
              <span className="font-semibold text-stone-900">{title.brand}</span>
              <span className="text-stone-400"> · </span>
              <span className="text-stone-600">{title.word}</span>
            </span>
          </Link>
          <nav aria-label={t('portal.nav.label')} className="ml-auto hidden items-center gap-1 lg:flex">
            {links.map((l) => (
              <Link key={l.to} to={l.to} activeOptions={{ exact: l.exact, includeSearch: false }} className={navCls} activeProps={{ className: activeCls }}>
                {l.icon}
                {l.label}
                {!!l.badge && <span className="rounded-full bg-accent px-1.5 text-xs text-accent-contrast tabular">{l.badge}</span>}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 lg:ml-2">
            <LanguageSwitcher className="hidden sm:inline-flex" />
            <button
              type="button"
              className={cx(buttonClass('ghost', 'sm'), 'hidden lg:inline-flex')}
              onClick={() => logout.mutate(undefined, { onSettled: () => navigate({ to: '/login' }) })}
            >
              <IconLogout size={16} />
              {t('common.logout')}
            </button>
            <button type="button" className={cx(buttonClass('ghost', 'sm'), 'lg:hidden')} aria-expanded={menu} aria-controls="portal-menu" onClick={() => setMenu(!menu)}>
              {menu ? <IconX /> : <IconMenu />}
              <span className="sr-only">{t('common.menu')}</span>
            </button>
          </div>
        </div>
        {menu && (
          <nav id="portal-menu" aria-label={t('portal.nav.label')} className="border-t border-stone-100 px-4 pb-3 lg:hidden">
            {links.map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setMenu(false)} activeOptions={{ exact: l.exact, includeSearch: false }} className={cx(navCls, 'flex')} activeProps={{ className: activeCls }}>
                {l.icon}
                {l.label}
                {!!l.badge && <span className="ml-auto rounded-full bg-accent px-1.5 text-xs text-accent-contrast">{l.badge}</span>}
              </Link>
            ))}
            <div className="mt-2 flex items-center justify-between px-3">
              <LanguageSwitcher />
              <button type="button" className={buttonClass('ghost', 'sm')} onClick={() => logout.mutate(undefined, { onSettled: () => navigate({ to: '/login' }) })}>
                <IconLogout size={16} />
                {t('common.logout')}
              </button>
            </div>
          </nav>
        )}
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <Outlet />
      </main>
      <footer className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-stone-500 sm:px-6">
        <span>
          {viewer.data.retailer ? t('portal.footer.signedInAs', { name: session.data?.user?.name, retailer: viewer.data.retailer.name }) : session.data?.user?.name}
        </span>
        <WorksWithBadge />
      </footer>
    </div>
  )
}
