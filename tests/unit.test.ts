import { describe, expect, it } from 'vitest'
import { localized, cleanLocalized, localizedPatch } from '../src/lib/localized'
import { mergePatch } from '../src/mock/mergePatch'
import { csvDelimiter, pickLanguage } from '../src/i18n/languages'
import { formatMaterials, parseMaterials, unbalancedParts } from '../src/lib/materials'
import { formatCertifications, formatFeature, formatFootwear, labelWarnings, measurementsFrom, parseCertifications, parseFeature, parseFootwear } from '../src/lib/article'
import { gtinValid, splitCodes, passwordProblem, slugify, urlProblem, withScheme } from '../src/lib/validate'
import { accentVars, contrast, parseHex } from '../src/lib/accent'
import { countryLanguage } from '../src/lib/countries'
import { fit, planRenditions } from '../src/lib/renditions'
import { automationSnippets } from '../src/lib/snippets'
import { filenameFromDisposition } from '../src/lib/download'
import { parseCsv, parseImageName } from '../src/mock/csv'
import { sinceDays } from '../src/lib/prefs'
import { safeRedirect } from '../src/router'

describe('LocalizedText fallback: user language → en → first available', () => {
  const text = { nl: 'Trui', en: 'Sweater', de: 'Pullover' }
  it('uses the user language', () => expect(localized(text, 'de')).toBe('Pullover'))
  it('falls back to English', () => expect(localized(text, 'fr')).toBe('Sweater'))
  it('falls back to the first language when there is no English', () => expect(localized({ nl: 'Trui', de: 'Pullover' }, 'fr')).toBe('Trui'))
  it('serves a regional tag to its base language', () => expect(localized({ 'de-CH': 'Pulli', en: 'Sweater' }, 'de')).toBe('Pulli'))
  it('handles empty values', () => {
    expect(localized(null, 'en')).toBe('')
    expect(cleanLocalized({ nl: ' ', en: 'x ' })).toEqual({ en: 'x' })
    expect(cleanLocalized({ nl: '' })).toBeNull()
  })
})

describe('website addresses typed without https://', () => {
  it('adds https:// to a bare domain', () => expect(withScheme(' www.kestrel.example ')).toBe('https://www.kestrel.example'))
  it('keeps an address that has a scheme', () => {
    expect(withScheme('http://shop.example/nl')).toBe('http://shop.example/nl')
    expect(withScheme('HTTPS://Shop.example')).toBe('HTTPS://Shop.example')
  })
  it('leaves an empty field empty', () => expect(withScheme('  ')).toBe(''))
  it('makes a bare domain pass the address check', () => expect(urlProblem(withScheme('kestrel.example'))).toBeNull())
})

describe('language detection', () => {
  it('picks the first supported browser language', () => expect(pickLanguage(['ja', 'nl-BE', 'en'])).toBe('nl'))
  it('maps Norwegian variants to Bokmål', () => expect(pickLanguage(['nn-NO'])).toBe('nb'))
  it('defaults to English', () => expect(pickLanguage(['ja', 'zh'])).toBe('en'))
  it('uses semicolons for Excel in most European locales', () => {
    expect(csvDelimiter('nl')).toBe('semicolon')
    expect(csvDelimiter('en')).toBe('comma')
  })
})

describe('materials grammar', () => {
  it('parses parts and fibres', () => {
    const r = parseMaterials('Outer: 65% Cotton, 35% polyamide; lining: 100% polyester')
    expect(r).toEqual({ ok: true, value: [{ part: 'outer', fibers: [{ fiber: 'cotton', percentage: 65 }, { fiber: 'polyamide', percentage: 35 }] }, { part: 'lining', fibers: [{ fiber: 'polyester', percentage: 100 }] }] })
  })
  it('defaults the part to main and round-trips', () => {
    const r = parseMaterials('100% cotton (organic)')
    expect(r).toEqual({ ok: true, value: [{ part: 'main', fibers: [{ fiber: 'cotton', percentage: 100, organic: true }] }] })
    expect(r.ok && formatMaterials(r.value)).toBe('main: 100% cotton (organic)')
  })
  it('reads the recycled and organic flags', () => {
    const r = parseMaterials('outer: 100% polyester (recycled); lining: 50% Cotton (Organic) (recycled), 50% polyamide')
    expect(r.ok && r.value).toEqual([
      { part: 'outer', fibers: [{ fiber: 'polyester', percentage: 100, recycled: true }] },
      { part: 'lining', fibers: [{ fiber: 'cotton', percentage: 50, organic: true, recycled: true }, { fiber: 'polyamide', percentage: 50 }] },
    ])
  })
  it('normalises the 0.1 keys recycled_* and organic_* to the fibre with a flag', () => {
    const a = parseMaterials('100% recycled_polyester')
    const b = parseMaterials('100% polyester (recycled)')
    expect(a).toEqual(b)
    expect(formatMaterials([{ part: 'main', fibers: [{ fiber: 'organic_cotton', percentage: 100 }] }])).toBe('main: 100% cotton (organic)')
  })
  it('reports what it cannot read', () => expect(parseMaterials('cotton')).toEqual({ ok: false, error: 'cotton' }))
  it('warns when a part does not add up to 100', () => {
    const r = parseMaterials('90% wool')
    expect(r.ok && unbalancedParts(r.value)).toEqual(['main'])
  })
})

describe('article data cells (import-format.md §1.6)', () => {
  it('reads footwear materials, with parts not stated as null', () => {
    expect(parseFootwear('upper: Leather; lining_and_sock: textile')).toEqual({ ok: true, value: { upper: 'leather', lining_and_sock: 'textile', outer_sole: null } })
    expect(parseFootwear('upper: cardboard').ok).toBe(false)
    expect(formatFootwear({ upper: 'leather', lining_and_sock: 'leather', outer_sole: 'other' })).toBe('upper: leather; lining_and_sock: leather; outer_sole: other')
  })
  it('reads certifications with licence numbers that contain spaces and an optional scope', () => {
    const r = parseCertifications('GOTS:CU 123456; rws:CU 200101 (material); bluesign')
    expect(r).toEqual({ ok: true, value: [{ scheme: 'gots', licence_number: 'CU 123456', scope: 'product' }, { scheme: 'rws', licence_number: 'CU 200101', scope: 'material' }, { scheme: 'bluesign', licence_number: null, scope: 'product' }] })
    expect(r.ok && formatCertifications(r.value)).toBe('gots:CU 123456; rws:CU 200101 (material); bluesign')
  })
  it('reads measurements with a decimal comma and a strap range', () => {
    expect(measurementsFrom({ weight_kg: '2,6', strap_length_cm: '80-130', height_cm: '' })).toEqual({ ok: true, value: { weight_kg: 2.6, strap_length_cm: { min: 80, max: 130 } } })
    expect(measurementsFrom({ strap_length_cm: '120' })).toEqual({ ok: true, value: { strap_length_cm: { min: 120, max: 120 } } })
    expect(measurementsFrom({ weight_kg: '2.6 kg' })).toEqual({ ok: false, key: 'weight_kg' })
    expect(measurementsFrom({})).toEqual({ ok: true, value: null })
  })
  it('checks registry features by type and keeps unknown keys as text', () => {
    expect(parseFeature('wheels', '4')).toBe(4)
    expect(parseFeature('wheels', '3')).toBeUndefined()
    expect(parseFeature('expandable', 'yes')).toBe(true)
    expect(parseFeature('lock', 'TSA combination')).toBe('tsa_combination')
    expect(parseFeature('detachable_parts', 'shoulder_strap|lining|lining')).toEqual(['shoulder_strap', 'lining'])
    expect(parseFeature('handle_colour', 'Tan')).toBe('Tan')
    expect(formatFeature(['shoulder_strap', 'lining'])).toBe('shoulder_strap|lining')
  })
})

describe('label completeness warnings (import-format.md rule 10)', () => {
  it('gives the warnings of the spec test file', () => {
    expect(labelWarnings({ item_type: 't_shirt', materials: null, contains_animal_origin: false }).map((w) => w.code)).toEqual(['fibre_composition_missing'])
    expect(labelWarnings({ item_type: 'scarf', materials: [{ part: 'main', fibers: [{ fiber: 'wool', percentage: 100 }] }] }).map((w) => w.code)).toEqual(['animal_origin_unknown'])
    expect(labelWarnings({ item_type: 'sneakers', materials: [{ part: 'upper', fibers: [{ fiber: 'polyester', percentage: 100 }] }] }).map((w) => w.code)).toEqual(['footwear_materials_missing'])
    expect(labelWarnings({ item_type: 'shirt', materials: [{ part: 'main', fibers: [{ fiber: 'cotton', percentage: 60 }, { fiber: 'polyester', percentage: 30 }] }], contains_animal_origin: false })).toEqual([{ code: 'fibre_percentages_not_100', column: 'materials', part: 'main' }])
    expect(labelWarnings({ item_type: 'sandals', footwear_materials: { upper: 'leather', lining_and_sock: 'leather', outer_sole: null } }).map((w) => w.code)).toEqual(['footwear_materials_missing'])
    expect(labelWarnings({ item_type: 't_shirt', materials: [{ part: 'main', fibers: [{ fiber: 'cotton', percentage: 100 }] }], contains_animal_origin: false })).toEqual([])
  })
  it('gives no label warnings for other item types', () => expect(labelWarnings({ item_type: 'jewelry', materials: null })).toEqual([]))
})

describe('codes and validation', () => {
  it('checks GTIN check digits', () => {
    expect(gtinValid('2000100101018')).toBe(true)
    expect(gtinValid('2000100101019')).toBe(false)
    expect(gtinValid('123')).toBe(false)
  })
  it('splits pasted EAN lists on anything that is not a digit', () => expect(splitCodes('2000100101018\n2000100101025; 2000100101032,x')).toEqual(['2000100101018', '2000100101025', '2000100101032']))
  it('enforces 10–72 character passwords', () => {
    expect(passwordProblem('short')).toBe('validate.passwordShort')
    expect(passwordProblem('a'.repeat(73))).toBe('validate.passwordLong')
    expect(passwordProblem('correct horse battery')).toBeNull()
  })
  it('slugs brand names', () => expect(slugify('Kestrel Trail Ñ')).toBe('kestrel-trail-n'))
  it('only follows same-site redirects after login', () => {
    expect(safeRedirect('/admin/catalog')).toBe('/admin/catalog')
    expect(safeRedirect('//evil.example')).toBeUndefined()
    expect(safeRedirect('https://evil.example')).toBeUndefined()
  })
})

describe('language of a shop', () => {
  it('comes from its country, else the fallback', () => {
    expect(countryLanguage('AT', 'en')).toBe('de')
    expect(countryLanguage('be', 'en')).toBe('nl')
    expect(countryLanguage('JP', 'fr')).toBe('fr')
    expect(countryLanguage(null, 'nl')).toBe('nl')
  })
})

describe('brand accent colour', () => {
  it('keeps text on the accent readable (WCAG 4.5:1)', () => {
    for (const hex of ['#ffff00', '#1f4e5f', '#f5f5f5', '#ff7f50', '#00ff00']) {
      const v = accentVars(hex)
      expect(contrast(parseHex(v['--accent'])!, parseHex(v['--accent-contrast'])!)).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('client-side renditions', () => {
  it('never upscales and keeps the aspect ratio', () => {
    expect(fit({ width: 800, height: 600 }, 2000)).toEqual({ width: 800, height: 600 })
    expect(fit({ width: 2400, height: 3000 }, 2000)).toEqual({ width: 1600, height: 2000 })
  })
  it('plans web ≤2000, square around web and thumb ≤600', () => {
    const p = planRenditions({ width: 2400, height: 3000 })
    expect(p.web).toEqual({ width: 1600, height: 2000 })
    expect(p.square).toMatchObject({ width: 2000, height: 2000, offsetX: 200, offsetY: 0 })
    expect(p.thumb).toEqual({ width: 480, height: 600 })
  })
})

describe('automation recipes', () => {
  it('fill in the portal address and the token', () => {
    const s = automationSnippets('https://brands.kestrel.example/', 'obxi_secret')
    const cli = s.find((x) => x.id === 'cli')!.code
    expect(cli).toContain('OBX_URL=https://brands.kestrel.example\n')
    expect(cli).toContain('OBX_TOKEN=obxi_secret')
    expect(s.find((x) => x.id === 'curl')!.code).toContain('https://brands.kestrel.example/obx/v1/ingest/imports')
  })
  it('never invent a token', () => expect(automationSnippets('https://x.example').every((s) => !/obxi_[A-Za-z0-9]/.test(s.code))).toBe(true))
})

describe('helpers', () => {
  it('reads download names from Content-Disposition', () => {
    expect(filenameFromDisposition(`attachment; filename*=UTF-8''KO-1001%20NVY.zip`, 'x')).toBe('KO-1001 NVY.zip')
    expect(filenameFromDisposition('attachment; filename="a.csv"', 'x')).toBe('a.csv')
    expect(filenameFromDisposition(null, 'x')).toBe('x')
  })
  it('makes "new since" stable within a day', () => {
    const t = Date.UTC(2026, 8, 28, 15, 30)
    expect(sinceDays(7, t)).toBe('2026-09-21T00:00:00Z')
  })
  it('parses canonical image names from the right', () => {
    expect(parseImageName('KO-1001_NVY_2_back.jpg')).toMatchObject({ style: 'KO-1001', color: 'NVY', position: 2, role: 'packshot', view: 'back' })
    expect(parseImageName('AB_12_34_BLK_2_packshot_back.JPG')).toMatchObject({ style: 'AB_12_34', color: 'BLK', position: 2 })
    expect(parseImageName('KO-1004_IND_3_detail.jpg')).toMatchObject({ role: 'detail', view: 'detail' })
    expect(parseImageName('KO-1001_NVY_front.jpg')).toBeNull()
  })
  it('parses CSV with quotes and semicolons', () => expect(parseCsv('a;b\n"x;1";"he said ""hi"""\n')).toEqual([['a', 'b'], ['x;1', 'he said "hi"']]))
})

describe('translation keys with a colon', () => {
  it('resolves scope labels such as tokens.scope.ingest:read', async () => {
    const { initI18n, i18next } = await import('../src/i18n')
    await initI18n('en')
    expect(i18next.t('tokens.scope.ingest:read')).toBe('read what is published')
  })
})

describe('JSON merge patch (RFC 7396) as nodes apply it', () => {
  it('merges objects member by member and removes members set to null', () => {
    expect(mergePatch({ a: { en: 'x', nl: 'y' }, b: 1 }, { a: { en: null, de: 'z' } })).toEqual({ a: { nl: 'y', de: 'z' }, b: 1 })
  })
  it('replaces arrays and the named wholesale members', () => {
    expect(mergePatch({ list: [1, 2], files: { web: 1, thumb: 2 } }, { list: [3], files: { web: 9 } }, ['files'])).toEqual({ list: [3], files: { web: 9 } })
  })
})

describe('LocalizedText in a merge patch', () => {
  it('sends null for a language that was cleared', () => expect(localizedPatch({ en: 'a', nl: 'b' }, { en: '', nl: 'c' })).toEqual({ en: null, nl: 'c' }))
  it('sends null for the whole text when everything was cleared', () => expect(localizedPatch({ en: 'a' }, { en: ' ' })).toBeNull())
  it('sends just the texts when nothing was there before', () => expect(localizedPatch(null, { de: 'x' })).toEqual({ de: 'x' }))
})
