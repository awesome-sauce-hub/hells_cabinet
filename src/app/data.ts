import politiciansJson from '../../content/politicians.json'
import eventsJson from '../../content/events.json'
import { shippable } from '../engine/roster.js'
import type { GameEvent, Politician } from '../engine/types.js'

export const FIGURES: Politician[] = shippable(politiciansJson as Politician[])
export const EVENTS: GameEvent[] = eventsJson as GameEvent[]
