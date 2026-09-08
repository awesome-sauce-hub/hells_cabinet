/**
 * Who is actually best at each check.
 *
 * Content-design tool: a figure that can never top any check is a trap card,
 * not a surprise. Used to confirm every wildcard has at least one job.
 *
 *   npm run toppicks
 */
import { loadEvents, loadPoliticians } from '../src/engine/content.js'
import { clamp, roleScore, statScore } from '../src/engine/score.js'
import { ROLES, STATS } from '../src/engine/types.js'
import type { Check, Politician } from '../src/engine/types.js'

const figures = loadPoliticians()

function value(p: Politician, check: Check): number {
  const biased = check.invert
    ? 100 - statScore(p.stats, check.stat_bias)
    : statScore(p.stats, check.stat_bias)
  return clamp(0.5 * roleScore(p.stats, check.role) + 0.5 * biased, 0, 100)
}

const topped = new Set<string>()

for (const event of loadEvents()) {
  console.log(`\n${event.title}`)
  for (const check of [...event.checks, event.twist.check]) {
    const ranked = figures
      .map((p) => ({ p, v: value(p, check) }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 3)
    ranked.forEach((r, i) => i === 0 && topped.add(r.p.id))
    const label = `${check.role}/${check.stat_bias}${check.invert ? '!' : ''}`
    console.log(
      `  ${label.padEnd(30)} ` +
        ranked.map((r) => `${r.p.name} ${r.v.toFixed(0)}${r.p.category === 'wildcard' ? '*' : ''}`).join('  |  '),
    )
  }
}

console.log(`\n  * = wildcard`)
console.log(`  tops one of the ${
  loadEvents().reduce((n, e) => n + e.checks.length + 1, 0)
} checks currently in the game: ${topped.size}/${figures.length}`)

/**
 * Coverage over every check the game could ever ask for, not just the ones
 * written so far. A figure that tops nothing here is strictly dominated - it
 * can never be the right answer, and no future event can rescue it.
 */
const niches = new Map<string, string[]>()
for (const role of ROLES) {
  for (const stat of STATS) {
    for (const invert of [false, true]) {
      const check = { role, stat_bias: stat, dc: 0, invert } as Check
      const best = figures.reduce((a, b) => (value(b, check) > value(a, check) ? b : a))
      const list = niches.get(best.id) ?? []
      list.push(`${role}/${stat}${invert ? '!' : ''}`)
      niches.set(best.id, list)
    }
  }
}
// Being the single best at nothing is survivable; being outside every top three
// is not - that is the card a player learns to always skip.
const contender = new Set<string>()
for (const role of ROLES) {
  for (const stat of STATS) {
    for (const invert of [false, true]) {
      const check = { role, stat_bias: stat, dc: 0, invert } as Check
      figures
        .map((p) => ({ p, v: value(p, check) }))
        .sort((a, b) => b.v - a.v)
        .slice(0, 3)
        .forEach((x) => contender.add(x.p.id))
    }
  }
}
const dominated = figures.filter((p) => !niches.has(p.id))
const unplayable = figures.filter((p) => !contender.has(p.id))
console.log(`\n  niches across all ${ROLES.length * STATS.length * 2} possible checks:`)
for (const p of figures) {
  const list = niches.get(p.id)
  if (list) console.log(`    ${p.name.padEnd(32)}${p.category === 'wildcard' ? '*' : ' '} ${list.length}  ${list.slice(0, 3).join(', ')}`)
}
console.log(`  best at something: ${niches.size}/${figures.length}` +
  `  -  dominated: ${dominated.map((p) => p.name).join(', ') || 'none'}`)
console.log(`  in some top three: ${contender.size}/${figures.length}` +
  `  -  never a contender: ${unplayable.map((p) => p.name).join(', ') || 'none'}`)
