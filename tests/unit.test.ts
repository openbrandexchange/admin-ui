import { describe, expect, it } from 'vitest'
import { localized, cleanLocalized, localizedPatch } from '../src/lib/localized'
import { mergePatch } from '../src/mock/mergePatch'
import { csvDelimiter, pickLanguage } from '../src/i18n/languages'
import type { Materials } from '../src/api/types'
import { careByCategory, careInLabelOrder, formatMaterials, nameIn, normaliseMaterials, parseMaterials, unbalancedParts } from '../src/lib/materials'
import { CARE_CODES, careCategoryOf, MATERIALS, PARTS, QUALIFIERS } from '../src/lib/vocab'
import { withTermNames } from '../src/mock/terms'
import careVocab from '../src/mock/fixtures/vocabularies/care.json'
import materialsVocab from '../src/mock/fixtures/vocabularies/materials.json'
import partsVocab from '../src/mock/fixtures/vocabularies/parts.json'
import qualifiersVocab from '../src/mock/fixtures/vocabularies/qualifiers.json'
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

const m = (code: string) => ({ code })
const fibre = (material: string, percentage: number, qualifier: string | null = null) => ({ material: m(material), percentage, qualifier: qualifier ? m(qualifier) : null })

describe('materials grammar', () => {
  it('parses parts and fibres into terms', () => {
    const r = parseMaterials('Outer: 65% Cotton, 35% polyamide; lining: 100% polyester')
    expect(r).toEqual({ ok: true, value: [{ part: m('outer'), fibers: [fibre('cotton', 65), fibre('polyamide', 35)] }, { part: m('lining'), fibers: [fibre('polyester', 100)] }] })
  })
  it('defaults the part to main and round-trips', () => {
    const r = parseMaterials('100% cotton (organic)')
    expect(r).toEqual({ ok: true, value: [{ part: m('main'), fibers: [fibre('cotton', 100, 'organic')] }] })
    expect(r.ok && formatMaterials(r.value)).toBe('main: 100% cotton (organic)')
  })
  it('reads one qualifier per fibre, any code', () => {
    const r = parseMaterials('outer: 100% polyester (recycled); lining: 50% Cotton (Regenerative), 50% wool (Responsible Down)')
    expect(r.ok && r.value).toEqual([
      { part: m('outer'), fibers: [fibre('polyester', 100, 'recycled')] },
      { part: m('lining'), fibers: [fibre('cotton', 50, 'regenerative'), fibre('wool', 50, 'responsible_down')] },
    ])
    expect(parseMaterials('100% cotton (organic) (recycled)')).toEqual({ ok: false, error: '100% cotton (organic) (recycled)' })
  })
  it('normalises the 0.1 keys and the 0.2 flags to the material with a qualifier', () => {
    expect(parseMaterials('100% recycled_polyester')).toEqual(parseMaterials('100% polyester (recycled)'))
    const old = [{ part: 'main', fibers: [{ fiber: 'organic_cotton', percentage: 90 }, { fiber: 'polyamide', percentage: 10, recycled: true }] }] as unknown as Materials
    expect(normaliseMaterials(old)).toEqual([{ part: m('main'), fibers: [fibre('cotton', 90, 'organic'), fibre('polyamide', 10, 'recycled')] }])
    expect(formatMaterials(old)).toBe('main: 90% cotton (organic), 10% polyamide (recycled)')
  })
  it('reports what it cannot read', () => expect(parseMaterials('cotton')).toEqual({ ok: false, error: 'cotton' }))
  it('warns when a part does not add up to 100', () => {
    const r = parseMaterials('90% wool')
    expect(r.ok && unbalancedParts(r.value)).toEqual(['main'])
  })
  it('takes a name only in the reader\'s language (or its base language)', () => {
    expect(nameIn({ en: 'Cotton', nl: 'Katoen' }, 'nl')).toBe('Katoen')
    expect(nameIn({ en: 'Cotton', 'de-CH': 'Baumwolle' }, 'de')).toBe('Baumwolle')
    expect(nameIn({ en: 'Cotton' }, 'pl')).toBe('')
    expect(nameIn(null, 'en')).toBe('')
  })
})

describe('care (spec 0.3)', () => {
  it('groups care by category in label order, codes outside the vocabulary last', () => {
    const groups = careByCategory([{ code: 'iron_low' }, { code: 'wash_30' }, { code: 'steam_only', category: null }, { code: 'tumble_dry_low' }, { code: 'dry_flat' }])
    expect(groups.map((g) => [g.category, g.entries.map((e) => e.code)])).toEqual([
      ['washing', ['wash_30']],
      ['drying', ['tumble_dry_low', 'dry_flat']],
      ['ironing', ['iron_low']],
      [null, ['steam_only']],
    ])
  })
  it('writes care codes in label order', () => expect(careInLabelOrder(['iron_low', 'do_not_bleach', 'wash_30', 'custom', 'dry_flat', 'tumble_dry_low'])).toEqual(['wash_30', 'do_not_bleach', 'dry_flat', 'tumble_dry_low', 'iron_low', 'custom']))
  it('knows the category of every vocabulary code', () => expect(CARE_CODES.filter((c) => !careCategoryOf(c))).toEqual([]))
})

describe('vocabularies (spec vocabularies/*.json, copied by sync-fixtures)', () => {
  const codes = (v: { entries: { code: string }[] }) => v.entries.map((e) => e.code).sort()
  it('offers exactly the spec codes', () => {
    expect([...PARTS].sort()).toEqual(codes(partsVocab))
    expect([...MATERIALS].sort()).toEqual(codes(materialsVocab))
    expect([...QUALIFIERS].sort()).toEqual(codes(qualifiersVocab))
    expect([...CARE_CODES].sort()).toEqual(codes(careVocab))
  })
  it('puts every care code in the spec category', () => {
    for (const e of careVocab.entries) expect(careCategoryOf(e.code), e.code).toBe(e.category)
  })
  it('lets the mock node answer with names, categories and symbols, keeping unknown codes', () => {
    const p = withTermNames({ materials: [{ part: m('main'), fibers: [fibre('cotton', 95, 'organic'), { material: { code: 'kapok', name: { en: 'Kapok' } }, percentage: 5 }] }], care: [{ code: 'wash_30' }, { code: 'steam_only' }] })
    expect(p.materials).toEqual([
      {
        part: { code: 'main', name: null },
        fibers: [
          { material: { code: 'cotton', name: { en: 'Cotton', nl: 'Katoen', de: 'Baumwolle', fr: 'Coton' } }, percentage: 95, qualifier: { code: 'organic', name: { en: 'Organic', nl: 'Biologisch', de: 'Bio', fr: 'Biologique' } } },
          { material: { code: 'kapok', name: { en: 'Kapok' } }, percentage: 5, qualifier: null },
        ],
      },
    ])
    expect(p.care).toEqual([
      { code: 'wash_30', category: 'washing', symbol: '1_D_30', name: { en: 'Wash at 30 °C', nl: 'Wassen op 30 °C', de: 'Waschen bei 30 °C', fr: 'Lavage à 30 °C' }, text: null },
      { code: 'steam_only', category: null, symbol: null, name: null, text: null },
    ])
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
    expect(labelWarnings({ item_type: 'scarf', materials: [{ part: m('main'), fibers: [fibre('wool', 100)] }] }).map((w) => w.code)).toEqual(['animal_origin_unknown'])
    expect(labelWarnings({ item_type: 'sneakers', materials: [{ part: m('upper'), fibers: [fibre('polyester', 100)] }] }).map((w) => w.code)).toEqual(['footwear_materials_missing'])
    expect(labelWarnings({ item_type: 'shirt', materials: [{ part: m('main'), fibers: [fibre('cotton', 60), fibre('polyester', 30)] }], contains_animal_origin: false })).toEqual([{ code: 'fibre_percentages_not_100', column: 'materials', part: 'main' }])
    expect(labelWarnings({ item_type: 'sandals', footwear_materials: { upper: 'leather', lining_and_sock: 'leather', outer_sole: null } }).map((w) => w.code)).toEqual(['footwear_materials_missing'])
    expect(labelWarnings({ item_type: 't_shirt', materials: [{ part: m('main'), fibers: [fibre('cotton', 100)] }], contains_animal_origin: false })).toEqual([])
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
