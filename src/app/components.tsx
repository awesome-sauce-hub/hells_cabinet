import { useState } from 'react'
import type { Politician, Role } from '../engine/types.js'

export const ROLE_LABEL: Record<Role, string> = {
  President: 'President',
  VicePresident: 'Vice President',
  General: 'General',
  PropagandaMinister: 'Propaganda Minister',
  Treasurer: 'Treasurer',
}

/**
 * A name, and one line on what they did with their life. Nothing else reaches
 * the card - no stats, no strength rating, no traits, not even a badge saying
 * whether they are real. Anything sortable would collapse an event-first draft
 * into picking the best-looking row; a life has to be read and judged. Every
 * number behind the figure surfaces only in the verdict.
 */
/** Two-letter monogram, standing in until portraits exist. */
function initials(name: string): string {
  const words = name
    .replace(/^(a|an|the|de|von)\s+/i, '')
    .split(/\s+/)
    .filter((w) => /[a-z]/i.test(w))
  if (words.length === 0) return '??'
  // Single-word names ("MrBeast", "Cleopatra") need two letters of their own.
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase()
  return words.slice(0, 2).map((w) => w[0]!.toUpperCase()).join('')
}

export function CandidateCard({
  figure,
  selected,
  onSelect,
  onBench,
  canBench,
}: {
  figure: Politician
  selected: boolean
  onSelect: () => void
  onBench: () => void
  canBench: boolean
}) {
  return (
    <button
      className={`card ${figure.category} ${selected ? 'selected' : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', figure.id)
        e.dataTransfer.effectAllowed = 'move'
        onSelect()
      }}
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`Select ${figure.name}`}
    >
      <div className="mono" aria-hidden>{initials(figure.name)}</div>
      {figure.category !== 'politician' && (
        <span className="badge">{figure.category === 'object' ? 'OBJECT' : 'WILD'}</span>
      )}
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

/**
 * The five posts, doubling as drop targets. Dragging is the intended gesture;
 * tapping a card then tapping a post does the same thing, because drag events
 * do not exist on touch.
 */
export function SlotStrip({
  order,
  picks,
  armed,
  onPlace,
}: {
  order: readonly Role[]
  picks: Partial<Record<Role, Politician>>
  /** True while a card is selected or being dragged, to light up the targets. */
  armed: boolean
  onPlace?: (role: Role, figureId?: string) => void
}) {
  const [over, setOver] = useState<Role | null>(null)
  return (
    <div className="slots">
      {order.map((role) => {
        const picked = picks[role]
        const open = !picked
        const droppable = open && armed
        const classes = [
          'slot',
          picked ? 'filled' : '',
          droppable ? 'droppable' : '',
          over === role && droppable ? 'over' : '',
        ]
          .filter(Boolean)
          .join(' ')
        return (
          <div
            className={classes}
            key={role}
            onDragOver={(e) => {
              if (!open) return
              e.preventDefault()
              setOver(role)
            }}
            onDragLeave={() => setOver((r) => (r === role ? null : r))}
            onDrop={(e) => {
              e.preventDefault()
              setOver(null)
              if (open) onPlace?.(role, e.dataTransfer.getData('text/plain') || undefined)
            }}
            onClick={() => open && onPlace?.(role)}
            role={droppable ? 'button' : undefined}
            tabIndex={droppable ? 0 : undefined}
            onKeyDown={(e) => {
              if (droppable && (e.key === 'Enter' || e.key === ' ')) onPlace?.(role)
            }}
          >
            <div className="label">{ROLE_LABEL[role]}</div>
            <div className={`who ${picked ? '' : 'empty'}`}>
              {picked ? picked.name : droppable ? 'place here' : '—'}
            </div>
          </div>
        )
      })}
    </div>
  )
}
