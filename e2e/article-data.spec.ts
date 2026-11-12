// Article data of spec 0.2: label information, measurements and features on the retailer's
// article page and the brand's article screen, and label warnings in import results.
import { expect, test, type Page } from '@playwright/test'
import { admin, buyer, chooseEnglish, expectAccessible, expectNoSideways, failOnCspViolations, logIn } from './helpers'

failOnCspViolations()
test.beforeEach(async ({ page }) => chooseEnglish(page))

async function openArticle(page: Page, style: string) {
  await page.goto(`./?q=${style}`)
  await page.getByRole('list', { name: 'Articles' }).getByRole('link', { name: new RegExp(style) }).first().click()
  await expect(page.getByRole('heading', { name: 'Sizes and EAN' })).toBeVisible()
}

test('a retailer reads the label, measurements and features of a suitcase, a bag and a boot', async ({ page }) => {
  await logIn(page, buyer)

  await openArticle(page, 'KO-1008')
  const label = page.getByRole('region', { name: 'Label information' })
  await expect(label).toContainText('100% Polyester (Recycled)')
  await expect(label).toContainText('Do not wash')
  const measures = page.getByRole('region', { name: 'Measurements', exact: true })
  await expect(measures).toContainText('55 × 40 × 20 cm')
  await expect(measures).toContainText('2.6 kg')
  await expect(page.getByRole('region', { name: 'Features' })).toContainText('TSA combination lock')
  await expectAccessible(page, 'suitcase')
  await expectNoSideways(page)

  await openArticle(page, 'KO-1009')
  await expect(page.getByRole('region', { name: 'Label information' })).toContainText('GRS')
  await expect(page.getByRole('region', { name: 'Measurements', exact: true })).toContainText('up to 15.6 inches')
  await expect(page.getByRole('region', { name: 'Features' })).toContainText('Water-repellent')
  await expectAccessible(page, 'laptop bag')
  await expectNoSideways(page)

  await openArticle(page, 'KO-1010')
  await expect(page.getByRole('region', { name: 'Label information' })).toContainText('Lining and sock')
  await expect(page.getByRole('region', { name: 'Measurements', exact: true })).toContainText('Heel height')
  await expectAccessible(page, 'boot')
  await expectNoSideways(page)
})

test('a brand admin sees label warnings in an import result, as warnings', async ({ page }) => {
  await logIn(page, admin)
  await page.goto('./admin/imports')
  await page.getByRole('main').getByRole('link').filter({ hasText: /check only/i }).first().click()
  await expect(page.getByText('These are warnings, not errors', { exact: false })).toBeVisible()
  await expect(page.getByText('Directive 94/11/EC').first()).toBeVisible()
  await expectAccessible(page, 'import with label warnings')
  await expectNoSideways(page)
})

test('a brand admin edits the measurements of a size', async ({ page }) => {
  await logIn(page, admin)
  await page.goto('./admin/catalog/KO-1009')
  await expect(page.getByRole('heading', { name: 'Label information' })).toBeVisible()
  await page.getByRole('region', { name: 'Colours and sizes' }).getByRole('button', { name: 'Edit' }).first().click()
  const dialog = page.getByRole('dialog')
  await expectAccessible(page, 'size dialog with measurements')
  await dialog.getByLabel('Weight (kg)').fill('0.95')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('region', { name: 'Colours and sizes' })).toContainText('0.95 kg')
})
