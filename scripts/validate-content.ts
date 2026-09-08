/**
 * Content gate. Runs in CI.
 *
 * The roster will eventually arrive from a Wikidata scrape and an LLM stat
 * pass, so this is the seam where messy or unreviewed data is stopped before
 * it reaches players.
 *
 *   npm run validate
 */
import { z } from 'zod'
import { readFileSync } from 'node:fs'
import { CATEGORIES, ROLES, STATS } from '../src/engine/types.js'
import { loadEvents, loadPoliticians } from '../src/engine/content.js'

const roleEnum = z.enum(ROLES)
const statEnum = z.enum(STATS)

const politicianSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  category: z.enum(CATEGORIES),
  name: z.string().min(1),
  country: z.string().min(1),
  era: z.string().min(1),
  office: z.string().min(1),
  bio: z.string().min(1).max(140),
  stats: z.object(Object.fromEntries(STATS.map((s) => [s, z.number().int().min(1).max(10)])) as
    Record<(typeof STATS)[number], z.ZodNumber>),
  traits: z.array(z.string()).min(1).max(4),
  rivals: z.array(z.string()).optional(),
  party: z.string().optional(),
  reviewed: z.boolean(),
})

const checkSchema = z.object({
  role: roleEnum,
  stat_bias: statEnum,
  dc: z.number().min(0).max(100),
  invert: z.boolean().optional(),
  weight: z.number().positive().optional(),
  note: z.string().optional(),
})

const eventSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  year: z.number().int(),
  dossier: z.string().min(1),
  briefing_hint: z.string().min(1),
  spotlight: z.array(roleEnum).min(1),
  checks: z.array(checkSchema).min(1),
  twist: z.object({ id: z.string(), text: z.string().min(1), check: checkSchema }),
  tags: z.array(z.string()).min(1),
})

const errors: string[] = []
const fail = (msg: string) => errors.push(msg)

const rawPoliticians = JSON.parse(readFileSync('content/politicians.json', 'utf8'))
const rawEvents = JSON.parse(readFileSync('content/events.json', 'utf8'))

for (const [i, p] of rawPoliticians.entries()) {
  const parsed = politicianSchema.safeParse(p)
  if (!parsed.success) fail(`politician[${i}] ${p?.id ?? '?'}: ${parsed.error.issues.map((e) => `${e.path.join('.')} ${e.message}`).join('; ')}`)
}
for (const [i, e] of rawEvents.entries()) {
  const parsed = eventSchema.safeParse(e)
  if (!parsed.success) fail(`event[${i}] ${e?.id ?? '?'}: ${parsed.error.issues.map((x) => `${x.path.join('.')} ${x.message}`).join('; ')}`)
}

/**
 * Every figure spends the same number of stat points, so strength has to be
 * bought with weakness. Without this, high-total cards win regardless of what
 * the event asks and the draft collapses into "pick the biggest number".
 */
const STAT_BUDGET = 40
for (const p of rawPoliticians) {
  const total = Object.values(p.stats ?? {}).reduce((a: number, b) => a + (b as number), 0)
  if (total !== STAT_BUDGET) {
    fail(`politician ${p.id}: stat total ${total}, budget is ${STAT_BUDGET}`)
  }
}

const ids = new Set<string>(rawPoliticians.map((p: { id: string }) => p.id))
for (const p of rawPoliticians) {
  for (const r of p.rivals ?? []) {
    if (!ids.has(r)) fail(`politician ${p.id}: rival "${r}" does not exist`)
    if (r === p.id) fail(`politician ${p.id}: is their own rival`)
  }
}
if (ids.size !== rawPoliticians.length) fail('duplicate politician ids')

// Nothing unreviewed ships. This is the guard on the scrape and the LLM pass.
const unreviewed = rawPoliticians.filter((p: { reviewed: boolean }) => !p.reviewed)
if (unreviewed.length) fail(`${unreviewed.length} unreviewed politicians in the shipped roster`)

// Every role must be draftable: the pool needs enough bodies for five rounds
// of six candidates plus the picks already taken.
const shipped = loadPoliticians()
if (shipped.length < ROLES.length + 6) {
  fail(`roster too small: ${shipped.length} politicians cannot fill ${ROLES.length} rounds of 6`)
}

for (const event of loadEvents()) {
  const checked = new Set([...event.checks, event.twist.check].map((c) => c.role))
  for (const role of event.spotlight) {
    if (!checked.has(role)) fail(`event ${event.id}: spotlights ${role} but never tests it`)
  }
  const seen = new Set<string>()
  for (const c of event.checks) {
    const key = `${c.role}/${c.stat_bias}`
    if (seen.has(key)) fail(`event ${event.id}: duplicate check ${key}`)
    seen.add(key)
  }
}

if (errors.length) {
  console.error(`\n  ${errors.length} content problem(s):\n`)
  for (const e of errors) console.error(`   - ${e}`)
  process.exit(1)
}
const wildcards = shipped.filter((p) => p.category === 'wildcard').length
console.log(
  `  content ok: ${shipped.length} figures ` +
    `(${shipped.length - wildcards} politicians, ${wildcards} wildcards), ` +
    `${loadEvents().length} events`,
)
