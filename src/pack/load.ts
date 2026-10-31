import { unzipSync } from 'fflate'
import type { CutieManifest, Pack, Script } from '../engine/types'
import { validatePack, type Issue, type PackFiles } from './validate'

export const PACK_EXTENSION = '.cutie'
const IMAGE_RE = /\.(png|jpe?g|webp|gif|avif)$/i
const SOUND_RE = /\.(mp3|ogg|wav|m4a)$/i

export interface LoadResult {
  pack: Pack | null
  issues: Issue[]
}

/** Sort image file names into expressions, backgrounds and reward art by naming convention. */
export function classifyImages(names: string[]): PackFiles & { select?: string } {
  const files: PackFiles & { select?: string } = { expressions: [], backgrounds: [], cgs: [] }
  for (const name of names) {
    const stem = name.replace(IMAGE_RE, '')
    if (stem === 'select') files.select = name
    else if (stem.startsWith('bg_')) files.backgrounds.push(stem.slice(3))
    else if (stem.startsWith('cg_')) files.cgs.push(stem.slice(3))
    else files.expressions.push(stem)
  }
  for (const list of [files.expressions, files.backgrounds, files.cgs]) list.sort()
  return files
}

/** Strip a shared top folder, so zipping the folder or its contents both work. */
function normalizePaths(entries: Record<string, Uint8Array>): Record<string, Uint8Array> {
  const kept = Object.entries(entries).filter(
    ([p, data]) => !p.startsWith('__MACOSX/') && !p.split('/').some((s) => s.startsWith('.')) && data.length > 0,
  )
  const manifestPath = kept.map(([p]) => p).find((p) => p === 'cutie.json' || p.endsWith('/cutie.json'))
  const prefix = manifestPath ? manifestPath.slice(0, -'cutie.json'.length) : ''
  return Object.fromEntries(kept.filter(([p]) => p.startsWith(prefix)).map(([p, d]) => [p.slice(prefix.length), d]))
}

function parseJson(bytes: Uint8Array | undefined, name: string, issues: Issue[]): unknown {
  if (!bytes) return undefined
  try {
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch (e) {
    issues.push({ level: 'error', where: name, message: `Not valid JSON: ${(e as Error).message}` })
    return null
  }
}

function mimeOf(name: string): string {
  const ext = name.split('.').pop()!.toLowerCase()
  return ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
}

/**
 * Turn the raw bytes of a `.cutie` (zip) into a Pack.
 * `makeUrl` turns image bytes into something an <img> can show (a blob URL in the browser).
 */
export function loadPackBytes(
  zip: Uint8Array,
  makeUrl: (bytes: Uint8Array, mime: string) => string = browserUrl,
): LoadResult {
  let entries: Record<string, Uint8Array>
  try {
    entries = normalizePaths(unzipSync(zip))
  } catch {
    return { pack: null, issues: [{ level: 'error', where: 'file', message: 'This is not a .cutie or .zip file.' }] }
  }
  return loadPackEntries(entries, makeUrl)
}

export function loadPackEntries(
  entries: Record<string, Uint8Array>,
  makeUrl: (bytes: Uint8Array, mime: string) => string = browserUrl,
): LoadResult {
  const issues: Issue[] = []
  const manifest = parseJson(entries['cutie.json'], 'cutie.json', issues)
  const script = parseJson(entries['script.json'], 'script.json', issues) ?? { formatVersion: 1, beats: [] }

  const imageNames = Object.keys(entries)
    .filter((p) => p.startsWith('images/') && IMAGE_RE.test(p))
    .map((p) => p.slice('images/'.length))
    .filter((n) => !n.includes('/'))
  const soundNames = Object.keys(entries)
    .filter((p) => /^sounds\/[^/]+$/.test(p) && SOUND_RE.test(p))
    .map((p) => p.slice('sounds/'.length))
  const files = { ...classifyImages(imageNames), sounds: soundNames.map((n) => n.replace(SOUND_RE, '')) }
  if (!files.select) issues.push({ level: 'warning', where: 'images/', message: 'No select.png, so the picker will use the default expression.' })

  issues.push(...validatePack(manifest, script, files))
  if (issues.some((i) => i.level === 'error')) return { pack: null, issues }

  const images: Record<string, string> = {}
  for (const name of imageNames) images[name] = makeUrl(entries[`images/${name}`], mimeOf(name))
  const sounds: Record<string, string> = {}
  for (const name of soundNames) sounds[name.replace(SOUND_RE, '')] = makeUrl(entries[`sounds/${name}`], soundMime(name))

  return {
    pack: {
      manifest: manifest as CutieManifest,
      script: script as Script,
      images,
      sounds,
      expressions: files.expressions,
      backgrounds: files.backgrounds,
      cgs: files.cgs,
    },
    issues,
  }
}

function soundMime(name: string): string {
  const ext = name.split('.').pop()!.toLowerCase()
  return ext === 'mp3' ? 'audio/mpeg' : ext === 'm4a' ? 'audio/mp4' : `audio/${ext}`
}

function browserUrl(bytes: Uint8Array, mime: string): string {
  return URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }))
}

/** URL for an image by its logical name. */
export function imageUrl(pack: Pack, kind: 'expression' | 'background' | 'cg' | 'select', name = ''): string | undefined {
  const stem = kind === 'background' ? `bg_${name}` : kind === 'cg' ? `cg_${name}` : kind === 'select' ? 'select' : name
  const file = Object.keys(pack.images).find((f) => f.replace(IMAGE_RE, '') === stem)
  if (file) return pack.images[file]
  if (kind === 'select') return imageUrl(pack, 'expression', pack.manifest.defaultExpression)
  return undefined
}
