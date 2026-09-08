import { seedFrom } from './rng.js'
import type { Rng } from './rng.js'
import type { GameEvent, Politician } from './types.js'

/**
 * One seed picks both the event and every pool that follows, so a date fully
 * determines a day's puzzle. Shared by the app and the headless scripts - if
 * they ever diverge, the daily stops matching between players.
 */
export interface RunSetup {
  seed: string
  rng: Rng
  event: GameEvent
}

export function createRun(seed: string, events: GameEvent[]): RunSetup {
  const rng = seedFrom(seed)
  const event = events[Math.floor(rng.next() * events.length)]!
  return { seed, rng, event }
}

/**
 * The player's local calendar date, not UTC - otherwise anyone east of
 * Greenwich is handed yesterday's puzzle with yesterday's date printed on it.
 */
export function todayKey(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Free play still runs through a seed, so any run can be shared or replayed. */
export function randomSeed(): string {
  return `free-${Math.random().toString(36).slice(2, 10)}`
}

export type { Politician }
