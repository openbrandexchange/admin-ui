// A minimal .xlsx reader for the in-browser mock node and the tests: enough of import-format.md
// §5 to turn a simple workbook (the templates, the portal's own Excel download) into CSV rows
// with Excel row numbers and conversion errors. Real nodes implement §5 in full.
import { unzipSync, strFromU8 } from 'fflate'

export interface SheetCell {
  text: string
  /** Excel error value (#N/A …) or formula without a stored value (=G2*2). */
  error?: string
}

export class WorkbookError extends Error {
  constructor(public code: 'workbook_invalid' | 'workbook_unsafe' | 'workbook_sheet_missing' | 'workbook_too_large') {
    super(code)
  }
}

const decode = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&')
const unescapeX = (s: string) => s.replace(/_x([0-9A-Fa-f]{4})_/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
const texts = (xml: string) => [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t\s[^>]*\/>/g)].map((m) => unescapeX(decode(m[1] ?? ''))).join('')
const attr = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1]
const colNumber = (letters: string) => [...letters].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0)

/** Rows of the sheet "Products" (or the first sheet): rows[0] is Excel row 1. Missing cells are "". */
export function readWorkbook(bytes: Uint8Array, sheet = 'products'): SheetCell[][] {
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new WorkbookError('workbook_invalid')
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(bytes, { filter: (f) => !/vbaProject\.bin$/i.test(f.name) && (f.name.endsWith('.xml') || f.name.endsWith('.rels')) })
  } catch {
    throw new WorkbookError('workbook_invalid')
  }
  const part = (name: string) => (files[name] ? strFromU8(files[name]) : null)
  const types = part('[Content_Types].xml')
  const workbook = part('xl/workbook.xml')
  if (!types || !workbook) throw new WorkbookError('workbook_invalid')
  if (/macroEnabled|vbaProject/i.test(types) || Object.keys(files).some((n) => /^xl\/(macrosheets|activeX|externalLinks)\//.test(n))) throw new WorkbookError('workbook_unsafe')
  const rels = part('xl/_rels/workbook.xml.rels') ?? ''
  const target = (id: string) => {
    const rel = [...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => m[0]).find((r) => attr(r, 'Id') === id)
    const t = rel && attr(rel, 'Target')
    return t ? (t.startsWith('/') ? t.slice(1) : `xl/${t}`) : null
  }
  const sheets = [...workbook.matchAll(/<sheet\b[^>]*>/g)].map((m) => m[0]).filter((s) => !/state="(hidden|veryHidden)"/.test(s))
  const chosen = sheets.find((s) => decode(attr(s, 'name') ?? '').trim().toLowerCase() === sheet) ?? sheets[0]
  const sheetXml = chosen && part(target(attr(chosen, 'r:id') ?? '') ?? '')
  if (!sheetXml) throw new WorkbookError('workbook_sheet_missing')
  const shared = [...(part('xl/sharedStrings.xml') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1]))
  const rows: SheetCell[][] = []
  for (const r of sheetXml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const rowNo = Number(attr(r[1], 'r'))
    if (rowNo > 100_001) throw new WorkbookError('workbook_too_large')
    const cells: SheetCell[] = []
    for (const c of (r[2] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = attr(c[1], 'r') ?? ''
      const col = colNumber(/^[A-Z]+/.exec(ref)?.[0] ?? '') || cells.length + 1
      const type = attr(c[1], 't') ?? 'n'
      const inner = c[2] ?? ''
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1]
      const f = /<f\b[^>]*>([\s\S]*?)<\/f>/.exec(inner)?.[1]
      let cell: SheetCell
      if (type === 'inlineStr') cell = { text: texts(/<is>([\s\S]*?)<\/is>/.exec(inner)?.[1] ?? '') }
      else if (v === undefined || v === '') cell = f !== undefined ? { text: '', error: `=${decode(f)}` } : { text: '' }
      else if (type === 's') {
        const s = shared[Number(v)]
        if (s === undefined) throw new WorkbookError('workbook_invalid')
        cell = { text: s }
      } else if (type === 'e') cell = { text: '', error: decode(v) }
      else if (type === 'b') cell = { text: v === '1' ? 'true' : 'false' }
      else cell = { text: type === 'str' ? unescapeX(decode(v)) : String(Number(v)) }
      while (cells.length < col - 1) cells.push({ text: '' })
      cells[col - 1] = cell
    }
    while (rows.length < rowNo - 1) rows.push([])
    rows[rowNo - 1] = cells
  }
  const width = rows[0]?.reduce((w, c, i) => (c.text ? i + 1 : w), 0) ?? 0
  let last = rows.length
  while (last > 1 && !rows[last - 1].slice(0, width).some((c) => c.text || c.error)) last--
  return rows.slice(0, last).map((r) => Array.from({ length: width }, (_, i) => r[i] ?? { text: '' }))
}

/** Canonical CSV text (import-format.md §5.3) of the rows' texts. */
export function canonicalCsv(rows: string[][]): string {
  return rows.map((r) => r.map((v) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(',') + '\r\n').join('')
}

export interface WorkbookCsv {
  /** products.csv text: the header and the rows without conversion errors (empty rows dropped). */
  csv: string
  /** Excel row number of each data row of `csv` (index 0 = first data row). */
  excelRows: number[]
  /** Header texts as written in row 1. */
  header: string[]
  errors: { row: number; column: string | null; letter: string; value: string }[]
}

const quote = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
export const columnLetter = (n: number) => {
  let s = ''
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}

/** A workbook as the CSV the mock import reads, with the Excel row of every data row and the conversion errors. */
export function workbookToCsv(bytes: Uint8Array, sheet = 'products'): WorkbookCsv {
  const rows = readWorkbook(bytes, sheet)
  const header = (rows[0] ?? []).map((c) => c.text)
  const out: WorkbookCsv = { csv: header.map(quote).join(',') + '\r\n', excelRows: [], header, errors: [] }
  rows.slice(1).forEach((r, i) => {
    const bad = r.flatMap((c, j) => (c.error ? [{ row: i + 2, column: header[j]?.trim() || null, letter: columnLetter(j + 1), value: c.error }] : []))
    out.errors.push(...bad)
    if (bad.length || !r.some((c) => c.text.trim())) return
    out.csv += r.map((c) => quote(c.text)).join(',') + '\r\n'
    out.excelRows.push(i + 2)
  })
  return out
}
