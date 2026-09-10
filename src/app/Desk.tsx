import { useState } from 'react'
import type { GameEvent } from '../engine/types.js'
import { Icon, ROLE_LABEL, Rulebook } from './components.js'
import { demandsFor } from '../engine/demands.js'
import { EVENT_LOCATIONS, MAP_HEIGHT, MAP_WIDTH, mapFrame, mapPoint } from './eventLocations.js'

export function Masthead({ isDaily, seed }: { isDaily: boolean; seed: string }) {
  const [help, setHelp] = useState(false)
  return (
    <>
      <header className="masthead">
        <div className="edition"><span className="edition-dot" />{isDaily ? 'The daily cabinet game' : 'An unscheduled cabinet meeting'}<span>{isDaily ? seed.split('-').reverse().join('.') : 'Free play'}</span></div>
        <div className="wordmark"><h1>Hell’s Cabinet<span className="wordmark-dot">.</span></h1><p>Great power. Questionable personnel.</p></div>
        <button className="help-button" onClick={() => setHelp(!help)} aria-expanded={help} aria-controls="how-to-play"><Icon name={help ? 'close' : 'help'} />How to play</button>
      </header>
      {help && (
        <section className="help-sheet" id="how-to-play" aria-label="How to play">
          <h2>A quick briefing</h2>
          <p>Read the crisis, then appoint one of six candidates to any vacant post. Drag their photo onto a post, or select a photo and then select a post. Keyboard players can use Tab and Enter or Space. Fill all six seats to see how your cabinet handles the crisis.</p>
          <Rulebook />
        </section>
      )}
    </>
  )
}

export function DeskAside({ event, showBriefing }: { event: GameEvent; showBriefing: boolean }) {
  const location = EVENT_LOCATIONS[event.id]
  const frame = mapFrame(location)
  return (
    <aside className="desk-aside" aria-label="Map and briefing">
      <figure className="wall-map">
        <span className="pushpin" aria-hidden="true" />
        <h2>On the map</h2>
        <div className="map-plate">
          <svg className="event-map" viewBox={frame.viewBox} role="img" aria-label={`${event.title}: ${location?.label ?? 'location not yet mapped'}`}>
            <image href="/maps/world.svg" width={MAP_WIDTH} height={MAP_HEIGHT} />
            {location?.points.map((point, index) => {
              const { x, y } = mapPoint(point)
              // The inner scale cancels the frame's zoom, so the ring is drawn
              // at one size on screen however close the map is framed.
              return <g key={index} className="event-circle" transform={`translate(${x} ${y}) scale(${frame.markerScale})`}>
                <ellipse rx="14" ry="11" transform="rotate(-17)" /><ellipse rx="15.5" ry="10.5" transform="rotate(9)" opacity=".45" />
                <circle r="2.4" fill="currentColor" stroke="none" />
              </g>
            })}
          </svg>
          <span className="map-compass" aria-hidden="true"><svg viewBox="0 0 40 48" fill="none"><path d="m20 9 5 14-5-3-5 3 5-14Z" fill="currentColor" /><path d="m20 35 5-12-5 3-5-3 5 12Z" stroke="currentColor" strokeWidth=".8"/><text x="20" y="6" fill="currentColor" fontSize="6" textAnchor="middle">N</text></svg></span>
        </div>
        <figcaption>{location?.label ?? 'Location not yet mapped'}</figcaption>
        <p className="map-event-year">{event.year}{location?.note ? ` · ${location.note}` : ''}</p>
      </figure>
      {showBriefing ? (
        <section className="desk-memo">
          <span className="pushpin" aria-hidden="true" /><span className="paperclip" aria-hidden="true" />
          <h2><Icon name="file" size={17} /> The situation</h2>
          <h3>{event.title}</h3>
          <p className="memo-year">{event.year}</p>
          <p>{event.dossier}</p>
          <details><summary>Read your briefing</summary>
            <p className="memo-hint">{event.briefing_hint}</p>
            <ul className="demand-list memo-demands">
              {demandsFor(event).map((d) => (
                <li key={d.role}><span className="demand-role">{ROLE_LABEL[d.role]}</span><span className="demand-text">{d.text}</span></li>
              ))}
            </ul>
          </details>
        </section>
      ) : (
        <div className="desk-note"><span className="pushpin" aria-hidden="true" /><p>Six candidates.<br />Six seats.<br />What could<br />possibly go wrong?</p><span className="note-signature">— the electorate</span></div>
      )}
    </aside>
  )
}
