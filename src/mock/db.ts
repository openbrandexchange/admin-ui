// In-memory mock node, seeded from the spec's Kestrel Outfitters fixtures. Used by
// `npm run mock` (MSW in the browser), the vitest suite (MSW in Node) and Playwright.
// State survives reloads within a tab (sessionStorage). Everything is fictional.
import productsCsv from './fixtures/products.csv?raw'
import assetsCsv from './fixtures/assets.csv?raw'
import imagesJson from './fixtures/images.json'
import type {
  AccessRequestSummaryShape,
  MockApiClient,
  MockUser,
  Rec,
} from './types'
import type {
  DownloadEvent,
  DownloadJob,
  ImportRowError,
  ImportRun,
  ImportSource,
  IngestToken,
  Retailer,
  Settings,
  WebhookDelivery,
  WebhookSubscription,
} from '../api/types'
import { checkGtin, localizedFrom, materialsFrom, parseImageName, rowsOf, truthy, type RowError } from './csv'
import { labelWarnings, measurementsFrom, parseCertifications, parseFeature, parseFootwear, type FeatureValue } from '../lib/article'
import { COLOUR_FAMILIES, MEASUREMENTS } from '../lib/vocab'

export const DEMO = {
  admin: { email: 'admin@kestrel.example', password: 'kestrel-admin-2026' },
  retailer: { email: 'buyer@shop.example', password: 'kestrel-shop-2026' },
  setupCode: 'KESTREL-SETUP',
}

export interface MockBlob {
  sha256: string
  bytes: number
  content_type: string
  width: number | null
  height: number | null
  url: string
}

export interface MockDb {
  seq: number
  setupRequired: boolean
  sessionUserId: string | null
  csrf: string
  settings: Settings
  users: MockUser[]
  invites: Record<string, string> // token -> user id
  brands: Rec[]
  products: Rec[]
  variants: Rec[]
  assets: Rec[]
  blobs: Record<string, MockBlob>
  retailers: Retailer[]
  accessRequests: AccessRequestSummaryShape[]
  apiClients: MockApiClient[]
  ingestTokens: IngestToken[]
  webhooks: WebhookSubscription[]
  deliveries: Record<string, WebhookDelivery[]>
  importSources: ImportSource[]
  importRuns: ImportRun[]
  importErrors: Record<string, ImportRowError[]>
  downloadJobs: (DownloadJob & { user_id: string })[]
  events: DownloadEvent[]
  selections: Record<string, string[]>
}

const STORAGE = 'obx.mock.v3'
const now = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString().replace(/\.\d{3}Z$/, 'Z')

export function newId(db: MockDb, prefix: string): string {
  db.seq += 1
  return `${prefix}_${db.seq.toString(36).padStart(6, '0')}`
}

export const slug = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const fixtureBase = () => (typeof document !== 'undefined' ? new URL('mock-fixtures/kestrel/', document.baseURI).toString() : 'http://localhost/mock-fixtures/kestrel/')

function baseSettings(): MockDb['settings'] {
  const origin = typeof location !== 'undefined' ? location.origin : 'http://localhost:5173'
  return {
    company: { name: 'Kestrel Outfitters', website: 'https://kestrel.example', contact_email: 'trade@kestrel.example', country: 'NL' },
    branding: { display_name: 'Kestrel', logo_url: null, accent_color: '#1f4e5f', welcome_text: { en: 'Final product images and article data for Kestrel retailers.', nl: 'Definitieve productbeelden en artikeldata voor Kestrel-retailers.' } },
    portal: { access_requests_enabled: true, allow_original_download: true, allow_article_data_export: true, retailer_api_self_service: true, languages: ['nl', 'en'], default_language: 'nl' },
    defaults: { rights: { license: 'retailer-use', channels: ['webshop', 'marketplace', 'social'], territories: null }, ingest_status: 'published' },
    node: {
      public_url: origin,
      discovery_url: `${origin}/.well-known/obx`,
      software: 'mock node (admin-ui)',
      version: '0.3.0',
      email_configured: false,
      renditions_server_generated: true,
      max_upload_bytes: 200 * 1024 * 1024,
      custom_domain_help: 'Point a CNAME record for your domain (for example brands.kestrel.example) at this installation, then set OBX_PUBLIC_URL to that address and restart.',
    },
  }
}

function emptyDb(): MockDb {
  return {
    seq: 1000,
    setupRequired: true,
    sessionUserId: null,
    csrf: 'csrf-' + Math.random().toString(36).slice(2),
    settings: baseSettings(),
    users: [],
    invites: {},
    brands: [],
    products: [],
    variants: [],
    assets: [],
    blobs: {},
    retailers: [],
    accessRequests: [],
    apiClients: [],
    ingestTokens: [],
    webhooks: [],
    deliveries: {},
    importSources: [],
    importRuns: [],
    importErrors: {},
    downloadJobs: [],
    events: [],
    selections: {},
  }
}

export function record(db: MockDb, kind: Rec['kind'], externalId: string, data: Record<string, unknown>, status: 'published' | 'unpublished' = 'published'): Rec {
  const t = now()
  return { kind, id: newId(db, kind.slice(0, 3)), external_id: externalId, status, visibility: 'visible', etag: `"${db.seq}"`, created_at: t, updated_at: t, data, missing_files: null }
}

export function touch(r: Rec) {
  r.updated_at = now()
  r.etag = `"${Date.now().toString(36)}"`
}

export function brandByKey(db: MockDb, key: string | null | undefined): Rec | undefined {
  if (!key) return db.brands[0]
  const k = key.toLowerCase()
  return db.brands.find((b) => b.external_id.toLowerCase() === k || String(b.data.name ?? '').toLowerCase() === k)
}

// ---------------------------------------------------------------- canonical import

const LABEL_DETAIL: Record<string, string> = {
  fibre_composition_missing: 'The fibre composition is missing (Regulation (EU) No 1007/2011).',
  animal_origin_unknown: 'State whether the article contains non-textile parts of animal origin (Regulation (EU) No 1007/2011, Art. 12).',
  footwear_materials_missing: 'The materials of upper, lining and sock and outer sole are missing (Directive 94/11/EC).',
  fibre_percentages_not_100: 'The percentages do not add up to 100 (Regulation (EU) No 1007/2011, Art. 9).',
}

export interface ManifestItem {
  file: string
  sha256: string
  width?: number
  height?: number
}

export interface ImportOutcome {
  counts: ImportRun['counts']
  errors: RowError[]
}

/** Apply products.csv / assets.csv / an images manifest with ingest semantics (simplified). */
/** attr:<key> (text) and attr:<key>:<lang> (text per language) columns → Product.attributes. */
function attributesFrom(row: Record<string, string>): Record<string, string | Record<string, string>> | null {
  const out: Record<string, string | Record<string, string>> = {}
  for (const [col, v] of Object.entries(row)) {
    const m = /^attr:([a-z0-9_]+)(?::([a-z]{2}))?$/.exec(col)
    if (!m || !v.trim()) continue
    if (m[2]) out[m[1]] = { ...(typeof out[m[1]] === 'object' ? (out[m[1]] as Record<string, string>) : {}), [m[2]]: v.trim() }
    else out[m[1]] = v.trim()
  }
  return Object.keys(out).length ? out : null
}

export function applyImport(db: MockDb, input: { csv?: string; assetsCsv?: string; manifest?: ManifestItem[]; mode?: 'upsert' | 'mirror'; dryRun?: boolean; defaultLang?: string }): ImportOutcome {
  const counts = { rows: 0, files: 0, created: 0, updated: 0, unchanged: 0, unpublished: 0, errors: 0, warnings: 0 }
  const errors: RowError[] = []
  const lang = input.defaultLang ?? db.settings.portal?.default_language ?? 'en'
  const err = (e: Omit<RowError, 'severity'>, severity: 'error' | 'warning' = 'error') => {
    errors.push({ ...e, severity })
    if (severity === 'error') counts.errors++
    else counts.warnings++
  }
  const target = input.dryRun ? (JSON.parse(JSON.stringify(db)) as MockDb) : db
  const seen = new Set<string>()
  const upsert = (list: Rec[], kind: Rec['kind'], id: string, data: Record<string, unknown>, status?: 'published' | 'unpublished') => {
    const existing = list.find((r) => r.external_id === id)
    if (!existing) {
      list.push(record(target, kind, id, data, status ?? target.settings.defaults?.ingest_status ?? 'published'))
      counts.created++
      return
    }
    const merged = { ...data, ...(kind === 'asset' && !data.files ? { files: existing.data.files } : {}) }
    if (JSON.stringify(existing.data) === JSON.stringify(merged) && (!status || status === existing.status)) {
      counts.unchanged++
      return
    }
    existing.data = merged
    if (status) existing.status = status
    touch(existing)
    counts.updated++
  }

  if (input.csv) {
    const { header, rows } = rowsOf(input.csv)
    const known = new RegExp(`^(brand|product_id|style_number|name|description|item_type|item_subtype|target_group|season|collection|gpc_brick|materials|contains_animal_origin|footwear_materials|care|country_of_origin|certifications|dpp_url|status|feature|attr|variant_id|gtin|sku|color_code|color_name|color_family|supplier_color|size|size_length|size_system|${MEASUREMENTS.join('|')}|variant_status|image_files)(:.*)?$`)
    const featureKeys = header.filter((h) => h.startsWith('feature:')).map((h) => h.slice(8))
    for (const h of header) if (!known.test(h)) err({ file: 'products.csv', row: null, column: h, obx_error: 'validation_failed', detail: 'Unknown column, ignored.', value: null }, 'warning')
    rows.forEach((row, i) => {
      const n = i + 1
      counts.rows++
      if (!row.style_number) return err({ file: 'products.csv', row: n, column: 'style_number', obx_error: 'validation_failed', detail: 'Style number is required.', value: null })
      const name = localizedFrom(row, 'name', lang)
      if (!name) return err({ file: 'products.csv', row: n, column: 'name', obx_error: 'validation_failed', detail: 'A name is required.', value: null })
      let brand = brandByKey(target, row.brand)
      if (!brand && row.brand) {
        brand = record(target, 'brand', slug(row.brand), { name: row.brand })
        target.brands.push(brand)
      }
      const productId = row.product_id || row.style_number
      if (!seen.has(productId)) {
        seen.add(productId)
        const materials = row.materials ? materialsFrom(row.materials) : null
        if (row.materials && materials === undefined) err({ file: 'products.csv', row: n, column: 'materials', obx_error: 'validation_failed', detail: 'Could not read the materials.', value: row.materials }, 'warning')
        const footwear = parseFootwear(row.footwear_materials ?? '')
        if (!footwear.ok) return err({ file: 'products.csv', row: n, column: 'footwear_materials', obx_error: 'validation_failed', detail: 'Use upper, lining_and_sock and outer_sole with leather, coated_leather, textile or other.', value: row.footwear_materials })
        const certifications = parseCertifications(row.certifications ?? '')
        if (!certifications.ok) return err({ file: 'products.csv', row: n, column: 'certifications', obx_error: 'validation_failed', detail: 'Use scheme:licence number, separated by ;.', value: row.certifications })
        const features: Record<string, FeatureValue> = {}
        for (const key of featureKeys) {
          const v = parseFeature(key, row[`feature:${key}`] ?? '')
          if (v === undefined) return err({ file: 'products.csv', row: n, column: `feature:${key}`, obx_error: 'validation_failed', detail: 'Not a value of this feature.', value: row[`feature:${key}`] })
          if (v !== null) features[key] = v
        }
        const animal = (row.contains_animal_origin ?? '').trim()
        const product = {
          brand_external_id: brand?.external_id ?? null,
          style_number: row.style_number,
          name,
          description: localizedFrom(row, 'description', lang),
          item_type: row.item_type ? row.item_type.toLowerCase().replace(/\s+/g, '_') : null,
          item_subtype: row.item_subtype ? row.item_subtype.toLowerCase().replace(/\s+/g, '_') : null,
          target_group: row.target_group || null,
          season: row.season || null,
          collection: row.collection || null,
          materials: materials ?? null,
          contains_animal_origin: animal ? truthy(animal) : null,
          footwear_materials: footwear.value,
          care: row.care ? row.care.split('|').map((code) => ({ code: code.trim() })) : null,
          country_of_origin: row.country_of_origin || null,
          certifications: certifications.value,
          dpp_url: row.dpp_url || null,
          features: Object.keys(features).length ? features : null,
          attributes: attributesFrom(row),
        }
        upsert(
          target.products,
          'product',
          productId,
          product,
          (row.status as 'published' | 'unpublished') || undefined,
        )
        // Rule 10: label completeness warnings, at most once per code (per part) and product.
        for (const w of labelWarnings(product)) err({ file: 'products.csv', row: n, column: w.column, obx_error: w.code, detail: LABEL_DETAIL[w.code] + (w.part ? ` (${w.part})` : ''), value: null }, 'warning')
      }
      const hasVariant = row.gtin || row.variant_id || row.sku || row.color_code || row.size
      if (!hasVariant) return
      const gtinProblem = checkGtin(row.gtin ?? '')
      if (gtinProblem) return err({ file: 'products.csv', row: n, column: 'gtin', obx_error: 'invalid_gtin', detail: gtinProblem, value: row.gtin })
      if (!row.color_code) return err({ file: 'products.csv', row: n, column: 'color_code', obx_error: 'validation_failed', detail: 'Colour code is required for a size row.', value: null })
      const gtin = row.gtin?.replace(/\s/g, '') || null
      const vid = row.variant_id || gtin || [row.style_number, row.color_code, row.size].filter(Boolean).join('-')
      const family = (row.color_family ?? '').trim().toLowerCase().replace(/^gray$/, 'grey').replace(/^multicolor$/, 'multicolour')
      if (family && !(COLOUR_FAMILIES as readonly string[]).includes(family)) return err({ file: 'products.csv', row: n, column: 'color_family', obx_error: 'validation_failed', detail: 'Not a colour family.', value: row.color_family })
      const measurements = measurementsFrom(row)
      if (!measurements.ok) return err({ file: 'products.csv', row: n, column: measurements.key, obx_error: 'validation_failed', detail: 'Use a number without unit, like 2.6.', value: row[measurements.key] })
      const clash = gtin && target.variants.find((v) => v.data.gtin === gtin && v.external_id !== vid)
      if (clash) return err({ file: 'products.csv', row: n, column: 'gtin', obx_error: 'gtin_conflict', detail: `This EAN already belongs to ${clash.data.product_external_id}.`, value: gtin })
      upsert(target.variants, 'variant', vid, {
        product_external_id: productId,
        gtin,
        sku: row.sku || null,
        color: { code: row.color_code, name: localizedFrom(row, 'color_name', lang), supplier_color: row.supplier_color || null, family: family || null },
        size: row.size || null,
        size_length: row.size_length || null,
        size_system: row.size_system || null,
        measurements: measurements.value,
      })
    })
    if (input.mode === 'mirror') {
      const brandsInFile = new Set(target.products.filter((p) => seen.has(p.external_id)).map((p) => p.data.brand_external_id))
      const missing = target.products.filter((p) => brandsInFile.has(p.data.brand_external_id) && !seen.has(p.external_id) && p.status === 'published')
      for (const p of missing) {
        p.status = 'unpublished'
        touch(p)
        counts.unpublished++
      }
    }
  }

  const overrides = new Map<string, Record<string, string>>()
  if (input.assetsCsv) for (const row of rowsOf(input.assetsCsv).rows) if (row.file) overrides.set(row.file, row)

  for (const item of input.manifest ?? []) {
    counts.files++
    const o = overrides.get(item.file)
    const parsed = parseImageName(item.file)
    if (!parsed) {
      err({ file: item.file, row: null, column: null, obx_error: 'validation_failed', detail: 'The file name does not follow {style}_{colour}_{position}.jpg.', value: null })
      continue
    }
    const product = target.products.find((p) => String(p.data.style_number).toLowerCase() === parsed.style.toLowerCase())
    if (!product) {
      err({ file: item.file, row: null, column: null, obx_error: 'unknown_parent', detail: `No article ${parsed.style} in this import or catalog.`, value: null })
      continue
    }
    const colour = target.variants.find((v) => v.data.product_external_id === product.external_id && String((v.data.color as { code: string }).code).toLowerCase() === parsed.color.toLowerCase())
    const colorCode = colour ? (colour.data.color as { code: string }).code : parsed.color
    const id = `${product.data.style_number}_${colorCode}_${parsed.position}`
    const blob = target.blobs[item.sha256]
    if (!blob) {
      err({ file: item.file, row: null, column: null, obx_error: 'blob_missing', detail: 'The image was not uploaded.', value: item.sha256 })
      continue
    }
    const alt = o ? localizedFrom(o, 'alt_text', lang) : null
    upsert(
      target.assets,
      'asset',
      id,
      {
        product_external_id: product.external_id,
        color_code: colorCode,
        role: o?.role || parsed.role,
        view: o?.view || parsed.view,
        position: parsed.position,
        filename: item.file,
        alt_text: alt,
        rights: {
          ...(o?.embargo_until && { embargo_until: o.embargo_until }),
          ...(o?.credit && { credit: o.credit }),
        },
        provenance: {
          ai_generated: o?.ai_generated ? truthy(o.ai_generated) : false,
          ai_edited: o?.ai_edited ? truthy(o.ai_edited) : false,
          source: o?.source || (o?.ai_generated && truthy(o.ai_generated) ? 'generated' : 'photo'),
          c2pa: o?.c2pa || 'none',
          generator: o?.generator || null,
        },
        files: { original: { sha256: item.sha256, width: item.width ?? blob.width, height: item.height ?? blob.height } },
      },
      (o?.status as 'published' | 'unpublished') || undefined,
    )
  }
  return { counts, errors }
}

// ---------------------------------------------------------------- seeding

/** spec fixtures/imports/label-warnings.csv (conformance I-IMP-8). */
const LABEL_CHECK_CSV = `brand,style_number,name:en,item_type,materials,contains_animal_origin,footwear_materials
Kestrel,KL-8001,Label Test Tee,t_shirt,,no,
Kestrel,KL-8002,Label Test Scarf,scarf,main: 100% wool,,
Kestrel,KL-8003,Label Test Sneaker,sneakers,upper: 100% polyester,,
Kestrel,KL-8004,Label Test Shirt,shirt,"main: 60% cotton, 30% polyester",no,
Kestrel,KL-8005,Label Test Sandal,sandals,,,upper: leather; lining_and_sock: leather
Kestrel,KL-8006,Label Test Complete,t_shirt,main: 100% cotton,no,
`

export function seedDb(): MockDb {
  const db = emptyDb()
  db.setupRequired = false
  const admin: MockUser = { id: 'usr_admin', email: DEMO.admin.email, name: 'Iris de Vries', role: 'admin', status: 'active', language: 'nl', retailer_id: null, last_login_at: daysAgo(1), invite_expires_at: null, created_at: daysAgo(120), password: DEMO.admin.password }
  db.users.push(admin)
  db.brands.push(record(db, 'brand', 'kestrel', { name: 'Kestrel', website: 'https://kestrel.example' }))
  const base = fixtureBase()
  const images = imagesJson as Record<string, { sha256: string; bytes: number; width: number; height: number }>
  for (const [file, meta] of Object.entries(images)) db.blobs[meta.sha256] = { sha256: meta.sha256, bytes: meta.bytes, content_type: 'image/png', width: meta.width, height: meta.height, url: base + file }
  const manifest = Object.entries(images).map(([file, m]) => ({ file, sha256: m.sha256, width: m.width, height: m.height }))
  const outcome = applyImport(db, { csv: productsCsv, assetsCsv, manifest, defaultLang: 'en' })

  // Retailers, an account per retailer, a pending request, some history.
  const shops: [string, string, string][] = [
    ['Boutique Noordzee', 'NL', 'C-1042'],
    ['Alpenhaus Mode', 'DE', 'C-2210'],
    ['Maison Rivage', 'FR', 'C-3307'],
  ]
  for (const [name, country, ref] of shops) {
    db.retailers.push({ id: newId(db, 'ret'), name, reference: ref, website: `https://${slug(name)}.example`, vat_number: null, country, notes: null, status: 'active', brand_ids: null, allow_original: null, user_count: 0, api_client_count: 0, last_activity_at: daysAgo(2), created_at: daysAgo(60) })
  }
  const first = db.retailers[0]
  db.users.push({ id: 'usr_buyer', email: DEMO.retailer.email, name: 'Sanne Bakker', role: 'retailer', status: 'active', language: 'nl', retailer_id: first.id, last_login_at: daysAgo(2), invite_expires_at: null, created_at: daysAgo(59), password: DEMO.retailer.password })
  first.user_count = 1
  db.accessRequests.push({
    id: newId(db, 'arq'),
    status: 'pending',
    created_at: daysAgo(0.2),
    decided_at: null,
    reason: null,
    retailer: { name: 'Nordlys Klær', reference: null, website: 'https://nordlys.example', vat_number: 'NO999999999', country: 'NO' },
    contact: { name: 'Ingrid Hansen', email: 'ingrid@nordlys.example', phone: null, language: 'nb' },
    access: ['portal', 'api'],
    requested_brand_ids: null,
    message: 'We would like to show your AW26 collection in our webshop.',
    retailer_id: null,
    source_ip_country: 'NO',
  })
  const product = db.products[0]
  db.retailers.forEach((r, i) => {
    for (let d = 0; d < 6; d++)
      db.events.push({ id: newId(db, 'evt'), at: daysAgo(d * 3 + i), kind: d % 3 === 0 ? 'selection_zip' : 'image', retailer_id: r.id, retailer_name: r.name, actor_type: 'user', actor_name: r.name, variant: 'web', product_id: product.id, asset_id: null, usage_event: null, files: d % 3 === 0 ? 12 : 1, bytes: null })
  })
  db.events.sort((a, b) => b.at.localeCompare(a.at))
  db.importRuns.push({ id: newId(db, 'imp'), source_id: null, trigger: 'upload', status: 'succeeded', mode: 'upsert', dry_run: false, created_at: daysAgo(3), started_at: daysAgo(3), finished_at: daysAgo(3), files: [{ name: 'products.csv', bytes: productsCsv.length, sha256: null }], counts: outcome.counts, error: null, errors_preview: [] })
  // A check of the spec's label test file (fixtures/imports/label-warnings.csv): label warnings only.
  const check = applyImport(db, { csv: LABEL_CHECK_CSV, dryRun: true, defaultLang: 'en' })
  const checkRun: ImportRun = { id: newId(db, 'imp'), source_id: null, trigger: 'upload', status: 'succeeded', mode: 'upsert', dry_run: true, created_at: daysAgo(1), started_at: daysAgo(1), finished_at: daysAgo(1), files: [{ name: 'products.csv', bytes: LABEL_CHECK_CSV.length, sha256: null }], counts: check.counts, error: null, errors_preview: check.errors.slice(0, 50) as ImportRowError[] }
  db.importRuns.unshift(checkRun)
  db.importErrors[checkRun.id] = check.errors as ImportRowError[]
  return db
}

// ---------------------------------------------------------------- persistence

let current: MockDb | null = null

function load(): MockDb | null {
  try {
    const raw = sessionStorage.getItem(STORAGE)
    return raw ? (JSON.parse(raw) as MockDb) : null
  } catch {
    return null
  }
}

export function db(): MockDb {
  if (!current) current = load() ?? seedDb()
  return current
}

export function save() {
  try {
    if (current) sessionStorage.setItem(STORAGE, JSON.stringify(current))
  } catch {
    /* storage full or unavailable: keep in memory */
  }
}

/** `fresh` = a node that still needs first-run setup; `seeded` = the Kestrel demo. */
export function resetDb(kind: 'fresh' | 'seeded' = 'seeded') {
  current = kind === 'fresh' ? emptyDb() : seedDb()
  save()
  return current
}
