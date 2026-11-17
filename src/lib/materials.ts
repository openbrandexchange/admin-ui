// Materials and care as terms (spec 0.3, protocol.md §5.9.1): a stable `code` and its `name`
// per language. The UI matches on codes, shows names, and writes codes only (the node fills
// names, care categories and symbols from the spec's vocabularies).
//
// The canonical materials grammar (spec docs/import-format.md §1.4) is kept for the mock
// node's import and CSV: "outer: 65% cotton, 35% polyamide; lining: 100% polyester (recycled) (post_consumer)".
import type { Care, LocalizedText, Materials } from '../api/types'
import { careCategoryOf, CARE_CATEGORIES, MATERIALS, type CareCategory } from './vocab'

const KEY = /^[a-z][a-z0-9_]{0,63}$/

const normKey = (s: string) => s.trim().toLowerCase().replace(/[\s-]+/g, '_')

export type Term = { code: string; name?: LocalizedText | null }
export type Part = Materials[number]
export type Fibre = Part['fibers'][number]
export type CareEntry = Care[number]

/** A term from a 0.3 node, or a bare 0.2 key. */
const termOf = (v: unknown): Term => (typeof v === 'string' ? { code: v } : (v as Term))

/** Qualifier terms with each code once, the first kept (protocol.md §5.9.1). */
export function uniqueTerms(list: Term[]): Term[] {
  const seen = new Set<string>()
  return list.filter((t) => !!t?.code && !seen.has(t.code) && !!seen.add(t.code))
}

/**
 * One fibre in the 0.3 shape, with `qualifiers` always a list (`[]` when none). Also reads the
 * first 0.3 draft (one `qualifier` or null), the 0.2 shape (`fiber` with the flags `recycled` /
 * `organic`) and the 0.1 keys `recycled_<fibre>` / `organic_<fibre>` (the material with that
 * qualifier, first in the list), so data from an older node or an old demo tab still reads right.
 */
export function normaliseFibre(raw: Fibre): Fibre {
  const old = raw as Fibre & { fiber?: string; recycled?: boolean; organic?: boolean; qualifier?: Term | string | null }
  let material = termOf(old.material ?? old.fiber)
  let qualifiers: Term[] = Array.isArray(old.qualifiers)
    ? old.qualifiers.map(termOf)
    : old.qualifier
      ? [termOf(old.qualifier)]
      : [...(old.organic ? [{ code: 'organic' }] : []), ...(old.recycled ? [{ code: 'recycled' }] : [])]
  const legacy = /^(recycled|organic)_([a-z][a-z0-9_]*)$/.exec(material.code)
  if (legacy) {
    material = { code: legacy[2] }
    qualifiers = [{ code: legacy[1] }, ...qualifiers]
  }
  const { fiber: _f, recycled: _r, organic: _o, qualifier: _q, ...rest } = old
  // A fibre without a percentage (leather on a bag) has `percentage` null (spec 0.3).
  return { ...rest, material, percentage: typeof old.percentage === 'number' ? old.percentage : null, qualifiers: uniqueTerms(qualifiers) }
}

export function normaliseMaterials(m: Materials | null | undefined): Materials | null {
  if (!m?.length) return null
  return m.map((p) => ({ ...p, part: termOf(p.part), fibers: p.fibers.map(normaliseFibre) }))
}

/** Care in the 0.3 shape; the category comes from the vocabulary when the node did not send one. */
export function normaliseCare(c: Care | null | undefined): Care | null {
  if (!c?.length) return null
  return c.map((e) => ({ ...e, category: e.category ?? careCategoryOf(e.code) }))
}

/** Care entries grouped by category in label order; codes without a category come last. */
export function careByCategory(c: Care | null | undefined): { category: CareCategory | null; entries: CareEntry[] }[] {
  const list = normaliseCare(c) ?? []
  const groups: { category: CareCategory | null; entries: CareEntry[] }[] = CARE_CATEGORIES.map((category) => ({ category, entries: list.filter((e) => e.category === category) }))
  groups.push({ category: null, entries: list.filter((e) => !e.category || !(CARE_CATEGORIES as readonly string[]).includes(e.category)) })
  return groups.filter((g) => g.entries.length)
}

/** Care codes in label order (stable within a category): what the form writes. */
export function careInLabelOrder(codes: string[]): string[] {
  const rank = (code: string) => {
    const i = (CARE_CATEGORIES as readonly string[]).indexOf(careCategoryOf(code) ?? '')
    return i < 0 ? CARE_CATEGORIES.length : i
  }
  return codes.map((code, i) => ({ code, i })).sort((a, b) => rank(a.code) - rank(b.code) || a.i - b.i).map((x) => x.code)
}

/** `decimalComma`: "95,5% cotton" split into a fibre of digits only (import-format.md §1.4). */
export type MaterialsParse = { ok: true; value: Materials | null } | { ok: false; error: string; decimalComma?: boolean }

export function parseMaterials(text: string): MaterialsParse {
  const src = text.trim()
  if (!src) return { ok: true, value: null }
  const parts: Materials = []
  for (const rawPart of src.split(';')) {
    if (!rawPart.trim()) continue
    let partCode = 'main'
    let fibres = rawPart
    const colon = rawPart.indexOf(':')
    if (colon >= 0) {
      partCode = normKey(rawPart.slice(0, colon))
      fibres = rawPart.slice(colon + 1)
    }
    if (!KEY.test(partCode)) return { ok: false, error: rawPart.trim() }
    const list: Fibre[] = []
    for (const rawFibre of fibres.split(',')) {
      // The comma separates fibres, so "95,5% cotton" leaves a fibre "95": a decimal comma.
      if (/^\s*\d+\s*$/.test(rawFibre)) return { ok: false, error: rawFibre.trim(), decimalComma: true }
      // fiber := [number "%"] material_code qualifier*   ("leather" has no percentage)
      const m = /^\s*(?:(\d+(?:\.\d+)?)\s*%\s*)?(.+?)\s*$/.exec(rawFibre)
      if (!m) return { ok: false, error: rawFibre.trim() }
      const pct = m[1] === undefined ? null : Number(m[1])
      // "polyester (recycled) (post_consumer)": one code per bracket, any number of brackets.
      const q = /^(.*?)((?:\s*\([^()]*\))*)\s*$/.exec(m[2])!
      const name = q[1]
      const qualifiers = [...q[2].matchAll(/\(([^()]*)\)/g)].map((x) => normKey(x[1]))
      const material = normKey(name)
      if (/[()]/.test(name) || qualifiers.some((c) => !KEY.test(c))) return { ok: false, error: rawFibre.trim() }
      if ((pct !== null && !(pct > 0 && pct <= 100)) || !KEY.test(material)) return { ok: false, error: rawFibre.trim() }
      list.push(normaliseFibre({ material: { code: material }, percentage: pct, qualifiers: qualifiers.map((code) => ({ code })) }))
    }
    parts.push({ part: { code: partCode }, fibers: list })
  }
  return { ok: true, value: parts.length ? parts : null }
}

export function formatMaterials(m: Materials | null | undefined): string {
  const list = normaliseMaterials(m)
  if (!list) return ''
  return list.map((p) => `${p.part.code}: ${p.fibers.map((f) => `${f.percentage == null ? '' : `${f.percentage}% `}${f.material.code}${(f.qualifiers ?? []).map((q) => ` (${q.code})`).join('')}`).join(', ')}`).join('; ')
}

/** Every qualifier code any fibre of any part has (for the portal's filter and facet). */
export function qualifierCodes(m: Materials | null | undefined): string[] {
  return [...new Set((normaliseMaterials(m) ?? []).flatMap((p) => p.fibers.flatMap((f) => (f.qualifiers ?? []).map((q) => q.code))))]
}

/**
 * Part codes whose percentages do not add up to 100 (a warning, not an error): every fibre
 * states one and they do not sum to 100, or the stated ones exceed 100 (import-format.md rule 10).
 */
export function unbalancedParts(m: Materials | null): string[] {
  return (normaliseMaterials(m) ?? [])
    .filter((p) => {
      const stated = p.fibers.filter((f) => f.percentage != null)
      const sum = stated.reduce((s, f) => s + (f.percentage ?? 0), 0)
      return sum > 100.01 || (stated.length === p.fibers.length && Math.abs(sum - 100) > 0.01)
    })
    .map((p) => p.part.code)
}

/** Material codes outside the vocabulary, each once, in order of appearance (warning `material_unknown`). */
export function unknownMaterials(m: Materials | null | undefined): string[] {
  const known = new Set<string>(MATERIALS)
  return [...new Set((normaliseMaterials(m) ?? []).flatMap((p) => p.fibers.map((f) => f.material.code)))].filter((c) => !known.has(c))
}

/**
 * The name of a term in exactly the reader's language (or its base language), or ''.
 * Other languages are left to the caller's fallback, so a bundled translation wins over
 * another language's name.
 */
export function nameIn(name: LocalizedText | null | undefined, lang: string): string {
  if (!name) return ''
  const base = lang.split('-')[0]
  const key = name[lang] !== undefined ? lang : Object.keys(name).find((k) => k.split('-')[0] === base)
  return key ? (name[key] ?? '') : ''
}
