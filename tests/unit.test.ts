import { describe, expect, it } from 'vitest'
import { localized, cleanLocalized, localizedPatch } from '../src/lib/localized'
import { mergePatch } from '../src/mock/mergePatch'
import { csvDelimiter, pickLanguage } from '../src/i18n/languages'
import { formatMaterials, parseMaterials, unbalancedParts } from '../src/lib/materials'
import { gtinValid, splitCodes, passwordProblem, slugify } from '../src/lib/validate'
import { accentVars, contrast, parseHex } from '../src/lib/accent'
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
    const r = parseMaterials('100% organic cotton')
    expect(r.ok && formatMaterials(r.value)).toBe('main: 100% organic_cotton')
  })
  it('reports what it cannot read', () => expect(parseMaterials('cotton')).toEqual({ ok: false, error: 'cotton' }))
  it('warns when a part does not add up to 100', () => {
    const r = parseMaterials('90% wool')
    expect(r.ok && unbalancedParts(r.value)).toEqual(['main'])
  })
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
