import type { Rng } from './rng'
import type { Condition, FlagValue, Project, Stats } from './types'

type Value = string | number | boolean | undefined

/** Read a condition variable from stats and project state. */
export function readVar(name: Condition['var'], stats: Stats, project: Project): Value {
  if (name.startsWith('flag:')) return project.flags[name.slice(5)] as FlagValue | undefined
  if (name.startsWith('seen:')) {
    // `seen:d18-ultra_late` also counts its branches (`d18-ultra_late-if`, `-else`, …).
    const id = name.slice(5)
    return Object.entries(project.beatLog).some(([k, v]) => (k === id || k.startsWith(`${id}-`)) && v.count > 0)
  }
  switch (name) {
    case 'day': return stats.day
    case 'date': return stats.monthDay
    case 'weekday': return stats.weekday
    case 'hour': return stats.hour
    case 'timeSlot': return stats.timeSlot
    case 'stage': return stats.stage
    case 'totalWords': return stats.totalWords
    case 'todayWords': return stats.todayWords
    case 'totalPct': return stats.totalPct
    case 'dailyPct': return stats.dailyPct
    case 'missedDays': return stats.missedDays
    case 'daysAway': return stats.daysAway
    case 'streak': return stats.streak
    default: return undefined
  }
}

function asComparable(v: Value): number | string | undefined {
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v)
  return v
}

function equal(a: Value, b: Value): boolean {
  return asComparable(a) === asComparable(b)
}

function compare(a: Value, op: '>' | '>=' | '<' | '<=', b: Value): boolean {
  const x = asComparable(a)
  const y = asComparable(b)
  if (x === undefined || y === undefined) return false
  switch (op) {
    case '>': return x > y
    case '>=': return x >= y
    case '<': return x < y
    case '<=': return x <= y
  }
}

export function check(cond: Condition, stats: Stats, project: Project, rng: Rng): boolean {
  if (cond.var === 'chance') return rng() < Number(cond.value)

  const actual = readVar(cond.var, stats, project)
  const expected = cond.value
  switch (cond.op) {
    case '==': return equal(actual, expected as Value)
    case '!=': return !equal(actual, expected as Value)
    case '>': case '>=': case '<': case '<=':
      return compare(actual, cond.op, expected as Value)
    case 'in':
    case 'not_in': {
      const list = Array.isArray(expected) ? expected : [expected as string | number]
      const found = list.some((e) => equal(actual, e))
      return cond.op === 'in' ? found : !found
    }
  }
}

/** All conditions must pass. `chance` rolls last so it only spends a roll when it matters. */
export function checkAll(conds: Condition[] | undefined, stats: Stats, project: Project, rng: Rng): boolean {
  if (!conds?.length) return true
  const ordered = [...conds].sort((a, b) => Number(a.var === 'chance') - Number(b.var === 'chance'))
  return ordered.every((c) => check(c, stats, project, rng))
}
