import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadPackBytes } from '../pack/load'
import { defaultSim, simulate } from './simulate'

const ryder = loadPackBytes(new Uint8Array(readFileSync(join(import.meta.dirname, '../../public/packs/ryder.cutie'))), () => '').pack!
const texts = (r: ReturnType<typeof simulate>) => r.scenes.flatMap((s) => s.lines.map((l) => l.text))

describe('studio preview', () => {
  it('day 8 morning branches on missed days', () => {
    const base = { ...defaultSim(), when: '2026-11-08T07:00', day: 8, totalWords: 12000 }
    expect(texts(simulate(ryder, base, { kind: 'open' })).join(' ')).toMatch(/haven't missed a single day/)
    expect(texts(simulate(ryder, { ...base, daysAway: 2 }, { kind: 'open' })).join(' ')).toMatch(/missed a few days/)
  })

  it('fires a chosen event directly', () => {
    const r = simulate(ryder, { ...defaultSim(), day: 2 }, { kind: 'event', event: { type: 'daily_pct', value: 50 } })
    expect(texts(r)).toEqual(['Very nice, you\'ve already finished half of your daily goal!'])
  })
})
