import { createRoot } from 'react-dom/client'
import { initI18n } from './i18n'
import { App, createApp } from './App'
import './styles.css'

// After an upgrade, a tab that is still open may ask for a lazily loaded file of the old
// version that the portal no longer has. Reload once to get the new version (at most once a
// minute, so a portal that is really broken does not reload in a loop).
window.addEventListener('vite:preloadError', (event) => {
  let last = 0
  try {
    last = Number(sessionStorage.getItem('obx.reloadedAt') ?? 0)
    if (Date.now() - last < 60_000) return
    sessionStorage.setItem('obx.reloadedAt', String(Date.now()))
  } catch {
    return
  }
  event.preventDefault()
  location.reload()
})

async function start() {
  if (import.meta.env.VITE_OBX_MOCK) {
    const { startMockWorker } = await import('./mock/browser')
    await startMockWorker()
  }
  await initI18n()
  const app = createApp()
  createRoot(document.getElementById('app')!).render(<App {...app} />)
}

void start()
