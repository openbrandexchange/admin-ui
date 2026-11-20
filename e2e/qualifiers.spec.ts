// Several material claims (qualifiers) per fibre, spec 0.3: the brand ticks them in the
// article form, the retailer filters on them. Desktop and phone; keyboard on desktop; axe.
import { expect, test } from '@playwright/test'
import { admin, buyer, chooseEnglish, expectAccessible, expectNoSideways, failOnCspViolations, logIn } from './helpers'

failOnCspViolations()
test.beforeEach(async ({ page }) => chooseEnglish(page))

test('a brand gives one fibre two claims and saves them', async ({ page, isMobile }) => {
  await logIn(page, admin)
  await page.goto('./admin/catalog/MN-1004')
  const main = page.getByRole('group', { name: 'Main fabric' })
  const claims = main.getByRole('group', { name: /^Sustainability\b.*98% cotton/ })
  await expect(claims).toBeVisible()
  // Every claim of the vocabulary is offered, none ticked yet.
  for (const name of ['Organic', 'In conversion', 'Recycled', 'Pre-consumer', 'Post-consumer', 'Regenerative']) {
    await expect(claims.getByRole('checkbox', { name, exact: true })).not.toBeChecked()
  }
  const organic = claims.getByRole('checkbox', { name: 'Organic', exact: true })
  const regenerative = claims.getByRole('checkbox', { name: 'Regenerative', exact: true })
  if (isMobile) {
    await organic.tap()
    await regenerative.tap()
  } else {
    // Keyboard: Space ticks, Tab walks the chips in order.
    await organic.focus()
    await page.keyboard.press('Space')
    for (let i = 0; i < 5; i++) await page.keyboard.press('Tab')
    await expect(regenerative).toBeFocused()
    await page.keyboard.press('Space')
  }
  await expect(organic).toBeChecked()
  await expect(regenerative).toBeChecked()
  await expectAccessible(page, 'composition editor with two claims')
  await expectNoSideways(page)

  const save = page.getByRole('button', { name: 'Save', exact: true })
  await save.click()
  await expect(page.getByText('Saved', { exact: true })).toBeVisible()
  await expect(page.getByText('98% Cotton (Organic, Regenerative)')).toBeVisible()

  await page.reload()
  const again = page.getByRole('group', { name: 'Main fabric' }).getByRole('group', { name: /^Sustainability\b.*98% cotton/ })
  await expect(again.getByRole('checkbox', { name: 'Organic', exact: true })).toBeChecked()
  await expect(again.getByRole('checkbox', { name: 'Regenerative', exact: true })).toBeChecked()
  await expect(again.getByRole('checkbox', { name: 'Recycled', exact: true })).not.toBeChecked()
})

test('adding and removing a material keeps the keyboard where the work continues', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard: desktop only')
  await logIn(page, admin)
  await page.goto('./admin/catalog/MN-1001')
  const main = page.getByRole('group', { name: 'Main fabric' })
  await main.getByRole('button', { name: 'Add material' }).click()
  await expect(main.getByLabel('Percentage').nth(1)).toBeFocused()
  await page.keyboard.type('5')
  await main.getByRole('button', { name: 'Remove material' }).nth(1).click()
  await expect(main.getByLabel('Percentage').first()).toBeFocused()
})

test('a retailer filters on two claims, keeps them in the address and downloads exactly them', async ({ page, isMobile }) => {
  await logIn(page, buyer)
  const list = page.getByRole('list', { name: 'Articles' })
  await expect(list.getByRole('listitem')).toHaveCount(11)
  if (isMobile) await page.getByRole('button', { name: /^Filters/ }).click()
  const claims = page.getByRole('group', { name: 'Sustainability', exact: true })
  await expect(claims).toBeVisible()
  const organic = claims.getByRole('checkbox', { name: /^Organic/ })
  const post = claims.getByRole('checkbox', { name: /^Post-consumer/ })
  if (isMobile) {
    await organic.tap()
    await expect(list.getByRole('listitem')).toHaveCount(1)
    await post.tap()
  } else {
    await organic.focus()
    await page.keyboard.press('Space')
    await expect(list.getByRole('listitem')).toHaveCount(1)
    // Focus stays on the filter while the results change.
    await expect(organic).toBeFocused()
    await post.focus()
    await page.keyboard.press('Space')
    await expect(post).toBeFocused()
  }
  await expect(list.getByRole('listitem')).toHaveCount(2)
  await expect(list).toContainText('MN-1003')
  await expect(list).toContainText('MN-1009')
  await expect.poll(() => new URL(page.url()).searchParams.get('qualifier')).toBe(JSON.stringify(['organic', 'post_consumer']))
  await expectAccessible(page, 'catalog filtered on two claims')
  await expectNoSideways(page)

  // A shared or reloaded link keeps the filter.
  await page.reload()
  await expect(list.getByRole('listitem')).toHaveCount(2)
  if (isMobile) {
    await expect(page.getByRole('button', { name: /^Filters/ })).toContainText('2')
    await page.getByRole('button', { name: /^Filters/ }).click()
  }
  await expect(page.getByRole('group', { name: 'Sustainability', exact: true }).getByRole('checkbox', { name: /^Organic/ })).toBeChecked()
  // On a phone the filters are a sheet: back to the articles.
  if (isMobile) await page.getByRole('button', { name: 'Show 2 articles' }).click()

  // "Download all" sends the same filter to the node.
  const request = page.waitForRequest((r) => r.method() === 'POST' && r.url().endsWith('/admin/api/portal/download-jobs'))
  await page.getByRole('button', { name: 'Download all' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: /prepare zip/i }).click()
  const body = (await request).postDataJSON()
  expect(body).toMatchObject({ source: 'filter', filter: { qualifier: ['organic', 'post_consumer'] } })

  // Clearing the filters brings all articles back.
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(list.getByRole('listitem')).toHaveCount(11)
})
