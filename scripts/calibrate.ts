/**
 * Suggest DCs from the roster the game actually ships.
 *
 * A dc is only meaningful relative to the spread of values random drafts
 * produce for that check. This samples that distribution and reports the value
 * at each target pass rate, so a designer picks intent ("this should be hard")
 * instead of guessing a number that silently becomes 100%.
 *
 *   npm run calibrate -- [runs]
 */
import { loadEvents, loadPoliticians } from '../src/engine/content.js'
import { randomDraft } from '../src/engine/draft.js'
import { mulberry32 } from '../src/engine/rng.js'
import { resolveEvent } from '../src/engine/resolve.js'

const RUNS = Number(process.argv[2] ?? 4000)
const politicians = loadPoliticians()

/** Value below which `frac` of runs fall - i.e. the dc giving (1-frac) pass rate. */
function quantile(sorted: number[], frac: number): number {
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(frac * (sorted.length - 1))))
  return sorted[i]!
}

for (const event of loadEvents()) {
  const samples = new Map<string, number[]>()
  for (let i = 0; i < RUNS; i++) {
    const result = resolveEvent(event, randomDraft(mulberry32(i), politicians))
    for (const c of result.checks) {
      const key = `${c.role}/${c.check.stat_bias}${c.check.invert ? '!' : ''}`
      const list = samples.get(key) ?? []
      list.push(c.value)
      samples.set(key, list)
    }
  }

  console.log(`\n${event.title}`)
  console.log(`  ${'check'.padEnd(32)} ${'dc now'.padStart(7)} | dc for 70% / 55% / 40% pass`)
  for (const [key, list] of samples) {
    list.sort((a, b) => a - b)
    const check = [...event.checks, event.twist.check].find(
      (c) => `${c.role}/${c.stat_bias}${c.invert ? '!' : ''}` === key,
    )
    console.log(
      `  ${key.padEnd(32)} ${String(check?.dc ?? '?').padStart(7)} | ` +
        `${quantile(list, 0.3).toFixed(0).padStart(3)}  ` +
        `${quantile(list, 0.45).toFixed(0).padStart(3)}  ` +
        `${quantile(list, 0.6).toFixed(0).padStart(3)}`,
    )
  }
}
