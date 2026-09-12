/**
 * What the Judgement Rating actually distributes to, for blind play and for a
 * player who knows the scoring function exactly.
 *
 * The two ends are the calibration: blind picking must sit near zero, because
 * the floor IS blind picking, and near-optimal play must sit near the top or
 * par is unreachable and the measure is decorative. Anything that moves the
 * fallback adjudicator, the draw weights or the grade bands should be checked
 * against this before it ships.
 */
import { loadEvents, loadPoliticians } from '../src/engine/content.js'
import { isDraftComplete, openRoles, startDraft } from '../src/engine/draft.js'
import { applyAction, dealHistory } from '../src/engine/replay.js'
import type { DraftAction } from '../src/engine/replay.js'
import { seedFrom } from '../src/engine/rng.js'
import { rate } from '../src/engine/rating.js'
import { judgeFor } from '../src/engine/resolve.js'
import { VERDICT_VALUE } from '../src/engine/verdict.js'
import { ROLES } from '../src/engine/types.js'
import type { GameEvent, Politician, Role, Roster } from '../src/engine/types.js'

const figures = loadPoliticians()
const events = loadEvents()

const fit = (p: Politician, role: Role, event: GameEvent) =>
  event.checks.filter((c) => c.role === role)
    .reduce((s, c) => s + VERDICT_VALUE[judgeFor(c, p, event).verdict] * (c.weight ?? 1), 0)

type Style = 'random' | 'greedy'

function play(seed: string, event: GameEvent, style: Style) {
  const rng = seedFrom(seed)
  let state = startDraft(rng, figures)
  const actions: DraftAction[] = []
  while (!isDraftComplete(state) && !state.endedBy) {
    const pickable = state.candidates.filter((c) => !c.endsRun)
    if (!pickable.length) break
    const open = openRoles(state)
    let who = pickable[0]!, role = open[0]!
    if (style === 'random') {
      who = pickable[Math.floor(Math.random() * pickable.length)]!
      role = open[Math.floor(Math.random() * open.length)]!
    } else {
      // Greedy: the best (person, open post) pair on this table, right now.
      let best = -Infinity
      for (const c of pickable) for (const r of open) {
        const v = fit(c, r, event)
        if (v > best) { best = v; who = c; role = r }
      }
    }
    const a: DraftAction = { t: 'place', id: who.id, role }
    state = applyAction(state, a); actions.push(a)
  }
  if (!isDraftComplete(state)) return null
  const deals = dealHistory(seedFrom(seed), figures, actions)
  if (!deals) return null
  const roster = Object.fromEntries(ROLES.map((r) => [r, state.picks[r]!])) as Roster
  return rate(event, roster, deals)
}

for (const style of ['random', 'greedy'] as Style[]) {
  const rs: number[] = []
  let missed = 0
  for (let i = 0; i < 2000; i++) {
    const r = play(`skill-${i}`, events[i % events.length]!, style)
    if (r) { rs.push(r.rating); missed += r.missed.length }
  }
  rs.sort((a, b) => a - b)
  const pct = (p: number) => (rs[Math.floor(rs.length * p)]! * 100).toFixed(1)
  console.log(`${style.padEnd(7)} n=${rs.length}  mean ${(rs.reduce((a,b)=>a+b,0)/rs.length*100).toFixed(1)}%  p25 ${pct(0.25)}  median ${pct(0.5)}  p75 ${pct(0.75)}  p90 ${pct(0.9)}  perfect ${(rs.filter(r=>r>=0.999).length/rs.length*100).toFixed(1)}%  missed/run ${(missed/rs.length).toFixed(2)}`)
}
