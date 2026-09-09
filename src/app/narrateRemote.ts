// Types only: the schemas live with the server, and importing them here would
// pull all of zod into the game's bundle to validate one small response from
// our own endpoint.
import type { MarginBand, NarrationBeat, NarrationRequest } from '../shared/narration.js'
import type { Resolution } from '../engine/resolve.js'
import { ROLES, TONES } from '../engine/types.js'
import type { Role } from '../engine/types.js'
import type { Beat } from './narrate.js'

/** Named bands rather than raw numbers: the narrator writes, it does not score. */
function marginBand(margin: number): MarginBand {
  if (margin < -15) return 'disaster'
  if (margin < 0) return 'narrow-fail'
  if (margin < 15) return 'narrow-pass'
  return 'triumph'
}

/**
 * A shape check rather than a schema. Anything unrecognised returns null and
 * the player gets the templated story, so this only has to be sure enough that
 * a malformed beat never reaches the screen.
 */
function readBeats(body: unknown): NarrationBeat[] | null {
  if (typeof body !== 'object' || body === null) return null
  const beats = (body as { beats?: unknown }).beats
  if (!Array.isArray(beats) || beats.length === 0) return null

  const out: NarrationBeat[] = []
  for (const raw of beats) {
    if (typeof raw !== 'object' || raw === null) return null
    const { tone, role, text } = raw as Record<string, unknown>
    if (typeof text !== 'string' || text.length === 0) return null
    if (!TONES.includes(tone as (typeof TONES)[number])) return null
    if (role !== null && !ROLES.includes(role as Role)) return null
    out.push({ tone: tone as NarrationBeat['tone'], role: (role ?? null) as NarrationBeat['role'], text })
  }
  return out
}

/**
 * Ask the server for a story written about this exact cabinet.
 *
 * Everything here is best-effort. The templated narrator stays in the build as
 * the fallback, so a missing key, a rate limit, an offline player or a slow
 * response costs the player nothing worse than the game they had before.
 */
const TIMEOUT_MS = 25_000

export function narrationRequest(result: Resolution): NarrationRequest {
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
        outcomes: result.checks
          .filter((c) => c.role === role)
          .slice(0, 4)
          .map((c) => ({
            passed: c.passed,
            stat: c.check.stat_bias,
            isTwist: c.isTwist,
            margin: marginBand(c.margin),
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
    tier: result.tier,
  }
}

/** Returns null whenever the written story cannot be had, for any reason. */
export async function fetchNarration(result: Resolution, signal?: AbortSignal): Promise<Beat[] | null> {
  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  try {
    const response = await fetch('/api/narrate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(narrationRequest(result)),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    })
    if (!response.ok) return null

    const beats = readBeats(await response.json())
    if (!beats) return null

    return beats.map((beat, i) => ({
      id: `written-${i}`,
      tone: beat.tone,
      role: beat.role ?? undefined,
      who: beat.role ? result.roster[beat.role].name : undefined,
      text: beat.text,
    }))
  } catch {
    return null
  }
}
