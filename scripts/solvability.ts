/**
 * Exhaustive best and worst cabinet per event.
 *
 * Event-first means the player can see what the crisis wants, so the ceiling
 * has to be real but not trivial: a perfect read should land near the top of
 * the range without guaranteeing it, leaving the hidden twist to decide.
 *
 *   npm run solvability
 */
import { loadEvents, loadPoliticians } from '../src/engine/content.js'
import { resolveEvent } from '../src/engine/resolve.js'
import { ROLES } from '../src/engine/types.js'
import type { Politician, Roster } from '../src/engine/types.js'

const politicians = loadPoliticians()

function* cabinets(pool: Politician[]): Generator<Roster> {
  const chosen: Politician[] = []
  function* rec(depth: number): Generator<Roster> {
    if (depth === ROLES.length) {
      yield Object.fromEntries(ROLES.map((r, i) => [r, chosen[i]!])) as Roster
      return
    }
    for (const p of pool) {
      if (chosen.includes(p)) continue
      chosen.push(p)
      yield* rec(depth + 1)
      chosen.pop()
    }
  }
  yield* rec(0)
}

for (const event of loadEvents()) {
  let best = { score: -1, roster: null as Roster | null }
  let worst = { score: 101, roster: null as Roster | null }
  let n = 0
  for (const roster of cabinets(politicians)) {
    const { score } = resolveEvent(event, roster)
    n++
    if (score > best.score) best = { score, roster }
    if (score < worst.score) worst = { score, roster }
  }
  console.log(`\n${event.title}  (${n.toLocaleString()} cabinets)`)
  for (const [label, r] of [['BEST', best], ['WORST', worst]] as const) {
    const res = resolveEvent(event, r.roster!)
    console.log(`  ${label}  ${r.score.toFixed(0)}  ${res.tier}`)
    for (const role of ROLES) console.log(`      ${role.padEnd(20)} ${r.roster![role].name}`)
  }
}
