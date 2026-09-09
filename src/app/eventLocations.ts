export interface EventLocation {
  label: string
  scope: 'local' | 'global'
  note?: string
  /** Representative affected locations, in [longitude, latitude] order. */
  points: readonly (readonly [number, number])[]
}

/** Approximate locations for the historical scenarios; circles do not claim origins or borders. */
export const EVENT_LOCATIONS: Record<string, EventLocation> = {
  'cuban-missile-crisis': { label: 'Cuba', scope: 'local', points: [[-79.5, 22]] },
  'the-2008-crash': { label: 'New York, United States', scope: 'global', note: 'Financial epicentre · worldwide impact', points: [[-74, 40.7]] },
  'the-hotel-break-in': { label: 'Washington, D.C., United States', scope: 'local', points: [[-77.05, 38.9]] },
  'the-influenza-winter': { label: 'Worldwide', scope: 'global', note: 'Circles mark affected regions, not an origin', points: [[-100, 38], [-60, -15], [10, 50], [20, 0], [95, 30], [135, -25]] },
  'the-canal': { label: 'Suez Canal, Egypt', scope: 'local', points: [[32.3, 30.6]] },
  'the-general-strike': { label: 'Great Britain', scope: 'local', points: [[-2, 54]] },
  'reactor-four': { label: 'Chernobyl, Ukrainian SSR', scope: 'local', points: [[30.1, 51.4]] },
  'the-gas-leak': { label: 'Bhopal, India', scope: 'local', points: [[77.4, 23.3]] },
  'the-levees': { label: 'New Orleans, United States', scope: 'local', points: [[-90.1, 30]] },
  'the-hungry-forties': { label: 'Ireland', scope: 'local', points: [[-8, 53.4]] },
}

/** Matches the equirectangular land illustration's 504 × 218 viewBox. */
export const MAP_WIDTH = 504
export const MAP_HEIGHT = 218

export function mapPoint([longitude, latitude]: readonly [number, number]) {
  return { x: (longitude + 180) * 1.4, y: (84 - latitude) * 1.4 }
}

/**
 * How much of the world a local event is framed against, in map units. The
 * whole world is 504 wide, so this is a little under a third of it: close
 * enough that Suez is recognisably Suez, wide enough that the surrounding
 * continents still say where in the world you are.
 */
const LOCAL_SPAN = 150
/** Breathing room around a multi-point bounding box, as a share of its size. */
const PADDING = 0.6

export interface MapFrame {
  /** Ready for an svg viewBox attribute. */
  viewBox: string
  /**
   * Multiply marker geometry by this to cancel out the zoom, so a pin drawn
   * on a close frame is the same size on screen as one drawn on the world.
   */
  markerScale: number
}

/**
 * Frame the map on where the event happened. Global events keep the whole
 * world - the 1918 winter and the 2008 crash are not places you can point at,
 * and zooming in on one of their circles would claim an origin the content
 * deliberately refuses to claim.
 *
 * The frame keeps the map's own aspect ratio so the illustration still fills
 * its plate, and is clamped to the map's bounds so a corner of the world
 * cannot be framed against empty space.
 */
export function mapFrame(location: EventLocation | undefined): MapFrame {
  const whole = { viewBox: `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`, markerScale: 1 }
  if (!location || location.scope === 'global') return whole

  const points = location.points.map(mapPoint)
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const spread = Math.max(
    Math.max(...xs) - Math.min(...xs),
    (Math.max(...ys) - Math.min(...ys)) * (MAP_WIDTH / MAP_HEIGHT),
  )

  const width = Math.min(Math.max(LOCAL_SPAN, spread * (1 + PADDING)), MAP_WIDTH)
  const height = width * (MAP_HEIGHT / MAP_WIDTH)
  const centreX = (Math.min(...xs) + Math.max(...xs)) / 2
  const centreY = (Math.min(...ys) + Math.max(...ys)) / 2

  return {
    viewBox: [
      clamp(centreX - width / 2, 0, MAP_WIDTH - width),
      clamp(centreY - height / 2, 0, MAP_HEIGHT - height),
      width,
      height,
    ]
      .map((n) => Math.round(n * 100) / 100)
      .join(' '),
    markerScale: width / MAP_WIDTH,
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi)
}
