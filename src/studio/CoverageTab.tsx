import { useMemo, useState } from 'react'
import type { Beat } from '../engine/types'
import { uniqueId } from './BeatsTab'
import { coverage, type Cell, type CellState } from './coverage'
import type { Draft } from './draft'
import type { UpdateDraft } from './Studio'

const LEGEND: { state: CellState; label: string }[] = [
  { state: 'specific', label: 'Written for this day' },
  { state: 'generic', label: 'Covered by a general line' },
  { state: 'placeholder', label: 'Placeholder' },
  { state: 'missing', label: 'Nothing yet' },
]

interface Props {
  draft: Draft
  update: UpdateDraft
  onOpenBeat: (id: string) => void
}

export function CoverageTab({ draft, update, onOpenBeat }: Props) {
  const [days, setDays] = useState(30)
  const cov = useMemo(() => coverage(draft.manifest, draft.script, days), [draft, days])

  function open(cell: Cell, label: string) {
    if (cell.beatIds.length) return onOpenBeat(cell.beatIds[0])
    const { type, value } = cell.trigger
    const base = cell.day !== undefined
      ? `d${cell.day}-${type === 'time_slot' ? value : `daily-${value}`}`
      : `${type === 'stage' ? 'stage' : 'total'}-${value}`
    const id = uniqueId(draft.script.beats, base)
    const beat: Beat = {
      id,
      trigger: { type, value },
      when: cell.day !== undefined ? [{ var: 'day', op: '==', value: cell.day }] : undefined,
      lines: [{ text: '', expression: draft.manifest.defaultExpression }],
      note: `Made from the coverage grid (${label}).`,
    }
    update((d) => ({ ...d, script: { ...d.script, beats: [...d.script.beats, beat] } }))
    onOpenBeat(id)
  }

  const cellBtn = (cell: Cell, label: string) => (
    <button className={`cov-cell ${cell.state}`} onClick={() => open(cell, label)}
      title={cell.beatIds.length ? `${label}: ${cell.beatIds.join(', ')}` : `${label}: click to write one`}>
      {cell.beatIds.length > 1 ? cell.beatIds.length : ''}
    </button>
  )

  const total = Object.values(cov.summary).reduce((a, b) => a + b, 0)
  const done = cov.summary.specific + cov.summary.generic

  return (
    <div className="studio-form">
      <section>
        <h3>What's written so far</h3>
        <div className="cov-progress">
          <div className="mini-bar"><div style={{ width: `${(done / Math.max(1, total)) * 100}%` }} /></div>
          <span>{done} of {total} moments have lines</span>
          <label className="shint">Days: <input type="number" min={1} max={365} value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value)))} /></label>
        </div>
        <div className="cov-legend">
          {LEGEND.map((l) => <span key={l.state}><i className={`cov-cell ${l.state}`} /> {l.label} ({cov.summary[l.state]})</span>)}
        </div>
      </section>

      <section>
        <h3>Whole-goal milestones and stages</h3>
        <div className="cov-strip">
          {cov.total.map((t) => <div key={t.label} className="cov-strip-item"><span>{t.label}</span>{cellBtn(t.cell, `whole goal ${t.label}`)}</div>)}
          {cov.stages.map((s) => <div key={s.label} className="cov-strip-item"><span>♥ {s.label}</span>{cellBtn(s.cell, `stage ${s.label}`)}</div>)}
        </div>
      </section>

      <section>
        <h3>Each day</h3>
        <div className="cov-scroll">
          <table className="cov-table">
            <thead>
              <tr>
                <th />
                {cov.columns.map((c) => <th key={c.key} className={c.type === 'daily_pct' ? 'daily' : ''}>{c.label}</th>)}
              </tr>
              <tr className="cov-groups">
                <th />
                <th colSpan={cov.columns.filter((c) => c.type === 'time_slot').length}>Time of day</th>
                <th colSpan={cov.columns.filter((c) => c.type === 'daily_pct').length} className="daily">Today's goal</th>
              </tr>
            </thead>
            <tbody>
              {cov.days.map((d) => (
                <tr key={d.day}>
                  <th>Day {d.day}</th>
                  {d.cells.map((c, i) => <td key={i} className={cov.columns[i].type === 'daily_pct' ? 'daily' : ''}>{cellBtn(c, `day ${d.day} · ${cov.columns[i].label}`)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
