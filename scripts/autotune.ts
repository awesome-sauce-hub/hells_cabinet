/**
 * Suggest a per-event DC offset.
 *
 * Free post placement plus a 122-figure roster means a perfect read can find a
 * near-ideal occupant for every check, so events authored against the old
 * fixed-role draft now top out too high. Rather than hand-adjust fifty numbers,
 * this shifts every dc in an event by the same amount and reports what that
 * does to the ceiling and to ordinary play, then picks the shift landing
 * closest to the target ceiling.
 *
 * Offsets are a starting point, not the answer: a check that is meant to be
 * trivial or brutal still wants its own value afterwards.
 *
 *   npm run autotune -- [targetCeiling] [restarts]
 */
import { loadEvents, loadPoliticians } from '../src/engine/content.js'
import { randomDraft } from '../src/engine/draft.js'
import { mulberry32, shuffle } from '../src/engine/rng.js'
import { resolveEvent } from '../src/engine/resolve.js'
import { ROLES } from '../src/engine/types.js'
import type { Check, GameEvent, Roster } from '../src/engine/types.js'

const TARGET = Number(process.argv[2] ?? 88)
const RESTARTS = Number(process.argv[3] ?? 18)
const OFFSETS = [0, 2, 4, 6, 8, 10, 12]
const RUNS = 1200

const figures = loadPoliticians()
const playable = figures.filter((p) => !p.endsRun)

function shift(event: GameEvent, by: number): GameEvent {
  const move = (c: Check): Check => ({ ...c, dc: Math.max(0, Math.min(100, c.dc + by)) })
  return {
    ...event,
    checks: event.checks.map(move),
    twist: { ...event.twist, check: move(event.twist.check) },
  }
}

function ceiling(event: GameEvent): number {
  let best = -1
  for (let seed = 0; seed < RESTARTS; seed++) {
    const rng = mulberry32(seed)
    const start = shuffle(rng, playable).slice(0, ROLES.length)
    const roster = Object.fromEntries(ROLES.map((r, i) => [r, start[i]!])) as Roster
    let score = resolveEvent(event, roster).score
    let improved = true
    while (improved) {
      improved = false
      for (const role of ROLES) {
        for (const candidate of playable) {
          const held = roster[role]
          if (ROLES.some((r) => roster[r].id === candidate.id)) continue
          roster[role] = candidate
          const next = resolveEvent(event, roster).score
          if (next > score) {
            score = next
            improved = true
          } else {
            roster[role] = held
          }
        }
      }
    }
    if (score > best) best = score
  }
  return best
}

function meanScore(event: GameEvent): number {
  let total = 0
  for (let i = 0; i < RUNS; i++) total += resolveEvent(event, randomDraft(mulberry32(i), figures)).score
  return total / RUNS
}

console.log(`target ceiling ${TARGET}\n`)
const suggestions: Record<string, number> = {}
for (const event of loadEvents()) {
  const rows = OFFSETS.map((off) => {
    const shifted = shift(event, off)
    return { off, ceil: ceiling(shifted), mean: meanScore(shifted) }
  })
  const best = rows.reduce((a, b) =>
    Math.abs(b.ceil - TARGET) < Math.abs(a.ceil - TARGET) ? b : a,
  )
  suggestions[event.id] = best.off
  console.log(
    `${event.title}\n  ` +
      rows.map((r) => `${r.off >= 0 ? '+' : ''}${r.off}: ceil ${r.ceil.toFixed(0)} mean ${r.mean.toFixed(0)}`).join('   ') +
      `\n  -> shift every dc by ${best.off >= 0 ? '+' : ''}${best.off} (ceiling ${best.ceil.toFixed(0)}, mean ${best.mean.toFixed(0)})\n`,
  )
}
console.log(JSON.stringify(suggestions))
