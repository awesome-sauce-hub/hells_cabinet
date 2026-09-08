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

export const CATEGORIES = ['politician', 'wildcard'] as const
/**
 * Wildcards are the non-politicians - fictional characters, internet figures,
 * anyone the Wikidata scrape will never produce. They exist because the comedy
 * lives in mismatch, and they are drawn at a reduced rate so a wildcard on the
 * board stays an event rather than the norm.
 */
export type Category = (typeof CATEGORIES)[number]

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

/**
 * The card shows a figure's tier as 1-5 stars. Individual stats stay hidden
 * until the verdict; the stars are the one honest signal that a titan will do
 * more for you than a liability, whatever the event turns out to ask for.
 */
export const POWER_STARS: Record<PowerTier, number> = {
  titan: 5,
  heavyweight: 4,
  operator: 3,
  flawed: 2,
  liability: 1,
}

export interface Politician {
  id: string
  category: Category
  tier: PowerTier
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
