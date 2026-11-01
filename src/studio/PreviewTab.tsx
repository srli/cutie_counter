import { useEffect, useMemo, useState } from 'react'
import { step, type Input } from '../engine/director'
import { computeStats, restingExpression, stageFor } from '../engine/progress'
import { seededRng } from '../engine/rng'
import { TRIGGER_TYPES, type Beat, type EngineEvent, type Pack, type Project, type Scene, type TriggerType } from '../engine/types'
import { CutiePane } from '../ui/CutiePane'
import { ScenePane } from '../ui/ScenePane'
import { TRIGGER_LABELS } from './BeatsTab'
import { Field, Num, Select, Text } from './fields'
import { defaultSim, simulate, type SimSettings } from './simulate'

interface Props {
  pack: Pack | null
  beat: Beat | null
  onClearBeat: () => void
  onOpenBeat: (id: string) => void
}

interface Run {
  project: Project
  now: Date
  scenes: Scene[]
  events: EngineEvent[]
}

export function PreviewTab({ pack, beat, onClearBeat, onOpenBeat }: Props) {
  const [sim, setSim] = useState<SimSettings>(defaultSim)
  const [what, setWhat] = useState<string>('open')
  const [value, setValue] = useState<string>('')
  const [run, setRun] = useState<Run | null>(null)
  const [pos, setPos] = useState({ scene: 0, line: 0 })
  const [flagText, setFlagText] = useState('')

  const set = (patch: Partial<SimSettings>) => setSim((s) => ({ ...s, ...patch }))

  function play(input: Input, p: Pack) {
    const r = simulate(p, sim, input)
    setRun({ project: r.project, now: r.now, scenes: r.scenes, events: r.events })
    setPos({ scene: 0, line: 0 })
  }

  function playChosen() {
    if (!pack) return
    if (what === 'open') return play({ kind: 'open' }, pack)
    const type = what as TriggerType
    const v = value === '' ? undefined : Number.isNaN(Number(value)) ? value : Number(value)
    play({ kind: 'event', event: { type, value: v } }, pack)
  }

  // "Preview" on a beat plays it directly, skipping its trigger and conditions.
  useEffect(() => {
    if (!beat || !pack) return
    const forced: Beat = { ...beat, id: beat.id, trigger: { type: 'random' }, when: undefined, repeat: 'always', cooldownMinutes: undefined, priority: 1e9 }
    const testPack: Pack = { ...pack, script: { ...pack.script, beats: [forced, ...pack.script.beats.filter((b) => b.id !== beat.id)] } }
    play({ kind: 'event', event: { type: 'random' } }, testPack)
  }, [beat, pack])

  const scene = run?.scenes[pos.scene]
  const line = scene?.lines[pos.line] ?? (pos.scene > 0 ? run?.scenes[pos.scene - 1]?.lines.at(-1) : undefined)
  const atEnd = !!scene && pos.line >= scene.lines.length - 1
  const choices = atEnd ? scene?.choices : undefined
  // In a full-screen scene a picture stays up until another picture, or "none".
  const sceneCg = useMemo(() => {
    let cg: string | null = null
    run?.scenes.forEach((s, si) => s.lines.forEach((l, li) => {
      if (si > pos.scene || (si === pos.scene && li > pos.line)) return
      if (s.display !== 'scene') cg = null
      else if (l.cg === 'none') cg = null
      else if (l.cg) cg = l.cg
    }))
    return cg
  }, [run, pos])

  const expression = useMemo(() => {
    if (!pack) return ''
    // Start from the face the writer would see at rest at this stage, like the real app.
    const stage = run?.project.stage ?? stageFor((sim.totalWords / sim.totalGoal) * 100, pack.manifest.stages)
    let e = restingExpression(pack.manifest, stage)
    run?.scenes.forEach((s, si) => s.lines.forEach((l, li) => {
      if (l.expression && (si < pos.scene || (si === pos.scene && li <= pos.line))) e = l.expression
    }))
    return e
  }, [run, pos, pack, sim])

  if (!pack) return <p className="shint empty-editor">Fix the problems listed at the top first, then the preview can run.</p>

  const project = run?.project ?? simulateIdle(pack, sim)
  const stats = computeStats(project, pack.manifest, run?.now ?? new Date(sim.when))
  const bgLine = run?.scenes.slice(0, pos.scene + 1).flatMap((s) => s.lines).reverse().find((l) => l.background)?.background
  const background = bgLine ?? pack.manifest.backgroundBySlot?.[stats.timeSlot] ?? pack.manifest.defaultBackground

  const advance = () => {
    if (!run || !scene) return
    if (pos.line < scene.lines.length - 1) setPos({ ...pos, line: pos.line + 1 })
    else if (!scene.choices?.length && pos.scene < run.scenes.length - 1) setPos({ scene: pos.scene + 1, line: 0 })
  }
  const choose = (choiceId: string) => {
    if (!run || !scene) return
    const r = step(run.project, { kind: 'choice', beatId: scene.beatId, choiceId }, pack, run.now, seededRng(sim.seed))
    const scenes = [...run.scenes.slice(0, pos.scene), { ...scene, choices: undefined }, ...r.scenes]
    setRun({ ...run, project: r.project, scenes })
    if (r.scenes.length) setPos({ scene: pos.scene + 1, line: 0 })
  }
  const pending = run ? run.scenes.length - pos.scene - 1 + (atEnd ? 0 : 1) : 0

  return (
    <div className="preview-layout">
      <aside className="studio-form preview-controls">
        {beat && (
          <div className="studio-notice">Playing beat <b className="mono">{beat.id}</b> directly. <button className="link" onClick={onClearBeat}>Back to free play</button></div>
        )}
        <section>
          <h3>Pretend it's…</h3>
          <div className="sgrid">
            <Field label="Date & time"><input type="datetime-local" value={sim.when} onChange={(e) => set({ when: e.target.value })} /></Field>
            <Field label="Project day" hint="Before morning, it's this day's night"><Num value={sim.day} min={1} onChange={(v) => set({ day: v ?? 1 })} /></Field>
            <Field label="Words today"><Num value={sim.todayWords} min={0} onChange={(v) => set({ todayWords: v ?? 0, totalWords: Math.max(sim.totalWords, v ?? 0) })} /></Field>
            <Field label="Total words"><Num value={sim.totalWords} min={0} onChange={(v) => set({ totalWords: Math.max(v ?? 0, sim.todayWords) })} /></Field>
            <Field label="Days away" hint="Blank days just before today"><Num value={sim.daysAway} min={0} onChange={(v) => set({ daysAway: v ?? 0 })} /></Field>
            <Field label="Player name"><Text value={sim.playerName} onChange={(playerName) => set({ playerName })} /></Field>
            <Field label="Flags" hint="e.g. fed=true, visits=3" wide>
              <input value={flagText} onChange={(e) => {
                setFlagText(e.target.value)
                const flags: SimSettings['flags'] = {}
                for (const part of e.target.value.split(',')) {
                  const [k, v] = part.split('=').map((s) => s.trim())
                  if (k) flags[k] = v === 'true' ? true : v === 'false' ? false : v !== undefined && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : (v ?? true)
                }
                set({ flags })
              }} />
            </Field>
            <Field label="Dice seed" hint="Change to see other random picks"><Num value={sim.seed} onChange={(v) => set({ seed: v ?? 1 })} /></Field>
          </div>
        </section>
        <section>
          <h3>…and then</h3>
          <div className="sgrid">
            <Field label="Something happens">
              <Select value={what} options={[{ value: 'open', label: 'Open the story (full start-up)' },
                ...TRIGGER_TYPES.filter((t) => t !== 'session_start').map((t) => ({ value: t, label: TRIGGER_LABELS[t] }))]}
                onChange={(v) => { setWhat(v ?? 'open'); setValue('') }} />
            </Field>
            {what !== 'open' && what !== 'random' && (
              <Field label="Which one">
                {what === 'time_slot'
                  ? <Select value={value} empty="(pick)" options={(pack.manifest.timeSlots ?? []).map((s) => s.id)} onChange={(v) => setValue(v ?? '')} />
                  : what === 'stage'
                    ? <Select value={value} empty="(pick)" options={(pack.manifest.stages ?? []).map((s) => s.id)} onChange={(v) => setValue(v ?? '')} />
                    : <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={what === 'date' ? '10-31' : '50'} />}
              </Field>
            )}
          </div>
          <button className="pill primary" onClick={() => { onClearBeat(); playChosen() }}>▶ Play</button>
        </section>
        {run && (
          <section>
            <h3>What happened</h3>
            <p className="shint">Events: {run.events.map((e) => `${e.type}${e.value !== undefined ? ` ${e.value}` : ''}`).join(', ') || 'none'}</p>
            <ul className="played">
              {run.scenes.map((s, i) => (
                <li key={i}>
                  {s.placeholder ? <span className="ph-badge">placeholder</span>
                    : <button className="link mono" onClick={() => onOpenBeat(s.beatId.split('/')[0])}>{s.beatId}</button>}
                  {' '}<small>{s.lines.length} line{s.lines.length === 1 ? '' : 's'}{s.choices?.length ? `, ${s.choices.length} choices` : ''}</small>
                </li>
              ))}
              {!run.scenes.length && <li className="shint">No beat matched, and nothing needed a placeholder.</li>}
            </ul>
          </section>
        )}
      </aside>
      <div className={`preview-stage ${scene?.display === 'scene' ? 'wide' : ''}`}>
        {scene?.display === 'scene'
          ? <div className="preview-scene">
              <ScenePane
                pack={pack} project={project} line={line} prompt={scene.prompt} choices={choices}
                pending={pending} expression={expression} background={background} cg={sceneCg}
                onAdvance={advance} onChoose={choose} onClose={() => setRun(null)} onSkip={() => setRun(null)}
              />
            </div>
          : <CutiePane
              pack={pack} project={project} stats={stats} line={line} prompt={scene?.prompt} choices={choices}
              pending={pending} expression={expression} background={background} cg={null}
              onAdvance={advance} onChoose={choose} onDismissCg={() => {}}
            />}
      </div>
    </div>
  )
}

/** Before anything is played, show the scene as the settings describe it. */
function simulateIdle(pack: Pack, sim: SimSettings): Project {
  return simulate(pack, sim, { kind: 'tick' }).project
}
