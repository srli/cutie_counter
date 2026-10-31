import type { TimeSlot } from './types'

export const DEFAULT_TIME_SLOTS: TimeSlot[] = [
  { id: 'morning', start: '05:00' },
  { id: 'late_morning', start: '11:00' },
  { id: 'evening', start: '16:00' },
  { id: 'midnight', start: '23:00' },
  { id: 'ultra_late', start: '02:00' },
]

const pad = (n: number) => String(n).padStart(2, '0')

/** Local calendar date as "YYYY-MM-DD". */
export function localDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function monthDay(d: Date): string {
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function parseDate(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

/** True for a real calendar date written as "YYYY-MM-DD". */
export function isIsoDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const t = new Date(parseDate(s))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}` === s
}

/** Whole calendar days from a to b (b - a). DST-safe because it uses UTC dates. */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseDate(b) - parseDate(a)) / 86_400_000)
}

export function addDays(iso: string, n: number): string {
  const t = new Date(parseDate(iso) + n * 86_400_000)
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}

/**
 * The slot at `d`, and the date of the day it belongs to. The first slot in the list starts
 * the day (`morning` for Ryder), so slots after midnight but before it (`midnight`, `ultra_late`)
 * still belong to the night before: day 18's 2 a.m. comes after day 18's 11 p.m., as scripts are written.
 */
export function slotAt(d: Date, slots: TimeSlot[] = DEFAULT_TIME_SLOTS): { id: string; date: string } {
  const today = localDate(d)
  if (slots.length === 0) return { id: 'day', date: today }
  const now = d.getHours() * 60 + d.getMinutes()
  const sorted = [...slots].sort((a, b) => minutesOf(a.start) - minutesOf(b.start))
  let current = sorted[sorted.length - 1]
  for (const slot of sorted) {
    if (minutesOf(slot.start) <= now) current = slot
  }
  return { id: current.id, date: now < minutesOf(slots[0].start) ? addDays(today, -1) : today }
}

/** The slot whose start is the latest one at or before `d`, wrapping past midnight. */
export function timeSlotAt(d: Date, slots: TimeSlot[] = DEFAULT_TIME_SLOTS): string {
  return slotAt(d, slots).id
}
