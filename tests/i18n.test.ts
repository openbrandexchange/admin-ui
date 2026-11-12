// Every UI language must be complete: same keys as English (with the plural forms that
// language needs), the same {{placeholders}}, and the glossary words the whole project uses.
import { describe, expect, it } from 'vitest'
import { LANGUAGES } from '../src/i18n/languages'
import { ALL_ITEM_SUBTYPES, CARE_CODES, CHANNELS, COLOUR_FAMILIES, FEATURES, FOOTWEAR_MATERIALS, FOOTWEAR_PARTS, ITEM_TYPES, MATERIALS, MEASUREMENTS, PARTS, QUALIFIERS, ROLES, TARGET_GROUPS, VIEWS, WARNING_CODES } from '../src/lib/vocab'
import glossary from '../src/i18n/glossary.json'

const files = import.meta.glob<Record<string, unknown>>('../src/locales/*.json', { eager: true, import: 'default' })
const locales = Object.fromEntries(Object.entries(files).map(([p, v]) => [p.match(/(\w+)\.json$/)![1], v]))

type Flat = Record<string, string>
function flatten(o: unknown, prefix = '', out: Flat = {}): Flat {
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object') flatten(v, key, out)
    else out[key] = String(v)
  }
  return out
}

const PLURAL = /_(zero|one|two|few|many|other)$/
const en = flatten(locales.en)
const pluralBases = new Set(Object.keys(en).filter((k) => PLURAL.test(k)).map((k) => k.replace(PLURAL, '')))
const plainKeys = Object.keys(en).filter((k) => !PLURAL.test(k))
const placeholders = (s: string) => [...s.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort()

/** Plural categories a language actually uses for whole numbers (counts). */
function integerCategories(lang: string) {
  const pr = new Intl.PluralRules(lang)
  const out = new Set<string>()
  for (let n = 0; n <= 1000; n++) out.add(pr.select(n))
  return [...out]
}

describe('UI languages', () => {
  it('ships all 25 languages', () => {
    expect(Object.keys(locales).sort()).toEqual(LANGUAGES.map((l) => l.code).sort())
  })

  describe.each(LANGUAGES.map((l) => l.code))('%s', (lang) => {
    const flat = flatten(locales[lang] ?? {})

    it('has every English key, and nothing else', () => {
      const missing = plainKeys.filter((k) => !flat[k]?.trim())
      expect(missing).toEqual([])
      const extra = Object.keys(flat).filter((k) => !(k in en) && !(PLURAL.test(k) && pluralBases.has(k.replace(PLURAL, ''))))
      expect(extra).toEqual([])
    })

    it('has every plural form the language needs', () => {
      const missing: string[] = []
      for (const base of pluralBases) for (const cat of integerCategories(lang)) if (!flat[`${base}_${cat}`]?.trim()) missing.push(`${base}_${cat}`)
      expect(missing).toEqual([])
    })

    it('keeps the placeholders', () => {
      const wrong: string[] = []
      for (const [k, v] of Object.entries(flat)) {
        const ref = en[k] ?? en[k.replace(PLURAL, '_other')]
        if (ref === undefined) continue
        const want = placeholders(ref).filter((p) => p !== 'count')
        const got = placeholders(v).filter((p) => p !== 'count')
        if (JSON.stringify([...new Set(want)]) !== JSON.stringify([...new Set(got)])) wrong.push(`${k}: ${v}`)
      }
      expect(wrong).toEqual([])
    })

    it('uses the project glossary', () => {
      for (const [term, perLang] of Object.entries(glossary.terms)) expect(flat[`glossary.${term}`], term).toBe((perLang as Record<string, string>)[lang])
    })
  })
})

describe('labels for every stable key', () => {
  const families: [string, readonly string[]][] = [
    ['enum.role', ROLES],
    ['enum.view', VIEWS],
    ['enum.channel', CHANNELS],
    ['enum.targetGroup', TARGET_GROUPS],
    ['enum.itemType', ITEM_TYPES],
    ['enum.part', PARTS],
    ['enum.fibre', MATERIALS],
    ['enum.qualifier', QUALIFIERS],
    ['enum.care', CARE_CODES],
    ['enum.itemSubtype', ALL_ITEM_SUBTYPES],
    ['enum.footwearMaterial', FOOTWEAR_MATERIALS],
    ['enum.colourFamily', COLOUR_FAMILIES],
    ['article.footwearPart', FOOTWEAR_PARTS],
    ['article.feature', Object.keys(FEATURES)],
    ['product.measure', MEASUREMENTS],
    ['importErrors', WARNING_CODES],
    ['labelWarning', WARNING_CODES.flatMap((c) => [`${c}.why`, `${c}.law`])],
    ...Object.entries(FEATURES)
      .filter(([, def]) => def.type === 'enum' || def.type === 'list')
      .map(([key, def]) => [`enum.feature.${key}`, (def as { values: readonly string[] }).values] as [string, readonly string[]]),
  ]
  it.each(families)('%s', (prefix, keys) => {
    expect(keys.filter((k) => !en[`${prefix}.${k}`])).toEqual([])
  })

  it('has a message for every OBX error code', () => {
    const codes = ['invalid_request', 'validation_failed', 'unauthorized', 'invalid_token', 'access_revoked', 'insufficient_scope', 'forbidden', 'not_found', 'method_not_allowed', 'conflict', 'precondition_failed', 'payload_too_large', 'unsupported_media_type', 'rate_limited', 'limit_exceeded', 'cursor_invalid', 'cursor_expired', 'export_expired', 'original_not_allowed', 'invalid_gtin', 'gtin_conflict', 'position_conflict', 'checksum_mismatch', 'blob_missing', 'upload_incomplete', 'unknown_parent', 'files_missing', 'import_invalid', 'mass_unpublish_refused', 'workbook_invalid', 'workbook_unsafe', 'workbook_sheet_missing', 'workbook_too_large', 'unsafe_url', 'csrf_failed', 'invalid_credentials', 'account_blocked', 'setup_required', 'setup_completed', 'invite_invalid', 'not_implemented', 'internal_error', 'service_unavailable']
    expect(codes.filter((c) => !en[`errors.${c}`])).toEqual([])
  })

  it('ships the e-mails nodes send', () => {
    for (const mail of ['invite', 'accessRequestReceived', 'accessRequestNew', 'accessApproved', 'accessRejected', 'zipReady', 'passwordReset']) expect(en[`email.${mail}.subject`], mail).toBeTruthy()
  })

  it('never shows protocol words to users', () => {
    const banned = /\b(tombstone|cursor|grant|ingest|node)\b/i
    const offenders = Object.entries(en).filter(([k, v]) => !k.startsWith('tokens.scope') && banned.test(v.replace(/ingest:\w+/g, '')))
    expect(offenders).toEqual([])
  })
})
