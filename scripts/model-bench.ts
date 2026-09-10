import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
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
 * Non-Claude models are reached over their OpenAI-compatible endpoints, which
 * is the only reason this needs no second SDK. They are skipped, not failed,
 * when their key is absent, so the Claude comparison still runs on its own.
 *
 *   npx tsx scripts/model-bench.ts [seed] [eventId]
 */

/**
 * Dollars per million tokens. The Claude rates are first-party list price; the
 * others are transcribed from provider pricing pages and go stale without
 * warning, so treat their cost column as indicative and re-check before you
 * make a decision worth money on it.
 */
type Entry =
  | { kind: 'anthropic'; model: string; in: number; out: number }
  | { kind: 'openai'; label: string; model: string; baseURL: string; keyEnv: string; in: number; out: number }

const MODELS: Entry[] = [
  { kind: 'anthropic', model: 'claude-opus-5', in: 5, out: 25 },
  { kind: 'anthropic', model: 'claude-sonnet-5', in: 2, out: 10 },
  { kind: 'anthropic', model: 'claude-haiku-4-5', in: 1, out: 5 },
  {
    kind: 'openai',
    label: 'qwen3-max',
    model: 'qwen3-max',
    baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    keyEnv: 'DASHSCOPE_API_KEY',
    in: 1.2,
    out: 6,
  },
  {
    kind: 'openai',
    label: 'qwen-plus',
    model: 'qwen-plus',
    baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    keyEnv: 'DASHSCOPE_API_KEY',
    in: 0.4,
    out: 1.2,
  },
  {
    kind: 'openai',
    label: 'kimi-k2',
    model: 'kimi-k2-0905-preview',
    baseURL: 'https://api.moonshot.ai/v1',
    keyEnv: 'MOONSHOT_API_KEY',
    in: 0.6,
    out: 2.5,
  },
]

/**
 * The narration schema as JSON Schema, tightened the way strict structured
 * output requires: every property required, no extra keys anywhere. Zod's own
 * output leaves both open, and a model reads that as permission to improvise.
 */
function strictJsonSchema(): Record<string, unknown> {
  const tighten = (node: any): any => {
    if (Array.isArray(node)) return node.map(tighten)
    if (node && typeof node === 'object') {
      const out: any = Object.fromEntries(Object.entries(node).map(([k, v]) => [k, tighten(v)]))
      if (out.type === 'object' && out.properties) {
        out.additionalProperties = false
        out.required = Object.keys(out.properties)
      }
      return out
    }
    return node
  }
  return tighten(z.toJSONSchema(narrationSchema, { target: 'draft-7' }))
}

const [seed = 'bench-1', eventId = 'the-canal'] = process.argv.slice(2)
const events = loadEvents()
const event = events.find((e) => e.id === eventId) ?? events[0]!
const result = resolveEvent(event, randomDraft(seedFrom(seed), loadPoliticians()))
const request = narrationRequest(result)
const USER = userPrompt(request)

console.log(`crisis: ${event.title} · tier: ${result.tier}`)
console.log(`cabinet: ${request.cabinet.map((c) => `${c.name}`).join(', ')}\n`)

const client = new Anthropic()

/** One run's worth of what the comparison is actually about. */
type Run = { input: number; output: number; parsed: unknown; note?: string }

async function runAnthropic(entry: Extract<Entry, { kind: 'anthropic' }>): Promise<Run> {
  const response = await client.messages.parse({
    model: entry.model,
    max_tokens: 8000,
    system: SYSTEM,
    // Haiku 4.5 predates the effort parameter and rejects it outright.
    output_config: entry.model.startsWith('claude-haiku')
      ? { format: zodOutputFormat(narrationSchema) }
      : { effort: 'low', format: zodOutputFormat(narrationSchema) },
    messages: [{ role: 'user', content: USER }],
  })
  if (response.stop_reason === 'refusal') throw new Error('declined the prompt')
  return { input: response.usage.input_tokens, output: response.usage.output_tokens, parsed: response.parsed_output }
}

async function postChat(entry: Extract<Entry, { kind: 'openai' }>, body: Record<string, unknown>) {
  const response = await fetch(`${entry.baseURL}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env[entry.keyEnv]}` },
    body: JSON.stringify({ model: entry.model, max_tokens: 8000, messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: USER },
    ], ...body }),
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`${response.status} ${text.slice(0, 300)}`)
  return JSON.parse(text)
}

async function runOpenAI(entry: Extract<Entry, { kind: 'openai' }>): Promise<Run> {
  const schema = strictJsonSchema()
  let note: string | undefined
  let payload
  try {
    payload = await postChat(entry, {
      response_format: { type: 'json_schema', json_schema: { name: 'narration', schema, strict: true } },
    })
  } catch (error) {
    // Not every OpenAI-compatible endpoint implements json_schema. Falling
    // back to json_object costs the schema guarantee, which is itself a
    // finding worth printing rather than hiding.
    note = 'no json_schema support; fell back to json_object'
    payload = await postChat(entry, {
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `${SYSTEM}\n\nReply with JSON matching this schema exactly:\n${JSON.stringify(schema)}` },
        { role: 'user', content: USER },
      ],
    })
  }
  const content = payload.choices?.[0]?.message?.content ?? ''
  // The schema is the contract the game relies on, so validate rather than
  // trust: a model that returns plausible prose in the wrong shape has failed.
  const parsed = narrationSchema.parse(JSON.parse(content))
  return { input: payload.usage?.prompt_tokens ?? 0, output: payload.usage?.completion_tokens ?? 0, parsed, note }
}

for (const entry of MODELS) {
  const label = entry.kind === 'anthropic' ? entry.model : entry.label
  if (entry.kind === 'openai' && !process.env[entry.keyEnv]) {
    console.log(`--- ${label} ---\nskipped: ${entry.keyEnv} is not set\n`)
    continue
  }

  const started = Date.now()
  try {
    const run = entry.kind === 'anthropic' ? await runAnthropic(entry) : await runOpenAI(entry)
    const seconds = (Date.now() - started) / 1000
    const cost = (run.input / 1e6) * entry.in + (run.output / 1e6) * entry.out
    const beats = (run.parsed as any)?.beats ?? []

    console.log(`--- ${label} ---`)
    console.log(`${seconds.toFixed(1)}s · ${run.input} in / ${run.output} out · $${cost.toFixed(4)} per game · ${beats.length} beats`)
    if (run.note) console.log(`  note: ${run.note}`)
    for (const beat of beats.slice(1, 4)) console.log(`  [${beat.role ?? 'room'}] ${beat.text}`)
    console.log()
  } catch (error) {
    console.log(`--- ${label} ---\nfailed: ${error instanceof Error ? error.message : error}\n`)
  }
}
