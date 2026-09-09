import { describe, expect, it } from 'vitest'
import { loadEvents, loadPoliticians } from '../content.js'
import { randomDraft, startDraft } from '../draft.js'
import { dailySeed, mulberry32, seedFrom, shuffle } from '../rng.js'
import { resolveEvent } from '../resolve.js'
import { createRun } from '../run.js'
import { ROLES } from '../types.js'

const politicians = loadPoliticians()
const events = loadEvents()

/**
 * The daily mode, the share grid and the balance harness all assume a seed
 * fully determines a run. If this ever fails, every one of them is wrong.
 */
describe('determinism', () => {
  it('produces identical drafts and resolutions for the same seed', () => {
    for (let seed = 0; seed < 1000; seed++) {
      const event = events[seed % events.length]!
      const a = resolveEvent(event, randomDraft(mulberry32(seed), politicians))
      const b = resolveEvent(event, randomDraft(mulberry32(seed), politicians))
      expect(a.score).toBe(b.score)
      expect(a.grid).toBe(b.grid)
      expect(a.verdicts).toEqual(b.verdicts)
    }
  })

  it('produces different drafts for different seeds', () => {
    const grids = new Set(
      Array.from({ length: 200 }, (_, i) =>
        randomDraft(mulberry32(i), politicians).President.id,
      ),
    )
    expect(grids.size).toBeGreaterThan(1)
  })

  it('derives a stable seed from a date', () => {
    expect(dailySeed('2026-09-08')).toBe(dailySeed('2026-09-08'))
    expect(dailySeed('2026-09-08')).not.toBe(dailySeed('2026-09-09'))
  })

  it('shuffles without losing or duplicating elements', () => {
    const input = Array.from({ length: 50 }, (_, i) => i)
    const out = shuffle(seedFrom('shuffle'), input)
    expect(out.slice().sort((a, b) => a - b)).toEqual(input)
  })

  it('deals the same candidates whether the crisis was drawn or chosen', () => {
    // createRun consumes one roll to draw the event, and the draft continues
    // that same rng. Skipping the roll when the event is chosen would give the
    // same seed different pools, and would change every past daily puzzle.
    for (const seed of ['2026-09-09', 'abc123', 'x']) {
      const drawn = createRun(seed, events)
      for (const event of events) {
        const chosen = createRun(seed, events, event.id)
        expect(chosen.event.id, seed).toBe(event.id)
        expect(startDraft(chosen.rng, politicians).candidates.map((c) => c.id), seed)
          .toEqual(startDraft(createRun(seed, events).rng, politicians).candidates.map((c) => c.id))
      }
      // An unknown id falls back to the drawn crisis rather than crashing.
      expect(createRun(seed, events, 'no-such-event').event.id).toBe(drawn.event.id)
      expect(createRun(seed, events, null).event.id).toBe(drawn.event.id)
    }
  })

  it('never leaves a role unfilled or a politician double-drafted', () => {
    for (let seed = 0; seed < 200; seed++) {
      const roster = randomDraft(mulberry32(seed), politicians)
      const ids = ROLES.map((r) => roster[r].id)
      expect(ids.filter(Boolean)).toHaveLength(ROLES.length)
      expect(new Set(ids).size).toBe(ROLES.length)
    }
  })
})
