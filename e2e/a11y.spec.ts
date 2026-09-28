// axe-core on every main screen of both roles and the public pages, desktop and phone.
// Every retailer screen is also checked for sideways scrolling (the portal is used on phones).
import { test } from '@playwright/test'
import { admin, buyer, chooseEnglish, expectAccessible, expectNoSideways, failOnCspViolations, logIn } from './helpers'

failOnCspViolations()
test.beforeEach(async ({ page }) => chooseEnglish(page))

test('public pages', async ({ page }) => {
  for (const path of ['./login?mock=reset', './forgot-password', './request-access', './invite/inv_no_such_token', './no-such-page']) {
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

test('brand admin', async ({ page }) => {
  await logIn(page, admin)
  const paths = [
    './admin',
    './admin/catalog',
    './admin/catalog/KO-1001',
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
  for (const path of paths) {
    await page.goto(path)
    await expectAccessible(page, path)
    await expectNoSideways(page)
  }
  await page.goto('./admin/retailers')
  await page.getByRole('main').getByRole('link').filter({ hasText: /Boutique/ }).first().click()
  await page.getByRole('heading', { level: 1 }).waitFor()
  await expectAccessible(page, 'retailer detail')
})
