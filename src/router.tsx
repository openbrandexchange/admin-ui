// One SPA, two route trees: the retailer portal at "/" and the brand admin at "/admin", plus
// the public pages the node links to from e-mails (/invite/…, /reset-password/…, /login,
// /request-access) and the first-run wizard (/setup).
import { createRootRouteWithContext, createRoute, createRouter, lazyRouteComponent, redirect } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { sessionQuery } from './queries/session'
import { Root } from './shell/Root'
import { PublicShell } from './shell/PublicShell'
import { NotFound, RouteError } from './shell/Fallbacks'
import type { PortalFilter } from './api/types'

export interface RouterContext {
  queryClient: QueryClient
}

const rootRoute = createRootRouteWithContext<RouterContext>()({ component: Root, errorComponent: RouteError, notFoundComponent: NotFound })

const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined)
const strs = (v: unknown) => {
  const arr = Array.isArray(v) ? v : typeof v === 'string' && v ? [v] : []
  const out = arr.filter((x): x is string => typeof x === 'string' && !!x)
  return out.length ? out : undefined
}

/** Only same-site paths are followed after login. */
export const safeRedirect = (v: unknown) => (typeof v === 'string' && v.startsWith('/') && !v.startsWith('//') ? v : undefined)

// ---------------------------------------------------------------- public pages

const publicLayout = createRoute({ getParentRoute: () => rootRoute, id: 'public', component: PublicShell })

const setupRoute = createRoute({
  getParentRoute: () => publicLayout,
  path: 'setup',
  beforeLoad: async ({ context }) => {
    const s = await context.queryClient.ensureQueryData(sessionQuery)
    if (!s.setup_required) throw redirect({ to: '/login' })
  },
  component: lazyRouteComponent(() => import('./screens/public/Setup'), 'SetupScreen'),
})

const loginRoute = createRoute({
  getParentRoute: () => publicLayout,
  path: 'login',
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => ({ redirect: safeRedirect(s.redirect) }),
  beforeLoad: async ({ context }) => {
    const s = await context.queryClient.ensureQueryData(sessionQuery)
    if (s.setup_required) throw redirect({ to: '/setup' })
  },
  component: lazyRouteComponent(() => import('./screens/public/Login'), 'LoginScreen'),
})

const forgotRoute = createRoute({
  getParentRoute: () => publicLayout,
  path: 'forgot-password',
  component: lazyRouteComponent(() => import('./screens/public/Password'), 'ForgotPasswordScreen'),
})

const resetRoute = createRoute({
  getParentRoute: () => publicLayout,
  path: 'reset-password/$token',
  component: lazyRouteComponent(() => import('./screens/public/Password'), 'ResetPasswordScreen'),
})

const inviteRoute = createRoute({
  getParentRoute: () => publicLayout,
  path: 'invite/$token',
  component: lazyRouteComponent(() => import('./screens/public/Invite'), 'InviteScreen'),
})

const requestAccessRoute = createRoute({
  getParentRoute: () => publicLayout,
  path: 'request-access',
  component: lazyRouteComponent(() => import('./screens/public/RequestAccess'), 'RequestAccessScreen'),
})

// ---------------------------------------------------------------- auth guards

async function requireSession(qc: QueryClient, href: string) {
  const s = await qc.ensureQueryData(sessionQuery)
  if (s.setup_required) throw redirect({ to: '/setup' })
  if (!s.authenticated || !s.user) throw redirect({ to: '/login', search: { redirect: href === '/' ? undefined : href } })
  return s
}

// ---------------------------------------------------------------- retailer portal

export type CatalogSearch = PortalFilter & { new?: '7' | '30' | '90' }

const portalLayout = createRoute({
  getParentRoute: () => rootRoute,
  id: 'portal',
  beforeLoad: ({ context, location }) => requireSession(context.queryClient, location.href),
  component: lazyRouteComponent(() => import('./shell/PortalShell'), 'PortalShell'),
})

export const catalogRoute = createRoute({
  getParentRoute: () => portalLayout,
  path: '/',
  validateSearch: (s: Record<string, unknown>): CatalogSearch => ({
    q: str(s.q),
    brand_id: strs(s.brand_id),
    item_type: strs(s.item_type),
    color: strs(s.color),
    season: strs(s.season),
    collection: strs(s.collection),
    target_group: strs(s.target_group),
    new: s.new === '7' || s.new === '30' || s.new === '90' ? s.new : undefined,
  }),
  component: lazyRouteComponent(() => import('./screens/portal/Catalog'), 'CatalogScreen'),
})

export const portalProductRoute = createRoute({
  getParentRoute: () => portalLayout,
  path: 'products/$id',
  component: lazyRouteComponent(() => import('./screens/portal/ProductDetail'), 'PortalProductScreen'),
})

const selectionRoute = createRoute({
  getParentRoute: () => portalLayout,
  path: 'selection',
  component: lazyRouteComponent(() => import('./screens/portal/Selection'), 'SelectionScreen'),
})

const eanRoute = createRoute({
  getParentRoute: () => portalLayout,
  path: 'ean',
  component: lazyRouteComponent(() => import('./screens/portal/EanList'), 'EanListScreen'),
})

const downloadsRoute = createRoute({
  getParentRoute: () => portalLayout,
  path: 'downloads',
  component: lazyRouteComponent(() => import('./screens/portal/Downloads'), 'DownloadsScreen'),
})

const accountRoute = createRoute({
  getParentRoute: () => portalLayout,
  path: 'account',
  component: lazyRouteComponent(() => import('./screens/portal/Account'), 'AccountScreen'),
})

// ---------------------------------------------------------------- brand admin

const adminLayout = createRoute({
  getParentRoute: () => rootRoute,
  path: 'admin',
  beforeLoad: async ({ context, location }) => {
    const s = await requireSession(context.queryClient, location.href)
    if (s.user?.role !== 'admin') throw redirect({ to: '/' })
  },
  component: lazyRouteComponent(() => import('./shell/AdminShell'), 'AdminShell'),
})

const adminHome = createRoute({
  getParentRoute: () => adminLayout,
  path: '/',
  component: lazyRouteComponent(() => import('./screens/admin/Dashboard'), 'DashboardScreen'),
})

export type AdminCatalogSearch = {
  q?: string
  status?: 'published' | 'unpublished'
  visibility?: 'visible' | 'hidden' | 'pending_files'
  brand?: string
}

export const adminCatalogRoute = createRoute({
  getParentRoute: () => adminLayout,
  path: 'catalog',
  validateSearch: (s: Record<string, unknown>): AdminCatalogSearch => ({
    q: str(s.q),
    status: s.status === 'published' || s.status === 'unpublished' ? s.status : undefined,
    visibility: s.visibility === 'visible' || s.visibility === 'hidden' || s.visibility === 'pending_files' ? s.visibility : undefined,
    brand: str(s.brand),
  }),
  component: lazyRouteComponent(() => import('./screens/admin/Catalog'), 'AdminCatalogScreen'),
})

const adminProductNew = createRoute({
  getParentRoute: () => adminLayout,
  path: 'catalog/new',
  component: lazyRouteComponent(() => import('./screens/admin/ProductNew'), 'ProductNewScreen'),
})

export const adminProductRoute = createRoute({
  getParentRoute: () => adminLayout,
  path: 'catalog/$externalId',
  component: lazyRouteComponent(() => import('./screens/admin/ProductEdit'), 'ProductEditScreen'),
})

const adminImports = createRoute({
  getParentRoute: () => adminLayout,
  path: 'imports',
  component: lazyRouteComponent(() => import('./screens/admin/Imports'), 'ImportsScreen'),
})

export const adminImportRunRoute = createRoute({
  getParentRoute: () => adminLayout,
  path: 'imports/$id',
  component: lazyRouteComponent(() => import('./screens/admin/ImportRun'), 'ImportRunScreen'),
})

export type AutomationTab = 'sources' | 'tokens' | 'recipes' | 'webhooks'

export const adminAutomationRoute = createRoute({
  getParentRoute: () => adminLayout,
  path: 'automation',
  validateSearch: (s: Record<string, unknown>): { tab?: AutomationTab } => ({
    tab: s.tab === 'tokens' || s.tab === 'recipes' || s.tab === 'webhooks' || s.tab === 'sources' ? s.tab : undefined,
  }),
  component: lazyRouteComponent(() => import('./screens/admin/Automation'), 'AutomationScreen'),
})

const adminSourceNew = createRoute({
  getParentRoute: () => adminLayout,
  path: 'automation/sources/new',
  component: lazyRouteComponent(() => import('./screens/admin/ImportSourceForm'), 'ImportSourceNewScreen'),
})

export const adminSourceEditRoute = createRoute({
  getParentRoute: () => adminLayout,
  path: 'automation/sources/$id',
  component: lazyRouteComponent(() => import('./screens/admin/ImportSourceForm'), 'ImportSourceEditScreen'),
})

export const adminRetailersRoute = createRoute({
  getParentRoute: () => adminLayout,
  path: 'retailers',
  validateSearch: (s: Record<string, unknown>): { q?: string; status?: 'active' | 'blocked' } => ({
    q: str(s.q),
    status: s.status === 'active' || s.status === 'blocked' ? s.status : undefined,
  }),
  component: lazyRouteComponent(() => import('./screens/admin/Retailers'), 'RetailersScreen'),
})

const adminRetailerNew = createRoute({
  getParentRoute: () => adminLayout,
  path: 'retailers/new',
  component: lazyRouteComponent(() => import('./screens/admin/RetailerNew'), 'RetailerNewScreen'),
})

export const adminRetailerRoute = createRoute({
  getParentRoute: () => adminLayout,
  path: 'retailers/$id',
  component: lazyRouteComponent(() => import('./screens/admin/RetailerDetail'), 'RetailerDetailScreen'),
})

export const adminRequestsRoute = createRoute({
  getParentRoute: () => adminLayout,
  path: 'requests',
  validateSearch: (s: Record<string, unknown>): { status?: 'pending' | 'approved' | 'rejected' } => ({
    status: s.status === 'approved' || s.status === 'rejected' || s.status === 'pending' ? s.status : undefined,
  }),
  component: lazyRouteComponent(() => import('./screens/admin/AccessRequests'), 'AccessRequestsScreen'),
})

const adminStats = createRoute({
  getParentRoute: () => adminLayout,
  path: 'stats',
  component: lazyRouteComponent(() => import('./screens/admin/Stats'), 'StatsScreen'),
})

export type SettingsTab = 'brand' | 'portal' | 'defaults' | 'team' | 'account' | 'system'

export const adminSettingsRoute = createRoute({
  getParentRoute: () => adminLayout,
  path: 'settings',
  validateSearch: (s: Record<string, unknown>): { tab?: SettingsTab } => ({
    tab: (['brand', 'portal', 'defaults', 'team', 'account', 'system'] as const).find((x) => x === s.tab),
  }),
  component: lazyRouteComponent(() => import('./screens/admin/Settings'), 'SettingsScreen'),
})

const routeTree = rootRoute.addChildren([
  publicLayout.addChildren([setupRoute, loginRoute, forgotRoute, resetRoute, inviteRoute, requestAccessRoute]),
  portalLayout.addChildren([catalogRoute, portalProductRoute, selectionRoute, eanRoute, downloadsRoute, accountRoute]),
  adminLayout.addChildren([
    adminHome,
    adminCatalogRoute,
    adminProductNew,
    adminProductRoute,
    adminImports,
    adminImportRunRoute,
    adminAutomationRoute,
    adminSourceNew,
    adminSourceEditRoute,
    adminRetailersRoute,
    adminRetailerNew,
    adminRetailerRoute,
    adminRequestsRoute,
    adminStats,
    adminSettingsRoute,
  ]),
])

/** Path prefix of <base href> ("/" normally; "/brand/" when a node mounts the UI under a sub-path). */
export function basepath(): string {
  if (typeof document === 'undefined') return '/'
  return new URL(document.baseURI).pathname.replace(/\/+$/, '') || '/'
}

export function makeRouter(queryClient: QueryClient, opts: { history?: Parameters<typeof createRouter>[0]['history'] } = {}) {
  return createRouter({
    routeTree,
    context: { queryClient },
    basepath: basepath(),
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    ...opts,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof makeRouter>
  }
}
