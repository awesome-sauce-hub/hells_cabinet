import { describe, expect, it } from 'vitest'
import { loadPoliticians } from '../content.js'
import {
  finishDraft,
  isDraftComplete,
  openRoles,
  placeCandidate,
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

  it('ends the run immediately when a run-ender is appointed', () => {
    const s = startDraft(seedFrom('g'), figures)
    const nixon = figures.find((p) => p.endsRun)!
    s.candidates = [nixon, ...s.candidates.slice(1)]
    const next = placeCandidate(s, nixon.id, 'VicePresident')
    expect(next.endedBy?.id).toBe(nixon.id)
    expect(next.candidates).toHaveLength(0)
    expect(next.wave).toBe(0)
  })
})
