import { ApiError, apiUrl } from '../api/client'
import type { Problem } from '../api/types'

/** Filename from Content-Disposition (RFC 6266, incl. filename*=UTF-8''...). */
export function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback
  const star = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(header)
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ''))
    } catch {
      /* fall through */
    }
  }
  const plain = /filename\s*=\s*"?([^";]+)"?/.exec(header)
  return plain ? plain[1].trim() : fallback
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * Fetch an API file (image, zip, CSV) with the session cookie. Errors (403
 * original_not_allowed, 400 limit_exceeded ...) come back as ApiError so the UI can show
 * them next to the button instead of navigating to a JSON error page.
 */
async function fetchOk(path: string, query?: Record<string, unknown>): Promise<Response> {
  let res: Response
  try {
    res = await fetch(apiUrl(path, query), { credentials: 'same-origin' })
  } catch {
    throw new ApiError(0, null, 'network_error')
  }
  if (!res.ok) {
    let problem: Problem | null = null
    try {
      problem = (await res.json()) as Problem
    } catch {
      /* not json */
    }
    throw new ApiError(res.status, problem && 'obx_error' in problem ? problem : null, res.statusText)
  }
  return res
}

const nameOf = (res: Response, fallback: string) => filenameFromDisposition(res.headers.get('content-disposition'), fallback)

/** Download an API file and save it under the name the server gives. */
export async function downloadFile(path: string, query?: Record<string, unknown>, fallbackName = 'download'): Promise<string> {
  const res = await fetchOk(path, query)
  const name = nameOf(res, fallbackName)
  saveBlob(await res.blob(), name)
  return name
}

/**
 * Article data as an Excel workbook: the CSV the portal serves (always comma-separated here),
 * turned into .xlsx in the browser with the same columns in the same order.
 */
export async function downloadExcel(path: string, query?: Record<string, unknown>): Promise<string> {
  const [res, { csvToXlsx, XLSX_TYPE }] = await Promise.all([fetchOk(path, { ...query, delimiter: 'comma' }), import('./xlsx')])
  const xlsx = await csvToXlsx(await res.text())
  const file = nameOf(res, 'products.csv').replace(/\.csv$/i, '') + '.xlsx'
  saveBlob(new Blob([xlsx as BlobPart], { type: XLSX_TYPE }), file)
  return file
}
