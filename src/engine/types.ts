export const STATS = ['charisma', 'cunning', 'integrity', 'grit', 'intellect', 'force'] as const
export type Stat = (typeof STATS)[number]

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

export interface Politician {
  id: string
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
