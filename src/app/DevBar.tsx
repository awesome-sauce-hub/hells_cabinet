import { EVENTS } from './data.js'
import { clearRun } from './session.js'
import type { RunRef } from './session.js'
import { randomSeed, todayKey } from '../engine/run.js'

/**
 * The testing hatch, and only that.
 *
 * One crisis a day is the rule the game is built on: the save is keyed to the
 * date, yesterday's daily is discarded on load, and there is deliberately no
 * way for a player to take today's crisis twice. That rule makes the game
 * untestable, because whoever is building it needs to run the same crisis
 * twenty times in an afternoon.
 *
 * So this is gated on import.meta.env.DEV, which Vite replaces with a literal
 * false in a production build - the branch that renders it, this module, and
 * every string in it are dropped by the bundler rather than shipped and
 * hidden. There is no flag, no key combination and no query parameter that
 * brings it back in production, which is the point: a hatch a determined
 * player can find is not a rule, it is a difficulty setting.
 *
 * The crisis picker lives here rather than in the game for the same reason. It
 * used to be a player-facing control and was removed when the daily became the
 * daily.
 */
const CSS = `
.devbar { position: fixed; left: 50%; bottom: 14px; transform: translateX(-50%); z-index: 40; display: flex; align-items: center; gap: 9px; padding: 7px 11px; background: #2a2a26f2; border-radius: 6px; box-shadow: 0 6px 18px #2a271f4d; font-size: 11px; color: #ded7c4; }
.devbar-tag { font: 9px var(--typewriter); letter-spacing: .12em; color: #b8ae8e; border: 1px solid #6d6653; border-radius: 3px; padding: 2px 5px; }
.devbar button, .devbar select { font: inherit; color: inherit; background: #45443c; border: 1px solid #61604f; border-radius: 4px; padding: 4px 9px; cursor: pointer; }
.devbar button:hover, .devbar select:hover { background: #55544a; }
.devbar code { color: #9a927c; font-size: 10px; }
.devbar .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
`

export function DevBar({ current, onStart }: {
  current: RunRef
  onStart: (next: RunRef) => void
}) {
  const replay = (ref: RunRef) => {
    // The save is what pins a finished daily in place, so it goes first.
    clearRun()
    onStart(ref)
  }
  return (
    <aside className="devbar" aria-label="Developer controls">
      {/* Inline rather than in styles.css because a stylesheet is not
          tree-shaken: rules left there would ship in production, describing a
          control that is not in the bundle. Here they leave with the module. */}
      <style>{CSS}</style>
      <span className="devbar-tag">DEV</span>
      <button onClick={() => replay({ seed: todayKey(), eventId: null })}>
        Replay today
      </button>
      <button onClick={() => replay({ seed: randomSeed(), eventId: current.eventId })}>
        Redeal
      </button>
      <label>
        <span className="sr-only">Jump to a crisis</span>
        <select
          value={current.eventId ?? ''}
          onChange={(e) => {
            const id = e.target.value
            replay(id ? { seed: randomSeed(), eventId: id } : { seed: todayKey(), eventId: null })
          }}
        >
          <option value="">Today’s crisis</option>
          {EVENTS.map((event) => (
            <option key={event.id} value={event.id}>{event.title}</option>
          ))}
        </select>
      </label>
      <code>{current.seed}</code>
    </aside>
  )
}
