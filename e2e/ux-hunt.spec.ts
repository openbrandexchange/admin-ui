// UX hunt: walks every screen of both roles (and the public pages) at desktop and phone width
// and fails on the problems people notice first: sideways scrolling, text cut off on buttons,
// tap targets under 24 px (WCAG 2.2 2.5.8, with its spacing exception), controls without an
// accessible name, console errors, broken images, untranslated keys (`portal.filters.x`,
// `{{count}}`) and focus that falls back to the page after an action.
//
// It reports every problem of every screen at once, so one run gives the whole list.
import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { admin, buyer, chooseEnglish, failOnCspViolations, logIn } from './helpers'

failOnCspViolations()
test.beforeEach(async ({ page }) => chooseEnglish(page))

type Screen = { path: string; name?: string; prepare?: (page: Page, isMobile: boolean) => Promise<void> }

const TOP_KEYS = [...Object.keys(JSON.parse(readFileSync(new URL('../src/locales/en.json', import.meta.url), 'utf8'))), 'appearance']

/** Everything the hunt checks inside the page. Runs in the browser; returns readable problems. */
function inspect({ topKeys }: { topKeys: string[] }): string[] {
  const problems: string[] = []
  const label = (el: Element) => {
    const text = ((el as HTMLElement).innerText || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim().replace(/\s+/g, ' ').slice(0, 40)
    return `<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.getAttribute('role') ? ` role=${el.getAttribute('role')}` : ''}> "${text}"`
  }
  // An open modal dialog makes the rest of the page inert: only its own controls count then.
  const modal = document.querySelector('dialog:modal')
  const shown = (el: Element) => {
    if (el.closest('[aria-hidden="true"], [inert], [hidden]')) return false
    if (modal && !modal.contains(el)) return false
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0
  }
  /** Visually hidden (Tailwind's sr-only: clipped to nothing), e.g. a skip link before it gets focus. */
  const srOnly = (el: Element) => {
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return r.width <= 1 || r.height <= 1 || cs.clipPath === 'inset(50%)' || /rect\(0px,? 0px,? 0px,? 0px\)/.test(cs.clip)
  }

  // 1. Sideways scrolling.
  const doc = document.documentElement
  if (doc.scrollWidth > doc.clientWidth + 1) problems.push(`the page scrolls sideways by ${doc.scrollWidth - doc.clientWidth}px`)

  const controls = [
    ...document.querySelectorAll<HTMLElement>(
      'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=link], [role=checkbox], [role=radio], [role=tab], [role=switch], [role=menuitem], [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((el) => !(el as HTMLButtonElement).disabled && el.tagName !== 'MAIN')

  // 2. Accessible names.
  const nameOf = (el: HTMLElement): string => {
    const by = el.getAttribute('aria-labelledby')
    if (by) return by.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim()
    const aria = el.getAttribute('aria-label')
    if (aria?.trim()) return aria.trim()
    const labels = (el as HTMLInputElement).labels
    if (labels?.length) return [...labels].map((l) => l.textContent ?? '').join(' ').trim()
    const field = el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement
    if (field && el instanceof HTMLInputElement && ['submit', 'button', 'reset'].includes(el.type)) return el.value
    if (!field) {
      const text = (el.textContent ?? '').trim()
      if (text) return text
      const img = el.querySelector('img[alt]')?.getAttribute('alt') || el.querySelector('svg[aria-label]')?.getAttribute('aria-label')
      if (img) return img
    }
    return el.getAttribute('title') ?? ''
  }
  for (const el of controls) if ((shown(el) || srOnly(el)) && !nameOf(el)) problems.push(`no accessible name: ${label(el)}`)

  // 3. Tap targets: what a finger hits is the control, or the label that wraps a (hidden) checkbox.
  const targetOf = (el: HTMLElement): HTMLElement | null => {
    if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
      const lab = el.closest('label') ?? el.labels?.[0] ?? null
      if (lab && shown(lab)) return lab
    }
    if (srOnly(el) || !shown(el)) return null
    // Links inside running text are exempt (WCAG 2.5.8 "inline").
    if (el.tagName === 'A' && getComputedStyle(el).display === 'inline') {
      const block = el.parentElement?.closest('p, li, dd, td, span, div')
      if (block && (block.textContent ?? '').trim().length > (el.textContent ?? '').trim().length + 1) return null
    }
    return el
  }
  const targets = [...new Set(controls.map(targetOf).filter((t): t is HTMLElement => !!t))]
  const rects = targets.map((t) => t.getBoundingClientRect())
  targets.forEach((t, i) => {
    const r = rects[i]
    if (r.width >= 24 && r.height >= 24) return
    // Spacing exception: a 24 px circle on the target's centre may not touch another target.
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const crowded = rects.some((o, j) => {
      if (j === i || targets[j].contains(t) || t.contains(targets[j])) return false
      const dx = Math.max(o.left - cx, 0, cx - o.right)
      const dy = Math.max(o.top - cy, 0, cy - o.bottom)
      return dx * dx + dy * dy < 12 * 12
    })
    if (crowded) problems.push(`tap target ${Math.round(r.width)}×${Math.round(r.height)}px, too close to another: ${label(t)}`)
  })

  // 4. Text cut off on buttons, tabs and button-like links (ellipsis, hidden overflow or text past the edge).
  const buttons = [...document.querySelectorAll<HTMLElement>('button, [role=button], [role=tab], a[class*="inline-flex"], label[class*="rounded-full"]')].filter(shown)
  for (const b of buttons) {
    for (const node of [b, ...b.querySelectorAll<HTMLElement>('*')]) {
      if (!shown(node) || srOnly(node) || node.tagName === 'svg' || node.closest('svg')) continue
      const cs = getComputedStyle(node)
      const clips = cs.overflowX !== 'visible' || cs.textOverflow === 'ellipsis' || node === b
      if (clips && node.scrollWidth > node.clientWidth + 1 && (node.textContent ?? '').trim()) {
        problems.push(`text cut off (${node.scrollWidth}px in ${node.clientWidth}px): ${label(b)}`)
        break
      }
    }
  }

  // 5. Broken images.
  for (const img of document.images) {
    if (img.getAttribute('src') && img.complete && img.naturalWidth === 0) problems.push(`broken image: ${img.getAttribute('src')}`)
  }

  // 6. Untranslated keys and placeholders, in text and in attributes people hear or see.
  const keyRe = new RegExp(`(^|[^\\w@/.-])((?:${topKeys.join('|')})\\.[a-zA-Z_][\\w]*(?:\\.[\\w]+)*)(?![\\w@/-])`)
  const check = (s: string | null, where: string) => {
    if (!s) return
    const m = keyRe.exec(s)
    if (m && !/\.(csv|xlsx|json|zip|jpe?g|png|com|example|org)$/i.test(m[2])) problems.push(`untranslated key "${m[2]}" in ${where}`)
    const p = /\{\{\s*\w+\s*\}\}/.exec(s)
    if (p) problems.push(`placeholder "${p[0]}" left in ${where}`)
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const parent = n.parentElement
    if (!parent || parent.closest('script, style, code, pre, textarea') || !parent.isConnected) continue
    check(n.textContent, `text "${(n.textContent ?? '').trim().slice(0, 60)}"`)
  }
  for (const el of document.querySelectorAll('[aria-label], [placeholder], [title], img[alt]')) {
    for (const a of ['aria-label', 'placeholder', 'title', 'alt']) check(el.getAttribute(a), `${a} of ${label(el)}`)
  }
  check(document.title, 'the page title')
  return [...new Set(problems)]
}

/** Waits until a screen has loaded its data and images. */
async function settle(page: Page) {
  await page.waitForLoadState('load')
  await expect(page.getByRole('main')).toBeVisible()
  await expect(page.getByRole('status', { name: 'Loading…' })).toHaveCount(0)
  await page.waitForTimeout(200)
  await expect(page.getByRole('status', { name: 'Loading…' })).toHaveCount(0)
  await page.waitForFunction(() => [...document.images].every((i) => i.complete || i.loading === 'lazy'), undefined, { timeout: 5000 }).catch(() => {})
}

/** Console errors and uncaught exceptions, per page. */
function watchConsole(page: Page) {
  const errors: string[] = []
  page.on('console', (m) => {
    // The browser itself logs every 4xx answer ("Failed to load resource"); those are the node's
    // answers to a wrong token or a refused action, which the screen explains. Anything else counts.
    if (m.type() === 'error' && !/^Failed to load resource: the server responded with a status of 4\d\d/.test(m.text())) errors.push(`console error: ${m.text().slice(0, 200)}`)
  })
  page.on('pageerror', (e) => errors.push(`uncaught: ${e.message.slice(0, 200)}`))
  return errors
}

async function walk(page: Page, isMobile: boolean, screens: Screen[]) {
  const errors = watchConsole(page)
  const report: string[] = []
  for (const s of screens) {
    errors.length = 0
    if (s.path) await page.goto(s.path)
    await settle(page)
    await s.prepare?.(page, isMobile)
    if (s.prepare) await settle(page)
    const found = [...(await page.evaluate(inspect, { topKeys: TOP_KEYS })), ...errors]
    if (found.length) report.push(`${s.name ?? s.path}\n  - ${found.join('\n  - ')}`)
  }
  expect(report, `UX problems:\n${report.join('\n')}`).toEqual([])
}

const openFilters = async (page: Page, isMobile: boolean) => {
  if (isMobile) await page.getByRole('button', { name: /^Filters/ }).click()
}

const PORTAL: Screen[] = [
  { path: './', name: 'start page (themed showroom)' },
  {
    path: './',
    name: 'start page, quick view of a product',
    prepare: async (page) => {
      await page.getByRole('button', { name: /^Quick view/ }).first().click()
      await page.getByRole('dialog').getByRole('table').waitFor()
    },
  },
  { path: './catalog', name: 'catalog', prepare: openFilters },
  {
    path: './catalog',
    name: 'catalog, quick view',
    prepare: async (page) => {
      await page.getByRole('button', { name: /^Quick view/ }).first().click()
      await page.getByRole('dialog').getByRole('table').waitFor()
    },
  },
  { path: './catalog?item_type=bag', name: 'catalog from a start page tile' },
  { path: `./catalog?${new URLSearchParams({ qualifier: JSON.stringify(['organic', 'post_consumer']), item_type: JSON.stringify(['t_shirt', 'bag']) })}`, name: 'catalog with filters', prepare: openFilters },
  { path: './catalog?q=no-such-article', name: 'catalog without results' },
  {
    path: './products/KO-1001',
    name: 'article page, image full screen',
    prepare: async (page) => {
      await page.getByRole('button', { name: 'View image full screen' }).click()
      await page.getByRole('button', { name: 'Next image' }).waitFor()
    },
  },
  {
    path: './catalog?q=KO-1009',
    name: 'article page (bag, two claims)',
    prepare: async (page) => {
      await page.getByRole('list', { name: 'Articles' }).getByRole('link').first().click()
      await page.getByRole('heading', { name: 'Sizes and EANs' }).waitFor()
    },
  },
  {
    path: './catalog?q=KO-1008',
    name: 'article page (suitcase), added to the selection',
    prepare: async (page) => {
      await page.getByRole('list', { name: 'Articles' }).getByRole('link').first().click()
      await page.getByRole('button', { name: 'Add to selection' }).click()
      await page.getByRole('button', { name: 'In your selection' }).waitFor()
    },
  },
  { path: './selection', name: 'selection with an article' },
  { path: './ean', name: 'EAN list' },
  {
    path: './ean',
    name: 'EAN list with results',
    prepare: async (page) => {
      await page.getByLabel('EANs', { exact: true }).fill('2000100101018\n123')
      await page.getByRole('button', { name: 'Find articles' }).click()
      await page.getByRole('button', { name: /download images of these articles/i }).waitFor()
    },
  },
  { path: './downloads', name: 'downloads' },
  { path: './account', name: 'account' },
]

const ADMIN: Screen[] = [
  './admin',
  './admin/catalog',
  './admin/catalog?q=no-such-article',
  './admin/catalog/KO-1001',
  './admin/catalog/KO-1004',
  './admin/catalog/KO-1008',
  './admin/catalog/KO-1009',
  './admin/catalog/KO-1010',
  './admin/catalog/KT-2001',
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
  './admin/appearance',
  './admin/appearance?tab=login',
  './admin/appearance?tab=home',
  './admin/appearance?tab=images',
  './',
].map((path) => ({ path }))

ADMIN.push(
  {
    path: './admin/appearance?tab=home',
    name: 'appearance: a block opened, preview on the phone',
    prepare: async (page) => {
      await page.getByRole('button', { name: /^Image tiles/ }).click()
      await page.getByRole('radio', { name: 'Phone' }).click()
    },
  },
  {
    path: './admin/appearance?tab=home',
    name: 'appearance: adding a block',
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Add a block' }).click()
      await page.getByRole('dialog').waitFor()
    },
  },
)

ADMIN.push(
  {
    path: './admin/imports',
    name: 'import result with label warnings',
    prepare: async (page) => {
      await page.getByRole('main').getByRole('link').filter({ hasText: /check only/i }).first().click()
      await page.getByText('These are warnings, not errors', { exact: false }).waitFor()
    },
  },
  {
    path: './admin/retailers',
    name: 'retailer detail',
    prepare: async (page) => {
      await page.getByRole('main').getByRole('link').filter({ hasText: /Boutique/ }).first().click()
      await page.getByRole('heading', { level: 1 }).waitFor()
    },
  },
  {
    path: './admin/catalog/KO-1004',
    name: 'article form with an extra part and material',
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Add part' }).click()
      await page.getByRole('button', { name: 'Add material' }).first().click()
    },
  },
)

const PUBLIC: Screen[] = ['./login?mock=reset', './forgot-password', './request-access', './invite/inv_no_such_token', './no-such-page', './setup?mock=fresh'].map((path) => ({ path }))

test.describe('UX hunt', () => {
  test.describe.configure({ timeout: 240_000 })

  test('public pages', async ({ page, isMobile }) => {
    await walk(page, isMobile, PUBLIC)
  })

  test('retailer portal', async ({ page, isMobile }) => {
    await logIn(page, buyer, 'showroom')
    await walk(page, isMobile, PORTAL)
  })

  test('retailer portal in the default look', async ({ page, isMobile }) => {
    await logIn(page, buyer)
    await walk(page, isMobile, [{ path: './', name: 'catalog as the start page', prepare: openFilters }, { path: './?q=KO-1003', name: 'catalog with a search' }, { path: './products/KO-1003', name: 'article page' }])
  })

  test('brand admin', async ({ page, isMobile }) => {
    await logIn(page, admin, 'showroom')
    await walk(page, isMobile, ADMIN)
  })
})

/** Focus must never fall back to the page itself after an action. */
async function expectFocusKept(page: Page, what: string) {
  await page.waitForTimeout(100)
  const where = await page.evaluate(() => (document.activeElement && document.activeElement !== document.body ? document.activeElement.tagName : null))
  expect(where, `focus fell back to the page after: ${what}`).not.toBeNull()
}

test.describe('focus after actions', () => {
  test.skip(({ isMobile }) => isMobile, 'keyboard focus: desktop only')

  test('retailer: filtering, selecting, dialogs, adding to the selection', async ({ page }) => {
    await logIn(page, buyer)
    const list = page.getByRole('list', { name: 'Articles' })
    await expect(list.getByRole('listitem')).toHaveCount(11)
    await page.getByRole('group', { name: 'Product type' }).getByRole('checkbox').first().check()
    await expectFocusKept(page, 'ticking a filter')
    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(list.getByRole('listitem')).toHaveCount(11)
    await expectFocusKept(page, 'clearing the filters')
    const tile = page.getByRole('checkbox', { name: /^Select KO-1001/ })
    await tile.focus()
    await page.keyboard.press('Space')
    await expect(tile).toBeChecked()
    await expectFocusKept(page, 'selecting an article')
    const all = page.getByRole('button', { name: 'Download all' })
    await all.click()
    await page.keyboard.press('Escape')
    await expect(all).toBeFocused()
    await page.goto('./?q=KO-1003')
    await list.getByRole('link').first().click()
    await page.getByRole('button', { name: 'Add to selection' }).click()
    await expect(page.getByRole('button', { name: 'In your selection' })).toBeFocused()
    await page.goto('./selection')
    await page.getByRole('button', { name: 'Empty selection' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Empty selection' }).click()
    await expect(page.getByText('Your selection is empty')).toBeVisible()
    await expectFocusKept(page, 'emptying the selection')
  })

  test('brand: editing materials and saving an article', async ({ page }) => {
    await logIn(page, admin)
    await page.goto('./admin/catalog/KO-1003')
    const main = page.getByRole('group', { name: 'Main fabric' })
    await main.getByRole('checkbox', { name: 'In conversion', exact: true }).check()
    await expectFocusKept(page, 'ticking a claim')
    await page.getByRole('button', { name: 'Add part' }).click()
    await expectFocusKept(page, 'adding a part')
    await page.getByRole('button', { name: 'Remove part' }).last().click()
    await expectFocusKept(page, 'removing a part')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Saved', { exact: true })).toBeVisible()
    await expectFocusKept(page, 'saving the article')
  })
})

// The hunt itself: every check must find a planted problem, so a broken check cannot pass quietly.
test('the hunt finds planted problems', async ({ page }) => {
  await page.setContent(`
    <main>
      <div style="width:3000px;height:4px"></div>
      <button style="width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">A very long button text</button>
      <button style="width:16px;height:16px;padding:0">a</button><button style="width:16px;height:16px;padding:0">b</button>
      <button style="width:40px;height:40px"></button>
      <img src="/no-such-image.png" alt="x">
      <p>portal.filters.qualifier and {{count}}</p>
      <input aria-label="admin.title">
    </main>`)
  await page.waitForFunction(() => [...document.images].every((i) => i.complete))
  const found = (await page.evaluate(inspect, { topKeys: TOP_KEYS })).join('\n')
  for (const kind of ['scrolls sideways', 'text cut off', 'tap target 16×16px', 'no accessible name', 'broken image', 'untranslated key "portal.filters.qualifier"', 'placeholder "{{count}}"', 'untranslated key "admin.title"']) {
    expect(found, kind).toContain(kind)
  }
})
