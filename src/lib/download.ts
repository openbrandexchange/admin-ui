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
 * Download an API file (image, zip, CSV) with the session cookie. Errors (403
 * original_not_allowed, 400 limit_exceeded ...) come back as ApiError so the UI can show
 * them next to the button instead of navigating to a JSON error page.
 */
export async function downloadFile(path: string, query?: Record<string, unknown>, fallbackName = 'download'): Promise<string> {
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
  const name = filenameFromDisposition(res.headers.get('content-disposition'), fallbackName)
  saveBlob(await res.blob(), name)
  return name
}
