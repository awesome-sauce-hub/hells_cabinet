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

/**
 * Pass an eventId to play a chosen crisis instead of the one the seed draws.
 *
 * The draw happens either way. The draft continues this same rng, so skipping
 * the roll when the event is chosen would hand the same seed different
 * candidates depending on how you arrived at it - and would quietly change
 * every daily puzzle ever played.
 */
export function createRun(seed: string, events: GameEvent[], eventId?: string | null): RunSetup {
  const rng = seedFrom(seed)
  const drawn = events[Math.floor(rng.next() * events.length)]!
  const event = (eventId && events.find((e) => e.id === eventId)) || drawn
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

/**
 * A fresh seed for a chosen crisis, so picking the same event twice does not
 * deal the same six faces. Short enough to sit in a shareable link.
 */
export function randomSeed(): string {
  return Math.random().toString(36).slice(2, 10)
}

export type { Politician }
