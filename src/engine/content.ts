import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { GameEvent, Politician } from './types.js'
import { shippable } from './roster.js'

const here = dirname(fileURLToPath(import.meta.url))
const contentDir = join(here, '..', '..', 'content')

function load<T>(file: string): T {
  return JSON.parse(readFileSync(join(contentDir, file), 'utf8')) as T
}

/** Only reviewed entries ever reach the game. See the ingest pipeline. */
export function loadPoliticians(): Politician[] {
  return shippable(load<Politician[]>('politicians.json'))
}

export function loadEvents(): GameEvent[] {
  return load<GameEvent[]>('events.json')
}
