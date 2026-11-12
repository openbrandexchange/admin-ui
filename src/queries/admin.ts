// Brand admin server state: one place for query keys, fetchers and mutations with their
// invalidation rules. Screens only call these hooks.
import {
  infiniteQueryOptions,
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query'
import { api, rawRequest, req, seg } from '../api/client'
import type {
  AdminProductDetail,
  AssetData,
  AssetInput,
  ImportRun,
  ImportSourceInput,
  IngestScope,
  ProductInput,
  RetailerInput,
  Settings,
  SettingsPatch,
  VariantInput,
} from '../api/types'

const inval = (qc: ReturnType<typeof useQueryClient>, ...keys: QueryKey[]) =>
  Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })))

// ---------------------------------------------------------------- settings

export const settingsQuery = queryOptions({
  queryKey: ['admin', 'settings'],
  queryFn: () => req(() => api.GET('/admin/api/settings')),
  staleTime: 60_000,
})

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: SettingsPatch) => req(() => api.PATCH('/admin/api/settings', { body: patch as Settings })),
    onSuccess: (s) => {
      qc.setQueryData(settingsQuery.queryKey, s)
      return inval(qc, ['public-branding'], ['portal', 'viewer'])
    },
  })
}

export function useLogoMutations() {
  const qc = useQueryClient()
  const done = (s: Settings) => {
    qc.setQueryData(settingsQuery.queryKey, s)
    return inval(qc, ['public-branding'], ['portal', 'viewer'])
  }
  return {
    upload: useMutation({
      mutationFn: async (file: File) =>
        (await (await rawRequest('PUT', '/admin/api/settings/logo', { body: file, contentType: file.type })).json()) as Settings,
      onSuccess: done,
    }),
    remove: useMutation({
      mutationFn: () => req(() => api.DELETE('/admin/api/settings/logo')),
      onSuccess: done,
    }),
  }
}

// ---------------------------------------------------------------- catalog

export const brandsQuery = queryOptions({
  queryKey: ['admin', 'brands'],
  queryFn: () => req(() => api.GET('/admin/api/catalog/brands')),
  staleTime: 60_000,
})

export type CatalogFilter = {
  q?: string
  brand?: string
  status?: 'published' | 'unpublished'
  visibility?: 'visible' | 'hidden' | 'pending_files'
  sort?: 'updated_desc' | 'style_number' | 'name'
}

export const adminProductsQuery = (filter: CatalogFilter) =>
  infiniteQueryOptions({
    queryKey: ['admin', 'products', filter],
    queryFn: ({ pageParam }) =>
      req(() =>
        api.GET('/admin/api/catalog/products', { params: { query: { ...filter, cursor: pageParam, limit: 50 } } }),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    placeholderData: keepPreviousData,
  })

/** Just the total of a filter (dashboard health tiles). */
export const productCountQuery = (filter: CatalogFilter) =>
  queryOptions({
    queryKey: ['admin', 'products', 'count', filter],
    queryFn: async () => (await req(() => api.GET('/admin/api/catalog/products', { params: { query: { ...filter, limit: 1 } } }))).total,
  })

export const adminProductQuery = (externalId: string) =>
  queryOptions({
    queryKey: ['admin', 'product', externalId],
    queryFn: () => req(() => api.GET('/admin/api/catalog/products/{external_id}', { params: { path: { external_id: externalId } } })),
  })

export function useProductMutations(externalId: string) {
  const qc = useQueryClient()
  const key = adminProductQuery(externalId).queryKey
  const refresh = () => inval(qc, key, ['admin', 'products'], ['portal'])
  const path = { external_id: externalId }
  return {
    put: useMutation({
      mutationFn: (body: ProductInput) => req(() => api.PUT('/admin/api/catalog/products/{external_id}', { params: { path }, body })),
      onSuccess: refresh,
    }),
    /** Publish / unpublish, optimistic. */
    setStatus: useMutation({
      mutationFn: (status: 'published' | 'unpublished') =>
        req(() => api.PATCH('/admin/api/catalog/products/{external_id}', { params: { path }, body: { status } as never })),
      onMutate: async (status) => {
        await qc.cancelQueries({ queryKey: key })
        const previous = qc.getQueryData<AdminProductDetail>(key)
        if (previous) qc.setQueryData<AdminProductDetail>(key, { ...previous, record: { ...previous.record, status } })
        return { previous }
      },
      onError: (_e, _v, ctx) => ctx?.previous && qc.setQueryData(key, ctx.previous),
      onSettled: refresh,
    }),
    remove: useMutation({
      mutationFn: () => req(() => api.DELETE('/admin/api/catalog/products/{external_id}', { params: { path } })),
      onSuccess: () => {
        qc.removeQueries({ queryKey: key })
        return inval(qc, ['admin', 'products'], ['portal'])
      },
    }),
    putVariant: useMutation({
      mutationFn: ({ id, body }: { id: string; body: VariantInput }) =>
        req(() => api.PUT('/admin/api/catalog/variants/{external_id}', { params: { path: { external_id: id } }, body })),
      onSuccess: refresh,
    }),
    deleteVariant: useMutation({
      mutationFn: (id: string) => req(() => api.DELETE('/admin/api/catalog/variants/{external_id}', { params: { path: { external_id: id } } })),
      onSuccess: refresh,
    }),
    putAsset: useMutation({
      mutationFn: ({ id, body }: { id: string; body: AssetInput | AssetData }) =>
        req(() => api.PUT('/admin/api/catalog/assets/{external_id}', { params: { path: { external_id: id } }, body: body as AssetInput })),
      onSuccess: refresh,
    }),
    patchAsset: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: Partial<AssetInput> & { status?: 'published' | 'unpublished' } }) =>
        req(() => api.PATCH('/admin/api/catalog/assets/{external_id}', { params: { path: { external_id: id } }, body: patch as never })),
      onSuccess: refresh,
    }),
    deleteAsset: useMutation({
      mutationFn: (id: string) => req(() => api.DELETE('/admin/api/catalog/assets/{external_id}', { params: { path: { external_id: id } } })),
      onSuccess: refresh,
    }),
    /** Reorder one colour's images, optimistic (positions 1..n in the given order). */
    reorder: useMutation({
      mutationFn: ({ color, ids }: { color: string | null; ids: string[] }) =>
        req(() =>
          api.PUT('/admin/api/catalog/products/{external_id}/asset-order', {
            params: { path },
            body: { color_code: color, asset_external_ids: ids },
          }),
        ),
      onMutate: async ({ ids }) => {
        await qc.cancelQueries({ queryKey: key })
        const previous = qc.getQueryData<AdminProductDetail>(key)
        if (previous) {
          const pos = new Map(ids.map((id, i) => [id, i + 1]))
          qc.setQueryData<AdminProductDetail>(key, {
            ...previous,
            assets: previous.assets.map((a) =>
              pos.has(a.record.external_id)
                ? { ...a, record: { ...a.record, data: { ...a.record.data, position: pos.get(a.record.external_id) } as never } }
                : a,
            ),
          })
        }
        return { previous }
      },
      onError: (_e, _v, ctx) => ctx?.previous && qc.setQueryData(key, ctx.previous),
      onSettled: refresh,
    }),
  }
}

export function useCreateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ProductInput }) =>
      req(() => api.PUT('/admin/api/catalog/products/{external_id}', { params: { path: { external_id: id } }, body })),
    onSuccess: () => inval(qc, ['admin', 'products']),
  })
}

// ---------------------------------------------------------------- imports

export const importRunsQuery = infiniteQueryOptions({
  queryKey: ['admin', 'imports'],
  queryFn: ({ pageParam }) => req(() => api.GET('/admin/api/imports', { params: { query: { cursor: pageParam, limit: 25 } } })),
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (last) => last.next_cursor ?? undefined,
  refetchInterval: (q) =>
    q.state.data?.pages.some((p) => p.items.some((r) => r.status === 'queued' || r.status === 'running')) ? 2500 : false,
})

const running = (r?: ImportRun) => r?.status === 'queued' || r?.status === 'running'

export const importRunQuery = (id: string) =>
  queryOptions({
    queryKey: ['admin', 'import', id],
    queryFn: () => req(() => api.GET('/admin/api/imports/{id}', { params: { path: { id } } })),
    refetchInterval: (q) => (running(q.state.data) ? 1500 : false),
  })

export const importErrorsQuery = (id: string) =>
  infiniteQueryOptions({
    queryKey: ['admin', 'import', id, 'errors'],
    queryFn: ({ pageParam }) =>
      req(() => api.GET('/admin/api/imports/{id}/errors', { params: { path: { id }, query: { cursor: pageParam, limit: 100 } } })),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  })

export const importSourcesQuery = queryOptions({
  queryKey: ['admin', 'import-sources'],
  queryFn: () => req(() => api.GET('/admin/api/import-sources')),
})

export function useImportSourceMutations() {
  const qc = useQueryClient()
  const refresh = () => inval(qc, importSourcesQuery.queryKey, ['admin', 'imports'])
  return {
    create: useMutation({
      mutationFn: (body: ImportSourceInput) => req(() => api.POST('/admin/api/import-sources', { body })),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: ImportSourceInput }) =>
        req(() => api.PATCH('/admin/api/import-sources/{id}', { params: { path: { id } }, body: patch })),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => req(() => api.DELETE('/admin/api/import-sources/{id}', { params: { path: { id } } })),
      onSuccess: refresh,
    }),
    run: useMutation({
      mutationFn: ({ id, dry_run = false, force = false }: { id: string; dry_run?: boolean; force?: boolean }) =>
        req(() => api.POST('/admin/api/import-sources/{id}/run', { params: { path: { id } }, body: { dry_run, force } })),
      onSuccess: refresh,
    }),
    test: useMutation({
      mutationFn: (id: string) => req(() => api.POST('/admin/api/import-sources/{id}/test', { params: { path: { id } } })),
    }),
  }
}

// ---------------------------------------------------------------- retailers, requests, users, API clients

export const retailersQuery = (filter: { q?: string; status?: 'active' | 'blocked' }) =>
  infiniteQueryOptions({
    queryKey: ['admin', 'retailers', filter],
    queryFn: ({ pageParam }) =>
      req(() => api.GET('/admin/api/retailers', { params: { query: { ...filter, cursor: pageParam, limit: 50 } } })),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    placeholderData: keepPreviousData,
  })

export const retailerQuery = (id: string) =>
  queryOptions({
    queryKey: ['admin', 'retailer', id],
    queryFn: () => req(() => api.GET('/admin/api/retailers/{id}', { params: { path: { id } } })),
  })

export function useRetailerMutations() {
  const qc = useQueryClient()
  const refresh = (id?: string) => inval(qc, ['admin', 'retailers'], ...(id ? [retailerQuery(id).queryKey] : []))
  return {
    create: useMutation({
      mutationFn: (body: RetailerInput) => req(() => api.POST('/admin/api/retailers', { body })),
      onSuccess: () => refresh(),
    }),
    update: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: RetailerInput }) =>
        req(() => api.PATCH('/admin/api/retailers/{id}', { params: { path: { id } }, body: patch })),
      onSuccess: (r) => {
        qc.setQueryData(retailerQuery(r.id).queryKey, r)
        return refresh(r.id)
      },
    }),
    remove: useMutation({
      mutationFn: (id: string) => req(() => api.DELETE('/admin/api/retailers/{id}', { params: { path: { id } } })),
      onSuccess: () => refresh(),
    }),
  }
}

export const accessRequestsQuery = (status?: 'pending' | 'approved' | 'rejected') =>
  infiniteQueryOptions({
    queryKey: ['admin', 'access-requests', status ?? 'all'],
    queryFn: ({ pageParam }) =>
      req(() => api.GET('/admin/api/access-requests', { params: { query: { status, cursor: pageParam, limit: 50 } } })),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  })

export function useAccessRequestMutations() {
  const qc = useQueryClient()
  const refresh = () => inval(qc, ['admin', 'access-requests'], ['admin', 'retailers'], ['admin', 'users'])
  return {
    approve: useMutation({
      mutationFn: ({
        id,
        body,
      }: {
        id: string
        body: { retailer_id?: string; brand_ids?: string[] | null; invite_portal_user?: boolean; create_api_client?: boolean }
      }) => req(() => api.POST('/admin/api/access-requests/{id}/approve', { params: { path: { id } }, body })),
      onSuccess: refresh,
    }),
    reject: useMutation({
      mutationFn: ({ id, reason }: { id: string; reason: string | null }) =>
        req(() => api.POST('/admin/api/access-requests/{id}/reject', { params: { path: { id } }, body: { reason } })),
      onSuccess: refresh,
    }),
  }
}

export const usersQuery = (filter: { role?: 'admin' | 'retailer'; retailer_id?: string }) =>
  queryOptions({
    queryKey: ['admin', 'users', filter],
    queryFn: () => req(() => api.GET('/admin/api/users', { params: { query: { ...filter, limit: 200 } } })),
  })

export function useUserMutations() {
  const qc = useQueryClient()
  const refresh = () => inval(qc, ['admin', 'users'], ['admin', 'retailers'], ['admin', 'retailer'])
  return {
    invite: useMutation({
      mutationFn: (body: { email: string; name?: string; role: 'admin' | 'retailer'; retailer_id?: string; language?: string }) =>
        req(() => api.POST('/admin/api/users/invites', { body })),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: { name?: string; status?: 'active' | 'blocked' } }) =>
        req(() => api.PATCH('/admin/api/users/{id}', { params: { path: { id } }, body: patch })),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => req(() => api.DELETE('/admin/api/users/{id}', { params: { path: { id } } })),
      onSuccess: refresh,
    }),
    resend: useMutation({
      mutationFn: (id: string) => req(() => api.POST('/admin/api/users/{id}/resend-invite', { params: { path: { id } } })),
      onSuccess: refresh,
    }),
  }
}

export const apiClientsQuery = (retailerId?: string) =>
  queryOptions({
    queryKey: ['admin', 'api-clients', retailerId ?? 'all'],
    queryFn: () => req(() => api.GET('/admin/api/api-clients', { params: { query: { retailer_id: retailerId } } })),
  })

export function useApiClientMutations() {
  const qc = useQueryClient()
  const refresh = () => inval(qc, ['admin', 'api-clients'], ['admin', 'retailers'], ['admin', 'retailer'])
  return {
    create: useMutation({
      mutationFn: (body: { retailer_id: string; name: string }) => req(() => api.POST('/admin/api/api-clients', { body })),
      onSuccess: refresh,
    }),
    rotate: useMutation({
      mutationFn: (id: string) => req(() => api.POST('/admin/api/api-clients/{id}/rotate', { params: { path: { id } } })),
      onSuccess: refresh,
    }),
    revoke: useMutation({
      mutationFn: (id: string) => req(() => api.DELETE('/admin/api/api-clients/{id}', { params: { path: { id } } })),
      onSuccess: refresh,
    }),
  }
}

// ---------------------------------------------------------------- automation: tokens + webhooks

export const ingestTokensQuery = queryOptions({
  queryKey: ['admin', 'ingest-tokens'],
  queryFn: () => req(() => api.GET('/admin/api/ingest-tokens')),
})

export function useIngestTokenMutations() {
  const qc = useQueryClient()
  const refresh = () => inval(qc, ingestTokensQuery.queryKey)
  return {
    create: useMutation({
      mutationFn: (body: { name: string; scopes: IngestScope[]; brand_external_ids?: string[] | null; expires_at?: string | null }) =>
        req(() => api.POST('/admin/api/ingest-tokens', { body })),
      onSuccess: refresh,
    }),
    rotate: useMutation({
      mutationFn: (id: string) => req(() => api.POST('/admin/api/ingest-tokens/{id}/rotate', { params: { path: { id } } })),
      onSuccess: refresh,
    }),
    revoke: useMutation({
      mutationFn: (id: string) => req(() => api.DELETE('/admin/api/ingest-tokens/{id}', { params: { path: { id } } })),
      onSuccess: refresh,
    }),
  }
}

export const webhooksQuery = queryOptions({
  queryKey: ['admin', 'webhooks'],
  queryFn: () => req(() => api.GET('/admin/api/webhooks')),
})

export const webhookDeliveriesQuery = (id: string) =>
  queryOptions({
    queryKey: ['admin', 'webhooks', id, 'deliveries'],
    queryFn: () => req(() => api.GET('/admin/api/webhooks/{id}/deliveries', { params: { path: { id }, query: { limit: 20 } } })),
  })

export type AdminWebhookEvent = 'access_request.created' | 'import_run.completed' | 'ingest_job.completed'

export function useWebhookMutations() {
  const qc = useQueryClient()
  const refresh = () => inval(qc, webhooksQuery.queryKey)
  return {
    create: useMutation({
      mutationFn: (body: { url: string; events: AdminWebhookEvent[] }) => req(() => api.POST('/admin/api/webhooks', { body })),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: { events?: string[]; status?: 'active' | 'disabled' } }) =>
        req(() => api.PATCH('/admin/api/webhooks/{id}', { params: { path: { id } }, body: patch })),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => req(() => api.DELETE('/admin/api/webhooks/{id}', { params: { path: { id } } })),
      onSuccess: refresh,
    }),
    test: useMutation({
      mutationFn: (id: string) => req(() => api.POST('/admin/api/webhooks/{id}/test', { params: { path: { id } } })),
      onSuccess: (_d, id) => inval(qc, webhookDeliveriesQuery(id).queryKey, webhooksQuery.queryKey),
    }),
  }
}

// ---------------------------------------------------------------- stats

export const statsQuery = (days: 7 | 30 | 90 | 365) =>
  queryOptions({
    queryKey: ['admin', 'stats', days],
    queryFn: () => req(() => api.GET('/admin/api/stats', { params: { query: { days } } })),
    placeholderData: keepPreviousData,
  })

export const statEventsQuery = (filter: { retailer_id?: string }) =>
  infiniteQueryOptions({
    queryKey: ['admin', 'stat-events', filter],
    queryFn: ({ pageParam }) =>
      req(() => api.GET('/admin/api/stats/events', { params: { query: { ...filter, cursor: pageParam, limit: 25 } } })),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  })

/** Every problem of an import (all pages), for the downloadable list. */
export async function fetchAllImportErrors(id: string) {
  const items = []
  let cursor: string | undefined
  do {
    const page = await req(() => api.GET('/admin/api/imports/{id}/errors', { params: { path: { id }, query: { cursor, limit: 200 } } }))
    items.push(...page.items)
    cursor = page.next_cursor ?? undefined
  } while (cursor && items.length < 100_000)
  return items
}

export const importTemplateUrl = '/admin/api/import-template.csv'
/** The Excel templates (spec templates/), published on the project website. */
export const excelTemplateUrls = { products: 'https://openbrandexchange.com/downloads/products.xlsx', assets: 'https://openbrandexchange.com/downloads/assets.xlsx' }
export const productPath = (externalId: string) => `/admin/catalog/${seg(externalId)}`
