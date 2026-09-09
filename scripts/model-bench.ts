import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { SYSTEM, userPrompt } from '../api/narrate.js'
import { narrationRequest } from '../src/app/narrateRemote.js'
import { narrationSchema } from '../src/shared/narration.js'
import { loadEvents, loadPoliticians } from '../src/engine/content.js'
import { randomDraft } from '../src/engine/draft.js'
import { resolveEvent } from '../src/engine/resolve.js'
import { seedFrom } from '../src/engine/rng.js'

/**
 * Measure the narrator across models on identical input.
 *
 * Latency and cost are the easy half; the samples are printed so the half that
 * actually decides it can be read rather than inferred from a number.
 *
 *   npx tsx scripts/model-bench.ts [seed] [eventId]
 */
const PRICING: Record<string, { in: number; out: number }> = {
  'claude-opus-5': { in: 5, out: 25 },
  'claude-sonnet-5': { in: 2, out: 10 },
  'claude-haiku-4-5': { in: 1, out: 5 },
}

const [seed = 'bench-1', eventId = 'the-canal'] = process.argv.slice(2)
const events = loadEvents()
const event = events.find((e) => e.id === eventId) ?? events[0]!
const result = resolveEvent(event, randomDraft(seedFrom(seed), loadPoliticians()))
const request = narrationRequest(result)

console.log(`crisis: ${event.title} · tier: ${result.tier}`)
console.log(`cabinet: ${request.cabinet.map((c) => `${c.name}`).join(', ')}\n`)

const client = new Anthropic()
for (const model of Object.keys(PRICING)) {
  const started = Date.now()
  try {
    const response = await client.messages.parse({
      model,
      max_tokens: 8000,
      system: SYSTEM,
      // Haiku 4.5 predates the effort parameter and rejects it outright.
      output_config: model.startsWith('claude-haiku')
        ? { format: zodOutputFormat(narrationSchema) }
        : { effort: 'low', format: zodOutputFormat(narrationSchema) },
      messages: [{ role: 'user', content: userPrompt(request) }],
    })
    const seconds = (Date.now() - started) / 1000
    const { input_tokens: input, output_tokens: output } = response.usage
    const price = PRICING[model]!
    const cost = (input / 1e6) * price.in + (output / 1e6) * price.out
    const beats = response.parsed_output?.beats ?? []

    console.log(`--- ${model} ---`)
    console.log(`${seconds.toFixed(1)}s · ${input} in / ${output} out · $${cost.toFixed(4)} per game · ${beats.length} beats`)
    for (const beat of beats.slice(1, 4)) console.log(`  [${beat.role ?? 'room'}] ${beat.text}`)
    console.log()
  } catch (error) {
    console.log(`--- ${model} ---\nfailed: ${error instanceof Error ? error.message : error}\n`)
  }
}
