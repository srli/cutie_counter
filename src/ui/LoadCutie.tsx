import { useState, type DragEvent } from 'react'
import type { Pack } from '../engine/types'
import { imageUrl, PACK_EXTENSION } from '../pack/load'
import type { Issue } from '../pack/validate'
import { installPack } from '../store'
import { pickFile } from './files'

interface Props {
  onClose: () => void
  onLoaded: () => void
}

/** Drop or pick a .cutie (or .zip) pack. Shows friendly problems instead of failing silently. */
export function LoadCutie({ onClose, onLoaded }: Props) {
  const [issues, setIssues] = useState<Issue[]>([])
  const [loaded, setLoaded] = useState<Pack | null>(null)
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)

  async function take(file: File | null | undefined) {
    if (!file) return
    setBusy(true)
    const { pack, issues } = await installPack(new Uint8Array(await file.arrayBuffer()))
    setBusy(false)
    setIssues(issues)
    setLoaded(pack)
    if (pack) onLoaded()
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    void take(e.dataTransfer.files[0])
  }

  const errors = issues.filter((i) => i.level === 'error')
  const warnings = issues.filter((i) => i.level === 'warning')

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-label="Load a cutie" onClick={(e) => e.stopPropagation()}>
        <h2 className="title">Load a Cutie</h2>

        {loaded ? (
          <div className="load-success">
            <img src={imageUrl(loaded, 'select')} alt="" />
            <p><b>{loaded.manifest.name}</b> is ready! You can pick them when starting a new story.</p>
          </div>
        ) : (
          <div
            className={`dropzone ${over ? 'over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setOver(true) }}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
            onClick={async () => take(await pickFile(`${PACK_EXTENSION},.zip`))}
          >
            <div className="dropzone-heart">♡</div>
            {busy ? 'Checking…' : <>Drop a <code>{PACK_EXTENSION}</code> or <code>.zip</code> file here, or click to choose one</>}
          </div>
        )}

        {errors.length > 0 && (
          <div className="issues">
            <p>This pack has {errors.length === 1 ? 'a problem' : `${errors.length} problems`} to fix first:</p>
            <ul>{errors.map((i, n) => <li key={n}><b>{i.where}</b>: {i.message}</li>)}</ul>
          </div>
        )}
        {warnings.length > 0 && (
          <div className="issues warn">
            <p>Heads up:</p>
            <ul>{warnings.map((i, n) => <li key={n}><b>{i.where}</b>: {i.message}</li>)}</ul>
          </div>
        )}

        <details className="pack-help">
          <summary>What goes in a cutie pack?</summary>
          <p>A zip with this inside:</p>
          <pre>{`cutie.json     name, intro, stages
script.json    what they say, and when
images/
  select.png   portrait for the picker
  neutral.png  one image per expression
  happy.png
  bg_room.png  backgrounds start with bg_
  cg_hug.png   reward art starts with cg_`}</pre>
          <p>Easiest start: <a href="packs/ryder.cutie" download>download Ryder's pack</a>, rename it to <code>.zip</code>, open it, and swap in your own art and lines.</p>
        </details>

        <div className="modal-actions">
          <button className="pill" onClick={onClose}>{loaded ? 'Done' : 'Close'}</button>
        </div>
      </div>
    </div>
  )
}
