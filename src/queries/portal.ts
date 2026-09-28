// Retailer portal server state. Admins get the same data as a preview.
import { infiniteQueryOptions, keepPreviousData, queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, req } from '../api/client'
import type { DownloadJobInput, PortalFilter, ProductDetail, Selection } from '../api/types'

export const PAGE_SIZE = 48

export const viewerQuery = queryOptions({
  queryKey: ['portal', 'viewer'],
  queryFn: () => req(() => api.GET('/admin/api/portal/viewer')),
  staleTime: 60_000,
})
export const useViewer = () => useQuery(viewerQuery)

/** Drop empty filter values so query keys (and URLs) stay canonical. */
export function cleanFilter(f: PortalFilter): PortalFilter {
  const out: PortalFilter = {}
  if (f.q?.trim()) out.q = f.q.trim()
  for (const k of ['brand_id', 'item_type', 'color', 'season', 'collection', 'target_group'] as const) {
    if (f[k]?.length) out[k] = [...f[k]!].sort()
  }
  if (f.updated_since) out.updated_since = f.updated_since
  return out
}

export const portalProductsQuery = (filter: PortalFilter) =>
  infiniteQueryOptions({
    queryKey: ['portal', 'products', cleanFilter(filter)],
    queryFn: ({ pageParam }) =>
      req(() =>
        api.GET('/admin/api/portal/products', {
          params: { query: { ...cleanFilter(filter), cursor: pageParam, limit: PAGE_SIZE } as never },
        }),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    placeholderData: keepPreviousData,
  })

export const facetsQuery = (filter: PortalFilter) =>
  queryOptions({
    queryKey: ['portal', 'facets', cleanFilter(filter)],
    queryFn: () =>
      req(() => api.GET('/admin/api/portal/facets', { params: { query: cleanFilter(filter) } })),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })

export const portalProductQuery = (id: string) =>
  queryOptions({
    queryKey: ['portal', 'product', id],
    queryFn: async () =>
      (await req(() => api.GET('/admin/api/portal/products/{id}', { params: { path: { id } } }))) as ProductDetail,
  })

/**
 * Every product id of a filter (for "select all"), paging through at most `max` results.
 */
export async function fetchAllProductIds(filter: PortalFilter, max: number): Promise<string[]> {
  const ids: string[] = []
  let cursor: string | undefined
  do {
    const page = await req(() =>
      api.GET('/admin/api/portal/products', { params: { query: { ...cleanFilter(filter), cursor, limit: 200 } as never } }),
    )
    ids.push(...page.items.map((p) => p.id))
    cursor = page.next_cursor ?? undefined
  } while (cursor && ids.length < max)
  return ids.slice(0, max)
}

// ---------------------------------------------------------------- selection (server-side, per user)

export const selectionQuery = queryOptions({
  queryKey: ['portal', 'selection'],
  queryFn: () => req(() => api.GET('/admin/api/portal/selection')),
})
export const useSelection = () => useQuery(selectionQuery)

/**
 * Replace the selection. Optimistic: the checkbox flips at once; the server's answer (which
 * drops invisible ids and recounts images) replaces the guess.
 */
export function useSetSelection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (productIds: string[]) =>
      req(() => api.PUT('/admin/api/portal/selection', { body: { product_ids: productIds } })),
    onMutate: async (productIds) => {
      await qc.cancelQueries({ queryKey: selectionQuery.queryKey })
      const previous = qc.getQueryData<Selection>(selectionQuery.queryKey)
      qc.setQueryData<Selection>(selectionQuery.queryKey, {
        product_ids: productIds,
        image_count: previous?.image_count ?? 0,
        updated_at: previous?.updated_at ?? null,
      })
      return { previous }
    },
    onError: (_e, _v, ctx) => ctx?.previous && qc.setQueryData(selectionQuery.queryKey, ctx.previous),
    onSuccess: (sel) => qc.setQueryData(selectionQuery.queryKey, sel),
    onSettled: () => qc.invalidateQueries({ queryKey: viewerQuery.queryKey }),
  })
}

export function useClearSelection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => req(() => api.DELETE('/admin/api/portal/selection')),
    onMutate: () => qc.setQueryData<Selection>(selectionQuery.queryKey, { product_ids: [], image_count: 0, updated_at: null }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['portal'] }),
  })
}

// ---------------------------------------------------------------- EAN list

export function useGtinLookup() {
  return useMutation({
    mutationFn: (text: string) => req(() => api.POST('/admin/api/portal/gtin-lookup', { body: { text } })),
  })
}

// ---------------------------------------------------------------- background downloads

export const downloadJobsQuery = queryOptions({
  queryKey: ['portal', 'download-jobs'],
  queryFn: () => req(() => api.GET('/admin/api/portal/download-jobs')),
  // Poll while something is being built; stop once everything is finished.
  refetchInterval: (q) =>
    q.state.data?.items.some((j) => j.status === 'queued' || j.status === 'running') ? 2000 : false,
})
export const useDownloadJobs = () => useQuery(downloadJobsQuery)

export function useCreateDownloadJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: DownloadJobInput) => req(() => api.POST('/admin/api/portal/download-jobs', { body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: downloadJobsQuery.queryKey }),
  })
}

// ---------------------------------------------------------------- retailer's own API keys

export const portalApiClientsQuery = queryOptions({
  queryKey: ['portal', 'api-clients'],
  queryFn: () => req(() => api.GET('/admin/api/portal/api-clients')),
})

export function usePortalApiClientMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: portalApiClientsQuery.queryKey })
  return {
    create: useMutation({
      mutationFn: (name: string) => req(() => api.POST('/admin/api/portal/api-clients', { body: { name } })),
      onSuccess: invalidate,
    }),
    rotate: useMutation({
      mutationFn: (id: string) => req(() => api.POST('/admin/api/portal/api-clients/{id}/rotate', { params: { path: { id } } })),
      onSuccess: invalidate,
    }),
    revoke: useMutation({
      mutationFn: (id: string) => req(() => api.DELETE('/admin/api/portal/api-clients/{id}', { params: { path: { id } } })),
      onSuccess: invalidate,
    }),
  }
}
