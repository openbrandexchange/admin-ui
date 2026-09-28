// MSW request handlers implementing the Node Admin + Portal API (spec openapi/node-admin.yaml)
// on top of the in-memory mock node. Behaviour follows the spec closely enough for demos and
// UI tests: sessions, CSRF, roles, visibility, grants, selection limits, one-time secrets.
import { http, HttpResponse, type HttpResponseResolver } from 'msw'
import { zipSync, strToU8 } from 'fflate'
import type {
  AdminProductSummary,
  Asset,
  DownloadEvent,
  ImportRun,
  ImportSource,
  PortalProductSummary,
  ProductDetail,
  PublicBranding,
  Retailer,
  Session,
  User,
  Variant,
} from '../api/types'
import { gtinValid } from '../lib/validate'
import { applyImport, brandByKey, db, DEMO, newId, record, resetDb, save, slug, touch, type ManifestItem, type MockDb } from './db'
import type { MockUser, Rec } from './types'

const API = '*/admin/api'
const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')

// ---------------------------------------------------------------- helpers

function problem(status: number, code: string, detail?: string, errors?: { pointer: string; obx_error: string; detail: string }[]) {
  return HttpResponse.json(
    { type: `https://openbrandexchange.com/errors/${code}`, title: code.replace(/_/g, ' '), status, detail: detail ?? null, obx_error: code, ...(errors && { errors }) },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  )
}

class Stop extends Error {
  constructor(public res: Response) {
    super('stop')
  }
}

const stop = (status: number, code: string, detail?: string, errors?: { pointer: string; obx_error: string; detail: string }[]) => new Stop(problem(status, code, detail, errors))

/** Wrap a resolver: CSRF on unsafe methods, setup gate, error → problem+json, persist. */
function route(resolver: (ctx: { request: Request; params: Record<string, string>; d: MockDb; url: URL }) => Response | Promise<Response>, opts: { public?: boolean } = {}): HttpResponseResolver {
  return async ({ request, params }) => {
    const d = db()
    const url = new URL(request.url)
    try {
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) && request.headers.get('X-CSRF-Token') !== d.csrf) throw stop(403, 'csrf_failed', 'Missing or stale X-CSRF-Token.')
      if (d.setupRequired && !opts.public) throw stop(409, 'setup_required')
      const res = await resolver({ request, params: params as Record<string, string>, d, url })
      save()
      return res
    } catch (e) {
      if (e instanceof Stop) return e.res
      throw e
    }
  }
}

function me(d: MockDb): MockUser {
  const u = d.users.find((x) => x.id === d.sessionUserId)
  if (!u) throw stop(401, 'unauthorized')
  if (u.status === 'blocked') throw stop(403, 'account_blocked')
  if (u.role === 'retailer') {
    const r = d.retailers.find((x) => x.id === u.retailer_id)
    if (!r || r.status === 'blocked') throw stop(401, 'access_revoked')
  }
  return u
}

function admin(d: MockDb): MockUser {
  const u = me(d)
  if (u.role !== 'admin') throw stop(403, 'forbidden')
  return u
}

const publicUser = (u: MockUser): User => {
  const { password: _p, ...rest } = u // eslint-disable-line @typescript-eslint/no-unused-vars
  return rest
}

function session(d: MockDb): Session {
  const u = d.users.find((x) => x.id === d.sessionUserId && x.status !== 'blocked')
  const r = u?.retailer_id ? d.retailers.find((x) => x.id === u.retailer_id) : null
  return { authenticated: !!u, csrf_token: d.csrf, setup_required: d.setupRequired, user: u ? publicUser(u) : null, retailer: r ? { id: r.id, name: r.name } : null }
}

async function body<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T
  } catch {
    return {} as T
  }
}

function page<T>(items: T[], url: URL, def = 50) {
  const limit = Math.min(200, Number(url.searchParams.get('limit') ?? def) || def)
  const start = Number(url.searchParams.get('cursor') ?? 0) || 0
  const slice = items.slice(start, start + limit)
  return { items: slice, next_cursor: start + limit < items.length ? String(start + limit) : null, total: items.length }
}

const token = (prefix: string) => prefix + Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 32)

const findRec = (list: Rec[], externalId: string) => list.find((r) => r.external_id === externalId)

// ---------------------------------------------------------------- visibility (one rule)

function brandPublished(d: MockDb, externalId: unknown) {
  const b = brandByKey(d, typeof externalId === 'string' ? externalId : null)
  return !!b && b.status === 'published'
}

function assetFilesPresent(d: MockDb, a: Rec) {
  const sha = a.data.files?.original?.sha256
  return !!sha && !!d.blobs[sha]
}

function grantBrandIds(d: MockDb, u: MockUser): Set<string> | null {
  if (u.role !== 'retailer') return null
  const r = d.retailers.find((x) => x.id === u.retailer_id)
  return r?.brand_ids ? new Set(r.brand_ids) : null
}

function productVisible(d: MockDb, p: Rec, grant: Set<string> | null) {
  if (p.status !== 'published' || !brandPublished(d, p.data.brand_external_id)) return false
  if (!grant) return true
  const b = brandByKey(d, p.data.brand_external_id)
  return !!b && grant.has(b.id)
}

function assetVisible(d: MockDb, a: Rec) {
  if (a.status !== 'published' || !assetFilesPresent(d, a)) return false
  const exp = a.data.rights?.expires_at
  return !exp || new Date(exp) > new Date()
}

function allowOriginals(d: MockDb, u: MockUser) {
  if (!d.settings.portal?.allow_original_download) return false
  if (u.role !== 'retailer') return true
  const r = d.retailers.find((x) => x.id === u.retailer_id)
  return r?.allow_original !== false
}

function productVisibility(d: MockDb, p: Rec): 'visible' | 'hidden' | 'pending_files' {
  if (p.status !== 'published' || !brandPublished(d, p.data.brand_external_id)) return 'hidden'
  const assets = d.assets.filter((a) => a.data.product_external_id === p.external_id && a.status === 'published')
  if (assets.some((a) => !assetFilesPresent(d, a))) return 'pending_files'
  return 'visible'
}

// ---------------------------------------------------------------- protocol shapes

function renditionsOf(d: MockDb, a: Rec, withOriginal: boolean): Asset['renditions'] {
  const orig = d.blobs[a.data.files.original.sha256]
  const r = (name: 'original' | 'web' | 'square' | 'thumb') => ({
    name,
    url: orig.url,
    url_expires_at: null,
    content_type: name === 'original' ? orig.content_type : 'image/jpeg',
    width: orig.width ?? 1200,
    height: orig.height ?? 1500,
    bytes: orig.bytes,
    sha256: orig.sha256,
  })
  return { ...(withOriginal && { original: r('original') }), web: r('web'), square: r('square'), thumb: r('thumb') }
}

function assetView(d: MockDb, a: Rec, product: Rec, withOriginal: boolean): Asset {
  const brand = brandByKey(d, product.data.brand_external_id)!
  const blob = d.blobs[a.data.files.original.sha256]
  const defaults = d.settings.defaults?.rights ?? { license: 'retailer-use', channels: ['webshop', 'marketplace', 'social'] }
  return {
    id: a.id,
    external_id: a.external_id,
    product_id: product.id,
    brand_id: brand.id,
    media_type: 'image',
    color_code: a.data.color_code ?? null,
    role: a.data.role ?? 'packshot',
    view: a.data.view ?? null,
    position: a.data.position,
    filename: a.data.filename ?? a.external_id,
    alt_text: a.data.alt_text ?? null,
    content_type: blob.content_type,
    width: blob.width ?? 1200,
    height: blob.height ?? 1500,
    bytes: blob.bytes,
    sha256: blob.sha256,
    rights: { ...defaults, ...(a.data.rights ?? {}) } as Asset['rights'],
    provenance: { ai_generated: false, ai_edited: false, source: 'photo', c2pa: 'none', ...(a.data.provenance ?? {}) } as Asset['provenance'],
    renditions: renditionsOf(d, a, withOriginal),
    updated_at: a.updated_at,
  }
}

function variantView(d: MockDb, v: Rec, product: Rec): Variant {
  const brand = brandByKey(d, product.data.brand_external_id)!
  const gtin = v.data.gtin as string | null
  return { id: v.id, external_id: v.external_id, product_id: product.id, brand_id: brand.id, gtin: gtin ? gtin.padStart(14, '0') : null, gtin_original: gtin, sku: v.data.sku ?? null, color: v.data.color, size: v.data.size ?? null, size_system: v.data.size_system ?? null, updated_at: v.updated_at }
}

function productDetail(d: MockDb, p: Rec, u: MockUser): ProductDetail {
  const brand = brandByKey(d, p.data.brand_external_id)!
  const originals = allowOriginals(d, u)
  const variants = d.variants.filter((v) => v.data.product_external_id === p.external_id && v.status === 'published').map((v) => variantView(d, v, p))
  const assets = d.assets
    .filter((a) => a.data.product_external_id === p.external_id && assetVisible(d, a))
    .sort((a, b) => String(a.data.color_code ?? '').localeCompare(String(b.data.color_code ?? '')) || a.data.position - b.data.position)
    .map((a) => assetView(d, a, p, originals))
  const { brand_external_id: _b, status: _s, ...data } = p.data // eslint-disable-line @typescript-eslint/no-unused-vars
  return { ...(data as object), id: p.id, external_id: p.external_id, brand_id: brand.id, style_number: p.data.style_number, name: p.data.name, updated_at: p.updated_at, created_at: p.created_at, variants, assets } as ProductDetail
}

function portalSummary(d: MockDb, p: Rec, u: MockUser): PortalProductSummary {
  const detail = productDetail(d, p, u)
  const brand = brandByKey(d, p.data.brand_external_id)!
  const codes = [...new Set(detail.variants.map((v) => v.color.code))].sort()
  return {
    id: p.id,
    style_number: p.data.style_number,
    name: p.data.name,
    brand: { id: brand.id, name: String(brand.data.name) },
    item_type: p.data.item_type ?? null,
    target_group: p.data.target_group ?? null,
    season: p.data.season ?? null,
    collection: p.data.collection ?? null,
    thumb_url: detail.assets[0]?.renditions.thumb.url ?? null,
    colors: codes.map((code) => ({ code, name: detail.variants.find((v) => v.color.code === code)?.color.name ?? null, thumb_url: detail.assets.find((a) => a.color_code === code)?.renditions.thumb.url ?? null })),
    image_count: detail.assets.length,
    variant_count: detail.variants.length,
    updated_at: [p.updated_at, ...detail.assets.map((a) => a.updated_at)].sort().at(-1)!,
  }
}

type Filter = { q?: string; brand_id?: string[]; item_type?: string[]; color?: string[]; season?: string[]; collection?: string[]; target_group?: string[]; updated_since?: string }

function filterFrom(url: URL): Filter {
  const all = (k: string) => url.searchParams.getAll(k).filter(Boolean)
  return { q: url.searchParams.get('q') ?? undefined, brand_id: all('brand_id'), item_type: all('item_type'), color: all('color'), season: all('season'), collection: all('collection'), target_group: all('target_group'), updated_since: url.searchParams.get('updated_since') ?? undefined }
}

function portalProducts(d: MockDb, u: MockUser, f: Filter, skip?: keyof Filter) {
  const grant = grantBrandIds(d, u)
  const q = f.q?.toLowerCase().trim()
  return d.products
    .filter((p) => productVisible(d, p, grant))
    .map((p) => portalSummary(d, p, u))
    .filter((s) => {
      const p = d.products.find((x) => x.id === s.id)!
      if (q) {
        const variants = d.variants.filter((v) => v.data.product_external_id === p.external_id)
        const hay = [s.style_number, ...Object.values(s.name), ...variants.flatMap((v) => [v.data.gtin, v.data.sku, v.data.color?.code, ...Object.values(v.data.color?.name ?? {})])].join(' ').toLowerCase()
        const digits = q.replace(/\D/g, '')
        if (!hay.includes(q) && !(digits.length >= 8 && hay.includes(digits.replace(/^0+/, '')))) return false
      }
      const any = (k: keyof Filter, v: string | null | undefined) => skip === k || !(f[k] as string[] | undefined)?.length || (v != null && (f[k] as string[]).includes(v))
      if (!any('brand_id', s.brand.id) || !any('item_type', s.item_type) || !any('season', s.season) || !any('collection', s.collection) || !any('target_group', s.target_group)) return false
      if (skip !== 'color' && f.color?.length && !s.colors.some((c) => f.color!.includes(c.code))) return false
      if (f.updated_since && s.updated_at < f.updated_since) return false
      return true
    })
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at) || a.style_number.localeCompare(b.style_number))
}

function facet(values: { value: string | null | undefined; label?: unknown }[]) {
  const m = new Map<string, { value: string; label?: unknown; count: number }>()
  for (const v of values) {
    if (!v.value) continue
    const cur = m.get(v.value) ?? { value: v.value, label: v.label, count: 0 }
    cur.count++
    m.set(v.value, cur)
  }
  return [...m.values()].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
}

function logEvent(d: MockDb, u: MockUser, e: Omit<DownloadEvent, 'id' | 'at' | 'retailer_id' | 'retailer_name' | 'actor_type' | 'actor_name'>) {
  if (u.role !== 'retailer') return // admins preview; not logged
  const r = d.retailers.find((x) => x.id === u.retailer_id)
  d.events.unshift({ id: newId(d, 'evt'), at: nowIso(), retailer_id: r?.id ?? null, retailer_name: r?.name ?? null, actor_type: 'user', actor_name: u.name, ...e })
  if (r) r.last_activity_at = nowIso()
}

function publicBranding(d: MockDb): PublicBranding {
  const b = d.settings.branding ?? {}
  return {
    name: b.display_name ?? d.settings.company?.name ?? '',
    logo_url: b.logo_url ?? null,
    accent_color: b.accent_color ?? null,
    welcome_text: b.welcome_text ?? null,
    languages: d.settings.portal?.languages ?? ['en'],
    default_language: d.settings.portal?.default_language ?? 'en',
    access_requests_enabled: d.settings.portal?.access_requests_enabled ?? true,
    setup_required: d.setupRequired,
    brands: d.brands.filter((x) => x.status === 'published').map((x) => ({ id: x.id, name: String(x.data.name) })),
    ...({ portal_name: (b as { portal_name?: unknown }).portal_name ?? null } as object),
  }
}

function csvOf(d: MockDb, products: Rec[], delimiter: string) {
  const sep = delimiter === 'semicolon' ? ';' : ','
  const langs = d.settings.portal?.languages ?? ['en']
  const cols = ['brand', 'style_number', ...langs.map((l) => `name:${l}`), 'item_type', 'season', 'collection', 'gtin', 'sku', 'color_code', ...langs.map((l) => `color_name:${l}`), 'size', 'image_files']
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /["\n\r;,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [cols.join(sep)]
  for (const p of products) {
    const brand = brandByKey(d, p.data.brand_external_id)
    for (const v of d.variants.filter((x) => x.data.product_external_id === p.external_id && x.status === 'published')) {
      const files = d.assets.filter((a) => a.data.product_external_id === p.external_id && a.data.color_code === v.data.color.code && assetVisible(d, a)).map((a) => a.data.filename)
      lines.push([brand?.data.name, p.data.style_number, ...langs.map((l) => p.data.name?.[l]), p.data.item_type, p.data.season, p.data.collection, v.data.gtin, v.data.sku, v.data.color.code, ...langs.map((l) => v.data.color.name?.[l]), v.data.size, files.join('|')].map(esc).join(sep))
    }
  }
  return '﻿' + lines.join('\r\n') + '\r\n'
}

function zipResponse(name: string, files: Record<string, string>) {
  const zip = zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])))
  return new HttpResponse(zip, { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${name}"` } })
}

const summaryOf = (d: MockDb, p: Rec): AdminProductSummary => {
  const assets = d.assets.filter((a) => a.data.product_external_id === p.external_id)
  const first = assets.filter((a) => assetFilesPresent(d, a)).sort((a, b) => String(a.data.color_code).localeCompare(String(b.data.color_code)) || a.data.position - b.data.position)[0]
  return {
    id: p.id,
    external_id: p.external_id,
    brand_external_id: p.data.brand_external_id,
    style_number: p.data.style_number,
    name: p.data.name,
    status: p.status,
    visibility: productVisibility(d, p) === 'hidden' ? 'hidden' : 'visible',
    variant_count: d.variants.filter((v) => v.data.product_external_id === p.external_id).length,
    asset_count: assets.length,
    pending_asset_count: assets.filter((a) => !assetFilesPresent(d, a)).length,
    thumb_url: first ? d.blobs[first.data.files.original.sha256].url : null,
    updated_at: p.updated_at,
  }
}

function withVisibility(d: MockDb, r: Rec): Rec {
  if (r.kind === 'product') return { ...r, visibility: productVisibility(d, r) }
  if (r.kind === 'asset') {
    const missing = assetFilesPresent(d, r) ? null : ['original' as const]
    return { ...r, visibility: missing ? 'pending_files' : r.status === 'published' ? 'visible' : 'hidden', missing_files: missing }
  }
  return { ...r, visibility: r.status === 'published' ? 'visible' : 'hidden' }
}

function ingestPut(d: MockDb, list: Rec[], kind: Rec['kind'], externalId: string, data: Record<string, unknown>) {
  const existing = findRec(list, externalId)
  const status = (data.status as 'published' | 'unpublished' | undefined) ?? existing?.status ?? d.settings.defaults?.ingest_status ?? 'published'
  const { status: _s, ...rest } = data // eslint-disable-line @typescript-eslint/no-unused-vars
  if (!existing) {
    const r = record(d, kind, externalId, rest, status)
    list.push(r)
    return HttpResponse.json({ result: 'created', kind, external_id: externalId, id: r.id, etag: r.etag }, { status: 201 })
  }
  const merged = kind === 'asset' && !rest.files ? { ...rest, files: existing.data.files } : rest
  if (JSON.stringify(existing.data) === JSON.stringify(merged) && existing.status === status) return HttpResponse.json({ result: 'unchanged', kind, external_id: externalId, id: existing.id, etag: existing.etag })
  existing.data = merged
  existing.status = status
  touch(existing)
  return HttpResponse.json({ result: 'updated', kind, external_id: externalId, id: existing.id, etag: existing.etag })
}

function ingestPatch(_d: MockDb, list: Rec[], externalId: string, patch: Record<string, unknown>) {
  const existing = findRec(list, externalId)
  if (!existing) throw stop(404, 'not_found')
  const { status, ...rest } = patch
  const mergeDeep = (a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> => {
    const out = { ...a }
    for (const [k, v] of Object.entries(b)) {
      if (v === null) out[k] = null
      else if (typeof v === 'object' && !Array.isArray(v) && typeof a[k] === 'object' && a[k] && !Array.isArray(a[k]) && k !== 'files') out[k] = mergeDeep(a[k] as Record<string, unknown>, v as Record<string, unknown>)
      else out[k] = v
    }
    return out
  }
  existing.data = mergeDeep(existing.data, rest)
  if (status === 'published' || status === 'unpublished') existing.status = status
  touch(existing)
  return HttpResponse.json({ result: 'updated', kind: existing.kind, external_id: externalId, id: existing.id, etag: existing.etag })
}

function retailerView(d: MockDb, r: Retailer): Retailer {
  return { ...r, user_count: d.users.filter((u) => u.retailer_id === r.id).length, api_client_count: d.apiClients.filter((c) => c.retailer_id === r.id && c.status === 'active').length }
}

function invite(d: MockDb, u: MockUser) {
  const tok = token('inv_')
  for (const [k, v] of Object.entries(d.invites)) if (v === u.id) delete d.invites[k]
  d.invites[tok] = u.id
  u.invite_expires_at = new Date(Date.now() + 7 * 86_400_000).toISOString().replace(/\.\d{3}Z$/, 'Z')
  return { user: publicUser(u), invite_url: `${d.settings.node?.public_url}/invite/${tok}`, expires_at: u.invite_expires_at, email_sent: !!d.settings.node?.email_configured }
}

function newApiClient(d: MockDb, retailerId: string, name: string, scopes?: string[]) {
  const secret = token('obxs_')
  const c = { id: newId(d, 'cli'), client_id: token('obxc_').slice(0, 20), name, retailer_id: retailerId, scopes: (scopes ?? ['catalog:read', 'media:read', ...(d.settings.portal?.allow_original_download ? ['media:original'] : [])]) as never, status: 'active' as const, created_at: nowIso(), last_used_at: null, secret }
  d.apiClients.push(c)
  const { secret: _s, ...client } = c // eslint-disable-line @typescript-eslint/no-unused-vars
  return { client, client_secret: secret, token_endpoint: `${d.settings.node?.public_url}/obx/v1/oauth/token`, discovery_url: d.settings.node?.discovery_url ?? '' }
}

const publicClient = (c: MockDb['apiClients'][number]) => {
  const { secret: _s, ...rest } = c // eslint-disable-line @typescript-eslint/no-unused-vars
  return rest
}

function finishRun(d: MockDb, run: ImportRun) {
  if (run.status !== 'running' && run.status !== 'queued') return
  const pending = (run as ImportRun & { _pending?: Parameters<typeof applyImport>[1] })._pending
  if (!pending) return
  const outcome = applyImport(d, pending)
  run.counts = outcome.counts
  run.status = 'succeeded'
  run.started_at = run.created_at
  run.finished_at = nowIso()
  run.errors_preview = outcome.errors.slice(0, 50) as never
  d.importErrors[run.id] = outcome.errors as never
  delete (run as { _pending?: unknown })._pending
}

// ---------------------------------------------------------------- handlers

export const handlers = [
  // --- public / session
  http.get(`${API}/public/branding`, route(({ d }) => HttpResponse.json(publicBranding(d)), { public: true })),
  http.get(`${API}/session`, route(({ d }) => HttpResponse.json(session(d)), { public: true })),
  http.get(`${API}/setup`, route(({ d }) => HttpResponse.json({ required: d.setupRequired }), { public: true })),
  http.post(
    `${API}/setup`,
    route(
      async ({ request, d }) => {
        if (!d.setupRequired) throw stop(409, 'setup_completed')
        const b = await body<{ setup_code: string; company: { name: string; first_brand_name?: string; default_language: string; languages?: string[]; accent_color?: string; website?: string; contact_email?: string }; admin: { name: string; email: string; password: string } }>(request)
        if (b.setup_code !== DEMO.setupCode) throw stop(403, 'forbidden', 'Wrong setup code.')
        if ((b.admin?.password ?? '').length < 10) throw stop(422, 'validation_failed', undefined, [{ pointer: '/admin/password', obx_error: 'validation_failed', detail: 'At least 10 characters.' }])
        d.setupRequired = false
        d.settings.company = { name: b.company.name, website: b.company.website ?? null, contact_email: b.company.contact_email ?? null, country: null }
        d.settings.branding = { ...d.settings.branding, display_name: b.company.name, accent_color: b.company.accent_color ?? null, welcome_text: null, logo_url: null }
        d.settings.portal = { ...d.settings.portal!, languages: b.company.languages ?? [b.company.default_language], default_language: b.company.default_language }
        const brandName = b.company.first_brand_name || b.company.name
        d.brands.push(record(d, 'brand', slug(brandName), { name: brandName }))
        const u: MockUser = { id: newId(d, 'usr'), email: b.admin.email.toLowerCase(), name: b.admin.name, role: 'admin', status: 'active', language: b.company.default_language, retailer_id: null, last_login_at: nowIso(), invite_expires_at: null, created_at: nowIso(), password: b.admin.password }
        d.users.push(u)
        d.sessionUserId = u.id
        return HttpResponse.json(session(d), { status: 201 })
      },
      { public: true },
    ),
  ),
  http.post(
    `${API}/session/login`,
    route(
      async ({ request, d }) => {
        const b = await body<{ email: string; password: string }>(request)
        const u = d.users.find((x) => x.email.toLowerCase() === b.email?.toLowerCase().trim())
        if (!u || u.password !== b.password || u.status === 'invited') throw stop(401, 'invalid_credentials')
        if (u.status === 'blocked') throw stop(403, 'account_blocked')
        if (u.role === 'retailer' && d.retailers.find((r) => r.id === u.retailer_id)?.status === 'blocked') throw stop(403, 'account_blocked')
        d.sessionUserId = u.id
        u.last_login_at = nowIso()
        return HttpResponse.json(session(d))
      },
      { public: true },
    ),
  ),
  http.post(
    `${API}/session/logout`,
    route(
      ({ d }) => {
        d.sessionUserId = null
        return new HttpResponse(null, { status: 204 })
      },
      { public: true },
    ),
  ),
  http.post(`${API}/password/forgot`, route(() => new HttpResponse(null, { status: 202 }), { public: true })),
  http.post(
    `${API}/password/reset`,
    route(
      async ({ request, d }) => {
        const b = await body<{ token: string; password: string }>(request)
        const uid = d.invites[b.token]
        const u = d.users.find((x) => x.id === uid)
        if (!u) throw stop(400, 'invite_invalid')
        delete d.invites[b.token]
        u.password = b.password
        d.sessionUserId = u.id
        return HttpResponse.json(session(d))
      },
      { public: true },
    ),
  ),
  http.get(
    `${API}/invites/:token`,
    route(
      ({ params, d }) => {
        const u = d.users.find((x) => x.id === d.invites[params.token])
        if (!u || u.status !== 'invited') throw stop(400, 'invite_invalid')
        return HttpResponse.json({ email: u.email, name: u.name || null, role: u.role, retailer_name: d.retailers.find((r) => r.id === u.retailer_id)?.name ?? null, expires_at: u.invite_expires_at })
      },
      { public: true },
    ),
  ),
  http.post(
    `${API}/invites/:token/accept`,
    route(
      async ({ request, params, d }) => {
        const u = d.users.find((x) => x.id === d.invites[params.token])
        if (!u || u.status !== 'invited') throw stop(400, 'invite_invalid')
        const b = await body<{ name?: string; password: string; language?: string }>(request)
        if ((b.password ?? '').length < 10) throw stop(422, 'validation_failed', undefined, [{ pointer: '/password', obx_error: 'validation_failed', detail: 'At least 10 characters.' }])
        delete d.invites[params.token]
        Object.assign(u, { password: b.password, status: 'active', name: b.name || u.name, language: b.language ?? u.language, invite_expires_at: null, last_login_at: nowIso() })
        d.sessionUserId = u.id
        return HttpResponse.json(session(d))
      },
      { public: true },
    ),
  ),
  http.patch(
    `${API}/me`,
    route(async ({ request, d }) => {
      const u = me(d)
      const b = await body<{ name?: string; language?: string; current_password?: string; new_password?: string }>(request)
      if (b.new_password) {
        if (b.current_password !== u.password) throw stop(401, 'invalid_credentials', 'The current password is not correct.')
        if (b.new_password.length < 10) throw stop(422, 'validation_failed')
        u.password = b.new_password
      }
      if (b.name) u.name = b.name
      if (b.language) u.language = b.language
      return HttpResponse.json(session(d))
    }),
  ),

  // --- settings
  http.get(`${API}/settings`, route(({ d }) => (admin(d), HttpResponse.json(d.settings)))),
  http.patch(
    `${API}/settings`,
    route(async ({ request, d }) => {
      admin(d)
      const b = await body<Record<string, Record<string, unknown>>>(request)
      for (const k of ['company', 'branding', 'portal', 'defaults'] as const) if (b[k]) (d.settings as Record<string, unknown>)[k] = { ...(d.settings[k] ?? {}), ...b[k] }
      return HttpResponse.json(d.settings)
    }),
  ),
  http.put(
    `${API}/settings/logo`,
    route(async ({ request, d }) => {
      admin(d)
      const type = request.headers.get('Content-Type') ?? ''
      if (!/^image\/(png|jpeg|webp)$/.test(type)) throw stop(415, 'unsupported_media_type')
      const blob = await request.blob()
      d.settings.branding = { ...d.settings.branding, logo_url: typeof URL.createObjectURL === 'function' ? URL.createObjectURL(blob) : 'data:,' }
      return HttpResponse.json(d.settings)
    }),
  ),
  http.delete(
    `${API}/settings/logo`,
    route(({ d }) => {
      admin(d)
      d.settings.branding = { ...d.settings.branding, logo_url: null }
      return HttpResponse.json(d.settings)
    }),
  ),

  // --- catalog
  http.get(`${API}/catalog/brands`, route(({ d }) => (admin(d), HttpResponse.json({ items: d.brands.map((b) => withVisibility(d, b)) })))),
  http.put(`${API}/catalog/brands/:id`, route(async ({ request, params, d }) => (admin(d), ingestPut(d, d.brands, 'brand', params.id, await body(request))))),
  http.get(
    `${API}/catalog/products`,
    route(({ d, url }) => {
      admin(d)
      const q = url.searchParams.get('q')?.toLowerCase()
      const status = url.searchParams.get('status')
      const vis = url.searchParams.get('visibility')
      const brand = url.searchParams.get('brand')
      const sort = url.searchParams.get('sort') ?? 'updated_desc'
      let list = d.products.filter((p) => {
        if (status && p.status !== status) return false
        if (vis && productVisibility(d, p) !== vis) return false
        if (brand && p.data.brand_external_id !== brand) return false
        if (q) {
          const hay = [p.external_id, p.data.style_number, ...Object.values(p.data.name ?? {}), ...d.variants.filter((v) => v.data.product_external_id === p.external_id).flatMap((v) => [v.data.gtin, v.data.sku])].join(' ').toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })
      list = [...list].sort((a, b) => (sort === 'style_number' ? a.data.style_number.localeCompare(b.data.style_number) : b.updated_at.localeCompare(a.updated_at) || a.data.style_number.localeCompare(b.data.style_number)))
      return HttpResponse.json(page(list.map((p) => summaryOf(d, p)), url))
    }),
  ),
  http.get(
    `${API}/catalog/products/:id`,
    route(({ params, d }) => {
      admin(d)
      const p = findRec(d.products, params.id)
      if (!p) throw stop(404, 'not_found')
      const assets = d.assets.filter((a) => a.data.product_external_id === p.external_id)
      return HttpResponse.json({
        record: withVisibility(d, p),
        variants: d.variants.filter((v) => v.data.product_external_id === p.external_id).map((v) => withVisibility(d, v)),
        assets: assets.map((a) => ({ record: withVisibility(d, a), renditions: assetFilesPresent(d, a) ? renditionsOf(d, a, true) : {} })),
      })
    }),
  ),
  http.put(
    `${API}/catalog/products/:id`,
    route(async ({ request, params, d }) => {
      admin(d)
      const b = await body(request)
      if (!b.style_number || !b.name) throw stop(422, 'validation_failed', undefined, [{ pointer: b.style_number ? '/name' : '/style_number', obx_error: 'validation_failed', detail: 'Required.' }])
      if (!b.brand_external_id) b.brand_external_id = d.brands[0]?.external_id ?? null
      return ingestPut(d, d.products, 'product', params.id, b)
    }),
  ),
  http.patch(`${API}/catalog/products/:id`, route(async ({ request, params, d }) => (admin(d), ingestPatch(d, d.products, params.id, await body(request))))),
  http.delete(
    `${API}/catalog/products/:id`,
    route(({ params, d }) => {
      admin(d)
      const p = findRec(d.products, params.id)
      if (!p) throw stop(404, 'not_found')
      d.products = d.products.filter((x) => x !== p)
      d.variants = d.variants.filter((v) => v.data.product_external_id !== p.external_id)
      d.assets = d.assets.filter((a) => a.data.product_external_id !== p.external_id)
      return HttpResponse.json({ result: 'deleted', kind: 'product', external_id: p.external_id, id: p.id })
    }),
  ),
  http.put(
    `${API}/catalog/products/:id/asset-order`,
    route(async ({ request, params, d }) => {
      admin(d)
      const b = await body<{ color_code: string | null; asset_external_ids: string[] }>(request)
      const results = b.asset_external_ids.map((id, i) => {
        const a = findRec(d.assets, id)
        if (!a || a.data.product_external_id !== params.id) throw stop(422, 'validation_failed', `Unknown image ${id}.`)
        a.data.position = i + 1
        touch(a)
        return { result: 'updated', kind: 'asset', external_id: id, id: a.id }
      })
      return HttpResponse.json(results)
    }),
  ),
  http.put(
    `${API}/catalog/variants/:id`,
    route(async ({ request, params, d }) => {
      admin(d)
      const b = await body(request)
      const gtin = b.gtin as string | null
      if (gtin && !gtinValid(gtin)) throw stop(422, 'invalid_gtin', 'Check digit is not valid.', [{ pointer: '/gtin', obx_error: 'invalid_gtin', detail: 'Check digit is not valid.' }])
      if (gtin && d.variants.some((v) => v.data.gtin === gtin && v.external_id !== params.id)) throw stop(409, 'gtin_conflict', 'This EAN already belongs to another size.')
      if (!findRec(d.products, String(b.product_external_id))) throw stop(422, 'unknown_parent')
      return ingestPut(d, d.variants, 'variant', params.id, b)
    }),
  ),
  http.patch(`${API}/catalog/variants/:id`, route(async ({ request, params, d }) => (admin(d), ingestPatch(d, d.variants, params.id, await body(request))))),
  http.delete(
    `${API}/catalog/variants/:id`,
    route(({ params, d }) => {
      admin(d)
      d.variants = d.variants.filter((v) => v.external_id !== params.id)
      return HttpResponse.json({ result: 'deleted', kind: 'variant', external_id: params.id })
    }),
  ),
  http.put(
    `${API}/catalog/assets/:id`,
    route(async ({ request, params, d }) => {
      admin(d)
      const b = await body(request)
      const clash = d.assets.find((a) => a.external_id !== params.id && a.data.product_external_id === b.product_external_id && (a.data.color_code ?? null) === (b.color_code ?? null) && a.data.position === b.position)
      if (clash) throw stop(409, 'position_conflict', `Position ${b.position} is already taken by ${clash.external_id}.`)
      for (const ref of Object.values((b.files ?? {}) as Record<string, { sha256: string }>)) if (!d.blobs[ref.sha256]) throw stop(422, 'blob_missing')
      return ingestPut(d, d.assets, 'asset', params.id, b)
    }),
  ),
  http.patch(`${API}/catalog/assets/:id`, route(async ({ request, params, d }) => (admin(d), ingestPatch(d, d.assets, params.id, await body(request))))),
  http.delete(
    `${API}/catalog/assets/:id`,
    route(({ params, d }) => {
      admin(d)
      d.assets = d.assets.filter((a) => a.external_id !== params.id)
      return HttpResponse.json({ result: 'deleted', kind: 'asset', external_id: params.id })
    }),
  ),
  http.head(`${API}/catalog/blobs/:sha`, route(({ params, d }) => (admin(d), new HttpResponse(null, { status: d.blobs[params.sha] ? 200 : 404 })))),
  http.put(
    `${API}/catalog/blobs/:sha`,
    route(async ({ request, params, d }) => {
      admin(d)
      if (d.blobs[params.sha]) return HttpResponse.json({ ...d.blobs[params.sha], created: false })
      const blob = await request.blob()
      const buf = new Uint8Array(await blob.arrayBuffer())
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buf)), (x) => x.toString(16).padStart(2, '0')).join('')
      if (digest !== params.sha) throw stop(422, 'checksum_mismatch')
      const type = request.headers.get('Content-Type') ?? 'application/octet-stream'
      const url = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(new Blob([buf], { type })) : 'data:,'
      d.blobs[params.sha] = { sha256: params.sha, bytes: buf.byteLength, content_type: type, width: null, height: null, url }
      return HttpResponse.json({ ...d.blobs[params.sha], created: true }, { status: 201 })
    }),
  ),

  // --- imports
  http.get(
    `${API}/imports`,
    route(({ d, url }) => {
      admin(d)
      for (const r of d.importRuns) if (Date.now() - new Date(r.created_at).getTime() > 800) finishRun(d, r)
      const src = url.searchParams.get('source_id')
      return HttpResponse.json(page(d.importRuns.filter((r) => !src || r.source_id === src).map(({ _pending, ...r }: ImportRun & { _pending?: unknown }) => r), url, 25)) // eslint-disable-line @typescript-eslint/no-unused-vars
    }),
  ),
  http.post(
    `${API}/imports`,
    route(async ({ request, d }) => {
      admin(d)
      const fields = await multipartText(request)
      const text = async (k: string) => fields[k]
      const manifest = JSON.parse((await text('images_manifest')) ?? '[]') as ManifestItem[]
      const options = JSON.parse((await text('options')) ?? '{}') as { mode?: 'upsert' | 'mirror'; dry_run?: boolean; default_language?: string }
      const csv = await text('csv')
      const assetsCsv = await text('assets_csv')
      if (!csv && !assetsCsv && !manifest.length) throw stop(400, 'import_invalid', 'Nothing to import.')
      const run: ImportRun & { _pending?: unknown } = {
        id: newId(d, 'imp'),
        source_id: null,
        trigger: 'upload',
        status: 'running',
        mode: options.mode ?? 'upsert',
        dry_run: !!options.dry_run,
        created_at: nowIso(),
        started_at: nowIso(),
        finished_at: null,
        files: [...(csv ? [{ name: 'products.csv', bytes: csv.length, sha256: null }] : []), ...manifest.map((m) => ({ name: m.file, bytes: d.blobs[m.sha256]?.bytes ?? 0, sha256: m.sha256 }))],
        counts: { rows: 0, files: 0, created: 0, updated: 0, unchanged: 0, unpublished: 0, errors: 0, warnings: 0 },
        error: null,
        errors_preview: [],
        _pending: { csv, assetsCsv, manifest, mode: options.mode, dryRun: options.dry_run, defaultLang: options.default_language },
      }
      d.importRuns.unshift(run)
      const { _pending, ...visible } = run // eslint-disable-line @typescript-eslint/no-unused-vars
      return HttpResponse.json(visible, { status: 202 })
    }),
  ),
  http.get(
    `${API}/imports/:id`,
    route(({ params, d }) => {
      admin(d)
      const r = d.importRuns.find((x) => x.id === params.id)
      if (!r) throw stop(404, 'not_found')
      if (Date.now() - new Date(r.created_at).getTime() > 800) finishRun(d, r)
      const { _pending, ...visible } = r as ImportRun & { _pending?: unknown } // eslint-disable-line @typescript-eslint/no-unused-vars
      return HttpResponse.json(visible)
    }),
  ),
  http.get(`${API}/imports/:id/errors`, route(({ params, d, url }) => (admin(d), HttpResponse.json(page(d.importErrors[params.id] ?? [], url, 100))))),
  http.get(
    `${API}/import-template.csv`,
    route(({ d }) => {
      admin(d)
      const csv = 'brand,style_number,name:en,name:nl,item_type,season,materials,care,gtin,color_code,color_name:en,size\r\nKestrel,KO-9001,Rain Jacket,Regenjas,jacket,AW26,outer: 100% polyamide,wash_30|do_not_bleach,2000100101018,NVY,Navy,M\r\n'
      return new HttpResponse('﻿' + csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="products-template.csv"' } })
    }),
  ),
  http.get(`${API}/import-sources`, route(({ d }) => (admin(d), HttpResponse.json({ items: d.importSources })))),
  http.post(
    `${API}/import-sources`,
    route(async ({ request, d }) => {
      admin(d)
      const b = await body<Partial<ImportSource> & { credentials?: Record<string, unknown> }>(request)
      const url = (b.config as { url?: string } | undefined)?.url
      if (url && /^https?:\/\/(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(url)) throw stop(422, 'unsafe_url', 'Private addresses are not allowed.', [{ pointer: '/config/url', obx_error: 'unsafe_url', detail: 'Private addresses are not allowed.' }])
      const s: ImportSource = {
        id: newId(d, 'src'),
        name: b.name ?? 'Import',
        kind: b.kind ?? 'https_url',
        enabled: b.enabled ?? true,
        schedule: b.schedule ?? { frequency: 'daily', time: '02:30' },
        mode: b.mode ?? 'upsert',
        allow_mass_unpublish: !!b.allow_mass_unpublish,
        config: b.config as ImportSource['config'],
        credentials_set: { password: !!b.credentials?.password, private_key: !!b.credentials?.private_key, access_key_id: !!b.credentials?.access_key_id, secret_access_key: !!b.credentials?.secret_access_key, headers: Object.keys((b.credentials?.headers as object) ?? {}) },
        last_run: null,
        next_run_at: new Date(Date.now() + 86_400_000).toISOString().replace(/\.\d{3}Z$/, 'Z'),
        created_at: nowIso(),
        updated_at: nowIso(),
      }
      d.importSources.push(s)
      return HttpResponse.json(s, { status: 201 })
    }),
  ),
  http.patch(
    `${API}/import-sources/:id`,
    route(async ({ request, params, d }) => {
      admin(d)
      const s = d.importSources.find((x) => x.id === params.id)
      if (!s) throw stop(404, 'not_found')
      const { credentials, ...b } = await body<Partial<ImportSource> & { credentials?: Record<string, unknown> }>(request)
      Object.assign(s, b, { updated_at: nowIso() })
      if (credentials) for (const k of ['password', 'private_key', 'access_key_id', 'secret_access_key'] as const) if (k in credentials) (s.credentials_set as Record<string, unknown>)[k] = !!credentials[k]
      return HttpResponse.json(s)
    }),
  ),
  http.delete(
    `${API}/import-sources/:id`,
    route(({ params, d }) => {
      admin(d)
      d.importSources = d.importSources.filter((x) => x.id !== params.id)
      return new HttpResponse(null, { status: 204 })
    }),
  ),
  http.post(
    `${API}/import-sources/:id/test`,
    route(({ params, d }) => {
      admin(d)
      const s = d.importSources.find((x) => x.id === params.id)
      if (!s) throw stop(404, 'not_found')
      return HttpResponse.json({ ok: true, message: 'Connected (mock).', host_key_fingerprint: s.kind === 'sftp' ? 'SHA256:mockmockmockmockmockmockmockmockmockmock0' : null, files: [{ name: 'products.csv', bytes: 18_422, modified_at: nowIso() }, { name: 'images/KO-1001_NVY_1.jpg', bytes: 812_004, modified_at: nowIso() }] })
    }),
  ),
  http.post(
    `${API}/import-sources/:id/run`,
    route(({ params, d }) => {
      admin(d)
      const s = d.importSources.find((x) => x.id === params.id)
      if (!s) throw stop(404, 'not_found')
      const run: ImportRun = { id: newId(d, 'imp'), source_id: s.id, trigger: 'manual_run', status: 'succeeded', mode: s.mode, dry_run: false, created_at: nowIso(), started_at: nowIso(), finished_at: nowIso(), files: [], counts: { rows: 40, files: 0, created: 0, updated: 0, unchanged: 40, unpublished: 0, errors: 0, warnings: 0 }, error: null, errors_preview: [] }
      d.importRuns.unshift(run)
      s.last_run = run
      return HttpResponse.json(run, { status: 202 })
    }),
  ),

  // --- retailers, requests, users, API clients
  http.get(
    `${API}/retailers`,
    route(({ d, url }) => {
      admin(d)
      const q = url.searchParams.get('q')?.toLowerCase()
      const status = url.searchParams.get('status')
      const list = d.retailers.filter((r) => (!q || `${r.name} ${r.reference ?? ''}`.toLowerCase().includes(q)) && (!status || r.status === status)).map((r) => retailerView(d, r))
      return HttpResponse.json(page(list, url))
    }),
  ),
  http.post(
    `${API}/retailers`,
    route(async ({ request, d }) => {
      admin(d)
      const b = await body<Partial<Retailer>>(request)
      if (!b.name?.trim()) throw stop(422, 'validation_failed', undefined, [{ pointer: '/name', obx_error: 'validation_failed', detail: 'Required.' }])
      const r: Retailer = { id: newId(d, 'ret'), name: b.name, reference: b.reference ?? null, website: b.website ?? null, vat_number: b.vat_number ?? null, country: b.country ?? null, notes: b.notes ?? null, status: 'active', brand_ids: b.brand_ids ?? null, allow_original: b.allow_original ?? null, user_count: 0, api_client_count: 0, last_activity_at: null, created_at: nowIso() }
      d.retailers.push(r)
      return HttpResponse.json(r, { status: 201 })
    }),
  ),
  http.get(
    `${API}/retailers/:id`,
    route(({ params, d }) => {
      admin(d)
      const r = d.retailers.find((x) => x.id === params.id)
      if (!r) throw stop(404, 'not_found')
      return HttpResponse.json(retailerView(d, r))
    }),
  ),
  http.patch(
    `${API}/retailers/:id`,
    route(async ({ request, params, d }) => {
      admin(d)
      const r = d.retailers.find((x) => x.id === params.id)
      if (!r) throw stop(404, 'not_found')
      Object.assign(r, await body(request))
      return HttpResponse.json(retailerView(d, r))
    }),
  ),
  http.delete(
    `${API}/retailers/:id`,
    route(({ params, d }) => {
      admin(d)
      d.retailers = d.retailers.filter((x) => x.id !== params.id)
      d.users = d.users.filter((u) => u.retailer_id !== params.id)
      d.apiClients = d.apiClients.filter((c) => c.retailer_id !== params.id)
      return new HttpResponse(null, { status: 204 })
    }),
  ),
  http.get(
    `${API}/access-requests`,
    route(({ d, url }) => {
      admin(d)
      const status = url.searchParams.get('status')
      return HttpResponse.json(page(d.accessRequests.filter((a) => !status || a.status === status).sort((a, b) => b.created_at.localeCompare(a.created_at)), url))
    }),
  ),
  http.post(
    `${API}/access-requests/:id/approve`,
    route(async ({ request, params, d }) => {
      admin(d)
      const a = d.accessRequests.find((x) => x.id === params.id)
      if (!a) throw stop(404, 'not_found')
      if (a.status !== 'pending') throw stop(409, 'conflict', 'Already decided.')
      const b = await body<{ retailer_id?: string; brand_ids?: string[] | null; invite_portal_user?: boolean; create_api_client?: boolean }>(request)
      let r = b.retailer_id ? d.retailers.find((x) => x.id === b.retailer_id) : undefined
      if (!r) {
        r = { id: newId(d, 'ret'), name: a.retailer.name, reference: a.retailer.reference ?? null, website: a.retailer.website ?? null, vat_number: a.retailer.vat_number ?? null, country: a.retailer.country ?? null, notes: a.message ?? null, status: 'active', brand_ids: b.brand_ids ?? a.requested_brand_ids ?? null, allow_original: null, user_count: 0, api_client_count: 0, last_activity_at: null, created_at: nowIso() }
        d.retailers.push(r)
      }
      Object.assign(a, { status: 'approved', decided_at: nowIso(), retailer_id: r.id })
      let inv
      if (b.invite_portal_user ?? a.access.includes('portal')) {
        const u: MockUser = { id: newId(d, 'usr'), email: a.contact.email, name: a.contact.name, role: 'retailer', status: 'invited', language: a.contact.language ?? 'en', retailer_id: r.id, last_login_at: null, invite_expires_at: null, created_at: nowIso(), password: '' }
        d.users.push(u)
        inv = invite(d, u)
      }
      if (b.create_api_client ?? a.access.includes('api')) newApiClient(d, r.id, `${a.retailer.name} (requested)`)
      return HttpResponse.json({ access_request: a, retailer: retailerView(d, r), ...(inv && { invite: inv }) })
    }),
  ),
  http.post(
    `${API}/access-requests/:id/reject`,
    route(async ({ request, params, d }) => {
      admin(d)
      const a = d.accessRequests.find((x) => x.id === params.id)
      if (!a) throw stop(404, 'not_found')
      if (a.status !== 'pending') throw stop(409, 'conflict')
      const b = await body<{ reason?: string | null }>(request)
      Object.assign(a, { status: 'rejected', decided_at: nowIso(), reason: b.reason ?? null })
      return HttpResponse.json(a)
    }),
  ),
  http.get(
    `${API}/users`,
    route(({ d, url }) => {
      admin(d)
      const role = url.searchParams.get('role')
      const rid = url.searchParams.get('retailer_id')
      return HttpResponse.json(page(d.users.filter((u) => (!role || u.role === role) && (!rid || u.retailer_id === rid)).map(publicUser), url))
    }),
  ),
  http.post(
    `${API}/users/invites`,
    route(async ({ request, d }) => {
      admin(d)
      const b = await body<{ email: string; name?: string; role: 'admin' | 'retailer'; retailer_id?: string; language?: string }>(request)
      if (d.users.some((u) => u.email.toLowerCase() === b.email.toLowerCase())) throw stop(409, 'conflict', 'This e-mail address already has an account.')
      const u: MockUser = { id: newId(d, 'usr'), email: b.email.toLowerCase(), name: b.name ?? '', role: b.role, status: 'invited', language: b.language ?? 'en', retailer_id: b.retailer_id ?? null, last_login_at: null, invite_expires_at: null, created_at: nowIso(), password: '' }
      d.users.push(u)
      return HttpResponse.json(invite(d, u), { status: 201 })
    }),
  ),
  http.patch(
    `${API}/users/:id`,
    route(async ({ request, params, d }) => {
      const self = admin(d)
      const u = d.users.find((x) => x.id === params.id)
      if (!u) throw stop(404, 'not_found')
      const b = await body<{ name?: string; status?: 'active' | 'blocked' }>(request)
      if (b.status === 'blocked' && u.id === self.id) throw stop(409, 'conflict', 'You cannot block yourself.')
      Object.assign(u, b)
      return HttpResponse.json(publicUser(u))
    }),
  ),
  http.delete(
    `${API}/users/:id`,
    route(({ params, d }) => {
      const self = admin(d)
      if (params.id === self.id) throw stop(409, 'conflict', 'You cannot delete yourself.')
      d.users = d.users.filter((u) => u.id !== params.id)
      return new HttpResponse(null, { status: 204 })
    }),
  ),
  http.post(
    `${API}/users/:id/resend-invite`,
    route(({ params, d }) => {
      admin(d)
      const u = d.users.find((x) => x.id === params.id)
      if (!u) throw stop(404, 'not_found')
      if (u.status !== 'invited') throw stop(409, 'conflict')
      return HttpResponse.json(invite(d, u))
    }),
  ),
  http.get(
    `${API}/api-clients`,
    route(({ d, url }) => {
      admin(d)
      const rid = url.searchParams.get('retailer_id')
      return HttpResponse.json({ items: d.apiClients.filter((c) => !rid || c.retailer_id === rid).map(publicClient) })
    }),
  ),
  http.post(
    `${API}/api-clients`,
    route(async ({ request, d }) => {
      admin(d)
      const b = await body<{ retailer_id: string; name: string; scopes?: string[] }>(request)
      if (!d.retailers.some((r) => r.id === b.retailer_id)) throw stop(422, 'validation_failed')
      return HttpResponse.json(newApiClient(d, b.retailer_id, b.name, b.scopes), { status: 201 })
    }),
  ),
  http.post(
    `${API}/api-clients/:id/rotate`,
    route(({ params, d }) => {
      admin(d)
      const c = d.apiClients.find((x) => x.id === params.id)
      if (!c) throw stop(404, 'not_found')
      c.secret = token('obxs_')
      return HttpResponse.json({ client: publicClient(c), client_secret: c.secret, token_endpoint: `${d.settings.node?.public_url}/obx/v1/oauth/token`, discovery_url: d.settings.node?.discovery_url })
    }),
  ),
  http.delete(
    `${API}/api-clients/:id`,
    route(({ params, d }) => {
      admin(d)
      const c = d.apiClients.find((x) => x.id === params.id)
      if (!c) throw stop(404, 'not_found')
      c.status = 'revoked'
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  // --- automation
  http.get(`${API}/ingest-tokens`, route(({ d }) => (admin(d), HttpResponse.json({ items: d.ingestTokens })))),
  http.post(
    `${API}/ingest-tokens`,
    route(async ({ request, d }) => {
      admin(d)
      const b = await body<{ name: string; scopes: string[]; brand_external_ids?: string[] | null; expires_at?: string | null }>(request)
      if (!b.name?.trim() || !b.scopes?.length) throw stop(422, 'validation_failed')
      const secret = token('obxi_')
      const tk = { id: newId(d, 'itk'), name: b.name, prefix: secret.slice(0, 12), scopes: b.scopes as never, brand_external_ids: b.brand_external_ids ?? null, status: 'active' as const, expires_at: b.expires_at ?? null, created_at: nowIso(), last_used_at: null }
      d.ingestTokens.push(tk)
      return HttpResponse.json({ token: tk, secret, ingest_url: `${d.settings.node?.public_url}/obx/v1/ingest` }, { status: 201 })
    }),
  ),
  http.post(
    `${API}/ingest-tokens/:id/rotate`,
    route(({ params, d }) => {
      admin(d)
      const tk = d.ingestTokens.find((x) => x.id === params.id)
      if (!tk) throw stop(404, 'not_found')
      const secret = token('obxi_')
      tk.prefix = secret.slice(0, 12)
      return HttpResponse.json({ token: tk, secret, ingest_url: `${d.settings.node?.public_url}/obx/v1/ingest` })
    }),
  ),
  http.delete(
    `${API}/ingest-tokens/:id`,
    route(({ params, d }) => {
      admin(d)
      const tk = d.ingestTokens.find((x) => x.id === params.id)
      if (!tk) throw stop(404, 'not_found')
      tk.status = 'revoked'
      return new HttpResponse(null, { status: 204 })
    }),
  ),
  http.get(`${API}/webhooks`, route(({ d }) => (admin(d), HttpResponse.json({ items: d.webhooks.map((w) => ({ ...w, secret: null })) })))),
  http.post(
    `${API}/webhooks`,
    route(async ({ request, d }) => {
      admin(d)
      const b = await body<{ url: string; events: string[] }>(request)
      if (!/^https:\/\//.test(b.url ?? '')) throw stop(422, 'unsafe_url', 'Use an https:// address.', [{ pointer: '/url', obx_error: 'unsafe_url', detail: 'Use an https:// address.' }])
      const w: WebhookSubscriptionWithSecret = { id: newId(d, 'whk'), url: b.url, events: b.events, secret: token('whsec_'), status: 'active', created_at: nowIso(), last_delivery_at: null, last_status: null }
      d.webhooks.push({ ...w, secret: null })
      return HttpResponse.json(w, { status: 201 })
    }),
  ),
  http.patch(
    `${API}/webhooks/:id`,
    route(async ({ request, params, d }) => {
      admin(d)
      const w = d.webhooks.find((x) => x.id === params.id)
      if (!w) throw stop(404, 'not_found')
      Object.assign(w, await body(request))
      return HttpResponse.json(w)
    }),
  ),
  http.delete(
    `${API}/webhooks/:id`,
    route(({ params, d }) => {
      admin(d)
      d.webhooks = d.webhooks.filter((x) => x.id !== params.id)
      return new HttpResponse(null, { status: 204 })
    }),
  ),
  http.post(
    `${API}/webhooks/:id/test`,
    route(({ params, d }) => {
      admin(d)
      const w = d.webhooks.find((x) => x.id === params.id)
      if (!w) throw stop(404, 'not_found')
      const del = { id: newId(d, 'dlv'), event_id: newId(d, 'evt'), event_type: 'webhook.test', at: nowIso(), status_code: 200, duration_ms: 84, attempt: 1, success: true, error: null }
      d.deliveries[w.id] = [del, ...(d.deliveries[w.id] ?? [])]
      w.last_delivery_at = del.at
      w.last_status = 200
      return HttpResponse.json(del)
    }),
  ),
  http.get(`${API}/webhooks/:id/deliveries`, route(({ params, d, url }) => (admin(d), HttpResponse.json(page(d.deliveries[params.id] ?? [], url, 20))))),

  // --- stats
  http.get(
    `${API}/stats`,
    route(({ d, url }) => {
      admin(d)
      const days = Number(url.searchParams.get('days') ?? 30)
      const since = Date.now() - days * 86_400_000
      const ev = d.events.filter((e) => new Date(e.at).getTime() >= since)
      const byDay = Array.from({ length: days }, (_, i) => {
        const date = new Date(Date.now() - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10)
        const list = ev.filter((e) => e.at.startsWith(date))
        return { date, downloads: list.length, images: list.reduce((s, e) => s + (e.kind === 'csv' ? 0 : (e.files ?? 0)), 0) }
      })
      const per = new Map<string, { retailer_id: string; name: string; downloads: number; images: number; last_activity_at: string | null }>()
      for (const e of ev) {
        if (!e.retailer_id) continue
        const cur = per.get(e.retailer_id) ?? { retailer_id: e.retailer_id, name: e.retailer_name ?? '', downloads: 0, images: 0, last_activity_at: e.at }
        cur.downloads++
        cur.images += e.kind === 'csv' ? 0 : (e.files ?? 0)
        per.set(e.retailer_id, cur)
      }
      const perProduct = new Map<string, number>()
      for (const e of ev) if (e.product_id) perProduct.set(e.product_id, (perProduct.get(e.product_id) ?? 0) + 1)
      return HttpResponse.json({
        days,
        totals: {
          downloads: ev.length,
          images: ev.reduce((s, e) => s + (e.kind === 'csv' ? 0 : (e.files ?? 0)), 0),
          zips: ev.filter((e) => e.kind.endsWith('zip')).length,
          csv_exports: ev.filter((e) => e.kind === 'csv').length,
          api_downloads: ev.filter((e) => e.actor_type === 'api_client').length,
          usage_events: ev.filter((e) => e.kind === 'usage').length,
          active_retailers: per.size,
        },
        by_day: byDay,
        top_retailers: [...per.values()].sort((a, b) => b.images - a.images).slice(0, 20),
        top_products: [...perProduct.entries()].map(([pid, n]) => {
          const p = d.products.find((x) => x.id === pid)
          return { product_id: pid, style_number: p?.data.style_number ?? pid, name: p?.data.name ?? { en: pid }, downloads: n }
        }),
      })
    }),
  ),
  http.get(
    `${API}/stats/events`,
    route(({ d, url }) => {
      admin(d)
      const rid = url.searchParams.get('retailer_id')
      return HttpResponse.json(page(d.events.filter((e) => !rid || e.retailer_id === rid), url, 25))
    }),
  ),

  // --- portal
  http.get(
    `${API}/portal/viewer`,
    route(({ d }) => {
      const u = me(d)
      const r = u.role === 'retailer' ? d.retailers.find((x) => x.id === u.retailer_id) : null
      const grant = grantBrandIds(d, u)
      const brands = d.brands.filter((b) => b.status === 'published' && (!grant || grant.has(b.id))).map((b) => ({ id: b.id, external_id: b.external_id, name: String(b.data.name), logo_url: null, website: (b.data.website as string) ?? null, description: null, updated_at: b.updated_at }))
      return HttpResponse.json({
        preview: u.role === 'admin',
        retailer: r ? { id: r.id, name: r.name } : null,
        brands,
        permissions: { original_download: allowOriginals(d, u), article_data_export: !!d.settings.portal?.allow_article_data_export, api_self_service: !!d.settings.portal?.retailer_api_self_service },
        branding: publicBranding(d),
        languages: d.settings.portal?.languages ?? ['en'],
        selection_count: (d.selections[u.id] ?? []).length,
        limits: { selection_max_products: 1000, sync_zip_max_images: 400, gtin_lookup_max: 2000 },
      })
    }),
  ),
  http.get(
    `${API}/portal/products`,
    route(({ d, url }) => {
      const u = me(d)
      return HttpResponse.json(page(portalProducts(d, u, filterFrom(url)), url, 48))
    }),
  ),
  http.get(
    `${API}/portal/facets`,
    route(({ d, url }) => {
      const u = me(d)
      const f = filterFrom(url)
      const lang = (s: PortalProductSummary[]) => s
      const of = (skip: keyof Filter) => lang(portalProducts(d, u, f, skip))
      return HttpResponse.json({
        brands: facet(of('brand_id').map((p) => ({ value: p.brand.id, label: p.brand.name }))),
        item_types: facet(of('item_type').map((p) => ({ value: p.item_type }))),
        colors: facet(of('color').flatMap((p) => p.colors.map((c) => ({ value: c.code, label: c.name ?? c.code })))),
        seasons: facet(of('season').map((p) => ({ value: p.season }))),
        collections: facet(of('collection').map((p) => ({ value: p.collection }))),
        target_groups: facet(of('target_group').map((p) => ({ value: p.target_group }))),
      })
    }),
  ),
  http.get(
    `${API}/portal/products/:id`,
    route(({ params, d }) => {
      const u = me(d)
      const p = d.products.find((x) => x.id === params.id)
      if (!p || !productVisible(d, p, grantBrandIds(d, u))) throw stop(404, 'not_found')
      return HttpResponse.json(productDetail(d, p, u))
    }),
  ),
  http.post(
    `${API}/portal/gtin-lookup`,
    route(async ({ request, d }) => {
      const u = me(d)
      const b = await body<{ text?: string; gtins?: string[] }>(request)
      const codes = b.gtins ?? (b.text ?? '').split(/[^0-9]+/).filter(Boolean)
      if (codes.length > 2000) throw stop(400, 'limit_exceeded', 'At most 2000 codes.')
      const grant = grantBrandIds(d, u)
      const seen = new Set<string>()
      const results = []
      const productIds = new Set<string>()
      for (const input of codes) {
        const valid = /^(\d{8}|\d{12,14})$/.test(input)
        const gtin = valid ? input.padStart(14, '0') : null
        const key = gtin ?? input
        if (seen.has(key)) continue
        seen.add(key)
        const v = gtin ? d.variants.find((x) => x.status === 'published' && x.data.gtin && String(x.data.gtin).padStart(14, '0') === gtin) : undefined
        const p = v && d.products.find((x) => x.external_id === v.data.product_external_id)
        if (v && p && productVisible(d, p, grant)) {
          productIds.add(p.id)
          results.push({ input, gtin, status: 'matched', product_id: p.id, variant_id: v.id })
        } else results.push({ input, gtin, status: valid ? 'unmatched' : 'invalid', product_id: null, variant_id: null })
      }
      return HttpResponse.json({ results, products: [...productIds].map((id) => productDetail(d, d.products.find((x) => x.id === id)!, u)) })
    }),
  ),
  http.get(
    `${API}/portal/selection`,
    route(({ d }) => {
      const u = me(d)
      const ids = d.selections[u.id] ?? []
      return HttpResponse.json({ product_ids: ids, image_count: imageCount(d, u, ids), updated_at: null })
    }),
  ),
  http.put(
    `${API}/portal/selection`,
    route(async ({ request, d }) => {
      const u = me(d)
      const b = await body<{ product_ids: string[] }>(request)
      if ((b.product_ids ?? []).length > 1000) throw stop(400, 'limit_exceeded', 'A selection holds at most 1000 articles.')
      const grant = grantBrandIds(d, u)
      const ids = [...new Set(b.product_ids)].filter((id) => {
        const p = d.products.find((x) => x.id === id)
        return p && productVisible(d, p, grant)
      })
      d.selections[u.id] = ids
      return HttpResponse.json({ product_ids: ids, image_count: imageCount(d, u, ids), updated_at: nowIso() })
    }),
  ),
  http.delete(
    `${API}/portal/selection`,
    route(({ d }) => {
      const u = me(d)
      d.selections[u.id] = []
      return new HttpResponse(null, { status: 204 })
    }),
  ),
  http.get(
    `${API}/portal/assets/:id/download`,
    route(({ params, d, url }) => {
      const u = me(d)
      const variant = url.searchParams.get('variant') ?? (allowOriginals(d, u) ? 'original' : 'web')
      if (variant === 'original' && !allowOriginals(d, u)) throw stop(403, 'original_not_allowed')
      const a = d.assets.find((x) => x.id === params.id)
      const p = a && d.products.find((x) => x.external_id === a.data.product_external_id)
      if (!a || !p || !assetVisible(d, a) || !productVisible(d, p, grantBrandIds(d, u))) throw stop(404, 'not_found')
      logEvent(d, u, { kind: 'image', variant: variant as never, product_id: p.id, asset_id: a.id, usage_event: null, files: 1, bytes: null })
      const name = String(a.data.filename ?? a.external_id).replace(/\.(\w+)$/, variant === 'original' ? '.$1' : `_${variant}.jpg`)
      return new HttpResponse(`mock image ${a.external_id} (${variant})`, { headers: { 'Content-Type': 'image/jpeg', 'Content-Disposition': `attachment; filename="${name}"` } })
    }),
  ),
  http.get(
    `${API}/portal/products/:id/download.zip`,
    route(({ params, d, url }) => {
      const u = me(d)
      const variant = url.searchParams.get('variant') ?? 'web'
      if (variant === 'original' && !allowOriginals(d, u)) throw stop(403, 'original_not_allowed')
      const p = d.products.find((x) => x.id === params.id)
      if (!p || !productVisible(d, p, grantBrandIds(d, u))) throw stop(404, 'not_found')
      const detail = productDetail(d, p, u)
      logEvent(d, u, { kind: 'product_zip', variant: variant as never, product_id: p.id, asset_id: null, usage_event: null, files: detail.assets.length, bytes: null })
      return zipResponse(`${p.data.style_number}.zip`, Object.fromEntries(detail.assets.map((a) => [a.filename, `mock ${variant}`])))
    }),
  ),
  http.get(
    `${API}/portal/selection/download.zip`,
    route(({ d, url }) => {
      const u = me(d)
      const ids = d.selections[u.id] ?? []
      const n = imageCount(d, u, ids)
      if (n > 400) throw stop(400, 'limit_exceeded', 'More than 400 images: prepare a zip in the background.')
      const variant = url.searchParams.get('variant') ?? 'web'
      if (variant === 'original' && !allowOriginals(d, u)) throw stop(403, 'original_not_allowed')
      logEvent(d, u, { kind: 'selection_zip', variant: variant as never, product_id: null, asset_id: null, usage_event: null, files: n, bytes: null })
      const files: Record<string, string> = {}
      for (const id of ids) {
        const p = d.products.find((x) => x.id === id)!
        for (const a of productDetail(d, p, u).assets) files[`${p.data.style_number}/${a.filename}`] = `mock ${variant}`
      }
      return zipResponse('selection.zip', files)
    }),
  ),
  http.get(
    `${API}/portal/selection/data.csv`,
    route(({ d, url }) => {
      const u = me(d)
      if (!d.settings.portal?.allow_article_data_export) throw stop(403, 'forbidden')
      const ids = new Set(d.selections[u.id] ?? [])
      logEvent(d, u, { kind: 'csv', variant: null, product_id: null, asset_id: null, usage_event: null, files: 0, bytes: null })
      return new HttpResponse(csvOf(d, d.products.filter((p) => ids.has(p.id)), url.searchParams.get('delimiter') ?? 'comma'), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="selection.csv"' } })
    }),
  ),
  http.get(
    `${API}/portal/products/data.csv`,
    route(({ d, url }) => {
      const u = me(d)
      if (!d.settings.portal?.allow_article_data_export) throw stop(403, 'forbidden')
      const ids = new Set(portalProducts(d, u, filterFrom(url)).map((p) => p.id))
      logEvent(d, u, { kind: 'csv', variant: null, product_id: null, asset_id: null, usage_event: null, files: 0, bytes: null })
      return new HttpResponse(csvOf(d, d.products.filter((p) => ids.has(p.id)), url.searchParams.get('delimiter') ?? 'comma'), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="products.csv"' } })
    }),
  ),
  http.get(
    `${API}/portal/download-jobs`,
    route(({ d }) => {
      const u = me(d)
      for (const j of d.downloadJobs) advanceJob(j)
      return HttpResponse.json({ items: d.downloadJobs.filter((j) => j.user_id === u.id).map(({ user_id: _u, ...j }) => j) }) // eslint-disable-line @typescript-eslint/no-unused-vars
    }),
  ),
  http.post(
    `${API}/portal/download-jobs`,
    route(async ({ request, d }) => {
      const u = me(d)
      const b = await body<{ source: 'selection' | 'products' | 'filter'; product_ids?: string[]; filter?: Filter; variant: 'original' | 'web' | 'square'; include_data_csv?: boolean }>(request)
      if (b.variant === 'original' && !allowOriginals(d, u)) throw stop(403, 'original_not_allowed')
      if (d.downloadJobs.filter((j) => j.user_id === u.id && (j.status === 'queued' || j.status === 'running')).length >= 2) throw stop(409, 'conflict', 'Two downloads are already being prepared.')
      const ids = b.source === 'selection' ? d.selections[u.id] ?? [] : b.source === 'products' ? b.product_ids ?? [] : portalProducts(d, u, b.filter ?? {}).map((p) => p.id)
      const total = imageCount(d, u, ids)
      const job = { id: newId(d, 'job'), user_id: u.id, status: 'queued' as const, source: b.source, variant: b.variant, include_data_csv: b.include_data_csv ?? true, created_at: nowIso(), finished_at: null, expires_at: null, progress: { done: 0, total }, file_url: null, bytes: null, files: null, error: null }
      d.downloadJobs.unshift(job)
      logEvent(d, u, { kind: 'bulk_zip', variant: b.variant, product_id: null, asset_id: null, usage_event: null, files: total, bytes: null })
      const { user_id: _u, ...visible } = job // eslint-disable-line @typescript-eslint/no-unused-vars
      return HttpResponse.json(visible, { status: 202 })
    }),
  ),
  http.get(
    `${API}/portal/download-jobs/:id/file`,
    route(({ params, d }) => {
      const u = me(d)
      const j = d.downloadJobs.find((x) => x.id === params.id && x.user_id === u.id)
      if (!j || j.status !== 'succeeded') throw stop(404, 'not_found')
      return zipResponse(`download-${j.id}.zip`, { 'README.txt': 'Mock download.' })
    }),
  ),
  http.get(`${API}/portal/api-clients`, route(({ d }) => {
    const u = me(d)
    return HttpResponse.json({ items: d.apiClients.filter((c) => c.retailer_id === u.retailer_id).map(publicClient) })
  })),
  http.post(
    `${API}/portal/api-clients`,
    route(async ({ request, d }) => {
      const u = me(d)
      if (!d.settings.portal?.retailer_api_self_service || !u.retailer_id) throw stop(403, 'forbidden')
      const b = await body<{ name: string }>(request)
      if (d.apiClients.filter((c) => c.retailer_id === u.retailer_id && c.status === 'active').length >= 5) throw stop(409, 'conflict', 'At most 5 active API keys.')
      return HttpResponse.json(newApiClient(d, u.retailer_id, b.name), { status: 201 })
    }),
  ),
  http.post(
    `${API}/portal/api-clients/:id/rotate`,
    route(({ params, d }) => {
      const u = me(d)
      const c = d.apiClients.find((x) => x.id === params.id && x.retailer_id === u.retailer_id)
      if (!c) throw stop(404, 'not_found')
      c.secret = token('obxs_')
      return HttpResponse.json({ client: publicClient(c), client_secret: c.secret, token_endpoint: `${d.settings.node?.public_url}/obx/v1/oauth/token`, discovery_url: d.settings.node?.discovery_url })
    }),
  ),
  http.delete(
    `${API}/portal/api-clients/:id`,
    route(({ params, d }) => {
      const u = me(d)
      const c = d.apiClients.find((x) => x.id === params.id && x.retailer_id === u.retailer_id)
      if (!c) throw stop(404, 'not_found')
      c.status = 'revoked'
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  // --- protocol: public access-request form
  http.post(
    '*/obx/v1/access-requests',
    route(
      async ({ request, d }) => {
        const b = await body<{ retailer: { name: string; reference?: string | null; website?: string | null; vat_number?: string | null; country?: string | null }; contact: { name: string; email: string; phone?: string | null; language?: string | null }; access?: ('portal' | 'api')[]; requested_brand_ids?: string[] | null; message?: string | null }>(request)
        if (!d.settings.portal?.access_requests_enabled) throw stop(403, 'forbidden')
        if (!b.retailer?.name || !b.contact?.email) throw stop(422, 'validation_failed')
        const a = { id: newId(d, 'arq'), status: 'pending' as const, created_at: nowIso(), decided_at: null, reason: null, retailer: { name: b.retailer.name, reference: b.retailer.reference ?? null, website: b.retailer.website ?? null, vat_number: b.retailer.vat_number ?? null, country: b.retailer.country ?? null }, contact: { name: b.contact.name, email: b.contact.email, phone: b.contact.phone ?? null, language: b.contact.language ?? null }, access: b.access ?? ['portal'], requested_brand_ids: b.requested_brand_ids ?? null, message: b.message ?? null, retailer_id: null, source_ip_country: null }
        d.accessRequests.unshift(a)
        return HttpResponse.json({ id: a.id, status: 'pending', created_at: a.created_at, poll_url: `${d.settings.node?.public_url}/obx/v1/access-requests/${a.id}` }, { status: 201 })
      },
      { public: true },
    ),
  ),

  // --- mock controls (only in mock mode): /__mock/reset?kind=fresh|seeded
  http.post('*/__mock/reset', async ({ request }) => {
    const kind = new URL(request.url).searchParams.get('kind') === 'fresh' ? 'fresh' : 'seeded'
    const d = resetDb(kind)
    return HttpResponse.json({ ok: true, csrf: d.csrf })
  }),
]

type WebhookSubscriptionWithSecret = MockDb['webhooks'][number]

function imageCount(d: MockDb, u: MockUser, ids: string[]) {
  return ids.reduce((n, id) => {
    const p = d.products.find((x) => x.id === id)
    return n + (p ? productDetail(d, p, u).assets.length : 0)
  }, 0)
}

function advanceJob(j: MockDb['downloadJobs'][number]) {
  const age = Date.now() - new Date(j.created_at).getTime()
  if (j.status === 'queued' && age > 300) j.status = 'running'
  if (j.status === 'running') {
    const total = j.progress.total ?? 1
    j.progress.done = Math.min(total, Math.round((total * age) / 3000))
    if (age > 3000) {
      Object.assign(j, { status: 'succeeded', finished_at: nowIso(), expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString().replace(/\.\d{3}Z$/, 'Z'), file_url: `/admin/api/portal/download-jobs/${j.id}/file`, files: total, bytes: total * 850_000 })
      j.progress.done = total
    }
  }
}

/** Text fields and text files of a multipart body. Falls back to a tiny parser where the
 * runtime's formData() cannot be used (jsdom in Node tests). */
async function multipartText(request: Request): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  const type = request.headers.get('Content-Type') ?? ''
  const raw = await request.arrayBuffer()
  try {
    const form = await new Response(raw, { headers: { 'Content-Type': type } }).formData()
    for (const [k, v] of form.entries()) out[k] = typeof v === 'string' ? v : await v.text()
    return out
  } catch {
    const boundary = /boundary=([^;]+)/.exec(type)?.[1]
    if (!boundary) return out
    for (const part of new TextDecoder().decode(raw).split(`--${boundary}`)) {
      const m = /^\r\nContent-Disposition: form-data; name="([^"]+)"[^\r]*\r\n(?:Content-Type: [^\r]*\r\n)?\r\n([\s\S]*)\r\n$/.exec(part)
      if (m) out[m[1]] = m[2]
    }
    return out
  }
}
