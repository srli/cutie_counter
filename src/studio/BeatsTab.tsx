import { useMemo, useState } from 'react'
import {
  CONDITION_OPS, TRIGGER_TYPES,
  type Beat, type Choice, type Condition, type ConditionVar, type FlagEffect, type Line, type Pack, type Repeat, type TriggerType,
} from '../engine/types'
import { assetLists, type Draft } from './draft'
import { BlurText, cleanName, Field, IconBtn, move, Num, Select, Text } from './fields'
import type { UpdateDraft } from './Studio'

export const TRIGGER_LABELS: Record<TriggerType, string> = {
  session_start: 'Story is opened',
  reopen: 'Story is reopened the same day',
  day_start: 'A new day starts',
  time_slot: 'Time of day begins',
  daily_pct: "Today's goal reaches %",
  total_pct: 'Whole goal reaches %',
  words_today: 'Words today reach',
  words_total: 'Total words reach',
  words_every: 'Every N words',
  date: 'Calendar date',
  stage: 'Moves up to stage',
  streak: 'Writing streak reaches (days)',
  idle: 'No typing for (minutes)',
  random: 'Random chatter',
  after: 'Right after',
}

const VAR_LABELS: Record<string, string> = {
  day: 'Project day', date: 'Date (MM-DD)', weekday: 'Weekday (0=Sun)', hour: 'Hour (0-23)', timeSlot: 'Time of day',
  stage: 'Stage', totalWords: 'Total words', todayWords: 'Words today', totalPct: 'Whole goal %', dailyPct: "Today's goal %",
  missedDays: 'Missed days (total)', daysAway: 'Days away (just now)', streak: 'Streak (days)', chance: 'Random chance (0-1)',
  flag: 'Flag…', seen: 'Has seen beat…',
}

const NO_VALUE: TriggerType[] = ['session_start', 'reopen', 'random']
const NUMERIC: TriggerType[] = ['day_start', 'daily_pct', 'total_pct', 'words_today', 'words_total', 'words_every', 'streak', 'idle']

function parseValue(raw: string): string | number | boolean {
  if (raw === 'true') return true
  if (raw === 'false') return false
  return raw.trim() !== '' && !Number.isNaN(Number(raw)) ? Number(raw) : raw
}

const allLines = (b: Beat) => [...(b.lines ?? []), ...(b.variants ?? []).flat()]
const isPlaceholder = (b: Beat) => allLines(b).some((l) => /\[PLACEHOLDER/i.test(l.text))

export function triggerSummary(b: Beat): string {
  const v = b.trigger.value
  return `${TRIGGER_LABELS[b.trigger.type] ?? b.trigger.type}${v !== undefined ? `: ${v}` : ''}`
}

export function uniqueId(beats: Beat[], base: string): string {
  const ids = new Set(beats.map((b) => b.id))
  if (!ids.has(base)) return base
  for (let n = 2; ; n++) if (!ids.has(`${base}-${n}`)) return `${base}-${n}`
}

// ------------------------------------------------------------------ tab

interface Props {
  draft: Draft
  pack: Pack | null
  update: UpdateDraft
  selected: string | null
  onSelect: (id: string | null) => void
  onPlay: (b: Beat) => void
}

export function BeatsTab({ draft, update, selected, onSelect, onPlay }: Props) {
  const [query, setQuery] = useState('')
  const [type, setType] = useState<string>('')
  const beats = draft.script.beats
  const shown = beats.filter((b) =>
    (!type || b.trigger.type === type)
    && (!query || `${b.id} ${allLines(b).map((l) => l.text).join(' ')} ${b.note ?? ''}`.toLowerCase().includes(query.toLowerCase())))
  const current = beats.find((b) => b.id === selected) ?? null

  const setBeats = (fn: (bs: Beat[]) => Beat[]) => update((d) => ({ ...d, script: { ...d.script, beats: fn(d.script.beats) } }))

  function addBeat() {
    const id = uniqueId(beats, 'new-beat')
    setBeats((bs) => [...bs, { id, trigger: { type: 'session_start' }, lines: [{ text: '', expression: draft.manifest.defaultExpression }] }])
    onSelect(id)
  }

  return (
    <div className="beats-layout">
      <aside className="beat-list">
        <div className="beat-filters">
          <input placeholder="Search lines…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <Select value={type} empty="All triggers" options={TRIGGER_TYPES.map((t) => ({ value: t, label: TRIGGER_LABELS[t] }))} onChange={(v) => setType(v ?? '')} />
        </div>
        <button className="pill primary" onClick={addBeat}>+ New beat</button>
        <p className="shint">{shown.length} of {beats.length} beats</p>
        <ul>
          {shown.map((b) => (
            <li key={b.id}>
              <button className={`beat-item ${b.id === selected ? 'on' : ''}`} onClick={() => onSelect(b.id)}>
                <b className="mono">{b.id}</b>
                {isPlaceholder(b) && <span className="ph-badge">placeholder</span>}
                <small>{triggerSummary(b)}{b.when?.length ? ` · ${b.when.length} condition${b.when.length > 1 ? 's' : ''}` : ''}</small>
                <span className="snippet">{allLines(b)[0]?.text || (b.choices?.length ? `(${b.choices.length} choices)` : '(empty)')}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <section className="beat-editor">
        {current
          ? <BeatEditor key={current.id} beat={current} draft={draft}
              onChange={(next) => setBeats((bs) => bs.map((b) => (b.id === current.id ? next : b)))}
              onRename={(id) => {
                const nid = uniqueId(beats.filter((b) => b.id !== current.id), cleanName(id) || current.id)
                setBeats((bs) => bs.map((b) => {
                  // Keep "after" links pointing at the renamed beat.
                  const t = b.trigger.type === 'after' && typeof b.trigger.value === 'string' && b.trigger.value.split('/')[0] === current.id
                    ? { ...b.trigger, value: b.trigger.value.replace(current.id, nid) } : b.trigger
                  return b.id === current.id ? { ...b, id: nid, trigger: t } : { ...b, trigger: t }
                }))
                onSelect(nid)
              }}
              onDuplicate={() => {
                const id = uniqueId(beats, `${current.id}-copy`)
                setBeats((bs) => [...bs, { ...structuredClone(current), id }])
                onSelect(id)
              }}
              onDelete={() => {
                if (!confirm(`Delete beat ${current.id}?`)) return
                setBeats((bs) => bs.filter((b) => b.id !== current.id))
                onSelect(null)
              }}
              onPlay={() => onPlay(current)}
            />
          : <p className="shint empty-editor">Pick a beat on the left, or make a new one. A beat is: <b>when</b> something happens, <b>if</b> some things are true, <b>say</b> these lines.</p>}
      </section>
    </div>
  )
}

// ------------------------------------------------------------------ beat editor

interface EditorProps {
  beat: Beat
  draft: Draft
  onChange: (b: Beat) => void
  onRename: (id: string) => void
  onDuplicate: () => void
  onDelete: () => void
  onPlay: () => void
}

function BeatEditor({ beat, draft, onChange, onRename, onDuplicate, onDelete, onPlay }: EditorProps) {
  const set = (patch: Partial<Beat>) => onChange({ ...beat, ...patch })
  const assets = useMemo(() => assetLists(draft), [draft])
  const m = draft.manifest
  const t = beat.trigger
  const afterTargets = draft.script.beats.filter((b) => b.id !== beat.id).flatMap((b) => [b.id, ...(b.choices ?? []).map((c) => `${b.id}/${c.id}`)])

  const valueInput = () => {
    if (NO_VALUE.includes(t.type)) return null
    const setV = (value: string | number | undefined) => set({ trigger: { ...t, value } })
    if (t.type === 'time_slot') return <Select value={t.value as string} empty="(any)" options={(m.timeSlots ?? []).map((s) => s.id)} onChange={setV} />
    if (t.type === 'stage') return <Select value={t.value as string} empty="(any)" options={(m.stages ?? []).map((s) => ({ value: s.id, label: s.name }))} onChange={setV} />
    if (t.type === 'after') return <Select value={t.value as string} empty="(pick one)" options={afterTargets} onChange={setV} />
    if (t.type === 'date') return <Text value={t.value as string} placeholder="10-31" onChange={(v) => setV(v || undefined)} />
    if (NUMERIC.includes(t.type)) return <Num value={t.value as number} min={0} placeholder="any" onChange={setV} />
    return <Text value={String(t.value ?? '')} onChange={(v) => setV(v || undefined)} />
  }

  const usesVariants = !!beat.variants?.length

  return (
    <div className="studio-form">
      <div className="beat-head">
        <Field label="Beat id"><BlurText mono value={beat.id} onCommit={onRename} /></Field>
        <div className="beat-actions">
          <button className="pill primary" onClick={onPlay}>▶ Preview</button>
          <button className="pill" onClick={onDuplicate}>Duplicate</button>
          <button className="pill danger" onClick={onDelete}>Delete</button>
        </div>
      </div>

      <section>
        <h3>When</h3>
        <div className="sgrid">
          <Field label="This happens">
            <Select value={t.type} options={TRIGGER_TYPES.map((x) => ({ value: x, label: TRIGGER_LABELS[x] }))}
              onChange={(type) => set({ trigger: { type: (type ?? 'session_start') as TriggerType } })} />
          </Field>
          {!NO_VALUE.includes(t.type) && <Field label="Which one">{valueInput()}</Field>}
        </div>
      </section>

      <section>
        <h3>Only if <span className="shint inline">(all must be true)</span></h3>
        <Conditions conds={beat.when ?? []} draft={draft} onChange={(when) => set({ when: when.length ? when : undefined })} />
      </section>

      <section>
        <h3>Say</h3>
        <label className="check">
          <input type="checkbox" checked={usesVariants} onChange={(e) => set(e.target.checked
            ? { variants: [beat.lines ?? []], lines: undefined }
            : { lines: beat.variants?.[0] ?? [], variants: undefined })} />
          Random versions (pick one each time)
        </label>
        {usesVariants
          ? <>
              {beat.variants!.map((v, i) => (
                <div key={i} className="variant">
                  <div className="variant-head">Version {i + 1}
                    <IconBtn title="Remove version" danger onClick={() => set({ variants: beat.variants!.filter((_, j) => j !== i) })}>✕</IconBtn>
                  </div>
                  <Lines lines={v} assets={assets} defaultExpr={m.defaultExpression}
                    onChange={(ls) => set({ variants: beat.variants!.map((x, j) => (j === i ? ls : x)) })} />
                </div>
              ))}
              <button className="pill" onClick={() => set({ variants: [...beat.variants!, [{ text: '' }]] })}>+ Version</button>
            </>
          : <Lines lines={beat.lines ?? []} assets={assets} defaultExpr={m.defaultExpression} onChange={(lines) => set({ lines })} />}
      </section>

      <section>
        <h3>Choices <span className="shint inline">(optional buttons for the player)</span></h3>
        {beat.choices?.length ? (
          <Field label="Player says first (optional)" wide><Text value={beat.prompt} onChange={(prompt) => set({ prompt: prompt || undefined })} placeholder="Before I start writing…" /></Field>
        ) : null}
        <Choices choices={beat.choices ?? []} assets={assets} defaultExpr={m.defaultExpression}
          onChange={(choices) => set({ choices: choices.length ? choices : undefined, prompt: choices.length ? beat.prompt : undefined })} />
      </section>

      <section>
        <h3>Afterwards, change flags</h3>
        <Effects effects={beat.effects ?? []} onChange={(effects) => set({ effects: effects.length ? effects : undefined })} />
      </section>

      <section>
        <h3>How often</h3>
        <div className="sgrid">
          <Field label="Repeat"><Select value={beat.repeat ?? 'always'} options={[
            { value: 'always', label: 'Every time' }, { value: 'daily', label: 'Once a day' }, { value: 'once', label: 'Only once ever' },
          ]} onChange={(v) => set({ repeat: v === 'always' ? undefined : v as Repeat })} /></Field>
          <Field label="Wait before repeating (min)"><Num value={beat.cooldownMinutes} min={0} onChange={(cooldownMinutes) => set({ cooldownMinutes })} /></Field>
          <Field label="Priority" hint="Higher wins when several beats fit."><Num value={beat.priority} placeholder="0" onChange={(priority) => set({ priority })} /></Field>
          <Field label="Odds" hint="Among ties, higher = more likely."><Num value={beat.weight} min={0} placeholder="1" onChange={(weight) => set({ weight })} /></Field>
        </div>
        <Field label="Note to self" wide><Text value={beat.note} onChange={(note) => set({ note: note || undefined })} placeholder="Never shown in the app" /></Field>
      </section>
    </div>
  )
}

// ------------------------------------------------------------------ pieces

function Conditions({ conds, draft, onChange }: { conds: Condition[]; draft: Draft; onChange: (c: Condition[]) => void }) {
  const setAt = (i: number, c: Condition) => onChange(conds.map((x, j) => (j === i ? c : x)))
  return (
    <div className="rows">
      {conds.map((c, i) => {
        const kind = c.var.startsWith('flag:') ? 'flag' : c.var.startsWith('seen:') ? 'seen' : c.var
        const listOp = c.op === 'in' || c.op === 'not_in'
        return (
          <div key={i} className="row">
            <Select value={kind} options={Object.entries(VAR_LABELS).map(([value, label]) => ({ value, label }))}
              onChange={(v) => setAt(i, { ...c, var: (v === 'flag' ? 'flag:' : v === 'seen' ? 'seen:' : v) as ConditionVar })} />
            {kind === 'flag' && <Text mono value={c.var.slice(5)} placeholder="flag name" onChange={(n) => setAt(i, { ...c, var: `flag:${n}` })} />}
            {kind === 'seen' && <Select value={c.var.slice(5)} empty="(beat)" options={draft.script.beats.map((b) => b.id)} onChange={(n) => setAt(i, { ...c, var: `seen:${n ?? ''}` })} />}
            {kind !== 'chance' && <Select value={c.op} options={[...CONDITION_OPS]} onChange={(op) => setAt(i, { ...c, op: (op ?? '==') as Condition['op'] })} />}
            {kind === 'timeSlot'
              ? <Select value={String(c.value)} options={(draft.manifest.timeSlots ?? []).map((s) => s.id)} onChange={(v) => setAt(i, { ...c, value: v ?? '' })} />
              : kind === 'stage'
                ? <Select value={String(c.value)} options={(draft.manifest.stages ?? []).map((s) => s.id)} onChange={(v) => setAt(i, { ...c, value: v ?? '' })} />
                : <input value={Array.isArray(c.value) ? c.value.join(', ') : String(c.value)} placeholder={listOp ? '1, 2, 3' : 'value'}
                    onChange={(e) => setAt(i, { ...c, value: listOp ? e.target.value.split(',').map((s) => parseValue(s.trim()) as string | number) : parseValue(e.target.value) })} />}
            <IconBtn title="Remove condition" danger onClick={() => onChange(conds.filter((_, j) => j !== i))}>✕</IconBtn>
          </div>
        )
      })}
      <button className="pill" onClick={() => onChange([...conds, { var: 'day', op: '==', value: 1 }])}>+ Condition</button>
    </div>
  )
}

type Assets = ReturnType<typeof assetLists>

function Lines({ lines, assets, defaultExpr, onChange }: { lines: Line[]; assets: Assets; defaultExpr: string; onChange: (l: Line[]) => void }) {
  const [open, setOpen] = useState<number | null>(null)
  const setAt = (i: number, patch: Partial<Line>) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  return (
    <div className="rows">
      {lines.map((l, i) => (
        <div key={i} className="line-row">
          <div className="line-main">
            <Select value={l.expression} empty="(same face)" options={assets.expressions} onChange={(expression) => setAt(i, { expression })} />
            <textarea rows={2} value={l.text} placeholder="What they say… use {player} for the player's name" onChange={(e) => setAt(i, { text: e.target.value })} />
            <div className="row-btns">
              <IconBtn title="More options" onClick={() => setOpen(open === i ? null : i)}>⋯</IconBtn>
              <IconBtn title="Move up" onClick={() => onChange(move(lines, i, i - 1))}>↑</IconBtn>
              <IconBtn title="Remove line" danger onClick={() => onChange(lines.filter((_, j) => j !== i))}>✕</IconBtn>
            </div>
          </div>
          {open === i && (
            <div className="line-more sgrid">
              <Field label="Background"><Select value={l.background} empty="(no change)" options={assets.backgrounds} onChange={(background) => setAt(i, { background })} /></Field>
              <Field label="Reward art"><Select value={l.cg} empty="(none)" options={assets.cgs} onChange={(cg) => setAt(i, { cg })} /></Field>
              <Field label="Sound"><Select value={l.sound} empty="(none)" options={assets.sounds} onChange={(sound) => setAt(i, { sound })} /></Field>
              <Field label="Style"><Select value={l.style ?? 'speech'} options={[{ value: 'speech', label: 'Speaking' }, { value: 'thought', label: 'Thinking (italic)' }]}
                onChange={(v) => setAt(i, { style: v === 'thought' ? 'thought' : undefined })} /></Field>
              <Field label="Speaker" hint="Blank = the cutie. “player” = the player.">
                <Text value={l.speaker} onChange={(speaker) => setAt(i, { speaker: speaker || undefined })} /></Field>
            </div>
          )}
        </div>
      ))}
      <button className="pill" onClick={() => onChange([...lines, { text: '', expression: lines.length ? undefined : defaultExpr }])}>+ Line</button>
    </div>
  )
}

function Choices({ choices, assets, defaultExpr, onChange }: { choices: Choice[]; assets: Assets; defaultExpr: string; onChange: (c: Choice[]) => void }) {
  const setAt = (i: number, patch: Partial<Choice>) => onChange(choices.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  const nextId = () => {
    const ids = new Set(choices.map((c) => c.id))
    for (let n = 0; ; n++) {
      const id = String.fromCharCode(65 + (n % 26)) + (n >= 26 ? Math.floor(n / 26) : '')
      if (!ids.has(id)) return id
    }
  }
  return (
    <div className="rows">
      {choices.map((c, i) => (
        <div key={i} className="choice-block">
          <div className="row">
            <span className="choice-id mono">{c.id}</span>
            <Text value={c.text} placeholder="Button text" onChange={(text) => setAt(i, { text })} />
            <IconBtn title="Remove choice" danger onClick={() => onChange(choices.filter((_, j) => j !== i))}>✕</IconBtn>
          </div>
          <div className="choice-inner">
            <span className="shint">They answer:</span>
            <Lines lines={c.lines ?? []} assets={assets} defaultExpr={defaultExpr} onChange={(lines) => setAt(i, { lines })} />
            <span className="shint">Flags:</span>
            <Effects effects={c.effects ?? []} onChange={(effects) => setAt(i, { effects: effects.length ? effects : undefined })} />
          </div>
        </div>
      ))}
      <button className="pill" onClick={() => onChange([...choices, { id: nextId(), text: '', lines: [{ text: '' }] }])}>+ Choice</button>
    </div>
  )
}

function Effects({ effects, onChange }: { effects: FlagEffect[]; onChange: (e: FlagEffect[]) => void }) {
  const setAt = (i: number, patch: Partial<FlagEffect>) => onChange(effects.map((e, j) => (j === i ? { ...e, ...patch } : e)))
  return (
    <div className="rows">
      {effects.map((e, i) => (
        <div key={i} className="row">
          <Text mono value={e.flag} placeholder="flag name" onChange={(flag) => setAt(i, { flag: cleanName(flag) })} />
          <Select value={e.op} options={[{ value: 'set', label: 'set to' }, { value: 'add', label: 'add' }]} onChange={(op) => setAt(i, { op: op === 'add' ? 'add' : 'set' })} />
          <input value={String(e.value)} onChange={(ev) => setAt(i, { value: parseValue(ev.target.value) })} />
          <IconBtn title="Remove" danger onClick={() => onChange(effects.filter((_, j) => j !== i))}>✕</IconBtn>
        </div>
      ))}
      <button className="pill small" onClick={() => onChange([...effects, { flag: '', op: 'set', value: true }])}>+ Flag</button>
    </div>
  )
}
