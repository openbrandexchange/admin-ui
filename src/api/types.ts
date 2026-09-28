// Friendly names for the generated OpenAPI types (src/api/admin.d.ts). Everything that crosses
// the wire comes from the spec; only a few convenience shapes are added here.
import type { components } from './admin'

type S = components['schemas']

export type Problem = S['Problem']
export type ErrorCode = S['ErrorCode']
export type LocalizedText = S['LocalizedText']
export type Session = S['Session']
export type User = S['User']
export type PublicBranding = S['PublicBranding']
export type SetupInput = S['SetupInput']
export type Settings = S['Settings']
export type AdminProductSummary = S['AdminProductSummary']
export type AdminProductDetail = S['AdminProductDetail']
export type AdminAsset = S['AdminAsset']
export type IngestRecord = S['IngestRecord']
export type IngestResult = S['IngestResult']
export type ProductInput = S['ProductInput']
export type VariantInput = S['VariantInput']
export type AssetInput = S['AssetInput']
export type BrandInput = S['BrandInput']
export type Rights = S['Rights']
export type Provenance = S['Provenance']
export type Role = S['Role']
export type View = S['View']
export type Channel = S['Channel']
export type RenditionName = S['RenditionName']
export type Rendition = S['Rendition']
export type Materials = S['Materials']
export type Care = S['Care']
export type ImportRun = S['ImportRun']
export type ImportRowError = S['ImportRowError']
export type ImportSource = S['ImportSource']
export type ImportSourceInput = S['ImportSourceInput']
export type Retailer = S['Retailer']
export type RetailerInput = S['RetailerInput']
export type AdminAccessRequest = S['AdminAccessRequest']
export type InviteResult = S['InviteResult']
export type ApiClient = S['ApiClient']
export type ApiClientWithSecret = S['ApiClientWithSecret']
export type IngestToken = S['IngestToken']
export type IngestTokenWithSecret = S['IngestTokenWithSecret']
export type IngestScope = S['IngestScope']
export type Scope = S['Scope']
export type WebhookSubscription = S['WebhookSubscription']
export type WebhookDelivery = S['WebhookDelivery']
export type DownloadEvent = S['DownloadEvent']
export type DownloadKind = S['DownloadKind']
export type Stats = S['Stats']
export type PortalViewer = S['PortalViewer']
export type PortalProductSummary = S['PortalProductSummary']
export type Facets = S['Facets']
export type FacetValue = S['FacetValue']
export type Selection = S['Selection']
export type DownloadJob = S['DownloadJob']
export type DownloadJobInput = S['DownloadJobInput']
export type GtinLookupResult = S['GtinLookupResult']
export type Brand = S['Brand']
export type Product = S['Product']
export type Variant = S['Variant']
export type Asset = S['Asset']
export type Color = S['Color']

/** A product as the protocol returns it: variants and assets embedded. */
export type ProductDetail = Product & { variants: Variant[]; assets: Asset[] }

/** Page of a cursor list. */
export interface Page<T> {
  items: T[]
  next_cursor?: string | null
  total?: number
}

/** Drops the `[key: string]: unknown` index signature that x-extension patternProperties add. */
export type Known<T> = { [K in keyof T as string extends K ? never : number extends K ? never : K]: T[K] }

type DeepPartial<T> = T extends (infer U)[] ? U[] : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> | null } : T
/** JSON merge patch of the writable settings. */
export type SettingsPatch = DeepPartial<Settings>

/** Stored write models inside IngestRecord.data (the generated type is an open object). */
export type ProductData = ProductInput
export type VariantData = VariantInput
export type AssetData = Omit<Known<AssetInput>, 'files' | 'rights' | 'provenance'> & {
  rights?: Partial<Known<NonNullable<AssetInput['rights']>>> | null
  provenance?: Partial<Known<NonNullable<AssetInput['provenance']>>> | null
  files?: Partial<Record<RenditionName, { sha256: string; width?: number | null; height?: number | null }>> | null
}
export type BrandData = BrandInput

export interface BlobRef {
  sha256: string
  width: number
  height: number
}

export interface ManifestEntry {
  file: string
  sha256: string
  width?: number
  height?: number
  renditions?: Partial<Record<'web' | 'square' | 'thumb', BlobRef>>
}

export type PortalFilter = {
  q?: string
  brand_id?: string[]
  item_type?: string[]
  color?: string[]
  season?: string[]
  collection?: string[]
  target_group?: string[]
  updated_since?: string
}
