// Mock mode (`npm run mock`): the whole node API runs in a service worker, seeded with the
// spec's fictional Kestrel Outfitters fixtures. `?mock=fresh` starts a node that still needs
// first-run setup (setup code: KESTREL-SETUP); `?mock=reset` restores the demo data.
import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'
import { resetDb } from './db'

export async function startMockWorker() {
  const params = new URLSearchParams(location.search)
  const mode = params.get('mock')
  if (mode === 'fresh' || mode === 'reset') {
    resetDb(mode === 'fresh' ? 'fresh' : 'seeded')
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
