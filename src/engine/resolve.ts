import { ROLES } from './types.js'
import type { Check, GameEvent, Politician, Role, Roster } from './types.js'
import { chemistry } from './score.js'
import type { ChemistryResult } from './score.js'
import { scoreFrom, shareGrid, tierFor } from './verdict.js'
import type { RoleVerdict, Tier, Verdict } from './verdict.js'
import { seedFrom } from './rng.js'

export interface Resolution {
  event: GameEvent
  roster: Roster
  verdicts: RoleVerdict[]
  chemistry: ChemistryResult
  /** 0-100. */
  score: number
  tier: Tier
  grid: string
  /** False when the fallback adjudicator produced this rather than the narrator. */
  judged: boolean
}

/**
 * The fallback adjudicator.
 *
 * The real one is Claude, which knows who these people were. This is what runs
 * when there is no key, no network, or the request failed - it must still
 * produce a defensible verdict for every post, because a game that cannot
 * resolve is worse than one resolved roughly.
 *
 * It judges from what the roster still authors by hand: traits, power tier,
 * alignment and category. That is coarse, and it is meant to be: it is the
 * difference between playable and broken, not a second opinion.
 */

/** Traits that suggest a post's holder is equipped for a given demand. */
const SUITED: Record<string, readonly string[]> = {
  charisma: ['beloved', 'showman', 'demagogue', 'statesman'],
  cunning: ['cunning', 'dealmaker', 'strategist', 'paranoid'],
  integrity: ['statesman', 'beloved', 'loyalist'],
  grit: ['soldier', 'warhawk', 'statesman', 'strategist'],
  intellect: ['technocrat', 'strategist', 'banker'],
  force: ['warhawk', 'soldier', 'demagogue'],
}

/** Traits that actively get in the way of a given demand. */
const UNSUITED: Record<string, readonly string[]> = {
  charisma: ['technocrat', 'liability'],
  cunning: ['loyalist', 'liability'],
  integrity: ['demagogue', 'scandal-magnet', 'cunning'],
  grit: ['liability', 'scandal-magnet'],
  intellect: ['liability', 'showman'],
  force: ['technocrat', 'liability'],
}

const TIER_LIFT: Record<Politician['tier'], number> = {
  titan: 1.4,
  heavyweight: 0.7,
  operator: 0,
  flawed: -0.7,
  liability: -1.4,
}

/**
 * Judge one named person against one demand.
 *
 * Split out from judgeCheck so the rating can ask the same question of someone
 * who was never appointed - "what would this have scored" - using the identical
 * judge, which is the only thing that makes par comparable to what happened.
 */
export function judgeFor(check: Check, p: Politician, event: GameEvent): RoleVerdict {
  const suited = (SUITED[check.demands] ?? []).filter((t) => p.traits.includes(t)).length
  const unsuited = (UNSUITED[check.demands] ?? []).filter((t) => p.traits.includes(t)).length

  // A crisis asking for restraint wants the opposite of the obvious fit.
  let standing = check.invert ? unsuited - suited : suited - unsuited
  standing += TIER_LIFT[p.tier]
  // Furniture does not rise to an occasion, whatever the occasion asks.
  if (p.category === 'object') standing -= 2.5

  // A seeded nudge so identical trait sets do not always land identically,
  // and so this stays deterministic for a given event and cabinet.
  standing += seedFrom(`${event.id}:${check.role}:${p.id}:${check.demands}`).next() * 1.6 - 0.8

  const verdict: Verdict =
    standing >= 1.6 ? 'triumph' : standing >= 0.2 ? 'pass' : standing >= -1.4 ? 'fail' : 'disaster'

  return {
    role: check.role,
    verdict,
    reason: check.note ? `${p.name}, on ${check.note}.` : `${p.name} was asked for ${check.demands}.`,
    weight: check.weight,
  }
}

function judgeCheck(check: Check, roster: Roster, event: GameEvent): RoleVerdict {
  return judgeFor(check, roster[check.role], event)
}

export function resolveEvent(event: GameEvent, roster: Roster): Resolution {
  const verdicts = [...event.checks, event.twist.check].map((c) => judgeCheck(c, roster, event))
  return assemble(event, roster, verdicts, false)
}

/**
 * Build a Resolution from verdicts that came from somewhere else - the
 * narrator's judgement - so scoring, chemistry, tiering and the share grid
 * happen in exactly one place regardless of who did the judging.
 */
export function assemble(
  event: GameEvent,
  roster: Roster,
  verdicts: RoleVerdict[],
  judged: boolean,
): Resolution {
  const chem = chemistry(roster)
  const score = scoreFrom(verdicts, chem.total)
  return {
    event,
    roster,
    verdicts,
    chemistry: chem,
    score,
    tier: tierFor(score),
    grid: shareGrid(verdicts),
    judged,
  }
}

/** The posts this crisis actually tested, in cabinet order. */
export function testedRoles(event: GameEvent): Role[] {
  const tested = new Set([...event.checks, event.twist.check].map((c) => c.role))
  return ROLES.filter((r) => tested.has(r))
}

export type { Tier, RoleVerdict, Verdict }
