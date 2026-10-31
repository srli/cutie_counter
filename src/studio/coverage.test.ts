import { describe, expect, it } from 'vitest'
import type { CutieManifest } from '../engine/types'
import { coverage } from './coverage'

const manifest: CutieManifest = {
  formatVersion: 1, id: 't', name: 'T', intro: '', defaultExpression: 'n', defaultBackground: 'b',
  timeSlots: [{ id: 'morning', start: '05:00' }, { id: 'evening', start: '17:00' }],
  milestones: { daily: [50], total: [50] },
  stages: [{ id: 'a', name: 'A', minTotalPct: 0 }, { id: 'b', name: 'B', minTotalPct: 50 }],
}

describe('coverage', () => {
  it('marks specific, generic, placeholder and missing cells', () => {
    const cov = coverage(manifest, {
      formatVersion: 1,
      beats: [
        { id: 'd1m', trigger: { type: 'time_slot', value: 'morning' }, when: [{ var: 'day', op: '==', value: 1 }], lines: [{ text: 'hi' }] },
        { id: 'late', trigger: { type: 'time_slot', value: 'evening' }, when: [{ var: 'day', op: '>=', value: 3 }], lines: [{ text: 'eve' }] },
        { id: 'ph', trigger: { type: 'daily_pct', value: 50 }, lines: [{ text: '[PLACEHOLDER half]' }] },
        { id: 'stb', trigger: { type: 'stage', value: 'b' }, lines: [{ text: 'closer' }] },
      ],
    }, 3)
    const [morning, evening, half] = [0, 1, 2]
    expect(cov.days[0].cells[morning].state).toBe('specific')
    expect(cov.days[1].cells[morning].state).toBe('missing')
    expect(cov.days[1].cells[evening].state).toBe('missing')
    expect(cov.days[2].cells[evening].state).toBe('generic')
    expect(cov.days[2].cells[half].state).toBe('placeholder')
    expect(cov.total[0].cell.state).toBe('missing')
    expect(cov.stages).toHaveLength(1)
    expect(cov.stages[0].cell.state).toBe('specific')
  })
})
