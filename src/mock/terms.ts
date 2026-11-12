// What a node does with the terms of materials and care (spec 0.3, protocol.md §5.9.1): it
// stores codes and answers with the vocabulary's names (and for care its category and symbol).
// A code outside the vocabularies keeps what it was given on write, else null.
import type { Care, LocalizedText, Materials } from '../api/types'
import { normaliseMaterials, type Term } from '../lib/materials'
import care from './fixtures/vocabularies/care.json'
import materials from './fixtures/vocabularies/materials.json'
import parts from './fixtures/vocabularies/parts.json'
import qualifiers from './fixtures/vocabularies/qualifiers.json'

type Entry = { code: string; name: LocalizedText | null; category?: string | null; symbol?: string | null }
const index = (v: { entries: Entry[] }) => new Map(v.entries.map((e) => [e.code, e]))
export const VOCABULARIES = { part: index(parts), material: index(materials), qualifier: index(qualifiers), care: index(care as { entries: Entry[] }) }

const named = (vocab: Map<string, Entry>, t: Term): Term => ({ ...t, code: t.code, name: vocab.has(t.code) ? vocab.get(t.code)!.name : (t.name ?? null) })

export function materialsWithNames(m: Materials | null | undefined): Materials | null {
  return (
    normaliseMaterials(m)?.map((p) => ({
      ...p,
      part: named(VOCABULARIES.part, p.part),
      fibers: p.fibers.map((f) => ({ ...f, material: named(VOCABULARIES.material, f.material), qualifier: f.qualifier ? named(VOCABULARIES.qualifier, f.qualifier) : null })),
    })) ?? null
  )
}

export function careWithNames(c: Care | null | undefined): Care | null {
  if (!c?.length) return null
  return c.map((e) => {
    const v = VOCABULARIES.care.get(e.code)
    return { ...e, category: (v ? v.category : e.category) ?? null, symbol: (v ? v.symbol : e.symbol) ?? null, name: v ? v.name : (e.name ?? null), text: e.text ?? null } as Care[number]
  })
}

/** Product data as a node answers it: terms with their names. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withTermNames<T extends Record<string, any>>(data: T): T {
  if (!('materials' in data) && !('care' in data)) return data
  return { ...data, ...('materials' in data && { materials: materialsWithNames(data.materials) }), ...('care' in data && { care: careWithNames(data.care) }) }
}
