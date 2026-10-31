import { DEFAULT_TIME_SLOTS } from '../engine/time'
import type { Beat, Condition, CutieManifest, Script, TriggerType } from '../engine/types'

export type CellState = 'specific' | 'generic' | 'placeholder' | 'missing'

export interface Cell {
  state: CellState
  beatIds: string[]
  /** Trigger to use when creating a beat for an empty cell. */
  trigger: { type: TriggerType; value?: string | number }
  day?: number
}

function cmp(actual: number, c: Condition): boolean {
  const v = c.value
  switch (c.op) {
    case '==': return actual === Number(v)
    case '!=': return actual !== Number(v)
    case '>': return actual > Number(v)
    case '>=': return actual >= Number(v)
    case '<': return actual < Number(v)
    case '<=': return actual <= Number(v)
    case 'in': return (Array.isArray(v) ? v : [v]).map(Number).includes(actual)
    case 'not_in': return !(Array.isArray(v) ? v : [v]).map(Number).includes(actual)
  }
}

/** Does the beat apply on project day `day`? 'specific' if it targets that day exactly. */
function dayFit(beat: Beat, day: number): 'specific' | 'generic' | null {
  const conds = (beat.when ?? []).filter((c) => c.var === 'day')
  if (!conds.length) return 'generic'
  if (!conds.every((c) => cmp(day, c))) return null
  return conds.some((c) => c.op === '==' || c.op === 'in') ? 'specific' : 'generic'
}

const isPlaceholderBeat = (b: Beat) =>
  [...(b.lines ?? []), ...(b.variants ?? []).flat()].some((l) => /\[PLACEHOLDER/i.test(l.text))

function cellFor(beats: Beat[], type: TriggerType, value: string | number | undefined, day?: number): Cell {
  const matching = beats.filter((b) => b.trigger.type === type
    && (b.trigger.value === undefined || value === undefined || String(b.trigger.value) === String(value)))
  const fits = day === undefined
    ? matching.map((b) => ({ b, fit: 'specific' as const }))
    : matching.map((b) => ({ b, fit: dayFit(b, day) })).filter((x) => x.fit)
  const real = fits.filter((x) => !isPlaceholderBeat(x.b))
  const state: CellState = real.some((x) => x.fit === 'specific') ? 'specific'
    : real.length ? 'generic'
    : fits.length ? 'placeholder'
    : 'missing'
  return { state, beatIds: fits.map((x) => x.b.id), trigger: { type, value }, day }
}

export interface Coverage {
  columns: { key: string; label: string; type: TriggerType; value: string | number }[]
  days: { day: number; cells: Cell[] }[]
  total: { label: string; cell: Cell }[]
  stages: { label: string; cell: Cell }[]
  summary: Record<CellState, number>
}

export function coverage(manifest: CutieManifest, script: Script, dayCount = 30): Coverage {
  const beats = script.beats
  const slots = manifest.timeSlots?.length ? manifest.timeSlots : DEFAULT_TIME_SLOTS
  const columns = [
    ...slots.map((s) => ({ key: `slot:${s.id}`, label: s.id.replace(/_/g, ' '), type: 'time_slot' as const, value: s.id })),
    ...(manifest.milestones?.daily ?? []).map((m) => ({ key: `daily:${m}`, label: `${m}%`, type: 'daily_pct' as const, value: m })),
  ]
  const days = Array.from({ length: dayCount }, (_, i) => i + 1).map((day) => ({
    day,
    cells: columns.map((c) => cellFor(beats, c.type, c.value, day)),
  }))
  const total = (manifest.milestones?.total ?? []).map((m) => ({ label: `${m}%`, cell: cellFor(beats, 'total_pct', m) }))
  const stages = (manifest.stages ?? []).slice()
    .sort((a, b) => a.minTotalPct - b.minTotalPct)
    .slice(1) // the starting stage never "enters"
    .map((s) => ({ label: s.name, cell: cellFor(beats, 'stage', s.id) }))

  const summary: Record<CellState, number> = { specific: 0, generic: 0, placeholder: 0, missing: 0 }
  for (const c of [...days.flatMap((d) => d.cells), ...total.map((t) => t.cell), ...stages.map((s) => s.cell)]) summary[c.state]++
  return { columns, days, total, stages, summary }
}
