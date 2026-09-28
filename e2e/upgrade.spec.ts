// A tab left open during an upgrade: the old version's lazily loaded files are gone.
import { expect, test } from '@playwright/test'
import { admin, chooseEnglish, logIn } from './helpers'

test('reloads once when a file of the old version is gone, then shows the error page', async ({ page, context, isMobile }) => {
  await chooseEnglish(page)
  await logIn(page, admin)
  await expect(page.getByRole('heading', { name: /Hello Iris/ })).toBeVisible()
  // The settings screen was never loaded in this tab; its file disappears with the upgrade.
  await context.route(/\/assets\/Settings-[\w-]+\.js$/, (route) => route.fulfill({ status: 404, body: 'gone' }))
  let loads = 0
  page.on('load', () => loads++)
  if (isMobile) await page.getByRole('button', { name: 'Menu' }).click()
  await page.getByRole('navigation', { name: 'Main menu' }).getByRole('link', { name: 'Settings' }).click()
  // Reloaded automatically (by the UI's preload guard and/or the router's own module check,
  // each at most once); the file is still missing, so no loop: the error page with a way out.
  await expect(page.getByRole('heading', { name: 'This page could not be loaded' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  expect(loads).toBeGreaterThanOrEqual(1)
  expect(loads).toBeLessThanOrEqual(2)
  await page.waitForTimeout(1500)
  expect(loads).toBeLessThanOrEqual(2)
})
