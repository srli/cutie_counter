import { useEffect, useState } from 'react'
import type { Packs } from '../App'
import type { Project } from '../engine/types'
import { imageUrl } from '../pack/load'
import { deleteProject, listProjects, restoreProject, setLastProjectId } from '../store'
import { download, fmt, pickFile, slug } from './files'

interface Props {
  packs: Packs
  go: (path: string) => void
}

export function exportBackup(p: Project) {
  download(`${slug(p.title)}.cutiestory.json`, JSON.stringify({ kind: 'cutie-counter-story', version: 1, project: p }, null, 2), 'application/json')
}

export function Stories({ packs, go }: Props) {
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [error, setError] = useState('')
  const refresh = () => void listProjects().then(setProjects)
  useEffect(refresh, [])

  async function importBackup() {
    const file = await pickFile('.json')
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      const p = data?.project as Project | undefined
      if (data?.kind !== 'cutie-counter-story' || !p?.id) throw new Error('not a story backup')
      await restoreProject(p)
      setError('')
      refresh()
    } catch {
      setError("That file isn't a Cutie Counter story backup.")
    }
  }

  async function remove(p: Project) {
    if (!confirm(`Delete "${p.title}"? This can't be undone. Export a backup first if unsure.`)) return
    await deleteProject(p.id)
    refresh()
  }

  async function open(p: Project) {
    await setLastProjectId(p.id)
    go(`write/${p.id}`)
  }

  return (
    <div className="stories-screen">
      <button className="back-link" onClick={() => go('')}>‹ Menu</button>
      <h1 className="title">Your Stories</h1>
      {projects?.length === 0 && <p className="hint">No stories yet. Start one from the menu, or import a backup.</p>}
      <ul className="story-list">
        {projects?.map((p) => {
          const pack = packs[p.cutieId]?.pack
          const pct = Math.min(100, (p.wordCount / p.totalGoal) * 100)
          return (
            <li key={p.id} className="story-row">
              {pack ? <img src={imageUrl(pack, 'select')} alt="" /> : <div className="missing-cutie" title="This cutie isn't loaded">?</div>}
              <div className="story-info">
                <b>{p.title}</b>
                <span>{fmt(p.wordCount)} / {fmt(p.totalGoal)} words · with {pack?.manifest.name ?? p.cutieId}</span>
                <div className="mini-bar"><div style={{ width: `${pct}%` }} /></div>
              </div>
              <div className="story-actions">
                <button className="pill primary" onClick={() => open(p)} disabled={!pack}>Open</button>
                <button className="pill" onClick={() => exportBackup(p)}>Back up</button>
                <button className="pill danger" onClick={() => remove(p)}>Delete</button>
              </div>
            </li>
          )
        })}
      </ul>
      <button className="pill" onClick={importBackup}>Import a backup…</button>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
