// Article data of spec 0.2 (protocol.md §5.9): the label completeness rules and the plain
// cell grammars of the import format (import-format.md §1.6), shared by the admin screens,
// the portal and the mock node.
import type { Measurements, ProductInput } from '../api/types'
import { normaliseMaterials, unbalancedParts } from './materials'
import { FEATURES, FOOTWEAR_ITEM_TYPES, FOOTWEAR_MATERIALS, FOOTWEAR_PARTS, MEASUREMENTS, TEXTILE_ITEM_TYPES, type MeasurementKey, type WarningCodeKey } from './vocab'

export type FootwearMaterials = NonNullable<ProductInput['footwear_materials']>
export type Certifications = NonNullable<ProductInput['certifications']>

export interface LabelWarning {
  code: WarningCodeKey
  column: 'materials' | 'contains_animal_origin' | 'footwear_materials'
  /** For fibre_percentages_not_100: the part whose percentages do not add up. */
  part?: string
}

/** Fibres of animal origin that make the brand state contains_animal_origin (rule 10). */
const ANIMAL = /^(leather|suede|fur|down|feather|silk|wool|merino_wool|lambswool|cashmere|alpaca|mohair|.*_wool)$/

type LabelFields = Pick<ProductInput, 'item_type' | 'materials' | 'contains_animal_origin' | 'footwear_materials'>

/**
 * What a consumer label would miss (import-format.md rule 10). Warnings, never errors: they
 * do not block an import or publishing.
 */
export function labelWarnings(p: LabelFields): LabelWarning[] {
  const type = p.item_type ?? ''
  const out: LabelWarning[] = []
  const materials = normaliseMaterials(p.materials)
  if ((TEXTILE_ITEM_TYPES as readonly string[]).includes(type)) {
    if (!materials) out.push({ code: 'fibre_composition_missing', column: 'materials' })
    else if (p.contains_animal_origin == null && materials.some((m) => m.fibers.some((f) => ANIMAL.test(f.fiber)))) out.push({ code: 'animal_origin_unknown', column: 'contains_animal_origin' })
  }
  if ((FOOTWEAR_ITEM_TYPES as readonly string[]).includes(type)) {
    const fm = p.footwear_materials
    if (!fm || FOOTWEAR_PARTS.some((k) => !fm[k])) out.push({ code: 'footwear_materials_missing', column: 'footwear_materials' })
  }
  for (const part of unbalancedParts(materials)) out.push({ code: 'fibre_percentages_not_100', column: 'materials', part })
  return out
}

// ---------------------------------------------------------------- cell grammars (§1.6)

const norm = (s: string) => s.trim().toLowerCase().replace(/[\s-]+/g, '_')

type Parsed<T> = { ok: true; value: T | null } | { ok: false; error: string }

/** `upper: leather; lining_and_sock: textile; outer_sole: other` */
export function parseFootwear(cell: string): Parsed<FootwearMaterials> {
  if (!cell.trim()) return { ok: true, value: null }
  const out: Record<string, string | null> = { upper: null, lining_and_sock: null, outer_sole: null }
  for (const raw of cell.split(';')) {
    if (!raw.trim()) continue
    const i = raw.indexOf(':')
    const part = norm(i < 0 ? raw : raw.slice(0, i))
    const value = norm(i < 0 ? '' : raw.slice(i + 1))
    if (!(FOOTWEAR_PARTS as readonly string[]).includes(part) || !(FOOTWEAR_MATERIALS as readonly string[]).includes(value)) return { ok: false, error: raw.trim() }
    out[part] = value
  }
  return { ok: true, value: out as FootwearMaterials }
}

export function formatFootwear(fm: FootwearMaterials | null | undefined): string {
  if (!fm) return ''
  return FOOTWEAR_PARTS.filter((k) => fm[k]).map((k) => `${k}: ${fm[k]}`).join('; ')
}

/** `gots:CU 123456; rws:CU 123456 (material)` */
export function parseCertifications(cell: string): Parsed<Certifications> {
  if (!cell.trim()) return { ok: true, value: null }
  const out: Certifications = []
  for (const raw of cell.split(';')) {
    let entry = raw.trim()
    if (!entry) continue
    let scope: 'product' | 'material' = 'product'
    const s = /\s*\((material|product)\)\s*$/i.exec(entry)
    if (s) {
      scope = s[1].toLowerCase() as 'product' | 'material'
      entry = entry.slice(0, s.index)
    }
    const i = entry.indexOf(':')
    const scheme = norm(i < 0 ? entry : entry.slice(0, i))
    const licence = i < 0 ? '' : entry.slice(i + 1).trim()
    if (!/^[a-z][a-z0-9_]{0,63}$/.test(scheme)) return { ok: false, error: raw.trim() }
    out.push({ scheme, licence_number: licence || null, scope })
  }
  return { ok: true, value: out.length ? out : null }
}

export function formatCertifications(c: Certifications | null | undefined): string {
  if (!c?.length) return ''
  return c.map((x) => `${x.scheme}${x.licence_number ? `:${x.licence_number}` : ''}${x.scope === 'material' ? ' (material)' : ''}`).join('; ')
}

/** A positive number with `.` or `,` as decimal separator, no unit. */
export function parseNumber(cell: string): number | null | undefined {
  const s = cell.trim()
  if (!s) return null
  if (!/^\d+(?:[.,]\d+)?$/.test(s)) return undefined
  const n = Number(s.replace(',', '.'))
  return n > 0 ? n : undefined
}

/** `80-130`, or one number for a strap that cannot be adjusted. */
export function parseStrap(cell: string): { min: number; max: number } | null | undefined {
  const s = cell.trim()
  if (!s) return null
  const m = /^(\d+(?:[.,]\d+)?)\s*(?:[-–]\s*(\d+(?:[.,]\d+)?))?$/.exec(s)
  if (!m) return undefined
  const min = Number(m[1].replace(',', '.'))
  const max = m[2] ? Number(m[2].replace(',', '.')) : min
  return min > 0 && max >= min ? { min, max } : undefined
}

export function formatMeasurement(m: Measurements | null | undefined, key: MeasurementKey): string {
  const v = m?.[key]
  if (v == null) return ''
  if (key === 'strap_length_cm') {
    const s = v as { min: number; max: number }
    return s.min === s.max ? String(s.min) : `${s.min}-${s.max}`
  }
  return String(v)
}

/** Measurement cells of a form or a CSV row → Measurements (null when none), or the first bad key. */
export function measurementsFrom(cells: Partial<Record<MeasurementKey, string>>): { ok: true; value: Measurements | null } | { ok: false; key: MeasurementKey } {
  const out: Record<string, unknown> = {}
  for (const key of MEASUREMENTS) {
    const cell = cells[key] ?? ''
    const v = key === 'strap_length_cm' ? parseStrap(cell) : parseNumber(cell)
    if (v === undefined) return { ok: false, key }
    if (v !== null) out[key] = v
  }
  return { ok: true, value: Object.keys(out).length ? (out as Measurements) : null }
}

export type FeatureValue = string | number | boolean | (string | number | boolean)[]

const YES = /^(true|yes|y|ja|oui|1)$/i
const NO = /^(false|no|n|nee|nein|non|0)$/i

/**
 * One `feature:<key>` cell. Registry keys are checked against their type and values
 * (undefined = not accepted); other keys keep the cell as a string.
 */
export function parseFeature(key: string, cell: string): FeatureValue | null | undefined {
  const s = cell.trim()
  if (!s) return null
  const def = (FEATURES as Record<string, { type: string; values?: readonly (string | number)[] }>)[key]
  if (!def) return s
  if (def.type === 'boolean') return YES.test(s) ? true : NO.test(s) ? false : undefined
  if (def.type === 'integer') {
    const n = /^\d+$/.test(s) ? Number(s) : NaN
    return def.values!.includes(n) ? n : undefined
  }
  if (def.type === 'list') {
    const list = [...new Set(s.split('|').map(norm).filter(Boolean))]
    return list.every((v) => def.values!.includes(v)) ? list : undefined
  }
  const v = norm(s)
  return def.values!.includes(v) ? v : undefined
}

export function formatFeature(v: FeatureValue | null | undefined): string {
  if (v == null) return ''
  if (Array.isArray(v)) return v.join('|')
  if (typeof v === 'boolean') return v ? 'yes' : 'no'
  return String(v)
}
