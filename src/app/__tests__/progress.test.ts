import { describe, expect, it } from 'vitest'
import { form, loadDossier, recordRun, runKey } from '../progress.js'
import type { Dossier } from '../progress.js'
import { resolveEvent } from '../../engine/resolve.js'
import { loadEvents, loadPoliticians } from '../../engine/content.js'
import { ROLES } from '../../engine/types.js'
import type { Roster } from '../../engine/types.js'
import type { Rating } from '../../engine/rating.js'

const events = loadEvents()
const figures = loadPoliticians()

const rosterAt = (offset: number): Roster =>
  Object.fromEntries(ROLES.map((r, i) => [r, figures[(offset + i * 13) % figures.length]!])) as Roster

const ratingOf = (n: number): Rating =>
  ({ rating: n, grade: 'Defensible', yours: 50, par: 80, floor: 20, missed: [] })

// Storage is absent in this environment, so the fold is driven through the
// injected dossier. That is the same path the app takes, minus the write.
const blank: Dossier = { version: 1, people: {}, ratings: [], crises: {}, runs: 0 }

describe('what the dossier keeps', () => {
  it('counts every appointment and how it turned out', () => {
    const result = resolveEvent(events[0]!, rosterAt(0))
    const d = recordRun(runKey('seed-a', events[0]!.id), result, ratingOf(0.5), blank)

    for (const role of ROLES) {
      expect(d.people[result.roster[role].id]!.appointed).toBeGreaterThan(0)
    }
    const marks = Object.values(d.people).flatMap((p) => Object.values(p.marks))
    expect(marks.reduce((a, b) => a + b, 0)).toBe(result.verdicts.length)
    expect(d.runs).toBe(1)
  })

  it('refuses to count the same run twice', () => {
    // The verdict screen is resumable: a reload there must not re-bank the run,
    // or one cabinet inflates the record of everyone in it.
    const result = resolveEvent(events[1]!, rosterAt(4))
    const key = runKey('seed-b', events[1]!.id)
    const once = recordRun(key, result, ratingOf(0.9), blank)
    const twice = recordRun(key, result, ratingOf(0.9), once)
    expect(twice).toEqual(once)
    expect(twice.runs).toBe(1)
    expect(twice.ratings).toHaveLength(1)
  })

  it('counts a genuinely different run', () => {
    const result = resolveEvent(events[1]!, rosterAt(4))
    const first = recordRun(runKey('seed-b', events[1]!.id), result, ratingOf(0.9), blank)
    const second = recordRun(runKey('seed-c', events[1]!.id), result, ratingOf(0.3), first)
    expect(second.runs).toBe(2)
    expect(second.ratings).toEqual([0.3, 0.9])
  })

  it('keeps the best rating per crisis, not the latest', () => {
    const event = events[2]!
    const result = resolveEvent(event, rosterAt(7))
    let d = recordRun(runKey('s1', event.id), result, ratingOf(0.8), blank)
    d = recordRun(runKey('s2', event.id), result, ratingOf(0.2), d)
    expect(d.crises[event.id]).toBe(0.8)
  })

  it('keeps only the last ten ratings, newest first', () => {
    let d = blank
    for (let i = 0; i < 14; i++) {
      d = recordRun(runKey(`s${i}`, events[0]!.id), resolveEvent(events[0]!, rosterAt(i)), ratingOf(i / 100), d)
    }
    expect(d.ratings).toHaveLength(10)
    expect(d.ratings[0]).toBeCloseTo(0.13, 5)
    expect(d.runs).toBe(14)
  })

  it('still records who was appointed when the run cannot be rated', () => {
    const result = resolveEvent(events[3]!, rosterAt(2))
    const d = recordRun(runKey('s', events[3]!.id), result, null, blank)
    expect(Object.keys(d.people).length).toBeGreaterThan(0)
    expect(d.ratings).toHaveLength(0)
    expect(d.crises).toEqual({})
  })

  it('averages the window, and has no form before there is one', () => {
    expect(form(blank)).toBeNull()
    expect(form({ ...blank, ratings: [1, 0.5, 0] })).toBeCloseTo(0.5, 6)
  })

  it('returns an empty dossier rather than throwing where storage is absent', () => {
    // Private modes and blocked storage are the normal case here, not an edge.
    expect(loadDossier()).toEqual({ version: 1, people: {}, ratings: [], crises: {}, runs: 0 })
  })
})
