import { ROLES } from './types.js'
import type { Check, GameEvent, Role, Roster } from './types.js'
import { chemistry, clamp, roleScore, statScore } from './score.js'
import type { ChemistryResult } from './score.js'

export const TIERS = ['Catastrophe', 'Debacle', 'Muddled Through', 'Triumph', 'Legendary'] as const
export type Tier = (typeof TIERS)[number]

export interface CheckResult {
  check: Check
  role: Role
  politicianName: string
  /** 0-100 blend of role fit and the biased stat, inverted where the event asks. */
  value: number
  margin: number
  /** 0-1, how well this check went. Feeds the total and the share grid. */
  outcome: number
  passed: boolean
  isTwist: boolean
}

export interface Resolution {
  event: GameEvent
  /** Kept on the result so the verdict screen can reveal the hidden stats. */
  roster: Roster
  checks: CheckResult[]
  chemistry: ChemistryResult
  /** 0-100. */
  score: number
  tier: Tier
  grid: string
}

/** Half role fit, half the stat the event actually cares about. */
const ROLE_FIT_SHARE = 0.5
/**
 * Margin at which a check is fully won or fully lost, and the single lever over
 * how far apart ordinary and perfect play land. Raising it compresses the range:
 * shifting every dc moves the ceiling and the average together and so cannot
 * separate them. See scripts/autotune.ts.
 */
const MARGIN_BAND = 38

function runCheck(check: Check, roster: Roster, isTwist: boolean): CheckResult {
  const p = roster[check.role]
  const fit = roleScore(p.stats, check.role)
  let biased = statScore(p.stats, check.stat_bias)
  // The event punishes the stat rather than rewarding it: restraint over firepower.
  if (check.invert) biased = 100 - biased
  const value = ROLE_FIT_SHARE * fit + (1 - ROLE_FIT_SHARE) * biased
  const margin = value - check.dc
  return {
    check,
    role: check.role,
    politicianName: p.name,
    value,
    margin,
    outcome: clamp((margin + MARGIN_BAND) / (2 * MARGIN_BAND), 0, 1),
    passed: margin >= 0,
    isTwist,
  }
}

export function resolveEvent(event: GameEvent, roster: Roster): Resolution {
  const checks: CheckResult[] = [
    ...event.checks.map((c) => runCheck(c, roster, false)),
    runCheck(event.twist.check, roster, true),
  ]

  let weighted = 0
  let totalWeight = 0
  for (const r of checks) {
    const w = r.check.weight ?? 1
    weighted += r.outcome * w
    totalWeight += w
  }
  const base = totalWeight > 0 ? (weighted / totalWeight) * 100 : 50

  const chem = chemistry(roster)
  const score = clamp(base + chem.total, 0, 100)

  return {
    event,
    roster,
    checks,
    chemistry: chem,
    score,
    tier: tierFor(score),
    grid: shareGrid(checks),
  }
}

export function tierFor(score: number): Tier {
  if (score < 20) return 'Catastrophe'
  if (score < 40) return 'Debacle'
  if (score < 60) return 'Muddled Through'
  if (score < 80) return 'Triumph'
  return 'Legendary'
}

/** One square per role, in draft order. Roles the event never tested go blank. */
export function shareGrid(checks: CheckResult[]): string {
  return ROLES.map((role) => {
    const forRole = checks.filter((c) => c.role === role)
    if (forRole.length === 0) return '⬜'
    const avg = forRole.reduce((s, c) => s + c.outcome, 0) / forRole.length
    if (avg >= 0.66) return '🟩'
    if (avg >= 0.33) return '🟨'
    return '🟥'
  }).join('')
}
