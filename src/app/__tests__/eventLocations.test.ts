import { describe, expect, it } from 'vitest'
import events from '../../../content/events.json'
import { EVENT_LOCATIONS, MAP_HEIGHT, MAP_WIDTH, mapFrame, mapPoint } from '../eventLocations.js'

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

  it('frames every local event on where it happened, without running off the map', () => {
    for (const event of events) {
      const location = EVENT_LOCATIONS[event.id]!
      const [x, y, width, height] = mapFrame(location).viewBox.split(' ').map(Number) as number[]

      expect(x, event.id).toBeGreaterThanOrEqual(0)
      expect(y, event.id).toBeGreaterThanOrEqual(0)
      expect(x! + width!, event.id).toBeLessThanOrEqual(MAP_WIDTH + 0.01)
      expect(y! + height!, event.id).toBeLessThanOrEqual(MAP_HEIGHT + 0.01)
      // The frame keeps the illustration's aspect ratio, so it still fills its plate.
      expect(width! / height!, event.id).toBeCloseTo(MAP_WIDTH / MAP_HEIGHT, 2)

      if (location.scope === 'local') {
        // Zoomed in, and every marked point is inside the frame.
        expect(width, event.id).toBeLessThan(MAP_WIDTH)
        for (const point of location.points) {
          const { x: px, y: py } = mapPoint(point)
          expect(px, event.id).toBeGreaterThanOrEqual(x!)
          expect(px, event.id).toBeLessThanOrEqual(x! + width!)
          expect(py, event.id).toBeGreaterThanOrEqual(y!)
          expect(py, event.id).toBeLessThanOrEqual(y! + height!)
        }
      }
    }
  })

  it('keeps the whole world for events that have no single place', () => {
    // Zooming in on one of these circles would claim an origin the content refuses to claim.
    for (const id of ['the-influenza-winter', 'the-2008-crash']) {
      expect(mapFrame(EVENT_LOCATIONS[id]).viewBox, id).toBe(`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`)
    }
    expect(mapFrame(undefined).viewBox).toBe(`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`)
  })

  it('does not present the influenza pandemic as a single local outbreak', () => {
    const location = EVENT_LOCATIONS['the-influenza-winter']!
    expect(location.scope).toBe('global')
    expect(location.points.length).toBeGreaterThan(1)
    expect(location.note).toContain('not an origin')
  })
})
