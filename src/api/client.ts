// The one REST client: openapi-fetch typed against the spec's Node Admin + Portal API.
// - resolves every path against <base href>, so a node mounted under a sub-path works;
// - sends the session cookie and adds X-CSRF-Token to every unsafe request;
// - PATCH bodies go out as application/merge-patch+json;
// - non-2xx answers become an ApiError carrying the RFC 9457 problem (obx_error).
import createClient, { type Middleware } from 'openapi-fetch'
import type { paths } from './admin'
import type { paths as protocolPaths } from './protocol'
import type { Problem } from './types'

export class ApiError extends Error {
  status: number
  code: string
  problem: Problem | null

  constructor(status: number, problem: Problem | null, fallback = 'HTTP ' + status) {
    super(problem?.detail || problem?.title || fallback)
    this.status = status
    this.code = problem?.obx_error ?? (status === 0 ? 'network_error' : 'http_' + status)
    this.problem = problem
  }

  /** Field errors keyed by JSON pointer ("/admin/email"), for inline display next to fields. */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {}
    for (const e of this.problem?.errors ?? []) if (e.pointer && !out[e.pointer]) out[e.pointer] = e.detail
    return out
  }
}

let csrfToken = ''
let csrfRefresher: (() => Promise<string>) | null = null

export const setCsrfToken = (token: string) => void (csrfToken = token)
export const getCsrfToken = () => csrfToken
/** Registered by the session query: re-reads GET /session when the node answers csrf_failed. */
export const setCsrfRefresher = (fn: (() => Promise<string>) | null) => void (csrfRefresher = fn)

/** Base URL of the node (the document's <base href>). */
export function nodeBase(): string {
  return typeof document !== 'undefined' ? document.baseURI.replace(/\/+$/, '') : 'http://localhost'
}

export function apiUrl(path: string, query?: Record<string, unknown>): string {
  const url = new URL(path.replace(/^\//, ''), nodeBase() + '/')
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v === undefined || v === null || v === '') continue
    if (Array.isArray(v)) for (const item of v) url.searchParams.append(k, String(item))
    else url.searchParams.set(k, String(v))
  }
  return url.toString()
}

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

const csrfMiddleware: Middleware = {
  onRequest({ request }) {
    if (UNSAFE.has(request.method)) request.headers.set('X-CSRF-Token', csrfToken)
    if (request.method === 'PATCH' && request.headers.get('Content-Type')?.startsWith('application/json'))
      request.headers.set('Content-Type', 'application/merge-patch+json')
    return request
  },
}

// Looked up per call (not captured at import) so MSW and test runners can swap fetch.
const fetchWithBase = (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { credentials: 'same-origin', ...init })

export const api = createClient<paths>({ baseUrl: nodeBase(), fetch: (r: Request) => fetchWithBase(r) })
api.use(csrfMiddleware)

/** Public protocol endpoints used by the UI (the request-access form). */
export const protocolApi = createClient<protocolPaths>({ baseUrl: nodeBase(), fetch: (r: Request) => fetchWithBase(r) })
protocolApi.use(csrfMiddleware)

function asProblem(body: unknown): Problem | null {
  return body && typeof body === 'object' && 'obx_error' in body ? (body as Problem) : null
}

type Result<D> = { data?: D; error?: unknown; response: Response }

/**
 * Await an openapi-fetch call and return its data, or throw ApiError. On `csrf_failed` the
 * token is refreshed once and the call repeated (pass a thunk so it can be re-issued).
 */
export async function req<D>(call: () => Promise<Result<D>>, retried = false): Promise<D> {
  let res: Result<D>
  try {
    res = await call()
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e
    throw new ApiError(0, null, 'network_error')
  }
  if (res.response.ok) return res.data as D
  const problem = asProblem(res.error)
  if (problem?.obx_error === 'csrf_failed' && !retried && csrfRefresher) {
    csrfToken = await csrfRefresher()
    return req(call, true)
  }
  throw new ApiError(res.response.status, problem, res.response.statusText || 'HTTP ' + res.response.status)
}

/** Raw request for bodies openapi-fetch does not model well (binary uploads, HEAD). */
export async function rawRequest(
  method: string,
  path: string,
  init: { body?: BodyInit; contentType?: string; headers?: Record<string, string> } = {},
): Promise<Response> {
  const headers: Record<string, string> = { ...init.headers }
  if (init.contentType) headers['Content-Type'] = init.contentType
  if (UNSAFE.has(method)) headers['X-CSRF-Token'] = csrfToken
  let res: Response
  try {
    res = await fetchWithBase(apiUrl(path), { method, headers, body: init.body })
  } catch {
    throw new ApiError(0, null, 'network_error')
  }
  if (!res.ok && !(method === 'HEAD' && res.status === 404)) {
    let problem: Problem | null = null
    try {
      problem = asProblem(await res.clone().json())
    } catch {
      /* not JSON */
    }
    throw new ApiError(res.status, problem)
  }
  return res
}

/**
 * Multipart POST with upload progress (fetch has none). Used for CSV/zip imports.
 */
export function postFormWithProgress<T>(path: string, form: FormData, onProgress?: (fraction: number) => void): Promise<T> {
  if (typeof XMLHttpRequest === 'undefined')
    return rawRequest('POST', path, { body: form, headers: { Accept: 'application/json' } }).then((r) => r.json() as Promise<T>)
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', apiUrl(path))
    xhr.withCredentials = true
    xhr.setRequestHeader('X-CSRF-Token', csrfToken)
    xhr.setRequestHeader('Accept', 'application/json')
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total)
    xhr.onerror = () => reject(new ApiError(0, null, 'network_error'))
    xhr.onload = () => {
      let body: unknown = null
      try {
        body = JSON.parse(xhr.responseText)
      } catch {
        /* empty */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body as T)
      else reject(new ApiError(xhr.status, asProblem(body)))
    }
    xhr.send(form)
  })
}

/** Path segment encoding for external ids such as "KO-1001" or "KO 1001". */
export const seg = (s: string) => encodeURIComponent(s)
