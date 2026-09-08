/**
 * Approximate best and worst cabinet per event.
 *
 * Exhaustive search was fine at 21 figures and is impossible at 122 (O(n^5) is
 * ~27 trillion cabinets), so this hill-climbs from random starts instead: swap
 * one role at a time, keep any improvement, restart often enough that a single
 * local optimum cannot masquerade as the ceiling.
 *
 * Event-first means the player can see what the crisis wants, so the ceiling
 * has to be real but not trivial: a perfect read should reach the top tier
 * without guaranteeing it, leaving the hidden twist to decide.
 *
 *   npm run solvability -- [restarts]
 */
import { loadEvents, loadPoliticians } from '../src/engine/content.js'
import { mulberry32, shuffle } from '../src/engine/rng.js'
import { resolveEvent } from '../src/engine/resolve.js'
import { ROLES } from '../src/engine/types.js'
import type { GameEvent, Politician, Roster } from '../src/engine/types.js'

const RESTARTS = Number(process.argv[2] ?? 60)
// Run-enders never reach resolution, so they are not part of any cabinet.
const figures = loadPoliticians().filter((p) => !p.endsRun)

function climb(event: GameEvent, seed: number, want: 'best' | 'worst') {
  const rng = mulberry32(seed)
  const start = shuffle(rng, figures).slice(0, ROLES.length)
  const roster = Object.fromEntries(ROLES.map((r, i) => [r, start[i]!])) as Roster
  const better = (a: number, b: number) => (want === 'best' ? a > b : a < b)
  let score = resolveEvent(event, roster).score

  let improved = true
  while (improved) {
    improved = false
    for (const role of ROLES) {
      for (const candidate of figures) {
        // Re-read the incumbent each swap: capturing it once per role would
        // revert an accepted improvement made earlier in this same loop.
        const held = roster[role]
        // A figure may hold only one post at a time.
        if (ROLES.some((r) => roster[r].id === candidate.id)) continue
        roster[role] = candidate
        const next = resolveEvent(event, roster).score
        if (better(next, score)) {
          score = next
          improved = true
        } else {
          roster[role] = held
        }
      }
    }
  }
  return { score, roster: { ...roster } }
}

for (const event of loadEvents()) {
  let best = { score: -1, roster: null as Roster | null }
  let worst = { score: 101, roster: null as Roster | null }
  for (let i = 0; i < RESTARTS; i++) {
    const b = climb(event, i, 'best')
    if (b.score > best.score) best = b
    const w = climb(event, i + 10000, 'worst')
    if (w.score < worst.score) worst = w
  }

  console.log(`\n${event.title}  (${RESTARTS} restarts)`)
  if (best.score < 80) console.log(`  ! ceiling ${best.score.toFixed(0)} - Legendary is unreachable here`)
  if (best.score > 92) console.log(`  ! ceiling ${best.score.toFixed(0)} - too easy to max`)
  for (const [label, r] of [['BEST', best], ['WORST', worst]] as const) {
    console.log(`  ${label}  ${r.score.toFixed(0)}  ${resolveEvent(event, r.roster!).tier}`)
    for (const role of ROLES) {
      const p: Politician = r.roster![role]
      console.log(`      ${role.padEnd(20)} ${p.name}${p.category !== 'politician' ? ` (${p.category})` : ''}`)
    }
  }
}
