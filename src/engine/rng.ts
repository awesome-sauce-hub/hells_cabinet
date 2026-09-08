/**
 * The only source of randomness in the game.
 *
 * Every draw takes an explicit Rng instance so a seed fully determines a run -
 * daily mode, the share grid and the balance harness all depend on it. Using
 * Math.random anywhere else silently breaks all three.
 */
export interface Rng {
  /** Float in [0, 1). */
  next(): number
}

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0
      let t = a
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
  }
}

/** FNV-1a. Stable across runs and platforms, unlike String.hashCode-alikes. */
export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** YYYY-MM-DD -> seed. The whole daily mode hangs off this. */
export function dailySeed(isoDate: string): number {
  return hashString(`politidle-${isoDate}`)
}

export function seedFrom(input: string | number): Rng {
  return mulberry32(typeof input === 'number' ? input : hashString(input))
}

export function randInt(rng: Rng, maxExclusive: number): number {
  return Math.floor(rng.next() * maxExclusive)
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick() on empty list')
  return items[randInt(rng, items.length)]!
}

/** Fisher-Yates on a copy. */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1)
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/** Weighted draw without replacement. Weights must be positive. */
export function sampleWeighted<T>(
  rng: Rng,
  items: readonly T[],
  weightOf: (item: T) => number,
  count: number,
): T[] {
  const pool = items.slice()
  const weights = pool.map((i) => Math.max(weightOf(i), 0.0001))
  const out: T[] = []
  const n = Math.min(count, pool.length)
  for (let k = 0; k < n; k++) {
    let total = 0
    for (const w of weights) total += w
    let roll = rng.next() * total
    let idx = weights.length - 1
    for (let i = 0; i < weights.length; i++) {
      roll -= weights[i]!
      if (roll <= 0) {
        idx = i
        break
      }
    }
    out.push(pool[idx]!)
    pool.splice(idx, 1)
    weights.splice(idx, 1)
  }
  return out
}
