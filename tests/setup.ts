import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest'
import { cleanup, configure } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { handlers } from '../src/mock/handlers'
import { resetDb } from '../src/mock/db'

// Node 25+ ships its own (disabled) localStorage global that shadows jsdom's: use a plain one.
class MemoryStorage implements Storage {
  private m = new Map<string, string>()
  get length() {
    return this.m.size
  }
  clear() {
    this.m.clear()
  }
  getItem(k: string) {
    return this.m.get(k) ?? null
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null
  }
  removeItem(k: string) {
    this.m.delete(k)
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v))
  }
}
for (const name of ['localStorage', 'sessionStorage'] as const) {
  if (!globalThis[name]) Object.defineProperty(globalThis, name, { value: new MemoryStorage(), configurable: true })
}

configure({ asyncUtilTimeout: 5000 })
// jsdom has no scrolling, and its XMLHttpRequest cannot send FormData through MSW in Node:
// the client then uses fetch (as it does in any environment without XHR).
window.scrollTo = () => {}
Element.prototype.scrollTo = () => {}
// @ts-expect-error test environment only
delete globalThis.XMLHttpRequest

// jsdom's FormData/Blob are not the ones Node's fetch understands: encode multipart by hand.
const readBlob = (b: Blob) =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as ArrayBuffer)
    r.onerror = () => reject(r.error)
    r.readAsArrayBuffer(b)
  })

function encodeMultipart() {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.body instanceof FormData) {
      const boundary = 'obxtest' + Math.random().toString(36).slice(2)
      const enc = new TextEncoder()
      const chunks: Uint8Array[] = []
      for (const [k, v] of init.body.entries()) {
        const head =
          typeof v === 'string'
            ? `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n`
            : `--${boundary}\r\nContent-Disposition: form-data; name="${k}"; filename="${(v as File).name}"\r\nContent-Type: ${v.type || 'application/octet-stream'}\r\n\r\n`
        chunks.push(enc.encode(head), typeof v === 'string' ? enc.encode(v) : new Uint8Array(await readBlob(v)), enc.encode('\r\n'))
      }
      chunks.push(enc.encode(`--${boundary}--\r\n`))
      const body = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0))
      let o = 0
      for (const c of chunks) {
        body.set(c, o)
        o += c.length
      }
      const headers = new Headers(init.headers)
      headers.set('Content-Type', `multipart/form-data; boundary=${boundary}`)
      init = { ...init, body, headers }
    }
    return originalFetch(input, init)
  }
}

// The mock node answers every /admin/api call, exactly as in `npm run mock`.
export const server = setupServer(...handlers)

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
  encodeMultipart() // after MSW patched fetch, so the conversion runs first
})
beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  resetDb('seeded')
})
afterEach(() => cleanup())
afterAll(() => server.close())
