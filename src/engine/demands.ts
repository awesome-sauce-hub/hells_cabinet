import { QUALITY_LABEL, ROLES } from './types.js'
import type { Check, GameEvent, Role } from './types.js'

/**
 * What the crisis is asking of each post, in words the player can act on.
 *
 * The events have carried this all along in Check.note - "restraint under
 * pressure", "a ladder for the other side to climb down" - and nothing ever
 * showed it. That was the whole of the game feeling luck-based: the adjudicator
 * judges the real person against the real demand, so a player who knows who
 * these people were should be able to win, but they were never told what the
 * chair wanted. Knowing history had nothing to attach to.
 *
 * The twist's check is deliberately absent. The complication stays sealed until
 * Act 2 - that is the part that is meant to be luck, and it is only fair as
 * luck once everything else is knowledge.
 */
export interface Demand {
  role: Role
  /** The phrase to show. Already accounts for inverted checks. */
  text: string
  /** Whether the crisis leans on this post or merely glances at it. */
  weight: number
  /**
   * Why the post mattered when this actually happened, where the event says.
   *
   * Kept beside the demand rather than in a debrief because it is the thing
   * that turns the list from a checklist into a reason. The demand says the
   * Attorney-General wants a blockade called something else; this says that
   * Kennedy's lawyers really did rename it a quarantine, and why the word was
   * the difference between a police action and a declaration of war.
   */
  why?: string
}

function phrase(check: Check): string {
  const what = check.note ?? QUALITY_LABEL[check.demands]
  return check.invert ? `${what} — and no appetite for ${check.demands}` : what
}

/**
 * Ordered as the cabinet is, so the list reads against the seats beside it.
 * Posts this crisis never tests are omitted rather than shown as empty: a
 * vacancy the crisis ignores is a real thing to discover, not a gap in the
 * briefing.
 */
export function demandsFor(event: GameEvent): Demand[] {
  return ROLES.flatMap((role) => {
    const checks = event.checks.filter((c) => c.role === role)
    if (checks.length === 0) return []
    // Heaviest first: if a post is asked two things, the briefing should lead
    // with the one that decides it.
    const sorted = [...checks].sort((a, b) => (b.weight ?? 1) - (a.weight ?? 1))
    return [{
      role,
      text: sorted.map(phrase).join(', and '),
      weight: sorted[0]!.weight ?? 1,
      // The heaviest check's reason, matching the phrasing order above.
      ...(sorted[0]!.why ? { why: sorted[0]!.why } : {}),
    }]
  })
}

/** The same thing keyed by post, for the draft's seats. */
export function demandByRole(event: GameEvent): Partial<Record<Role, Demand>> {
  return Object.fromEntries(demandsFor(event).map((d) => [d.role, d]))
}
