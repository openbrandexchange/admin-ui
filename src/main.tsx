import { createRoot } from 'react-dom/client'
import { initI18n } from './i18n'
import { App, createApp } from './App'
import './styles.css'

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
