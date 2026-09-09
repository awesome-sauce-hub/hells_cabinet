import { describe, expect, it } from 'vitest'
import events from '../../../content/events.json'
import { EVENT_LOCATIONS, mapPoint } from '../eventLocations.js'

describe('event map coverage', () => {
  it('maps every playable event to a labelled location inside the visible world map', () => {
    for (const event of events) {
      const location = EVENT_LOCATIONS[event.id]
      expect(location, event.id).toBeDefined()
      expect(location!.label.length).toBeGreaterThan(0)
      expect(location!.points.length).toBeGreaterThan(0)
      for (const point of location!.points) {
        const { x, y } = mapPoint(point)
        expect(x).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThanOrEqual(504)
        expect(y).toBeGreaterThanOrEqual(0)
        expect(y).toBeLessThanOrEqual(218)
      }
    }
  })

  it('does not present the influenza pandemic as a single local outbreak', () => {
    const location = EVENT_LOCATIONS['the-influenza-winter']!
    expect(location.scope).toBe('global')
    expect(location.points.length).toBeGreaterThan(1)
    expect(location.note).toContain('not an origin')
  })
})
