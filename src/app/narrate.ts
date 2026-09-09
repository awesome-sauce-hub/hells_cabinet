import { seedFrom } from '../engine/rng.js'
import type { Resolution } from '../engine/resolve.js'
import type { Role, Tone } from '../engine/types.js'

/**
 * Placeholder narrator.
 *
 * The shipped game will read pre-generated prose from content/narration (see
 * the plan's step 6). This builds the same beat structure from templates so
 * the simulation screen can be built and playtested first, and so the shape
 * the generator has to fill is pinned down by working code rather than a spec.
 */
export type { Tone } from '../engine/types.js'

export interface Beat {
  id: string
  tone: Tone
  who?: string
  role?: Role
  text: string
}

const SUCCESS: Record<Role, string[]> = {
  President: [
    '{who} says almost nothing for six hours, then says the one sentence that works.',
    '{who} finds the other side a way to back down without admitting they backed down.',
  ],
  VicePresident: [
    '{who} keeps the room awake, fed, and speaking to each other.',
    '{who} quietly removes two bad options before anyone can fall in love with them.',
  ],
  General: [
    '{who} is asked for options and declines to provide the exciting one.',
    '{who} moves nothing, which turns out to be the manoeuvre.',
  ],
  PropagandaMinister: [
    '{who} reframes the whole thing before the evening bulletin.',
    'By morning {who} has everyone using a word nobody used yesterday.',
  ],
  Treasurer: [
    '{who} produces the actual number, and the actual number is survivable.',
    '{who} has already worked out who pays, and it is not us.',
  ],
}

const FAILURE: Record<Role, string[]> = {
  President: [
    '{who} decides to sleep on it. The situation does not.',
    '{who} gives a speech. It is a very good speech about the wrong problem.',
  ],
  VicePresident: [
    '{who} takes a position, then takes the opposite one to a different room.',
    '{who} is discovered to have been briefing against the plan since Tuesday.',
  ],
  General: [
    '{who} presents three options, all of which are the same option.',
    '{who} has already moved the fleet. Nobody asked {who} to move the fleet.',
  ],
  PropagandaMinister: [
    '{who} denies something nobody had accused anyone of yet.',
    "{who}'s statement is technically accurate and completely unbelievable.",
  ],
  Treasurer: [
    '{who} explains the mechanism twice. Nobody in the room is any wiser.',
    '{who} discovers the figure is worse than the figure they brought.',
  ],
}

const VERDICT: Record<string, string> = {
  Catastrophe: 'History will name this after whoever was in the room. All of you were in the room.',
  Debacle: 'It ends. That is the strongest thing that can be said for it.',
  'Muddled Through': 'Nothing was solved and nothing was lost. The papers call it steady leadership.',
  Triumph: 'It holds. Several of you will write books explaining that this was always the plan.',
  Legendary: 'They will teach this. Badly, and with your name spelled wrong, but they will teach it.',
}

function variant(options: string[], key: string): string {
  return options[Math.floor(seedFrom(key).next() * options.length)]!
}

export function narrate(result: Resolution): Beat[] {
  const beats: Beat[] = [
    { id: 'briefing', tone: 'neutral', text: result.event.dossier },
  ]

  const ordered = [...result.checks].sort((a, b) => Number(a.isTwist) - Number(b.isTwist))
  for (const c of ordered) {
    if (c.isTwist) {
      beats.push({ id: 'twist', tone: 'twist', text: result.event.twist.text })
    }
    const table = c.passed ? SUCCESS : FAILURE
    beats.push({
      id: `check-${c.role}-${c.isTwist ? 'twist' : 'main'}`,
      tone: c.passed ? 'good' : 'bad',
      who: c.politicianName,
      role: c.role,
      text: variant(table[c.role], `${result.event.id}-${c.role}-${c.politicianName}-${c.passed}`)
        .replaceAll('{who}', c.politicianName),
    })
  }

  for (const effect of result.chemistry.effects) {
    beats.push({ id: `chem-${effect.id}`, tone: effect.delta < 0 ? 'bad' : 'good', text: effect.text })
  }

  if (result.chemistry.coup) {
    const { usurper } = result.chemistry.coup
    beats.push({
      id: 'coup',
      tone: 'twist',
      role: usurper,
      text: 'Somewhere in the third week, the meetings stop being chaired by the President.',
    })
  }

  beats.push({ id: 'verdict', tone: 'neutral', text: VERDICT[result.tier]! })
  return beats
}
