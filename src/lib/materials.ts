// The canonical materials grammar (spec docs/import-format.md §1.4), so the product form uses
// the same notation as the CSV:  "outer: 65% cotton, 35% polyamide; lining: 100% polyester".
import type { Materials } from '../api/types'

const KEY = /^[a-z][a-z0-9_]{0,63}$/

const normKey = (s: string) => s.trim().toLowerCase().replace(/[\s-]+/g, '_')

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
    const list = []
    for (const rawFibre of fibres.split(',')) {
      const m = /^\s*(\d+(?:[.,]\d+)?)\s*%\s*(.+?)\s*$/.exec(rawFibre)
      if (!m) return { ok: false, error: rawFibre.trim() }
      const pct = Number(m[1].replace(',', '.'))
      const fiber = normKey(m[2])
      if (!(pct > 0 && pct <= 100) || !KEY.test(fiber)) return { ok: false, error: rawFibre.trim() }
      list.push({ fiber, percentage: pct })
    }
    parts.push({ part: partName, fibers: list })
  }
  return { ok: true, value: parts.length ? parts : null }
}

export function formatMaterials(m: Materials | null | undefined): string {
  if (!m?.length) return ''
  return m.map((p) => `${p.part}: ${p.fibers.map((f) => `${f.percentage}% ${f.fiber}`).join(', ')}`).join('; ')
}

/** Parts whose percentages do not add up to 100 (a warning, not an error). */
export function unbalancedParts(m: Materials | null): string[] {
  return (m ?? []).filter((p) => Math.abs(p.fibers.reduce((s, f) => s + f.percentage, 0) - 100) > 0.01).map((p) => p.part)
}
