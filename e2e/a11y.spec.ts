// axe-core on every main screen of both roles and the public pages, desktop and phone.
// Every retailer screen is also checked for sideways scrolling (the portal is used on phones).
import { test } from '@playwright/test'
import { admin, buyer, chooseEnglish, expectAccessible, expectNoSideways, failOnCspViolations, logIn } from './helpers'

failOnCspViolations()
test.beforeEach(async ({ page }) => chooseEnglish(page))

test('public pages', async ({ page }) => {
  for (const path of ['./login?mock=reset', './login?mock=plain', './forgot-password', './request-access', './invite/inv_no_such_token', './no-such-page']) {
    await page.goto(path)
    await expectAccessible(page, path)
  }
})

test('first-run setup', async ({ page }) => {
  await page.goto('./setup?mock=fresh')
  await expectAccessible(page, 'setup')
})

test('retailer portal', async ({ page }) => {
  await logIn(page, buyer)
  await expectAccessible(page, 'catalog')
  await expectNoSideways(page)
  await page.getByRole('list', { name: 'Articles' }).getByRole('link').first().click()
  await page.getByRole('heading', { name: 'Sizes and EAN' }).waitFor()
  await expectAccessible(page, 'article')
  await expectNoSideways(page)
  for (const path of ['./selection', './ean', './downloads', './account']) {
    await page.goto(path)
    await expectAccessible(page, path)
    await expectNoSideways(page)
  }
})

test('themed showroom: start page, catalogue, quick view, article', async ({ page }) => {
  await logIn(page, buyer, 'showroom')
  await page.getByRole('heading', { name: 'Autumn/Winter 2026' }).waitFor()
  await expectAccessible(page, 'start page')
  await expectNoSideways(page)
  await page.goto('./catalog')
  await expectAccessible(page, 'themed catalog')
  await expectNoSideways(page)
  await page.getByRole('button', { name: /^Quick view/ }).first().click()
  await page.getByRole('dialog').getByRole('table').waitFor()
  await expectAccessible(page, 'quick view')
  await page.keyboard.press('Escape')
  await page.goto('./products/KO-1001')
  await page.getByRole('heading', { name: 'Sizes and EAN' }).waitFor()
  await expectAccessible(page, 'themed article')
})

test.describe('appearance editor', () => {
  for (const tab of ['', '?tab=login', '?tab=home', '?tab=images']) {
    test(`/admin/appearance${tab}`, async ({ page }) => {
      await logIn(page, admin, 'showroom')
      await page.goto(`./admin/appearance${tab}`)
      await page.getByRole('region', { name: 'Preview' }).waitFor()
      await expectAccessible(page, `appearance ${tab}`)
      await expectNoSideways(page)
    })
  }
})

const ADMIN_PATHS = [
  './admin',
  './admin/catalog',
  './admin/catalog/KO-1001',
  './admin/catalog/KO-1008',
  './admin/catalog/KO-1010',
  './admin/catalog/new',
  './admin/imports',
  './admin/automation',
  './admin/automation?tab=tokens',
  './admin/automation?tab=recipes',
  './admin/automation?tab=webhooks',
  './admin/automation/sources/new',
  './admin/retailers',
  './admin/retailers/new',
  './admin/requests',
  './admin/stats',
  './admin/settings',
  './admin/settings?tab=portal',
  './admin/settings?tab=defaults',
  './admin/settings?tab=team',
  './admin/settings?tab=account',
  './admin/settings?tab=system',
]

// One test per screen, so a slow runner never hits the per-test timeout.
test.describe('brand admin', () => {
  for (const path of ADMIN_PATHS) {
    test(path.replace('./', '/'), async ({ page }) => {
      await logIn(page, admin)
      await page.goto(path)
      await expectAccessible(page, path)
      await expectNoSideways(page)
    })
  }

  test('retailer detail', async ({ page }) => {
    await logIn(page, admin)
    await page.goto('./admin/retailers')
    await page.getByRole('main').getByRole('link').filter({ hasText: /Boutique/ }).first().click()
    await page.getByRole('heading', { level: 1 }).waitFor()
    await expectAccessible(page, 'retailer detail')
    await expectNoSideways(page)
  })
})
