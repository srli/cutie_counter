import { useState } from 'react'
import type { Beat } from '../engine/types'
import { cutiesIn, exportCutie, helpSheets, importCutie, type Problem } from '../sheet/workbook'
import { readXlsx, writeXlsx } from '../sheet/xlsx'
import { download, pickFile } from '../ui/files'
import { assetLists, type Draft } from './draft'
import type { UpdateDraft } from './Studio'

interface Plan {
  file: string
  beats: Beat[]
  problems: Problem[]
  tabs: string[]
  added: string[]
  changed: string[]
  removed: string[]
}

/** Download this cutie's script as a workbook the artist can edit in Google Sheets. */
export function downloadSheet(draft: Draft) {
  const tabs = exportCutie(draft.manifest, draft.script, assetLists(draft).expressions)
  download(`${draft.manifest.id}-script.xlsx`, writeXlsx([...helpSheets(), ...tabs]) as BlobPart,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
}

/** Pick an .xlsx, show what would change, and apply it on confirm. */
export function SheetImport({ draft, update, onClose }: { draft: Draft; update: UpdateDraft; onClose: () => void }) {
  const [plan, setPlan] = useState<Plan | null>(null)
  const [error, setError] = useState('')

  async function choose() {
    const file = await pickFile('.xlsx')
    if (!file) return
    setError('')
    try {
      const sheets = readXlsx(new Uint8Array(await file.arrayBuffer()))
      const res = importCutie(sheets, draft.manifest)
      if (!res.tabs.length) {
        const found = cutiesIn(sheets)
        setError(found.length
          ? `This workbook has tabs for ${found.join(', ')}, but none for ${draft.manifest.name}. Tabs should be named like "${draft.manifest.name} – Time of day".`
          : res.problems[0]?.message ?? 'No script tabs found.')
        return
      }
      const before = new Map(draft.script.beats.map((b) => [b.id, JSON.stringify(b)]))
      const after = new Set(res.beats.map((b) => b.id))
      setPlan({
        file: file.name,
        ...res,
        added: res.beats.filter((b) => !before.has(b.id)).map((b) => b.id),
        changed: res.beats.filter((b) => before.has(b.id) && before.get(b.id) !== JSON.stringify(b)).map((b) => b.id),
        removed: draft.script.beats.filter((b) => !after.has(b.id)).map((b) => b.id),
      })
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function apply() {
    if (!plan) return
    update((d) => ({ ...d, script: { ...d.script, beats: plan.beats } }))
    onClose()
  }

  const blocked = !!plan?.problems.length
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal sheet-import" role="dialog" aria-label="Import spreadsheet" onClick={(e) => e.stopPropagation()}>
        <h2 className="title">Import spreadsheet</h2>
        {!plan && <>
          <p className="hint">In Google Sheets: <b>File → Download → Microsoft Excel (.xlsx)</b>. Then pick that file here.
            Tabs named <b>“{draft.manifest.name} – …”</b> replace {draft.manifest.name}'s script. Nothing changes until you press Apply.</p>
          <div className="modal-actions">
            <button className="pill" onClick={() => downloadSheet(draft)}>Download current script first</button>
            <button className="pill primary" onClick={choose}>Choose .xlsx…</button>
          </div>
        </>}
        {error && <p className="error">{error}</p>}
        {plan && <>
          <p className="hint">From <b>{plan.file}</b> · {plan.tabs.length} tabs · {plan.beats.length} moments</p>
          <table className="stable narrow import-summary">
            <tbody>
              <tr><td>New</td><td><b>{plan.added.length}</b></td></tr>
              <tr><td>Changed</td><td><b>{plan.changed.length}</b></td></tr>
              <tr><td>Removed</td><td><b>{plan.removed.length}</b></td></tr>
            </tbody>
          </table>
          {plan.removed.length > 0 && (
            <details className="pack-help"><summary>Removed: not in the spreadsheet</summary><p className="mono">{plan.removed.join(', ')}</p></details>
          )}
          {blocked && (
            <div className="issues">
              <p>Fix {plan.problems.length === 1 ? 'this' : `these ${plan.problems.length}`} in the spreadsheet, then import again:</p>
              <ul>{plan.problems.map((p, i) => <li key={i}><b>{p.where}</b>: {p.message}</li>)}</ul>
            </div>
          )}
          <div className="modal-actions">
            <button className="pill" onClick={() => setPlan(null)}>Pick another file</button>
            <button className="pill primary" disabled={blocked} onClick={apply}>Apply</button>
          </div>
        </>}
      </div>
    </div>
  )
}
