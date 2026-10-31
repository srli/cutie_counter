/**
 * One-off: convert the v1 Electron dialogue JSON (legacy/cutie_dialogue/ryder) into a v2 script.
 * Run: npx tsx scripts/convert-legacy.ts
 * Writes content/ryder/script.json. Safe to re-run; it overwrites that file.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Beat, Choice, Condition, Line } from '../src/engine/types'

const root = join(import.meta.dirname, '..')
const legacy = (f: string) => JSON.parse(readFileSync(join(root, 'legacy/cutie_dialogue/ryder', f), 'utf8'))

interface LegacyDelta { expression?: string | string[]; text?: string | string[] }
interface LegacyChoiceGroup { user_text?: string; choices: string[]; [id: string]: unknown }
interface LegacyNode {
  delta?: LegacyDelta
  choice?: LegacyChoiceGroup
  condition?: { variable: string; operator: string; value: string }
  if_true?: LegacyNode
  if_false?: LegacyNode
}

function fixText(text: string): Pick<Line, 'text' | 'style'> {
  let t = text.replace(/\[PLAYER_NAME\]/g, '{player}').trim()
  if (/^placeholder\b/i.test(t)) t = `[PLACEHOLDER ${t.replace(/^placeholder\s*/i, '')}]`
  if (t.startsWith('{thinking}')) return { text: t.replace('{thinking}', '').trim(), style: 'thought' }
  return { text: t }
}

function toLines(delta?: LegacyDelta): Line[] {
  if (!delta) return []
  const texts = Array.isArray(delta.text) ? delta.text : delta.text ? [delta.text] : []
  const exprs = Array.isArray(delta.expression) ? delta.expression : [delta.expression]
  if (!texts.length && delta.expression) {
    // Expression-only delta: keep it as a silent pose before the choice.
    return [{ text: '...', expression: exprs[0] }]
  }
  return texts.map((t, i) => ({ ...fixText(t), expression: exprs[i] ?? exprs[exprs.length - 1] }))
}

function toChoices(group?: LegacyChoiceGroup): Pick<Beat, 'prompt' | 'choices'> {
  if (!group) return {}
  const choices: Choice[] = group.choices.map((id) => {
    const c = group[id] as { choice_text: string; delta?: LegacyDelta }
    return { id, text: c.choice_text, lines: toLines(c.delta) }
  })
  return { prompt: group.user_text, choices }
}

/** Map v1 condition variables to v2 conditions. */
function toCondition(cond: NonNullable<LegacyNode['condition']>): { when: Condition; note: string } {
  switch (cond.variable) {
    case '[MISSED_DAYS]':
      return { when: { var: 'missedDays', op: '==', value: Number(cond.value) }, note: 'v1: [MISSED_DAYS] = 0' }
    case '[COUNT_MORNING_TEXT]':
      return {
        when: { var: 'flag:morning_visits', op: '>', value: Number(cond.value) },
        note: 'v1: [COUNT_MORNING_TEXT] > 10. Every morning beat adds 1 to morning_visits.',
      }
    case '[READ_ULTRA_LATE_TEXT]':
      return {
        when: { var: 'flag:stayed_up_late', op: '==', value: true },
        note: 'v1: [READ_ULTRA_LATE_TEXT] on day 18. Any ultra_late beat sets stayed_up_late.',
      }
    default:
      throw new Error(`Unknown legacy condition ${cond.variable}`)
  }
}

const negate = (c: Condition): Condition => ({ ...c, op: c.op === '==' ? '!=' : c.op === '>' ? '<=' : c.op })

const beats: Beat[] = []

// ---- time of day: time_daily.json
const slotEffects = (slot: string): Beat['effects'] =>
  slot === 'morning' ? [{ flag: 'morning_visits', op: 'add', value: 1 }]
  : slot === 'ultra_late' ? [{ flag: 'stayed_up_late', op: 'set', value: true }]
  : undefined

const timeDaily = legacy('time_daily.json') as Record<string, Record<string, LegacyNode> | LegacyNode>
for (const [day, raw] of Object.entries(timeDaily)) {
  // v1 day 12 forgot its time-slot key; its text is a morning greeting.
  const slots: Record<string, LegacyNode> = 'condition' in raw ? { morning: raw as LegacyNode } : (raw as Record<string, LegacyNode>)
  for (const [slot, node] of Object.entries(slots)) {
    const id = `d${day}-${slot}`
    const base: Beat = {
      id,
      trigger: { type: 'time_slot', value: slot },
      when: [{ var: 'day', op: '==', value: Number(day) }],
      effects: slotEffects(slot),
    }
    if (!node.condition) {
      beats.push({ ...base, lines: toLines(node.delta), ...toChoices(node.choice) })
      continue
    }
    const { when, note } = toCondition(node.condition)
    const opening = toLines(node.delta)
    if (opening.length) {
      // Opening lines always play; the condition picks a follow-up.
      beats.push({ ...base, lines: opening, ...toChoices(node.choice) })
      for (const [branch, sub] of [['yes', node.if_true], ['no', node.if_false]] as const) {
        if (!sub) continue
        beats.push({
          id: `${id}-${branch}`,
          trigger: { type: 'after', value: id },
          when: [branch === 'yes' ? when : negate(when)],
          lines: toLines(sub.delta),
          ...toChoices(sub.choice),
          note,
        })
      }
    } else {
      for (const [branch, sub] of [['yes', node.if_true], ['no', node.if_false]] as const) {
        if (!sub) continue
        beats.push({
          ...base,
          id: `${id}-${branch}`,
          when: [...base.when!, branch === 'yes' ? when : negate(when)],
          lines: toLines(sub.delta),
          ...toChoices(sub.choice),
          note,
        })
      }
    }
  }
}

// ---- daily word count: wc_daily.json
const wcDaily = legacy('wc_daily.json') as Record<string, Record<string, LegacyNode>>
for (const [day, byPct] of Object.entries(wcDaily)) {
  for (const [pct, node] of Object.entries(byPct)) {
    beats.push({
      id: `d${day}-daily-${pct}`,
      trigger: { type: 'daily_pct', value: Number(pct) },
      when: [{ var: 'day', op: '==', value: Number(day) }],
      lines: toLines(node.delta),
    })
  }
}

// ---- overall word count: wc_overall.json ("0" was the opening scene)
const wcOverall = legacy('wc_overall.json') as Record<string, LegacyNode>
for (const [pct, node] of Object.entries(wcOverall)) {
  if (pct === '0') {
    beats.push({ id: 'intro', trigger: { type: 'session_start' }, repeat: 'once', priority: 10, lines: toLines(node.delta) })
  } else {
    beats.push({ id: `total-${pct}`, trigger: { type: 'total_pct', value: Number(pct) }, lines: toLines(node.delta) })
  }
}

// ---- v2 starter beats: one example per new feature, with placeholder text for the author to fill.
const ph = (tag: string, expression?: string): Line[] => [{ text: `[PLACEHOLDER ${tag}]`, expression }]
const stages: [string, string][] = [['stranger', 'neutral'], ['acquaintance', 'smile'], ['friend', 'glad'], ['close', 'happy'], ['devoted', 'veryhappy']]
for (const [stage, expression] of stages) {
  if (stage !== 'stranger') beats.push({ id: `stage-${stage}`, trigger: { type: 'stage', value: stage }, lines: ph(`entering ${stage} AFFINITY`, expression) })
  beats.push({
    id: `ambient-${stage}`,
    trigger: { type: 'random' },
    when: [{ var: 'stage', op: '==', value: stage }],
    cooldownMinutes: 30,
    variants: [ph(`ambient chatter A · ${stage}`, expression), ph(`ambient chatter B · ${stage}`, 'thinking')],
  })
}
beats.push(
  {
    id: 'idle-5', trigger: { type: 'idle', value: 5 }, repeat: 'always', cooldownMinutes: 20,
    variants: [[{ text: 'Stuck? Try writing the next sentence badly. You can fix it later.', expression: 'muse' }], ph('idle nudge B', 'thinking')],
  },
  { id: 'date-halloween', trigger: { type: 'date', value: '10-31' }, priority: 5, lines: ph('Halloween eve · day before the month starts', 'smile') },
  { id: 'date-last-day', trigger: { type: 'date', value: '11-30' }, priority: 5, lines: ph('last day of the month', 'serious') },
  {
    id: 'welcome-back', trigger: { type: 'reopen' }, repeat: 'always',
    variants: [
      [{ text: 'Back again, {player}? Good. Pick up where you left off.', expression: 'smile' }],
      [{ text: "Oh, it's you. {todayWords} words so far today. Let's add a few more.", expression: 'neutral' }],
      ph('welcome back C', 'glad'),
    ],
    note: 'Draft lines; replace with your own. Plays when the story is reopened on the same day.',
  },
  { id: 'streak-7', trigger: { type: 'streak', value: 7 }, lines: ph('7 day streak', 'happy') },
  {
    id: 'back-after-missing', trigger: { type: 'day_start' },
    when: [{ var: 'daysAway', op: '>', value: 0 }],
    repeat: 'daily', priority: -1,
    lines: ph('welcome back after missed days', 'muse'),
    note: 'Low priority, so a day-specific greeting wins when there is one.',
  },
  { id: 'words-every-1000', trigger: { type: 'words_every', value: 1000 }, lines: [{ text: 'Another thousand words. That makes {totalWords}.', expression: 'smile' }] },
  {
    id: 'daily-goal-generic', trigger: { type: 'daily_pct', value: 100 }, priority: -1,
    lines: [{ text: "That's today's goal done, {player}. {todayWords} words.", expression: 'happy' }],
    note: 'Fallback when no day-specific line exists.',
  },
)

writeFileSync(join(root, 'content/ryder/script.json'), JSON.stringify({ formatVersion: 1, beats }, null, 2) + '\n')
console.log(`Wrote ${beats.length} beats`)
