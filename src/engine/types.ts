/**
 * What a crisis can put under strain.
 *
 * These are qualities a crisis demands, not numbers a figure carries. Nobody
 * is assigned a charisma of 7: the adjudicator is told the canal demanded
 * nerve of its General and decides, knowing who that General actually was,
 * whether they had it. Hand-assigning the numbers was the thing that made
 * every figure equally gritty and no figure recognisably themselves.
 */
export const QUALITIES = ['charisma', 'cunning', 'integrity', 'grit', 'intellect', 'force'] as const
export type Quality = (typeof QUALITIES)[number]

/** How a crisis phrases what it wanted, for the briefing and the verdict. */
export const QUALITY_LABEL: Record<Quality, string> = {
  charisma: 'the room won over',
  cunning: 'the angle nobody else saw',
  integrity: 'the honest answer',
  grit: 'holding the line',
  intellect: 'the numbers understood',
  force: 'the decision taken',
}

export const ROLES = [
  'President',
  'VicePresident',
  'General',
  'PropagandaMinister',
  'Treasurer',
] as const
export type Role = (typeof ROLES)[number]

export const CATEGORIES = ['politician', 'wildcard', 'object'] as const
/**
 * Wildcards are the non-politicians - fictional characters, internet figures,
 * anyone the Wikidata scrape will never produce. Objects are furniture and
 * consumer goods that somehow ended up in the cabinet. Both exist because the
 * comedy lives in mismatch, and both are drawn at a reduced rate so finding one
 * on the board stays an event rather than the norm.
 */
export type Category = (typeof CATEGORIES)[number]

/** How a beat of the resolution reads. Shared by the templated and written narrators. */
export const TONES = ['good', 'bad', 'twist', 'neutral'] as const
export type Tone = (typeof TONES)[number]

export const ALIGNMENTS = ['good', 'bad', 'neutral'] as const
/**
 * How history remembers them, which is separate from how strong the card is.
 * Both ends of this axis are drawn rarely - a board should mostly be the
 * unremarkable middle, so that a genuine reformer or a genuine monster landing
 * in your six feels like weather changing. See ALIGNMENT_RARITY in draft.ts.
 */
export type Alignment = (typeof ALIGNMENTS)[number]

/**
 * Roughly how much weight a figure throws around, kept after the stat budgets
 * were dropped because it is still what makes a board feel uneven: a titan
 * should be luck and a liability the ordinary weather. It now only sets draw
 * rarity (POWER_RARITY in draft.ts) and gives the fallback adjudicator a
 * coarse sense of who was out of their depth.
 */
export const POWER_TIERS = ['titan', 'heavyweight', 'operator', 'flawed', 'liability'] as const
/** Not to be confused with the outcome tiers in verdict.ts. This is card strength. */
export type PowerTier = (typeof POWER_TIERS)[number]

export interface Politician {
  id: string
  category: Category
  tier: PowerTier
  alignment: Alignment
  name: string
  country: string
  era: string
  office: string
  /** One line of satire, and the only description the adjudicator is given. */
  bio: string
  /** Visible on the card. Drives chemistry and the fallback adjudicator. */
  traits: string[]
  /** Ids of politicians this one cannot work with. */
  rivals?: string[]
  party?: string
  /**
   * Drafting this figure can end the run on the spot. A punchline, not a
   * mechanic to build around: exactly one figure should carry it, and the card
   * must give the player fair warning in its bio.
   */
  endsRun?: string
  /**
   * How often endsRun actually fires, 0-1. Absent means every time.
   *
   * A certainty is not a gamble - the card reads as a trap to step around
   * rather than a risk to weigh. At long odds the same figure becomes a bet
   * the player can talk themselves into, which is the joke working harder.
   */
  endsRunChance?: number
  reviewed: boolean
}

/** One thing the crisis asks of one post. */
export interface Check {
  role: Role
  /** The quality the crisis puts under strain. */
  demands: Quality
  /** When true the crisis punishes the quality: restraint beats firepower. */
  invert?: boolean
  /** Relative importance within the event. Defaults to 1. */
  weight?: number
  /** What is actually being asked, in words. The adjudicator reads this. */
  note?: string
}

export interface Twist {
  id: string
  text: string
  check: Check
}

export interface GameEvent {
  id: string
  title: string
  year: number
  dossier: string
  /** Shown pre-draft. Flavour only - never numbers. */
  briefing_hint: string
  spotlight: Role[]
  checks: Check[]
  /** Hidden until Act 2. */
  twist: Twist
  tags: string[]
}

export type Roster = Record<Role, Politician>
