/**
 * The human gate's research assistant.
 *
 * `npm run validate` proves the roster is well-formed - schema, tier budget,
 * unique ids. It cannot tell whether the numbers match the person: Bob Ross at
 * force 1 is correct, Bob Ross at grit 3 is wrong, and both pass the gate. This
 * asks Claude to read each figure against what it knows of their life and report
 * where the data disagrees with history.
 *
 * It NEVER writes to content/. Findings land in a report for a human to accept
 * or reject, because `reviewed: true` is a claim a person makes, not a model.
 *
 *   npm run review            # whole roster
 *   npm run review -- 12      # first 12 figures, for a cheap smoke test
 */
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { readFileSync, writeFileSync } from 'node:fs'
import { ALIGNMENTS, POWER_TIERS } from '../src/engine/types.js'
import type { Politician } from '../src/engine/types.js'

/** Figures per request. Small enough that one refusal costs little. */
const BATCH = 8
/** Requests in flight. The roster is ~120 figures, so this is ~16 requests. */
const CONCURRENCY = 4
const OUT = 'content/review-findings.json'

const findingSchema = z.object({
  id: z.string().describe('the figure id this is about'),
  field: z
    .string()
    .describe('what disagrees: a stat name, "tier", "traits", "alignment", "category" or "bio"'),
  severity: z
    .enum(['error', 'warn', 'nit'])
    .describe('error = plainly wrong about the person; warn = defensible but off; nit = taste'),
  current: z.string().describe('the value in the file'),
  suggested: z.string().describe('what it should be'),
  why: z.string().describe('one sentence, citing the fact from their life that decides it'),
})

const reportSchema = z.object({
  findings: z.array(findingSchema),
  clean: z.array(z.string()).describe('ids you would sign off as-is'),
})

const RUBRIC = `You are the reviewer on the content gate for Hell’s Cabinet, a satirical daily game.

The player is shown a historical or fictional figure - name, office, and one line of
bio - and drafts them into one of five cabinet roles. A historical crisis then plays
out, and an adjudicator decides how each of them handled what it asked, judging on
who they actually were. There are no hidden numbers: the bio and the traits ARE the
figure, so a lazy bio makes a figure unjudgeable and a wrong trait misjudges them.

  tiers (how much weight they threw around): ${POWER_TIERS.join(', ')}
  alignments: ${ALIGNMENTS.join(', ')} - how history remembers them, NOT how strong they are

Judge each figure against the life they actually led:

1. BIO AS EVIDENCE. The bio is the only description the adjudicator gets. Flag one that
   is too generic to decide anything from - it must say what this person specifically
   did or was like, not that they were powerful or controversial. This is the most
   valuable finding you can make.
2. TIER. Does it match how formidable they were? A titan genuinely bent events; a
   liability was out of their depth anywhere near power.
3. ALIGNMENT. good/bad/neutral by how history remembers them. Mass killers are "bad"
   however capable; this axis is not a power rating.
4. TRAITS. Only from this vocabulary: banker, beloved, cunning, dealmaker, demagogue,
   isolationist, liability, loyalist, paranoid, scandal-magnet, showman, soldier,
   statesman, strategist, technocrat, warhawk. Flag a missing obvious one or a wrong one.
5. FACTS. Flag falsehoods in the bio or office, never style - the voice is deliberately
   dry satire and understatement is intended.

Rules:
- Report a finding ONLY where you can name the fact that decides it. No vibes.
- Fictional characters and objects are judged against their own canon or function,
  not against real history. An object's stats describe what it does in a room.
- A figure with nothing wrong goes in "clean". Most figures should be clean.
- Never suggest a stat outside 1-10.`

const client = new Anthropic()
const roster: Politician[] = JSON.parse(readFileSync('content/politicians.json', 'utf8'))
const limit = Number(process.argv[2] ?? 0)
const subject = limit > 0 ? roster.slice(0, limit) : roster

/** Only the fields under review, so the model is not reading its own noise. */
function forReview(p: Politician) {
  const { id, category, tier, alignment, name, country, era, office, bio, traits } = p
  return { id, category, tier, alignment, name, country, era, office, bio, traits }
}

type Report = z.infer<typeof reportSchema>

async function reviewBatch(batch: Politician[], n: number): Promise<Report> {
  const response = await client.messages.parse({
    model: 'claude-opus-5',
    max_tokens: 16000,
    // The rubric is identical on every request and sits ahead of the figures,
    // so it is a cache hit from the second batch onward.
    system: [{ type: 'text', text: RUBRIC, cache_control: { type: 'ephemeral' } }],
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high', format: zodOutputFormat(reportSchema) },
    messages: [
      {
        role: 'user',
        content: `Review these ${batch.length} figures:\n\n${JSON.stringify(batch.map(forReview), null, 1)}`,
      },
    ],
  })

  if (response.stop_reason === 'refusal') {
    console.error(`  batch ${n}: declined (${response.stop_details?.category ?? 'no category'})`)
    return { findings: [], clean: [] }
  }
  const parsed = response.parsed_output
  if (!parsed) {
    console.error(`  batch ${n}: no parsable report`)
    return { findings: [], clean: [] }
  }
  const usage = response.usage
  console.log(
    `  batch ${n}: ${parsed.findings.length} findings, ${parsed.clean.length} clean` +
      ` (${usage.input_tokens} in, ${usage.cache_read_input_tokens ?? 0} cached, ${usage.output_tokens} out)`,
  )
  return parsed
}

const batches: Politician[][] = []
for (let i = 0; i < subject.length; i += BATCH) batches.push(subject.slice(i, i + BATCH))

console.log(`reviewing ${subject.length} figures in ${batches.length} batches\n`)

const reports: Report[] = []
for (let i = 0; i < batches.length; i += CONCURRENCY) {
  const slice = batches.slice(i, i + CONCURRENCY)
  const done = await Promise.all(slice.map((b, j) => reviewBatch(b, i + j + 1)))
  reports.push(...done)
}

const findings = reports.flatMap((r) => r.findings)
const clean = reports.flatMap((r) => r.clean)
const rank = { error: 0, warn: 1, nit: 2 }
findings.sort((a, b) => rank[a.severity] - rank[b.severity] || a.id.localeCompare(b.id))

writeFileSync(OUT, JSON.stringify({ reviewed: subject.length, findings, clean }, null, 2) + '\n')

const bySeverity = (s: string) => findings.filter((f) => f.severity === s).length
console.log(
  `\n${findings.length} findings on ${new Set(findings.map((f) => f.id)).size} figures` +
    ` - ${bySeverity('error')} error, ${bySeverity('warn')} warn, ${bySeverity('nit')} nit`,
)
console.log(`${clean.length} figures signed off as-is`)
console.log(`\nwritten to ${OUT} - nothing in content/politicians.json was touched`)
for (const f of findings.filter((x) => x.severity === 'error').slice(0, 15)) {
  console.log(`  ${f.id} ${f.field}: ${f.current} -> ${f.suggested}  (${f.why})`)
}
