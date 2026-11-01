import { useEffect, useState } from 'react'
import type { Choice, Line, Pack, Project, Stats } from '../engine/types'
import { isPlaceholderText } from '../engine/text'
import { imageUrl } from '../pack/load'
import { fmt } from './files'

interface Props {
  pack: Pack
  project: Project
  stats: Stats
  line?: Line
  prompt?: string
  choices?: Choice[]
  pending: number
  expression: string
  background: string
  cg: string | null
  onAdvance: () => void
  onChoose: (id: string) => void
  onDismissCg: () => void
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** "Day 3", or a countdown before the story's first day. */
function dayLabel(day: number): string {
  if (day >= 1) return `Day ${day}`
  return day === 0 ? 'Day 1 is tomorrow' : `Day 1 in ${1 - day} days`
}

/** Reveal text a few characters at a time. Click finishes it early. */
export function useTypewriter(text: string): [string, boolean, () => void] {
  const [n, setN] = useState(0)
  useEffect(() => setN(reducedMotion() ? text.length : 0), [text])
  useEffect(() => {
    if (n >= text.length) return
    const id = window.setTimeout(() => setN((x) => Math.min(text.length, x + 2)), 22)
    return () => window.clearTimeout(id)
  }, [n, text])
  return [text.slice(0, n), n >= text.length, () => setN(text.length)]
}

function Meter({ label, value, goal, accent }: { label: string; value: number; goal: number; accent?: boolean }) {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0
  return (
    <div className={`meter ${accent ? 'accent' : ''}`} title={`${Math.floor((value / goal) * 100)}%`}>
      <span className="meter-label">{label}</span>
      <div className="meter-track">
        <div className="meter-fill" style={{ width: `${pct}%` }} />
        <span className="meter-text">{fmt(value)} / {fmt(goal)}</span>
      </div>
    </div>
  )
}

export function CutiePane(p: Props) {
  const { pack, project, stats, line } = p
  const [shown, done, finish] = useTypewriter(line?.text ?? '')
  const placeholder = !!line && isPlaceholderText(line.text)
  const thought = line?.style === 'thought'
  const narrator = line?.speaker === 'narrator'
  const speaker = line?.speaker === 'player' ? project.playerName : narrator ? '' : line?.speaker ?? pack.manifest.name
  const stage = pack.manifest.stages?.find((s) => s.id === stats.stage)

  const onBox = () => (done ? p.onAdvance() : finish())

  return (
    <section className="cutie-pane" aria-label={`${pack.manifest.name}'s room`}
      style={{ ['--accent' as string]: pack.manifest.colors?.accent, ['--name' as string]: pack.manifest.colors?.name }}>
      <img className="scene-bg" src={imageUrl(pack, 'background', p.background)} alt="" />
      <img className="sprite" key={p.expression} src={imageUrl(pack, 'expression', p.expression)} alt={`${pack.manifest.name}, ${p.expression}`} />

      <div className="hud">
        <Meter label="Today" value={stats.todayWords} goal={project.dailyGoal} />
        <Meter label="Total" value={stats.totalWords} goal={project.totalGoal} accent />
        <div className="hud-chips">
          <span className="chip">{dayLabel(stats.day)}</span>
          {stage && <span className="chip heart-chip">♥ {stage.name}</span>}
          {stats.streak > 1 && <span className="chip">🔥 {stats.streak}</span>}
        </div>
      </div>

      {p.choices && (
        <div className="choices">
          {p.prompt && <div className="choice-prompt">{project.playerName}: “{p.prompt}”</div>}
          {p.choices.map((c) => (
            <button key={c.id} className="choice" onClick={() => p.onChoose(c.id)}>{c.text}</button>
          ))}
        </div>
      )}

      <div className={`textbox ${placeholder ? 'placeholder' : ''} ${done && p.pending > 0 && !p.choices ? 'has-more' : ''}`} onClick={onBox} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onBox() } }}>
        {speaker && <div className="textbox-name">{speaker}</div>}
        <div className={`textbox-text ${thought ? 'thought' : ''} ${narrator ? 'narration' : ''}`}>
          {thought && shown ? `(${shown}${done ? ')' : ''}` : shown}
        </div>
        {done && p.pending > 0 && !p.choices && <span className="more">click for more ▸</span>}
      </div>

      {p.cg && (
        <button className="cg" onClick={p.onDismissCg} aria-label="Close picture">
          <img src={imageUrl(pack, 'cg', p.cg)} alt="" />
        </button>
      )}
    </section>
  )
}
