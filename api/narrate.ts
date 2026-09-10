import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { ROLE_LABEL } from '../src/engine/types.js'
import { narrationRequestSchema, narrationSchema } from '../src/shared/narration.js'
import type { NarrationRequest } from '../src/shared/narration.js'

/**
 * The narrator.
 *
 * This exists because pre-written lines cannot do the one thing the game is
 * about. The comedy is the mismatch between a specific person and a specific
 * post in a specific crisis, and there are more six-person cabinets drawable
 * from this roster than could ever be written in advance. So the story is
 * written per game, by a model that has been told who these six actually were.
 *
 * It runs on a server for one reason: the API key must never reach a browser.
 */

/** Opus for the writing. Override per deployment if the bill argues otherwise. */
const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-opus-5'

/** Exported so the model bench in scripts/ can measure the real prompt. */
export const SYSTEM = `You adjudicate and narrate a satirical alternate-history game called Hell's Cabinet.

The player has appointed six figures - real politicians, famous people, fictional characters, and occasionally a piece of office furniture - to six posts, and a historical crisis now plays out under them. You decide how each post handled what the crisis asked of it, and you write what happened.

YOUR JUDGEMENT
For each of the six posts, return one verdict: triumph, pass, fail, or disaster.

Judge on the specific person against the specific demand. The question is never "is this a good person" or "are they impressive" - it is "did what this crisis asked for happen to be the thing this person does". A monster can triumph at a crisis that rewards ruthlessness. A saint can be a disaster at one that needs a comfortable liar. That mismatch is the entire game, so let it decide the verdict.

Where a demand is marked inverted, the crisis punishes the quality rather than rewarding it: it wants the person who does not have it.

Be willing to use the ends. A cabinet that is genuinely well matched to its crisis should collect triumphs, and one that is hopeless should collect disasters. Do not flatten everything to pass and fail to be safe - a run where nothing decisive happened is the dullest possible outcome. A post the crisis never tested still gets a verdict: judge how they were as that, in that crisis, on their own record.

Objects are inanimate. They do not rise to occasions. An object can only reach 'pass' by the crisis happening to need nothing done, and never reaches 'triumph'.

Give each verdict a reason of one sentence, naming what they did. This is shown to the player as the account of their own decision, so it must say something about that person rather than restating the verdict.

VOICE FOR THE STORY
Dry, understated, specific. British broadsheet obituary rather than sketch comedy. The funniest thing available is always the flat statement of what these particular people did, reported as though it were minuted. Never wink, never explain the joke, never use exclamation marks, and never tell the reader something was absurd - report it and let them notice.

THE ONE RULE THAT MATTERS
Every beat must be one that could only have been written about THIS person in THIS post. If a line would read the same with a different name in it, it is wrong and you should write a different line. Use what they were actually known for: their real record, their actual manner, the thing history or their own fiction is stuck with. A traffic cone appointed General is not a joke about cones; it is a joke about the fleet awaiting orders from a traffic cone, reported without comment.

Treat every appointee with total deadpan seriousness. Nobody in this world finds it strange that a cartoon character holds high office. Fictional figures behave exactly as they do in their own stories, applied to government. Objects are inanimate and this is never remarked upon - their inaction is simply minuted as though it were policy.

STRUCTURE
Write one continuous story, not six character cards. Each beat must follow from the one before it: someone's failure creates the situation the next person walks into, and by the end the reader should be able to trace the line from the first decision to the outcome. Refer back. Let them get in each other's way.

The story must agree with your own verdicts: whoever you judged a disaster must visibly be one in the prose, and whoever you judged a triumph must visibly earn it.

FORMAT
One or two sentences per beat. No headings, no names in bold, no stage directions. Set 'role' to the post whose holder the beat is about, or null for beats about the room, the crisis or the outcome. Tone: 'good' when it goes well for them, 'bad' when it does not, 'twist' for the complication and the coup, 'neutral' for scene-setting and the closing line.

Open with a beat that sets the crisis, close with a beat that delivers the outcome. Cover all six appointees in between, plus the complication and any chemistry or coup you are given.

Eleven beats at most, and never more than two sentences in one. The player advances them one at a time, so a long story is a long wait followed by a lot of clicking. Cut anything that is scene-setting rather than someone doing something. Do not name a score or a verdict word in the prose.`

export function userPrompt(req: NarrationRequest): string {
  const cabinet = req.cabinet.map((a) => {
    const demands = a.demands.length === 0
      ? 'nothing - this crisis never tested them'
      : a.demands.map((d) => {
          const what = d.note ?? d.quality
          const framing = d.invert ? `${what} (the crisis punishes ${d.quality}, it wants whoever lacks it)` : `${what} (needs ${d.quality})`
          return d.isTwist ? `${framing}, and this one arrives as the complication` : framing
        }).join('; ')
    return [
      `${ROLE_LABEL[a.role]}: ${a.name} (${a.office}, ${a.era})`,
      `  who they were: ${a.bio}`,
      `  known for: ${a.traits.join(', ')}`,
      `  what the crisis asked of them: ${demands}`,
    ].join('\n')
  }).join('\n\n')

  return [
    `CRISIS: ${req.event.title}, ${req.event.year}`,
    req.event.dossier,
    ``,
    `THE COMPLICATION (happens partway through): ${req.event.twist}`,
    ``,
    `THE CABINET`,
    cabinet,
    ``,
    req.chemistry.length > 0
      ? `WHAT THE ROOM WAS LIKE\n${req.chemistry.map((c) => `- ${c.text} (${c.good ? 'helps' : 'hurts'})`).join('\n')}`
      : `WHAT THE ROOM WAS LIKE\nNothing notable between them.`,
    ``,
    req.coup
      ? `A COUP HAPPENS: ${req.coup.usurperName}, the ${ROLE_LABEL[req.coup.usurperRole]}, takes the chair from ${req.coup.presidentName}. Give this its own beat near the end.`
      : `No coup.`,
    ``,
    `Judge all six posts, then write the story.`,
  ].join('\n')
}

/** The handler proper, in Web terms. Exported so the local server can call it. */
export async function narrate(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405)
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'Narrator is not configured' }, 503)

  let parsed: NarrationRequest
  try {
    // Validate rather than trust: this body arrives from a browser, and the
    // schema's length caps are what stop it becoming a prompt-shaped payload.
    parsed = narrationRequestSchema.parse(await request.json())
  } catch {
    return json({ error: 'Malformed narration request' }, 400)
  }

  try {
    const client = new Anthropic()
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      // Short creative prose: low effort keeps the wait near the reading time
      // of the first beat, which is all the latency the UI can hide.
      output_config: { effort: 'low', format: zodOutputFormat(narrationSchema) },
      messages: [{ role: 'user', content: userPrompt(parsed) }],
    })

    if (response.stop_reason === 'refusal') return json({ error: 'Declined' }, 502)
    if (!response.parsed_output) return json({ error: 'Narrator returned nothing usable' }, 502)
    return json(response.parsed_output, 200)
  } catch (error) {
    // The player is never shown this, so the log is the only place a
    // misconfigured narrator can announce itself.
    console.error('[narrate]', error instanceof Error ? error.message : error)
    // The client falls back to its own templates on any failure, so the only
    // job here is to say what went wrong without leaking request details.
    if (error instanceof Anthropic.AuthenticationError) return json({ error: 'Narrator key rejected' }, 503)
    if (error instanceof Anthropic.RateLimitError) return json({ error: 'Narrator is busy' }, 429)
    if (error instanceof Anthropic.APIError) return json({ error: `Narrator failed (${error.status})` }, 502)
    return json({ error: 'Narrator failed' }, 502)
  }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

/** The Node request and response objects a classic serverless runtime passes. */
interface NodeRequest {
  method?: string
  url?: string
  on(event: string, listener: (chunk?: unknown) => void): unknown
}
interface NodeResponse {
  statusCode: number
  setHeader(name: string, value: string): unknown
  end(body?: string): unknown
}

/**
 * Accept either calling convention.
 *
 * Vercel's Node runtime invokes the default export as (req, res) with Node
 * stream objects, while the local dev and preview servers hand it a Web
 * Request and use what it returns. A handler written for only one of those
 * does not fail loudly under the other: given (req, res) the Web version
 * throws inside its own try, builds a Response nobody reads, and never writes
 * to res - so the request hangs until the platform times it out and the game
 * quietly falls back to templates. That is what shipped, and it looked
 * exactly like the adjudicator having nothing to say.
 */
export default async function handler(a: Request | NodeRequest, b?: NodeResponse): Promise<Response | void> {
  if (!b || typeof b.setHeader !== 'function') return narrate(a as Request)

  const req = a as NodeRequest
  const chunks: Buffer[] = []
  await new Promise<void>((resolve, reject) => {
    req.on('data', (chunk) => chunks.push(chunk as Buffer))
    req.on('end', () => resolve())
    req.on('error', (error) => reject(error as Error))
  })

  const result = await narrate(
    new Request(`https://serverless.local${req.url ?? '/api/narrate'}`, {
      method: req.method ?? 'POST',
      headers: { 'content-type': 'application/json' },
      body: chunks.length > 0 ? Buffer.concat(chunks) : undefined,
    }),
  )

  b.statusCode = result.status
  b.setHeader('content-type', 'application/json')
  b.setHeader('cache-control', 'no-store')
  b.end(await result.text())
}
