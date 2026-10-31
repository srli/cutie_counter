import { useState } from 'react'
import type { Pack, Project } from '../engine/types'
import { imageUrl } from '../pack/load'

/** Reward art seen so far in this story; the rest show as locked hearts. */
export function Gallery({ pack, project, onClose }: { pack: Pack; project: Project; onClose: () => void }) {
  const [big, setBig] = useState<string | null>(null)
  const seen = new Set(project.gallery ?? [])
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal gallery" role="dialog" aria-label="Gallery" onClick={(e) => e.stopPropagation()}>
        <h2 className="title">Memories with {pack.manifest.name}</h2>
        {pack.cgs.length === 0
          ? <p className="hint">{pack.manifest.name} doesn't have any special pictures yet.</p>
          : <p className="hint">{seen.size} of {pack.cgs.length} found. Keep writing to find the rest ♡</p>}
        <div className="gallery-grid">
          {pack.cgs.map((cg) => seen.has(cg)
            ? <button key={cg} className="gallery-item" onClick={() => setBig(cg)}><img src={imageUrl(pack, 'cg', cg)} alt={cg} /></button>
            : <div key={cg} className="gallery-item locked" aria-label="Locked">♡</div>)}
        </div>
        <div className="modal-actions"><button className="pill" onClick={onClose}>Close</button></div>
      </div>
      {big && (
        <button className="cg" style={{ position: 'fixed' }} onClick={(e) => { e.stopPropagation(); setBig(null) }} aria-label="Close picture">
          <img src={imageUrl(pack, 'cg', big)} alt="" />
        </button>
      )}
    </div>
  )
}
