import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { db, DEMO, resetDb } from '../src/mock/db'
import { server } from './setup'
import { renderApp } from './render'

// The demo accounts are set to Dutch; these tests read English, so they start from a device
// where the visitor already picked English (an explicit choice wins over the account language).
async function loginAs(who: 'admin' | 'retailer', path = '/login', { deviceChoice = 'en' as string | null } = {}) {
  if (deviceChoice) localStorage.setItem('obx.lang', deviceChoice)
  const r = await renderApp(path)
  await r.user.type(await screen.findByLabelText(/email address/i), DEMO[who].email)
  await r.user.type(screen.getByLabelText(/^password$/i), DEMO[who].password)
  await r.user.click(screen.getByRole('button', { name: /log in/i }))
  return r
}

describe('sign-in', () => {
  it('sends logged-out visitors to the login page', async () => {
    await renderApp('/admin/catalog')
    expect(await screen.findByRole('heading', { name: /log in to kestrel · brand portal/i })).toBeInTheDocument()
  })

  it('shows a clear message for a wrong password', async () => {
    const r = await renderApp('/login')
    await r.user.type(await screen.findByLabelText(/email address/i), DEMO.admin.email)
    await r.user.type(screen.getByLabelText(/^password$/i), 'not-the-password')
    await r.user.click(screen.getByRole('button', { name: /log in/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/email address or password is not correct/i)
  })

  it('takes an admin to the brand admin', async () => {
    await loginAs('admin')
    expect(await screen.findByRole('heading', { name: /hello iris/i })).toBeInTheDocument()
    expect(await screen.findByText('Nordlys Klær')).toBeInTheDocument()
  })

  it('keeps retailers out of the brand admin', async () => {
    const r = await loginAs('retailer')
    await screen.findByRole('list', { name: /articles/i })
    await r.router.navigate({ to: '/admin' })
    await waitFor(() => expect(r.router.state.location.pathname).toBe('/'))
  })

  it('refreshes the CSRF token once when the node rotated it', async () => {
    await loginAs('admin')
    await screen.findByRole('heading', { name: /hello iris/i })
    db().csrf = 'rotated-token'
    // A mutation after rotation still succeeds: the client re-reads the session and retries.
    const r = await import('../src/api/client')
    await expect(r.req(() => r.api.PATCH('/admin/api/me', { body: { name: 'Iris' } }))).resolves.toMatchObject({ authenticated: true })
  })
})

describe('languages', () => {
  it('follows the account language after login when this device has no choice yet', async () => {
    await loginAs('admin', '/login', { deviceChoice: null })
    expect(await screen.findByRole('heading', { name: /hallo iris/i })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('nl')
  })

  it('switches the login page to Greek and remembers the choice', async () => {
    const r = await renderApp('/login')
    await r.user.selectOptions(await screen.findByTestId('language-switcher'), 'el')
    expect(await screen.findByRole('button', { name: 'Σύνδεση' })).toBeInTheDocument()
    expect(screen.getByLabelText('Διεύθυνση email')).toBeInTheDocument()
    expect(localStorage.getItem('obx.lang')).toBe('el')
    expect(document.documentElement.lang).toBe('el')
  })

  it('keeps an explicit device choice over the account language', async () => {
    localStorage.setItem('obx.lang', 'bg')
    const r = await renderApp('/login', 'bg')
    await r.user.type(await screen.findByLabelText('Имейл адрес'), DEMO.retailer.email)
    await r.user.type(screen.getByLabelText('Парола'), DEMO.retailer.password)
    await r.user.click(screen.getByRole('button', { name: 'Вход' }))
    expect(await screen.findByRole('list', { name: 'Артикули' })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('bg')
  })
})

describe('first-run wizard', () => {
  it('sets up a fresh portal with a setup code and the admin’s own password', async () => {
    resetDb('fresh')
    const r = await renderApp('/admin')
    await screen.findByRole('heading', { name: /set up your brand portal/i })
    await r.user.type(screen.getByLabelText(/setup code/i), 'WRONG-CODE')
    await r.user.click(screen.getByRole('button', { name: /next/i }))
    await r.user.type(await screen.findByLabelText(/company name/i), 'Kestrel Outfitters')
    await r.user.click(screen.getByRole('button', { name: /next/i }))
    await r.user.click(await screen.findByRole('button', { name: /next/i }))
    await r.user.type(await screen.findByLabelText(/your name/i), 'Iris')
    await r.user.type(screen.getByLabelText(/email address/i), 'iris@kestrel.example')
    await r.user.type(screen.getByLabelText(/^password$/i), 'short')
    await r.user.type(screen.getByLabelText(/repeat the password/i), 'short')
    await r.user.click(screen.getByRole('button', { name: /finish/i }))
    expect(await screen.findByText(/use at least 10 characters/i)).toBeInTheDocument()

    await r.user.clear(screen.getByLabelText(/^password$/i))
    await r.user.type(screen.getByLabelText(/^password$/i), 'a long passphrase')
    await r.user.clear(screen.getByLabelText(/repeat the password/i))
    await r.user.type(screen.getByLabelText(/repeat the password/i), 'a long passphrase')
    await r.user.click(screen.getByRole('button', { name: /finish/i }))
    // The wrong code sends the user back to step 1 with an inline message.
    expect(await screen.findByText(/this setup code is not correct/i)).toBeInTheDocument()
    await r.user.clear(screen.getByLabelText(/setup code/i))
    await r.user.type(screen.getByLabelText(/setup code/i), DEMO.setupCode)
    for (let i = 0; i < 3; i++) await r.user.click(await screen.findByRole('button', { name: /next/i }))
    await r.user.click(await screen.findByRole('button', { name: /finish/i }))
    expect(await screen.findByRole('heading', { name: /hello iris/i })).toBeInTheDocument()
    expect(db().users[0]).toMatchObject({ email: 'iris@kestrel.example', role: 'admin' })
  })

  it('takes over the setup code an installer put in the address fragment', async () => {
    resetDb('fresh')
    await renderApp(`/setup#code=${DEMO.setupCode}`)
    expect(await screen.findByLabelText(/setup code/i)).toHaveValue(DEMO.setupCode)
  })
})

describe('retailer portal', () => {
  it('lists the visible catalog and filters by product type', async () => {
    const r = await loginAs('retailer')
    const grid = await screen.findByRole('list', { name: /articles/i })
    expect(within(grid).getAllByRole('listitem')).toHaveLength(8)
    await r.user.click(within(await screen.findByRole('group', { name: /product type/i })).getByRole('checkbox', { name: /jeans/i }))
    await waitFor(() => expect(within(screen.getByRole('list', { name: /articles/i })).getAllByRole('listitem')).toHaveLength(1))
    expect(r.router.state.location.search).toMatchObject({ item_type: ['jeans'] })
  })

  it('only shows what the retailer’s grant allows', async () => {
    const d = db()
    const trail = d.brands.find((b) => b.external_id === 'kestrel-trail')!
    d.retailers[0].brand_ids = [trail.id]
    await loginAs('retailer')
    const grid = await screen.findByRole('list', { name: /articles/i })
    await waitFor(() => expect(within(grid).getAllByRole('listitem')).toHaveLength(2))
  })

  it('selects articles optimistically and keeps the selection on the server', async () => {
    const r = await loginAs('retailer')
    await screen.findByRole('list', { name: /articles/i })
    await r.user.click(screen.getByRole('checkbox', { name: /select ko-1001/i }))
    expect(await screen.findByRole('link', { name: /1 article selected/i })).toBeInTheDocument()
    await waitFor(() => expect(db().selections.usr_buyer).toHaveLength(1))
    await r.user.click(screen.getByRole('link', { name: /1 article selected/i }))
    expect(await screen.findByRole('heading', { name: /your selection/i })).toBeInTheDocument()
    expect(await screen.findByText(/1 article, 4 images/i)).toBeInTheDocument()
  })

  it('matches a pasted EAN list and reports what was not found', async () => {
    const r = await loginAs('retailer')
    await screen.findByRole('list', { name: /articles/i })
    await r.router.navigate({ to: '/ean' })
    await r.user.click(await screen.findByLabelText(/^EANs$/))
    await r.user.paste('2000100101018; 2000100101025\n1234567890128 42')
    expect(screen.getByText(/4 codes recognised/i)).toBeInTheDocument()
    await r.user.click(screen.getByRole('button', { name: /find articles/i }))
    expect(await screen.findByText('2 found')).toBeInTheDocument()
    expect(screen.getByText('1 not found')).toBeInTheDocument()
    expect(screen.getByText('1 not a valid code')).toBeInTheDocument()
    await r.user.click(screen.getByRole('button', { name: /add 1 article to selection/i }))
    expect(await screen.findByText(/1 article added/i)).toBeInTheDocument()
  })

  it('offers the web version first, even when originals are allowed', async () => {
    const r = await loginAs('retailer')
    await screen.findByRole('list', { name: /articles/i })
    await r.user.click(screen.getAllByRole('link', { name: /KO-1001/ })[0])
    const versions = await screen.findByRole('radiogroup', { name: /file version/i })
    expect(within(versions).getByRole('radio', { name: /original/i })).not.toBeChecked()
    expect(within(versions).getByRole('radio', { name: /web/i })).toBeChecked()
  })

  it('hides original downloads when the brand does not allow them', async () => {
    db().settings.portal!.allow_original_download = false
    const r = await loginAs('retailer')
    await screen.findByRole('list', { name: /articles/i })
    await r.user.click(screen.getAllByRole('link', { name: /KO-1001/ })[0])
    const versions = await screen.findByRole('radiogroup', { name: /file version/i })
    expect(within(versions).queryByRole('radio', { name: /original/i })).toBeNull()
    expect(within(versions).getByRole('radio', { name: /web/i })).toBeChecked()
  })

  it('prepares the zip in the file version picked in the dialog', async () => {
    const r = await loginAs('retailer')
    await screen.findByRole('list', { name: /articles/i })
    await r.router.navigate({ to: '/ean' })
    await r.user.click(await screen.findByLabelText(/^EANs$/))
    await r.user.paste('2000100101018')
    await r.user.click(screen.getByRole('button', { name: /find articles/i }))
    await r.user.click(await screen.findByRole('button', { name: /download images of these articles/i }))
    const dialog = await screen.findByRole('dialog')
    const versions = within(dialog).getByRole('radiogroup', { name: /file version/i })
    await r.user.click(within(versions).getByRole('radio', { name: /^square$/i }))
    expect(within(versions).getByRole('radio', { name: /^square$/i })).toBeChecked()
    await r.user.click(within(dialog).getByRole('button', { name: /prepare zip/i }))
    await waitFor(() => expect(db().downloadJobs[0]?.variant).toBe('square'))
  })

  it('sends the user to the login page when the session ends', async () => {
    const r = await loginAs('retailer')
    await screen.findByRole('list', { name: /articles/i })
    server.use(http.get('*/admin/api/portal/download-jobs', () => ((db().sessionUserId = null), HttpResponse.json({ obx_error: 'unauthorized', status: 401, title: 'x', type: 'x' }, { status: 401 }))))
    await r.router.navigate({ to: '/downloads' })
    await waitFor(() => expect(r.router.state.location.pathname).toBe('/login'))
  })
})

describe('brand admin', () => {
  it('shows the cron address again on a portal that needs one', async () => {
    db().settings.node!.cron = { url: 'https://brands.kestrel.example/cron?key=abc123', command: null, last_run_at: null }
    const r = await loginAs('admin')
    await screen.findByRole('heading', { name: /hello iris/i })
    await r.router.navigate({ to: '/admin/settings', search: { tab: 'system' } })
    expect(await screen.findByText('https://brands.kestrel.example/cron?key=abc123')).toBeInTheDocument()
    expect(screen.getByText(/not called yet/i)).toBeInTheDocument()
  })

  it('approves an access request and shows the invitation link when email is off', async () => {
    const r = await loginAs('admin')
    await screen.findByRole('heading', { name: /hello iris/i })
    await r.router.navigate({ to: '/admin/requests' })
    await r.user.click(await screen.findByRole('button', { name: /^approve$/i }))
    const dialog = await screen.findByRole('dialog')
    await r.user.click(within(dialog).getByRole('button', { name: /^approve$/i }))
    expect(await screen.findByText(/nordlys klær is approved/i)).toBeInTheDocument()
    expect((screen.getByRole('textbox', { name: /invitation link/i }) as HTMLInputElement).value).toMatch(/\/invite\/inv_/)
    expect(db().retailers.some((x) => x.name === 'Nordlys Klær')).toBe(true)
  })

  it('declines a request with a reason', async () => {
    const r = await loginAs('admin')
    await screen.findByRole('heading', { name: /hello iris/i })
    await r.router.navigate({ to: '/admin/requests' })
    await r.user.click(await screen.findByRole('button', { name: /^decline$/i }))
    await r.user.type(await screen.findByLabelText(/reason/i), 'We only supply shops in the Benelux.')
    await r.user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^decline$/i }))
    await waitFor(() => expect(db().accessRequests[0]).toMatchObject({ status: 'rejected', reason: 'We only supply shops in the Benelux.' }))
  })

  it('creates an access key that is shown once and fills in the recipes', async () => {
    const r = await loginAs('admin')
    await screen.findByRole('heading', { name: /hello iris/i })
    await r.router.navigate({ to: '/admin/automation', search: { tab: 'tokens' } })
    await r.user.type(await screen.findByLabelText(/^name$/i), 'PIM nightly')
    await r.user.click(screen.getByRole('button', { name: /create access key/i }))
    const secret = (await screen.findByRole('textbox', { name: /access key for pim nightly/i })) as HTMLInputElement
    expect(secret.value).toMatch(/^obxi_/)
    await r.user.click(screen.getByRole('button', { name: /show ready-made recipes/i }))
    expect(await screen.findByTestId('recipe-code')).toHaveTextContent(secret.value)
    // The list never shows the secret again, only its prefix.
    await r.router.navigate({ to: '/admin/automation', search: { tab: 'tokens' } })
    expect(await screen.findByText('PIM nightly')).toBeInTheDocument()
  })

  it('publishes and unpublishes an article with an optimistic switch', async () => {
    const r = await loginAs('admin')
    await screen.findByRole('heading', { name: /hello iris/i })
    await r.router.navigate({ to: '/admin/catalog/$externalId', params: { externalId: 'KO-1001' } })
    const sw = await screen.findByRole('switch', { name: /published/i })
    expect(sw).toHaveAttribute('aria-checked', 'true')
    await r.user.click(sw)
    expect(sw).toHaveAttribute('aria-checked', 'false')
    await waitFor(() => expect(db().products.find((p) => p.external_id === 'KO-1001')!.status).toBe('unpublished'))
  })

  it('adds a retailer whose website was typed without https://', async () => {
    const r = await loginAs('admin')
    await screen.findByRole('heading', { name: /hello iris/i })
    await r.router.navigate({ to: '/admin/retailers/new' })
    await r.user.type(await screen.findByLabelText(/shop or company name/i), 'Modehaus Berg')
    await r.user.type(screen.getByLabelText(/^website$/i), 'www.modehaus-berg.example')
    await r.user.click(screen.getByRole('button', { name: /add retailer/i }))
    await waitFor(() => expect(db().retailers.find((x) => x.name === 'Modehaus Berg')?.website).toBe('https://www.modehaus-berg.example'))
  })

  it('does not call warnings skipped rows', async () => {
    const r = await loginAs('admin')
    await screen.findByRole('heading', { name: /hello iris/i })
    await r.router.navigate({ to: '/admin/imports' })
    const csv = 'style_number,name:en,gtin,color_code,size,colour_family\nKO-9001,Rain Jacket,2000100909010,NVY,M,blue\n'
    await r.user.upload(await screen.findByTestId('import-file-input'), new File([csv], 'products.csv', { type: 'text/csv' }))
    await r.user.click(await screen.findByRole('button', { name: /start import/i }))
    expect(await screen.findByText(/problems and warnings/i, {}, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByText(/unknown column/i)).toBeInTheDocument()
    expect(screen.queryByText(/rows with a problem were skipped/i)).toBeNull()
  })

  it('imports a CSV and shows row problems inline', async () => {
    const r = await loginAs('admin')
    await screen.findByRole('heading', { name: /hello iris/i })
    await r.router.navigate({ to: '/admin/imports' })
    const csv = 'style_number,name:en,gtin,color_code,size\nKO-9001,Rain Jacket,2000100101019,NVY,M\nKO-9002,Wind Jacket,2000100101018,NVY,L\n'
    await r.user.upload(await screen.findByTestId('import-file-input'), new File([csv], 'products.csv', { type: 'text/csv' }))
    await r.user.click(await screen.findByRole('button', { name: /start import/i }))
    expect(await screen.findByText(/problems and warnings/i, {}, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByText('Invalid EAN')).toBeInTheDocument()
    expect(screen.getByText(/row 1/)).toBeInTheDocument()
  })
})
