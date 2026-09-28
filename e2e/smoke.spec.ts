import { expect, test, type Page } from '@playwright/test'

const admin = { email: 'admin@kestrel.example', password: 'kestrel-admin-2026' }
const buyer = { email: 'buyer@shop.example', password: 'kestrel-shop-2026' }

// The demo accounts are Dutch; most checks read English, so they start from a device where
// the visitor already picked English (an explicit choice wins over the account language).
async function chooseEnglish(page: Page) {
  await page.addInitScript(() => localStorage.setItem('obx.lang', 'en'))
}

async function logIn(page: Page, who: { email: string; password: string }) {
  await page.goto('./login?mock=reset')
  await page.getByLabel('Email address').fill(who.email)
  await page.getByLabel('Password', { exact: true }).fill(who.password)
  await page.getByRole('button', { name: 'Log in' }).click()
}

async function expectNoSideways(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}

test('a retailer logs in, browses the catalog and opens an article', async ({ page }) => {
  await chooseEnglish(page)
  await logIn(page, buyer)
  const list = page.getByRole('list', { name: 'Articles' })
  await expect(list).toBeVisible()
  await expect(list.getByRole('listitem').first()).toBeVisible()
  await expectNoSideways(page)
  await list.getByRole('listitem').first().getByRole('link').first().click()
  await expect(page.getByRole('heading', { name: 'Sizes and EAN' })).toBeVisible()
  await expect(page.getByRole('button', { name: /download/i }).first()).toBeVisible()
})

test('a brand admin logs in and sees the dashboard and catalog', async ({ page }) => {
  await chooseEnglish(page)
  await logIn(page, admin)
  await expect(page.getByRole('heading', { name: /hello iris/i })).toBeVisible()
  await page.goto('./admin/catalog')
  await expect(page.getByRole('heading', { name: 'Catalog', level: 1 })).toBeVisible()
  await expectNoSideways(page)
})

test('deep links survive a reload (SPA fallback + base href)', async ({ page }) => {
  await chooseEnglish(page)
  await logIn(page, admin)
  await expect(page.getByRole('heading', { name: /hello iris/i })).toBeVisible()
  await page.goto('./admin/automation')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Automatic upload', level: 1 })).toBeVisible()
})

test('the account language is used after login when the device has no choice', async ({ page }) => {
  await logIn(page, admin)
  await expect(page.getByRole('heading', { name: /hallo iris/i })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl')
})

for (const [lang, button, heading] of [
  ['el', 'Σύνδεση', 'Διεύθυνση email'],
  ['bg', 'Вход', 'Имейл адрес'],
] as const) {
  test(`the language switcher shows the login page in ${lang} and remembers it`, async ({ page }) => {
    await page.goto('./login?mock=reset')
    await page.getByTestId('language-switcher').selectOption(lang)
    await expect(page.getByRole('button', { name: button })).toBeVisible()
    await expect(page.getByLabel(heading)).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', lang)
    await page.reload()
    await expect(page.getByRole('button', { name: button })).toBeVisible()
    await expectNoSideways(page)
  })
}
