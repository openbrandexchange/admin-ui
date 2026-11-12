// The canonical materials grammar (spec docs/import-format.md §1.4), so the product form uses
// the same notation as the CSV:  "outer: 65% cotton, 35% polyamide; lining: 100% polyester (recycled)".
import type { Materials } from '../api/types'

const KEY = /^[a-z][a-z0-9_]{0,63}$/

const normKey = (s: string) => s.trim().toLowerCase().replace(/[\s-]+/g, '_')

export type Fibre = Materials[number]['fibers'][number]

/**
 * The 0.1 keys `recycled_<fibre>` and `organic_<fibre>` are the fibre with a flag
 * (protocol.md §5.9.1). Every fibre the UI reads or writes goes through here.
 */
export function normaliseFibre(f: Fibre): Fibre {
  const m = /^(recycled|organic)_([a-z][a-z0-9_]*)$/.exec(f.fiber)
  if (!m) return f
  return { ...f, fiber: m[2], [m[1]]: true }
}

export function normaliseMaterials(m: Materials | null | undefined): Materials | null {
  if (!m?.length) return null
  return m.map((p) => ({ ...p, fibers: p.fibers.map(normaliseFibre) }))
}

export type MaterialsParse = { ok: true; value: Materials | null } | { ok: false; error: string }

export function parseMaterials(text: string): MaterialsParse {
  const src = text.trim()
  if (!src) return { ok: true, value: null }
  const parts: Materials = []
  for (const rawPart of src.split(';')) {
    if (!rawPart.trim()) continue
    let partName = 'main'
    let fibres = rawPart
    const colon = rawPart.indexOf(':')
    if (colon >= 0) {
      partName = normKey(rawPart.slice(0, colon))
      fibres = rawPart.slice(colon + 1)
    }
    if (!KEY.test(partName)) return { ok: false, error: rawPart.trim() }
    const list: Fibre[] = []
    for (const rawFibre of fibres.split(',')) {
      const m = /^\s*(\d+(?:[.,]\d+)?)\s*%\s*(.+?)\s*$/.exec(rawFibre)
      if (!m) return { ok: false, error: rawFibre.trim() }
      const pct = Number(m[1].replace(',', '.'))
      let name = m[2]
      const flags: { recycled?: true; organic?: true } = {}
      for (;;) {
        const f = /\s*\((recycled|organic)\)\s*$/i.exec(name)
        if (!f) break
        flags[f[1].toLowerCase() as 'recycled' | 'organic'] = true
        name = name.slice(0, f.index)
      }
      const fiber = normKey(name)
      if (!(pct > 0 && pct <= 100) || !KEY.test(fiber)) return { ok: false, error: rawFibre.trim() }
      list.push(normaliseFibre({ fiber, percentage: pct, ...flags }))
    }
    parts.push({ part: partName, fibers: list })
  }
  return { ok: true, value: parts.length ? parts : null }
}

export function formatMaterials(m: Materials | null | undefined): string {
  const list = normaliseMaterials(m)
  if (!list) return ''
  return list
    .map((p) => `${p.part}: ${p.fibers.map((f) => `${f.percentage}% ${f.fiber}${f.recycled ? ' (recycled)' : ''}${f.organic ? ' (organic)' : ''}`).join(', ')}`)
    .join('; ')
}

/** Parts whose percentages do not add up to 100 (a warning, not an error). */
export function unbalancedParts(m: Materials | null): string[] {
  return (m ?? []).filter((p) => Math.abs(p.fibers.reduce((s, f) => s + f.percentage, 0) - 100) > 0.01).map((p) => p.part)
}
