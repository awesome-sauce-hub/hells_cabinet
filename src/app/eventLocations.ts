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
export function mapPoint([longitude, latitude]: readonly [number, number]) {
  return { x: (longitude + 180) * 1.4, y: (84 - latitude) * 1.4 }
}
