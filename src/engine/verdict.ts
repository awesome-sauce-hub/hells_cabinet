import { ROLES } from './types.js'
import type { Role } from './types.js'

/**
 * How a run is scored now that figures carry no numbers.
 *
 * The adjudicator - Claude, or the fallback in resolve.ts - decides only what
 * it is qualified to decide: how each post handled what the crisis asked of it,
 * as one of four words. Turning five words into a score, a tier and a share
 * grid stays here, in code, on purpose. It is the part that has to be the same
 * for everyone, has to be tunable, and has no judgement in it worth delegating.
 */
export const VERDICTS = ['disaster', 'fail', 'pass', 'triumph'] as const
export type Verdict = (typeof VERDICTS)[number]

/** What each verdict is worth, 0-1, before weighting. */
export const VERDICT_VALUE: Record<Verdict, number> = {
  disaster: 0,
  fail: 0.3,
  pass: 0.72,
  triumph: 1,
}

export const TIERS = ['Catastrophe', 'Debacle', 'Muddled Through', 'Triumph', 'Legendary'] as const
export type Tier = (typeof TIERS)[number]

export interface RoleVerdict {
  role: Role
  verdict: Verdict
  /** One line on why, from whoever judged it. Shown on the verdict screen. */
  reason: string
  /** Relative importance, from the event's check weights. Defaults to 1. */
  weight?: number
}

/**
 * A cabinet that does everything asked of it should reach the top tier, and
 * under the old numeric scoring it could not: Legendary came out at 0.0-0.1%
 * across all ten events because the stat budgets compressed every score toward
 * the middle. Five triumphs now score 100 by construction.
 */
export function scoreFrom(verdicts: readonly RoleVerdict[], chemistryTotal = 0): number {
  if (verdicts.length === 0) return 50
  let weighted = 0
  let total = 0
  for (const v of verdicts) {
    const weight = v.weight ?? 1
    weighted += VERDICT_VALUE[v.verdict] * weight
    total += weight
  }
  return clamp((weighted / total) * 100 + chemistryTotal, 0, 100)
}

export function tierFor(score: number): Tier {
  if (score < 20) return 'Catastrophe'
  if (score < 40) return 'Debacle'
  if (score < 60) return 'Muddled Through'
  if (score < 80) return 'Triumph'
  return 'Legendary'
}

/**
 * How one post reads in a shared result. A post can be asked two things, so the
 * square is the average rather than the worse of them.
 */
export function squareFor(verdicts: readonly RoleVerdict[], role: Role): string {
  const forRole = verdicts.filter((v) => v.role === role)
  if (forRole.length === 0) return '⬜'
  const avg = forRole.reduce((sum, v) => sum + VERDICT_VALUE[v.verdict], 0) / forRole.length
  if (avg >= 0.66) return '🟩'
  if (avg >= 0.33) return '🟨'
  return '🟥'
}

/** One square per post, in cabinet order. Posts the crisis never tested go blank. */
export function shareGrid(verdicts: readonly RoleVerdict[]): string {
  return ROLES.map((role) => squareFor(verdicts, role)).join('')
}

export function isVerdict(value: unknown): value is Verdict {
  return typeof value === 'string' && (VERDICTS as readonly string[]).includes(value)
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi)
}

/**
 * The arithmetic, made visible.
 *
 * The score has always been a weighted mean the player never got to see: four
 * words arrived, a number arrived, and nothing in between. That is most of why
 * it reads as arbitrary. Nothing here changes how a run scores - it only says
 * out loud what each post contributed and what it could have contributed, so a
 * player can tell which seat mattered and which seat lost it.
 */
export interface PostBreakdown {
  role: Role
  verdict: Verdict
  /** The event's authored weight for this post, summed if it was asked twice. */
  weight: number
  /** Points this post put on the board, out of 100. */
  earned: number
  /** Points it was carrying - the same for every verdict word. */
  available: number
  /** True for the post the sealed complication landed on. */
  isTwist: boolean
}

export interface ScoreBreakdown {
  posts: PostBreakdown[]
  /** The chemistry adjustment, applied after the posts are totalled. */
  chemistry: number
  /** posts + chemistry, clamped - identical to scoreFrom(). */
  total: number
}

/**
 * Decompose a score into what each post contributed.
 *
 * `earned` across every post sums to the score before chemistry, which is the
 * property that makes the panel trustworthy: the numbers on screen add up to
 * the number at the top.
 */
export function breakdown(
  verdicts: readonly RoleVerdict[],
  twistRole: Role | null = null,
  chemistryTotal = 0,
): ScoreBreakdown {
  let total = 0
  for (const v of verdicts) total += v.weight ?? 1

  const posts = verdicts.map((v) => {
    const weight = v.weight ?? 1
    const available = total === 0 ? 0 : (weight / total) * 100
    return {
      role: v.role,
      verdict: v.verdict,
      weight,
      earned: available * VERDICT_VALUE[v.verdict],
      available,
      isTwist: v.role === twistRole,
    }
  })

  return { posts, chemistry: chemistryTotal, total: scoreFrom(verdicts, chemistryTotal) }
}
