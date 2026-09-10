import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { Politician, Role } from '../engine/types.js'
import portraitSources from './portraits.json'

export const ROLE_LABEL: Record<Role, string> = {
  President: 'President',
  VicePresident: 'Vice President',
  General: 'General',
  PropagandaMinister: 'Propaganda Minister',
  Treasurer: 'Treasurer',
}

export function Icon({ name, size = 18 }: { name: 'arrow' | 'shuffle' | 'check' | 'close' | 'help' | 'file' | 'pin'; size?: number }) {
  const paths = {
    arrow: <><path d="M4 12h15M13 6l6 6-6 6" /></>,
    shuffle: <><path d="m17 3 4 4-4 4M3 17h3c5 0 7-10 12-10h3M3 7h3c2 0 3 1 4 3m4 4c1 2 2 3 4 3h3m-4-4 4 4-4 4" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4m0 3h.01" /></>,
    file: <><path d="M14 3H5v18h14V8l-5-5Zm0 0v5h5M8 12h8m-8 4h6" /></>,
    pin: <><path d="m15 3 6 6-4 1-3 4-1 4-7-7 4-1 4-3 1-4ZM3 21l6-6" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

export function Portrait({ figure, compact = false }: { figure: Politician; compact?: boolean }) {
  const [failed, setFailed] = useState(false)
  const src = (portraitSources as Record<string, string>)[figure.id]
  return (
    <span className={`portrait portrait-${figure.category} ${compact ? 'portrait-small' : ''}`}>
      {src && !failed ? (
        <img src={src} alt={figure.name} draggable={false} onError={() => setFailed(true)} />
      ) : (
        <span className="portrait-fallback" role="img" aria-label={`Portrait unavailable for ${figure.name}`}>
          <svg viewBox="0 0 120 130" fill="currentColor" aria-hidden="true"><circle cx="60" cy="40" r="23" /><path d="M16 125v-16c0-29 18-43 44-43s44 14 44 43v16z" /></svg>
          {!compact && <span>Photo not on file</span>}
        </span>
      )}
    </span>
  )
}

/** Selection and dismissal are sibling buttons so both work with touch and keyboards. */
export function CandidateCard({ figure, selected, onSelect, onDragSelect, onBench, canBench, index }: {
  figure: Politician
  selected: boolean
  onSelect: () => void
  onDragSelect: () => void
  onBench: () => void
  canBench: boolean
  index: number
}) {
  return (
    <article className={`candidate ${selected ? 'selected' : ''}`} style={{ '--tilt': `${[-1.4, 1, -0.8, 1.1, -1.2, 1.5][index]}deg` } as CSSProperties}>
      <button className="candidate-select" draggable onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', figure.id)
        e.dataTransfer.effectAllowed = 'move'
        onDragSelect()
      }} onClick={onSelect} aria-pressed={selected} aria-label={`Select ${figure.name}`} aria-describedby={`bio-${figure.id}`}>
        <span className="pushpin" aria-hidden="true" />
        <Portrait figure={figure} />
        <span className="candidate-body">
          <span className="candidate-name">{figure.name}</span>
          <span className="candidate-office">{figure.office} · {figure.era}</span>
          <span className="candidate-bio" id={`bio-${figure.id}`}>{figure.bio}</span>
        </span>
        {selected && <span className="selected-mark" aria-hidden="true"><Icon name="check" size={14} /></span>}
      </button>
      {/* Traits drive the scoring, not the pitch: the player judges a
          candidate on the name and the write-up, and finds out the rest in
          the room. */}
      <div className="candidate-footer">
        <button className="bench-btn" disabled={!canBench} onClick={onBench} aria-label={`Bench ${figure.name}`} title={canBench ? 'Replace this candidate (one per game)' : 'Bench already used'}><Icon name="close" size={14} /></button>
      </div>
    </article>
  )
}

export function SlotStrip({ order, picks, armed = false, selectedName, onPlace, heading = 'Your cabinet', note, activeRole, demands }: {
  order: readonly Role[]
  picks: Partial<Record<Role, Politician>>
  armed?: boolean
  selectedName?: string
  onPlace?: (role: Role, figureId?: string) => void
  heading?: string
  note?: ReactNode
  /** Lit while this role is the one acting, during the simulation. */
  activeRole?: Role
  /**
   * What the crisis wants from each post, shown on the seats still vacant.
   * The player is choosing which chair to put someone in, so the chair is
   * where the demand has to be legible - reading it once on the briefing and
   * then holding five of them in your head is not a decision, it is a memory
   * test.
   */
  demands?: Partial<Record<Role, { text: string }>>
}) {
  const [over, setOver] = useState<Role | null>(null)
  return (
    <div className="cabinet-rail">
      <div className="rail-heading">{heading}</div>
      <div className="slots">
        {order.map((role, index) => {
          const picked = picks[role]
          const demand = demands?.[role]
          const droppable = !picked && armed
          const inner = (
            <>
              <span className="role-number" aria-hidden="true">0{index + 1}</span>
              <span className="role-label">{ROLE_LABEL[role]}</span>
              <span className="slot-content">
                {picked ? <><Portrait key={picked.id} figure={picked} compact /><span className="appointed-name">{picked.name}<span className="appointed-label"><Icon name="check" size={10} /> Appointed</span></span></> : <><span className="empty-photo" aria-hidden="true"><Icon name="pin" size={19} /></span><span className="slot-prompt">{droppable ? 'Pin here' : 'Position vacant'}</span></>}
                {!picked && demand && <span className="slot-demand">{demand.text}</span>}
              </span>
            </>
          )
          const className = `slot ${picked ? 'filled' : ''} ${droppable ? 'droppable' : ''} ${over === role && droppable ? 'over' : ''} ${activeRole === role ? 'speaking' : ''}`
          const wants = demand ? `, wants ${demand.text}` : ''
          const label = picked ? `${ROLE_LABEL[role]}: ${picked.name}` : selectedName ? `Appoint ${selectedName} as ${ROLE_LABEL[role]}${wants}` : `${ROLE_LABEL[role]}, vacant${wants}`

          // Once the draft is over the rail is a record, not a control: a plain
          // element keeps five dead buttons out of the keyboard's way.
          if (!onPlace) return <div className={className} key={role} aria-label={label}>{inner}</div>

          return (
            <button className={className} key={role} aria-label={label}
              aria-disabled={!droppable} onClick={() => droppable && onPlace(role)}
              onDragOver={(e) => { if (picked || !armed) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOver(role) }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null) }}
              onDrop={(e) => { e.preventDefault(); setOver(null); if (droppable) onPlace(role, e.dataTransfer.getData('text/plain')) }}>
              {inner}
            </button>
          )
        })}
      </div>
      <p className="rail-note">{note ?? <>Choose wisely.<br />History is watching.</>}</p>
    </div>
  )
}
