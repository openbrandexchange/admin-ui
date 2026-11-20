// Portal appearance (spec 0.3.1): the themed showroom as retailers see it, and a brand that
// edits its look, start page and login page in Appearance, saves, and sees it in the portal.
// With SHOTS_DIR set, screenshots of the showroom are written there.
import { expect, test, type Page } from '@playwright/test'
import { admin, buyer, chooseEnglish, expectNoSideways, failOnCspViolations, logIn } from './helpers'

failOnCspViolations()
test.beforeEach(async ({ page }) => chooseEnglish(page))

const shot = async (page: Page, name: string, isMobile: boolean) => {
  if (!process.env.SHOTS_DIR) return
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${process.env.SHOTS_DIR}/${name}${isMobile ? '-phone' : ''}.png`, fullPage: true })
}

test('the branded login page shows the brand’s image and welcome', async ({ page, isMobile }) => {
  await page.goto('./login?mock=reset')
  await expect(page.getByRole('heading', { name: 'MAISON NOOR wholesale', level: 1 })).toBeVisible()
  await expect(page.getByText('Final images, article data and order windows for our stockists.')).toBeVisible()
  const image = page.locator('img[src*="/admin/api/public/images/img_login"]')
  await expect(image).toBeVisible()
  expect(await image.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true)
  // The brand's fonts are served by the portal itself.
  await expect.poll(() => page.evaluate(() => document.fonts.check("16px 'OBX Jost'"))).toBe(true)
  await expectNoSideways(page)
  await shot(page, 'showroom-login', isMobile)
})

test('a retailer starts on the brand’s start page and follows a tile into the catalogue', async ({ page, isMobile }) => {
  await logIn(page, buyer, 'showroom')
  await expect(page.getByRole('heading', { name: 'Autumn/Winter 2026' })).toBeVisible()
  await expect(page.getByRole('note')).toContainText('order window closes on 15 December')
  await expect(page.getByRole('heading', { name: 'New this season' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'wholesale@maisonnoor.example' })).toBeVisible()
  await expectNoSideways(page)
  await shot(page, 'showroom-start', isMobile)
  await page.getByRole('link', { name: 'Bags' }).click()
  await expect(page).toHaveURL(/\/catalog\?item_type=/)
  const list = page.getByRole('list', { name: 'Articles' })
  await expect(list.getByRole('listitem')).toHaveCount(2)
  await page.goto('./catalog')
  await expect(list.getByRole('listitem')).toHaveCount(11)
  await shot(page, 'showroom-catalog', isMobile)
})

test('quick view: images, sizes and EANs, add to the selection, Escape returns focus', async ({ page, isMobile }) => {
  await logIn(page, buyer, 'showroom')
  await page.goto('./catalog?q=KO-1001')
  const open = page.getByRole('button', { name: /^Quick view/ }).first()
  await open.click()
  const dialog = page.getByRole('dialog', { name: 'Merino Crew Sweater' })
  await expect(dialog.getByText('2000100101018')).toBeVisible()
  await dialog.getByRole('button', { name: 'Add to selection' }).click()
  await expect(dialog.getByRole('button', { name: 'In your selection' })).toBeVisible()
  await shot(page, 'showroom-quick-view', isMobile)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  if (!isMobile) await expect(open).toBeFocused()
  await expect(page.getByRole('link', { name: /1 article selected/ })).toBeVisible()
})

test('the article page: large gallery, full-screen image with arrow keys', async ({ page, isMobile }) => {
  await logIn(page, buyer, 'showroom')
  await page.goto('./products/KO-1003')
  await expect(page.getByRole('heading', { name: 'Organic Cotton Tee', level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'View image full screen' }).click()
  const viewer = page.getByRole('dialog')
  await expect(viewer.getByText('1 / ')).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await expect(viewer.getByText('2 / ')).toBeVisible()
  await page.keyboard.press('Escape')
  await shot(page, 'showroom-article', isMobile)
})

test('a brand edits its look and start page, saves, and sees it in the portal', async ({ page, isMobile }) => {
  await logIn(page, admin, 'showroom')
  await page.goto('./admin/appearance')
  await expect(page.getByRole('region', { name: 'Preview' })).toBeVisible()
  if (!isMobile) await shot(page, 'appearance-editor', false)
  // Look: a dark theme in another main colour.
  await page.getByRole('radio', { name: 'Dark' }).check({ force: true })
  const primary = page.getByRole('textbox', { name: 'Main colour', exact: true })
  await primary.fill('#b08d57')
  await expect(page.getByText('You have unsaved changes.')).toBeVisible()
  // The preview follows at once.
  await expect(page.getByRole('region', { name: 'Preview' }).locator('[data-scheme="dark"]')).toHaveCount(1)
  // Start page: a notice at the top.
  await page.getByRole('tablist', { name: 'Appearance' }).getByRole('tab', { name: 'Start page' }).click()
  await page.getByRole('button', { name: 'Add a block' }).click()
  await page.getByRole('dialog').getByRole('button', { name: /^Notice/ }).click()
  await page.getByRole('radio', { name: 'English' }).click()
  const blocks = page.getByRole('list', { name: 'Blocks of the start page' })
  const added = blocks.getByRole('listitem').last()
  await added.getByRole('textbox', { name: /^Text/ }).fill('Showroom days in Paris: 3 and 4 March.')
  // Keyboard reordering: focus the handle, arrow up.
  await added.getByRole('button', { name: /^Move Notice, position 7/ }).focus()
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowUp')
  await expect(blocks.getByRole('listitem').first()).toContainText('Notice')
  await expect(page.getByRole('region', { name: 'Preview' }).getByText('Showroom days in Paris: 3 and 4 March.')).toBeVisible()
  if (!isMobile) await shot(page, 'appearance-start-page', false)
  // Leaving with unsaved changes asks first.
  if (!isMobile) {
    await page.getByRole('link', { name: 'Statistics' }).first().click()
    await expect(page.getByRole('dialog', { name: 'Leave without saving?' })).toBeVisible()
    await page.getByRole('button', { name: 'Stay on this page' }).click()
  }
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Saved', { exact: true })).toBeVisible()
  // Survives a reload (the node stored it) and shows in the portal.
  await page.goto('./admin/appearance')
  await expect(page.getByRole('textbox', { name: 'Main colour', exact: true })).toHaveValue('#b08d57')
  await page.goto('./')
  await expect(page.getByText('Showroom days in Paris: 3 and 4 March.')).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-scheme', 'dark')
  await expectNoSideways(page)
  await shot(page, 'showroom-dark-after-edit', isMobile)
})

test('the image library explains why a used image cannot be deleted', async ({ page }) => {
  await logIn(page, admin, 'showroom')
  await page.goto('./admin/appearance?tab=images')
  const list = page.getByRole('list', { name: 'Images' })
  await expect(list.getByRole('listitem')).toHaveCount(7)
  await expect(list.getByText('In use')).toHaveCount(7)
  await list.getByRole('listitem').first().getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('alert')).toContainText('still used on the login page or the start page')
  await expect(list.getByRole('listitem')).toHaveCount(7)
})
