// A small implementation of the canonical import format (spec docs/import-format.md) for the
// in-browser mock node. Real nodes are the parser in production; this only has to be faithful
// enough for demos and UI tests.
import { parseMaterials } from '../lib/materials'
import { gtinValid } from '../lib/validate'

export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '')
  const firstLine = src.split(/\r?\n/, 1)[0] ?? ''
  const count = (ch: string) => {
    let n = 0
    let q = false
    for (const c of firstLine) {
      if (c === '"') q = !q
      else if (!q && c === ch) n++
    }
    return n
  }
  const delim = count(';') > count(',') ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === delim) {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim()))
}

const ALIASES: Record<string, string> = { style: 'style_number', ean: 'gtin', barcode: 'gtin', colour_code: 'color_code', colour_name: 'color_name' }

export function normHeader(h: string): string {
  const base = h.trim().toLowerCase().replace(/[\s-]+/g, '_')
  const [k, lang] = base.split(':')
  const key = ALIASES[k] ?? k
  return lang ? `${key}:${lang}` : key
}

export type Row = Record<string, string>

export function rowsOf(text: string): { header: string[]; rows: Row[] } {
  const [head = [], ...body] = parseCsv(text)
  const header = head.map(normHeader)
  return { header, rows: body.map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()]))) }
}

/** `name`, `name:nl`… → LocalizedText (plain column = default language). */
export function localizedFrom(row: Row, key: string, defaultLang: string): Record<string, string> | null {
  const out: Record<string, string> = {}
  if (row[key]) out[defaultLang] = row[key]
  for (const [k, v] of Object.entries(row)) if (k.startsWith(key + ':') && v) out[k.slice(key.length + 1)] = v
  return Object.keys(out).length ? out : null
}

export type RowError = { file: string; row: number | null; column: string | null; severity: 'error' | 'warning'; obx_error: string; detail: string; value: string | null }

export function checkGtin(value: string): string | null {
  const digits = value.replace(/\s/g, '')
  if (!digits) return null
  if (/e\+/i.test(value)) return 'Excel turned this code into a number; format the column as text.'
  if (!gtinValid(digits)) return 'Not a valid EAN/GTIN (8, 12, 13 or 14 digits with a correct check digit).'
  return null
}

export function materialsFrom(v: string) {
  const r = parseMaterials(v)
  return r.ok ? r.value : undefined
}

const ROLES = new Set(['packshot', 'model', 'detail', 'ghost', 'flatlay', 'scene', 'swatch', 'size_chart', 'other'])
const VIEWS = new Set(['front', 'back', 'side', 'left', 'right', 'top', 'bottom', 'tilted_left', 'tilted_right', 'inside', 'detail', 'other'])

/** `{style}_{color}_{position}[_{qualifier}…].{ext}`, parsed from the right. */
export function parseImageName(file: string): { style: string; color: string; position: number; role: string; view: string | null } | null {
  const m = /^(.*)\.(jpe?g|png|webp|tiff?)$/i.exec(file)
  if (!m) return null
  const parts = m[1].split('_')
  let role: string | null = null
  let view: string | null = null
  while (parts.length > 3) {
    const last = parts[parts.length - 1].toLowerCase()
    // tilted_left / tilted_right / size_chart span two parts
    const two = parts.length > 4 ? `${parts[parts.length - 2].toLowerCase()}_${last}` : ''
    if (two && (ROLES.has(two) || VIEWS.has(two))) {
      parts.splice(-2)
      if (ROLES.has(two)) role = two
      else view = two
      continue
    }
    if (!ROLES.has(last) && !VIEWS.has(last)) break
    parts.pop()
    if (last === 'detail') {
      role = 'detail'
      view = 'detail'
    } else if (ROLES.has(last) && !role) role = last
    else view = last
  }
  if (parts.length < 3) return null
  const pos = parts.pop()!
  if (!/^[1-9][0-9]{0,2}$/.test(pos)) return null
  const color = parts.pop()!
  return { style: parts.join('_'), color, position: Number(pos), role: role ?? 'packshot', view }
}

export const truthy = (v: string) => /^(true|yes|ja|1)$/i.test(v.trim())
