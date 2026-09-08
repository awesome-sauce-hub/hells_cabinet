/**
 * Headless run: draft a random cabinet for an event and print the resolution.
 * Exists so the maths can be balanced before any UI is written.
 *
 *   npm run sim -- [seed] [eventId]
 */
import { loadEvents, loadPoliticians } from '../src/engine/content.js'
import { randomDraft } from '../src/engine/draft.js'
import { seedFrom } from '../src/engine/rng.js'
import { resolveEvent } from '../src/engine/resolve.js'
import { ROLES } from '../src/engine/types.js'

const seed = process.argv[2] ?? new Date().toISOString().slice(0, 10)
const eventId = process.argv[3]

const politicians = loadPoliticians()
const events = loadEvents()
const rng = seedFrom(seed)

const event = eventId
  ? events.find((e) => e.id === eventId) ?? events[0]!
  : events[Math.floor(rng.next() * events.length)]!

const roster = randomDraft(rng, politicians)
const result = resolveEvent(event, roster)

console.log(`\n  ${event.title} (${event.year})   seed: ${seed}`)
console.log(`  ${event.dossier}`)
console.log(`  BRIEFING: ${event.briefing_hint}\n`)

console.log('  CABINET')
for (const role of ROLES) console.log(`    ${role.padEnd(20)} ${roster[role].name}`)

console.log('\n  CHECKS')
for (const c of result.checks) {
  const mark = c.passed ? 'PASS' : 'FAIL'
  const label = `${c.role}/${c.check.stat_bias}${c.check.invert ? ' (inverted)' : ''}`
  console.log(
    `    ${mark}  ${label.padEnd(34)} ${c.value.toFixed(0).padStart(3)} vs dc ${c.check.dc}` +
      `  ${c.isTwist ? '<- TWIST' : ''}`,
  )
}

if (result.chemistry.effects.length) {
  console.log('\n  CHEMISTRY')
  for (const e of result.chemistry.effects) {
    console.log(`    ${e.delta > 0 ? '+' : ''}${e.delta}  ${e.text}`)
  }
}
if (result.chemistry.coup) {
  const { usurper, margin } = result.chemistry.coup
  console.log(`\n  COUP: ${roster[usurper].name} (${usurper}) outclasses the President by ${margin.toFixed(0)}.`)
}

console.log(`\n  ${result.grid}  ${result.score.toFixed(0)}  ${result.tier.toUpperCase()}\n`)
