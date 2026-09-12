import { ROLES } from './types.js'
import type { Check, GameEvent, Politician, Role, Roster } from './types.js'
import { judgeFor } from './resolve.js'
import { VERDICT_VALUE, VERDICTS, clamp } from './verdict.js'
import type { Deal } from './replay.js'

/**
 * How good the calls were, as distinct from how the crisis went.
 *
 * The score has always answered one question - what happened - and been asked
 * to stand in for a second one it cannot answer: whether the player played
 * well. It cannot, because it contains things they did not choose. The deal
 * decides which six faces they were ever allowed to consider, and the sealed
 * complication decides a sixth of the result out of a hat.
 *
 * So this measures the other thing, against the only fair baseline there is:
 * the cards they were actually holding. Yours against the best cabinet that
 * existed in those deals, floored at what picking blind would have got. A
 * hopeless hand played perfectly rates 100%; a gift squandered does not.
 *
 * Everything here runs on the fallback adjudicator in resolve.ts, which is
 * deterministic, offline and free. Asking the narrator to judge the thirty-odd
 * cabinets the player could have built instead would cost six runs to score
 * one. The consequence is a seam worth stating rather than hiding: the score
 * is the narrator's opinion, the rating is the engine's. They can disagree.
 * The rating is still worth having because it is *relative* - you against your
 * own alternatives, under one consistent judge - and because the thing that
 * judge measures, trait against demand, is exactly the learnable part.
 */

export const GRADES = [
  'Negligent',
  'Questionable',
  'Defensible',
  'Sound Appointments',
  'Nothing Better Was There',
] as const
export type Grade = (typeof GRADES)[number]

/** A call that was there to be made, and was not. */
export interface MissedCall {
  role: Role
  chosen: Politician
  /** Who else was on that same table and would have done better. */
  better: Politician
  /** What the crisis wanted of the post, already phrased. */
  wanted: string
  /** Whole verdict steps between them, 1-3. */
  steps: number
}

export interface Rating {
  /** 0-1. Where your cabinet sits between blind picking and the best available. */
  rating: number
  grade: Grade
  /** Your cabinet's fit, 0-100, twist excluded. */
  yours: number
  /** The best cabinet available in the deals you were shown, 0-100. */
  par: number
  /** What picking at random out of those same deals averages, 0-100. */
  floor: number
  missed: MissedCall[]
}

/**
 * The demands a post carries that a player could have known about.
 *
 * The complication is excluded here and only here. It stays sealed, it still
 * counts toward the score, and it is simply not evidence about judgement -
 * nobody can be graded on a demand the briefing is built to withhold. That
 * exclusion also makes fit separable from chemistry, which is what lets par be
 * computed exactly rather than sampled.
 */
function knownChecks(event: GameEvent, role: Role): Check[] {
  return event.checks.filter((c) => c.role === role)
}

/** Total weight on the board once the complication is set aside. */
function knownWeight(event: GameEvent): number {
  return event.checks.reduce((sum, c) => sum + (c.weight ?? 1), 0)
}

/**
 * What this person in this post is worth, in raw weighted points.
 *
 * Not normalised, because every assignment covers all six posts exactly once -
 * the denominator is a constant and only matters when a number reaches the
 * screen.
 */
function fit(p: Politician, role: Role, event: GameEvent): number {
  let points = 0
  for (const check of knownChecks(event, role)) {
    points += VERDICT_VALUE[judgeFor(check, p, event).verdict] * (check.weight ?? 1)
  }
  return points
}

/** Mean verdict index for a post, 0-3, or null where the crisis asked nothing. */
function standing(p: Politician, role: Role, event: GameEvent): number | null {
  const checks = knownChecks(event, role)
  if (checks.length === 0) return null
  let total = 0
  for (const check of checks) total += VERDICTS.indexOf(judgeFor(check, p, event).verdict)
  return total / checks.length
}

/**
 * The best assignment of the deals to the posts.
 *
 * Six waves, six posts, and every permutation is legal: a wave can be given any
 * post no earlier wave took, and distinct posts guarantee that. So the optimum
 * is the best of 6! = 720 orderings over a 6x6 matrix of each wave's strongest
 * candidate for each post - exact, and fast enough that nobody notices it.
 */
function bestAssignment(deals: readonly Deal[], event: GameEvent): number {
  const best = deals.map((deal) =>
    ROLES.map((role) => Math.max(...deal.table.map((c) => fit(c, role, event)))),
  )

  let top = 0
  const taken = new Array(ROLES.length).fill(false)
  const walk = (wave: number, running: number): void => {
    if (wave === deals.length) {
      if (running > top) top = running
      return
    }
    for (let r = 0; r < ROLES.length; r++) {
      if (taken[r]) continue
      taken[r] = true
      walk(wave + 1, running + best[wave]![r]!)
      taken[r] = false
    }
  }
  walk(0, 0)
  return top
}

/** What picking blind out of these same deals averages, by linearity. */
function blindAverage(deals: readonly Deal[], event: GameEvent): number {
  const seen = deals.flatMap((d) => d.table)
  if (seen.length === 0) return 0
  let total = 0
  for (const role of ROLES) {
    total += seen.reduce((sum, c) => sum + fit(c, role, event), 0) / seen.length
  }
  return total
}

export function gradeFor(rating: number): Grade {
  if (rating >= 0.95) return 'Nothing Better Was There'
  if (rating >= 0.8) return 'Sound Appointments'
  if (rating >= 0.6) return 'Defensible'
  if (rating >= 0.35) return 'Questionable'
  return 'Negligent'
}

/**
 * The calls where somebody visibly better was sitting on the same table.
 *
 * Deliberately quiet. Only a gap of a whole verdict word counts, the
 * complication's post is never second-guessed because its demand was withheld,
 * and at most two are ever shown: six of these is not a debrief, it is a
 * telling-off, and a player who is being told off stops reading.
 */
function missedCalls(deals: readonly Deal[], event: GameEvent, limit = 2): MissedCall[] {
  const found: MissedCall[] = []

  for (const deal of deals) {
    const mine = standing(deal.chosen, deal.role, event)
    if (mine === null) continue

    let better: Politician | null = null
    let bestStanding = mine
    for (const other of deal.table) {
      if (other.id === deal.chosen.id) continue
      const theirs = standing(other, deal.role, event)
      if (theirs !== null && theirs > bestStanding) {
        bestStanding = theirs
        better = other
      }
    }

    const steps = Math.floor(bestStanding - mine)
    if (!better || steps < 1) continue

    const check = knownChecks(event, deal.role)[0]!
    found.push({
      role: deal.role,
      chosen: deal.chosen,
      better,
      wanted: check.note ?? check.demands,
      steps,
    })
  }

  return found.sort((a, b) => b.steps - a.steps).slice(0, limit)
}

/**
 * Rate a finished run against the deals it was played from.
 *
 * Returns null when there is nothing to rate against - a draft that never
 * finished, or a crisis whose demands leave no room between blind picking and
 * the best possible, which would make the ratio meaningless rather than
 * flattering.
 */
export function rate(event: GameEvent, roster: Roster, deals: readonly Deal[]): Rating | null {
  if (deals.length !== ROLES.length) return null

  const scale = knownWeight(event)
  if (scale === 0) return null
  const asPoints = (raw: number) => (raw / scale) * 100

  const yours = asPoints(ROLES.reduce((sum, role) => sum + fit(roster[role], role, event), 0))
  const par = asPoints(bestAssignment(deals, event))
  const floor = asPoints(blindAverage(deals, event))

  // No daylight between luck and skill means there was no decision to rate.
  if (par - floor < 1) return null

  const rating = clamp((yours - floor) / (par - floor), 0, 1)
  return { rating, grade: gradeFor(rating), yours, par, floor, missed: missedCalls(deals, event) }
}
