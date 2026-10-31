import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { newProject } from './engine/director'
import { getProject, restoreProject, saveProject, saveProjectIfUnchanged } from './store'

const story = (id: string) => newProject({
  id, title: 'Novel', playerName: 'Sam', cutieId: 'ryder', totalGoal: 50_000, dailyGoal: 1667,
  now: new Date('2026-11-01T09:00'), startDate: '2026-11-01',
})

describe('saving a story open in two tabs', () => {
  it('never lets the stale tab overwrite newer writing', async () => {
    const p = story('two-tabs')
    await saveProject(p)
    // Both tabs opened the story at revision 0. Tab B writes first.
    expect(await saveProjectIfUnchanged({ ...p, doc: 'newer words from tab B' }, 0)).toBe(1)
    // Tab A's clock tick tries to save its old copy: refused, nothing written.
    expect(await saveProjectIfUnchanged({ ...p, doc: 'old copy in tab A' }, 0)).toBeNull()
    expect((await getProject(p.id))?.doc).toBe('newer words from tab B')
    // Tab B keeps saving normally.
    expect(await saveProjectIfUnchanged({ ...p, doc: 'even newer' }, 1)).toBe(2)
  })

  it('makes an open tab stop saving when a backup is restored over its story', async () => {
    const p = story('restore')
    await saveProject(p)
    expect(await saveProjectIfUnchanged({ ...p, doc: 'draft' }, 0)).toBe(1)
    await restoreProject({ ...p, doc: 'from backup', rev: 0 })
    expect(await saveProjectIfUnchanged({ ...p, doc: 'draft, more' }, 1)).toBeNull()
    expect((await getProject(p.id))?.doc).toBe('from backup')
  })
})
