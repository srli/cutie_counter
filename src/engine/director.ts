import { checkAll } from './conditions'
import { computeStats } from './progress'
import { weightedPick, type Rng } from './rng'
import { fillTemplate } from './text'
import { daysBetween, slotAt } from './time'
import type {
  Beat, Choice, EngineEvent, FlagEffect, Line, Pack, Project, Scene, Stats, TriggerType,
} from './types'

/** What happened, from the app's point of view. */
export type Input =
  | { kind: 'open' }
  | { kind: 'words'; count: number }
  | { kind: 'tick' }
  | { kind: 'ambient' }
  | { kind: 'idle'; minutes: number }
  | { kind: 'choice'; beatId: string; choiceId: string }
  | { kind: 'event'; event: EngineEvent } // used by the preview tool

export interface StepResult {
  project: Project
  scenes: Scene[]
  events: EngineEvent[]
}

export const MAX_SCENES_PER_STEP = 3
const MAX_FOLLOW_UPS = 30 // long scenes are chains of follow-ups

/** Events that should show a placeholder when the script has nothing for them. */
const PLACEHOLDER_EVENTS: TriggerType[] = ['reopen', 'time_slot', 'daily_pct', 'total_pct', 'stage']

// ---------------------------------------------------------------- thresholds

function beatValues(pack: Pack, type: TriggerType): number[] {
  return pack.script.beats
    .filter((b) => b.trigger.type === type && b.trigger.value !== undefined)
    .map((b) => Number(b.trigger.value))
    .filter((n) => Number.isFinite(n) && n > 0)
}

function thresholds(pack: Pack, type: TriggerType): number[] {
  const fromManifest =
    type === 'daily_pct' ? pack.manifest.milestones?.daily ?? []
    : type === 'total_pct' ? pack.manifest.milestones?.total ?? []
    : []
  return [...new Set([...fromManifest, ...beatValues(pack, type)])].sort((a, b) => a - b)
}

/** Idle minutes the script reacts to, so the app knows which timers to set. */
export function idleThresholds(pack: Pack): number[] {
  return thresholds(pack, 'idle')
}

// ---------------------------------------------------------------- state helpers

function ensureDay(project: Project, date: string): boolean {
  if (project.firedToday.date !== date) project.firedToday = { date, keys: [] }
  if (project.days[date]) return false
  project.days[date] = { startWords: project.wordCount, endWords: project.wordCount }
  return true
}

function applyEffects(project: Project, effects: FlagEffect[] | undefined) {
  for (const e of effects ?? []) {
    if (e.op === 'add') {
      project.flags[e.flag] = Number(project.flags[e.flag] ?? 0) + Number(e.value)
    } else {
      project.flags[e.flag] = e.value
    }
  }
}

/** Fire the highest crossed threshold not yet fired; mark all crossed ones fired. */
function crossed(level: number, list: number[], fired: string[], type: TriggerType): EngineEvent | null {
  let top: number | null = null
  for (const t of list) {
    const key = `${type}:${t}`
    if (level >= t && !fired.includes(key)) {
      fired.push(key)
      top = t
    }
  }
  return top === null ? null : { type, value: top }
}

function dayEvents(stats: Stats): EngineEvent[] {
  const events: EngineEvent[] = [
    { type: 'day_start', value: stats.day },
    { type: 'date', value: stats.monthDay },
  ]
  if (stats.streak > 0) events.push({ type: 'streak', value: stats.streak })
  return events
}

function slotEvent(project: Project, stats: Stats, pack: Pack): EngineEvent | null {
  // Slots after midnight belong to the night before, so writing past 00:00 doesn't start
  // `midnight` over, and day 18's 2 a.m. line plays after day 18's 11 p.m. one.
  const slot = slotAt(stats.now, pack.manifest.timeSlots)
  const key = `${slot.date}|${slot.id}`
  if (project.lastSlot === key) return null
  project.lastSlot = key
  // Count the days the writer was here at this time of day, e.g. `visits_morning`, for conditions.
  const visits = `visits_${slot.id}`
  project.flags[visits] = Number(project.flags[visits] ?? 0) + 1
  const day = stats.day - daysBetween(slot.date, stats.date)
  return { type: 'time_slot', value: slot.id, ...(day !== stats.day && { day }) }
}

function stageEvent(project: Project, stats: Stats): EngineEvent | null {
  if (!stats.stage || project.stage === stats.stage) return null
  const first = project.stage === undefined
  project.stage = stats.stage
  // The starting stage is where everyone begins; only moving up is an event.
  if (first) return null
  const key = `stage:${stats.stage}`
  if (project.firedOnce.includes(key)) return null
  project.firedOnce.push(key)
  return { type: 'stage', value: stats.stage }
}

function progressEvents(project: Project, stats: Stats, pack: Pack): EngineEvent[] {
  const out: (EngineEvent | null)[] = [
    crossed(stats.dailyPct, thresholds(pack, 'daily_pct'), project.firedToday.keys, 'daily_pct'),
    crossed(stats.totalPct, thresholds(pack, 'total_pct'), project.firedOnce, 'total_pct'),
    crossed(stats.todayWords, thresholds(pack, 'words_today'), project.firedToday.keys, 'words_today'),
    crossed(stats.totalWords, thresholds(pack, 'words_total'), project.firedOnce, 'words_total'),
  ]
  for (const every of thresholds(pack, 'words_every')) {
    const n = Math.floor(stats.totalWords / every)
    const key = `words_every:${every}:${n}`
    if (n >= 1 && !project.firedOnce.includes(key)) {
      project.firedOnce.push(key)
      out.push({ type: 'words_every', value: every })
    }
  }
  out.push(stageEvent(project, stats))
  return out.filter((e): e is EngineEvent => e !== null)
}

// ---------------------------------------------------------------- selection

function triggerMatches(beat: Beat, ev: EngineEvent): boolean {
  if (beat.trigger.type !== ev.type) return false
  if (beat.trigger.value === undefined) return true
  // "a|b" matches either; used to rejoin a scene after branches.
  return String(beat.trigger.value).split('|').includes(String(ev.value))
}

function repeatAllows(beat: Beat, project: Project, stats: Stats): boolean {
  const log = project.beatLog[beat.id]
  if (!log) return true
  const repeat = beat.repeat ?? 'always'
  if (repeat === 'once') return false
  if (repeat === 'daily' && log.lastDate === stats.date) return false
  if (beat.cooldownMinutes && stats.now.getTime() - log.lastAt < beat.cooldownMinutes * 60_000) return false
  return true
}

export function selectBeat(ev: EngineEvent, pack: Pack, project: Project, stats: Stats, rng: Rng): Beat | null {
  const candidates = pack.script.beats.filter(
    (b) => triggerMatches(b, ev) && repeatAllows(b, project, stats) && checkAll(b.when, stats, project, rng),
  )
  if (!candidates.length) return null
  const top = Math.max(...candidates.map((b) => b.priority ?? 0))
  const tied = candidates.filter((b) => (b.priority ?? 0) === top)
  return weightedPick(tied, (b) => b.weight ?? 1, rng) ?? null
}

function placeholderText(ev: EngineEvent, stats: Stats, pack: Pack): string {
  const stageName = pack.manifest.stages?.find((s) => s.id === stats.stage)?.name ?? stats.stage
  switch (ev.type) {
    case 'time_slot': return `[PLACEHOLDER day ${stats.day} · ${ev.value}]`
    case 'reopen': return `[PLACEHOLDER welcome back · day ${stats.day} · ${stats.timeSlot}]`
    case 'daily_pct': return `[PLACEHOLDER daily ${ev.value}% · day ${stats.day}]`
    case 'total_pct': return `[PLACEHOLDER total ${ev.value}% · ${stageName || 'any stage'}]`
    case 'stage': return `[PLACEHOLDER entering ${stageName}]`
    default: return `[PLACEHOLDER ${ev.type} ${ev.value ?? ''}]`
  }
}

// ---------------------------------------------------------------- scenes

function fill(lines: Line[], project: Project, stats: Stats, pack: Pack): Line[] {
  const ctx = { project, stats, cutieName: pack.manifest.name }
  return lines.map((l) => ({ ...l, text: fillTemplate(l.text, ctx) }))
}

function fillChoices(choices: Choice[] | undefined, project: Project, stats: Stats, pack: Pack) {
  if (!choices?.length) return undefined
  const ctx = { project, stats, cutieName: pack.manifest.name }
  return choices.map((c) => ({ ...c, text: fillTemplate(c.text, ctx) }))
}

function playBeat(beat: Beat, project: Project, stats: Stats, pack: Pack, rng: Rng): Scene {
  const lines = beat.variants?.length
    ? weightedPick(beat.variants, () => 1, rng) ?? []
    : beat.lines ?? []
  const log = project.beatLog[beat.id]
  project.beatLog[beat.id] = { count: (log?.count ?? 0) + 1, lastAt: stats.now.getTime(), lastDate: stats.date }
  applyEffects(project, beat.effects)
  const ctx = { project, stats, cutieName: pack.manifest.name }
  return {
    beatId: beat.id,
    lines: fill(lines, project, stats, pack),
    prompt: beat.prompt ? fillTemplate(beat.prompt, ctx) : undefined,
    choices: fillChoices(beat.choices, project, stats, pack),
    ...(beat.display ? { display: beat.display } : {}),
  }
}

/** Play `after:<id>` follow-ups chained off a beat with no choices. */
function followUps(fromId: string, project: Project, stats: Stats, pack: Pack, rng: Rng, depth = 0): Scene[] {
  if (depth >= MAX_FOLLOW_UPS) return []
  const next = selectBeat({ type: 'after', value: fromId }, pack, project, stats, rng)
  if (!next) return []
  const scene = playBeat(next, project, stats, pack, rng)
  return scene.choices?.length ? [scene] : [scene, ...followUps(next.id, project, stats, pack, rng, depth + 1)]
}

function resolve(events: EngineEvent[], project: Project, stats: Stats, pack: Pack, rng: Rng): Scene[] {
  // An event from the night before (a 2 a.m. time slot) is judged as that day: `day` conditions, `{day}`.
  const statsFor = (ev: EngineEvent): Stats => (ev.day === undefined ? stats : { ...stats, day: ev.day })
  const picks: { beat: Beat; stats: Stats }[] = []
  for (const ev of events) {
    const s = statsFor(ev)
    const beat = selectBeat(ev, pack, project, s, rng)
    if (beat && !picks.some((p) => p.beat === beat)) picks.push({ beat, stats: s })
  }

  if (!picks.length) {
    const ev = events.find((e) => PLACEHOLDER_EVENTS.includes(e.type))
    if (!ev) return []
    return [{ beatId: `placeholder:${ev.type}:${ev.value}`, lines: [{ text: placeholderText(ev, statsFor(ev), pack) }], placeholder: true }]
  }

  // Stable sort keeps event order among equal priorities.
  picks.sort((a, b) => (b.beat.priority ?? 0) - (a.beat.priority ?? 0))
  const scenes: Scene[] = []
  for (const { beat, stats: s } of picks.slice(0, MAX_SCENES_PER_STEP)) {
    const scene = playBeat(beat, project, s, pack, rng)
    scenes.push(scene)
    if (!scene.choices?.length) scenes.push(...followUps(beat.id, project, s, pack, rng))
  }
  return scenes
}

// ---------------------------------------------------------------- step

/** Advance the story by one input. Never mutates `input` project; returns a new one. */
export function step(prev: Project, input: Input, pack: Pack, now: Date, rng: Rng): StepResult {
  const project: Project = structuredClone(prev)
  let stats = computeStats(project, pack.manifest, now)
  // Random chatter and idle nudges can run with nobody watching, so they never start a new day.
  // The first open, clock tick, typing or choice of the day does, and gets the new-day events.
  const newDay = input.kind !== 'ambient' && input.kind !== 'idle' && ensureDay(project, stats.date)
  if (newDay) stats = computeStats(project, pack.manifest, now)
  const startOfDay = newDay ? dayEvents(stats) : []

  const events: EngineEvent[] = []
  const push = (e: EngineEvent | null) => { if (e) events.push(e) }

  switch (input.kind) {
    case 'open':
      events.push({ type: 'session_start' })
      // Coming back the same day gets its own event, so the cutie always has something to say.
      events.push(...(newDay ? startOfDay : [{ type: 'reopen' as const }]))
      push(slotEvent(project, stats, pack))
      push(stageEvent(project, stats))
      break

    case 'tick':
      events.push(...startOfDay)
      push(slotEvent(project, stats, pack))
      break

    case 'words': {
      events.push(...startOfDay)
      project.wordCount = Math.max(0, input.count)
      project.days[stats.date].endWords = project.wordCount
      stats = computeStats(project, pack.manifest, now)
      events.push(...progressEvents(project, stats, pack))
      break
    }

    case 'ambient': {
      const chance = pack.manifest.ambient?.chance ?? 0
      if (rng() < chance) events.push({ type: 'random' })
      break
    }

    case 'idle':
      events.push({ type: 'idle', value: input.minutes })
      break

    case 'event':
      events.push(input.event)
      break

    case 'choice': {
      const beat = pack.script.beats.find((b) => b.id === input.beatId)
      const choice = beat?.choices?.find((c) => c.id === input.choiceId)
      if (!beat || !choice) { events.push(...startOfDay); break }
      applyEffects(project, choice.effects)
      project.flags[`choice:${beat.id}`] = choice.id
      const scenes: Scene[] = []
      if (choice.lines?.length) {
        scenes.push({ beatId: `${beat.id}/${choice.id}`, lines: fill(choice.lines, project, stats, pack), ...(beat.display ? { display: beat.display } : {}) })
      }
      // A follow-up for this exact choice wins; otherwise continue with whatever follows the beat itself.
      const exact = followUps(`${beat.id}/${choice.id}`, project, stats, pack, rng)
      scenes.push(...(exact.length ? exact : followUps(beat.id, project, stats, pack, rng)))
      scenes.push(...resolve(startOfDay, project, stats, pack, rng))
      project.updatedAt = now.getTime()
      return { project, scenes, events: [{ type: 'after', value: `${beat.id}/${choice.id}` }, ...startOfDay] }
    }
  }

  const scenes = resolve(events, project, stats, pack, rng)
  project.updatedAt = now.getTime()
  return { project, scenes, events }
}

export function newProject(init: {
  id: string; title: string; playerName: string; cutieId: string
  totalGoal: number; dailyGoal: number; now: Date; startDate: string
}): Project {
  return {
    id: init.id,
    title: init.title,
    playerName: init.playerName,
    cutieId: init.cutieId,
    totalGoal: init.totalGoal,
    dailyGoal: init.dailyGoal,
    startDate: init.startDate,
    doc: '',
    wordCount: 0,
    days: {},
    flags: {},
    beatLog: {},
    firedOnce: [],
    firedToday: { date: '', keys: [] },
    createdAt: init.now.getTime(),
    updatedAt: init.now.getTime(),
  }
}
