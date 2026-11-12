// The main flows of both roles, end to end in a real browser against the mock node
// (the whole portal API runs in a service worker). Desktop and phone.
import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { admin, buyer, chooseEnglish, expectAccessible, failOnCspViolations, expectNoSideways, logIn } from './helpers'
import { workbookParts, zip as zipFiles } from '../src/lib/xlsx'
import { readWorkbook } from '../src/mock/xlsx-read'

failOnCspViolations()
test.beforeEach(async ({ page }) => chooseEnglish(page))

test.describe('retailer', () => {
  test('finds an article, downloads an image and builds a selection', async ({ page }) => {
    await logIn(page, buyer)
    const list = page.getByRole('list', { name: 'Articles' })
    await expect(list.getByRole('listitem')).toHaveCount(11)

    // Search narrows the list and lands in the URL (shareable, survives reload).
    await page.getByRole('searchbox', { name: 'Search' }).fill('KO-1001')
    await expect(list.getByRole('listitem')).toHaveCount(1)
    await expect(page).toHaveURL(/q=KO-1001/)
    await page.reload()
    await expect(list.getByRole('listitem')).toHaveCount(1)

    await list.getByRole('link').first().click()
    await expect(page.getByRole('heading', { name: 'Sizes and EANs' })).toBeVisible()
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download this image' }).click()
    expect((await download).suggestedFilename()).toMatch(/^KO-1001.*\.(jpe?g|png|webp)$/i)

    await page.getByRole('button', { name: 'Add to selection' }).click()
    await expect(page.getByRole('button', { name: 'In your selection' })).toBeVisible()
    await page.goto('./selection')
    await expect(page.getByRole('heading', { name: 'Your selection' })).toBeVisible()
    await expect(page.getByText(/^1 article, \d+ images$/)).toBeVisible()
    const zip = page.waitForEvent('download')
    await page.getByRole('button', { name: /^Download \d+ images? \(zip\)$/ }).click()
    expect((await zip).suggestedFilename()).toMatch(/\.zip$/)

    // Article data as Excel: the CSV's columns and rows, EANs as text.
    const xlsx = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Article data (Excel)' }).click()
    const file = await xlsx
    expect(file.suggestedFilename()).toBe('selection.xlsx')
    const rows = readWorkbook(new Uint8Array(readFileSync((await file.path())!))).map((r) => r.map((c) => c.text))
    expect(rows[0].slice(0, 2)).toEqual(['brand', 'style_number'])
    expect(rows.slice(1).every((r) => r[1] === 'KO-1001')).toBe(true)
    expect(rows.slice(1).map((r) => r[rows[0].indexOf('gtin')])).toContain('2000100101018')

    // Emptying asks first, and Cancel keeps everything.
    await page.getByRole('button', { name: 'Empty selection' }).click()
    const dialog = page.getByRole('dialog', { name: 'Empty your selection?' })
    await expectAccessible(page, 'confirm dialog')
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByText(/^1 article/)).toBeVisible()
    await page.getByRole('button', { name: 'Empty selection' }).click()
    await dialog.getByRole('button', { name: 'Empty selection' }).click()
    await expect(page.getByText('Your selection is empty')).toBeVisible()
    await expectNoSideways(page)
  })

  test('pastes an EAN list and prepares a background zip', async ({ page }) => {
    await logIn(page, buyer)
    await page.goto('./ean')
    await page.getByLabel('EANs').fill('2000100101018; 2000100101025\n1234567890128 42')
    await expect(page.getByText('4 codes recognised')).toBeVisible()
    await page.getByRole('button', { name: 'Find articles' }).click()
    await expect(page.getByText('2 found')).toBeVisible()
    await expect(page.getByText('1 not found')).toBeVisible()
    await expect(page.getByText('1 not a valid code')).toBeVisible()

    await page.getByRole('button', { name: 'Download images of these articles' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Prepare zip' }).click()
    await expect(dialog.getByText(/We're preparing your zip/)).toBeVisible()
    await dialog.getByRole('link', { name: 'Go to Downloads' }).click()
    await expect(page.getByRole('heading', { name: 'Downloads', level: 1 })).toBeVisible()
    await expect(page.getByRole('main').getByRole('listitem').first()).toBeVisible()
    await expectNoSideways(page)
  })

  test('creates an API key for its software, shown once', async ({ page }) => {
    await logIn(page, buyer)
    await page.goto('./account')
    await page.getByLabel('Name of the key').fill('Webshop')
    await page.getByRole('button', { name: 'Create API key' }).click()
    const secret = page.getByRole('textbox', { name: 'Client secret' })
    await expect(secret).toHaveValue(/.{16,}/)
    await expectAccessible(page, 'new API key')
    await page.getByRole('button', { name: 'I have saved it' }).click()
    await expect(secret).toHaveCount(0)
    await expect(page.getByText('Webshop')).toBeVisible()
  })

  test('logs out', async ({ page, isMobile }) => {
    await logIn(page, buyer)
    if (isMobile) await page.getByRole('button', { name: 'Menu' }).click()
    await page.getByRole('button', { name: 'Log out' }).click()
    await expect(page).toHaveURL(/\/login/)
    await page.goto('./selection')
    await expect(page).toHaveURL(/\/login\?redirect=%2Fselection/)
  })
})

test.describe('brand admin', () => {
  test('edits an article, validates inline and publishes it', async ({ page }) => {
    await logIn(page, admin)
    await page.goto('./admin/catalog/KO-1001')
    // A name in at least one language is required; the message sits under the field.
    const dutch = page.getByLabel(/^Name · Dutch/)
    const english = page.getByLabel(/^Name · English/)
    await dutch.fill('')
    await english.fill('')
    await page.getByRole('button', { name: 'Save' }).first().click()
    await expect(dutch).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByText('Please fill this in.').first()).toBeVisible()
    await english.fill('Harbour Rain Jacket')
    await page.getByRole('button', { name: 'Save' }).first().click()
    await expect(page.getByRole('status').filter({ hasText: 'Saved' }).first()).toBeVisible()

    const published = page.getByRole('switch', { name: /Published/ })
    await expect(published).toHaveAttribute('aria-checked', 'true')
    await published.click()
    await expect(published).toHaveAttribute('aria-checked', 'false')
    await page.reload()
    await expect(page.getByRole('switch', { name: /Published/ })).toHaveAttribute('aria-checked', 'false')
  })

  test('imports a CSV and sees the problem rows', async ({ page }) => {
    await logIn(page, admin)
    await page.goto('./admin/imports')
    const csv = 'style_number,name:en,gtin,color_code,size\nKO-9001,Rain Jacket,2000100101019,NVY,M\nKO-9002,Wind Jacket,2000900100017,NVY,L\n'
    await page.getByTestId('import-file-input').setInputFiles({ name: 'products.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
    await page.getByRole('button', { name: 'Start import' }).click()
    await expect(page.getByRole('heading', { name: 'Problems and warnings' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Invalid EAN').first()).toBeVisible()
    await expectAccessible(page, 'import result')
  })

  test('imports an Excel file and reads every problem by row and column', async ({ page }) => {
    await logIn(page, admin)
    await page.goto('./admin/imports')
    await expect(page.getByRole('link', { name: 'Products (Excel)' })).toHaveAttribute('href', 'https://openbrandexchange.com/downloads/products.xlsx')
    await expect(page.getByText('KO-1001_NVY_1.jpg', { exact: true })).toBeVisible()
    const rows = [
      ['style_number', 'name:en', 'ean', 'color_code', 'size', 'weight_kg'],
      ['KO-9001', 'Rain Jacket', '2000100101019', 'NVY', 'M', '0.4'],
      ['KO-9002', 'Wind Jacket', '2000900100017', 'NVY', 'L', '0.5'],
      ['KO-9003', 'Fleece', '2000900100024', 'GRN', 'S', '=F3*2'],
      ['KO-9004', 'Gilet', '2000900100031', 'GRN', '', ''],
    ]
    const parts = workbookParts(rows).map(([name, xml]): [string, Uint8Array] => [
      name,
      Buffer.from(name.endsWith('sheet1.xml') ? xml.replace(/<c r="F4"[^>]*>.*?<\/c>/, '<c r="F4"><f>F3*2</f></c>').replace(/(<row r="5">.*?)(<\/row>)/, '$1<c r="F5" t="e"><v>#N/A</v></c>$2') : xml),
    ])
    await page.getByTestId('import-file-input').setInputFiles({ name: 'products.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(await zipFiles(parts)) })
    await expect(page.getByRole('listitem').filter({ hasText: 'products.xlsx' })).toBeVisible()
    await page.getByRole('button', { name: 'Start import' }).click()
    await expect(page.getByRole('heading', { name: 'Problems and warnings' })).toBeVisible({ timeout: 15_000 })
    const table = page.getByRole('region', { name: 'Problems and warnings' })
    await expect(table.getByText('Row 2, column EAN (C)')).toBeVisible()
    await expect(table.getByText('Row 4, column Weight (kg) (F)')).toBeVisible()
    await expect(table.getByText('Formula without a saved result: save the file in Excel')).toBeVisible()
    await expect(table.getByText('Excel error value: type the value itself')).toBeVisible()
    await expectAccessible(page, 'Excel import result')
    if (process.env.OBX_SHOTS) await page.screenshot({ path: `${process.env.OBX_SHOTS}/import-excel-errors-${test.info().project.name}.png`, fullPage: true })
    const list = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download list (CSV)' }).click()
    const csv = readFileSync((await (await list).path())!, 'utf8')
    expect(csv).toMatch(/^\uFEFFfile,row,column,where,severity,problem,detail,value,code\r\n/)
    expect(csv).toContain('products.xlsx,2,gtin,"Row 2, column EAN (C)",Skipped,Invalid EAN')
  })

  test('approves an access request and gets the invitation link', async ({ page }) => {
    await logIn(page, admin)
    await page.goto('./admin/requests')
    await page.getByRole('button', { name: 'Approve' }).first().click()
    const dialog = page.getByRole('dialog')
    await expectAccessible(page, 'approve dialog')
    await dialog.getByRole('button', { name: 'Approve' }).click()
    await expect(page.getByText(/is approved\./)).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Invitation link' })).toHaveValue(/\/invite\/inv_/)
  })

  test('adds a retailer, invites a person and blocks the retailer after confirming', async ({ page }) => {
    await logIn(page, admin)
    await page.goto('./admin/retailers/new')
    await page.getByRole('button', { name: 'Add retailer' }).click()
    await expect(page.getByText('Please fill this in.').first()).toBeVisible()
    await page.getByLabel('Shop or company name').fill('Stoffenwinkel De Haven')
    await page.getByRole('button', { name: 'Add retailer' }).click()
    await expect(page.getByRole('heading', { name: 'Stoffenwinkel De Haven', level: 1 })).toBeVisible()

    await page.getByLabel('Email address').fill('inkoop@dehaven.example')
    await page.getByRole('button', { name: 'Invite', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'Invitation link' })).toHaveValue(/\/invite\//)

    await page.getByRole('button', { name: 'Block retailer' }).click()
    const dialog = page.getByRole('dialog', { name: 'Block Stoffenwinkel De Haven?' })
    await dialog.getByRole('button', { name: 'Block retailer' }).click()
    await expect(page.getByText(/This retailer is blocked/)).toBeVisible()
  })

  test('creates an access key for automatic upload and copies a recipe', async ({ page }) => {
    await logIn(page, admin)
    await page.goto('./admin/automation?tab=tokens')
    await page.getByLabel('Name', { exact: true }).fill('PIM nightly')
    await page.getByRole('button', { name: 'Create access key' }).click()
    const secret = page.getByRole('textbox', { name: /Access key for PIM nightly/ })
    await expect(secret).toHaveValue(/^obxi_/)
    const value = await secret.inputValue()
    await page.getByRole('button', { name: 'Show ready-made recipes' }).click()
    await expect(page.getByTestId('recipe-code')).toContainText(value)
  })

  test('changes the welcome text and sees it on the login page', async ({ page, isMobile }) => {
    await logIn(page, admin)
    await page.goto('./admin/settings')
    await page.getByLabel(/^Welcome text · English/).fill('Hello shops, everything for the new season is here.')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible()
    if (isMobile) await page.getByRole('button', { name: 'Menu' }).click()
    await page.getByRole('button', { name: 'Log out' }).click()
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByText('Hello shops, everything for the new season is here.')).toBeVisible()
  })
})

test.describe('public pages', () => {
  test('a shop requests access with inline validation', async ({ page }) => {
    await page.goto('./request-access?mock=reset')
    await page.getByRole('button', { name: 'Send request' }).click()
    await expect(page.getByText('Please fill this in.').first()).toBeVisible()
    await page.getByLabel('Shop or company name').fill('Winkel Zuid')
    await page.getByLabel('Your name').fill('Noor Jansen')
    await page.getByLabel('Email address').fill('noor@winkelzuid.example')
    await page.getByRole('button', { name: 'Send request' }).click()
    await expect(page.getByRole('heading', { name: 'Request sent' })).toBeVisible()
  })

  test('a fresh portal is set up with the setup code', async ({ page }) => {
    await page.goto('./setup?mock=fresh')
    await page.getByLabel('Setup code').fill('KESTREL-SETUP')
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByLabel('Company name').fill('Kestrel Outfitters')
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByLabel('Your name').fill('Iris')
    await page.getByLabel('Email address').fill('iris@kestrel.example')
    await page.getByLabel('Password', { exact: true }).fill('a long passphrase')
    await page.getByLabel('Repeat the password').fill('a long passphrase')
    await page.getByRole('button', { name: 'Finish' }).click()
    await expect(page.getByRole('heading', { name: /Hello Iris/ })).toBeVisible()
  })
})
