// A small .xlsx writer for the article data download: the CSV a portal serves, as one sheet
// "Products" with the same columns in the same order (so it can be imported again, spec
// import-format.md §5). Every cell is text in a text-formatted column, so EANs keep their
// leading zeros and nothing turns into a date or a number; row 1 is bold and frozen.
// Zip entries are deflated with CompressionStream where the browser has it, else stored.

/** RFC 4180 CSV (quoted fields, "" inside quotes, CRLF or LF, optional BOM) → rows. */
export function parseCsv(text: string, delimiter = ','): string[][] {
  const src = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c !== '"') cell += c
      else if (src[i + 1] === '"') {
        cell += '"'
        i++
      } else quoted = false
    } else if (c === '"') quoted = true
    else if (c === delimiter) {
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
  return rows
}

/** Column number (1-based) → letters: 1 → A, 27 → AA. */
export const colLetter = (n: number) => {
  let s = ''
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Text for a <t> element: a literal "_xHHHH_" is protected as "_x005F_xHHHH_", and characters
 * XML cannot carry (controls, CR, which XML would turn into LF) become "_xHHHH_" (ECMA-376 ST_Xstring).
 */
function xstring(s: string) {
  const hex = (c: string) => `_x${c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}_`
  // eslint-disable-next-line no-control-regex
  return esc(s.replace(/_(x[0-9A-Fa-f]{4}_)/g, '_x005F_$1').replace(/[\u0000-\u0008\u000B\u000C\u000D\u000E-\u001F\uFFFE\uFFFF]/g, hex))
}

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const NS_PR = 'http://schemas.openxmlformats.org/package/2006/relationships'
export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** The parts of a one-sheet workbook. `rows[0]` is the header. */
export function workbookParts(rows: string[][], sheetName = 'Products'): [string, string][] {
  const width = Math.max(1, ...rows.map((r) => r.length))
  const strings: string[] = []
  const index = new Map<string, number>()
  const sid = (s: string) => {
    let i = index.get(s)
    if (i === undefined) {
      i = strings.length
      strings.push(s)
      index.set(s, i)
    }
    return i
  }
  let refs = 0
  const sheetRows = rows.map((r, i) => {
    const cells = r.map((v, j) => {
      if (v === '') return ''
      refs++
      return `<c r="${colLetter(j + 1)}${i + 1}" s="${i === 0 ? 2 : 1}" t="s"><v>${sid(v)}</v></c>`
    })
    return `<row r="${i + 1}">${cells.join('')}</row>`
  })
  const widths = Array.from({ length: width }, (_, j) => Math.min(50, Math.max(8, ...rows.slice(0, 200).map((r) => (r[j] ?? '').length + 2))))
  const cols = widths.map((w, j) => `<col min="${j + 1}" max="${j + 1}" width="${w}" style="1" customWidth="1"/>`).join('')
  const sheet =
    `${XML}<worksheet xmlns="${NS}" xmlns:r="${NS_R}"><dimension ref="A1:${colLetter(width)}${Math.max(1, rows.length)}"/>` +
    `<sheetViews><sheetView workbookViewId="0">${rows.length > 1 ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/>' : ''}</sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${sheetRows.join('')}</sheetData></worksheet>`
  const shared =
    `${XML}<sst xmlns="${NS}" count="${refs}" uniqueCount="${strings.length}">` +
    strings.map((s) => `<si><t${/^\s|\s$|\n/.test(s) ? ' xml:space="preserve"' : ''}>${xstring(s)}</t></si>`).join('') +
    '</sst>'
  // Styles: 0 default, 1 text (@), 2 text + bold for the header.
  const styles =
    `${XML}<styleSheet xmlns="${NS}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>` +
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="49" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/></cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'
  const ct = 'application/vnd.openxmlformats-officedocument.spreadsheetml'
  return [
    [
      '[Content_Types].xml',
      `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="${ct}.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="${ct}.worksheet+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="${ct}.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="${ct}.sharedStrings+xml"/></Types>`,
    ],
    ['_rels/.rels', `${XML}<Relationships xmlns="${NS_PR}"><Relationship Id="rId1" Type="${NS_R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `${XML}<workbook xmlns="${NS}" xmlns:r="${NS_R}"><bookViews><workbookView/></bookViews><sheets><sheet name="${esc(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    [
      'xl/_rels/workbook.xml.rels',
      `${XML}<Relationships xmlns="${NS_PR}"><Relationship Id="rId1" Type="${NS_R}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${NS_R}/styles" Target="styles.xml"/><Relationship Id="rId3" Type="${NS_R}/sharedStrings" Target="sharedStrings.xml"/></Relationships>`,
    ],
    ['xl/worksheets/sheet1.xml', sheet],
    ['xl/styles.xml', styles],
    ['xl/sharedStrings.xml', shared],
  ]
}

// ---------------------------------------------------------------- zip

let crcTable: Uint32Array | undefined
function crc32(data: Uint8Array) {
  const table = (crcTable ??= Uint32Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  }))
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

async function deflateRaw(data: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null
  try {
    const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'))
    return new Uint8Array(await new Response(stream).arrayBuffer())
  } catch {
    return null // a browser without deflate-raw: store
  }
}

/** A zip of the given files (no folders, no encryption, fixed 1980-01-01 timestamps). */
export async function zip(files: [string, Uint8Array][], { compress = true } = {}): Promise<Uint8Array> {
  const chunks: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const [name, data] of files) {
    const nameBytes = new TextEncoder().encode(name)
    const packed = compress ? await deflateRaw(data) : null
    const method = packed && packed.length < data.length ? 8 : 0
    const body = method === 8 ? packed! : data
    const crc = crc32(data)
    const head = (sig: number, extra: number) => {
      const b = new Uint8Array(extra + nameBytes.length)
      const v = new DataView(b.buffer)
      v.setUint32(0, sig, true)
      return { b, v }
    }
    const local = head(0x04034b50, 30)
    local.v.setUint16(4, 20, true)
    local.v.setUint16(6, 0x0800, true) // UTF-8 names
    local.v.setUint16(8, method, true)
    local.v.setUint16(12, 0x21, true) // 1980-01-01
    local.v.setUint32(14, crc, true)
    local.v.setUint32(18, body.length, true)
    local.v.setUint32(22, data.length, true)
    local.v.setUint16(26, nameBytes.length, true)
    local.b.set(nameBytes, 30)
    const cen = head(0x02014b50, 46)
    cen.v.setUint16(4, 20, true)
    cen.v.setUint16(6, 20, true)
    cen.v.setUint16(8, 0x0800, true)
    cen.v.setUint16(10, method, true)
    cen.v.setUint16(14, 0x21, true)
    cen.v.setUint32(16, crc, true)
    cen.v.setUint32(20, body.length, true)
    cen.v.setUint32(24, data.length, true)
    cen.v.setUint16(28, nameBytes.length, true)
    cen.v.setUint32(42, offset, true)
    cen.b.set(nameBytes, 46)
    chunks.push(local.b, body)
    central.push(cen.b)
    offset += local.b.length + body.length
  }
  const size = central.reduce((n, c) => n + c.length, 0)
  const end = new Uint8Array(22)
  const v = new DataView(end.buffer)
  v.setUint32(0, 0x06054b50, true)
  v.setUint16(8, files.length, true)
  v.setUint16(10, files.length, true)
  v.setUint32(12, size, true)
  v.setUint32(16, offset, true)
  const all = [...chunks, ...central, end]
  const out = new Uint8Array(all.reduce((n, c) => n + c.length, 0))
  let at = 0
  for (const c of all) {
    out.set(c, at)
    at += c.length
  }
  return out
}

/** Rows → .xlsx bytes. */
export async function writeXlsx(rows: string[][], options: { sheetName?: string; compress?: boolean } = {}): Promise<Uint8Array> {
  const enc = new TextEncoder()
  return zip(
    workbookParts(rows, options.sheetName).map(([name, xml]) => [name, enc.encode(xml)]),
    { compress: options.compress ?? true },
  )
}

/** A CSV text (as a portal serves it) → .xlsx bytes with the same rows and columns. */
export const csvToXlsx = (csv: string, options?: { sheetName?: string; compress?: boolean }) => writeXlsx(parseCsv(csv), options)
