// Mock mode (`bun run mock`): the whole node API runs in a service worker, seeded with the
// spec's fictional MAISON NOOR Group fixtures. `?mock=fresh` starts a node that still needs
// first-run setup (setup code: NOOR-SETUP); `?mock=reset` restores the demo data with the
// themed MAISON NOOR showroom; `?mock=plain` the same data in the portal's default look.
import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'
import { resetDb } from './db'

export async function startMockWorker() {
  const params = new URLSearchParams(location.search)
  const mode = params.get('mock')
  if (mode === 'fresh' || mode === 'reset' || mode === 'plain') {
    resetDb(mode === 'fresh' ? 'fresh' : mode === 'plain' ? 'plain' : 'seeded')
    params.delete('mock')
    const q = params.toString()
    history.replaceState(null, '', location.pathname + (q ? `?${q}` : '') + location.hash)
  }
  const worker = setupWorker(...handlers)
  await worker.start({
    serviceWorker: { url: new URL('mockServiceWorker.js', document.baseURI).pathname },
    onUnhandledRequest: 'bypass',
    quiet: true,
  })
}
