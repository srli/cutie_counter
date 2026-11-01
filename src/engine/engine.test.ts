import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadPackBytes } from '../pack/load'
import { newProject, step, type Input } from './director'
import { computeStats } from './progress'
import { seededRng } from './rng'
import { slotAt, timeSlotAt } from './time'
import type { Beat, Pack, Project } from './types'

const at = (iso: string) => new Date(iso) // local time, no Z

function makePack(beats: Beat[], extra: Partial<Pack['manifest']> = {}): Pack {
  return {
    manifest: {
      formatVersion: 1, id: 't', name: 'Tess', intro: '', defaultExpression: 'neutral', defaultBackground: 'room',
      stages: [{ id: 'low', name: 'Low', minTotalPct: 0 }, { id: 'high', name: 'High', minTotalPct: 50 }],
      milestones: { daily: [50, 100], total: [50] },
      ...extra,
    },
    script: { formatVersion: 1, beats },
    images: {}, sounds: {}, expressions: ['neutral', 'happy'], backgrounds: ['room'], cgs: [],
  }
}

function project(over: Partial<Project> = {}): Project {
  return {
    ...newProject({
      id: 'p', title: 'Novel', playerName: 'Sam', cutieId: 't', totalGoal: 1000, dailyGoal: 100,
      now: at('2026-11-01T09:00'), startDate: '2026-11-01',
    }),
    ...over,
  }
}

/** Run inputs in order, returning the final project and the text and beat ids of every scene shown. */
function run(p: Project, pack: Pack, inputs: [Input, string][]) {
  const rng = seededRng(1)
  const texts: string[][] = []
  const ids: string[][] = []
  for (const [input, when] of inputs) {
    const r = step(p, input, pack, at(when), rng)
    p = r.project
    texts.push(r.scenes.flatMap((s) => s.lines.map((l) => l.text)))
    ids.push(r.scenes.map((s) => s.beatId))
  }
  return { p, texts, ids }
}

describe('time', () => {
  it('maps hours to slots, wrapping past midnight', () => {
    expect(timeSlotAt(at('2026-11-01T05:00'))).toBe('morning')
    expect(timeSlotAt(at('2026-11-01T12:30'))).toBe('late_morning')
    expect(timeSlotAt(at('2026-11-01T23:30'))).toBe('midnight')
    expect(timeSlotAt(at('2026-11-01T00:30'))).toBe('midnight')
    expect(timeSlotAt(at('2026-11-01T03:00'))).toBe('ultra_late')
  })

  it('counts night slots as part of the day they follow', () => {
    expect(slotAt(at('2026-11-18T23:30'))).toEqual({ id: 'midnight', date: '2026-11-18' })
    expect(slotAt(at('2026-11-19T00:30'))).toEqual({ id: 'midnight', date: '2026-11-18' })
    expect(slotAt(at('2026-11-19T04:59'))).toEqual({ id: 'ultra_late', date: '2026-11-18' })
    expect(slotAt(at('2026-11-19T05:00'))).toEqual({ id: 'morning', date: '2026-11-19' })
  })
})

describe('stats', () => {
  it('counts day number, missed days, streak and days away', () => {
    const p = project({
      wordCount: 300,
      days: {
        '2026-11-01': { startWords: 0, endWords: 100 },
        '2026-11-02': { startWords: 100, endWords: 100 }, // opened, wrote nothing
        '2026-11-04': { startWords: 100, endWords: 200 },
        '2026-11-05': { startWords: 200, endWords: 300 },
      },
    })
    const s = computeStats(p, makePack([]).manifest, at('2026-11-07T10:00'))
    expect(s.day).toBe(7)
    expect(s.missedDays).toBe(3) // 2nd, 3rd, 6th
    expect(s.streak).toBe(0) // 6th was blank
    expect(s.daysAway).toBe(1)
    const s2 = computeStats(p, makePack([]).manifest, at('2026-11-06T10:00'))
    expect(s2.streak).toBe(2)
  })

  it('counts days before the start as 0, -1… and survives a missing start date', () => {
    const m = makePack([]).manifest
    expect(computeStats(project(), m, at('2026-10-31T10:00')).day).toBe(0)
    expect(computeStats(project(), m, at('2026-10-20T10:00')).day).toBe(-11)
    // A cleared date field used to save "", which made every day "Day NaN".
    expect(computeStats(project({ startDate: '' }), m, at('2026-11-03T10:00')).day).toBe(3)
  })
})

describe('director', () => {
  it('fires word milestones once, even if words are deleted and retyped', () => {
    const pack = makePack([
      { id: 'half', trigger: { type: 'daily_pct', value: 50 }, lines: [{ text: 'half' }] },
      { id: 'all', trigger: { type: 'daily_pct', value: 100 }, lines: [{ text: 'all {todayWords}' }] },
    ])
    const { texts } = run(project(), pack, [
      [{ kind: 'words', count: 49 }, '2026-11-01T09:01'],
      [{ kind: 'words', count: 50 }, '2026-11-01T09:02'],
      [{ kind: 'words', count: 10 }, '2026-11-01T09:03'],
      [{ kind: 'words', count: 60 }, '2026-11-01T09:04'],
      [{ kind: 'words', count: 120 }, '2026-11-01T09:05'],
    ])
    expect(texts).toEqual([[], ['half'], [], [], ['all 120']])
  })

  it('resets daily milestones on a new day, counting only that day\'s words', () => {
    const pack = makePack([{ id: 'half', trigger: { type: 'daily_pct', value: 50 }, lines: [{ text: 'half d{day}' }] }])
    const { texts } = run(project(), pack, [
      [{ kind: 'words', count: 60 }, '2026-11-01T09:00'],
      [{ kind: 'open' }, '2026-11-02T09:00'],
      [{ kind: 'words', count: 100 }, '2026-11-02T09:05'], // 40 today
      [{ kind: 'words', count: 110 }, '2026-11-02T09:06'], // 50 today
    ])
    expect(texts[0]).toEqual(['half d1'])
    expect(texts[2]).toEqual([])
    expect(texts[3]).toEqual(['half d2'])
  })

  it('jumping past several milestones fires only the highest', () => {
    const pack = makePack([
      { id: 'a', trigger: { type: 'daily_pct', value: 50 }, lines: [{ text: '50' }] },
      { id: 'b', trigger: { type: 'daily_pct', value: 100 }, lines: [{ text: '100' }] },
    ])
    const { texts } = run(project(), pack, [[{ kind: 'words', count: 500 }, '2026-11-01T09:00']])
    expect(texts[0]).toContain('100')
    expect(texts[0]).not.toContain('50')
  })

  it('shows a placeholder when a milestone has no line', () => {
    const { texts } = run(project(), makePack([]), [[{ kind: 'words', count: 50 }, '2026-11-01T09:00']])
    expect(texts[0][0]).toMatch(/^\[PLACEHOLDER daily 50% · day 1\]$/)
  })

  it('opens with day/date/slot events and picks day-specific beats by condition', () => {
    const pack = makePack([
      { id: 'd1', trigger: { type: 'time_slot', value: 'morning' }, when: [{ var: 'day', op: '==', value: 1 }], lines: [{ text: 'morning one' }] },
      { id: 'd2', trigger: { type: 'time_slot', value: 'morning' }, when: [{ var: 'day', op: '==', value: 2 }], lines: [{ text: 'morning two' }] },
      { id: 'hw', trigger: { type: 'date', value: '11-02' }, priority: 5, lines: [{ text: 'date!' }] },
    ])
    const { texts } = run(project(), pack, [
      [{ kind: 'open' }, '2026-11-01T08:00'],
      [{ kind: 'tick' }, '2026-11-01T08:30'], // same slot: nothing
      [{ kind: 'open' }, '2026-11-02T08:00'],
    ])
    expect(texts[0]).toEqual(['morning one'])
    expect(texts[1]).toEqual([])
    expect(texts[2]).toEqual(['date!', 'morning two']) // higher priority first
  })

  it('says something when the story is reopened the same day', () => {
    const pack = makePack([
      { id: 'm', trigger: { type: 'time_slot', value: 'morning' }, lines: [{ text: 'morning' }] },
      { id: 'wb', trigger: { type: 'reopen' }, lines: [{ text: 'welcome back' }] },
    ])
    const { texts } = run(project(), pack, [
      [{ kind: 'open' }, '2026-11-01T08:00'],
      [{ kind: 'open' }, '2026-11-01T09:00'],
      [{ kind: 'open' }, '2026-11-02T08:00'],
    ])
    expect(texts).toEqual([['morning'], ['welcome back'], ['morning']])
    // With nothing written for it, a reopen shows a placeholder instead of a blank box.
    const empty = run(project(), makePack([]), [
      [{ kind: 'open' }, '2026-11-01T08:00'],
      [{ kind: 'open' }, '2026-11-01T09:00'],
    ])
    expect(empty.texts[1]).toEqual(['[PLACEHOLDER welcome back · day 1 · morning]'])
  })

  it('handles repeat, cooldown and weighted variants', () => {
    const pack = makePack([
      { id: 'r', trigger: { type: 'random' }, cooldownMinutes: 30, variants: [[{ text: 'A' }], [{ text: 'B' }]] },
    ], { ambient: { everyMinutes: 1, chance: 1 } })
    const { texts } = run(project(), pack, [
      [{ kind: 'ambient' }, '2026-11-01T09:00'],
      [{ kind: 'ambient' }, '2026-11-01T09:10'],
      [{ kind: 'ambient' }, '2026-11-01T09:40'],
    ])
    expect(texts[0]).toHaveLength(1)
    expect(['A', 'B']).toContain(texts[0][0])
    expect(texts[1]).toEqual([])
    expect(texts[2]).toHaveLength(1)
  })

  it('applies choice effects and plays follow-ups', () => {
    const pack = makePack([
      {
        id: 'q', trigger: { type: 'session_start' }, lines: [{ text: 'Lunch?' }],
        choices: [
          { id: 'yes', text: 'Yep', lines: [{ text: 'Good.' }], effects: [{ flag: 'fed', op: 'set', value: true }] },
          { id: 'no', text: 'No', lines: [{ text: 'Eat.' }] },
        ],
      },
      { id: 'q2', trigger: { type: 'after', value: 'q/yes' }, lines: [{ text: 'Grilled cheese?' }] },
      { id: 'later', trigger: { type: 'session_start' }, when: [{ var: 'flag:fed', op: '==', value: true }], priority: 9, lines: [{ text: 'fed {player}' }] },
    ])
    const { p, texts } = run(project(), pack, [
      [{ kind: 'open' }, '2026-11-01T09:00'],
      [{ kind: 'choice', beatId: 'q', choiceId: 'yes' }, '2026-11-01T09:01'],
      [{ kind: 'open' }, '2026-11-01T10:00'],
    ])
    expect(texts[0]).toEqual(['Lunch?'])
    expect(texts[1]).toEqual(['Good.', 'Grilled cheese?'])
    expect(p.flags).toMatchObject({ fed: true, 'choice:q': 'yes' })
    expect(texts[2][0]).toBe('fed Sam')
  })

  it('fires stage once on entering, and words_every per multiple', () => {
    const pack = makePack([
      { id: 's', trigger: { type: 'stage', value: 'high' }, lines: [{ text: 'closer' }] },
      { id: 'w', trigger: { type: 'words_every', value: 200 }, lines: [{ text: '{totalWords}' }] },
    ])
    const { texts } = run(project(), pack, [
      [{ kind: 'words', count: 250 }, '2026-11-02T09:00'],
      [{ kind: 'words', count: 520 }, '2026-11-02T09:05'],
      [{ kind: 'words', count: 400 }, '2026-11-02T09:06'],
      [{ kind: 'words', count: 530 }, '2026-11-02T09:07'],
    ])
    expect(texts[0]).toEqual(['250'])
    expect(texts[1]).toEqual(expect.arrayContaining(['closer', '520']))
    expect(texts[3]).toEqual([])
  })

  it('never lowers affection when words are deleted', () => {
    const pack = makePack([])
    const { p } = run(project(), pack, [
      [{ kind: 'words', count: 600 }, '2026-11-02T09:00'],
      [{ kind: 'words', count: 100 }, '2026-11-02T09:05'],
    ])
    expect(p.stage).toBe('high')
    expect(computeStats(p, pack.manifest, at('2026-11-02T09:06')).stage).toBe('high')
    // Older saves without peakWords still remember their best day.
    const old = { ...p, peakWords: undefined, days: { '2026-11-01': { startWords: 0, endWords: 600 }, '2026-11-02': { startWords: 600, endWords: 100 } } }
    expect(computeStats(old, pack.manifest, at('2026-11-02T09:06')).stage).toBe('high')
  })

  it('fires words_deleted once per stretch of deleting', () => {
    const pack = makePack([
      { id: 'd100', trigger: { type: 'words_deleted', value: 100 }, lines: [{ text: 'snip' }] },
      { id: 'd1000', trigger: { type: 'words_deleted', value: 1000 }, lines: [{ text: 'whoa' }] },
    ])
    const { ids } = run(project(), pack, [
      [{ kind: 'words', count: 2000 }, '2026-11-02T09:00'],
      [{ kind: 'words', count: 1950 }, '2026-11-02T09:01'], // 50 so far
      [{ kind: 'words', count: 1890 }, '2026-11-02T09:02'], // 110: 100
      [{ kind: 'words', count: 1850 }, '2026-11-02T09:03'], // 150: nothing new
      [{ kind: 'words', count: 1860 }, '2026-11-02T09:04'], // typing resets
      [{ kind: 'words', count: 700 }, '2026-11-02T09:05'], // 1160 at once: 1000 wins
    ])
    expect(ids.slice(1).map((x) => x.filter((id) => id.startsWith('d')))).toEqual([[], ['d100'], [], [], ['d1000']])
  })

  it("waits for day 1 before playing day 1's lines", () => {
    const pack = makePack([
      { id: 'd1', trigger: { type: 'time_slot', value: 'morning' }, when: [{ var: 'day', op: '==', value: 1 }], lines: [{ text: 'day one' }] },
    ])
    const { texts } = run(project(), pack, [
      [{ kind: 'open' }, '2026-10-31T09:00'], // story set up the day before it starts
      [{ kind: 'open' }, '2026-11-01T09:00'],
    ])
    expect(texts).toEqual([['[PLACEHOLDER day 0 · morning]'], ['day one']])
  })

  it('keeps new-day events for the first real visit when chatter, idling or typing came first', () => {
    const pack = makePack([
      { id: 'new', trigger: { type: 'day_start', value: 2 }, lines: [{ text: 'day two!' }] },
      { id: 'r', trigger: { type: 'random' }, lines: [{ text: 'chatter' }] },
      { id: 'wb', trigger: { type: 'reopen' }, lines: [{ text: 'back again?' }] },
    ], { ambient: { everyMinutes: 1, chance: 1 } })
    const { texts } = run(project(), pack, [
      [{ kind: 'open' }, '2026-11-01T09:00'],
      [{ kind: 'ambient' }, '2026-11-02T09:00'],
      [{ kind: 'idle', minutes: 5 }, '2026-11-02T09:01'],
      [{ kind: 'open' }, '2026-11-02T09:02'],
    ])
    expect(texts[1]).toEqual(['chatter'])
    expect(texts[3]).toContain('day two!')
    expect(texts[3]).not.toContain('back again?')
    const typed = run(project(), pack, [
      [{ kind: 'open' }, '2026-11-01T09:00'],
      [{ kind: 'words', count: 10 }, '2026-11-02T09:00'],
    ])
    expect(typed.texts[1]).toContain('day two!')
  })

  it("plays a night's lines as part of the day they follow, once across midnight", () => {
    const pack = makePack([
      { id: 'd1-mid', trigger: { type: 'time_slot', value: 'midnight' }, when: [{ var: 'day', op: '==', value: 1 }], lines: [{ text: 'late on day {day}' }] },
      { id: 'd2-mid', trigger: { type: 'time_slot', value: 'midnight' }, when: [{ var: 'day', op: '==', value: 2 }], lines: [{ text: 'a night too early' }] },
      { id: 'd1-ul', trigger: { type: 'time_slot', value: 'ultra_late' }, when: [{ var: 'day', op: '==', value: 1 }], lines: [{ text: 'still up?' }] },
    ])
    const { texts } = run(project(), pack, [
      [{ kind: 'open' }, '2026-11-01T23:30'],
      [{ kind: 'tick' }, '2026-11-02T00:00'], // same night: no second midnight greeting
      [{ kind: 'tick' }, '2026-11-02T02:00'],
      [{ kind: 'tick' }, '2026-11-02T05:00'],
    ])
    expect(texts).toEqual([['late on day 1'], [], ['still up?'], ['[PLACEHOLDER day 2 · morning]']])
    // Arriving after midnight is still day 1's night.
    const owl = run(project(), pack, [[{ kind: 'open' }, '2026-11-02T00:30']])
    expect(owl.texts[0]).toEqual(['late on day 1'])
  })

  it('counts the days the writer was here at each time of day, line or no line', () => {
    const pack = makePack([
      { id: 'usual', trigger: { type: 'time_slot', value: 'morning' }, when: [{ var: 'flag:visits_morning', op: '>', value: 2 }], lines: [{ text: 'as usual' }] },
    ])
    const { p, texts } = run(project(), pack, [
      [{ kind: 'open' }, '2026-11-01T07:00'],
      [{ kind: 'open' }, '2026-11-01T08:00'], // same morning, not another visit
      [{ kind: 'open' }, '2026-11-02T07:00'],
      [{ kind: 'open' }, '2026-11-03T07:00'],
    ])
    expect(p.flags.visits_morning).toBe(3)
    expect(texts[3]).toEqual(['as usual'])
  })
})

describe('ryder pack', () => {
  const zip = readFileSync(join(import.meta.dirname, '../../public/packs/ryder.cutie'))
  const { pack, issues } = loadPackBytes(new Uint8Array(zip), () => 'blob:')
  const ryder = pack!
  const opens = (dates: string[]): [Input, string][] => dates.map((d) => [{ kind: 'open' }, d])

  it('builds, validates and plays day 1', () => {
    expect(issues.filter((i) => i.level === 'error')).toEqual([])
    const { texts } = run(project({ cutieId: 'ryder' }), ryder, [[{ kind: 'open' }, '2026-11-01T07:00']])
    expect(texts[0][0]).toBe('You intend to finish a novel this month?')
    expect(texts[0]).toContain("Good morning. And so begins the first day of the month in which you'll complete your story. Feeling excited?")
  })

  it('says "up early as usual" on day 12 to a writer who came every morning', () => {
    const mornings = Array.from({ length: 12 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}T07:00`)
    const { ids } = run(project({ cutieId: 'ryder' }), ryder, opens(mornings))
    expect(ids[11]).toContain('d12-morning-if')
  })

  it('asks about "last night" on day 19 only after the writer was up in the small hours before it', () => {
    const kickoffOnly = run(project({ cutieId: 'ryder' }), ryder, opens(['2026-11-01T02:30', '2026-11-19T08:00']))
    expect(kickoffOnly.ids[1]).not.toContain('d19-morning-if')
    const upLate = run(project({ cutieId: 'ryder' }), ryder, [
      [{ kind: 'open' }, '2026-11-19T02:30'],
      [{ kind: 'tick' }, '2026-11-19T05:00'],
    ])
    expect(upLate.ids[0]).toContain('d18-ultra_late')
    expect(upLate.ids[1]).toEqual(['d19-morning-if'])
  })

  it("marks the last day on day 30 of the writer's month, not only on November 30", () => {
    const { ids } = run(project({ cutieId: 'ryder', startDate: '2027-03-01' }), ryder, opens(['2027-03-30T09:00']))
    expect(ids[0]).toContain('day-30-start')
  })
})
