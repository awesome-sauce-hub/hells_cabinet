import { ALIGNMENTS, POWER_TIERS, ROLES } from './types.js'
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
const WILDCARD_WEIGHT = 0.15
/** Objects are rarer still - a filing cabinet running the treasury is a gag
 *  that stops landing the third time it happens in one run. */
const OBJECT_WEIGHT = 0.09
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

/**
 * The people history actually has an opinion about are the exception, not the
 * rule. A genuine reformer is the rarest thing on the board; monsters are
 * merely uncommon, because a cabinet that keeps offering you tyrants is funnier
 * than one that keeps offering you saints. Everyone else - the forgettable
 * middle, the wildcards, the furniture - is the ordinary weather.
 */
const ALIGNMENT_RARITY: Record<(typeof ALIGNMENTS)[number], number> = {
  good: 0.62,
  bad: 0.85,
  neutral: 1,
}

/**
 * Weighted against every post still open, not one named role: a wave is dealt
 * before the player has decided what anyone is for, so a card only has to be
 * plausible somewhere on the remaining board.
 */
export function poolWeight(p: Politician, openRoles: readonly Role[]): number {
  const affine = openRoles.some((r) => ROLE_AFFINITY[r].some((t) => p.traits.includes(t)))
  const base = 1 + (affine ? AFFINITY_BONUS : 0)
  const byCategory =
    p.category === 'object' ? OBJECT_WEIGHT : p.category === 'wildcard' ? WILDCARD_WEIGHT : 1
  const rarity = byCategory * POWER_RARITY[p.tier] * ALIGNMENT_RARITY[p.alignment]
  const bestFit = openRoles.reduce((m, r) => Math.max(m, roleScore(p.stats, r)), 0)
  return base * rarity * (1 + bestFit * FIT_WEIGHT)
}

export function drawCandidates(
  rng: Rng,
  available: readonly Politician[],
  openRoles: readonly Role[],
  count = CANDIDATES_PER_ROUND,
): Politician[] {
  return sampleWeighted(rng, available, (p) => poolWeight(p, openRoles), count)
}

export interface DraftState {
  rng: Rng
  /** Set when the player drafted a figure carrying endsRun. */
  endedBy: Politician | null
  remaining: Politician[]
  /** Which wave of six is on the table, 0-4. */
  wave: number
  candidates: Politician[]
  picks: Partial<Record<Role, Politician>>
  respins: number
  benches: number
}

/** Posts still to be filled, in cabinet order. */
export function openRoles(state: DraftState): Role[] {
  return ROLES.filter((r) => !state.picks[r])
}



export function startDraft(rng: Rng, roster: readonly Politician[]): DraftState {
  const remaining = roster.slice()
  const state: DraftState = {
    rng,
    remaining,
    wave: 0,
    endedBy: null,
    candidates: [],
    picks: {},
    respins: RESPIN_TOKENS,
    benches: BENCH_TOKENS,
  }
  state.candidates = drawCandidates(rng, remaining, ROLES)
  return state
}

/**
 * Place one candidate from the current wave into any post still open. Choosing
 * the post is the decision the draft is really made of - the same six people
 * make a different cabinet depending on where you put them.
 */
export function placeCandidate(state: DraftState, id: string, role: Role): DraftState {
  const chosen = state.candidates.find((c) => c.id === id)
  if (!chosen) throw new Error(`${id} is not on offer this wave`)
  if (state.picks[role]) throw new Error(`${role} is already filled`)
  state.picks[role] = chosen
  if (chosen.endsRun) {
    // The run is over the moment they are appointed. No further rounds, no
    // resolution - the joke is that nothing else gets to happen.
    state.endedBy = chosen
    state.candidates = []
    return state
  }
  // Everyone on the table leaves the pool, taken or not: a wave that passes is
  // gone, so declining a good card costs something.
  state.remaining = withoutIds(state.remaining, state.candidates.map((c) => c.id))
  state.wave += 1
  state.candidates = isDraftComplete(state)
    ? []
    : drawCandidates(state.rng, state.remaining, openRoles(state))
  return state
}

/**
 * Reroll the whole board. Costs a token.
 *
 * The six you rejected are gone, exactly as the five you leave behind when you
 * appoint someone are gone: dismissal is permanent everywhere in the draft.
 * Drawing the replacements from a pool that still held them was the bug - a
 * reshuffle could hand you most of the same board back, which is the one thing
 * a reshuffle must never do.
 */
export function respin(state: DraftState): DraftState {
  if (state.respins <= 0) throw new Error('no respins left')
  state.respins -= 1
  state.remaining = withoutIds(state.remaining, state.candidates.map((c) => c.id))
  state.candidates = drawCandidates(state.rng, state.remaining, openRoles(state))
  return state
}

/**
 * Discard one candidate and draw a replacement into the slot. Costs a token.
 *
 * The dismissed figure leaves the game rather than the table. A token whose
 * only effect is a one-wave reprieve - the player benches Mussolini and is
 * offered him again two waves later - is not worth the one token you get.
 */
export function bench(state: DraftState, id: string): DraftState {
  if (state.benches <= 0) throw new Error('no benches left')
  const idx = state.candidates.findIndex((c) => c.id === id)
  if (idx === -1) throw new Error(`${id} is not on offer this round`)
  state.benches -= 1
  state.remaining = withoutIds(state.remaining, [id])
  // Still exclude the rest of the table, so the replacement is not a duplicate
  // of somebody the player is already looking at.
  const shown = new Set(state.candidates.map((c) => c.id))
  const pool = state.remaining.filter((p) => !shown.has(p.id))
  const [replacement] = drawCandidates(state.rng, pool, openRoles(state), 1)
  if (replacement) state.candidates[idx] = replacement
  else state.candidates.splice(idx, 1)
  return state
}

function withoutIds(pool: readonly Politician[], ids: readonly string[]): Politician[] {
  const gone = new Set(ids)
  return pool.filter((p) => !gone.has(p.id))
}

export function isDraftComplete(state: DraftState): boolean {
  return ROLES.every((r) => state.picks[r])
}

export function finishDraft(state: DraftState): Roster {
  if (!isDraftComplete(state)) throw new Error('draft is not finished')
  return Object.fromEntries(ROLES.map((r) => [r, state.picks[r]!])) as Roster
}

/**
 * Convenience for the balance harnesses: a full random draft in one call.
 *
 * Run-ending figures are skipped rather than drafted. The harnesses measure how
 * events resolve, and a run that stops at round two never reaches resolution -
 * including those would quietly bias every distribution they report.
 */
export function randomDraft(rng: Rng, roster: readonly Politician[]): Roster {
  let state = startDraft(rng, roster)
  while (!isDraftComplete(state)) {
    const pickable = state.candidates.filter((c) => !c.endsRun)
    // Every candidate ends the run: redeal rather than deadlock.
    if (pickable.length === 0) {
      state.candidates = drawCandidates(state.rng, state.remaining, openRoles(state))
      continue
    }
    const choice = pickable[Math.floor(rng.next() * pickable.length)]!
    const open = openRoles(state)
    const role = open[Math.floor(rng.next() * open.length)]!
    state = placeCandidate(state, choice.id, role)
  }
  return finishDraft(state)
}
