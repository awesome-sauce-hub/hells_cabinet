import { hashString, seedFrom, shuffle } from './rng.js'
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
  // Consumed either way, so the draft that follows is the same whichever route
  // chose the crisis. Skipping it when the crisis is already known would hand
  // the same seed different candidates depending on how you arrived at it.
  const roll = rng.next()
  const drawn = fromCalendar(seed, events) ?? events[Math.floor(roll * events.length)]!
  const event = (eventId && events.find((e) => e.id === eventId)) || drawn
  return { seed, rng, event }
}

/** Days since 1970-01-01 for a YYYY-MM-DD key, or null if it is not one. */
function dayNumber(seed: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(seed)) return null
  const ms = Date.parse(`${seed}T00:00:00Z`)
  return Number.isNaN(ms) ? null : Math.floor(ms / 86400000)
}

/**
 * Which crisis the daily deals, as a cycle rather than a draw.
 *
 * Drawing independently each morning meant the calendar repeated itself
 * immediately: over sixty days the same crisis landed two days running four
 * times, and the Gas Leak turned up on the first, fourth and sixth of the
 * month. That reads as broken rather than random, and for a game whose whole
 * pitch is one crisis a day it is the first thing a returning player notices.
 *
 * So the events are dealt as a shuffled pack: every crisis appears once before
 * any appears twice, the order is reshuffled each time the pack runs out, and
 * the seam is checked so a reshuffle cannot repeat the crisis it just ended on.
 * Only dated seeds get this - a shared link's random seed still draws freely,
 * because a sent cabinet is one crisis and has no calendar to sit in.
 */
function fromCalendar(seed: string, events: GameEvent[]): GameEvent | null {
  const day = dayNumber(seed)
  if (day === null || events.length === 0) return null
  const cycle = Math.floor(day / events.length)
  const order = packFor(cycle, events)
  return order[day - cycle * events.length]!
}

function packFor(cycle: number, events: GameEvent[]): GameEvent[] {
  const order = shuffle(seedFrom(hashString(`pack:${cycle}`)), events)
  if (events.length < 2) return order
  // A pack that opens on the crisis the last one closed with is a repeat two
  // days running, which is the exact thing the cycle exists to prevent.
  const previous = shuffle(seedFrom(hashString(`pack:${cycle - 1}`)), events)
  if (order[0]!.id === previous[previous.length - 1]!.id) {
    ;[order[0], order[1]] = [order[1]!, order[0]!]
  }
  return order
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
