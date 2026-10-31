import { unzipSync, zipSync, strToU8 } from 'fflate'
import { del, get, keys, set } from 'idb-keyval'
import { DEFAULT_TIME_SLOTS } from '../engine/time'
import { PACK_FORMAT_VERSION, type CutieManifest, type Script } from '../engine/types'
import { classifyImages, loadPackEntries, type LoadResult } from '../pack/load'

/**
 * A pack being edited in the Studio. Kept as plain data (no blob URLs) so it
 * can be saved to IndexedDB and zipped back into a `.cutie`.
 */
export interface Draft {
  manifest: CutieManifest
  script: Script
  /** File name inside images/ (or sounds/) -> bytes. Keys include the folder. */
  files: Record<string, Uint8Array>
  updatedAt: number
}

const DRAFT = 'draft:'

export function blankDraft(id: string, name: string): Draft {
  return {
    manifest: {
      formatVersion: PACK_FORMAT_VERSION,
      id,
      name,
      intro: `${name} is…`,
      defaultExpression: 'neutral',
      defaultBackground: 'room',
      timeSlots: DEFAULT_TIME_SLOTS,
      stages: [
        { id: 'stranger', name: 'Stranger', minTotalPct: 0 },
        { id: 'friend', name: 'Friend', minTotalPct: 40 },
        { id: 'close', name: 'Close', minTotalPct: 80 },
      ],
      milestones: { daily: [10, 33, 50, 75, 100], total: [10, 25, 50, 75, 100] },
      ambient: { everyMinutes: 20, chance: 0.3 },
      idle: { everySeconds: 30, expressions: [{ expression: 'neutral', weight: 1 }] },
    },
    script: {
      formatVersion: PACK_FORMAT_VERSION,
      beats: [{
        id: 'hello',
        trigger: { type: 'session_start' },
        repeat: 'once',
        lines: [{ text: 'Hi, {player}! Ready to write?', expression: 'neutral' }],
      }],
    },
    files: {},
    updatedAt: Date.now(),
  }
}

/** Unzip a `.cutie` into an editable draft. */
export function draftFromBytes(bytes: Uint8Array): Draft {
  const raw = unzipSync(bytes)
  const manifestPath = Object.keys(raw).find((p) => p === 'cutie.json' || p.endsWith('/cutie.json'))
  if (!manifestPath) throw new Error('No cutie.json in this file.')
  const prefix = manifestPath.slice(0, -'cutie.json'.length)
  const text = (p: string) => new TextDecoder().decode(raw[prefix + p])
  const files: Record<string, Uint8Array> = {}
  for (const [p, data] of Object.entries(raw)) {
    const rel = p.slice(prefix.length)
    if (p.startsWith(prefix) && /^(images|sounds)\/[^/]+\.\w+$/.test(rel) && data.length) files[rel] = data
  }
  return {
    manifest: JSON.parse(text('cutie.json')),
    script: raw[prefix + 'script.json'] ? JSON.parse(text('script.json')) : { formatVersion: 1, beats: [] },
    files,
    updatedAt: Date.now(),
  }
}

export function draftEntries(d: Draft): Record<string, Uint8Array> {
  return {
    'cutie.json': strToU8(JSON.stringify(d.manifest, null, 2)),
    'script.json': strToU8(JSON.stringify(d.script, null, 2)),
    ...d.files,
  }
}

export function draftToBytes(d: Draft): Uint8Array {
  const entries = draftEntries(d)
  return zipSync(Object.fromEntries(
    Object.entries(entries).map(([p, data]) => [p, [data, { level: p.endsWith('.json') ? 9 : 0 }]]),
  ))
}

/** Validate a draft and build a playable Pack, reusing blob URLs between edits. */
export function draftToPack(d: Draft, urlCache: Map<Uint8Array, string>): LoadResult {
  return loadPackEntries(draftEntries(d), (bytes, mime) => {
    let url = urlCache.get(bytes)
    if (!url) {
      url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }))
      urlCache.set(bytes, url)
    }
    return url
  })
}

export async function listDrafts(): Promise<Draft[]> {
  const ks = (await keys()).filter((k): k is string => typeof k === 'string' && k.startsWith(DRAFT))
  const all = await Promise.all(ks.map((k) => get<Draft>(k)))
  return all.filter((d): d is Draft => !!d).sort((a, b) => b.updatedAt - a.updatedAt)
}
export const getDraft = (id: string) => get<Draft>(DRAFT + id)
export const saveDraft = (d: Draft) => set(DRAFT + d.manifest.id, { ...d, updatedAt: Date.now() })
export const deleteDraft = (id: string) => del(DRAFT + id)

/** Expression, background, reward-art and sound names found in a draft's files. */
export function assetLists(d: Draft) {
  const images = Object.keys(d.files).filter((p) => p.startsWith('images/')).map((p) => p.slice(7))
  const files = classifyImages(images)
  const sounds = Object.keys(d.files).filter((p) => p.startsWith('sounds/')).map((p) => p.slice(7).replace(/\.\w+$/, ''))
  return { ...files, sounds }
}
