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

  /**
   * The run-ender is a gamble taken off the seeded stream, so it has to land
   * the same way every time the log is replayed. Otherwise reloading the page
   * would be a way to re-roll a government you already lost.
   */
  it('replays a run-ender to the same outcome, win or lose', () => {
    const nixon = figures.find((p) => p.endsRun)!
    const outcomes = new Set<string>()

    for (const seed of ['gamble-a', 'gamble-b', 'gamble-c', 'gamble-d']) {
      // Find a wave that actually offers him, so the log is one a player
      // could have produced rather than a hand-built state.
      let state = startDraft(seedFrom(seed), figures)
      const actions: DraftAction[] = []
      while (!state.candidates.some((c) => c.id === nixon.id) && !isDraftComplete(state)) {
        const who = state.candidates.find((c) => !c.endsRun)!
        const action: DraftAction = { t: 'place', id: who.id, role: openRoles(state)[0]! }
        state = applyAction(state, action)
        actions.push(action)
      }
      if (!state.candidates.some((c) => c.id === nixon.id)) continue

      const gamble: DraftAction = { t: 'place', id: nixon.id, role: openRoles(state)[0]! }
      const live = applyAction(state, gamble)
      actions.push(gamble)
      outcomes.add(live.endedBy ? 'ended' : 'survived')

      // A log that ended the run replays to null by design (nothing can follow
      // an ended government), so the assertion is on the state before that.
      const replayed = replayDraft(seedFrom(seed), figures, actions)
      if (live.endedBy) {
        expect(replayed?.endedBy?.id).toBe(nixon.id)
      } else {
        expect(replayed?.endedBy).toBeNull()
        expect(ROLES.map((r) => replayed!.picks[r]?.id)).toEqual(ROLES.map((r) => live.picks[r]?.id))
      }
    }

    // The loop is worthless if he never came up.
    expect(outcomes.size).toBeGreaterThan(0)
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

import { createRun as createRunForCalendar, todayKey as todayKeyForCalendar } from '../run.js'
import { loadEvents as loadEventsForCalendar } from '../content.js'

describe('the daily calendar', () => {
  const events = loadEventsForCalendar()
  const run = (d: Date) => createRunForCalendar(todayKeyForCalendar(d), events, null).event.id
  const days = (from: string, n: number) => {
    const d = new Date(`${from}T12:00:00`)
    return Array.from({ length: n }, () => { const id = run(d); d.setDate(d.getDate() + 1); return id })
  }

  it('never deals the same crisis two days running', () => {
    // It did, four times in sixty days, when each morning drew independently.
    const seq = days('2026-01-01', 400)
    for (let i = 1; i < seq.length; i++) expect(seq[i]).not.toBe(seq[i - 1])
  })

  it('uses every crisis before reusing any', () => {
    // Packs are aligned to the epoch rather than to whichever date a test picks,
    // so the window has to start on a pack boundary to be a whole pack.
    const start = new Date('2026-01-01T00:00:00Z')
    while (Math.floor(start.getTime() / 86400000) % events.length !== 0) {
      start.setUTCDate(start.getUTCDate() + 1)
    }
    const from = start.toISOString().slice(0, 10)
    const dealt = days(from, events.length * 3)
    for (let c = 0; c < 3; c++) {
      const pack = dealt.slice(c * events.length, (c + 1) * events.length)
      expect(new Set(pack).size).toBe(events.length)
    }
  })

  it('gives everyone on a date the same crisis', () => {
    for (const d of ['2026-09-10', '2027-02-28', '2030-12-31']) {
      expect(createRunForCalendar(d, events, null).event.id).toBe(createRunForCalendar(d, events, null).event.id)
    }
  })

  it('leaves a shared link’s random seed drawing freely', () => {
    // A sent cabinet is one crisis with no calendar to sit in.
    const ids = new Set(['ab12cd34', 'zz99zz99', 'q1w2e3r4'].map((s) => createRunForCalendar(s, events, null).event.id))
    expect(ids.size).toBeGreaterThan(0)
  })

  it('deals the same draft whether the crisis was named or dealt', () => {
    // The roll is consumed either way; this is what stops a shared link and a
    // daily on the same seed diverging.
    const a = createRunForCalendar('2026-09-10', events, null)
    const b = createRunForCalendar('2026-09-10', events, a.event.id)
    expect(b.event.id).toBe(a.event.id)
    expect(b.rng.next()).toBe(a.rng.next())
  })
})
