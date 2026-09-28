import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryHistory } from '@tanstack/react-router'
import { App, createApp } from '../src/App'
import { initI18n, setLanguage } from '../src/i18n'
import { DEMO } from '../src/mock/db'

/** Render the real app (router + TanStack Query) against the mock node at `path`. */
export async function renderApp(path: string, lang: 'en' | 'nl' | 'el' | 'bg' = 'en') {
  await initI18n('en')
  await setLanguage(lang, { remember: false })
  const history = createMemoryHistory({ initialEntries: [path] })
  const app = createApp({ history })
  const user = userEvent.setup()
  const utils = render(<App {...app} />)
  return { ...utils, user, router: app.router, qc: app.qc }
}

export async function login(user: ReturnType<typeof userEvent.setup>, who: 'admin' | 'retailer', find: (text: RegExp) => Promise<HTMLElement>) {
  const creds = DEMO[who]
  await user.type(await find(/email address/i), creds.email)
  await user.type(await find(/^password$/i), creds.password)
}
