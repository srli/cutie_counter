import { newProject, step, type Input, type StepResult } from '../engine/director'
import { stageFor } from '../engine/progress'
import { seededRng } from '../engine/rng'
import { addDays, daysBetween, localDate, slotAt } from '../engine/time'
import type { FlagValue, Pack, Project } from '../engine/types'

/** The "what if" knobs in the Studio preview. */
export interface SimSettings {
  /** Local time, "YYYY-MM-DDTHH:MM". */
  when: string
  day: number
  todayWords: number
  totalWords: number
  totalGoal: number
  dailyGoal: number
  /** Blank days right before today. */
  daysAway: number
  playerName: string
  flags: Record<string, FlagValue>
  seed: number
}

export function defaultSim(): SimSettings {
  return {
    when: '2026-11-01T09:00', day: 1, todayWords: 0, totalWords: 0, totalGoal: 50_000, dailyGoal: 1667,
    daysAway: 0, playerName: 'Reader', flags: {}, seed: 1,
  }
}

/** A project that looks like the settings describe: past days written except the last `daysAway`. */
export function simProject(pack: Pack, s: SimSettings): { project: Project; now: Date } {
  const now = new Date(s.when)
  const today = localDate(now)
  // "Day 18 at 2 a.m." means day 18's night, as scripts are written, so day 18 began the day before.
  const startDate = addDays(slotAt(now, pack.manifest.timeSlots).date, -(Math.max(1, s.day) - 1))
  const project = newProject({
    id: 'preview', title: 'Preview', playerName: s.playerName, cutieId: pack.manifest.id,
    totalGoal: s.totalGoal, dailyGoal: s.dailyGoal, now, startDate,
  })
  const before = Math.max(0, s.totalWords - s.todayWords)
  const pastDays = daysBetween(startDate, today)
  const perDay = pastDays > 0 ? before / pastDays : 0
  let running = 0
  for (let i = 0; i < pastDays; i++) {
    const date = addDays(startDate, i)
    const blank = i >= pastDays - s.daysAway
    const start = Math.round(running)
    if (!blank) running += perDay
    project.days[date] = { startWords: start, endWords: blank ? start : Math.round(running) }
  }
  project.days[today] = { startWords: before, endWords: s.totalWords }
  project.wordCount = s.totalWords
  project.flags = { ...s.flags }
  project.firedToday = { date: today, keys: [] }
  project.stage = stageFor((s.totalWords / s.totalGoal) * 100, pack.manifest.stages)
  // Past day 1, a returning writer has already seen one-time opening beats (like an intro).
  if (s.day > 1) {
    for (const b of pack.script.beats) {
      if (b.repeat === 'once' && b.trigger.type === 'session_start') {
        project.beatLog[b.id] = { count: 1, lastAt: now.getTime() - 86_400_000, lastDate: startDate }
      }
    }
  }
  return { project, now }
}

export function simulate(pack: Pack, s: SimSettings, input: Input): StepResult & { now: Date } {
  const { project, now } = simProject(pack, s)
  // `open` on a day that already has a record would skip day events, so drop today's record first.
  if (input.kind === 'open') {
    const today = localDate(now)
    const rec = project.days[today]
    delete project.days[today]
    const r = step({ ...project, wordCount: rec.startWords }, input, pack, now, seededRng(s.seed))
    r.project.wordCount = s.totalWords
    r.project.days[today].endWords = s.totalWords
    return { ...r, now }
  }
  return { ...step(project, input, pack, now, seededRng(s.seed)), now }
}
