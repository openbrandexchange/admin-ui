import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, req, setCsrfRefresher, setCsrfToken } from '../api/client'
import type { Session } from '../api/types'

export const sessionQuery = queryOptions({
  queryKey: ['session'],
  queryFn: async (): Promise<Session> => {
    const s = await req(() => api.GET('/admin/api/session'))
    setCsrfToken(s.csrf_token)
    return s
  },
  staleTime: 60_000,
})

export const brandingQuery = queryOptions({
  queryKey: ['public-branding'],
  queryFn: () => req(() => api.GET('/admin/api/public/branding')),
  staleTime: 5 * 60_000,
})

export const useSession = () => useQuery(sessionQuery)
export const useBranding = () => useQuery(brandingQuery)

/** Wire the CSRF refresh used by the client when the node answers csrf_failed. */
export function installCsrfRefresh(qc: ReturnType<typeof useQueryClient>) {
  setCsrfRefresher(async () => (await qc.fetchQuery({ ...sessionQuery, staleTime: 0 })).csrf_token)
}

/** Every call that returns a fresh Session (login, setup, invite, reset) updates the cache. */
export function useSessionSetter() {
  const qc = useQueryClient()
  return (s: Session) => {
    setCsrfToken(s.csrf_token)
    qc.setQueryData(sessionQuery.queryKey, s)
    // Everything else belongs to the previous viewer.
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'session' && q.queryKey[0] !== 'public-branding' })
  }
}

export function useLogin() {
  const setSession = useSessionSetter()
  return useMutation({
    mutationFn: (body: { email: string; password: string }) => req(() => api.POST('/admin/api/session/login', { body })),
    onSuccess: setSession,
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => req(() => api.POST('/admin/api/session/logout')),
    onSettled: async () => {
      qc.clear()
      await qc.fetchQuery(sessionQuery)
    },
  })
}

export function useUpdateMe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name?: string; language?: string; current_password?: string; new_password?: string }) =>
      req(() => api.PATCH('/admin/api/me', { body })),
    onSuccess: (s) => {
      setCsrfToken(s.csrf_token)
      qc.setQueryData(sessionQuery.queryKey, s)
    },
  })
}
