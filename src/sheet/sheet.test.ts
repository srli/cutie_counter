import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { newProject, step } from '../engine/director'
import { seededRng } from '../engine/rng'
import type { Beat, Pack } from '../engine/types'
import { loadPackBytes } from '../pack/load'
import { defaultSim, simulate, type SimSettings } from '../studio/simulate'
import { parseCell, parseLines } from './markup'
import { contextFor, exportCutie, helpSheets, importCutie, templateSheets } from './workbook'
import { readXlsx, writeXlsx, type Sheet } from './xlsx'

const ryder = loadPackBytes(new Uint8Array(readFileSync(join(import.meta.dirname, '../../public/packs/ryder.cutie'))), () => '').pack!
const ctx = contextFor(ryder.manifest)
const withBeats = (beats: Beat[]): Pack => ({ ...ryder, script: { formatVersion: 1, beats } })
const roundTrip = (beats: Beat[]) => {
  const sheets = exportCutie(ryder.manifest, { formatVersion: 1, beats }, ryder.expressions)
  return importCutie(readXlsx(writeXlsx([...helpSheets(), ...sheets, ...templateSheets()])), ryder.manifest)
}
const say = (pack: Pack, sim: Partial<SimSettings>, input: Parameters<typeof simulate>[2] = { kind: 'open' }) =>
  simulate(pack, { ...defaultSim(), ...sim }, input).scenes.flatMap((s) => [
    ...s.lines.map((l) => l.text), ...(s.choices ?? []).map((c) => `[${c.id}] ${c.text}`)])

describe('cell markup', () => {
  it('reads faces, fill-ins and speakers', () => {
    expect(parseLines('{smile} Hi {player}, {words today} words. {happy} Yay!\nYou: Thanks!', ctx)).toEqual([
      { expression: 'smile', text: 'Hi {player}, {todayWords} words.' },
      { expression: 'happy', text: 'Yay!' },
      { speaker: 'player', text: 'Thanks!' },
    ])
  })

  it('reads branches, choices and remembered things', () => {
    const [yes, no] = parseCell('{neutral} Morning. [if missed days = 0] Great! [else] Hmm. [A: Ok] Fine [set likes cats = yes]', ctx)
    expect(yes.conditions).toEqual([{ var: 'missedDays', op: '==', value: 0 }])
    expect(yes.body.variants[0].map((l) => l.text)).toEqual(['Morning.', 'Great!'])
    expect(no.kind).toBe('else')
    expect(no.body.choices).toEqual([{ id: 'A', text: 'Ok', lines: [{ text: 'Fine' }], effects: [{ flag: 'likes_cats', op: 'set', value: true }] }])
  })

  it('explains mistakes in plain words', () => {
    expect(() => parseCell('[if moon = full and stage = Wizard] hi', ctx)).toThrow(/stage "Wizard"/)
    expect(() => parseCell('Hello [Partners?] there', ctx)).toThrow(/don't understand "\[Partners\?\]"/)
  })
})

describe('Ryder round trip', () => {
  const first = roundTrip(ryder.script.beats)
  const pack1 = withBeats(first.beats)

  it('imports with no problems and is stable the second time', () => {
    expect(first.problems).toEqual([])
    const second = roundTrip(first.beats)
    expect(second.problems).toEqual([])
    expect(second.beats).toEqual(first.beats)
  })

  it('says the same things as before', () => {
    const cases: [Partial<SimSettings>, Parameters<typeof simulate>[2]?][] = [
      [{ when: '2026-11-01T07:00' }],
      [{ when: '2026-11-08T07:00', day: 8, totalWords: 9000 }],
      [{ when: '2026-11-08T07:00', day: 8, daysAway: 2, totalWords: 9000 }],
      [{ when: '2026-11-12T07:00', day: 12, flags: { morning_talks: 11 } }],
      [{ when: '2026-11-03T20:00', day: 3 }],
      [{ day: 2 }, { kind: 'event', event: { type: 'daily_pct', value: 50 } }],
      [{ day: 2 }, { kind: 'event', event: { type: 'daily_pct', value: 150 } }],
      [{}, { kind: 'event', event: { type: 'total_pct', value: 100 } }],
      [{}, { kind: 'event', event: { type: 'reopen' } }],
    ]
    for (const [sim, input] of cases) expect(say(pack1, sim, input)).toEqual(say(ryder, sim, input))
  })

  it('makes a valid pack', () => {
    const tabs = exportCutie(ryder.manifest, ryder.script, ryder.expressions)
    expect(tabs.map((t) => t.name)).toEqual([
      'Ryder – Time of day', 'Ryder – Daily goal', 'Ryder – Whole goal', 'Ryder – Special days',
      'Ryder – Random chatter', 'Ryder – Reactions', 'Ryder – Scenes'])
    const day19 = first.beats.filter((b) => b.id.startsWith('d19-morning'))
    expect(day19.map((b) => b.id)).toEqual(['d19-morning-if', 'd19-morning-else'])
  })
})

describe('scenes', () => {
  const sheet: Sheet = {
    name: 'Ryder – Scenes',
    rows: [
      ['Scene', 'When', 'If', 'Who', 'Face', 'Line', 'Choice', 'Options'],
      ['Movie night', 'Whole goal 50%', '', 'Ryder', 'smile', 'Movie?', '', 'once'],
      ['', '', '', 'You', '', '', 'A: Romance'],
      ['', '', '', 'You', '', '', 'B: Horror'],
      ['', '', '', 'Ryder', 'glad', 'Romance it is.', 'A'],
      ['', '', '', 'Ryder', 'upset', "I'm fine.", 'B'],
      ['', '', '', 'Narrator', '', 'The credits roll.'],
      ['', '', '', 'Ryder', '', 'Tissues?', 'A'],
      ['', '', '', 'Ryder', '', 'Lights stay on tonight.', 'B'],
      ['', '', '', 'Ryder', 'happy', 'Back to writing.'],
    ],
  }

  it('branch and rejoin', () => {
    const { beats, problems } = importCutie([sheet], ryder.manifest)
    expect(problems).toEqual([])
    const pack = withBeats(beats)
    const play = (choice: string) => {
      const rng = seededRng(1)
      const now = new Date('2026-11-10T10:00')
      const p = { ...newProject({ id: 'p', title: 't', playerName: 'Sam', cutieId: 'ryder', totalGoal: 100, dailyGoal: 10, now, startDate: '2026-11-01' }), stage: 'stranger' }
      const a = step(p, { kind: 'words', count: 50 }, pack, now, rng)
      const b = step(a.project, { kind: 'choice', beatId: 'movie_night', choiceId: choice }, pack, now, rng)
      return [...a.scenes, ...b.scenes].flatMap((s) => s.lines.map((l) => `${l.speaker ?? 'R'}: ${l.text}`))
    }
    expect(play('A')).toEqual(['R: Movie?', 'R: Romance it is.', 'narrator: The credits roll.', 'R: Tissues?', 'R: Back to writing.'])
    expect(play('B')).toEqual(['R: Movie?', "R: I'm fine.", 'narrator: The credits roll.', 'R: Lights stay on tonight.', 'R: Back to writing.'])
  })

  it('round-trips', () => {
    const once = importCutie([sheet], ryder.manifest).beats
    const again = importCutie(exportCutie(ryder.manifest, { formatVersion: 1, beats: once }, ryder.expressions), ryder.manifest)
    expect(again.problems).toEqual([])
    expect(again.beats).toEqual(once)
  })
})
