import { ROLES, STATS } from './types.js'
import type { Politician, Role, Roster, Stat, StatBlock } from './types.js'

export type RoleWeights = Partial<Record<Stat, number>>

/**
 * Weights are deliberately not all positive: the Propaganda Minister is
 * penalised for Integrity. The role table is where the game makes its jokes.
 */
export const ROLE_WEIGHTS: Record<Role, RoleWeights> = {
  President: { charisma: 0.3, cunning: 0.25, grit: 0.2, intellect: 0.15, integrity: 0.1 },
  VicePresident: { cunning: 0.35, charisma: 0.25, integrity: 0.2, grit: 0.2 },
  General: { force: 0.45, grit: 0.3, cunning: 0.15, intellect: 0.1 },
  PropagandaMinister: { charisma: 0.45, cunning: 0.35, integrity: -0.2, force: 0.1 },
  Treasurer: { intellect: 0.5, cunning: 0.25, integrity: 0.25 },
}

const STAT_MIN = 1
const STAT_MAX = 10

/**
 * Normalised to 0-100 against the role's own theoretical range, so roles with
 * negative or non-unit weight vectors stay comparable to each other.
 */
export function roleScore(stats: StatBlock, role: Role): number {
  const weights = ROLE_WEIGHTS[role]
  let raw = 0
  let lo = 0
  let hi = 0
  for (const stat of STATS) {
    const w = weights[stat] ?? 0
    if (w === 0) continue
    raw += w * stats[stat]
    lo += w > 0 ? w * STAT_MIN : w * STAT_MAX
    hi += w > 0 ? w * STAT_MAX : w * STAT_MIN
  }
  return clamp(((raw - lo) / (hi - lo)) * 100, 0, 100)
}

/** A single stat on the same 0-100 scale as roleScore. */
export function statScore(stats: StatBlock, stat: Stat): number {
  return ((stats[stat] - STAT_MIN) / (STAT_MAX - STAT_MIN)) * 100
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi)
}

export interface ChemistryEffect {
  id: string
  /** Points added to the final 0-100 score. Negative is a penalty. */
  delta: number
  text: string
  roles: Role[]
}

export interface ChemistryResult {
  effects: ChemistryEffect[]
  total: number
  coup: { usurper: Role; margin: number } | null
}

/**
 * Team-level modifiers, applied after the per-role checks. These are what make
 * a roster more than five independent picks.
 */
export function chemistry(roster: Roster): ChemistryResult {
  const effects: ChemistryEffect[] = []
  const entries = ROLES.map((role) => ({ role, p: roster[role] }))

  // Rivalries: named pairs refuse to function in the same cabinet.
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i]!
      const b = entries[j]!
      if (a.p.rivals?.includes(b.p.id) || b.p.rivals?.includes(a.p.id)) {
        effects.push({
          id: 'rivalry',
          delta: -12,
          text: `${a.p.name} and ${b.p.name} will not be in a room together.`,
          roles: [a.role, b.role],
        })
      }
    }
  }

  // Trait clashes.
  const president = roster.President
  const general = roster.General
  if (general.traits.includes('warhawk') && president.traits.includes('isolationist')) {
    effects.push({
      id: 'deadlock',
      delta: -8,
      text: `${general.name} wants a war ${president.name} refuses to authorise.`,
      roles: ['General', 'President'],
    })
  }
  const paranoid = entries.filter((e) => e.p.traits.includes('paranoid'))
  if (paranoid.length >= 2) {
    effects.push({
      id: 'mutual-suspicion',
      delta: -6,
      text: 'Two people in this cabinet are having the other one followed.',
      roles: paranoid.map((e) => e.role),
    })
  }

  // Synergy: a cabinet from one time and place actually knows how to talk.
  const eras = new Set(entries.map((e) => e.p.era))
  if (eras.size === 1) {
    effects.push({
      id: 'same-era',
      delta: 6,
      text: 'They share a decade, a vocabulary and several grudges.',
      roles: ROLES.slice(),
    })
  }
  const countries = new Set(entries.map((e) => e.p.country))
  if (countries.size === 1) {
    effects.push({
      id: 'same-country',
      delta: 5,
      text: 'No translators required.',
      roles: ROLES.slice(),
    })
  }

  return {
    effects,
    total: effects.reduce((sum, e) => sum + e.delta, 0),
    coup: coupCheck(roster),
  }
}

/**
 * Calibrated against the shipped roster, not chosen: the stat budget compresses
 * presidential scores, so margins above ~19 do not occur at all. Fires for
 * roughly 7% of runs. Recalibrate whenever the roster's stat spread changes.
 */
const COUP_MARGIN = 19

/**
 * An ambitious deputy who badly outclasses the President takes the job. The
 * run still resolves - just under new management.
 */
function coupCheck(roster: Roster): { usurper: Role; margin: number } | null {
  const presidential = (p: Politician) => roleScore(p.stats, 'President')
  const bar = presidential(roster.President)
  let best: { usurper: Role; margin: number } | null = null
  for (const role of ['VicePresident', 'General'] as const) {
    const p = roster[role]
    const ambitious = p.traits.includes('paranoid') || p.traits.includes('cunning')
    if (!ambitious) continue
    const margin = presidential(p) - bar
    if (margin >= COUP_MARGIN && (!best || margin > best.margin)) {
      best = { usurper: role, margin }
    }
  }
  return best
}
