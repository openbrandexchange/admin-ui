// Portal appearance (spec 0.3.1): the theme engine, links, the editor's merge patch, the
// retailer's start page and quick view, and an editing round trip against the mock node.
import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { db, DEMO, resetDb } from '../src/mock/db'
import { contrast, parseHex } from '../src/lib/accent'
import { contrastIssues, resolveTheme } from '../src/lib/theme'
import { isPortalLink, parseLink, queryFilter } from '../src/lib/links'
import { portalText } from '../src/lib/branding'
import { draftOf, patchOf } from '../src/screens/admin/appearance/model'
import type { Settings } from '../src/api/types'
import { renderApp } from './render'

const rgb = (hex: string) => parseHex(hex)!

describe('theme engine', () => {
  it('keeps the default look without any settings', () => {
    const t = resolveTheme(null)
    expect(t.scheme).toBe('light')
    expect(t.density).toBe('comfortable')
    expect(t.vars['--color-white']).toBe('#ffffff')
  })

  it('lets theme.colors.primary win over the older accent_color', () => {
    expect(resolveTheme({ colors: { primary: '#1f4e5f' } }, '#ff0000').vars['--accent']).toBe('#1f4e5f')
    expect(resolveTheme(null, '#1f4e5f').vars['--accent']).toBe('#1f4e5f')
  })

  it('picks readable text on the primary colour, also for a light one', () => {
    for (const primary of ['#ffe066', '#7fd3ff', '#1c1b1a', '#c8a46a', '#888888']) {
      const v = resolveTheme({ colors: { primary } }).vars
      expect(contrast(rgb(v['--accent']), rgb(v['--accent-contrast']))).toBeGreaterThanOrEqual(4.5)
      expect(contrast(rgb(v['--accent-strong']), rgb(v['--color-white']))).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('keeps body and secondary text readable whatever colours are chosen', () => {
    const v = resolveTheme({ colors: { background: '#eeeeee', surface: '#f4f4f4', text: '#bbbbbb' } }).vars
    expect(contrast(rgb(v['--obx-text']), rgb(v['--obx-bg']))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(rgb(v['--color-stone-500']), rgb(v['--color-white']))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(rgb(v['--color-stone-500']), rgb(v['--obx-bg']))).toBeGreaterThanOrEqual(4.5)
  })

  it('makes a dark theme from light brand colours, and honours dark ones', () => {
    const auto = resolveTheme({ color_scheme: 'auto', colors: { background: '#faf8f4' } }, null, true)
    expect(auto.scheme).toBe('dark')
    expect(contrast(rgb(auto.vars['--obx-bg']), [0, 0, 0])).toBeLessThan(2)
    const dark = resolveTheme({ color_scheme: 'dark', colors: { background: '#101820', text: '#f0f0f0' } })
    expect(dark.vars['--obx-bg']).toBe('#101820')
    expect(resolveTheme({ color_scheme: 'auto' }, null, false).scheme).toBe('light')
  })

  it('maps radius, card style, image fit and fonts to variables, ignoring unknown values', () => {
    const v = resolveTheme({ radius: 'none', card_style: 'elevated', image_fit: 'cover', heading_font: 'fraunces', body_font: 'inter', grid_density: 'editorial' })
    expect(v.vars['--radius-card']).toBe('0px')
    expect(v.vars['--img-fit']).toBe('cover')
    expect(v.vars['--font-display']).toMatch(/^'OBX Fraunces', ui-serif/)
    expect(v.vars['--font-sans']).toMatch(/^'OBX Inter'/)
    expect(v.density).toBe('editorial')
    expect(resolveTheme({ radius: 'huge' as never, future_member: 1 }).vars['--radius-card']).toBe('0.75rem')
  })

  it('warns about colours that fail WCAG AA', () => {
    expect(contrastIssues({ text: '#999999', background: '#ffffff' }).map((i) => i.pair)).toContain('textBackground')
    expect(contrastIssues({ text: '#111111', background: '#ffffff', surface: '#ffffff' })).toEqual([])
  })
})

describe('start page links', () => {
  it('accepts portal paths and https only', () => {
    for (const ok of ['/catalog?item_type=bag', '/products/MN-1001', '/', 'https://example.com/x']) expect(isPortalLink(ok), ok).toBe(true)
    for (const bad of ['//evil.example', 'http://example.com', 'javascript:alert(1)', 'mailto:a@b.c', '/\\evil', 'catalog', '']) expect(isPortalLink(bad), bad).toBe(false)
  })

  it('turns a catalogue link into route and filters', () => {
    expect(parseLink('/catalog?item_type=bag&item_type=shoes&q=noir')).toEqual({ external: false, to: '/catalog', search: { item_type: ['bag', 'shoes'], q: 'noir' } })
    expect(parseLink('https://maison-noor.example/')).toEqual({ external: true, href: 'https://maison-noor.example/' })
    expect(queryFilter('season=AW26&qualifier=organic&cursor=5&limit=3')).toEqual({ season: ['AW26'], qualifier: ['organic'] })
  })

  it('falls back to the brand language, then any', () => {
    expect(portalText({ nl: 'Hallo', en: 'Hello' }, 'de', 'nl')).toBe('Hallo')
    expect(portalText({ fr: 'Bonjour' }, 'de', 'nl')).toBe('Bonjour')
    expect(portalText({ 'de-CH': 'Grüezi', en: 'Hello' }, 'de')).toBe('Grüezi')
    expect(portalText(null, 'de')).toBe('')
  })
})

describe('the editor saves a JSON merge patch', () => {
  const saved = {
    branding: {
      theme: { colors: { primary: '#111111', text: '#222222' }, radius: 'small', x_future: 'kept' },
      login: { layout: 'split', title: { en: 'Hi', nl: 'Hoi' }, background_image: 'img_a', background_image_url: '/admin/api/public/images/img_a' },
      home: { blocks: [{ id: 'h', type: 'hero', image: 'img_a', image_url: '/x', title: { en: 'A' } }, { id: 'f', type: 'from_the_future', foo: 1 }] },
    },
  } as unknown as Settings

  it('clears removed values with null, replaces the blocks whole and never sends resolved URLs', () => {
    const d = draftOf(saved)
    d.theme = { ...d.theme, colors: { primary: '#123456' }, radius: null }
    d.login = { ...d.login, title: { en: 'Welcome' } }
    d.blocks = d.blocks.slice().reverse()
    const p = patchOf(saved, d) as { branding: Record<string, Record<string, unknown>> }
    const theme = p.branding.theme as Record<string, unknown>
    expect(theme.colors).toEqual({ primary: '#123456', secondary: null, background: null, surface: null, text: null })
    expect(theme.radius).toBeNull()
    expect(theme.x_future).toBe('kept')
    expect(p.branding.accent_color).toBe('#123456')
    expect(p.branding.login.title).toEqual({ en: 'Welcome', nl: null })
    expect(JSON.stringify(p)).not.toContain('_url')
    const blocks = (p.branding.home as { blocks: { id: string }[] }).blocks
    expect(blocks.map((b) => b.id)).toEqual(['f', 'h'])
    // A block type of a later version is kept as it is.
    expect(blocks[0]).toEqual({ id: 'f', type: 'from_the_future', foo: 1 })
  })
})

async function loginAs(who: 'admin' | 'retailer', path = '/login') {
  localStorage.setItem('obx.lang', 'en')
  const r = await renderApp(path)
  await r.user.type(await screen.findByLabelText(/email address/i), DEMO[who].email)
  await r.user.type(screen.getByLabelText(/^password$/i), DEMO[who].password)
  await r.user.click(screen.getByRole('button', { name: /log in/i }))
  return r
}

describe('the themed showroom', () => {
  it('shows the brand’s login page texts', async () => {
    resetDb('seeded')
    localStorage.setItem('obx.lang', 'en')
    await renderApp('/login')
    expect(await screen.findByRole('heading', { name: 'MAISON NOOR wholesale' })).toBeInTheDocument()
    expect(screen.getByText('Final images, article data and order windows for our stockists.')).toBeInTheDocument()
  })

  it('opens on the start page blocks and skips unknown block types', async () => {
    resetDb('seeded')
    const home = db().settings.branding!.home as { blocks: Record<string, unknown>[] }
    home.blocks.splice(1, 0, { id: 'later', type: 'video_wall', title: { en: 'Not for this version' } })
    const r = await loginAs('retailer')
    expect(await screen.findByRole('heading', { name: 'Autumn/Winter 2026' })).toBeInTheDocument()
    expect(r.router.state.location.pathname).toBe('/')
    expect(screen.getByRole('note')).toHaveTextContent('order window closes on 15 December')
    expect(screen.getByRole('link', { name: 'Bags' })).toHaveAttribute('href', '/catalog?item_type=%5B%22bag%22%5D')
    expect(screen.getByRole('link', { name: 'wholesale@maison-noor.example' })).toHaveAttribute('href', 'mailto:wholesale@maison-noor.example')
    expect(screen.queryByText('Not for this version')).toBeNull()
    // The products block: AW26 articles only.
    const row = await screen.findByRole('list', { name: 'New this season' })
    await waitFor(() => expect(within(row).getAllByRole('article').length).toBeGreaterThan(0))
    for (const a of within(row).getAllByRole('article')) expect(a).toHaveTextContent('AW26')
    // Filters on the start page URL show the catalogue (old bookmarks keep working).
    await r.router.navigate({ to: '/', search: { q: 'MN-1001' } })
    expect(await screen.findByRole('heading', { name: 'Catalog', level: 1 })).toBeInTheDocument()
  })

  it('quick view shows sizes and EANs and adds to the selection', async () => {
    resetDb('seeded')
    const r = await loginAs('retailer')
    await screen.findByRole('heading', { name: 'Autumn/Winter 2026' })
    await r.router.navigate({ to: '/catalog', search: { q: 'MN-1001' } })
    await r.user.click(await screen.findByRole('button', { name: /quick view.*fine merino crew-neck sweater/i }))
    const dialog = await screen.findByRole('dialog', { name: 'Fine Merino Crew-Neck Sweater' })
    expect(await within(dialog).findByText('2000100101018')).toBeInTheDocument()
    await r.user.click(within(dialog).getByRole('button', { name: 'Add to selection' }))
    await waitFor(() => expect(db().selections.usr_buyer).toHaveLength(1))
    expect(within(dialog).getByRole('link', { name: 'Open article page' })).toBeInTheDocument()
  })

  it('opens an article by its article number (start page links)', async () => {
    resetDb('seeded')
    const r = await loginAs('retailer')
    await screen.findByRole('heading', { name: 'Autumn/Winter 2026' })
    await r.router.navigate({ to: '/products/$id', params: { id: 'MN-1004' } })
    expect(await screen.findByRole('heading', { name: 'High-Rise Straight Selvedge Jeans', level: 1 })).toBeInTheDocument()
  })
})

describe('Appearance editor', () => {
  it('edits colours and start page blocks, previews them and saves a merge patch', async () => {
    resetDb('seeded')
    const r = await loginAs('admin')
    await screen.findByRole('heading', { name: /hello iris/i })
    await r.router.navigate({ to: '/admin/appearance' })
    const primary = await screen.findByRole('textbox', { name: 'Main colour' })
    await r.user.clear(primary)
    await r.user.type(primary, '#7a1f2b')
    expect(screen.getByText('You have unsaved changes.')).toBeInTheDocument()
    // The start page: add a text block, write it, move it to the top.
    await r.router.navigate({ to: '/admin/appearance', search: { tab: 'home' } })
    await r.user.click(await screen.findByRole('button', { name: 'Add a block' }))
    await r.user.click(within(await screen.findByRole('dialog', { name: 'Add a block' })).getByRole('button', { name: /^Text/ }))
    await r.user.click(screen.getByRole('radio', { name: 'English' }))
    const blocks = screen.getByRole('list', { name: 'Blocks of the start page' })
    const last = within(blocks).getAllByRole('listitem').at(-1)!
    await r.user.type(within(last).getByRole('textbox', { name: /^Title/ }), 'Delivery dates')
    for (let i = 0; i < 6; i++) await r.user.click(within(last).getByRole('button', { name: 'Move Text up' }))
    // The preview shows the unsaved text.
    expect(await screen.findByRole('region', { name: 'Preview' })).toBeInTheDocument()
    await r.user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(db().settings.branding?.theme?.colors?.primary).toBe('#7a1f2b'))
    const saved = (db().settings.branding!.home as { blocks: { type: string; title?: Record<string, string> }[] }).blocks
    expect(saved[0]).toMatchObject({ type: 'text', title: { en: 'Delivery dates' } })
    expect(saved).toHaveLength(7)
    expect(db().settings.branding?.accent_color).toBe('#7a1f2b')
    expect(await screen.findByText('Saved')).toBeInTheDocument()
  })

  it('refuses to delete an image that is still used, with an explanation', async () => {
    resetDb('seeded')
    const r = await loginAs('admin')
    await screen.findByRole('heading', { name: /hello iris/i })
    await r.router.navigate({ to: '/admin/appearance', search: { tab: 'images' } })
    const list = await screen.findByRole('list', { name: 'Images' })
    const first = within(list).getAllByRole('listitem')[0]
    // Pretend the editor did not know it is used (another admin changed it meanwhile).
    await r.user.click(within(first).getByRole('button', { name: 'Delete' }))
    await r.user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText(/still used on the login page or the start page/i)).toBeInTheDocument()
    expect(db().images).toHaveLength(7)
  })
})
