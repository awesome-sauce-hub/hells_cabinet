import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { narrationRequestSchema, narrationSchema } from '../src/shared/narration.js'
import type { NarrationRequest } from '../src/shared/narration.js'

/**
 * The narrator.
 *
 * This exists because pre-written lines cannot do the one thing the game is
 * about. The comedy is the mismatch between a specific person and a specific
 * post in a specific crisis, and there are more five-person cabinets drawable
 * from this roster than could ever be written in advance. So the story is
 * written per game, by a model that has been told who these five actually were.
 *
 * It runs on a server for one reason: the API key must never reach a browser.
 */

/** Opus for the writing. Override per deployment if the bill argues otherwise. */
const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-opus-5'

const SYSTEM = `You narrate the outcome of a satirical alternate-history game called Hell's Cabinet.

The player has appointed five figures - real politicians, famous people, fictional characters, and occasionally a piece of office furniture - to five posts, and a historical crisis now plays out under them. You write what happened.

VOICE
Dry, understated, specific. British broadsheet obituary rather than sketch comedy. The funniest thing available is always the flat statement of what these particular people did, reported as though it were minuted. Never wink, never explain the joke, never use exclamation marks, and never tell the reader something was absurd - report it and let them notice.

THE ONE RULE THAT MATTERS
Every beat must be one that could only have been written about THIS person in THIS post. If a line would read the same with a different name in it, it is wrong and you should write a different line. Use what they were actually known for: their real record, their actual manner, the thing history or their own fiction is stuck with. A traffic cone appointed General is not a joke about cones; it is a joke about the fleet awaiting orders from a traffic cone, reported without comment.

Treat every appointee with total deadpan seriousness. Nobody in this world finds it strange that a cartoon character holds high office. Fictional figures behave exactly as they do in their own stories, applied to government. Objects are inanimate and this is never remarked upon - their inaction is simply minuted as though it were policy.

STRUCTURE
Write one continuous story, not five character cards. Each beat must follow from the one before it: someone's failure creates the situation the next person walks into, and by the end the reader should be able to trace the line from the first decision to the outcome. Refer back. Let them get in each other's way.

You are given how each person's checks went, and you must honour them: a failed check goes badly for that person, a passed one goes well, and 'disaster' and 'triumph' are further from the middle than 'narrow-fail' and 'narrow-pass'. The overall verdict tier is fixed - land the ending on it.

FORMAT
One or two sentences per beat. No headings, no names in bold, no stage directions. Set 'role' to the post whose holder the beat is about, or null for beats about the room, the crisis or the outcome. Tone: 'good' when it goes well for them, 'bad' when it does not, 'twist' for the complication and the coup, 'neutral' for scene-setting and the closing line.

Open with a beat that sets the crisis, close with a beat that delivers the verdict. Cover all five appointees in between, plus the twist and any chemistry or coup you are given.`

function userPrompt(req: NarrationRequest): string {
  const cabinet = req.cabinet.map((a) => {
    const checks = a.outcomes.length === 0
      ? 'never tested by this crisis'
      : a.outcomes.map((o) => `${o.isTwist ? 'the complication' : o.stat} - ${o.margin}`).join('; ')
    return [
      `${a.role}: ${a.name} (${a.office}, ${a.era})`,
      `  who they were: ${a.bio}`,
      `  known for: ${a.traits.join(', ')}`,
      `  how they did: ${checks}`,
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
      ? `A COUP HAPPENS: ${req.coup.usurperName}, the ${req.coup.usurperRole}, takes the chair from ${req.coup.presidentName}. Give this its own beat near the end.`
      : `No coup.`,
    ``,
    `THE VERDICT, which your final beat must land on: ${req.tier}`,
    ``,
    `Write the story.`,
  ].join('\n')
}

/** Vercel's Node runtime passes Web Request/Response. */
export default async function handler(request: Request): Promise<Response> {
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
