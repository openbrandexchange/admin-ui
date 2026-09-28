import { StrictMode } from 'react'
import { QueryCache, QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { ApiError } from './api/client'
import { makeRouter } from './router'
import { sessionQuery } from './queries/session'

export function makeQueryClient() {
  let router: ReturnType<typeof makeRouter> | null = null
  // A session that ends while the page is open (logout elsewhere, blocked, expired) sends the
  // user to the login page instead of leaving half-broken screens.
  const onError = (e: unknown) => {
    if (!(e instanceof ApiError) || e.status !== 401 || !router) return
    if (e.code === 'invalid_credentials') return
    const here = router.state.location
    if (here.pathname.startsWith('/login')) return
    // Only leave the page when the session is really gone (not for a single stray 401).
    void qc.fetchQuery({ ...sessionQuery, staleTime: 0 }).then((s) => {
      if (!s.authenticated) void router?.navigate({ to: '/login', search: { redirect: here.href } })
    })
  }
  const qc = new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        retry: (n, e) => !(e instanceof ApiError && e.status >= 400 && e.status < 500) && n < 2,
        refetchOnWindowFocus: false,
        staleTime: 15_000,
      },
    },
  })
  return { qc, attach: (r: ReturnType<typeof makeRouter>) => void (router = r) }
}

/** The whole app: one QueryClient, one router. Tests pass a memory history. */
export function createApp(opts: Parameters<typeof makeRouter>[1] = {}) {
  const { qc, attach } = makeQueryClient()
  const router = makeRouter(qc, opts)
  attach(router)
  return { qc, router }
}

export function App({ qc, router }: ReturnType<typeof createApp>) {
  return (
    <StrictMode>
      <QueryClientProvider client={qc}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>
  )
}
