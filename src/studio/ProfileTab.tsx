import type { CutieManifest, Pack, Stage, TimeSlot } from '../engine/types'
import { assetLists, type Draft } from './draft'
import { BlurText, cleanName, Field, IconBtn, move, Num, NumList, Select, Text } from './fields'
import type { UpdateDraft } from './Studio'

interface Props {
  draft: Draft
  pack: Pack | null
  update: UpdateDraft
}

export function ProfileTab({ draft, update }: Props) {
  const m = draft.manifest
  const assets = assetLists(draft)
  const set = (patch: Partial<CutieManifest>) => update((d) => ({ ...d, manifest: { ...d.manifest, ...patch } }))
  const slots = m.timeSlots ?? []
  const stages = m.stages ?? []
  const setSlots = (s: TimeSlot[]) => set({ timeSlots: s })
  const setStages = (s: Stage[]) => set({ stages: s })
  const idle = m.idle ?? { everySeconds: 30, expressions: [] }

  return (
    <div className="studio-form">
      <section>
        <h3>Who they are</h3>
        <div className="sgrid">
          <Field label="Name"><Text value={m.name} onChange={(name) => set({ name })} /></Field>
          <Field label="Pack id" hint="Short, lowercase. Same id = replaces the old version."><BlurText mono value={m.id} onCommit={(v) => set({ id: cleanName(v) || m.id })} /></Field>
          <Field label="Made by"><Text value={m.author} onChange={(author) => set({ author: author || undefined })} placeholder="Your name" /></Field>
          <Field label="Introduction" wide hint="Shown when picking a cutie.">
            <textarea rows={3} value={m.intro} onChange={(e) => set({ intro: e.target.value })} />
          </Field>
          <Field label="Name color"><input type="color" value={m.colors?.name ?? '#6a4f8f'} onChange={(e) => set({ colors: { ...m.colors, name: e.target.value } })} /></Field>
          <Field label="Accent color"><input type="color" value={m.colors?.accent ?? '#b08ad8'} onChange={(e) => set({ colors: { ...m.colors, accent: e.target.value } })} /></Field>
        </div>
      </section>

      <section>
        <h3>Look</h3>
        <div className="sgrid">
          <Field label="Default expression"><Select value={m.defaultExpression} options={assets.expressions} onChange={(v) => set({ defaultExpression: v ?? '' })} /></Field>
          <Field label="Default background"><Select value={m.defaultBackground} options={assets.backgrounds} onChange={(v) => set({ defaultBackground: v ?? '' })} /></Field>
        </div>
      </section>

      <section>
        <h3>Times of day</h3>
        <p className="shint">Each slot starts at its time and lasts until the next one. Pick a background for each.</p>
        <table className="stable">
          <thead><tr><th>Slot</th><th>Starts</th><th>Background</th><th /></tr></thead>
          <tbody>
            {slots.map((s, i) => (
              <tr key={i}>
                <td><Text mono value={s.id} onChange={(v) => setSlots(slots.map((x, j) => (j === i ? { ...x, id: cleanName(v) } : x)))} /></td>
                <td><input type="time" value={s.start} onChange={(e) => setSlots(slots.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} /></td>
                <td><Select value={m.backgroundBySlot?.[s.id]} empty="(default)" options={assets.backgrounds}
                  onChange={(v) => {
                    const next = { ...m.backgroundBySlot }
                    if (v) next[s.id] = v; else delete next[s.id]
                    set({ backgroundBySlot: next })
                  }} /></td>
                <td><IconBtn title="Remove slot" danger onClick={() => setSlots(slots.filter((_, j) => j !== i))}>✕</IconBtn></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="pill" onClick={() => setSlots([...slots, { id: `slot${slots.length + 1}`, start: '12:00' }])}>+ Time slot</button>
      </section>

      <section>
        <h3>Affinity stages</h3>
        <p className="shint">As total words grow, the cutie moves up a stage. Each stage can have its own resting expression, and lines can check the stage.</p>
        <table className="stable">
          <thead><tr><th>Id</th><th>Name</th><th>From % of goal</th><th>Resting expression</th><th /></tr></thead>
          <tbody>
            {stages.map((s, i) => (
              <tr key={i}>
                <td><Text mono value={s.id} onChange={(v) => setStages(stages.map((x, j) => (j === i ? { ...x, id: cleanName(v) } : x)))} /></td>
                <td><Text value={s.name} onChange={(v) => setStages(stages.map((x, j) => (j === i ? { ...x, name: v } : x)))} /></td>
                <td><Num value={s.minTotalPct} min={0} onChange={(v) => setStages(stages.map((x, j) => (j === i ? { ...x, minTotalPct: v ?? 0 } : x)))} /></td>
                <td><Select value={s.defaultExpression} empty="(default)" options={assets.expressions}
                  onChange={(v) => setStages(stages.map((x, j) => (j === i ? { ...x, defaultExpression: v } : x)))} /></td>
                <td className="row-btns">
                  <IconBtn title="Move up" onClick={() => setStages(move(stages, i, i - 1))}>↑</IconBtn>
                  <IconBtn title="Remove stage" danger onClick={() => setStages(stages.filter((_, j) => j !== i))}>✕</IconBtn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="pill" onClick={() => setStages([...stages, { id: `stage${stages.length + 1}`, name: 'New stage', minTotalPct: 100 }])}>+ Stage</button>
      </section>

      <section>
        <h3>Milestones</h3>
        <p className="shint">These percentages always trigger. Ones without lines show a [PLACEHOLDER] while testing.</p>
        <div className="sgrid">
          <Field label="Daily goal %" hint="e.g. 10, 33, 50, 75, 100">
            <NumList value={m.milestones?.daily} onChange={(daily) => set({ milestones: { ...m.milestones, daily } })} />
          </Field>
          <Field label="Total goal %" hint="e.g. 10, 25, 50, 75, 100">
            <NumList value={m.milestones?.total} onChange={(total) => set({ milestones: { ...m.milestones, total } })} />
          </Field>
        </div>
      </section>

      <section>
        <h3>Random behaviour</h3>
        <div className="sgrid">
          <Field label="Chatter every (minutes)" hint="Rolls for a beat with the “random” trigger.">
            <Num value={m.ambient?.everyMinutes} min={0} onChange={(v) => set({ ambient: { chance: m.ambient?.chance ?? 0.3, everyMinutes: v ?? 0 } })} />
          </Field>
          <Field label="Chance each time (%)">
            <Num value={Math.round((m.ambient?.chance ?? 0) * 100)} min={0} max={100}
              onChange={(v) => set({ ambient: { everyMinutes: m.ambient?.everyMinutes ?? 20, chance: (v ?? 0) / 100 } })} />
          </Field>
          <Field label="Fidget every (seconds)" hint="Swap to a random resting expression while idle.">
            <Num value={idle.everySeconds} min={0} onChange={(v) => set({ idle: { ...idle, everySeconds: v ?? 0 } })} />
          </Field>
        </div>
        <table className="stable narrow">
          <thead><tr><th>Fidget expression</th><th>Odds</th><th /></tr></thead>
          <tbody>
            {idle.expressions.map((e, i) => (
              <tr key={i}>
                <td><Select value={e.expression} options={assets.expressions}
                  onChange={(v) => set({ idle: { ...idle, expressions: idle.expressions.map((x, j) => (j === i ? { ...x, expression: v ?? '' } : x)) } })} /></td>
                <td><Num value={e.weight} min={0} onChange={(v) => set({ idle: { ...idle, expressions: idle.expressions.map((x, j) => (j === i ? { ...x, weight: v ?? 0 } : x)) } })} /></td>
                <td><IconBtn title="Remove" danger onClick={() => set({ idle: { ...idle, expressions: idle.expressions.filter((_, j) => j !== i) } })}>✕</IconBtn></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="pill" onClick={() => set({ idle: { ...idle, expressions: [...idle.expressions, { expression: m.defaultExpression, weight: 1 }] } })}>+ Fidget</button>
      </section>
    </div>
  )
}
