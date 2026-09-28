// Error, retry and edge states of the main screens, and merge-patch behaviour of the forms,
// all against the mock node (the same API as `npm run mock`).
import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { db, DEMO } from '../src/mock/db'
import { server } from './setup'
import { renderApp } from './render'

async function loginAs(who: 'admin' | 'retailer', path = '/login') {
  localStorage.setItem('obx.lang', 'en')
  const r = await renderApp(path)
  await r.user.type(await screen.findByLabelText(/email address/i), DEMO[who].email)
  await r.user.type(screen.getByLabelText(/^password$/i), DEMO[who].password)
  await r.user.click(screen.getByRole('button', { name: /log in/i }))
  return r
}

const unavailable = () => HttpResponse.json({ type: 'x', title: 'x', status: 503, obx_error: 'service_unavailable' }, { status: 503, headers: { 'Content-Type': 'application/problem+json' } })

/** Fail a GET a fixed number of times, then let the mock node answer again. */
function failTimes(path: string, times: number) {
  let left = times
  server.use(http.get(path, () => (left-- > 0 ? unavailable() : undefined)))
}

describe('failed loads offer a retry', () => {
  it('shows the dashboard numbers as unavailable and loads them again on "Try again"', async () => {
    failTimes('*/admin/api/catalog/products', 99)
    const r = await loginAs('admin')
    await screen.findByRole('heading', { name: /hello iris/i })
    const alert = await screen.findByRole('alert', {}, { timeout: 8000 })
    expect(alert).toHaveTextContent(/temporarily unavailable|try again/i)
    server.resetHandlers()
    await r.user.click(within(alert).getByRole('button', { name: /try again/i }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(screen.getByRole('link', { name: /^articles\s*8$/i })).toBeInTheDocument()
  })

  it('shows a catalog error for the retailer and recovers', async () => {
    failTimes('*/admin/api/portal/products', 99)
    const r = await loginAs('retailer')
    const alert = await screen.findByRole('alert', {}, { timeout: 8000 })
    server.resetHandlers()
    await r.user.click(within(alert).getByRole('button', { name: /try again/i }))
    const grid = await screen.findByRole('list', { name: /articles/i })
    expect(within(grid).getAllByRole('listitem')).toHaveLength(8)
  })

  it('does not offer a retry for something that is not there', async () => {
    await loginAs('admin')
    await screen.findByRole('heading', { name: /hello iris/i })
    const r2 = await renderApp('/admin/catalog/NO-SUCH-ARTICLE')
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/could not be found/i)
    expect(within(alert).queryByRole('button', { name: /try again/i })).toBeNull()
    r2.unmount()
  })
})

describe('retailer portal limits', () => {
  it('says so when the selection is full instead of silently ignoring the tick', async () => {
    db().selections.usr_buyer = Array.from({ length: 1000 }, (_, i) => `prd_filler_${i}`)
    const r = await loginAs('retailer')
    await screen.findByRole('list', { name: /articles/i })
    await r.user.click(screen.getByRole('checkbox', { name: /select ko-1001/i }))
    expect(await screen.findByText(/your selection is full: it holds at most 1000 articles/i)).toBeInTheDocument()
    expect(db().selections.usr_buyer).toHaveLength(1000)
  })

  it('shows an inline error when removing from the selection fails', async () => {
    const r = await loginAs('retailer')
    await screen.findByRole('list', { name: /articles/i })
    await r.user.click(screen.getByRole('checkbox', { name: /select ko-1001/i }))
    await waitFor(() => expect(db().selections.usr_buyer).toHaveLength(1))
    await r.router.navigate({ to: '/selection' })
    server.use(http.put('*/admin/api/portal/selection', unavailable))
    await r.user.click(await screen.findByRole('button', { name: /remove ko-1001 from the selection/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/temporarily unavailable|try again/i)
  })
})

describe('invitation page', () => {
  it('names both the brand and the retailer the account is for', async () => {
    const d = db()
    d.users.push({ id: 'usr_new', email: 'new@shop.example', name: '', role: 'retailer', status: 'invited', language: 'en', retailer_id: d.retailers[0].id, last_login_at: null, invite_expires_at: '2099-01-01T00:00:00Z', created_at: '2026-01-01T00:00:00Z', password: '' })
    d.invites.inv_test = 'usr_new'
    localStorage.setItem('obx.lang', 'en')
    await renderApp('/invite/inv_test')
    expect(await screen.findByText(new RegExp(`^Kestrel has invited you, for ${d.retailers[0].name}, to see its product images`))).toBeInTheDocument()
  })
})

describe('forms send merge patches that really clear what was removed', () => {
  it('removes the English welcome text instead of keeping the old one', async () => {
    const r = await loginAs('admin')
    await screen.findByRole('heading', { name: /hello iris/i })
    await r.router.navigate({ to: '/admin/settings' })
    const english = await screen.findByLabelText(/welcome text · english/i)
    await r.user.clear(english)
    await r.user.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(db().settings.branding?.welcome_text).toEqual({ nl: 'Definitieve productbeelden en artikeldata voor Kestrel-retailers.' }))
  })

  it('removes the whole welcome text when every language is cleared', async () => {
    const r = await loginAs('admin')
    await screen.findByRole('heading', { name: /hello iris/i })
    await r.router.navigate({ to: '/admin/settings' })
    await r.user.clear(await screen.findByLabelText(/welcome text · english/i))
    await r.user.clear(screen.getByLabelText(/welcome text · dutch/i))
    await r.user.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(db().settings.branding?.welcome_text).toBeUndefined())
  })
})
