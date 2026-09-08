import { POWER_TIERS, ROLES } from './types.js'
import type { Politician, Role, Roster } from './types.js'
import { sampleWeighted } from './rng.js'
import type { Rng } from './rng.js'
import { roleScore } from './score.js'

export const CANDIDATES_PER_ROUND = 6
export const RESPIN_TOKENS = 1
export const BENCH_TOKENS = 1

/**
 * Traits that make a name more likely to surface for a role. Affinity only
 * tilts the pool - every role can still offer you a disaster, which is where
 * most of the comedy comes from.
 */
const ROLE_AFFINITY: Record<Role, string[]> = {
  President: ['beloved', 'showman', 'statesman'],
  VicePresident: ['dealmaker', 'loyalist', 'paranoid'],
  General: ['warhawk', 'soldier', 'strategist'],
  PropagandaMinister: ['demagogue', 'showman', 'scandal-magnet'],
  Treasurer: ['technocrat', 'banker', 'dealmaker'],
}

const AFFINITY_BONUS = 2.5
/**
 * Wildcards are ~38% of the roster by headcount but should be roughly 1 card in
 * 6 on the board. Weighted down rather than gated so any role can still be
 * offered one. See scripts/balance.ts for the realised rate.
 */
const WILDCARD_WEIGHT = 0.2
/** Keeps a plausible pick likelier than an implausible one without excluding it. */
const FIT_WEIGHT = 0.02
/**
 * Power tiers are drawn unevenly: a titan on the board should feel like luck and
 * a liability like the ordinary weather. Weights are relative, so a titan is
 * ~7x rarer than an operator and ~9x rarer than a liability per slot. See
 * scripts/balance.ts for the realised rates.
 */
const POWER_RARITY: Record<(typeof POWER_TIERS)[number], number> = {
  titan: 0.15,
  heavyweight: 0.45,
  operator: 1,
  flawed: 1.15,
  liability: 1.3,
}

export function poolWeight(p: Politician, role: Role): number {
  const affine = ROLE_AFFINITY[role].some((t) => p.traits.includes(t))
  const base = 1 + (affine ? AFFINITY_BONUS : 0)
  const rarity = (p.category === 'wildcard' ? WILDCARD_WEIGHT : 1) * POWER_RARITY[p.tier]
  return base * rarity * (1 + roleScore(p.stats, role) * FIT_WEIGHT)
}

export function drawCandidates(
  rng: Rng,
  available: readonly Politician[],
  role: Role,
  count = CANDIDATES_PER_ROUND,
): Politician[] {
  return sampleWeighted(rng, available, (p) => poolWeight(p, role), count)
}

export interface DraftState {
  rng: Rng
  remaining: Politician[]
  round: number
  candidates: Politician[]
  picks: Partial<Record<Role, Politician>>
  respins: number
  benches: number
}

export function currentRole(state: DraftState): Role {
  const role = ROLES[state.round]
  if (!role) throw new Error(`draft is over (round ${state.round})`)
  return role
}

export function startDraft(rng: Rng, roster: readonly Politician[]): DraftState {
  const remaining = roster.slice()
  const state: DraftState = {
    rng,
    remaining,
    round: 0,
    candidates: [],
    picks: {},
    respins: RESPIN_TOKENS,
    benches: BENCH_TOKENS,
  }
  state.candidates = drawCandidates(rng, remaining, currentRole(state))
  return state
}

export function pickCandidate(state: DraftState, id: string): DraftState {
  const chosen = state.candidates.find((c) => c.id === id)
  if (!chosen) throw new Error(`${id} is not on offer this round`)
  const role = currentRole(state)
  state.picks[role] = chosen
  // Drafted names leave the pool, so later rounds cannot re-offer them.
  state.remaining = state.remaining.filter((p) => p.id !== chosen.id)
  state.round += 1
  state.candidates = isDraftComplete(state)
    ? []
    : drawCandidates(state.rng, state.remaining, currentRole(state))
  return state
}

/** Reroll the whole board. Costs a token. */
export function respin(state: DraftState): DraftState {
  if (state.respins <= 0) throw new Error('no respins left')
  state.respins -= 1
  state.candidates = drawCandidates(state.rng, state.remaining, currentRole(state))
  return state
}

/** Discard one candidate and draw a replacement into the slot. Costs a token. */
export function bench(state: DraftState, id: string): DraftState {
  if (state.benches <= 0) throw new Error('no benches left')
  const idx = state.candidates.findIndex((c) => c.id === id)
  if (idx === -1) throw new Error(`${id} is not on offer this round`)
  state.benches -= 1
  const shown = new Set(state.candidates.map((c) => c.id))
  const pool = state.remaining.filter((p) => !shown.has(p.id))
  const [replacement] = drawCandidates(state.rng, pool, currentRole(state), 1)
  if (replacement) state.candidates[idx] = replacement
  else state.candidates.splice(idx, 1)
  return state
}

export function isDraftComplete(state: DraftState): boolean {
  return state.round >= ROLES.length
}

export function finishDraft(state: DraftState): Roster {
  if (!isDraftComplete(state)) throw new Error('draft is not finished')
  return Object.fromEntries(ROLES.map((r) => [r, state.picks[r]!])) as Roster
}

/** Convenience for the balance harness: a full random draft in one call. */
export function randomDraft(rng: Rng, roster: readonly Politician[]): Roster {
  let state = startDraft(rng, roster)
  while (!isDraftComplete(state)) {
    const choice = state.candidates[Math.floor(rng.next() * state.candidates.length)]!
    state = pickCandidate(state, choice.id)
  }
  return finishDraft(state)
}
