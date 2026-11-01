/**
 * Refresh built-in cuties' scripts from the shared workbook.
 * Run: npm run sheet                      (uses content/cutie-scripts.xlsx)
 *      npm run sheet -- path/to/file.xlsx
 * For each content/<id>/ with tabs named "<Name> – …", rewrites content/<id>/script.json.
 * Nothing is written for a cutie whose tabs have problems.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { importCutie, cutiesIn } from '../src/sheet/workbook'
import { readXlsx } from '../src/sheet/xlsx'
import type { CutieManifest } from '../src/engine/types'

const root = join(import.meta.dirname, '..')
const file = process.argv[2] ?? join(root, 'content/cutie-scripts.xlsx')
const sheets = readXlsx(new Uint8Array(readFileSync(file)))
console.log(`${file}: tabs for ${cutiesIn(sheets).join(', ') || 'nobody'}`)

let failed = false
for (const id of readdirSync(join(root, 'content'))) {
  const manifestPath = join(root, 'content', id, 'cutie.json')
  if (!existsSync(manifestPath)) continue
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as CutieManifest
  if (!cutiesIn(sheets).some((c) => c.toLowerCase() === manifest.name.toLowerCase())) continue
  const { beats, problems } = importCutie(sheets, manifest)
  if (problems.length) {
    failed = true
    console.log(`  ✗ ${manifest.name}: ${problems.length} problem(s), script not changed`)
    for (const p of problems) console.log(`      ${p.where}: ${p.message}`)
    continue
  }
  writeFileSync(join(root, 'content', id, 'script.json'), JSON.stringify({ formatVersion: 1, beats }, null, 2) + '\n')
  console.log(`  ✓ ${manifest.name}: ${beats.length} moments -> content/${id}/script.json`)
}
if (failed) process.exit(1)
