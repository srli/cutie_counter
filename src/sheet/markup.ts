/**
 * The little language the artist writes inside spreadsheet cells, both ways:
 *   {smile} Good morning.              face + line; a new line in the cell = next textbox page
 *   You: Sure!   Narrator: He sighs.   someone else talking
 *   [A: No] Eat something. [B: Yes] Good.   choices and their answers
 *   [You: Before I start...]           what the player says before choosing
 *   [if missed days = 0] … [elif …] … [else] …
 *   [or]                               random versions
 *   [set likes chocolate = yes]  [add 1 to visits]
 *   [thinks] [bg room_night] [picture first_date] [sound giggle]
 */
import type { Choice, Condition, ConditionOp, FlagEffect, FlagValue, Line, TimeSlot } from '../engine/types'

export interface Context {
  cutieName: string
  slots: TimeSlot[]
  stages: { id: string; name: string }[]
}

export class MarkupError extends Error {}

// ---------------------------------------------------------------- names

export const slug = (s: string) => s.trim().toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

/** "Ultra-late night (2AM to 5AM)" -> slot id, by loose name match. */
export function findSlot(name: string, ctx: Context): string | undefined {
  const want = slug(name.replace(/\(.*?\)/g, '')).replace(/_night$/, '')
  const flat = (s: string) => s.replace(/_/g, '')
  return ctx.slots.find((s) => slug(s.id) === want || flat(slug(s.id)) === flat(want))?.id
    ?? (/^late_morning/.test(want) ? ctx.slots.find((s) => s.id === 'late_morning')?.id : undefined)
}

export const slotLabel = (id: string) => id.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()).replace('Ultra late', 'Ultra-late')

function findStage(name: string, ctx: Context): string | undefined {
  const want = slug(name)
  return ctx.stages.find((s) => s.id === want || slug(s.name) === want)?.id
}

// ---------------------------------------------------------------- values

function parseValue(raw: string): FlagValue {
  const v = raw.trim()
  if (/^(yes|true)$/i.test(v)) return true
  if (/^(no|false)$/i.test(v)) return false
  return v !== '' && !Number.isNaN(Number(v)) ? Number(v) : v
}
const showValue = (v: unknown) => (v === true ? 'yes' : v === false ? 'no' : String(v))
const opWord = (op: string): ConditionOp => (op === '=' || op === 'is' ? '==' : op as ConditionOp)

// ---------------------------------------------------------------- conditions

const NUMBER_VARS: Record<string, Condition['var']> = {
  'day': 'day', 'streak': 'streak', 'days away': 'daysAway', 'words today': 'todayWords', 'total words': 'totalWords',
  'hour': 'hour', 'weekday': 'weekday', "today's goal %": 'dailyPct', 'whole goal %': 'totalPct',
}

/** One plain phrase -> conditions. Throws MarkupError with a friendly message. */
export function parseCondition(phrase: string, ctx: Context): Condition[] {
  const out: Condition[] = []
  for (const part of phrase.split(/\s+and\s+/i)) {
    const p = part.trim().replace(/:$/, '').replace(/[’]/g, "'")
    const lower = p.toLowerCase()
    let m: RegExpMatchArray | null

    if ((m = lower.match(/^missed days\s*(>=|<=|!=|==|=|>|<)\s*(\d+)$/))) out.push({ var: 'missedDays', op: opWord(m[1]), value: Number(m[2]) })
    else if (/^missed yesterday$/.test(lower)) out.push({ var: 'daysAway', op: '>', value: 0 })
    else if (/^wrote yesterday$/.test(lower)) out.push({ var: 'daysAway', op: '==', value: 0 })
    else if (/^daily goal (done|complete|completed)$/.test(lower)) out.push({ var: 'dailyPct', op: '>=', value: 100 })
    else if (/^daily goal not (done|complete|completed)$/.test(lower)) out.push({ var: 'dailyPct', op: '<', value: 100 })
    else if ((m = lower.match(/^chance (\d+(?:\.\d+)?)%$/))) out.push({ var: 'chance', op: '<', value: Number(m[1]) / 100 })
    else if ((m = p.match(/^it'?s (.+)$/i)) && findSlot(m[1], ctx)) out.push({ var: 'timeSlot', op: '==', value: findSlot(m[1], ctx)! })
    else if ((m = p.match(/^(?:not saw|didn'?t see) (.+)$/i))) out.push({ var: `seen:${refToId(m[1], ctx)}`, op: '==', value: false })
    else if ((m = p.match(/^saw (.+)$/i))) out.push({ var: `seen:${refToId(m[1], ctx)}`, op: '==', value: true })
    else if ((m = p.match(/^stage\s*(=|is|!=)\s*(.+)$/i))) {
      const stage = findStage(m[2], ctx)
      if (!stage) throw new MarkupError(`I don't know the stage "${m[2]}". Stages: ${ctx.stages.map((s) => s.name).join(', ')}.`)
      out.push({ var: 'stage', op: m[1] === '!=' ? '!=' : '==', value: stage })
    } else if ((m = p.match(/^(.+?) visits\s*(>=|<=|!=|=|>|<)\s*(\d+)$/i)) && findSlot(m[1], ctx)) {
      // The engine counts the days the writer was here at each time of day as `visits_<slot>`.
      out.push({ var: `flag:visits_${findSlot(m[1], ctx)}`, op: opWord(m[2]), value: Number(m[3]) })
    } else if ((m = p.match(/^(day|streak|days away|words today|total words|hour|weekday|today's goal %|whole goal %)\s*(>=|<=|!=|=|>|<)\s*(\d+)$/i))) {
      out.push({ var: NUMBER_VARS[m[1].toLowerCase()], op: opWord(m[2]), value: Number(m[3]) })
    } else if ((m = p.match(/^(dailyPct|totalPct|todayWords|totalWords|missedDays|daysAway|day|hour|weekday|streak|date|timeSlot|stage|(?:flag|seen):[\w:.-]+)\s*(>=|<=|!=|==|=|>|<)\s*(.+)$/))) {
      out.push({ var: m[1] as Condition['var'], op: opWord(m[2]), value: parseValue(m[3]) })
    } else if ((m = p.match(/^([a-z][\w ]*?)\s*(>=|<=|!=|=|>|<|\bis\b)\s*(.+)$/i))) {
      out.push({ var: `flag:${slug(m[1])}`, op: opWord(m[2]), value: parseValue(m[3]) })
    } else {
      throw new MarkupError(`I don't understand the condition "${p}". See the Cheat sheet tab for the phrases I know.`)
    }
  }
  return out
}

export function formatCondition(c: Condition, ctx: Context): string {
  const op = c.op === '==' ? '=' : c.op
  const v = c.value
  if (c.var === 'missedDays') return `missed days ${op} ${v}`
  if (c.var === 'daysAway' && c.op === '>' && v === 0) return 'missed yesterday'
  if (c.var === 'daysAway' && c.op === '==' && v === 0) return 'wrote yesterday'
  if (c.var === 'dailyPct' && c.op === '>=' && v === 100) return 'daily goal done'
  if (c.var === 'dailyPct' && c.op === '<' && v === 100) return 'daily goal not done'
  if (c.var === 'chance') return `chance ${Math.round(Number(v) * 100)}%`
  if (c.var === 'timeSlot' && c.op === '==') return `it's ${slotLabel(String(v)).toLowerCase()}`
  if (c.var === 'stage') return `stage ${c.op === '!=' ? '!=' : '='} ${ctx.stages.find((s) => s.id === v)?.name ?? v}`
  if (c.var.startsWith('seen:')) return `${v === false ? 'not saw' : 'saw'} ${idToRef(c.var.slice(5), ctx)}`
  if (c.var.startsWith('flag:visits_')) {
    const slot = c.var.slice('flag:visits_'.length)
    if (ctx.slots.some((s) => s.id === slot)) return `${slotLabel(slot).toLowerCase()} visits ${op} ${v}`
  }
  if (c.var.startsWith('flag:') && !c.var.includes(':', 5)) return `${c.var.slice(5).replace(/_/g, ' ')} ${op} ${showValue(v)}`
  const word = Object.entries(NUMBER_VARS).find(([, x]) => x === c.var)?.[0]
  if (word && typeof v === 'number' && Number.isInteger(v)) return `${word} ${op} ${v}`
  return `${c.var} ${op} ${showValue(Array.isArray(v) ? v.join(',') : v)}`
}

/** "day 18 ultra-late" -> "d18-ultra_late"; "whole goal 25%" -> "total-25"; anything else -> id or slug. */
export function refToId(ref: string, ctx: Context): string {
  const r = ref.trim()
  let m
  if ((m = r.match(/^day (\d+) daily goal (\d+)%$/i))) return `d${m[1]}-daily-${m[2]}`
  if ((m = r.match(/^day (\d+) (.+)$/i)) && findSlot(m[2], ctx)) return `d${m[1]}-${findSlot(m[2], ctx)}`
  if ((m = r.match(/^whole goal (\d+)%$/i))) return `total-${m[1]}`
  return /^[\w.-]+$/.test(r) ? r : slug(r)
}

export function idToRef(id: string, ctx: Context): string {
  let m
  if ((m = id.match(/^d(\d+)-([a-z_]+)$/)) && ctx.slots.some((s) => s.id === m![2])) return `day ${m[1]} ${slotLabel(m[2]).toLowerCase()}`
  if ((m = id.match(/^total-(\d+)$/))) return `whole goal ${m[1]}%`
  return id
}

// ---------------------------------------------------------------- effects

function parseEffect(tag: string): FlagEffect | null {
  let m
  if ((m = tag.match(/^set (.+?)\s*=\s*(.+)$/i))) return { flag: slug(m[1]), op: 'set', value: parseValue(m[2]) }
  if ((m = tag.match(/^add (-?\d+) to (.+)$/i))) return { flag: slug(m[2]), op: 'add', value: Number(m[1]) }
  return null
}
const formatEffect = (e: FlagEffect) =>
  e.op === 'add' ? `[add ${e.value} to ${e.flag.replace(/_/g, ' ')}]` : `[set ${e.flag.replace(/_/g, ' ')} = ${showValue(e.value)}]`

// ---------------------------------------------------------------- lines

// {player}, {day}… are fill-ins, not faces.
const FILL_INS = 'player|cutie|day|streak|dailyGoal|totalGoal|todayWords|totalWords|wordsLeft|wordsLeftToday'
const FACE_SPLIT = new RegExp(`(?=\\{(?!(?:${FILL_INS})\\})[a-z_]+\\})`, 'i')
const FACE_AT_START = new RegExp(`^\\{(?!(?:${FILL_INS})\\})([a-z_]+)\\}\\s*`, 'i')

const FRIENDLY: [string, string][] = [
  ['words left today', 'wordsLeftToday'], ['words left', 'wordsLeft'], ['daily goal', 'dailyGoal'],
  ['total goal', 'totalGoal'], ['words today', 'todayWords'], ['total words', 'totalWords'],
]
export function toEngineVars(s: string): string {
  for (const [f, e] of FRIENDLY) s = s.replace(new RegExp(`\\{${f}\\}`, 'gi'), `{${e}}`)
  return s.replace(/\[#?NAME\]|\[PLAYER_NAME\]/g, '{player}')
}
export function toFriendlyVars(s: string): string {
  for (const [f, e] of FRIENDLY) s = s.split(`{${e}}`).join(`{${f}}`)
  return s
}

const LINE_TAG = /\s*\[(thinks|bg [^\]]+|picture [^\]]+|sound [^\]]+)\]\s*/gi

/** Split long speech at sentence ends so it fits the textbox. */
export function chunk(text: string, max = 200): string[] {
  if (text.length <= max) return [text]
  const parts = text.split(/(?<=[.!?…~)])\s+(?=["'“(A-Z*-])/)
  const out: string[] = []
  let cur = ''
  for (const p of parts) {
    if (cur && (cur + ' ' + p).length > max) { out.push(cur); cur = p } else cur = cur ? `${cur} ${p}` : p
  }
  if (cur) out.push(cur)
  return out
}

/** Text (possibly several lines) -> Lines. `defaults` sets speaker from the Scenes Who column. */
/** Brackets left in spoken text are almost always a typo: say so instead of showing them to the player. */
function checkStray(text: string) {
  const s = text.replace(/\[(PLACEHOLDER[^\]]*|#?NAME|PLAYER_NAME)\]/gi, '')
  const tag = s.match(/\[[^\][]*\]/)
  if (tag) {
    throw new MarkupError(/^\[(if|elif|else)\b/i.test(tag[0])
      ? `"${tag[0]}" can't go in the middle of a line. Put [if …] at the start of a cell, or use the If column.`
      : `I don't understand "${tag[0]}". See the Cheat sheet tab for the [ ] tags I know.`)
  }
  for (const [o, c] of [['[', ']'], ['{', '}']]) {
    let depth = 0
    let start = 0
    for (let i = 0; i < s.length; i++) {
      if (s[i] === o) { if (!depth) start = i; depth++ }
      else if (s[i] === c) {
        if (!depth) throw new MarkupError(`There's a ${c} with no ${o} before it.`)
        depth--
      }
    }
    if (depth) throw new MarkupError(`"${s.slice(start, start + 30).trim()}…" is missing its closing ${c}.`)
  }
}

export function parseLines(text: string, ctx: Context, defaults: Partial<Line> = {}): Line[] {
  const out: Line[] = []
  for (const raw of text.split(/\n+/)) {
    let s = raw.trim()
    if (!s) continue
    const line: Partial<Line> = { ...defaults }
    // Only these prefixes mean "someone is talking"; anything else is ordinary text.
    const who = s.match(/^(You|MC|Narrator|R|\w+):\s+/)
    if (who && ['You', 'MC', 'Narrator', 'R', ctx.cutieName.split(' ')[0]].includes(who[1])) {
      const w = who[1]
      if (w === 'You' || w === 'MC') line.speaker = 'player'
      else if (w === 'Narrator') line.speaker = 'narrator'
      else delete line.speaker
      s = s.slice(who[0].length)
    }
    s = toEngineVars(s)
    // Faces may appear mid-line: each one starts a new page with that face.
    for (let piece of s.split(FACE_SPLIT)) {
      const cur: Partial<Line> = { ...line }
      const face = piece.match(FACE_AT_START)
      if (face) { cur.expression = face[1].toLowerCase(); piece = piece.slice(face[0].length) }
      // Tags can sit anywhere in the line; they apply to the whole page.
      piece = piece.replace(LINE_TAG, (_, tag: string) => {
        if (/^thinks$/i.test(tag)) cur.style = 'thought'
        else if (/^bg /i.test(tag)) cur.background = slug(tag.slice(3))
        else if (/^picture /i.test(tag)) cur.cg = slug(tag.slice(8))
        else if (/^sound /i.test(tag)) cur.sound = slug(tag.slice(6))
        return ''
      })
      piece = piece.trim()
      checkStray(piece)
      if (!piece && !cur.expression) continue
      chunk(piece || '…').forEach((text, i) => out.push(i === 0
        ? { ...cur, text } as Line
        : { text, ...(cur.speaker ? { speaker: cur.speaker } : {}), ...(cur.style ? { style: cur.style } : {}) }))
    }
  }
  return out
}

export function formatLines(lines: Line[], opts: { speakerInText?: boolean } = { speakerInText: true }): string {
  return lines.map((l) => {
    const who = !opts.speakerInText || !l.speaker ? '' : l.speaker === 'player' ? 'You: ' : l.speaker === 'narrator' ? 'Narrator: ' : ''
    const tags = [l.style === 'thought' ? '[thinks]' : '', l.background ? `[bg ${l.background}]` : '', l.cg ? `[picture ${l.cg}]` : '', l.sound ? `[sound ${l.sound}]` : '']
      .filter(Boolean).join(' ')
    return `${who}${l.expression ? `{${l.expression}} ` : ''}${tags ? `${tags} ` : ''}${toFriendlyVars(l.text)}`
  }).join('\n')
}

// ---------------------------------------------------------------- cells

export interface CellBody {
  variants: Line[][]
  prompt?: string
  choices?: Choice[]
  effects: FlagEffect[]
}

export interface CellBranch {
  kind: 'if' | 'elif' | 'else' | 'always'
  conditions: Condition[]
  body: CellBody
}

/** A body without [if]: lines, [or] versions, choices, effects. */
export function parseBody(text: string, ctx: Context): CellBody {
  const effects: FlagEffect[] = []
  let prompt: string | undefined
  const s = text.replace(/\[(?:You|Name):\s*([^\]]+)\]/i, (_, p: string) => { prompt = p.trim(); return '' })

  const marks = [...s.matchAll(/\[([A-Z]):\s*([^\]]+)\]/g)]
  const takeEffects = (t: string, into: FlagEffect[]) => t.replace(/\[((?:set|add) [^\]]+)\]/gi, (all, tag: string) => {
    const e = parseEffect(tag)
    if (!e) throw new MarkupError(`I don't understand "${all}". Try [set likes cats = yes] or [add 1 to visits].`)
    into.push(e)
    return ''
  })
  const head = takeEffects(marks.length ? s.slice(0, marks[0].index) : s, effects)
  const leftover = (head.match(/\[[^\]]*\]/g) ?? []).filter((t) => !/^\[(or|thinks|bg [^\]]+|picture [^\]]+|sound [^\]]+)\]$/i.test(t) && !/^\[(PLACEHOLDER|#?NAME\]|PLAYER_NAME\])/i.test(t))
  if (leftover.length) throw new MarkupError(`I don't understand ${leftover.map((t) => `"${t}"`).join(', ')}. Choices look like [A: text]; conditions like [if daily goal done].`)
  const variants = head.split(/\[or\]/i).map((v) => parseLines(v, ctx)).filter((v) => v.length)

  const choices: Choice[] = marks.map((mk, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].index : s.length
    const ce: FlagEffect[] = []
    const lines = parseLines(takeEffects(s.slice(mk.index! + mk[0].length, end), ce), ctx)
    return { id: mk[1], text: toEngineVars(mk[2].trim()), ...(lines.length ? { lines } : {}), ...(ce.length ? { effects: ce } : {}) }
  })
  return { variants, ...(prompt ? { prompt: toEngineVars(prompt) } : {}), ...(choices.length ? { choices } : {}), effects }
}

/** A whole cell: optional [if]/[elif]/[else] branches around bodies. */
export function parseCell(text: string, ctx: Context): CellBranch[] {
  const marks = [...text.matchAll(/\[(if [^\]]+|elif [^\]]+|else)\]/gi)]
  if (!marks.length) return [{ kind: 'always', conditions: [], body: parseBody(text, ctx) }]
  const pre = text.slice(0, marks[0].index)
  const branches: CellBranch[] = marks.map((mk, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].index : text.length
    const tag = mk[1].trim()
    const kind = /^else$/i.test(tag) ? 'else' : /^elif/i.test(tag) ? 'elif' : 'if'
    const conditions = kind === 'else' ? [] : parseCondition(tag.replace(/^(if|elif)\s+/i, ''), ctx)
    return { kind, conditions, body: parseBody(`${pre}\n${text.slice(mk.index! + mk[0].length, end)}`, ctx) }
  })
  // "[if …]" with no [else]: the opening text alone still plays otherwise.
  if (pre.trim() && !branches.some((b) => b.kind === 'else')) branches.push({ kind: 'else', conditions: [], body: parseBody(pre, ctx) })
  return branches
}

type Beatish = { lines?: Line[]; variants?: Line[][]; prompt?: string; choices?: Choice[]; effects?: FlagEffect[] }

export function formatBody(b: Beatish): string {
  const versions = b.variants?.length ? b.variants : [b.lines ?? []]
  const parts: string[] = [versions.map((v) => formatLines(v)).join('\n[or]\n')]
  if (b.effects?.length) parts.push(b.effects.map(formatEffect).join(' '))
  if (b.prompt) parts.push(`[You: ${toFriendlyVars(b.prompt)}]`)
  for (const c of b.choices ?? []) {
    parts.push(`[${c.id}: ${toFriendlyVars(c.text)}] ${formatLines(c.lines ?? [])}${c.effects?.length ? ` ${c.effects.map(formatEffect).join(' ')}` : ''}`.trim())
  }
  return parts.filter(Boolean).join('\n')
}

const asBeatish = (b: CellBody): Beatish => ({
  ...(b.variants.length > 1 ? { variants: b.variants } : { lines: b.variants[0] ?? [] }),
  prompt: b.prompt, choices: b.choices, effects: b.effects,
})

export function formatBranches(branches: CellBranch[], ctx: Context): string {
  if (branches.length === 1 && branches[0].kind === 'always') return formatBody(asBeatish(branches[0].body))
  return branches.map((br, i) => {
    const tag = br.kind === 'else' ? '[else]' : `[${i === 0 ? 'if' : 'elif'} ${br.conditions.map((c) => formatCondition(c, ctx)).join(' and ')}]`
    return `${tag}\n${formatBody(asBeatish(br.body))}`
  }).join('\n')
}
