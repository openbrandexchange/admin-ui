import type { AdminAccessRequest, ApiClient, RenditionName, User } from '../api/types'

/** IngestRecord with a writable, loosely typed `data` (the stored write model). */
export interface Rec {
  kind: 'brand' | 'product' | 'variant' | 'asset'
  id: string
  external_id: string
  status: 'published' | 'unpublished'
  visibility: 'visible' | 'hidden' | 'pending_files'
  etag: string
  created_at: string
  updated_at: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>
  missing_files?: RenditionName[] | null
}

export type MockUser = User & { password: string }

export type MockApiClient = ApiClient & { secret: string }

export type AccessRequestSummaryShape = AdminAccessRequest
