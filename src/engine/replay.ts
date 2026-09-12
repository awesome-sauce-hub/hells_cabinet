import { bench, placeCandidate, respin, startDraft } from './draft.js'
import type { DraftState } from './draft.js'
import type { Rng } from './rng.js'
import { ROLES } from './types.js'
import type { Politician, Role } from './types.js'

/**
 * Everything a player can do to a draft, in a form that survives a page reload.
 *
 * The draft's randomness lives in an Rng closure that cannot be serialised, so
 * a saved game stores the seed and the actions rather than the state. Replaying
 * the actions from the same seed rebuilds the state exactly, because every draw
 * in the engine takes its randomness from that one advancing stream.
 */
export type DraftAction =
  | { t: 'place'; id: string; role: Role }
  | { t: 'bench'; id: string }
  | { t: 'respin' }

export function applyAction(state: DraftState, action: DraftAction): DraftState {
  switch (action.t) {
    case 'place':
      return placeCandidate(state, action.id, action.role)
    case 'bench':
      return bench(state, action.id)
    case 'respin':
      return respin(state)
  }
}

/**
 * Rebuild a draft from its seed and history. Returns null if the log does not
 * apply cleanly - a save written against a different roster, or a tampered one -
 * so the caller can start fresh instead of resuming into a wrong game.
 */
export function replayDraft(
  rng: Rng,
  figures: readonly Politician[],
  actions: readonly DraftAction[],
): DraftState | null {
  try {
    let state = startDraft(rng, figures)
    for (const action of actions) {
      if (state.endedBy) return null
      state = applyAction(state, action)
    }
    return state
  } catch {
    return null
  }
}

/**
 * One wave as the player actually saw it: the six faces on the table, the posts
 * still open, and what they did with it.
 *
 * The draft does not keep this - `DraftState.candidates` is overwritten every
 * wave, because playing the game never needs last wave's table. Measuring the
 * game does: you cannot say whether a call was good without knowing what else
 * was on offer when it was made. Replaying the log re-deals every wave from the
 * same seed, so the tables are recoverable exactly rather than stored.
 */
export interface Deal {
  wave: number
  /** The faces on the table at the moment of the appointment. */
  table: Politician[]
  /** Posts still unfilled, so an alternative call has to be a legal one. */
  open: Role[]
  chosen: Politician
  role: Role
}

/**
 * Replay a log and collect the table standing in front of each appointment.
 *
 * Returns null on exactly the same conditions as replayDraft, so a save that
 * cannot be resumed also cannot be silently half-measured.
 */
export function dealHistory(
  rng: Rng,
  figures: readonly Politician[],
  actions: readonly DraftAction[],
): Deal[] | null {
  try {
    let state = startDraft(rng, figures)
    const deals: Deal[] = []
    for (const action of actions) {
      if (state.endedBy) return null
      if (action.t === 'place') {
        const chosen = state.candidates.find((c) => c.id === action.id)
        if (!chosen) return null
        deals.push({
          wave: state.wave,
          table: state.candidates.slice(),
          open: ROLES.filter((r) => !state.picks[r]),
          chosen,
          role: action.role,
        })
      }
      state = applyAction(state, action)
    }
    return deals
  } catch {
    return null
  }
}
