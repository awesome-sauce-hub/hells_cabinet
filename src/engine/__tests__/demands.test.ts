import { describe, expect, it } from 'vitest'
import { loadEvents } from '../content.js'
import { demandByRole, demandsFor } from '../demands.js'
import { ROLES } from '../types.js'

const events = loadEvents()

describe('demandsFor', () => {
  it('never leaks the complication', () => {
    // The twist is the one thing the player is meant to be unable to prepare
    // for. If it ever reaches the briefing the draft becomes a lookup.
    for (const event of events) {
      const shown = demandsFor(event).map((d) => d.text).join(' ')
      const secret = event.twist.check.note
      if (secret) expect(shown).not.toContain(secret)
    }
  })

  it('says something about every post the crisis tests', () => {
    for (const event of events) {
      const tested = new Set(event.checks.map((c) => c.role))
      const spoken = new Set(demandsFor(event).map((d) => d.role))
      expect([...tested].sort()).toEqual([...spoken].sort())
      for (const d of demandsFor(event)) expect(d.text.length).toBeGreaterThan(0)
    }
  })

  it('reads in cabinet order, so the list lines up with the seats', () => {
    for (const event of events) {
      const order = demandsFor(event).map((d) => ROLES.indexOf(d.role))
      expect(order).toEqual([...order].sort((a, b) => a - b))
    }
  })

  it('marks an inverted demand as the crisis wanting the opposite', () => {
    const inverted = events.flatMap((e) => e.checks.filter((c) => c.invert).map((c) => ({ e, c })))
    expect(inverted.length).toBeGreaterThan(0)
    for (const { e, c } of inverted) {
      expect(demandByRole(e)[c.role]!.text).toContain(`no appetite for ${c.demands}`)
    }
  })
})
