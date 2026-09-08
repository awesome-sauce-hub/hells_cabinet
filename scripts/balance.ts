/**
 * Simulate many random drafts per event and print the tier distribution and
 * per-check pass rates. This is the tuning instrument: a healthy event spreads
 * its outcomes, and its checks sit somewhere near coin-flip. Anything that
 * passes or fails ~always is a dc that needs moving.
 *
 *   npm run balance -- [runs]
 */
import { loadEvents, loadPoliticians } from '../src/engine/content.js'
import { randomDraft } from '../src/engine/draft.js'
import { mulberry32 } from '../src/engine/rng.js'
import { TIERS, resolveEvent } from '../src/engine/resolve.js'
import type { Tier } from '../src/engine/resolve.js'

const RUNS = Number(process.argv[2] ?? 10000)
const politicians = loadPoliticians()

for (const event of loadEvents()) {
  const tiers = new Map<Tier, number>(TIERS.map((t) => [t, 0]))
  const passes = new Map<string, number>()
  let scoreTotal = 0
  let coups = 0

  for (let i = 0; i < RUNS; i++) {
    const rng = mulberry32(i)
    const result = resolveEvent(event, randomDraft(rng, politicians))
    tiers.set(result.tier, tiers.get(result.tier)! + 1)
    scoreTotal += result.score
    if (result.chemistry.coup) coups++
    for (const c of result.checks) {
      const key = `${c.role}/${c.check.stat_bias}${c.check.invert ? '!' : ''}${c.isTwist ? ' (twist)' : ''}`
      passes.set(key, (passes.get(key) ?? 0) + (c.passed ? 1 : 0))
    }
  }

  console.log(`\n${event.title}  -  ${RUNS} runs, mean score ${(scoreTotal / RUNS).toFixed(1)}`)
  for (const tier of TIERS) {
    const n = tiers.get(tier)!
    const pct = (n / RUNS) * 100
    console.log(`  ${tier.padEnd(16)} ${pct.toFixed(1).padStart(5)}%  ${'#'.repeat(Math.round(pct / 2))}`)
  }
  console.log('  check pass rates')
  for (const [key, n] of passes) {
    console.log(`    ${key.padEnd(36)} ${((n / RUNS) * 100).toFixed(1).padStart(5)}%`)
  }
  console.log(`  coups: ${((coups / RUNS) * 100).toFixed(1)}%`)
}
