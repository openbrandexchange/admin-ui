import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useState, type ReactNode } from 'react'
import { ThemeContext, homeBlocks, useApplyBranding, usePortalTitle, usePreview, useResolvedTheme } from '../lib/branding'
import { selectionQuery, viewerQuery } from '../queries/portal'
import { sessionQuery, useLogout } from '../queries/session'
import { Loading, cx, buttonClass } from '../ui/controls'
import { ErrorNote } from '../ui/feedback'
import { IconLogout, IconMenu, IconX } from '../ui/icons'
import { BrandMark, LanguageSwitcher, WorksWithBadge, SkipLink } from './common'
import { InMainContext } from './Fallbacks'
import { DemoBanner } from './DemoBanner'

// Navigation as quiet text links with an underline for the current page: the brand's images
// carry the page, the frame stays out of the way.
const navCls =
  'relative inline-flex h-10 items-center gap-1.5 px-1 text-sm font-medium text-stone-600 hover:text-stone-900 after:absolute after:inset-x-1 after:bottom-0 after:h-0.5 after:rounded-full after:bg-transparent'
const activeCls = 'text-stone-900 after:bg-accent'

export function PortalShell() {
  const { t } = useTranslation()
  const viewer = useQuery(viewerQuery)
  const session = useQuery(sessionQuery)
  const selection = useQuery(selectionQuery)
  const logout = useLogout()
  const navigate = useNavigate()
  const preview = usePreview()
  const [menu, setMenu] = useState(false)
  const branding = preview?.branding ?? viewer.data?.branding
  const title = usePortalTitle(branding)
  const theme = useResolvedTheme(branding?.theme, branding?.accent_color)
  useApplyBranding(theme, title.full, branding?.favicon_url)
  const location = useRouterState({ select: (s) => s.location })

  if (viewer.isPending && !preview) return <Loading />
  if (viewer.isError && !preview) return <div className="p-6"><ErrorNote error={viewer.error} onRetry={() => void viewer.refetch()} /></div>

  const hasHome = homeBlocks(branding).length > 0
  // The start page is full-bleed when it shows the brand's blocks; every other page sits in the content column.
  const onHome = location.pathname === '/' && hasHome && !Object.values(location.search as Record<string, unknown>).some((v) => v !== undefined)
  const count = selection.data?.product_ids.length ?? viewer.data?.selection_count ?? 0
  const links: { to: '/' | '/catalog' | '/ean' | '/selection' | '/downloads' | '/account'; label: string; badge?: number; exact?: boolean }[] = [
    ...(hasHome ? [{ to: '/' as const, label: t('portal.nav.home'), exact: true }] : []),
    { to: hasHome ? '/catalog' : '/', label: t('portal.nav.catalog'), exact: !hasHome },
    { to: '/ean', label: t('portal.nav.ean') },
    { to: '/selection', label: t('portal.nav.selection'), badge: count },
    { to: '/downloads', label: t('portal.nav.downloads') },
    { to: '/account', label: t('portal.nav.account') },
  ]
  const doLogout = () => logout.mutate(undefined, { onSettled: () => navigate({ to: '/login' }) })
  const badge = (n: number) => (
    <span className="ml-0.5 inline-grid min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] leading-5 font-semibold text-accent-contrast tabular">{n}</span>
  )

  // In the Appearance preview the shell is a plain frame: no landmarks or skip link that would
  // repeat the admin page's own.
  const Main = preview ? 'div' : 'main'
  const Header = preview ? 'div' : 'header'

  return (
    <ThemeContext.Provider value={theme}>
      <div className="@container flex min-h-dvh flex-col">
        {!preview && <SkipLink />}
        {!preview && <DemoBanner />}
        {viewer.data?.preview && !preview && (
          <div className="bg-stone-900 px-4 py-2 text-center text-sm text-white" role="status">
            {t('portal.preview.banner')}{' '}
            <Link to="/admin" className="font-semibold underline underline-offset-2">
              {t('portal.preview.back')}
            </Link>
          </div>
        )}
        <Header className="sticky top-0 z-20 border-b border-stone-200 bg-white/92 backdrop-blur-md">
          <div className="mx-auto flex max-w-[90rem] items-center gap-6 px-4 py-2.5 @[40rem]:px-6 @7xl:px-10">
            <Link to="/" className="flex min-w-0 shrink-0 items-center gap-3 py-1" aria-label={title.full}>
              <BrandMark name={title.brand} logo={branding?.logo_url} />
              <span className="block min-w-0 leading-tight">
                <span className="display block truncate text-lg text-stone-900">{title.brand}</span>
                <span className="hidden truncate text-xs text-stone-500 @[40rem]:block">{title.word}</span>
              </span>
            </Link>
            <NavList label={t('portal.nav.label')} className="ml-auto hidden items-center gap-5 @5xl:flex">
              {links.map((l) => (
                <Link key={l.to + l.label} to={l.to} activeOptions={{ exact: l.exact, includeSearch: false }} className={navCls} activeProps={{ className: activeCls, 'aria-current': 'page' }}>
                  {l.label}
                  {!!l.badge && badge(l.badge)}
                </Link>
              ))}
            </NavList>
            <div className="ml-auto flex items-center gap-4 @5xl:ml-2">
              <div className="hidden @[40rem]:block">
                <LanguageSwitcher />
              </div>
              <div className="hidden @5xl:block">
                <button type="button" className={buttonClass('ghost', 'sm')} onClick={doLogout} title={t('common.logout')}>
                  <IconLogout size={16} />
                  <span className="sr-only @7xl:not-sr-only">{t('common.logout')}</span>
                </button>
              </div>
              <button type="button" className={cx(buttonClass('ghost', 'sm'), 'relative size-10 @5xl:hidden')} aria-expanded={menu} aria-controls="portal-menu" onClick={() => setMenu(!menu)}>
                {menu ? <IconX /> : <IconMenu />}
                <span className="sr-only">{t('common.menu')}</span>
                {!menu && count > 0 && <span className="absolute translate-x-2.5 -translate-y-2.5 size-2 rounded-full bg-accent" aria-hidden="true" />}
              </button>
            </div>
          </div>
          {menu && (
            <NavList id="portal-menu" label={t('portal.nav.label')} className="border-t border-stone-100 px-4 pt-1 pb-4 @5xl:hidden">
              {links.map((l) => (
                <Link
                  key={l.to + l.label}
                  to={l.to}
                  onClick={() => setMenu(false)}
                  activeOptions={{ exact: l.exact, includeSearch: false }}
                  className="flex h-12 items-center justify-between border-b border-stone-100 text-base text-stone-700"
                  activeProps={{ className: 'font-semibold text-stone-900', 'aria-current': 'page' }}
                >
                  {l.label}
                  {!!l.badge && badge(l.badge)}
                </Link>
              ))}
              <div className="mt-3 flex items-center justify-between">
                <LanguageSwitcher />
                <button type="button" className={buttonClass('ghost', 'sm')} onClick={doLogout}>
                  <IconLogout size={16} />
                  {t('common.logout')}
                </button>
              </div>
            </NavList>
          )}
        </Header>
        <Main id={preview ? undefined : 'main'} tabIndex={preview ? undefined : -1} className={cx('w-full flex-1', !onHome && 'mx-auto max-w-[90rem] px-4 py-6 @[40rem]:px-6 @[40rem]:py-8 @7xl:px-10')}>
          <InMainContext.Provider value={true}>
            <Outlet />
          </InMainContext.Provider>
        </Main>
        <footer className="border-t border-stone-200">
          <div className="mx-auto flex max-w-[90rem] flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-stone-500 @[40rem]:px-6 @7xl:px-10">
            <span>
              {viewer.data?.retailer ? t('portal.footer.signedInAs', { name: session.data?.user?.name, retailer: viewer.data.retailer.name }) : session.data?.user?.name}
            </span>
            <WorksWithBadge />
          </div>
        </footer>
      </div>
    </ThemeContext.Provider>
  )
}

/** A navigation landmark, except inside the preview (a list of links there). */
function NavList({ label, id, className, children }: { label: string; id?: string; className?: string; children: ReactNode }) {
  const preview = usePreview()
  if (preview) return <div id={id} className={className}>{children}</div>
  return (
    <nav id={id} aria-label={label} className={className}>
      {children}
    </nav>
  )
}
