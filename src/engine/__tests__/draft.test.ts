import { describe, expect, it } from 'vitest'
import { loadPoliticians } from '../content.js'
import {
  bench,
  finishDraft,
  isDraftComplete,
  openRoles,
  placeCandidate,
  respin,
  startDraft,
} from '../draft.js'
import { seedFrom } from '../rng.js'
import { ROLES } from '../types.js'

const figures = loadPoliticians()

describe('wave draft', () => {
  it('deals six candidates and offers every post', () => {
    const s = startDraft(seedFrom('a'), figures)
    expect(s.candidates).toHaveLength(6)
    expect(openRoles(s)).toEqual([...ROLES])
  })

  it('places a candidate in the post the player chose, not a fixed order', () => {
    const s = startDraft(seedFrom('b'), figures)
    const who = s.candidates.find((c) => !c.endsRun)!
    const next = placeCandidate(s, who.id, 'Treasurer')
    expect(next.picks.Treasurer?.id).toBe(who.id)
    expect(next.picks.President).toBeUndefined()
    expect(openRoles(next)).not.toContain('Treasurer')
  })

  it('advances a wave and retires everyone who was on the table', () => {
    const s = startDraft(seedFrom('c'), figures)
    const shown = s.candidates.map((c) => c.id)
    const who = s.candidates.find((c) => !c.endsRun)!
    const next = placeCandidate(s, who.id, 'General')
    expect(next.wave).toBe(1)
    // Declining a card costs it: the whole wave leaves, taken or not.
    for (const id of shown) expect(next.remaining.some((p) => p.id === id)).toBe(false)
    expect(next.candidates).toHaveLength(6)
  })

  it('refuses a post that is already filled', () => {
    const s = startDraft(seedFrom('d'), figures)
    const first = s.candidates.find((c) => !c.endsRun)!
    const next = placeCandidate(s, first.id, 'President')
    const second = next.candidates.find((c) => !c.endsRun)!
    expect(() => placeCandidate(next, second.id, 'President')).toThrow(/already filled/)
  })

  it('refuses a figure who is not on the table this wave', () => {
    const s = startDraft(seedFrom('e'), figures)
    const shown = new Set(s.candidates.map((c) => c.id))
    const absent = figures.find((p) => !shown.has(p.id))!
    expect(() => placeCandidate(s, absent.id, 'President')).toThrow(/not on offer/)
  })

  it('completes after five placements, one per wave', () => {
    let s = startDraft(seedFrom('f'), figures)
    for (const role of ROLES) {
      expect(isDraftComplete(s)).toBe(false)
      const who = s.candidates.find((c) => !c.endsRun)!
      s = placeCandidate(s, who.id, role)
    }
    expect(isDraftComplete(s)).toBe(true)
    expect(s.wave).toBe(ROLES.length)
    const roster = finishDraft(s)
    expect(new Set(ROLES.map((r) => roster[r].id)).size).toBe(ROLES.length)
  })

  it('never offers a benched figure again for the rest of the run', () => {
    let s = startDraft(seedFrom('bench'), figures)
    const dismissed = s.candidates[0]!
    s = bench(s, dismissed.id)

    expect(s.benches).toBe(0)
    expect(s.candidates).toHaveLength(6)
    expect(s.candidates.some((c) => c.id === dismissed.id)).toBe(false)
    expect(s.remaining.some((p) => p.id === dismissed.id)).toBe(false)

    // The reprieve has to outlast this wave, which is where it used to fail.
    while (!isDraftComplete(s) && !s.endedBy) {
      expect(s.candidates.some((c) => c.id === dismissed.id), `wave ${s.wave}`).toBe(false)
      const who = s.candidates.find((c) => !c.endsRun)!
      s = placeCandidate(s, who.id, openRoles(s)[0]!)
    }
  })

  it('never offers a reshuffled figure again for the rest of the run', () => {
    let s = startDraft(seedFrom('respin'), figures)
    const rejected = s.candidates.map((c) => c.id)
    s = respin(s)

    expect(s.respins).toBe(0)
    expect(s.candidates).toHaveLength(6)
    // A reshuffle that can hand back most of the same board buys nothing.
    for (const id of rejected) expect(s.candidates.some((c) => c.id === id)).toBe(false)

    while (!isDraftComplete(s) && !s.endedBy) {
      for (const id of rejected) expect(s.candidates.some((c) => c.id === id), `wave ${s.wave}`).toBe(false)
      const who = s.candidates.find((c) => !c.endsRun)!
      s = placeCandidate(s, who.id, openRoles(s)[0]!)
    }
  })

  it('reproduces the reported bench-then-reshuffle case without the figure returning', () => {
    // From docs/REVIEW.md: bench someone, reshuffle, appoint, and they were
    // offered again in the next wave.
    let s = startDraft(seedFrom('2026-09-09'), figures)
    const dismissed = s.candidates[0]!
    s = bench(s, dismissed.id)
    const rejected = s.candidates.map((c) => c.id)
    s = respin(s)
    const who = s.candidates.find((c) => !c.endsRun)!
    s = placeCandidate(s, who.id, 'President')

    for (const id of [dismissed.id, ...rejected]) {
      expect(s.candidates.some((c) => c.id === id), id).toBe(false)
      expect(s.remaining.some((p) => p.id === id), id).toBe(false)
    }
  })

  it('still has enough figures left to finish after spending both tokens', () => {
    let s = startDraft(seedFrom('tokens'), figures)
    s = bench(s, s.candidates[0]!.id)
    s = respin(s)
    while (!isDraftComplete(s) && !s.endedBy) {
      expect(s.candidates, `wave ${s.wave}`).toHaveLength(6)
      const who = s.candidates.find((c) => !c.endsRun)!
      s = placeCandidate(s, who.id, openRoles(s)[0]!)
    }
    expect(isDraftComplete(s) || s.endedBy).toBeTruthy()
  })

  it('ends the run immediately when a certain run-ender is appointed', () => {
    const s = startDraft(seedFrom('g'), figures)
    const certain = { ...figures.find((p) => p.endsRun)!, endsRunChance: undefined }
    s.candidates = [certain, ...s.candidates.slice(1)]
    const next = placeCandidate(s, certain.id, 'VicePresident')
    expect(next.endedBy?.id).toBe(certain.id)
    expect(next.candidates).toHaveLength(0)
    expect(next.wave).toBe(0)
  })

  /**
   * The odds are the whole point of the card, so they are pinned by a test
   * rather than left to whoever reads the JSON next.
   */
  it('ends the run about a tenth of the time at a tenth chance', () => {
    const ender = { ...figures.find((p) => p.endsRun)!, endsRunChance: 0.1 }
    let ended = 0
    for (let i = 0; i < 400; i++) {
      const s = startDraft(seedFrom(`odds-${i}`), figures)
      s.candidates = [ender, ...s.candidates.slice(1)]
      if (placeCandidate(s, ender.id, 'President').endedBy) ended += 1
    }
    // Wide enough that the seeds cannot make it flaky, narrow enough that a
    // certainty or a coin flip would fail it.
    expect(ended / 400).toBeGreaterThan(0.04)
    expect(ended / 400).toBeLessThan(0.18)
  })

  it('carries on as an ordinary appointment when the run-ender survives', () => {
    const ender = { ...figures.find((p) => p.endsRun)!, endsRunChance: 0 }
    const s = startDraft(seedFrom('survives'), figures)
    s.candidates = [ender, ...s.candidates.slice(1)]
    const next = placeCandidate(s, ender.id, 'General')
    expect(next.endedBy).toBeNull()
    expect(next.picks.General?.id).toBe(ender.id)
    expect(next.wave).toBe(1)
    expect(next.candidates).toHaveLength(6)
  })
})
