import { useEffect, useState } from 'react'
import type { Packs } from '../App'
import { restingExpression } from '../engine/progress'
import type { Project } from '../engine/types'
import { imageUrl } from '../pack/load'
import { getLastProjectId, getProject } from '../store'
import { LoadCutie } from './LoadCutie'

interface Props {
  packs: Packs
  go: (path: string) => void
  reloadPacks: () => Promise<void>
}

function MenuOption({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button className="menu-option" onClick={onClick} disabled={disabled}>
      <span className="heart" aria-hidden /> {label} <span className="heart" aria-hidden />
    </button>
  )
}

export function Menu({ packs, go, reloadPacks }: Props) {
  const [last, setLast] = useState<Project | null>(null)
  const [loadingCutie, setLoadingCutie] = useState(false)

  useEffect(() => {
    void getLastProjectId().then(async (id) => setLast((id && (await getProject(id))) || null))
  }, [])

  const peek = last ? packs[last.cutieId]?.pack : Object.values(packs)[0]?.pack

  return (
    <div className="menu-screen">
      <div className="menu-card">
        <img className="logo" src="ui/menuscreenlogo.png" alt="Cutie Counter" />
        <nav className="menu-options">
          {last && <MenuOption label="Continue" onClick={() => go(`write/${last.id}`)} />}
          <MenuOption label="New Story" onClick={() => go('setup')} />
          <MenuOption label="Load Story" onClick={() => go('stories')} />
          <MenuOption label="Load Cutie" onClick={() => setLoadingCutie(true)} />
          <MenuOption label="Cutie Studio" onClick={() => go('studio')} />
        </nav>
        {last && <p className="menu-hint">Last story: <b>{last.title}</b></p>}
      </div>
      {peek && <img className="menu-peek" src={imageUrl(peek, 'expression', restingExpression(peek.manifest, last?.stage))} alt="" />}
      {loadingCutie && <LoadCutie onClose={() => setLoadingCutie(false)} onLoaded={() => void reloadPacks()} />}
    </div>
  )
}
