import { describe, expect, it } from 'vitest'
import { loadEvents, loadPoliticians } from '../content.js'
import { isDraftComplete, openRoles, startDraft } from '../draft.js'
import { applyAction, dealHistory } from '../replay.js'
import type { Deal, DraftAction } from '../replay.js'
import { seedFrom } from '../rng.js'
import { rate, gradeFor } from '../rating.js'
import { breakdown, scoreFrom } from '../verdict.js'
import { resolveEvent } from '../resolve.js'
import { chemistry } from '../score.js'
import { ROLES } from '../types.js'
import type { Politician, Roster } from '../types.js'

const figures = loadPoliticians()
const events = loadEvents()

/** Play a whole game live, recording what was done, the way the app does. */
function playThrough(seed: string) {
  let state = startDraft(seedFrom(seed), figures)
  const actions: DraftAction[] = []
  while (!isDraftComplete(state) && !state.endedBy) {
    const who = state.candidates.find((c) => !c.endsRun)
    if (!who) break
    const action: DraftAction = { t: 'place', id: who.id, role: openRoles(state)[0]! }
    state = applyAction(state, action)
    actions.push(action)
  }
  if (!isDraftComplete(state)) return null
  const deals = dealHistory(seedFrom(seed), figures, actions)
  if (!deals) return null
  const roster = Object.fromEntries(ROLES.map((r) => [r, state.picks[r]!])) as Roster
  return { roster, actions, deals }
}

/** Every seed that produces a complete draft, so the assertions have volume. */
function playable(count: number) {
  const runs: { seed: string; roster: Roster; actions: DraftAction[]; deals: Deal[] }[] = []
  for (let i = 0; runs.length < count && i < count * 4; i++) {
    const seed = `rating-${i}`
    const played = playThrough(seed)
    if (played) runs.push({ seed, ...played })
  }
  return runs
}

describe('rating a run against the cards it was dealt', () => {
  it('never rates a cabinet above the best one available', () => {
    // Par is a maximum over every legal assignment, so nothing the player can
    // actually build may exceed it. This is the property the whole measure
    // rests on: a rating over 100% would mean par was computed wrong.
    for (const event of events) {
      for (const run of playable(6)) {
        const r = rate(event, run.roster, run.deals)
        if (!r) continue
        expect(r.yours).toBeLessThanOrEqual(r.par + 1e-9)
        expect(r.rating).toBeGreaterThanOrEqual(0)
        expect(r.rating).toBeLessThanOrEqual(1)
      }
    }
  })

  it('does not assume the player beat blind picking', () => {
    // Floor is the mean of picking at random, not a minimum. A cabinet can be
    // worse than random - that is what the bottom grade is for - so the rating
    // clamps rather than pretending it cannot happen.
    const run = playable(1)[0]!
    const r = rate(events[0]!, run.roster, run.deals)
    expect(r === null || typeof r.floor === 'number').toBe(true)
  })

  it('rates the best cabinet in the deal at the top', () => {
    // Tables of one leave exactly one legal cabinet per assignment, so the
    // optimum is computable by hand here: taking it must rate 100%.
    const event = events[0]!
    const six = figures.filter((f) => f.category === 'politician').slice(0, 6)
    const deals: Deal[] = six.map((p, wave) => ({
      wave, table: [p], open: ROLES.slice(wave), chosen: p, role: ROLES[wave]!,
    }))

    let best: { roster: Roster; score: number } | null = null
    for (const order of permutations(ROLES)) {
      const roster = Object.fromEntries(order.map((r, i) => [r, six[i]!])) as Roster
      const scored = rate(event, roster, deals.map((d, i) => ({ ...d, role: order[i]!, chosen: six[i]! })))
      if (scored && (!best || scored.yours > best.score)) best = { roster, score: scored.yours }
    }

    const winner = rate(event, best!.roster, deals.map((d, i) => ({
      ...d, role: ROLES.find((r) => best!.roster[r]!.id === six[i]!.id)!, chosen: six[i]!,
    })))
    expect(winner!.rating).toBeCloseTo(1, 5)
    expect(winner!.grade).toBe('Nothing Better Was There')
  })

  it('is deterministic, and identical when the run is replayed', () => {
    const event = events[2]!
    const run = playable(1)[0]!
    const replayed = dealHistory(seedFrom(run.seed), figures, run.actions)!
    expect(rate(event, run.roster, replayed)).toEqual(rate(event, run.roster, run.deals))
  })

  it('never grades the post the complication landed on', () => {
    // The sealing invariant, extended from the briefing to the scoring: a post
    // whose only demand was withheld cannot be evidence about judgement.
    for (const event of events) {
      const twistRole = event.twist.check.role
      const known = event.checks.filter((c) => c.role === twistRole)
      for (const run of playable(3)) {
        const r = rate(event, run.roster, run.deals)
        if (!r || known.length > 0) continue
        expect(r.missed.some((m) => m.role === twistRole)).toBe(false)
      }
    }
  })

  it('only reports a missed call worth a whole verdict word, and at most two', () => {
    for (const event of events) {
      for (const run of playable(4)) {
        const r = rate(event, run.roster, run.deals)
        if (!r) continue
        expect(r.missed.length).toBeLessThanOrEqual(2)
        for (const m of r.missed) {
          expect(m.steps).toBeGreaterThanOrEqual(1)
          expect(m.better.id).not.toBe(m.chosen.id)
        }
      }
    }
  })

  it('orders the grades', () => {
    const grades = [0, 0.4, 0.7, 0.85, 1].map(gradeFor)
    expect(new Set(grades).size).toBe(5)
    expect(grades[4]).toBe('Nothing Better Was There')
    expect(grades[0]).toBe('Negligent')
  })
})

describe('showing the arithmetic', () => {
  it('adds up to the score it decomposes', () => {
    // The panel is only trustworthy if the numbers on it sum to the number at
    // the top, chemistry included.
    for (const event of events) {
      const run = playable(1)[0]!
      const resolution = resolveEvent(event, run.roster)
      const chem = chemistry(run.roster).total
      const b = breakdown(resolution.verdicts, event.twist.check.role, chem)
      const earned = b.posts.reduce((s, p) => s + p.earned, 0)
      expect(earned + chem).toBeCloseTo(scoreFrom(resolution.verdicts, chem), 6)
      expect(b.total).toBeCloseTo(resolution.score, 6)
    }
  })

  it('shows every post carrying the weight the event authored', () => {
    const event = events[0]!
    const run = playable(1)[0]!
    const b = breakdown(resolveEvent(event, run.roster).verdicts, event.twist.check.role)
    expect(b.posts.reduce((s, p) => s + p.available, 0)).toBeCloseTo(100, 6)
    expect(b.posts.filter((p) => p.isTwist)).toHaveLength(1)
  })
})

function* permutations<T>(items: readonly T[]): Generator<T[]> {
  if (items.length <= 1) return yield items.slice()
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)]
    for (const p of permutations(rest)) yield [items[i]!, ...p]
  }
}
