import { bench, placeCandidate, respin, startDraft } from './draft.js'
import type { DraftState } from './draft.js'
import type { Rng } from './rng.js'
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
