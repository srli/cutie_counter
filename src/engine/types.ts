/**
 * Data shapes shared by the engine, the pack loader and the UI.
 *
 * A cutie pack is a zip (`.cutie`) holding:
 *   cutie.json   -> CutieManifest
 *   script.json  -> Script
 *   images/      -> sprites and art, found by file name convention:
 *                     select.png        portrait for the picker
 *                     bg_<name>.png     background
 *                     cg_<name>.png     reward art
 *                     <expression>.png  everything else is an expression sprite
 */

export const PACK_FORMAT_VERSION = 1

// ---------------------------------------------------------------- manifest

export interface TimeSlot {
  id: string
  /** 24h "HH:MM" local time the slot begins. Slots wrap around midnight. */
  start: string
}

export interface Stage {
  id: string
  name: string
  /** Stage applies once total progress (0-100+) reaches this percentage. */
  minTotalPct: number
  defaultExpression?: string
}

export interface WeightedExpression {
  expression: string
  weight: number
}

export interface CutieManifest {
  formatVersion: number
  id: string
  name: string
  intro: string
  author?: string
  defaultExpression: string
  defaultBackground: string
  /** Background shown per time slot unless a line overrides it. */
  backgroundBySlot?: Record<string, string>
  timeSlots?: TimeSlot[]
  stages?: Stage[]
  /** Percentages that always fire an event, so missing lines show a placeholder. */
  milestones?: { daily?: number[]; total?: number[] }
  /** Ambient chatter: every N minutes, roll `chance` (0-1) to fire a `random` event. */
  ambient?: { everyMinutes: number; chance: number }
  /** Idle fidgets: every N seconds with no dialogue, swap to a weighted expression. */
  idle?: { everySeconds: number; expressions: WeightedExpression[] }
  colors?: { accent?: string; name?: string }
}

// ---------------------------------------------------------------- script

export type TriggerType =
  | 'session_start' // app opened on this project
  | 'reopen' // app opened again later the same day
  | 'day_start' // first open on a new calendar day; value = project day number
  | 'time_slot' // entered a time slot; value = slot id
  | 'daily_pct' // today's words crossed value% of the daily goal
  | 'total_pct' // total words crossed value% of the total goal
  | 'words_today' // today's words crossed value
  | 'words_total' // total words crossed value
  | 'words_every' // total words crossed a multiple of value
  | 'date' // calendar date "MM-DD" seen on open or at midnight
  | 'stage' // entered affinity stage; value = stage id
  | 'streak' // writing streak reached value days (fires on day_start)
  | 'idle' // no typing for value minutes
  | 'random' // ambient tick won its roll
  | 'after' // follow-up; value = beat id or `beatId/choiceId`

export const TRIGGER_TYPES: readonly TriggerType[] = [
  'session_start', 'reopen', 'day_start', 'time_slot', 'daily_pct', 'total_pct',
  'words_today', 'words_total', 'words_every', 'date', 'stage', 'streak',
  'idle', 'random', 'after',
]

export interface Trigger {
  type: TriggerType
  /** Omit to match any value of this trigger type. */
  value?: string | number
}

export type ConditionVar =
  | 'day' | 'date' | 'weekday' | 'hour' | 'timeSlot' | 'stage'
  | 'totalWords' | 'todayWords' | 'totalPct' | 'dailyPct'
  | 'missedDays' | 'daysAway' | 'streak' | 'chance'
  | `flag:${string}` | `seen:${string}`

export type ConditionOp = '==' | '!=' | '>' | '>=' | '<' | '<=' | 'in' | 'not_in'

export const CONDITION_OPS: readonly ConditionOp[] = ['==', '!=', '>', '>=', '<', '<=', 'in', 'not_in']

export interface Condition {
  var: ConditionVar
  op: ConditionOp
  value: string | number | boolean | Array<string | number>
}

export interface Line {
  text: string
  expression?: string
  background?: string
  /** Show a reward image over the scene. */
  cg?: string
  /** Play sounds/<name>.(mp3|ogg|wav) when the line appears. */
  sound?: string
  /** `thought` renders as an aside, e.g. muttering to oneself. */
  style?: 'speech' | 'thought'
  /** Who is talking. Defaults to the cutie; `player` uses the player's name. */
  speaker?: string
}

export type FlagValue = string | number | boolean

export interface FlagEffect {
  flag: string
  /** `set` assigns value; `add` adds a number (missing flags start at 0). */
  op: 'set' | 'add'
  value: FlagValue
}

export interface Choice {
  id: string
  text: string
  lines?: Line[]
  effects?: FlagEffect[]
}

export type Repeat = 'once' | 'daily' | 'always'

export interface Beat {
  id: string
  trigger: Trigger
  when?: Condition[]
  /** Higher wins when several beats match one event. Default 0. */
  priority?: number
  /** Relative odds among beats tied on priority. Default 1. */
  weight?: number
  /** Default `always`; progress events already fire once per day or once ever. */
  repeat?: Repeat
  cooldownMinutes?: number
  /** Optional line sets picked at random; used instead of `lines` when present. */
  variants?: Line[][]
  lines?: Line[]
  /** Prompt shown above the choices, said by the player. */
  prompt?: string
  choices?: Choice[]
  effects?: FlagEffect[]
  /** Free-form note for the author; never shown in the app. */
  note?: string
}

export interface Script {
  formatVersion: number
  beats: Beat[]
}

// ---------------------------------------------------------------- runtime

export interface Pack {
  manifest: CutieManifest
  script: Script
  /** File name (inside images/) -> URL the browser can load. */
  images: Record<string, string>
  /** Sound name (no extension, inside sounds/) -> URL. */
  sounds: Record<string, string>
  expressions: string[]
  backgrounds: string[]
  cgs: string[]
}

export interface DayRecord {
  /** Total word count when this day was first seen. */
  startWords: number
  /** Last total word count seen on this day. */
  endWords: number
}

export interface BeatLogEntry {
  count: number
  lastAt: number
  lastDate: string
}

export interface Project {
  id: string
  title: string
  playerName: string
  cutieId: string
  totalGoal: number
  dailyGoal: number
  /** Local date "YYYY-MM-DD" of project day 1. */
  startDate: string
  doc: string
  wordCount: number
  days: Record<string, DayRecord>
  flags: Record<string, FlagValue>
  beatLog: Record<string, BeatLogEntry>
  /** Reward art (cg names) the player has seen, for the gallery. */
  gallery?: string[]
  /** One-shot events already fired, e.g. `total_pct:50`. */
  firedOnce: string[]
  /** Per-day events already fired today, e.g. `daily_pct:50`. */
  firedToday: { date: string; keys: string[] }
  /** Last time slot an event was fired for, as `date|slot`. */
  lastSlot?: string
  stage?: string
  createdAt: number
  updatedAt: number
}

export interface EngineEvent {
  type: TriggerType
  value?: string | number
}

/** Everything a condition or template can read, derived from project + clock. */
export interface Stats {
  now: Date
  date: string
  monthDay: string
  weekday: number
  hour: number
  day: number
  timeSlot: string
  stage: string
  totalWords: number
  todayWords: number
  totalPct: number
  dailyPct: number
  missedDays: number
  /** Full days skipped right before today (0 if you wrote yesterday). */
  daysAway: number
  streak: number
}

/** A beat resolved for display: one picked line set plus its choices. */
export interface Scene {
  beatId: string
  lines: Line[]
  prompt?: string
  choices?: Choice[]
  placeholder?: boolean
}
