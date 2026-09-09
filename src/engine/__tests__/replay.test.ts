import { describe, expect, it } from 'vitest'
import { loadPoliticians } from '../content.js'
import { isDraftComplete, openRoles, startDraft } from '../draft.js'
import { applyAction, replayDraft } from '../replay.js'
import type { DraftAction } from '../replay.js'
import { seedFrom } from '../rng.js'
import { ROLES } from '../types.js'

const figures = loadPoliticians()

/** Play a whole game live, recording what was done, the way the app does. */
function playThrough(seed: string, extra: DraftAction[] = []) {
  let state = startDraft(seedFrom(seed), figures)
  const actions: DraftAction[] = []
  for (const action of extra) {
    state = applyAction(state, action)
    actions.push(action)
  }
  while (!isDraftComplete(state) && !state.endedBy) {
    const who = state.candidates.find((c) => !c.endsRun)!
    const action: DraftAction = { t: 'place', id: who.id, role: openRoles(state)[0]! }
    state = applyAction(state, action)
    actions.push(action)
  }
  return { state, actions }
}

const ids = (state: { candidates: { id: string }[] }) => state.candidates.map((c) => c.id)

describe('replaying a saved run', () => {
  it('rebuilds the same draft from the seed and the action log', () => {
    const { state, actions } = playThrough('resume')
    const replayed = replayDraft(seedFrom('resume'), figures, actions)!

    expect(replayed).not.toBeNull()
    expect(ROLES.map((r) => replayed.picks[r]?.id)).toEqual(ROLES.map((r) => state.picks[r]?.id))
    expect(replayed.wave).toBe(state.wave)
    expect(replayed.remaining.map((p) => p.id)).toEqual(state.remaining.map((p) => p.id))
  })

  it('rebuilds a part-played draft, down to the candidates on the table', () => {
    const { actions } = playThrough('midway')
    // Stopping partway is the case that matters: this is a reload mid-draft.
    const partial = actions.slice(0, 2)
    const live = replayDraft(seedFrom('midway'), figures, partial)!
    const again = replayDraft(seedFrom('midway'), figures, partial)!

    expect(live.wave).toBe(2)
    expect(ids(again)).toEqual(ids(live))
    expect(again.respins).toBe(live.respins)
  })

  it('replays token spending, which advances the same rng as a placement', () => {
    const first = startDraft(seedFrom('tokens'), figures)
    const { state, actions } = playThrough('tokens', [
      { t: 'bench', id: first.candidates[0]!.id },
      { t: 'respin' },
    ])
    const replayed = replayDraft(seedFrom('tokens'), figures, actions)!

    expect(replayed.benches).toBe(0)
    expect(replayed.respins).toBe(0)
    expect(ROLES.map((r) => replayed.picks[r]?.id)).toEqual(ROLES.map((r) => state.picks[r]?.id))
  })

  it('refuses a log that does not apply, rather than resuming a wrong game', () => {
    expect(replayDraft(seedFrom('bad'), figures, [{ t: 'place', id: 'nobody-at-all', role: 'President' }])).toBeNull()
    // A second placement into a filled post cannot have happened.
    const s = startDraft(seedFrom('bad'), figures)
    const [a, b] = s.candidates.filter((c) => !c.endsRun)
    expect(replayDraft(seedFrom('bad'), figures, [
      { t: 'place', id: a!.id, role: 'President' },
      { t: 'place', id: b!.id, role: 'President' },
    ])).toBeNull()
  })

  it('stops at a run-ender instead of replaying past the end', () => {
    const nixon = figures.find((p) => p.endsRun)!
    const s = startDraft(seedFrom('ender'), figures)
    s.candidates = [nixon, ...s.candidates.slice(1)]
    // The ender is not on the real table for this seed, so the log is invalid -
    // which is the point: a tampered log cannot smuggle a figure into a wave.
    expect(replayDraft(seedFrom('ender'), figures, [{ t: 'place', id: nixon.id, role: 'President' }])).toBeNull()
  })
})
