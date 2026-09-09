export const STATS = ['charisma', 'cunning', 'integrity', 'grit', 'intellect', 'force'] as const
export type Stat = (typeof STATS)[number]

/** Column labels for the verdict table. Truncation collides on int*. */
export const STAT_ABBR: Record<Stat, string> = {
  charisma: 'CHA',
  cunning: 'CUN',
  integrity: 'INTEG',
  grit: 'GRIT',
  intellect: 'MIND',
  force: 'FORCE',
}

export const ROLES = [
  'President',
  'VicePresident',
  'General',
  'PropagandaMinister',
  'Treasurer',
] as const
export type Role = (typeof ROLES)[number]

/** Stat values are 1-10, hand-assigned or derived from the ingest pipeline. */
export type StatBlock = Record<Stat, number>

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
 * How many stat points a figure is allowed to spend. Strength is still bought
 * with weakness inside a tier, but tiers are not equal: a titan really is
 * better than a liability, because a roster where every card costs the same
 * reads as a spreadsheet rather than a cast. Titans are drawn rarely to pay for
 * it - see POWER_RARITY in draft.ts.
 */
export const POWER_BUDGETS = {
  titan: 46,
  heavyweight: 43,
  operator: 40,
  flawed: 36,
  liability: 32,
} as const
export const POWER_TIERS = Object.keys(POWER_BUDGETS) as (keyof typeof POWER_BUDGETS)[]
/** Not to be confused with resolve.ts's outcome tiers. This is card strength. */
export type PowerTier = keyof typeof POWER_BUDGETS

export interface Politician {
  id: string
  category: Category
  tier: PowerTier
  alignment: Alignment
  name: string
  country: string
  era: string
  office: string
  /** One line of satire. Shown on the card; stats are not. */
  bio: string
  stats: StatBlock
  /** Visible on the card. Drives chemistry and narration variants. */
  traits: string[]
  /** Ids of politicians this one cannot work with. */
  rivals?: string[]
  party?: string
  /**
   * Drafting this figure ends the run on the spot. A punchline, not a
   * mechanic to build around: exactly one figure should carry it, and the card
   * must give the player fair warning in its bio.
   */
  endsRun?: string
  reviewed: boolean
}

export interface Check {
  role: Role
  stat_bias: Stat
  dc: number
  /** When true the event punishes a high stat: restraint beats firepower. */
  invert?: boolean
  /** Relative importance within the event. Defaults to 1. */
  weight?: number
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
