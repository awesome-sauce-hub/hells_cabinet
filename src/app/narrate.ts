import { seedFrom } from '../engine/rng.js'
import type { Resolution } from '../engine/resolve.js'
import type { Role, Tone } from '../engine/types.js'

/**
 * The fallback narrator.
 *
 * Two variants per post per outcome, written to fit anybody - which is exactly
 * why it is no longer the narrator. It stays in the build because the game has
 * to remain playable with no key and no network, and a blunt story is better
 * than a blank screen. See docs/NARRATOR.md.
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
  Spymaster: [
    '{who} knew about it on Tuesday and says so before anyone has to ask.',
    '{who} produces the file, and the file is the one that settles it.',
  ],
  General: [
    '{who} is asked for options and declines to provide the exciting one.',
    '{who} moves nothing, which turns out to be the manoeuvre.',
  ],
  AttorneyGeneral: [
    '{who} finds the power was there all along, in an act nobody had read since 1912.',
    '{who} says it is lawful, and is willing to put that in writing.',
  ],
  PressSecretary: [
    '{who} reframes the whole thing before the evening bulletin.',
    'By morning {who} has everyone using a word nobody used yesterday.',
  ],
  Chancellor: [
    '{who} produces the actual number, and the actual number is survivable.',
    '{who} has already worked out who pays, and it is not us.',
  ],
}

const FAILURE: Record<Role, string[]> = {
  President: [
    '{who} decides to sleep on it. The situation does not.',
    '{who} gives a speech. It is a very good speech about the wrong problem.',
  ],
  Spymaster: [
    '{who} knew about it on Tuesday and mentions this on Friday.',
    '{who} has a file on everyone in the room and it is the only thing they brought.',
  ],
  General: [
    '{who} presents three options, all of which are the same option.',
    '{who} has already moved the fleet. Nobody asked {who} to move the fleet.',
  ],
  AttorneyGeneral: [
    '{who} advises that it is legal, having been asked whether it is legal by the person who wants it.',
    '{who} discovers the power exists only in the version of the act that was never passed.',
  ],
  PressSecretary: [
    '{who} denies something nobody had accused anyone of yet.',
    "{who}'s statement is technically accurate and completely unbelievable.",
  ],
  Chancellor: [
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

  const twistRole = result.event.twist.check.role
  let twistShown = false
  for (const v of result.verdicts) {
    if (v.role === twistRole && !twistShown) {
      twistShown = true
      beats.push({ id: 'twist', tone: 'twist', text: result.event.twist.text })
    }
    const who = result.roster[v.role].name
    const went = v.verdict === 'triumph' || v.verdict === 'pass'
    beats.push({
      id: `verdict-${v.role}`,
      tone: went ? 'good' : 'bad',
      who,
      role: v.role,
      text: variant((went ? SUCCESS : FAILURE)[v.role], `${result.event.id}-${v.role}-${who}-${v.verdict}`)
        .replaceAll('{who}', who),
    })
  }

  for (const effect of result.chemistry.effects) {
    beats.push({ id: `chem-${effect.id}`, tone: effect.delta < 0 ? 'bad' : 'good', text: effect.text })
  }

  if (result.chemistry.coup) {
    beats.push({
      id: 'coup',
      tone: 'twist',
      role: result.chemistry.coup.usurper,
      text: 'Somewhere in the third week, the meetings stop being chaired by the President.',
    })
  }

  beats.push({ id: 'verdict', tone: 'neutral', text: VERDICT[result.tier]! })
  return beats
}
