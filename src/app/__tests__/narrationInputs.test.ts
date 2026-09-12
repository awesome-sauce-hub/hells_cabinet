import { describe, expect, it } from 'vitest'
import { narrationRequest } from '../narrateRemote.js'
import { resolveEvent } from '../../engine/resolve.js'
import { loadEvents, loadPoliticians } from '../../engine/content.js'
import { ROLES } from '../../engine/types.js'
import type { Roster } from '../../engine/types.js'

const events = loadEvents()
const figures = loadPoliticians()

/** Six distinct figures, deterministically, so the request has real content in it. */
const rosterAt = (offset: number): Roster =>
  Object.fromEntries(ROLES.map((r, i) => [r, figures[(offset + i * 17) % figures.length]!])) as Roster

describe('what the adjudicator is allowed to see', () => {
  /**
   * The bio is the only description the adjudicator gets, and that is
   * load-bearing rather than incidental: every balance figure in the project
   * was measured against it. The educational content added alongside it -
   * a figure's real record, a crisis's aftermath and lesson, the reason a post
   * mattered - is for the player after the run and must never reach the
   * prompt, or it silently becomes a second description and changes every
   * judgement the game has ever been calibrated on.
   */
  it('never sends a figure’s real record, only the bio', () => {
    const withRecord = figures.filter((f) => f.record)
    for (const event of events.slice(0, 3)) {
      for (let i = 0; i < 5; i++) {
        const request = narrationRequest(resolveEvent(event, rosterAt(i)))
        const json = JSON.stringify(request)
        for (const f of withRecord) expect(json).not.toContain(f.record)
        for (const a of request.cabinet) {
          expect(a).not.toHaveProperty('record')
        }
      }
    }
  })

  it('never sends a crisis’s aftermath, lesson, or the reason a post mattered', () => {
    for (const event of events) {
      const json = JSON.stringify(narrationRequest(resolveEvent(event, rosterAt(3))))
      if (event.aftermath) expect(json).not.toContain(event.aftermath)
      if (event.lesson) expect(json).not.toContain(event.lesson)
      for (const c of event.checks) if (c.why) expect(json).not.toContain(c.why)
    }
  })

  it('still sends the bio, the traits and the demand note', () => {
    // The negative assertions above pass trivially if the request is empty.
    const event = events[0]!
    const request = narrationRequest(resolveEvent(event, rosterAt(2)))
    const json = JSON.stringify(request)
    expect(request.cabinet).toHaveLength(ROLES.length)
    for (const a of request.cabinet) expect(a.bio.length).toBeGreaterThan(0)
    for (const c of event.checks) if (c.note) expect(json).toContain(c.note)
  })
})
