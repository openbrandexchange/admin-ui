// The Excel download of article data: the workbook must open (a valid zip with the parts Excel
// needs), hold exactly the CSV's rows and columns as text, and convert back to the identical
// CSV under the spec's conversion (import-format.md §5). When the spec repository is next to
// this one (or OBX_SPEC points at it) with its dependencies installed, the spec's reference
// conversion tools/xlsx.mjs checks the workbook too.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { unzipSync, strFromU8 } from 'fflate'
import { describe, expect, it } from 'vitest'
import { colLetter, csvToXlsx, parseCsv, writeXlsx } from '../src/lib/xlsx'
import { canonicalCsv, readWorkbook } from '../src/mock/xlsx-read'

const fixture = readFileSync(resolve(__dirname, '../src/mock/fixtures/products.csv'), 'utf8')
const awkward = [
  ['style_number', 'gtin', 'name:en', 'note', 'materials'],
  ['KO-1001', '02000100101018', 'Crew "Merino", navy', '=1+1', 'main: 100% merino_wool'],
  ['KO-1002', '0012345678905', 'Line one\r\nline two', '_x0031_ literal', ' leading space'],
  ['KO-1003', '', 'Ελληνικά · Български · Ħ', '+31 20 123 4567', 'tab\there'],
  ['', '', '', '', ''],
  ['KO-1004', '4006381333931', 'after an empty row', '@sum', '-5'],
]
const csvOf = (rows: string[][]) => rows.map((r) => r.map((v) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(',')).join('\r\n') + '\r\n'

describe('CSV parsing', () => {
  it('reads quotes, doubled quotes, CRLF inside a field and a BOM', () => {
    expect(parseCsv('\uFEFFa,b\r\n"x, ""y""","1\r\n2"\r\n')).toEqual([
      ['a', 'b'],
      ['x, "y"', '1\r\n2'],
    ])
  })
  it('keeps empty fields and a last line without line break', () => expect(parseCsv('a,,c\n,,')).toEqual([['a', '', 'c'], ['', '', '']]))
  it('column letters', () => expect([1, 26, 27, 52, 703].map(colLetter)).toEqual(['A', 'Z', 'AA', 'AZ', 'AAA']))
})

describe.each([true, false])('Excel download (deflate: %s)', (compress) => {
  it('is a zip with the parts Excel needs', async () => {
    const bytes = await csvToXlsx(fixture, { compress })
    const parts = unzipSync(bytes)
    expect(Object.keys(parts).sort()).toEqual(['[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels', 'xl/sharedStrings.xml', 'xl/styles.xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml'])
    for (const [name, data] of Object.entries(parts)) {
      const doc = new DOMParser().parseFromString(strFromU8(data), 'application/xml')
      expect(doc.getElementsByTagName('parsererror'), name).toHaveLength(0)
    }
    const sheet = strFromU8(parts['xl/worksheets/sheet1.xml'])
    expect(sheet).toContain('state="frozen"')
    expect(sheet).toMatch(/<c r="A1" s="2" t="s">/) // bold text header
    expect(strFromU8(parts['xl/styles.xml'])).toContain('numFmtId="49"') // text format
    expect(strFromU8(parts['xl/workbook.xml'])).toContain('name="Products"')
  })

  it('holds exactly the rows of the CSV, as text', async () => {
    const rows = readWorkbook(await csvToXlsx(fixture, { compress })).map((r) => r.map((c) => c.text))
    expect(rows).toEqual(parseCsv(fixture))
    expect(canonicalCsv(rows)).toBe(fixture.replace(/^\uFEFF/, '').replace(/\r?\n/g, '\r\n'))
  })

  it('keeps leading zeros, quotes, line breaks, "_x" text, spaces, formulas as text and an empty row', async () => {
    const book = readWorkbook(await writeXlsx(awkward, { compress }))
    expect(book.map((r) => r.map((c) => c.text))).toEqual(awkward)
    expect(book.flat().some((c) => c.error)).toBe(false)
  })
})

const spec = resolve(process.env.OBX_SPEC ?? resolve(__dirname, '../../spec'))
const tool = join(spec, 'tools/xlsx.mjs')
const ready = existsSync(tool) && existsSync(join(spec, 'node_modules/exceljs'))

/** Runs the spec's conversion in a separate Node process (its dependencies live in the spec repository). */
function specConvert(bytes: Uint8Array): { csv: string; errors: unknown[]; warnings: unknown[] } {
  const dir = mkdtempSync(join(tmpdir(), 'obx-xlsx-'))
  try {
    const file = join(dir, 'products.xlsx')
    writeFileSync(file, bytes)
    const script = `const m = await import(${JSON.stringify(pathToFileURL(tool).href)}); const fs = await import('node:fs'); const out = await m.convertWorkbook(fs.readFileSync(${JSON.stringify(file)}), 'products'); process.stdout.write(JSON.stringify({ csv: m.canonicalCSV(out.rows), errors: out.errors, warnings: out.warnings }))`
    return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' }))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe.skipIf(!ready)("the spec's reference conversion (tools/xlsx.mjs)", () => {
  it.each([
    ['the mock catalog', fixture],
    ['awkward values', csvOf(awkward)],
  ])('converts %s back to the identical CSV', async (_, csv) => {
    for (const compress of [true, false]) {
      const out = specConvert(await csvToXlsx(csv, { compress }))
      expect(out.errors).toEqual([])
      expect(out.warnings).toEqual([])
      expect(out.csv).toBe(csv.replace(/^\uFEFF/, '').replace(/\r?\n/g, '\r\n'))
    }
  })

  it('the mock reader reads the products template like the spec does', () => {
    const template = join(spec, 'templates/products.xlsx')
    if (!existsSync(template)) return
    const bytes = new Uint8Array(readFileSync(template))
    expect(canonicalCsv(readWorkbook(bytes).map((r) => r.map((c) => c.text)))).toBe(specConvert(bytes).csv)
  })
})
