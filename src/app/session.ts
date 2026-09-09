import { EVENTS, FIGURES } from './data.js'
import { hashString } from '../engine/rng.js'
import { createRun, todayKey } from '../engine/run.js'
import type { DraftAction } from '../engine/replay.js'
import { isVerdict, VERDICTS } from '../engine/verdict.js'
import type { RoleVerdict, Verdict } from '../engine/verdict.js'
import { ROLES } from '../engine/types.js'
import type { Role, Roster } from '../engine/types.js'
import type { Resolution } from '../engine/resolve.js'

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
  /**
   * The adjudicator's judgement, once it has judged. Kept because it is the
   * one part of a run that replaying the action log cannot rebuild: reloading
   * a finished game without it would quietly re-score it from the fallback and
   * show the player a different verdict than the one they were given.
   */
  verdicts?: RoleVerdict[]
}

const KEY = 'hells-cabinet:run'
/**
 * 2: figures lost their stat blocks, which changed the draft's draw weights.
 * A version-1 save replays the same action log into a different set of
 * candidates, so it has to be discarded rather than resumed.
 *
 * 3: the run-ender became a one-in-ten gamble rolled off the draft's stream.
 * A version-2 save that ended on him replays into a government still standing,
 * and any save made after him draws from a stream one number further on.
 */
const VERSION = 3

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

/**
 * A cabinet someone sent, read off their link.
 *
 * The seed alone puts the same six faces in front of the recipient, which is
 * the game but not the boast: what they were sent is a lineup and how it went.
 * So the appointments ride in the link too, along with the verdict each post
 * was given and the score it added up to.
 */
export interface SharedCabinet {
  ref: RunRef
  picks: Roster
  /** Absent on a link shared before the run was judged. */
  marks?: Partial<Record<Role, Verdict>>
  score?: number
}

const PICK_SEPARATOR = '.'

/**
 * Anything that does not parse cleanly is treated as no shared cabinet at all,
 * leaving the recipient with the same-deal link the game has always made. A
 * forged or truncated query never reaches the screen as a result.
 */
export function sharedFromUrl(search: string): SharedCabinet | null {
  try {
    const ref = runFromUrl(search)
    if (!ref) return null

    const params = new URLSearchParams(search)
    const ids = params.get('picks')?.split(PICK_SEPARATOR) ?? []
    if (ids.length !== ROLES.length) return null

    const picks: Partial<Roster> = {}
    ROLES.forEach((role, i) => {
      const figure = FIGURES.find((f) => f.id === ids[i])
      if (figure) picks[role] = figure
    })
    if (ROLES.some((role) => !picks[role])) return null

    const shared: SharedCabinet = { ref, picks: picks as Roster }

    const words = params.get('marks')?.split(PICK_SEPARATOR)
    if (words?.length === ROLES.length && words.every((w) => isVerdict(w) || w === UNTESTED)) {
      // An untested post stays absent rather than becoming a word: the
      // recipient should read the same blank the sender was shown.
      shared.marks = Object.fromEntries(
        ROLES.flatMap((role, i) => (isVerdict(words[i]) ? [[role, words[i] as Verdict]] : [])),
      )
    }
    // Number(null) is 0, which would report an unscored link as a nil-point
    // catastrophe, so a missing score has to be checked for before parsing.
    const raw = params.get('score')
    const score = raw === null ? NaN : Number(raw)
    if (Number.isFinite(score) && score >= 0 && score <= 100) shared.score = score

    return shared
  } catch {
    return null
  }
}

/**
 * The link to a run. Given how that run turned out, it carries the cabinet and
 * its verdict as well, so opening it shows the sender's lineup before offering
 * the same deal - rather than silently dealing a stranger's game as your own.
 */
export function linkTo(
  ref: RunRef,
  result?: Resolution,
  origin = window.location.origin + window.location.pathname,
): string {
  // The daily is the same puzzle for everyone on the day, so it needs no link
  // of its own - but it still gets one, because a link to yesterday's game has
  // to keep working after the date rolls over.
  const params = new URLSearchParams({ event: ref.eventId ?? eventIdFor(ref.seed), seed: ref.seed })
  if (result) {
    params.set('picks', ROLES.map((role) => result.roster[role].id).join(PICK_SEPARATOR))
    // One word per post. A post the crisis tested twice is reported by its
    // worse showing: the boast should not round in the sender's favour.
    params.set('marks', ROLES.map((role) => worstFor(result.verdicts, role)).join(PICK_SEPARATOR))
    params.set('score', String(Math.round(result.score)))
  }
  return `${origin}?${params}`
}

/** A post no check named, which the share grid draws as a blank square. */
const UNTESTED = 'none'

function worstFor(verdicts: readonly RoleVerdict[], role: Role): Verdict | typeof UNTESTED {
  let worst: Verdict | null = null
  for (const v of verdicts) {
    if (v.role !== role) continue
    if (worst === null || VERDICTS.indexOf(v.verdict) < VERDICTS.indexOf(worst)) worst = v.verdict
  }
  // Reporting an untested post as a pass would credit the sender with a
  // showing they never had to make.
  return worst ?? UNTESTED
}

/**
 * Which crisis a seed draws. Goes through createRun rather than repeating its
 * arithmetic, so a link can never name a different event than the one the game
 * will actually deal.
 */
export function eventIdFor(seed: string): string {
  return createRun(seed, EVENTS).event.id
}
