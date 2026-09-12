/**
 * Content gate. Runs in CI.
 *
 * Figures no longer carry stat blocks, so what this guards has changed: the
 * roster's whole contribution to an outcome is now its prose and its traits,
 * which makes an empty bio or a junk trait a gameplay bug rather than a
 * cosmetic one. This is the seam where that is stopped before it reaches
 * players.
 *
 *   npm run validate
 */
import { z } from 'zod'
import { readFileSync } from 'node:fs'
import { ALIGNMENTS, CATEGORIES, POWER_TIERS, QUALITIES, ROLES } from '../src/engine/types.js'
import { loadEvents, loadPoliticians } from '../src/engine/content.js'

const roleEnum = z.enum(ROLES)
const qualityEnum = z.enum(QUALITIES)

const politicianSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  category: z.enum(CATEGORIES),
  alignment: z.enum(ALIGNMENTS),
  endsRun: z.string().min(1).optional(),
  /**
   * Never validated until the schema was made strict, which is how it got here
   * unlisted while the draft was already rolling against it. A value outside
   * 0-1 does not error anywhere: it silently turns the one-in-ten gamble back
   * into the certainty it was deliberately stopped from being.
   */
  endsRunChance: z.number().gt(0).lte(1).optional(),
  tier: z.enum(POWER_TIERS),
  name: z.string().min(1),
  country: z.string().min(1),
  era: z.string().min(1),
  office: z.string().min(1),
  bio: z.string().min(1).max(140),
  traits: z.array(z.string()).min(1).max(4),
  record: z.string().min(1).optional(),
  rivals: z.array(z.string()).optional(),
  party: z.string().optional(),
  reviewed: z.boolean(),
// Strict on purpose. The spreadsheet round-trip preserves fields it does not
// recognise, which is right for a sheet and wrong for the shipped file: a
// mistyped column comes back through the importer, lands on disk, and passes a
// permissive schema while doing nothing. Unknown keys have to be an error here
// or the sheet becomes a way to write dead data into the game.
}).strict()

const checkSchema = z.object({
  role: roleEnum,
  demands: qualityEnum,
  invert: z.boolean().optional(),
  weight: z.number().positive().optional(),
  note: z.string().optional(),
  /** Why the post mattered in the real crisis. Required on non-twist checks below. */
  why: z.string().optional(),
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
  aftermath: z.string().optional(),
  lesson: z.string().optional(),
  tags: z.array(z.string()).min(1),
})

/**
 * Eras are mostly decades, and the exceptions are the point: a fictional
 * character has no decade and an abstraction has no century. The list is closed
 * so that "1960's" or "modern" is caught rather than quietly becoming a
 * twenty-seventh era nobody meant to create.
 */
const ERA_WORDS = ['Antiquity', 'Medieval', 'Modern', 'Fictional', 'Internet']

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

for (const p of rawPoliticians) {
  if (typeof p.era === 'string' && !/^\d{3,4}s$/.test(p.era) && !ERA_WORDS.includes(p.era)) {
    fail(`politician ${p.id}: era "${p.era}" is neither a decade nor one of ${ERA_WORDS.join(', ')}`)
  }
}

/**
 * Nothing carries stats any more, and a leftover block would be silently
 * ignored while looking authoritative to whoever is editing the file.
 */
for (const p of rawPoliticians) {
  if ('stats' in p) fail(`politician ${p.id}: still carries a stats block; figures are judged on their record now`)
}

/**
 * The bio is the whole of what the adjudicator knows about a figure beyond
 * their name and office, so a lazy one is now a mechanical problem: it is the
 * evidence on which their verdict is decided.
 */
for (const p of rawPoliticians) {
  if (typeof p.bio === 'string' && p.bio.trim().split(/\s+/).length < 4) {
    fail(`politician ${p.id}: bio is too thin to judge them on ("${p.bio}")`)
  }
}

/**
 * The instant-loss card is a punchline and punchlines do not scale: a second
 * one turns "the Nixon rule" into a mechanic the player has to play around.
 */
const enders = rawPoliticians.filter((p: { endsRun?: string }) => p.endsRun)
if (enders.length > 1) {
  fail(`${enders.length} figures end the run instantly; exactly one is allowed`)
}

/**
 * Roughly when a figure was walking around, for the rivalry check below.
 * Fictional has no date and is excluded rather than guessed at.
 */
function eraYear(era: string): number | null {
  const decade = /^(\d{3,4})s$/.exec(era)
  if (decade) return Number(decade[1])
  return { Antiquity: -50, Medieval: 1400, Modern: 2000, Internet: 2010 }[era] ?? null
}

/**
 * A rivalry is not a moral opposition. The player is told these two "will not
 * be in a room together" and loses twelve points for it, so it has to describe
 * an antagonism that actually happened - Allende and Pinochet, Churchill and
 * Gandhi - and not a saint paired off against the nearest monster.
 *
 * Six of the original twelve failed that standard, including Lincoln against a
 * Leopold II who took the throne eight months after Lincoln was shot. Half of
 * them were centuries apart, which is the part a machine can check. Whether two
 * contemporaries were ever actually opposed is a judgement, and this only
 * catches the anachronisms.
 */
const CONTEMPORARY_YEARS = 60

const ids = new Set<string>(rawPoliticians.map((p: { id: string }) => p.id))
const byId = new Map<string, { era: string; name: string }>(rawPoliticians.map((p: { id: string }) => [p.id, p]))
for (const p of rawPoliticians) {
  for (const r of p.rivals ?? []) {
    if (!ids.has(r)) fail(`politician ${p.id}: rival "${r}" does not exist`)
    if (r === p.id) fail(`politician ${p.id}: is their own rival`)
    const other = byId.get(r)
    if (!other) continue
    // A rivalry has two sides. A one-way entry means only one of the pair is
    // penalised depending on which of them the chemistry pass reaches first.
    if (!(other as { rivals?: string[] }).rivals?.includes(p.id)) {
      fail(`politician ${p.id}: names ${r} as a rival, but ${r} does not name them back`)
    }
    const a = eraYear(p.era)
    const b = eraYear(other.era)
    if (a !== null && b !== null && Math.abs(a - b) > CONTEMPORARY_YEARS) {
      fail(`politician ${p.id}: cannot have been a rival of ${r} - ${p.era} and ${other.era} are ${Math.abs(a - b)} years apart`)
    }
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
    const key = `${c.role}/${c.demands}`
    if (seen.has(key)) fail(`event ${event.id}: duplicate check ${key}`)
    seen.add(key)
    // Optional in the schema so the type stays tolerant, required here so the
    // briefing cannot quietly lose the one line that says why a post matters.
    // The twist's check is exempt: its demand is withheld, so its reason is too.
    if (!c.why) fail(`event ${event.id}: check ${key} has no why`)
  }
  if (!event.aftermath) fail(`event ${event.id}: no aftermath - the debrief has nothing to say`)
  if (!event.lesson) fail(`event ${event.id}: no lesson`)
}

if (errors.length) {
  console.error(`\n  ${errors.length} content problem(s):\n`)
  for (const e of errors) console.error(`   - ${e}`)
  process.exit(1)
}
const count = (c: string) => shipped.filter((p) => p.category === c).length
console.log(
  `  content ok: ${shipped.length} figures ` +
    `(${count('politician')} politicians, ${count('wildcard')} wildcards, ` +
    `${count('object')} objects), ${loadEvents().length} events`,
)
