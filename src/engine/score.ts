import { ROLES } from './types.js'
import type { Politician, Role, Roster } from './types.js'
import { clamp } from './verdict.js'

export { clamp }

/**
 * Team-level modifiers, applied to the score after the per-post verdicts.
 *
 * These never depended on the stat block - they read traits, eras, countries
 * and named rivalries - so they survived dropping it intact. They are also the
 * part of the outcome that must stay in code: they are the same for everyone,
 * they are what makes a roster more than five separate appointments, and they
 * are cheap to reason about without asking anybody.
 */
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
  coup: { usurper: Role; reason: string } | null
}

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
          id: `rivalry-${a.p.id}-${b.p.id}`,
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
 * Somebody in the room takes the chair from a President who cannot hold it.
 *
 * The Spymaster and the General are the two seats with the means: one knows
 * what everyone did, the other has the soldiers.
 *
 * This used to compare two presidential scores and fire on a margin. With no
 * numbers to compare it asks the question the numbers were standing in for:
 * is the deputy the sort of person who takes things, and is the President the
 * sort of person things get taken from? Both halves are read off traits and
 * the power tier, which are authored rather than computed.
 */
const GRASPING = ['paranoid', 'cunning', 'demagogue', 'warhawk'] as const
const UNSTEADY: readonly string[] = ['liability', 'flawed']

function coupCheck(roster: Roster): { usurper: Role; reason: string } | null {
  const president = roster.President
  // A titan or heavyweight President is not deposed by their own deputy.
  if (!UNSTEADY.includes(president.tier)) return null
  // Furniture cannot mount a coup, and neither can it be couped against - the
  // joke of an object in the chair is that nothing at all happens.
  if (president.category === 'object') return null

  for (const role of ['Spymaster', 'General'] as const) {
    const p = roster[role]
    if (p.category === 'object') continue
    const grasping = GRASPING.filter((t) => p.traits.includes(t))
    // Two grasping traits and a President out of their depth is the threshold.
    if (grasping.length >= 2 && (p.tier === 'titan' || p.tier === 'heavyweight')) {
      return {
        usurper: role,
        reason: `${p.name} is ${grasping.join(' and ')}, and ${president.name} was never going to hold the chair.`,
      }
    }
  }
  return null
}
