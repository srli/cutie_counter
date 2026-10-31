import { addDays, daysBetween, isIsoDate, localDate, monthDay, timeSlotAt } from './time'
import type { CutieManifest, Project, Stage, Stats } from './types'

/** Simple word count: runs of non-space characters. */
export function countWords(text: string): number {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

export function wroteOn(project: Project, date: string): boolean {
  const rec = project.days[date]
  return !!rec && rec.endWords > rec.startWords
}

export function stageFor(totalPct: number, stages: Stage[] = []): string {
  let current = ''
  let best = -Infinity
  for (const s of stages) {
    if (totalPct >= s.minTotalPct && s.minTotalPct >= best) {
      current = s.id
      best = s.minTotalPct
    }
  }
  return current
}

/** The cutie's resting face: their stage's own default expression, if it has one. */
export function restingExpression(manifest: CutieManifest, stageId: string | undefined): string {
  return manifest.stages?.find((s) => s.id === stageId)?.defaultExpression || manifest.defaultExpression
}

/** Day 1's date. A story saved without a valid one counts from the day it was made. */
export function startDateOf(project: Project): string {
  return isIsoDate(project.startDate) ? project.startDate : localDate(new Date(project.createdAt))
}

export function todayWords(project: Project, date: string): number {
  const rec = project.days[date]
  return rec ? Math.max(0, project.wordCount - rec.startWords) : 0
}

export function computeStats(project: Project, manifest: CutieManifest, now: Date): Stats {
  const date = localDate(now)
  const today = todayWords(project, date)
  const totalPct = project.totalGoal > 0 ? (project.wordCount / project.totalGoal) * 100 : 0
  const dailyPct = project.dailyGoal > 0 ? (today / project.dailyGoal) * 100 : 0

  // Day 1 is the start date; days before it are 0, -1, … so day-1 lines wait for day 1.
  const start = startDateOf(project)
  const sinceStart = daysBetween(start, date)

  // Missed: past project days (before today) with no words written.
  const elapsed = Math.max(0, sinceStart)
  let missed = 0
  for (let i = 0; i < elapsed; i++) {
    if (!wroteOn(project, addDays(start, i))) missed++
  }

  // Streak: consecutive writing days ending today, or yesterday if today is still blank.
  let streak = 0
  let cursor = wroteOn(project, date) ? date : addDays(date, -1)
  while (daysBetween(start, cursor) >= 0 && wroteOn(project, cursor)) {
    streak++
    cursor = addDays(cursor, -1)
  }

  // Days away: blank days between the last writing day and today.
  let daysAway = 0
  cursor = addDays(date, -1)
  while (daysBetween(start, cursor) >= 0 && !wroteOn(project, cursor)) {
    daysAway++
    cursor = addDays(cursor, -1)
  }

  return {
    now,
    date,
    monthDay: monthDay(now),
    weekday: now.getDay(),
    hour: now.getHours(),
    day: sinceStart + 1,
    timeSlot: timeSlotAt(now, manifest.timeSlots),
    stage: stageFor(totalPct, manifest.stages),
    totalWords: project.wordCount,
    todayWords: today,
    totalPct,
    dailyPct,
    missedDays: missed,
    daysAway,
    streak,
  }
}

/** NaNoWriMo defaults: 50k words over 30 days. */
export const DEFAULT_TOTAL_GOAL = 50_000
export const DEFAULT_DAYS = 30
export function defaultDailyGoal(totalGoal: number): number {
  return Math.ceil(totalGoal / DEFAULT_DAYS)
}
