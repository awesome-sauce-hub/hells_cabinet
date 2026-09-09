// Types only: the schemas live with the server, and importing them here would
// pull all of zod into the game's bundle to validate one small response from
// our own endpoint.
import type { NarrationBeat, NarrationRequest } from '../shared/narration.js'
import { assemble } from '../engine/resolve.js'
import type { Resolution } from '../engine/resolve.js'
import { isVerdict } from '../engine/verdict.js'
import type { RoleVerdict } from '../engine/verdict.js'
import { ROLES, TONES } from '../engine/types.js'
import type { Role } from '../engine/types.js'
import type { Beat } from './narrate.js'

/**
 * Ask the server to judge this cabinet and tell the story of it.
 *
 * Everything here is best-effort. The fallback adjudicator in the engine and
 * the templated narrator both stay in the build, so a missing key, a rate
 * limit, an offline player or a slow response still produces a complete,
 * scored, shareable run - just a blunter one.
 */
/**
 * Generous, because the cost of being wrong is asymmetric. Judged runs measure
 * 20-25s, so a 25s limit dropped roughly half of them into the fallback while
 * the request that would have answered was still in flight - and a silent
 * fallback is indistinguishable from a bad adjudicator.
 */
const TIMEOUT_MS = 60_000

export interface Judged {
  resolution: Resolution
  beats: Beat[]
}

export function narrationRequest(result: Resolution): NarrationRequest {
  const checks = [...result.event.checks, result.event.twist.check]
  return {
    event: {
      title: result.event.title,
      year: result.event.year,
      dossier: result.event.dossier,
      twist: result.event.twist.text,
    },
    cabinet: ROLES.map((role) => {
      const p = result.roster[role]
      return {
        role,
        name: p.name,
        office: p.office,
        era: p.era,
        bio: p.bio,
        traits: p.traits.slice(0, 8),
        category: p.category,
        demands: checks
          .filter((c) => c.role === role)
          .slice(0, 4)
          .map((c) => ({
            quality: c.demands,
            invert: c.invert === true,
            isTwist: c === result.event.twist.check,
            ...(c.note ? { note: c.note } : {}),
          })),
      }
    }),
    chemistry: result.chemistry.effects.slice(0, 8).map((e) => ({ text: e.text, good: e.delta >= 0 })),
    coup: result.chemistry.coup
      ? {
          usurperRole: result.chemistry.coup.usurper,
          usurperName: result.roster[result.chemistry.coup.usurper].name,
          presidentName: result.roster.President.name,
        }
      : null,
  }
}

/**
 * A shape check rather than a schema. Anything unrecognised returns null and
 * the player keeps the fallback resolution, so this only has to be sure enough
 * that a malformed reply never reaches the screen.
 */
function readReply(body: unknown, event: Resolution['event']): { verdicts: RoleVerdict[]; beats: NarrationBeat[] } | null {
  if (typeof body !== 'object' || body === null) return null
  const { verdicts, beats } = body as { verdicts?: unknown; beats?: unknown }
  if (!Array.isArray(verdicts) || !Array.isArray(beats) || beats.length === 0) return null

  // The event's own weights decide how much each post counts, not the model:
  // it judges, and the weighting of what it judged stays authored content.
  const weightFor = new Map<Role, number>()
  for (const check of [...event.checks, event.twist.check]) {
    weightFor.set(check.role, (weightFor.get(check.role) ?? 0) + (check.weight ?? 1))
  }

  const readVerdicts: RoleVerdict[] = []
  for (const raw of verdicts) {
    if (typeof raw !== 'object' || raw === null) return null
    const { role, verdict, reason } = raw as Record<string, unknown>
    if (!ROLES.includes(role as Role) || !isVerdict(verdict)) return null
    if (typeof reason !== 'string' || reason.length === 0) return null
    readVerdicts.push({ role: role as Role, verdict, reason, weight: weightFor.get(role as Role) ?? 1 })
  }
  // Every post must be judged exactly once, or the score would silently
  // weight whoever the model happened to mention twice.
  if (new Set(readVerdicts.map((v) => v.role)).size !== ROLES.length) return null

  const readBeats: NarrationBeat[] = []
  for (const raw of beats) {
    if (typeof raw !== 'object' || raw === null) return null
    const { tone, role, text } = raw as Record<string, unknown>
    if (typeof text !== 'string' || text.length === 0) return null
    if (!TONES.includes(tone as (typeof TONES)[number])) return null
    if (role !== null && !ROLES.includes(role as Role)) return null
    readBeats.push({ tone: tone as NarrationBeat['tone'], role: (role ?? null) as NarrationBeat['role'], text })
  }
  return { verdicts: readVerdicts, beats: readBeats }
}

/** Returns null whenever the judged run cannot be had, for any reason. */
export async function fetchJudgement(fallback: Resolution, signal?: AbortSignal): Promise<Judged | null> {
  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  try {
    const response = await fetch('/api/narrate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(narrationRequest(fallback)),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    })
    if (!response.ok) return null

    const reply = readReply(await response.json(), fallback.event)
    if (!reply) return null

    return {
      // Scoring, chemistry, tiering and the grid all still happen in the
      // engine. The model supplies the judgement; it does not supply the maths.
      resolution: assemble(fallback.event, fallback.roster, reply.verdicts, true),
      beats: reply.beats.map((beat, i) => ({
        id: `written-${i}`,
        tone: beat.tone,
        role: beat.role ?? undefined,
        who: beat.role ? fallback.roster[beat.role].name : undefined,
        text: beat.text,
      })),
    }
  } catch {
    return null
  }
}
