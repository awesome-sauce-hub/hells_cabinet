import { VERDICTS } from '../engine/verdict.js'
import type { Verdict } from '../engine/verdict.js'
import type { Resolution } from '../engine/resolve.js'
import type { Rating } from '../engine/rating.js'

/**
 * What the player has learned, kept across runs.
 *
 * The game has never accumulated anything. A daily with no memory is a daily
 * you cannot get better at in any way you can see, and the thing a player
 * actually builds up over a fortnight of these - a working sense of who these
 * people were and what a crisis does to them - was the one thing nothing
 * recorded.
 *
 * Two decisions worth keeping:
 *
 * It is stored under its own key, not with the run. CONTENT_FINGERPRINT
 * discards a save whenever a figure is added or removed, which is right for a
 * half-played draft and would be indefensible for a month of history. Unknown
 * ids are simply skipped on read instead, so a roster change costs a line, not
 * the record.
 *
 * It tracks the judgement rating rather than the score. The score contains the
 * deal and the sealed complication and is far too noisy to be a progress curve;
 * the rating is the part the player controls, so it is the part worth watching.
 */
const KEY = 'hells-cabinet:dossier'
const VERSION = 1

/** Enough to see a trend, few enough that a bad fortnight can be climbed out of. */
const WINDOW = 10

export interface PersonRecord {
  /** Runs this figure has been appointed in. */
  appointed: number
  /** How they turned out, by verdict word. */
  marks: Partial<Record<Verdict, number>>
}

export interface Dossier {
  version: number
  people: Record<string, PersonRecord>
  /** Most recent first, capped at WINDOW. */
  ratings: number[]
  /** Best rating reached on each crisis, by event id. */
  crises: Record<string, number>
  runs: number
  /**
   * The run most recently folded in.
   *
   * The verdict screen is a resumable phase - a player can reload on it, or
   * come back to a finished daily - and without this every reload would count
   * the same cabinet again, inflating the record of whoever was in it and
   * flattening the rating window against one result.
   */
  last?: string
}

const empty = (): Dossier => ({ version: VERSION, people: {}, ratings: [], crises: {}, runs: 0 })

/** Identifies a run for the double-count guard. A seed and a crisis is one game. */
export function runKey(seed: string, eventId: string): string {
  return `${seed}:${eventId}`
}

/** Storage is unavailable in some browsers and private modes; never throw. */
export function loadDossier(): Dossier {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty()
    const parsed = JSON.parse(raw) as Partial<Dossier>
    if (parsed.version !== VERSION) return empty()

    // Rebuilt field by field rather than trusted: this is the one structure in
    // the game that is meant to outlive roster changes, so it has to survive
    // meeting a shape it does not recognise.
    const people: Record<string, PersonRecord> = {}
    for (const [id, rec] of Object.entries(parsed.people ?? {})) {
      if (typeof rec !== 'object' || rec === null) continue
      const marks: Partial<Record<Verdict, number>> = {}
      for (const v of VERDICTS) {
        const n = (rec.marks as Record<string, unknown> | undefined)?.[v]
        if (typeof n === 'number' && n > 0) marks[v] = n
      }
      const appointed = typeof rec.appointed === 'number' ? rec.appointed : 0
      if (appointed > 0) people[id] = { appointed, marks }
    }

    const ratings = (Array.isArray(parsed.ratings) ? parsed.ratings : [])
      .filter((n): n is number => typeof n === 'number' && n >= 0 && n <= 1)
      .slice(0, WINDOW)

    const crises: Record<string, number> = {}
    for (const [id, best] of Object.entries(parsed.crises ?? {})) {
      if (typeof best === 'number' && best >= 0 && best <= 1) crises[id] = best
    }

    return {
      version: VERSION,
      people,
      ratings,
      crises,
      runs: typeof parsed.runs === 'number' ? parsed.runs : 0,
      ...(typeof parsed.last === 'string' ? { last: parsed.last } : {}),
    }
  } catch {
    return empty()
  }
}

/**
 * Fold one finished run into the record.
 *
 * Returns the new dossier so a caller can render it without a second read.
 * Runs with nothing to rate still count the appointments - who you used is
 * worth remembering even when how you chose cannot be scored.
 */
export function recordRun(
  key: string,
  result: Resolution,
  rating: Rating | null,
  now = loadDossier(),
): Dossier {
  if (now.last === key) return now

  const next: Dossier = {
    last: key,
    version: VERSION,
    people: { ...now.people },
    ratings: rating ? [rating.rating, ...now.ratings].slice(0, WINDOW) : now.ratings,
    crises: { ...now.crises },
    runs: now.runs + 1,
  }

  for (const v of result.verdicts) {
    const p = result.roster[v.role]
    const was = next.people[p.id] ?? { appointed: 0, marks: {} }
    next.people[p.id] = {
      appointed: was.appointed + 1,
      marks: { ...was.marks, [v.verdict]: (was.marks[v.verdict] ?? 0) + 1 },
    }
  }

  if (rating) {
    const best = next.crises[result.event.id]
    if (best === undefined || rating.rating > best) next.crises[result.event.id] = rating.rating
  }

  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // A run that cannot be remembered is still perfectly playable.
  }
  return next
}

/** Mean judgement over the recorded window, or null before there is one. */
export function form(dossier: Dossier): number | null {
  if (dossier.ratings.length === 0) return null
  return dossier.ratings.reduce((a, b) => a + b, 0) / dossier.ratings.length
}

export function clearDossier(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing to do.
  }
}
