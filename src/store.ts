import { del, get, keys, set } from 'idb-keyval'
import type { Pack, Project } from './engine/types'
import type { Issue } from './pack/validate'
import { loadPackBytes } from './pack/load'

// Everything lives in this browser's IndexedDB. Nothing is sent anywhere.

const PROJECT = 'project:'
const USER_PACK = 'pack:'
const LAST = 'lastProjectId'

export async function listProjects(): Promise<Project[]> {
  const ks = (await keys()).filter((k): k is string => typeof k === 'string' && k.startsWith(PROJECT))
  const all = await Promise.all(ks.map((k) => get<Project>(k)))
  return all.filter((p): p is Project => !!p).sort((a, b) => b.updatedAt - a.updatedAt)
}

export const getProject = (id: string) => get<Project>(PROJECT + id)
export const saveProject = (p: Project) => set(PROJECT + p.id, p)
export const deleteProject = (id: string) => del(PROJECT + id)
export const getLastProjectId = () => get<string>(LAST)
export const setLastProjectId = (id: string) => set(LAST, id)

// ---------------------------------------------------------------- packs

export interface PackEntry {
  pack: Pack
  source: 'builtin' | 'user'
  issues: Issue[]
}

/** Load built-in packs (shipped with the site) plus packs the user loaded. User packs win on id clash. */
export async function loadAllPacks(): Promise<Record<string, PackEntry>> {
  const out: Record<string, PackEntry> = {}
  try {
    const index = (await (await fetch('packs/index.json')).json()) as { packs: string[] }
    await Promise.all(index.packs.map(async (id) => {
      const bytes = new Uint8Array(await (await fetch(`packs/${id}.cutie`)).arrayBuffer())
      const { pack, issues } = loadPackBytes(bytes)
      if (pack) out[pack.manifest.id] = { pack, source: 'builtin', issues }
    }))
  } catch (e) {
    console.error('Could not load built-in packs', e)
  }
  const ks = (await keys()).filter((k): k is string => typeof k === 'string' && k.startsWith(USER_PACK))
  for (const k of ks) {
    const bytes = await get<Uint8Array>(k)
    if (!bytes) continue
    const { pack, issues } = loadPackBytes(bytes)
    if (pack) out[pack.manifest.id] = { pack, source: 'user', issues }
  }
  return out
}

/** Check a pack file and, if it has no errors, keep it in the browser. */
export async function installPack(bytes: Uint8Array): Promise<{ pack: Pack | null; issues: Issue[] }> {
  const result = loadPackBytes(bytes)
  if (result.pack) await set(USER_PACK + result.pack.manifest.id, bytes)
  return result
}

export const removeUserPack = (id: string) => del(USER_PACK + id)

/** The original `.cutie` bytes for a pack, so the Studio can open a copy. */
export async function getPackBytes(id: string, source: 'builtin' | 'user'): Promise<Uint8Array | null> {
  if (source === 'user') return (await get<Uint8Array>(USER_PACK + id)) ?? null
  const res = await fetch(`packs/${id}.cutie`)
  return res.ok ? new Uint8Array(await res.arrayBuffer()) : null
}
