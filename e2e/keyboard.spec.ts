// Everything important works without a mouse: skip link, login, selecting, dialogs, tabs.
import { expect, test, type Page } from '@playwright/test'
import { admin, buyer, chooseEnglish, logIn } from './helpers'

// Keyboard use is a desktop concern; the phone project covers touch in the other specs.
test.skip(({ isMobile }) => isMobile, 'desktop only')
test.beforeEach(async ({ page }) => chooseEnglish(page))

/** Press Tab until `test` (a function source run on document.activeElement) is true, like a keyboard user would. */
async function tabTo(page: Page, test: string, max = 150) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab')
    if (await page.evaluate(`(${test})(document.activeElement)`)) return
  }
  throw new Error('never reached by Tab: ' + test)
}

test('the first Tab offers a skip link that jumps to the content', async ({ page }) => {
  await logIn(page, buyer)
  await page.goto('./ean')
  await expect(page.getByRole('heading', { name: 'EAN list' })).toBeVisible()
  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: 'Skip to content' })
  await expect(skip).toBeFocused()
  await expect(skip).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.locator('main')).toBeFocused()
})

test('after following a link inside the page, focus starts at the new content', async ({ page }) => {
  await logIn(page, buyer)
  // The clicked tile disappears with the catalog; focus must not fall back to the page body.
  await page.getByRole('list', { name: 'Articles' }).getByRole('link').first().press('Enter')
  await expect(page.getByRole('heading', { name: 'Sizes and EANs' })).toBeVisible()
  await expect(page.locator('main')).toBeFocused()
})

test('logs in with the keyboard only', async ({ page }) => {
  await page.goto('./login?mock=reset')
  await tabTo(page, "(el) => el?.getAttribute('type') === 'email'")
  await page.keyboard.type(buyer.email)
  await page.keyboard.press('Tab')
  await page.keyboard.type(buyer.password)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('list', { name: 'Articles' })).toBeVisible()
})

test('selects an article with the space bar', async ({ page }) => {
  await logIn(page, buyer)
  await expect(page.getByRole('list', { name: 'Articles' }).getByRole('listitem')).toHaveCount(8)
  await tabTo(page, "(el) => /^Select KO-1001/.test(el?.getAttribute('aria-label') ?? '')")
  // The checkbox itself is visually hidden; its tile button shows the focus ring.
  const ring = await page.evaluate(() => getComputedStyle(document.activeElement!.closest('label')!).outlineStyle)
  expect(ring).not.toBe('none')
  await page.keyboard.press('Space')
  await expect(page.getByRole('link', { name: /1 article selected/ })).toBeVisible()
})

test('a confirm dialog opens with Enter, closes with Escape and gives focus back', async ({ page }) => {
  await logIn(page, admin)
  await page.goto('./admin/automation?tab=tokens')
  await page.getByLabel('Name', { exact: true }).fill('PIM nightly')
  await page.getByRole('button', { name: 'Create access key' }).click()
  await page.getByRole('button', { name: 'I have saved it' }).click()
  const revoke = page.getByRole('button', { name: 'Switch off' }).first()
  await revoke.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  // Focus is inside the dialog, not behind it.
  expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(revoke).toBeFocused()
})

test('settings tabs move with the arrow keys', async ({ page }) => {
  await logIn(page, admin)
  await page.goto('./admin/settings')
  const brand = page.getByRole('tab', { name: 'Brand' })
  await brand.focus()
  await page.keyboard.press('ArrowRight')
  const next = page.getByRole('tab', { name: 'Portal' })
  await expect(next).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(next).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('End')
  await expect(page.getByRole('tab').last()).toBeFocused()
})
