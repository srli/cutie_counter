/** A function returning a float in [0, 1), like Math.random. */
export type Rng = () => number

/** Small seeded generator (mulberry32) so tests and previews are repeatable. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Pick one item by weight. Items with weight <= 0 are never picked. */
export function weightedPick<T>(items: T[], weightOf: (item: T) => number, rng: Rng): T | undefined {
  const total = items.reduce((sum, it) => sum + Math.max(0, weightOf(it)), 0)
  if (total <= 0) return undefined
  let roll = rng() * total
  for (const it of items) {
    roll -= Math.max(0, weightOf(it))
    if (roll < 0) return it
  }
  return items[items.length - 1]
}
