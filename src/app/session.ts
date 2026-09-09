import { EVENTS, FIGURES } from './data.js'
import { hashString } from '../engine/rng.js'
import { createRun, todayKey } from '../engine/run.js'
import type { DraftAction } from '../engine/replay.js'

/**
 * Saving, resuming and sharing a run.
 *
 * A run is identified by two things and nothing else: the seed, which
 * determines every draw, and the chosen event, or null to mean "whichever one
 * this seed draws". That pair is enough to put the same game in front of
 * another player through a link, and enough to rebuild your own after a reload
 * once the action log is replayed over it.
 */
export interface RunRef {
  seed: string
  /** null means the daily behaviour: the seed picks the crisis. */
  eventId: string | null
}

export type SavedPhase = 'briefing' | 'draft' | 'gameover' | 'sim' | 'verdict'

export interface SavedRun extends RunRef {
  version: number
  /** Roster and event fingerprint. A save from a different one is discarded. */
  content: number
  actions: DraftAction[]
  phase: SavedPhase
}

const KEY = 'hells-cabinet:run'
const VERSION = 1

/**
 * Changing the roster or the events changes what a seed deals, so a save from
 * before the change would replay into a different game while claiming to be the
 * same one. Fingerprinting the content lets an old save be discarded rather
 * than silently resumed as something else.
 */
export const CONTENT_FINGERPRINT = hashString(
  `${FIGURES.map((f) => f.id).join(',')}|${EVENTS.map((e) => e.id).join(',')}`,
)

export function isDaily(ref: RunRef): boolean {
  return ref.eventId === null && ref.seed === todayKey()
}

/** Storage is unavailable in some browsers and private modes; never throw. */
export function saveRun(run: Omit<SavedRun, 'version' | 'content'>): void {
  try {
    const payload: SavedRun = { ...run, version: VERSION, content: CONTENT_FINGERPRINT }
    localStorage.setItem(KEY, JSON.stringify(payload))
  } catch {
    // A run that cannot be saved is still perfectly playable.
  }
}

export function clearRun(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing to do; the next save overwrites it anyway.
  }
}

export function loadRun(): SavedRun | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const saved = JSON.parse(raw) as SavedRun
    if (saved.version !== VERSION || saved.content !== CONTENT_FINGERPRINT) return null
    if (typeof saved.seed !== 'string' || !Array.isArray(saved.actions)) return null
    if (saved.eventId !== null && !EVENTS.some((e) => e.id === saved.eventId)) return null
    return saved
  } catch {
    return null
  }
}

/** ?event=<id>&seed=<seed> on the address bar, if it names a real event. */
export function runFromUrl(search: string): RunRef | null {
  try {
    const params = new URLSearchParams(search)
    const seed = params.get('seed')
    const eventId = params.get('event')
    if (!seed || !eventId) return null
    if (!EVENTS.some((e) => e.id === eventId)) return null
    return { seed, eventId }
  } catch {
    return null
  }
}

export function linkTo(ref: RunRef, origin = window.location.origin + window.location.pathname): string {
  // The daily is the same puzzle for everyone on the day, so it needs no link
  // of its own - but it still gets one, because a link to yesterday's game has
  // to keep working after the date rolls over.
  const params = new URLSearchParams({ event: ref.eventId ?? eventIdFor(ref.seed), seed: ref.seed })
  return `${origin}?${params}`
}

/**
 * Which crisis a seed draws. Goes through createRun rather than repeating its
 * arithmetic, so a link can never name a different event than the one the game
 * will actually deal.
 */
export function eventIdFor(seed: string): string {
  return createRun(seed, EVENTS).event.id
}
