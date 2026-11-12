import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { db, DEMO, resetDb } from '../src/mock/db'
import { parseCsv } from '../src/mock/csv'
import { readWorkbook } from '../src/mock/xlsx-read'
import { workbookParts, zip } from '../src/lib/xlsx'
import { server } from './setup'
import { renderApp } from './render'

// The demo accounts are set to Dutch; these tests read English, so they start from a device
// where the visitor already picked English (an explicit choice wins over the account language).
/** jsdom's Blob has neither text() nor arrayBuffer(). */
function read(b: Blob, as: 'text'): Promise<string>
function read(b: Blob, as: 'bytes'): Promise<ArrayBuffer>
function read(b: Blob, as: 'text' | 'bytes') {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = () => reject(r.error)
    if (as === 'text') r.readAsText(b)
    else r.readAsArrayBuffer(b)
  })
}

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
    await r.user.click(await screen.findByRole('button', { name: /next/i }))
    // The refusal of the old code does not follow the user to the next step.
    await screen.findByLabelText(/company name/i)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    for (let i = 0; i < 2; i++) await r.user.click(await screen.findByRole('button', { name: /next/i }))
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
    expect(within(grid).getAllByRole('listitem')).toHaveLength(11)
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

  it('shows the label information and measurements of a suitcase', async () => {
    const r = await loginAs('retailer')
    await screen.findByRole('list', { name: /articles/i })
    await r.user.click(screen.getAllByRole('link', { name: /KO-1008/ })[0])
    const label = await screen.findByRole('region', { name: /label information/i })
    expect(within(label).getByText(/100% polypropylene/)).toBeInTheDocument()
    expect(within(label).getByText(/100% polyester \(recycled\)/)).toBeInTheDocument()
    expect(within(label).getByText('Do not wash')).toBeInTheDocument()
    expect(within(label).getByText('China')).toBeInTheDocument()
    expect(within(label).queryByText(/animal origin/i)).toBeNull()
    const sizes = screen.getByRole('region', { name: /sizes and ean/i })
    expect(within(sizes).getAllByText('Black').length).toBeGreaterThan(0)
    expect(within(sizes).getByText('CABIN PLUS')).toBeInTheDocument()
    const measures = screen.getByRole('region', { name: /^measurements$/i })
    expect(within(measures).getByText('55 × 40 × 20 cm')).toBeInTheDocument()
    expect(within(measures).getByText('55 × 40 × 23 cm')).toBeInTheDocument()
    expect(within(measures).getByText('2.6 kg')).toBeInTheDocument()
    expect(within(measures).getByText(/36 L · 42 L expanded/)).toBeInTheDocument()
    const features = screen.getByRole('region', { name: /features/i })
    expect(within(features).getByText('Hard shell')).toBeInTheDocument()
    expect(within(features).getByText('TSA combination lock')).toBeInTheDocument()
    expect(within(features).getByText('4')).toBeInTheDocument()
    expect(screen.getByText('Cabin size')).toBeInTheDocument()
  })

  it('shows footwear materials, certifications, the animal-origin line and second sizes', async () => {
    const r = await loginAs('retailer')
    await screen.findByRole('list', { name: /articles/i })
    await r.user.click(screen.getAllByRole('link', { name: /KO-1010/ })[0])
    const label = await screen.findByRole('region', { name: /label information/i })
    expect(within(label).getByText('Footwear materials')).toBeInTheDocument()
    expect(within(label).getByText('Other materials')).toBeInTheDocument()
    expect(within(label).getByText('LWG')).toBeInTheDocument()
    expect(within(label).getByText(/a material is certified/)).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /^measurements$/i })).toHaveTextContent(/Shaft height/)
    expect(screen.getByRole('region', { name: /features/i })).toHaveTextContent('Detachableinsole')

    await r.router.navigate({ to: '/' })
    await r.user.click((await screen.findAllByRole('link', { name: /KO-1004/ }))[0])
    const jeans = await screen.findByRole('region', { name: /label information/i })
    expect(within(jeans).getByText('Contains non-textile parts of animal origin')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: /sizes and ean/i })).getByText('30/32')).toBeInTheDocument()
    const measures = screen.getByRole('region', { name: /^measurements$/i })
    expect(within(measures).getByText('34/32')).toBeInTheDocument()
    expect(within(measures).getAllByText('81 cm').length).toBe(3)
  })

  it('exports measurements and features in the import format’s columns', async () => {
    await loginAs('retailer')
    await screen.findByRole('list', { name: /articles/i })
    const res = await fetch('http://localhost/admin/api/portal/products/data.csv?delimiter=comma')
    const text = await res.text()
    const [head, ...lines] = (text).replace(/^\uFEFF/, '').trim().split('\r\n')
    const cols = head.split(',')
    for (const c of ['item_subtype', 'contains_animal_origin', 'footwear_materials', 'certifications', 'feature:wheels', 'feature:detachable_parts', 'color_family', 'size_length', 'height_cm', 'weight_kg', 'volume_expanded_l', 'strap_length_cm', 'laptop_max_inch', 'inseam_cm']) expect(cols, c).toContain(c)
    const rows = lines.map((l) => Object.fromEntries(parseCsv(l)[0].map((v, i) => [cols[i], v])))
    const cabin = rows.find((x) => x.sku === 'KO-1008-BLK-CABIN')!
    expect(cabin).toMatchObject({ 'feature:wheels': '4', 'feature:expandable': 'yes', height_cm: '55', weight_kg: '2.6', volume_expanded_l: '42', color_family: 'black', materials: 'shell: 100% polypropylene; lining: 100% polyester (recycled)' })
    const messenger = rows.find((x) => x.sku === 'KO-1009-CHR-ONESIZE')!
    expect(messenger).toMatchObject({ strap_length_cm: '85-140', laptop_max_inch: '15.6', 'feature:detachable_parts': 'shoulder_strap', certifications: 'grs:CU 200901 (material)', contains_animal_origin: 'no' })
  })

  it('downloads the article data as Excel with the CSV export\'s columns and rows', async () => {
    const saved: Blob[] = []
    const had = URL.createObjectURL
    URL.createObjectURL = (b: Blob) => (saved.push(b), 'blob:x')
    try {
      const r = await loginAs('retailer')
      await screen.findByRole('list', { name: /articles/i })
      await r.user.click(screen.getByRole('button', { name: 'Article data (Excel)' }))
      await waitFor(() => expect(saved).toHaveLength(1))
      expect(saved[0].type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      const book = readWorkbook(new Uint8Array(await read(saved[0], 'bytes'))).map((row) => row.map((c) => c.text))
      const csv = await (await fetch('http://localhost/admin/api/portal/products/data.csv?delimiter=comma')).text()
      expect(book).toEqual(parseCsv(csv))
      expect(book[0][0]).toBe('brand')
    } finally {
      URL.createObjectURL = had
    }
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

  it('shows the requested API key once when the retailer asked on the web page', async () => {
    const r = await loginAs('admin')
    await screen.findByRole('heading', { name: /hello iris/i })
    await r.router.navigate({ to: '/admin/requests' })
    await r.user.click(await screen.findByRole('button', { name: /^approve$/i }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('checkbox', { name: /create an api key/i })).toBeChecked()
    await r.user.click(within(dialog).getByRole('button', { name: /^approve$/i }))
    await r.user.click(await screen.findByRole('button', { name: /show the key/i }))
    const secret = (await screen.findByRole('textbox', { name: /client secret/i })) as HTMLInputElement
    const client = db().apiClients.find((c) => c.name === 'Nordlys Klær (requested)')!
    expect(secret.value).toBe(client.secret)
  })

  it('writes an invitation in the shop’s language, from its country', async () => {
    const r = await loginAs('admin')
    await screen.findByRole('heading', { name: /hello iris/i })
    const shop = db().retailers.find((x) => x.name === 'Alpenhaus Mode')!
    await r.router.navigate({ to: '/admin/retailers/$id', params: { id: shop.id } })
    expect(await screen.findByLabelText(/language of the email/i)).toHaveValue('de')
    await r.user.type(screen.getByLabelText(/email address/i), 'lena@alpenhaus.example')
    await r.user.click(screen.getByRole('button', { name: /^invite$/i }))
    await waitFor(() => expect(db().users.find((u) => u.email === 'lena@alpenhaus.example')).toMatchObject({ language: 'de', retailer_id: shop.id }))
  })

  it('says a scheduled import needs an https address, without codes or repeats', async () => {
    const r = await loginAs('admin')
    await screen.findByRole('heading', { name: /hello iris/i })
    await r.router.navigate({ to: '/admin/automation/sources/new' })
    await r.user.type(await screen.findByLabelText(/^name$/i), 'Nightly PIM export')
    await r.user.type(screen.getByLabelText(/web address of the csv or zip/i), 'http://exports.kestrel.example/products.csv')
    await r.user.click(screen.getByRole('button', { name: /save scheduled import/i }))
    expect(await screen.findByText(/starting with https:\/\//i)).toBeInTheDocument()
    expect(screen.queryByText(/this address is not allowed/i)).not.toBeInTheDocument()
    expect(screen.queryByText('/config/url')).not.toBeInTheDocument()
    expect(db().importSources).toHaveLength(0)
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

  it('shows label warnings with their legal basis, as warnings that do not block', async () => {
    const r = await loginAs('admin')
    await screen.findByRole('heading', { name: /hello iris/i })
    const run = db().importRuns.find((x) => x.dry_run)!
    await r.router.navigate({ to: '/admin/imports/$id', params: { id: run.id } })
    expect(await screen.findByText(/these are warnings, not errors/i)).toBeInTheDocument()
    expect(screen.getByText('Fibre composition missing')).toBeInTheDocument()
    expect(screen.getByText('Animal origin not stated')).toBeInTheDocument()
    expect(screen.getAllByText('Footwear materials missing')).toHaveLength(2)
    expect(screen.getByText(/Percentages do not add up to 100%/)).toBeInTheDocument()
    expect(screen.getAllByText(/Regulation \(EU\) No 1007\/2011/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Directive 94/11/EC')).toHaveLength(2)
    expect(screen.queryByText(/rows with a problem were skipped/i)).toBeNull()
  })

  it('shows the article data on the article screen and keeps it when saving', async () => {
    const r = await loginAs('admin')
    await screen.findByRole('heading', { name: /hello iris/i })
    await r.router.navigate({ to: '/admin/catalog/$externalId', params: { externalId: 'KO-1009' } })
    expect(await screen.findByText('GRS')).toBeInTheDocument()
    expect(screen.getByText('Laptop compartment')).toBeInTheDocument()
    expect(screen.getByText('up to 15.6 inches')).toBeInTheDocument()
    expect(screen.getByText('85–140 cm')).toBeInTheDocument()
    await r.user.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(screen.getByText(/^saved$/i)).toBeInTheDocument())
    const p = db().products.find((x) => x.external_id === 'KO-1009')!
    expect(p.data.features).toMatchObject({ laptop_compartment: true, detachable_parts: ['shoulder_strap'] })
    expect(p.data.certifications).toEqual([{ scheme: 'grs', licence_number: 'CU 200901', scope: 'material' }])
    expect(p.data.contains_animal_origin).toBe(false)
    expect(p.data.item_subtype).toBe('laptop_bag')
  })

  it('edits the measurements of a size', async () => {
    const r = await loginAs('admin')
    await screen.findByRole('heading', { name: /hello iris/i })
    await r.router.navigate({ to: '/admin/catalog/$externalId', params: { externalId: 'KO-1008' } })
    const sizes = await screen.findByRole('region', { name: /colours and sizes/i })
    await r.user.click(within(sizes).getAllByRole('button', { name: /^edit$/i })[0])
    const dialog = await screen.findByRole('dialog')
    const weight = within(dialog).getByLabelText(/^weight \(kg\)$/i)
    expect(weight).toHaveValue('2.6')
    await r.user.clear(weight)
    await r.user.type(weight, '2,4 kg')
    await r.user.click(within(dialog).getByRole('button', { name: /^save$/i }))
    expect(within(dialog).getByText(/enter a number/i)).toBeInTheDocument()
    await r.user.clear(weight)
    await r.user.type(weight, '2,4')
    await r.user.click(within(dialog).getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(db().variants.find((v) => v.data.sku === 'KO-1008-BLK-CABIN')!.data.measurements).toEqual({ height_cm: 55, width_cm: 40, depth_cm: 20, weight_kg: 2.4, volume_l: 36, volume_expanded_l: 42 }))
    expect(db().variants.find((v) => v.data.sku === 'KO-1008-BLK-CABIN')!.data.color.family).toBe('black')
  })

  it('does not call warnings skipped rows', async () => {
    const r = await loginAs('admin')
    await screen.findByRole('heading', { name: /hello iris/i })
    await r.router.navigate({ to: '/admin/imports' })
    const csv = 'style_number,name:en,gtin,color_code,size,colour_mood\nKO-9001,Rain Jacket,2000100909010,NVY,M,calm\n'
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
    expect(screen.getByText('Row 1, column EAN')).toBeInTheDocument()
  })

  it.each([
    ['succeeded', 1],
    ['failed', 0],
  ] as const)('shows a refused workbook as a problem (run %s)', async (status, errors) => {
    const r = await loginAs('admin')
    await screen.findByRole('heading', { name: /hello iris/i })
    const row = { file: 'products.xlsx', row: null, column: null, severity: 'error', obx_error: 'workbook_invalid', detail: 'not a zip file', value: null }
    const run = { id: 'imp_x', source_id: null, trigger: 'upload', status, mode: 'upsert', dry_run: false, created_at: new Date().toISOString(), started_at: null, finished_at: new Date().toISOString(), files: [{ name: 'products.xlsx', bytes: 10, sha256: null }], counts: { rows: 0, files: 0, created: 0, updated: 0, unchanged: 0, unpublished: 0, errors, warnings: 0 }, error: null, errors_preview: [] }
    server.use(
      http.get('*/admin/api/imports/imp_x', () => HttpResponse.json(run)),
      http.get('*/admin/api/imports/imp_x/errors', () => HttpResponse.json({ items: [row], next_cursor: null })),
    )
    await r.router.navigate({ to: '/admin/imports/$id', params: { id: 'imp_x' } })
    expect(await screen.findByText('Not a readable Excel file')).toBeInTheDocument()
    expect(screen.getByText('not a zip file')).toBeInTheDocument()
    expect(screen.queryByText(/imported without problems/i)).toBeNull()
  })

  it('imports an Excel file and names the cell of every problem', async () => {
    const r = await loginAs('admin')
    await screen.findByRole('heading', { name: /hello iris/i })
    await r.router.navigate({ to: '/admin/imports' })
    const rows = [
      ['style_number', 'name:en', 'ean', 'color_code', 'size'],
      ['KO-9001', 'Rain Jacket', '2000100101019', 'NVY', 'M'],
      ['KO-9002', 'Wind Jacket', '2000100909010', 'NVY', 'L'],
      ['KO-9003', 'Fleece', '2000100909027', 'GRN', 'S'],
    ]
    const parts = workbookParts(rows).map(([name, xml]): [string, Uint8Array] => [
      name,
      new TextEncoder().encode(name.endsWith('sheet1.xml') ? xml.replace(/<c r="E4"[^>]*>.*?<\/c>/, '<c r="E4" t="e"><v>#N/A</v></c>') : xml),
    ])
    const file = new File([(await zip(parts)) as BlobPart], 'products.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    await r.user.upload(await screen.findByTestId('import-file-input'), file)
    expect(await screen.findByText('products.xlsx')).toBeInTheDocument()
    await r.user.click(await screen.findByRole('button', { name: /start import/i }))
    expect(await screen.findByText(/problems and warnings/i, {}, { timeout: 5000 })).toBeInTheDocument()
    const table = screen.getByRole('region', { name: /problems and warnings/i })
    expect(within(table).getByText('Row 2, column EAN (C)')).toBeInTheDocument()
    expect(within(table).getByText('Invalid EAN')).toBeInTheDocument()
    expect(within(table).getByText('Row 4, column Size (E)')).toBeInTheDocument()
    expect(within(table).getByText('Excel error value: type the value itself')).toBeInTheDocument()
    expect(within(table).getAllByText('products.xlsx').length).toBeGreaterThan(0)
    // Sorted by row: row 2 before row 4; by problem the Excel error (E…) comes before the EAN.
    const places = () => within(table).getAllByText(/^Row \d/).map((e) => e.textContent)
    expect(places()).toEqual(['Row 2, column EAN (C)', 'Row 4, column Size (E)'])
    await r.user.click(screen.getByRole('radio', { name: 'By problem' }))
    expect(places()).toEqual(['Row 4, column Size (E)', 'Row 2, column EAN (C)'])

    const saved: Blob[] = []
    const had = URL.createObjectURL
    URL.createObjectURL = (b: Blob) => (saved.push(b), 'blob:x')
    try {
      await r.user.click(screen.getByRole('button', { name: 'Download list (CSV)' }))
      await waitFor(() => expect(saved).toHaveLength(1))
      const list = parseCsv(await read(saved[0], 'text'))
      expect(list[0]).toEqual(['file', 'row', 'column', 'where', 'severity', 'problem', 'detail', 'value', 'code'])
      expect(list[1].slice(0, 4)).toEqual(['products.xlsx', '2', 'gtin', 'Row 2, column EAN (C)'])
      expect(list[2]).toContain("'#N/A".slice(1))
    } finally {
      URL.createObjectURL = had
    }
  })
})
