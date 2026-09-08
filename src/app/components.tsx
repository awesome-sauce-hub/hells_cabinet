import type { Politician, Role } from '../engine/types.js'
import { POWER_STARS } from '../engine/types.js'

export const ROLE_LABEL: Record<Role, string> = {
  President: 'President',
  VicePresident: 'Vice President',
  General: 'General',
  PropagandaMinister: 'Propaganda Minister',
  Treasurer: 'Treasurer',
}

function initials(name: string): string {
  const words = name
    .replace(/^(the|de|von)\s+/i, '')
    .split(/\s+/)
    .filter((w) => /[a-z]/i.test(w))
  if (words.length === 0) return '??'
  // Single-word names ("MrBeast", "Cleopatra") need two letters of their own.
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase()
  return words.slice(0, 2).map((w) => w[0]!.toUpperCase()).join('')
}

/** Tier as 1-5 stars. Coarse on purpose: strength, not a stat readout. */
export function Stars({ figure }: { figure: Politician }) {
  const filled = POWER_STARS[figure.tier]
  return (
    <span className="stars" title={`${figure.tier} (${filled}/5)`} aria-label={`${filled} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span className={n <= filled ? 'star on' : 'star'} key={n} aria-hidden>
          {n <= filled ? '\u2605' : '\u2606'}
        </span>
      ))}
    </span>
  )
}

/**
 * Individual stats are deliberately absent. The player reads the person -
 * office, era, bio, traits and an overall star rating - and finds out the
 * numbers only in the verdict.
 */
export function CandidateCard({
  figure,
  onPick,
  onBench,
  canBench,
}: {
  figure: Politician
  onPick: () => void
  onBench: () => void
  canBench: boolean
}) {
  return (
    <button
      className={`card ${figure.category}`}
      onClick={onPick}
      aria-label={`Draft ${figure.name}`}
    >
      <div className="mono" aria-hidden>{initials(figure.name)}</div>
      {figure.category === 'wildcard' && <span className="badge">WILD</span>}
      {canBench && (
        <span
          className="bench-btn"
          role="button"
          tabIndex={0}
          title="Discard this candidate and draw a replacement"
          onClick={(e) => { e.stopPropagation(); onBench() }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onBench() } }}
        >
          bench
        </span>
      )}
      <span className="body">
        <span className="name">{figure.name}</span>
        <span className="office">{figure.office} · {figure.era}</span>
        <Stars figure={figure} />
        <span className="bio">{figure.bio}</span>
        <span className="traits">
          {figure.traits.map((t) => (
            <span className="trait" key={t}>{t}</span>
          ))}
        </span>
      </span>
    </button>
  )
}

export function SlotStrip({
  order,
  picks,
  activeIndex,
}: {
  order: readonly Role[]
  picks: Partial<Record<Role, Politician>>
  activeIndex: number
}) {
  return (
    <div className="slots">
      {order.map((role, i) => {
        const picked = picks[role]
        const state = picked ? 'filled' : i === activeIndex ? 'active' : ''
        return (
          <div className={`slot ${state}`} key={role}>
            <div className="label">{ROLE_LABEL[role]}</div>
            <div className={`who ${picked ? '' : 'empty'}`}>{picked ? picked.name : '—'}</div>
            {picked && <Stars figure={picked} />}
          </div>
        )
      })}
    </div>
  )
}
