import { unzip } from 'fflate'
import { ApiError, postFormWithProgress, rawRequest } from '../api/client'
import { generateRenditions, imageSize } from './renditions'
import { sha256Hex } from './sha256'
import type { AssetData, ImportRun, ManifestEntry, RenditionName } from '../api/types'

// Uploads for imports and the asset editor. One path for every node:
//   hash each image -> HEAD /catalog/blobs/{sha} -> PUT only what is missing
//   -> (nodes without an image library) generate web/square/thumb here and upload those too
//   -> POST /imports with the CSV(s) and an images_manifest.
// So unchanged images cost no upload, and the node stays the only CSV/filename parser.

const IMAGE_EXT = /\.(jpe?g|png|webp|tiff?|gif|avif|heic)$/i
const IGNORED = /(^|\/)(__MACOSX\/|\.DS_Store$|Thumbs\.db$|\.)/

export interface ImportFiles {
  /** products.csv or products.xlsx */
  csv: File | null
  /** assets.csv or assets.xlsx */
  assetsCsv: File | null
  images: File[]
  ignored: string[]
  /** Spreadsheets in another format (.xls, .xlsm, .ods, .numbers …): save them as .xlsx. */
  otherSheets: string[]
}

const TABLE = /\.(csv|xlsx)$/i
const OTHER_SHEET = /\.(xls|xlsm|xlsb|xltx|xltm|ods|numbers)$/i

export function contentTypeFor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return (
    {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      tif: 'image/tiff',
      tiff: 'image/tiff',
      gif: 'image/gif',
      avif: 'image/avif',
      heic: 'image/heic',
      csv: 'text/csv',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }[ext] ?? 'application/octet-stream'
  )
}

const basename = (p: string) => p.split('/').pop() ?? p

function isIgnored(path: string) {
  return basename(path).startsWith('.') || IGNORED.test(path)
}

function unzipAsync(data: Uint8Array): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) => unzip(data, (err, out) => (err ? reject(err) : resolve(out))))
}

/**
 * Sort dropped files into products.csv/.xlsx, assets.csv/.xlsx and images. The node converts an
 * Excel workbook itself (spec import-format.md §5); the browser only passes it on. Zips are opened in the browser
 * (folders do not matter, only file names; nested zips are not opened).
 */
export async function collectImportFiles(dropped: File[]): Promise<ImportFiles> {
  const out: ImportFiles = { csv: null, assetsCsv: null, images: [], ignored: [], otherSheets: [] }
  const csvs: File[] = []
  const take = (file: File, path = file.name) => {
    if (isIgnored(path)) return
    const name = basename(path)
    if (TABLE.test(name)) csvs.push(file)
    else if (IMAGE_EXT.test(name)) out.images.push(file)
    else if (OTHER_SHEET.test(name)) out.otherSheets.push(name)
    else out.ignored.push(path)
  }
  for (const f of dropped) {
    if (/\.zip$/i.test(f.name)) {
      const entries = await unzipAsync(new Uint8Array(await f.arrayBuffer()))
      for (const [path, bytes] of Object.entries(entries)) {
        if (path.endsWith('/') || isIgnored(path)) continue
        if (/\.zip$/i.test(path)) {
          out.ignored.push(path)
          continue
        }
        const name = basename(path)
        take(new File([bytes as BlobPart], name, { type: contentTypeFor(name) }), path)
      }
    } else take(f)
  }
  // products.csv/.xlsx by name, else the only other CSV or workbook (same rule as scheduled imports).
  out.assetsCsv = csvs.find((c) => /^assets\.(csv|xlsx)$/i.test(c.name)) ?? null
  const others = csvs.filter((c) => c !== out.assetsCsv)
  out.csv = others.find((c) => /^products\.(csv|xlsx)$/i.test(c.name)) ?? (others.length === 1 ? others[0] : null)
  for (const c of others) if (c !== out.csv) out.ignored.push(c.name)
  // Two images with the same name: the later one wins, like the node would report a duplicate.
  const seen = new Map<string, File>()
  for (const img of out.images) seen.set(img.name, img)
  out.images = [...seen.values()]
  return out
}

/** Upload bytes unless the node already has them. Returns the sha256. */
export async function ensureBlob(data: Blob, contentType: string): Promise<{ sha256: string; uploaded: boolean }> {
  const sha256 = await sha256Hex(data)
  const head = await rawRequest('HEAD', `/admin/api/catalog/blobs/${sha256}`)
  if (head.ok) return { sha256, uploaded: false }
  await rawRequest('PUT', `/admin/api/catalog/blobs/${sha256}`, { body: data, contentType })
  return { sha256, uploaded: true }
}

export interface PreparedImage {
  file: string
  entry?: ManifestEntry
  error?: string
  uploaded: number
}

/** Hash + upload one image and (when needed) its renditions → a manifest entry. */
export async function prepareImage(file: File, serverRenders: boolean): Promise<PreparedImage> {
  const type = file.type || contentTypeFor(file.name)
  let uploaded = 0
  try {
    const orig = await ensureBlob(file, type)
    if (orig.uploaded) uploaded++
    const entry: ManifestEntry = { file: file.name, sha256: orig.sha256 }
    if (serverRenders) {
      const size = await imageSize(file)
      if (size) Object.assign(entry, size)
      return { file: file.name, entry, uploaded }
    }
    let r
    try {
      r = await generateRenditions(file)
    } catch {
      return { file: file.name, error: 'decode_failed', uploaded }
    }
    entry.width = r.original.width
    entry.height = r.original.height
    entry.renditions = {}
    for (const name of ['web', 'square', 'thumb'] as const) {
      const b = await ensureBlob(r[name].blob, 'image/jpeg')
      if (b.uploaded) uploaded++
      entry.renditions[name] = { sha256: b.sha256, width: r[name].width, height: r[name].height }
    }
    return { file: file.name, entry, uploaded }
  } catch (e) {
    return { file: file.name, error: e instanceof ApiError ? e.code : 'upload_failed', uploaded }
  }
}

export interface UploadProgress {
  done: number
  total: number
  uploaded: number
  current?: string
}

/** Prepare many images with limited concurrency. */
export async function prepareImages(
  images: File[],
  serverRenders: boolean,
  onProgress: (p: UploadProgress) => void,
  signal?: AbortSignal,
  concurrency = 3,
): Promise<PreparedImage[]> {
  const results: PreparedImage[] = new Array(images.length)
  let next = 0
  let done = 0
  let uploaded = 0
  onProgress({ done, total: images.length, uploaded })
  async function worker() {
    while (next < images.length) {
      if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
      const i = next++
      const r = await prepareImage(images[i], serverRenders)
      results[i] = r
      done++
      uploaded += r.uploaded
      onProgress({ done, total: images.length, uploaded, current: images[i].name })
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, images.length) }, worker))
  return results
}

export interface ImportOptions {
  mode?: 'upsert' | 'mirror'
  allow_mass_unpublish?: boolean
  dry_run?: boolean
  default_language?: string
}

/** POST /admin/api/imports as multipart with the CSVs, the manifest and the options. */
export function startImport(
  parts: { csv?: File | null; assetsCsv?: File | null; manifest: ManifestEntry[]; options: ImportOptions },
  onProgress?: (fraction: number) => void,
) {
  const form = new FormData()
  if (parts.csv) form.append('csv', parts.csv, parts.csv.name)
  if (parts.assetsCsv) form.append('assets_csv', parts.assetsCsv, parts.assetsCsv.name)
  if (parts.manifest.length)
    form.append('images_manifest', new Blob([JSON.stringify(parts.manifest)], { type: 'application/json' }), 'images_manifest.json')
  form.append('options', new Blob([JSON.stringify(parts.options)], { type: 'application/json' }), 'options.json')
  return postFormWithProgress<ImportRun>('/admin/api/imports', form, onProgress)
}

/** For the asset editor: upload one image (+ renditions when needed) → AssetInput.files. */
export async function uploadAssetFiles(file: File, serverRenders: boolean): Promise<NonNullable<AssetData['files']>> {
  const r = await prepareImage(file, serverRenders)
  if (!r.entry) throw new ApiError(422, null, r.error ?? 'upload_failed')
  const files: NonNullable<AssetData['files']> = {
    original: { sha256: r.entry.sha256, width: r.entry.width ?? null, height: r.entry.height ?? null },
  }
  for (const [name, ref] of Object.entries(r.entry.renditions ?? {})) files[name as RenditionName] = ref
  return files
}
