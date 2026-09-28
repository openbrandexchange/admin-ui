import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

export const admin = { email: 'admin@kestrel.example', password: 'kestrel-admin-2026' }
export const buyer = { email: 'buyer@shop.example', password: 'kestrel-shop-2026' }

/**
 * The demo accounts are Dutch; most checks read English, so they start from a device where
 * the visitor already picked English (an explicit choice wins over the account language).
 */
export async function chooseEnglish(page: Page) {
  await page.addInitScript(() => localStorage.setItem('obx.lang', 'en'))
}

/** Log in from a freshly reset mock node. */
export async function logIn(page: Page, who: { email: string; password: string }) {
  await page.goto('./login?mock=reset')
  await page.getByLabel('Email address').fill(who.email)
  await page.getByLabel('Password', { exact: true }).fill(who.password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

export async function expectNoSideways(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}

/** axe-core, WCAG 2.1 A + AA. Fails with a readable list of the violations. */
export async function expectAccessible(page: Page, what: string) {
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('status', { name: 'Loading…' })).toHaveCount(0)
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const summary = result.violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.slice(0, 5).map((n) => n.target.join(' ')).join('\n    ')}`)
  expect(summary, `accessibility problems on ${what}`).toEqual([])
}
