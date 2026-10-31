/**
 * Build every content/<id>/ folder that has a cutie.json into public/packs/<id>.cutie.
 * Images are shrunk to WebP so the site loads fast. Fails if a pack has errors.
 * Run: npm run packs
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { zipSync } from 'fflate'
import sharp from 'sharp'
import { loadPackEntries } from '../src/pack/load'

const root = join(import.meta.dirname, '..')
const contentDir = join(root, 'content')
const outDir = join(root, 'public/packs')
const IMAGE_RE = /\.(png|jpe?g|webp)$/i

async function toWebp(file: string, name: string): Promise<Uint8Array> {
  const isBg = name.startsWith('bg_') || name.startsWith('cg_')
  const img = sharp(readFileSync(file)).resize({ width: isBg ? 1920 : 800, withoutEnlargement: true })
  return new Uint8Array(await img.webp({ quality: isBg ? 80 : 88 }).toBuffer())
}

async function buildPack(id: string): Promise<boolean> {
  const dir = join(contentDir, id)
  const entries: Record<string, Uint8Array> = {
    'cutie.json': readFileSync(join(dir, 'cutie.json')),
    'script.json': readFileSync(join(dir, 'script.json')),
  }
  const imgDir = join(dir, 'images')
  for (const name of existsSync(imgDir) ? readdirSync(imgDir) : []) {
    if (!IMAGE_RE.test(name)) continue
    entries[`images/${name.replace(IMAGE_RE, '.webp')}`] = await toWebp(join(imgDir, name), name)
  }

  const soundDir = join(dir, 'sounds')
  for (const name of existsSync(soundDir) ? readdirSync(soundDir) : []) {
    if (/\.(mp3|ogg|wav|m4a)$/i.test(name)) entries[`sounds/${name}`] = readFileSync(join(soundDir, name))
  }

  const { issues } = loadPackEntries(entries, () => '')
  for (const i of issues) console.log(`  ${i.level === 'error' ? '✗' : '!'} ${id}: ${i.where}: ${i.message}`)
  if (issues.some((i) => i.level === 'error')) return false

  // Images are already compressed; store them as-is and deflate only the JSON.
  const zip = zipSync(
    Object.fromEntries(Object.entries(entries).map(([p, d]) => [p, [d, { level: p.endsWith('.json') ? 9 : 0 }]])),
  )
  writeFileSync(join(outDir, `${id}.cutie`), zip)
  console.log(`  ✓ ${id}.cutie (${(zip.length / 1024).toFixed(0)} KB)`)
  return true
}

mkdirSync(outDir, { recursive: true })
const ids = readdirSync(contentDir).filter((d) => existsSync(join(contentDir, d, 'cutie.json')))
const results = await Promise.all(ids.map(buildPack))
writeFileSync(join(outDir, 'index.json'), JSON.stringify({ packs: ids.filter((_, i) => results[i]) }, null, 2))
if (results.includes(false)) process.exit(1)
