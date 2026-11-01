import { strToU8, unzipSync, zipSync } from 'fflate'

/**
 * Just enough .xlsx to read and write plain-text grids, with no dependencies beyond fflate.
 * Works in the browser and in Node (no DOMParser needed).
 */

export interface Sheet {
  name: string
  /** rows[r][c] = cell text. Row and column 0 are the spreadsheet's row 1 / column A. */
  rows: string[][]
}

// ---------------------------------------------------------------- reading

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
function unescape(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
    e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITIES[e] ?? m)
}

const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1]

/** Text of every <t> inside a fragment (handles rich-text runs). */
function texts(xml: string): string {
  let out = ''
  for (const m of xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g)) out += unescape(m[1] ?? '')
  return out
}

function colIndex(ref: string): number {
  let n = 0
  for (const ch of ref.match(/^[A-Z]+/)![0]) n = n * 26 + ch.charCodeAt(0) - 64
  return n - 1
}

const NOT_XLSX = "This isn't an .xlsx file. In Google Sheets use File → Download → Microsoft Excel (.xlsx)."

export function readXlsx(bytes: Uint8Array): Sheet[] {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(bytes)
  } catch {
    throw new Error(NOT_XLSX)
  }
  const text = (p: string) => (files[p] ? new TextDecoder().decode(files[p]) : '')
  const workbook = text('xl/workbook.xml')
  if (!workbook) throw new Error(NOT_XLSX)

  const shared: string[] = []
  for (const m of text('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(texts(m[1]))

  const rels: Record<string, string> = {}
  for (const m of text('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\s[^>]*>/g)) {
    const id = attr(m[0], 'Id')
    const target = attr(m[0], 'Target')
    if (id && target) rels[id] = target.startsWith('/') ? target.slice(1) : `xl/${target}`
  }

  const sheets: Sheet[] = []
  for (const m of workbook.matchAll(/<sheet\s[^>]*\/?>/g)) {
    const name = unescape(attr(m[0], 'name') ?? '')
    const path = rels[attr(m[0], 'r:id') ?? '']
    const xml = path ? text(path) : ''
    const rows: string[][] = []
    for (const row of xml.matchAll(/<row\s[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const r = Number(attr(row[0], 'r')) - 1
      const cells: string[] = []
      for (const c of (row[1] ?? '').matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = attr(` ${c[1]}`, 'r')
        if (!ref) continue
        const type = attr(` ${c[1]}`, 't')
        const body = c[2] ?? ''
        const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1]
        cells[colIndex(ref)] =
          type === 's' ? shared[Number(v)] ?? ''
          : type === 'inlineStr' ? texts(body)
          : type === 'b' ? (v === '1' ? 'TRUE' : 'FALSE')
          : unescape(v ?? '')
      }
      rows[r] = Array.from(cells, (x) => x ?? '')
    }
    sheets.push({ name, rows: Array.from(rows, (x) => x ?? []) })
  }
  return sheets
}

// ---------------------------------------------------------------- writing

export interface WriteSheet extends Sheet {
  /** Column widths in characters. */
  widths?: number[]
  /** Freeze the first column as well as the first row. */
  freezeFirstColumn?: boolean
  /** Dropdowns: column index -> allowed values (Google Sheets keeps these as data validation). */
  dropdowns?: Record<number, string[]>
  tabColor?: string
  /** Rows (0-based) shown as soft section headings. */
  noteRows?: number[]
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  // XML 1.0 forbids most control characters.
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')

function colName(i: number): string {
  let s = ''
  for (i += 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s
  return s
}

// Style ids: 0 default, 1 header, 2 body (wrap, top), 3 first column (bold, wrap, top), 4 section heading
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="3"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FF8A5CC2"/><name val="Arial"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEADFF2"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFBF8FD"/></patternFill></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf/></cellStyleXfs>
<cellXfs count="5">
<xf/>
<xf fontId="1" fillId="2" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf fontId="1" fillId="3" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf fontId="2" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
</cellXfs>
</styleSheet>`

function sheetXml(s: WriteSheet): string {
  const width = Math.max(1, ...s.rows.map((r) => r.length))
  const cols = (s.widths ?? []).map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')
  const pane = s.freezeFirstColumn
    ? '<pane xSplit="1" ySplit="1" topLeftCell="B2" activePane="bottomRight" state="frozen"/>'
    : '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
  const notes = new Set(s.noteRows ?? [])
  const rows = s.rows.map((row, r) => {
    const cells = row.map((v, c) => {
      if (v === '' || v === undefined) return ''
      const style = r === 0 ? 1 : notes.has(r) ? 4 : c === 0 && s.freezeFirstColumn ? 3 : 2
      return `<c r="${colName(c)}${r + 1}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${esc(v)}</t></is></c>`
    }).join('')
    return `<row r="${r + 1}">${cells}</row>`
  }).join('')
  const lastRow = Math.max(s.rows.length + 300, 500)
  const validations = Object.entries(s.dropdowns ?? {})
    .map(([c, values]) => {
      const list = values.map((v) => v.replace(/[",]/g, '')).join(',')
      const col = colName(Number(c))
      return list.length <= 250
        ? `<dataValidation type="list" allowBlank="1" showErrorMessage="0" sqref="${col}2:${col}${lastRow}"><formula1>"${esc(list)}"</formula1></dataValidation>`
        : ''
    }).filter(Boolean)
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
${s.tabColor ? `<sheetPr><tabColor rgb="FF${s.tabColor.replace('#', '').toUpperCase()}"/></sheetPr>` : ''}
<dimension ref="A1:${colName(width - 1)}${Math.max(1, s.rows.length)}"/>
<sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
${cols ? `<cols>${cols}</cols>` : ''}
<sheetData>${rows}</sheetData>
${validations.length ? `<dataValidations count="${validations.length}">${validations.join('')}</dataValidations>` : ''}
</worksheet>`
}

/** Sheet names: max 31 chars, none of []:*?/\ */
export const safeSheetName = (n: string) => n.replace(/[[\]:*?/\\]/g, '-').slice(0, 31)

export function writeXlsx(sheets: WriteSheet[]): Uint8Array {
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n')}
</Types>`),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheets.map((s, i) => `<sheet name="${esc(safeSheetName(s.name))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>
</workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('\n')}
<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`),
    'xl/styles.xml': strToU8(STYLES),
  }
  sheets.forEach((s, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(s)) })
  return zipSync(files, { level: 6 })
}
