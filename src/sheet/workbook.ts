/**
 * Spreadsheet <-> script. One workbook can hold several cuties: tabs are named "<Cutie> – <Tab>".
 * Tabs: Time of day, Daily goal, Whole goal, Special days, Random chatter, Reactions, Scenes.
 * See docs/SPREADSHEET_FORMAT.md.
 */
import { DEFAULT_TIME_SLOTS } from '../engine/time'
import type { Beat, Condition, CutieManifest, FlagEffect, Line, Repeat, Script, Trigger } from '../engine/types'
import {
  findSlot, formatBody, formatBranches, formatCondition, formatLines, idToRef, MarkupError, parseBody, parseCell,
  parseCondition, parseLines, refToId, slotLabel, slug, type CellBranch, type Context,
} from './markup'
import type { Sheet, WriteSheet } from './xlsx'

export interface Problem { where: string; message: string }

export const TAB_NAMES = ['Time of day', 'Daily goal', 'Whole goal', 'Special days', 'Random chatter', 'Reactions', 'Scenes'] as const
type TabName = typeof TAB_NAMES[number]

export function contextFor(m: CutieManifest): Context {
  return {
    cutieName: m.name,
    slots: m.timeSlots?.length ? m.timeSlots : DEFAULT_TIME_SLOTS,
    stages: (m.stages ?? []).map((s) => ({ id: s.id, name: s.name })),
  }
}

/** "Ryder – Time of day" -> { cutie: "Ryder", tab: "Time of day" } */
export function splitTabName(name: string): { cutie?: string; tab?: TabName } {
  const m = name.match(/^(.+?)\s+[–—-]\s+(.+)$/)
  const [cutie, rest] = m ? [m[1].trim(), m[2]] : [undefined, name]
  const tab = TAB_NAMES.find((t) => slug(t) === slug(rest))
  return { cutie, tab }
}

/** Which cuties have tabs in this workbook. */
export function cutiesIn(sheets: Sheet[]): string[] {
  return [...new Set(sheets.map((s) => splitTabName(s.name)).filter((x) => x.tab && x.cutie).map((x) => x.cutie!))]
}

// ---------------------------------------------------------------- "When" phrases

export function parseWhen(phrase: string, ctx: Context): { trigger: Trigger; day?: number } {
  const p = phrase.trim()
  let m
  if ((m = p.match(/^(?:day (\d+)\s+)?daily goal (\d+)%$/i))) return { trigger: { type: 'daily_pct', value: Number(m[2]) }, day: m[1] ? Number(m[1]) : undefined }
  if ((m = p.match(/^whole goal (\d+)%$/i))) return { trigger: { type: 'total_pct', value: Number(m[1]) } }
  if (/^story opened$/i.test(p)) return { trigger: { type: 'session_start' } }
  if (/^(welcome back|reopened)$/i.test(p)) return { trigger: { type: 'reopen' } }
  if ((m = p.match(/^new day(?: (\d+))?$/i))) return { trigger: { type: 'day_start', ...(m[1] ? { value: Number(m[1]) } : {}) } }
  if ((m = p.match(/^date (\d{1,2})-(\d{1,2})$/i))) return { trigger: { type: 'date', value: `${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` } }
  if ((m = p.match(/^stage (.+)$/i))) {
    const want = slug(m[1])
    const id = ctx.stages.find((s) => slug(s.name) === want || s.id === want)?.id
    if (!id) throw new MarkupError(`I don't know the stage "${m[1]}".`)
    return { trigger: { type: 'stage', value: id } }
  }
  if ((m = p.match(/^streak (\d+)$/i))) return { trigger: { type: 'streak', value: Number(m[1]) } }
  if ((m = p.match(/^idle (\d+)(?: min(?:utes)?)?$/i))) return { trigger: { type: 'idle', value: Number(m[1]) } }
  if ((m = p.match(/^every (\d+) words$/i))) return { trigger: { type: 'words_every', value: Number(m[1]) } }
  if ((m = p.match(/^words today (\d+)$/i))) return { trigger: { type: 'words_today', value: Number(m[1]) } }
  if ((m = p.match(/^total words (\d+)$/i))) return { trigger: { type: 'words_total', value: Number(m[1]) } }
  if (/^random$/i.test(p)) return { trigger: { type: 'random' } }
  if ((m = p.match(/^after (.+)$/i))) return { trigger: { type: 'after', value: m[1].split('|').map((r) => refToId(r, ctx)).join('|') } }
  if ((m = p.match(/^(?:(?:day (\d+)|any)\s+)?(.+)$/i)) && findSlot(m[2], ctx)) {
    return { trigger: { type: 'time_slot', value: findSlot(m[2], ctx)! }, day: m[1] ? Number(m[1]) : undefined }
  }
  throw new MarkupError(`I don't understand "When: ${p}". See the Cheat sheet tab.`)
}

export function formatWhen(t: Trigger, day: number | undefined, ctx: Context): string {
  const d = day !== undefined ? `Day ${day} ` : ''
  switch (t.type) {
    case 'time_slot': return `${d}${slotLabel(String(t.value))}`
    case 'daily_pct': return `${d}Daily goal ${t.value}%`
    case 'total_pct': return `Whole goal ${t.value}%`
    case 'session_start': return 'Story opened'
    case 'reopen': return 'Welcome back'
    case 'day_start': return t.value !== undefined ? `New day ${t.value}` : 'New day'
    case 'date': return `Date ${t.value}`
    case 'stage': return `Stage ${ctx.stages.find((s) => s.id === t.value)?.name ?? t.value}`
    case 'streak': return `Streak ${t.value}`
    case 'idle': return `Idle ${t.value} min`
    case 'words_every': return `Every ${t.value} words`
    case 'words_today': return `Words today ${t.value}`
    case 'words_total': return `Total words ${t.value}`
    case 'random': return 'Random'
    case 'after': return `After ${String(t.value).split('|').map((id) => idToRef(id, ctx)).join('|')}`
  }
}

// ---------------------------------------------------------------- options

interface Options { repeat?: Repeat; cooldownMinutes?: number; priority?: number; weight?: number; textbox?: boolean }
function parseOptions(s: string): Options {
  const o: Options = {}
  for (const part of s.split(/[,;]+/).map((x) => x.trim()).filter(Boolean)) {
    let m
    if (/^(once|daily|always)$/i.test(part)) o.repeat = part.toLowerCase() as Repeat
    else if (/^once a day$/i.test(part)) o.repeat = 'daily'
    else if (/^(in the )?textbox$/i.test(part)) o.textbox = true
    else if ((m = part.match(/^wait (\d+)(?: min(?:utes)?)?$/i))) o.cooldownMinutes = Number(m[1])
    else if ((m = part.match(/^priority (-?\d+)$/i))) o.priority = Number(m[1])
    else if ((m = part.match(/^odds (\d+(?:\.\d+)?)$/i))) o.weight = Number(m[1])
    else throw new MarkupError(`I don't understand the option "${part}". Try: once, daily, wait 30 min, priority 2, odds 3, textbox.`)
  }
  return o
}
function formatOptions(b: Beat, inScenes = false): string {
  return [
    inScenes && b.display !== 'scene' ? 'textbox' : '',
    b.repeat && b.repeat !== 'always' ? b.repeat : '',
    b.cooldownMinutes ? `wait ${b.cooldownMinutes} min` : '',
    b.priority ? `priority ${b.priority}` : '',
    b.weight !== undefined && b.weight !== 1 ? `odds ${b.weight}` : '',
  ].filter(Boolean).join(', ')
}
const withOptions = (b: Beat, o: Options): Beat => ({
  ...b,
  ...(o.repeat && o.repeat !== 'always' ? { repeat: o.repeat } : {}),
  ...(o.cooldownMinutes ? { cooldownMinutes: o.cooldownMinutes } : {}),
  ...(o.weight !== undefined && o.weight !== 1 ? { weight: o.weight } : {}),
})

// ---------------------------------------------------------------- import

const cellText = (row: string[] | undefined, c: number) => (row?.[c] ?? '').trim()

function dayOf(label: string): number | 'any' | null {
  const l = label.trim()
  if (/^any$/i.test(l)) return 'any'
  const m = l.match(/^(?:day\s*)?(\d+)(?:\.0+)?$/i)
  return m ? Number(m[1]) : null
}

/** "50%", "50% of daily word count", "1.5" (= 150%) */
function pctOf(label: string): number | null {
  const l = label.trim()
  let m
  if ((m = l.match(/^(\d+(?:\.\d+)?)\s*%/))) return Number(m[1])
  if ((m = l.match(/^(\d+(?:\.\d+)?)$/))) { const n = Number(m[1]); return n <= 5 ? Math.round(n * 100) : n }
  return null
}

// Older scripts counted visits by hand; the engine now does it (`visits_<slot>`), so exports drop these.
const isTalk = (e: FlagEffect) => e.op === 'add' && e.value === 1 && /_talks$/.test(e.flag)
const dayIs = (day: number): Condition => ({ var: 'day', op: '==', value: day })

/** A cell's branches -> beats sharing a trigger. The first true branch wins; "Any" rows rank below day rows. */
function branchBeats(
  id: string, trigger: Trigger, day: number | undefined, branches: CellBranch[],
  extra: { effects?: FlagEffect[]; when?: Condition[]; base?: number } = {},
): Beat[] {
  const base = extra.base ?? (day === undefined ? -10 : 0)
  return branches.map((br, i) => {
    const suffix = br.kind === 'always' ? '' : br.kind === 'else' ? '-else' : i === 0 ? '-if' : `-elif${i}`
    const rank = br.kind === 'else' || br.kind === 'always' ? 0 : branches.length - i
    const effects = [...br.body.effects, ...(extra.effects ?? [])]
    const when = [...(day !== undefined ? [dayIs(day)] : []), ...(extra.when ?? []), ...br.conditions]
    return {
      id: `${id}${suffix}`,
      trigger,
      ...(when.length ? { when } : {}),
      ...(base + rank ? { priority: base + rank } : {}),
      ...(br.body.variants.length > 1 ? { variants: br.body.variants } : { lines: br.body.variants[0] ?? [] }),
      ...(br.body.prompt ? { prompt: br.body.prompt } : {}),
      ...(br.body.choices ? { choices: br.body.choices } : {}),
      ...(effects.length ? { effects } : {}),
    }
  })
}

export interface ImportResult { beats: Beat[]; problems: Problem[]; tabs: string[] }

export function importCutie(sheets: Sheet[], manifest: CutieManifest): ImportResult {
  const ctx = contextFor(manifest)
  const beats: Beat[] = []
  const problems: Problem[] = []
  const used: string[] = []
  const multi = cutiesIn(sheets).length > 0
  const isMe = (name: string) => slug(name) === slug(manifest.name) || slug(name) === manifest.id

  const mine = sheets.filter((s) => {
    const { cutie, tab } = splitTabName(s.name)
    return !!tab && (multi ? !!cutie && isMe(cutie) : true)
  })
  if (!mine.length) {
    problems.push({ where: 'Workbook', message: `No tabs for ${manifest.name}. Name them like "${manifest.name} – Time of day".` })
    return { beats, problems, tabs: used }
  }

  const tryCell = (where: string, fn: () => void) => {
    try { fn() } catch (e) { problems.push({ where, message: e instanceof MarkupError ? e.message : `Something went wrong: ${(e as Error).message}` }) }
  }

  for (const sheet of mine) {
    const tab = splitTabName(sheet.name).tab!
    used.push(sheet.name)
    const header = sheet.rows[0] ?? []
    const rows = sheet.rows.slice(1)
    const at = (r: number, label: string) => `${sheet.name}, row ${r + 2}${label ? `, ${label}` : ''}`

    if (tab === 'Time of day' || tab === 'Daily goal') {
      const cols = header.map((h, c) => {
        if (c === 0 || !h.trim()) return null
        if (tab === 'Time of day') {
          const slot = findSlot(h, ctx)
          if (!slot) problems.push({ where: `${sheet.name}, column "${h}"`, message: `"${h}" isn't one of ${manifest.name}'s times of day (${ctx.slots.map((s) => slotLabel(s.id)).join(', ')}).` })
          return slot ? { kind: 'slot' as const, slot, label: h } : null
        }
        if (/^missed/i.test(h.trim())) return { kind: 'missed' as const, label: h }
        const pct = pctOf(h)
        if (pct === null) problems.push({ where: `${sheet.name}, column "${h}"`, message: `"${h}" should be a percentage like 50%.` })
        return pct === null ? null : { kind: 'pct' as const, pct, label: h }
      })
      rows.forEach((row, r) => {
        const label = cellText(row, 0)
        const day = dayOf(label)
        if (day === null) {
          if (row.slice(1).some((c) => c.trim())) problems.push({ where: at(r, ''), message: `"${label}" should be a day number or Any.` })
          return
        }
        const d = day === 'any' ? undefined : day
        const prefix = day === 'any' ? 'any' : `d${day}`
        cols.forEach((col, c) => {
          const text = cellText(row, c)
          if (!col || !text) return
          tryCell(at(r, `${day === 'any' ? 'Any' : `Day ${day}`}, ${col.label}`), () => {
            const branches = parseCell(text, ctx)
            if (col.kind === 'slot') {
              beats.push(...branchBeats(`${prefix}-${col.slot}`, { type: 'time_slot', value: col.slot }, d, branches))
            } else if (col.kind === 'pct') {
              beats.push(...branchBeats(`${prefix}-daily-${col.pct}`, { type: 'daily_pct', value: col.pct }, d, branches))
            } else {
              beats.push(...branchBeats(`${prefix}-missed-yesterday`, { type: 'day_start' }, d, branches,
                { when: [{ var: 'daysAway', op: '>', value: 0 }], base: d === undefined ? -1 : 1 }))
            }
          })
        })
      })
    } else if (tab === 'Whole goal' || tab === 'Special days') {
      rows.forEach((row, r) => {
        const label = cellText(row, 0)
        const text = cellText(row, 1)
        if (!label || !text) return
        tryCell(at(r, label), () => {
          const branches = parseCell(text, ctx)
          let m
          if (tab === 'Whole goal') {
            const pct = pctOf(label)
            if (pct === null) throw new MarkupError(`"${label}" should be a percentage like 25%.`)
            if (pct === 0) beats.push(...branchBeats('intro', { type: 'session_start' }, undefined, branches, { base: 10 }).map((b) => ({ ...b, repeat: 'once' as const })))
            else beats.push(...branchBeats(`total-${pct}`, { type: 'total_pct', value: pct }, undefined, branches, { base: 0 }))
          } else if ((m = label.match(/^(\d{1,2})-(\d{1,2})$/))) {
            const v = `${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
            beats.push(...branchBeats(`date-${v}`, { type: 'date', value: v }, undefined, branches, { base: 5 }))
          } else if ((m = label.match(/^day (\d+)$/i))) {
            beats.push(...branchBeats(`day-${m[1]}-start`, { type: 'day_start', value: Number(m[1]) }, undefined, branches, { base: 5 }))
          } else throw new MarkupError(`"${label}" should be a date like 10-31, or Day 7.`)
        })
      })
    } else if (tab === 'Random chatter') {
      const byStage = new Map<string, Line[][]>()
      rows.forEach((row, r) => {
        const stageName = cellText(row, 0)
        const text = cellText(row, 1)
        if (!text) return
        tryCell(at(r, stageName || 'any stage'), () => {
          const stage = stageName ? ctx.stages.find((s) => slug(s.name) === slug(stageName) || s.id === slug(stageName))?.id : ''
          if (stage === undefined) throw new MarkupError(`I don't know the stage "${stageName}".`)
          byStage.set(stage, [...(byStage.get(stage) ?? []), ...parseBody(text, ctx).variants])
        })
      })
      for (const [stage, variants] of byStage) {
        beats.push({
          id: `chatter-${stage || 'any'}`, trigger: { type: 'random' }, cooldownMinutes: 30,
          ...(stage ? { when: [{ var: 'stage', op: '==', value: stage }] } : {}), variants,
        })
      }
    } else if (tab === 'Reactions') {
      const ids = new Map<string, number>()
      rows.forEach((row, r) => {
        const [when, cond, text, opts] = [0, 1, 2, 3].map((c) => cellText(row, c))
        if (!when && !text) return
        tryCell(at(r, when), () => {
          if (!when) throw new MarkupError('Say when this happens in the When column.')
          const w = parseWhen(when, ctx)
          const o = parseOptions(opts)
          const base = slug(`react ${when}`)
          const n = (ids.get(base) ?? 0) + 1
          ids.set(base, n)
          beats.push(...branchBeats(n > 1 ? `${base}_${n}` : base, w.trigger, w.day, parseCell(text, ctx),
            { when: cond ? parseCondition(cond, ctx) : [], base: o.priority ?? 0 }).map((b) => withOptions(b, o)))
        })
      })
    } else if (tab === 'Scenes') {
      beats.push(...importScenes(sheet, ctx, problems))
    }
  }

  // Scene names used in "After …" resolve to the scene's last beats.
  const ends = sceneEnds(beats)
  for (const b of beats) {
    if (b.trigger.type !== 'after' || SCENE_ID.test(b.id)) continue // links inside a scene are already exact
    b.trigger = { ...b.trigger, value: String(b.trigger.value).split('|').map((ref) => ends.get(ref) ?? ref).join('|') }
  }

  const seen = new Set<string>()
  for (const b of beats) {
    if (seen.has(b.id)) problems.push({ where: b.id, message: `Two things make the moment "${b.id}". Is a row or scene name repeated?` })
    seen.add(b.id)
  }
  return { beats, problems, tabs: used }
}

// ---------------------------------------------------------------- scenes

const SCENE_ID = /^(.+)\.(\d+)(?:\.([A-Z]+))?$/
const sceneId = (name: string) => (/^[\w.-]+$/.test(name) ? name : slug(name))

function sceneEnds(beats: Beat[]): Map<string, string> {
  const groups = new Map<string, Beat[]>()
  for (const b of beats) {
    const head = b.id.match(SCENE_ID)?.[1] ?? b.id
    groups.set(head, [...(groups.get(head) ?? []), b])
  }
  const ends = new Map<string, string>()
  for (const [head, group] of groups) {
    if (group.length < 2) continue
    const num = (b: Beat) => Number(b.id.match(SCENE_ID)?.[2] ?? 0)
    const last = Math.max(...group.map(num))
    ends.set(head, group.filter((b) => num(b) === last).map((b) => b.id).join('|'))
  }
  return ends
}

interface SceneRow { r: number; who: string; face: string; picture: string; line: string; choice: string }
interface RawScene { name: string; when: string; cond: string; opts: string; startRow: number; rows: SceneRow[] }

/**
 * Rows -> beats. The first rows are the scene's head beat. "You" rows with "A: text" in Choice make buttons;
 * rows marked with a letter right after are that button's answer; later lettered rows become branch beats;
 * unlettered rows after a branch rejoin everyone. Ids: head, head.1, head.2.A …
 */
function importScenes(sheet: Sheet, ctx: Context, problems: Problem[]): Beat[] {
  const beats: Beat[] = []
  const scenes: RawScene[] = []
  let current = null as RawScene | null
  // Columns are found by their header, so older sheets without "Picture" still work.
  const header = (sheet.rows[0] ?? []).map((h) => slug(h))
  const col = (name: string) => header.indexOf(slug(name))
  sheet.rows.slice(1).forEach((row, r) => {
    const [name, when, cond, who, face, picture, line, choice, opts] =
      ['Scene', 'When', 'If', 'Who', 'Face', 'Picture', 'Line', 'Choice', 'Options'].map((h) => (col(h) < 0 ? '' : cellText(row, col(h))))
    if (name) { current = { name, when, cond, opts, startRow: r, rows: [] }; scenes.push(current) }
    if (!current) {
      if (who || line || choice) problems.push({ where: `${sheet.name}, row ${r + 2}`, message: 'This row has no Scene name above it.' })
      return
    }
    if (who || line || choice || face || picture) current.rows.push({ r, who, face, picture, line, choice })
  })

  for (const sc of scenes) {
    const where = `${sheet.name}, scene "${sc.name}" (row ${sc.startRow + 2})`
    try {
      if (!sc.when) throw new MarkupError('Say when this scene happens in the When column.')
      const head = sceneId(sc.name)
      const w = parseWhen(sc.when, ctx)
      const o = parseOptions(sc.opts)
      const cond = sc.cond ? parseCondition(sc.cond, ctx) : []

      const toLines = (row: SceneRow): Line[] => {
        const who = row.who.trim()
        const first = slug(ctx.cutieName.split(' ')[0])
        const speaker = !who || slug(who) === slug(ctx.cutieName) || slug(who) === first || /^cutie$/i.test(who) ? undefined
          : /^(you|mc)$/i.test(who) ? 'player' : /^narrator$/i.test(who) ? 'narrator' : who
        const lines = parseLines(row.line, ctx, speaker ? { speaker } : {})
        if (row.picture && !lines.length) lines.push({ text: '…' })
        if (row.face && lines[0]) lines[0] = { ...lines[0], expression: row.face.trim().toLowerCase() }
        // A picture stays up for the rest of the scene, until another picture or "none".
        if (row.picture && lines[0]) lines[0] = { ...lines[0], cg: slug(row.picture) }
        return lines
      }

      const when = [...(w.day !== undefined ? [dayIs(w.day)] : []), ...cond]
      // Scenes play full screen unless Options say "textbox".
      const display = o.textbox ? {} : { display: 'scene' as const }
      const headBeat = withOptions({ id: head, trigger: w.trigger, lines: [], ...(when.length ? { when } : {}), ...(o.priority ? { priority: o.priority } : {}), ...display }, o)
      beats.push(headBeat)
      let seg: Beat = headBeat // where shared lines go
      let asker: Beat | null = null // last beat that showed choices
      let answering = false // rows right after the buttons are answers
      let branchRun: Beat[] = [] // later branch beats waiting to rejoin
      let anchor = head // what the next beat follows
      let n = 0
      const next = (): Beat => {
        const b: Beat = { id: `${head}.${++n}`, trigger: { type: 'after', value: [...branchRun.map((x) => x.id), anchor].join('|') }, lines: [], ...display }
        beats.push(b)
        branchRun = []
        answering = false
        return b
      }

      for (const row of sc.rows) {
        const button = row.choice.match(/^([A-Z])\s*[:.)]\s*(.+)$/)
        // "A" or "A, C": only for those choices
        const tag = /^[A-Z](\s*[,/&]\s*[A-Z])*$/.test(row.choice) ? row.choice.replace(/[^A-Z]/g, '') : undefined
        if (button) {
          if (answering || branchRun.length) { seg = next(); anchor = seg.id }
          seg.choices = [...(seg.choices ?? []), { id: button[1], text: button[2].trim() }]
          if (row.line && !seg.prompt) seg.prompt = row.line
          asker = seg
          continue
        }
        if (tag) {
          if (!asker) throw new MarkupError(`Row ${row.r + 2} is marked "${row.choice}", but no choice was asked before it.`)
          const letters = [...tag]
          const picked = letters.map((l) => asker!.choices!.find((c) => c.id === l))
          if (picked.some((c) => !c)) throw new MarkupError(`Row ${row.r + 2} is marked "${row.choice}", but there's no such choice.`)
          if (seg === asker && !branchRun.length) { // straight after the buttons: the answer
            answering = true
            for (const c of picked) c!.lines = [...(c!.lines ?? []), ...toLines(row)]
            continue
          }
          let b = branchRun.find((x) => x.id.endsWith(`.${tag}`))
          if (!b) {
            const num = branchRun.length ? branchRun[0].id.match(SCENE_ID)![2] : String(++n)
            const value = letters.length === 1 ? letters[0] : letters
            b = { id: `${head}.${num}.${tag}`, trigger: { type: 'after', value: anchor }, priority: 1,
              when: [{ var: `flag:choice:${asker.id}`, op: letters.length === 1 ? '==' : 'in', value }], lines: [], ...display }
            beats.push(b)
            branchRun.push(b)
          }
          b.lines = [...(b.lines ?? []), ...toLines(row)]
          continue
        }
        if (answering || branchRun.length || seg.choices?.length) seg = next()
        seg.lines = [...(seg.lines ?? []), ...toLines(row)]
        anchor = seg.id
      }
    } catch (e) {
      problems.push({ where, message: e instanceof MarkupError ? e.message : (e as Error).message })
    }
  }
  return beats
}

// ---------------------------------------------------------------- export

const HEADERS: Record<TabName, string[]> = {
  'Time of day': ['Day'],
  'Daily goal': ['Day'],
  'Whole goal': ['Whole goal', 'Line'],
  'Special days': ['Date or day', 'Line'],
  'Random chatter': ['Stage', 'Line'],
  'Reactions': ['When', 'If', 'Line', 'Options', 'Notes'],
  'Scenes': ['Scene', 'When', 'If', 'Who', 'Face', 'Picture', 'Line', 'Choice', 'Options', 'Notes'],
}

const dayCond = (b: Beat) => (b.when ?? []).filter((c) => c.var === 'day' && c.op === '==' && typeof c.value === 'number')
const otherConds = (b: Beat) => (b.when ?? []).filter((c) => !dayCond(b).includes(c))
const cellSafe = (b: Beat) => !b.display && !b.repeat && !b.cooldownMinutes && (b.weight === undefined || b.weight === 1) && dayCond(b).length <= 1
const plainEffects = (b: Beat) => (b.effects ?? []).filter((e) => !isTalk(e))
const bodyOf = (b: Beat) => ({ variants: b.variants?.length ? b.variants : [b.lines ?? []], prompt: b.prompt, choices: b.choices, effects: plainEffects(b) })

/** Beats sharing a cell -> branches (if/elif by priority, else = no extra conditions). */
function cellOf(group: Beat[], extraWhen: (b: Beat) => Condition[] = otherConds): CellBranch[] | null {
  const sorted = [...group].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
  const plain = sorted.filter((b) => !extraWhen(b).length)
  if (plain.length > 1) return null
  const ordered = [...sorted.filter((b) => extraWhen(b).length), ...plain]
  if (ordered.length === 1 && !extraWhen(ordered[0]).length) return [{ kind: 'always', conditions: [], body: bodyOf(ordered[0]) }]
  return ordered.map((b, i) => ({
    kind: !extraWhen(b).length ? 'else' as const : i === 0 ? 'if' as const : 'elif' as const,
    conditions: extraWhen(b),
    body: bodyOf(b),
  }))
}

export function exportCutie(manifest: CutieManifest, script: Script, expressions: string[], pictures: string[] = []): WriteSheet[] {
  const ctx = contextFor(manifest)
  const left = new Set(script.beats)
  const take = (b: Beat) => left.delete(b)
  const name = (tab: TabName) => `${manifest.name} – ${tab}`
  const color = manifest.colors?.accent ?? '#b08ad8'
  const isSceneChain = (b: Beat) => SCENE_ID.test(b.id) || script.beats.some((x) => x.id.match(SCENE_ID)?.[1] === b.id)

  const grid = (type: 'time_slot' | 'daily_pct') => {
    const cells = new Map<string, Beat[]>()
    for (const b of script.beats) {
      if (b.trigger.type !== type || b.trigger.value === undefined || !cellSafe(b) || isSceneChain(b)) continue
      const key = `${dayCond(b)[0]?.value ?? 'any'}|${b.trigger.value}`
      cells.set(key, [...(cells.get(key) ?? []), b])
    }
    return cells
  }
  const sortDays = (m: Map<string, string[]>) => [...m.entries()]
    .sort(([a], [b]) => (a === 'any' ? 1e9 : Number(a)) - (b === 'any' ? 1e9 : Number(b)))
    .map(([d, row]) => { row[0] = d === 'any' ? 'Any' : d; return row })

  // Time of day
  const slots = ctx.slots.map((s) => s.id)
  const timeRows = new Map<string, string[]>()
  for (const [key, group] of grid('time_slot')) {
    const branches = cellOf(group)
    const [day, slot] = key.split('|')
    if (!branches || !slots.includes(slot)) continue
    const row = timeRows.get(day) ?? Array(slots.length + 1).fill('')
    row[slots.indexOf(slot) + 1] = formatBranches(branches, ctx)
    timeRows.set(day, row)
    group.forEach(take)
  }

  // Daily goal (+ "Missed yesterday" column)
  const pcts = [...new Set([...(manifest.milestones?.daily ?? []), ...script.beats.filter((b) => b.trigger.type === 'daily_pct').map((b) => Number(b.trigger.value))])]
    .filter((x) => Number.isFinite(x)).sort((a, b) => a - b)
  const width = pcts.length + 2
  const dailyRows = new Map<string, string[]>()
  for (const [key, group] of grid('daily_pct')) {
    const branches = cellOf(group)
    if (!branches) continue
    const [day, pct] = key.split('|')
    const row = dailyRows.get(day) ?? Array(width).fill('')
    row[pcts.indexOf(Number(pct)) + 1] = formatBranches(branches, ctx)
    dailyRows.set(day, row)
    group.forEach(take)
  }
  const isAway = (c: Condition) => c.var === 'daysAway' && c.op === '>' && c.value === 0
  const missedCells = new Map<string, Beat[]>()
  for (const b of script.beats) {
    if (b.trigger.type !== 'day_start' || b.trigger.value !== undefined || !cellSafe(b) || !(b.when ?? []).some(isAway) || isSceneChain(b)) continue
    const key = String(dayCond(b)[0]?.value ?? 'any')
    missedCells.set(key, [...(missedCells.get(key) ?? []), b])
  }
  for (const [day, group] of missedCells) {
    const branches = cellOf(group, (b) => otherConds(b).filter((c) => !isAway(c)))
    if (!branches) continue
    const row = dailyRows.get(day) ?? Array(width).fill('')
    row[width - 1] = formatBranches(branches, ctx)
    dailyRows.set(day, row)
    group.forEach(take)
  }

  // Whole goal (the very first line is 0%)
  const wholeRows: string[][] = []
  const byPct = new Map<number, Beat[]>()
  for (const b of [...left]) {
    if (dayCond(b).length || b.cooldownMinutes || (b.weight ?? 1) !== 1 || isSceneChain(b) || b.display) continue
    if (b.trigger.type === 'total_pct' && !b.repeat) byPct.set(Number(b.trigger.value), [...(byPct.get(Number(b.trigger.value)) ?? []), b])
    if (b.trigger.type === 'session_start' && b.repeat === 'once' && (b.priority ?? 0) >= 10) byPct.set(0, [...(byPct.get(0) ?? []), b])
  }
  for (const pct of [...byPct.keys()].sort((a, b) => a - b)) {
    const group = byPct.get(pct)!
    const branches = cellOf(group)
    if (!branches) continue
    wholeRows.push([`${pct}%`, formatBranches(branches, ctx)])
    group.forEach(take)
  }

  // Special days
  const specialRows: string[][] = []
  for (const b of [...left]) {
    if (b.repeat || b.cooldownMinutes || (b.when ?? []).length || isSceneChain(b) || b.display) continue
    if (b.trigger.type === 'date') specialRows.push([String(b.trigger.value), formatBody(bodyOf(b))])
    else if (b.trigger.type === 'day_start' && b.trigger.value !== undefined) specialRows.push([`Day ${b.trigger.value}`, formatBody(bodyOf(b))])
    else continue
    take(b)
  }

  // Random chatter: simple random beats, one row per version
  const chatterRows: string[][] = []
  for (const b of [...left]) {
    const conds = b.when ?? []
    const stageOnly = conds.length === 0 || (conds.length === 1 && conds[0].var === 'stage' && conds[0].op === '==')
    if (b.trigger.type !== 'random' || !stageOnly || b.choices?.length || b.effects?.length || b.repeat || b.priority
      || (b.cooldownMinutes ?? 0) !== 30 || isSceneChain(b) || b.display) continue
    const stage = conds[0] ? ctx.stages.find((s) => s.id === conds[0].value)?.name ?? String(conds[0].value) : ''
    for (const v of b.variants?.length ? b.variants : [b.lines ?? []]) chatterRows.push([stage, formatLines(v)])
    take(b)
  }

  // Scenes: chains rebuilt row by row
  const sceneRows: string[][] = []
  for (const head of [...left].filter((b) => !SCENE_ID.test(b.id) && script.beats.some((x) => x.id.match(SCENE_ID)?.[1] === b.id))) {
    const chain = [...left].filter((x) => x.id.match(SCENE_ID)?.[1] === head.id)
      .sort((a, b) => Number(a.id.match(SCENE_ID)![2]) - Number(b.id.match(SCENE_ID)![2]) || a.id.localeCompare(b.id))
    sceneRows.push(...sceneToRows(head, chain, ctx))
    take(head)
    chain.forEach(take)
  }

  // Reactions: the simple react_… moments; everything else keeps its name as a scene.
  const reactionRows: string[][] = []
  for (const b of [...left]) {
    if (!b.id.startsWith('react_') || b.display || b.trigger.type === 'after' || dayCond(b).length || b.prompt) continue
    reactionRows.push([formatWhen(b.trigger, undefined, ctx), otherConds(b).map((c) => formatCondition(c, ctx)).join(' and '),
      formatBody(bodyOf(b)), formatOptions(b), b.note ?? ''])
    take(b)
  }
  for (const b of [...left]) { sceneRows.push(...sceneToRows(b, [], ctx)); take(b) }

  const faces = expressions.length ? expressions : [manifest.defaultExpression]
  return [
    { name: name('Time of day'), rows: [['Day', ...slots.map(slotLabel)], ...sortDays(timeRows)], widths: [8, ...slots.map(() => 48)], freezeFirstColumn: true, tabColor: color },
    { name: name('Daily goal'), rows: [['Day', ...pcts.map((p) => `${p}%`), 'Missed yesterday'], ...sortDays(dailyRows)], widths: [8, ...pcts.map(() => 40), 44], freezeFirstColumn: true, tabColor: color },
    { name: name('Whole goal'), rows: [HEADERS['Whole goal'], ...wholeRows], widths: [12, 110], freezeFirstColumn: true, tabColor: color },
    { name: name('Special days'), rows: [HEADERS['Special days'], ...specialRows], widths: [14, 100], freezeFirstColumn: true, tabColor: color },
    { name: name('Random chatter'), rows: [HEADERS['Random chatter'], ...chatterRows], widths: [16, 100], tabColor: color, dropdowns: { 0: ctx.stages.map((s) => s.name) } },
    { name: name('Reactions'), rows: [HEADERS.Reactions, ...reactionRows], widths: [22, 28, 80, 22, 40], tabColor: color },
    { name: name('Scenes'), rows: [HEADERS.Scenes, ...sceneRows], widths: [22, 22, 26, 12, 12, 16, 80, 28, 16, 30], tabColor: color,
      dropdowns: { 3: [manifest.name, 'You', 'Narrator'], 4: faces, 5: [...pictures, 'none'] } },
  ]
}

function sceneToRows(head: Beat, chain: Beat[], ctx: Context): string[][] {
  const day = dayCond(head)[0]?.value as number | undefined
  const lineRows = (lines: Line[], tag = ''): string[][] => lines.map((l) => {
    const who = l.speaker === 'player' ? 'You' : l.speaker === 'narrator' ? 'Narrator' : l.speaker ?? ''
    return ['', '', '', who, l.expression ?? '', l.cg ?? '', formatLines([{ ...l, expression: undefined, speaker: undefined, cg: undefined }], { speakerInText: false }), tag, '', '']
  })
  const segRows = (b: Beat, tag = ''): string[][] => {
    const versions = b.variants?.length ? b.variants : [b.lines ?? []]
    const out = versions.length > 1
      ? [['', '', '', '', '', '', versions.map((v) => formatLines(v)).join('\n[or]\n'), tag, '', '']]
      : lineRows(versions[0], tag)
    ;(b.choices ?? []).forEach((c, i) => out.push(['', '', '', 'You', '', '', i === 0 && b.prompt ? b.prompt : '', `${c.id}: ${c.text}`, '', '']))
    for (const c of b.choices ?? []) out.push(...lineRows(c.lines ?? [], c.id))
    return out
  }
  const rows = segRows(head)
  if (!rows.length) rows.push(Array(10).fill(''))
  rows[0] = [head.id, formatWhen(head.trigger, day, ctx), otherConds(head).map((c) => formatCondition(c, ctx)).join(' and '),
    ...rows[0].slice(3, 8), formatOptions(head, true), head.note ?? '']
  for (const b of chain) rows.push(...segRows(b, [...(b.id.match(SCENE_ID)?.[3] ?? '')].join(', ')))
  rows.push(Array(10).fill(''))
  return rows
}

// ---------------------------------------------------------------- shared tabs

export function helpSheets(): WriteSheet[] {
  const how = [
    ['How to use this workbook'],
    ['1. Each cutie has tabs named "<Name> – Time of day", "<Name> – Daily goal", and so on. To start a new cutie, duplicate the Template tabs and rename "Template" to the cutie\'s name.'],
    ['2. Write in the cells. A new line inside a cell (Ctrl/⌘ + Enter) starts the next textbox page.'],
    ['3. When you\'re ready: File → Download → Microsoft Excel (.xlsx).'],
    ['4. In the app: Cutie Studio → open the cutie → Import spreadsheet. It shows what will change and lists any problems by tab and row.'],
    ['5. Changed something in the Studio? Use "Download spreadsheet" there and copy those tabs back here, so nothing is lost.'],
    [''],
    ['Tabs'],
    ['Time of day — one row per day (or Any for every day). One column per time of day.'],
    ['Daily goal — one row per day (or Any). Columns are % of today\'s goal. "Missed yesterday" plays on the first visit after a day with no writing.'],
    ['Whole goal — % of the whole novel. 0% is the very first thing they say.'],
    ['Special days — a date like 10-31, or Day 7.'],
    ['Random chatter — said at random while writing. Leave Stage empty for any stage.'],
    ['Reactions — anything else: Welcome back, Idle 5 min, Streak 7, Every 1000 words…'],
    ['Scenes — long moments with several people and choices. One row per line; see the Cheat sheet.'],
    ['Tabs with other names (notes, ideas) are ignored.'],
  ]
  const cheat = [
    ['Write this', 'Means'],
    ['{smile} Good morning.', 'Change face, then say the line. A face can go before any sentence.'],
    ['A new line in the cell', 'Next textbox page'],
    ['You: Sure!', 'The player says this line'],
    ['Narrator: He sighs.', 'Narration, with no name box'],
    ['[A: No, not yet] Try to eat. [B: Yup.] Good.', 'Choices for the player, then each answer'],
    ['[You: Before I start writing...]', 'The player says this before the choices'],
    ['[if missed days = 0] … [elif missed days = 1] … [else] …', 'Different lines depending on what\'s true. The first true one plays.'],
    ['[or]', 'Random versions: one is picked each time'],
    ['[set likes chocolate = yes]', 'Remember something (use it later in an [if])'],
    ['[add 1 to hugs]', 'Count something'],
    ['[thinks]', 'Inner thought (italic, in parentheses)'],
    ['[bg room_night]', 'Change background'],
    ['[picture first_date]', 'Show reward art (kept in the Gallery)'],
    ['[sound giggle]', 'Play a sound'],
    ['{player}', 'The player\'s name'],
    ['{daily goal}  {words today}  {words left today}  {total words}  {words left}  {day}  {streak}', 'Numbers filled in for you'],
    ['[PLACEHOLDER what goes here]', 'A gap to fill later (shows in amber)'],
    [''],
    ['Conditions (inside [if …], or the If column)', ''],
    ['missed days = 0   ·   missed days > 2', 'Days with no writing so far'],
    ['missed yesterday   ·   wrote yesterday', 'Whether they wrote yesterday'],
    ['daily goal done   ·   daily goal not done', 'Today\'s goal'],
    ['saw day 18 ultra-late   ·   saw whole goal 50%   ·   saw <scene name>', 'That moment has played before'],
    ['morning visits > 10   ·   ultra-late visits > 4', 'How many days you\'ve been here at that time of day'],
    ['stage = Friend', 'Current affinity stage'],
    ['it\'s ultra-late', 'Current time of day'],
    ['likes chocolate = yes   ·   hugs > 3', 'Something remembered with [set] or [add]'],
    ['day > 20   ·   streak > 3   ·   words today > 500   ·   total words > 10000', 'Numbers'],
    ['chance 30%', 'Random'],
    ['… and …', 'Both must be true'],
    [''],
    ['When (Reactions and Scenes)', ''],
    ['Day 8 Morning   ·   Any Evening', 'A time of day'],
    ['Daily goal 50%   ·   Day 3 Daily goal 100%   ·   Whole goal 25%', 'Word goals'],
    ['Story opened   ·   Welcome back   ·   New day   ·   Date 10-31', 'Visits and dates'],
    ['Stage Friend   ·   Streak 7   ·   Idle 5 min   ·   Every 1000 words   ·   Random', 'Other moments'],
    ['After <scene name>   ·   After whole goal 25%', 'Right after another moment finishes'],
    [''],
    ['Scenes tab', ''],
    ['Scene', 'A name for the scene, on its first row only. Rows below with this cell empty belong to it.'],
    ['When · If · Options', 'On the first row: when it plays, what must be true, and options (once, daily, wait 30 min, priority 2, odds 3).'],
    ['Who', 'The cutie, You, Narrator, or anyone else\'s name'],
    ['Face', 'Expression for this line'],
    ['Picture', 'Reward art (CG). The scene shows only the picture, with the dialog on top, until another picture or "none".'],
    ['Choice', 'On a You row, "A: button text" makes a choice. On later rows a letter (A) means "only if A was picked". Empty means everyone sees it, so paths rejoin.'],
  ]
  return [
    { name: 'How to', rows: how, widths: [150], noteRows: [7] },
    { name: 'Cheat sheet', rows: cheat, widths: [72, 90], noteRows: cheat.map((r, i) => (r[1] === '' && r[0] ? i : -1)).filter((i) => i > 0) },
  ]
}

export function templateSheets(slots = DEFAULT_TIME_SLOTS): WriteSheet[] {
  const n = (tab: TabName) => `Template – ${tab}`
  const days = Array.from({ length: 29 }, (_, i) => [String(i + 2)])
  const color = '#C9C2D4'
  return [
    { name: n('Time of day'), rows: [['Day', ...slots.map((s) => slotLabel(s.id))], ['1', '{smile} Good morning, {player}. Ready for day one?'], ...days, ['Any']], widths: [8, ...slots.map(() => 48)], freezeFirstColumn: true, tabColor: color },
    { name: n('Daily goal'), rows: [['Day', '10%', '33%', '50%', '75%', '100%', '110%', '150%', '200%', 'Missed yesterday'], ['1', "{smile} It's a start."], ...days, ['Any', '', '', '', '', "{happy} That's today's goal done, {player}!", '', '', '', "We didn't write yesterday, but today's a new day!"]], widths: [8, 40, 40, 40, 40, 40, 40, 40, 40, 44], freezeFirstColumn: true, tabColor: color },
    { name: n('Whole goal'), rows: [['Whole goal', 'Line'], ['0%', 'You intend to finish a novel this month?'], ['10%'], ['25%'], ['33%'], ['50%'], ['66%'], ['75%'], ['90%'], ['100%']], widths: [12, 110], freezeFirstColumn: true, tabColor: color },
    { name: n('Special days'), rows: [['Date or day', 'Line'], ['10-31', '{smile} Happy Halloween! Writing something spooky?'], ['Day 30', "Last day. Let's finish strong."]], widths: [14, 100], freezeFirstColumn: true, tabColor: color },
    { name: n('Random chatter'), rows: [['Stage', 'Line'], ['', '{thinking} Do you think cats dream?'], ['Friend', '{smile} I like having you around, you know.']], widths: [16, 100], tabColor: color },
    { name: n('Reactions'), rows: [HEADERS.Reactions, ['Welcome back', '', 'Back again, {player}?\n[or]\nOh, hi! {words today} words so far today.', '', ''], ['Idle 5 min', '', '{thinking} Stuck? Write the next sentence badly. Fix it later.', 'wait 20 min', '']], widths: [22, 28, 80, 22, 40], tabColor: color },
    { name: n('Scenes'), rows: [HEADERS.Scenes,
      ['Movie night', 'Whole goal 50%', '', 'Template', 'smile', '', 'Halfway! Want to watch a movie?', '', 'once', ''],
      ['', '', '', 'You', '', '', '', 'A: Romance', '', ''],
      ['', '', '', 'You', '', '', '', 'B: Horror', '', ''],
      ['', '', '', 'Template', 'blush', '', 'Oh? A romance, then...', 'A', '', ''],
      ['', '', '', 'Template', 'upset', '', "I'm fine. Totally fine.", 'B', '', ''],
      ['', '', '', 'Narrator', '', 'movie_night', 'The two of you curl up as the movie starts.', '', '', 'Picture: shows only the CG, until "none"'],
      ['', '', '', 'Narrator', '', '', 'The credits roll.', '', '', ''],
      ['', '', '', 'Template', 'happy', 'none', 'That was fun. Back to writing?', '', '', ''],
    ], widths: [22, 22, 26, 12, 12, 16, 80, 28, 16, 30], tabColor: color },
  ]
}
