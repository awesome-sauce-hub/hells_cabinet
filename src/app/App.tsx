import { useEffect, useMemo, useRef, useState } from 'react'
import { EVENTS, FIGURES } from './data.js'
import { CandidateCard, Icon, ROLE_LABEL, SlotStrip } from './components.js'
import { DeskAside, Masthead } from './Desk.js'
import { narrate } from './narrate.js'
import type { Beat } from './narrate.js'
import { fetchNarration } from './narrateRemote.js'
import { EVENT_LOCATIONS } from './eventLocations.js'
import { clearRun, isDaily, linkTo, loadRun, runFromUrl, saveRun } from './session.js'
import type { RunRef, SavedPhase } from './session.js'
import { finishDraft, isDraftComplete, openRoles } from '../engine/draft.js'
import type { DraftState } from '../engine/draft.js'
import { applyAction, replayDraft } from '../engine/replay.js'
import type { DraftAction } from '../engine/replay.js'
import { createRun, randomSeed, todayKey } from '../engine/run.js'
import { resolveEvent } from '../engine/resolve.js'
import type { Resolution } from '../engine/resolve.js'
import { roleScore } from '../engine/score.js'
import { ROLES, STAT_ABBR, STATS } from '../engine/types.js'
import type { Role } from '../engine/types.js'

type Phase = SavedPhase | 'choose'

/** A link beats a save: someone opening a shared game should get that game. */
function openingRun(): { ref: RunRef; actions: DraftAction[]; phase: Phase } {
  const shared = runFromUrl(window.location.search)
  if (shared) return { ref: shared, actions: [], phase: 'briefing' }

  const saved = loadRun()
  if (saved) return { ref: { seed: saved.seed, eventId: saved.eventId }, actions: saved.actions, phase: saved.phase }

  return { ref: { seed: todayKey(), eventId: null }, actions: [], phase: 'briefing' }
}

export default function App() {
  const [opening] = useState(openingRun)
  const [ref, setRef] = useState<RunRef>(opening.ref)
  const [phase, setPhase] = useState<Phase>(opening.phase)
  // The log is the saved game. Draft state is rebuilt from it, never stored.
  const [actions, setActions] = useState<DraftAction[]>(opening.actions)

  const run = useMemo(() => createRun(ref.seed, EVENTS, ref.eventId), [ref])
  const daily = isDaily(ref)

  /**
   * The draft is derived, not held: replaying the log over a fresh rng is the
   * same operation whether the actions arrived from a click a second ago or
   * from localStorage a week ago, so resuming cannot drift from playing.
   */
  const draft = useMemo(
    () => (phase === 'briefing' || phase === 'choose' ? null : replayDraft(createRun(ref.seed, EVENTS, ref.eventId).rng, FIGURES, actions)),
    [ref, actions, phase],
  )
  const result = useMemo(
    () => (draft && isDraftComplete(draft) ? resolveEvent(run.event, finishDraft(draft)) : null),
    [draft, run.event],
  )

  // A save that cannot be replayed is a save that would resume the wrong game.
  const broken = phase !== 'briefing' && phase !== 'choose' && draft === null

  useEffect(() => {
    if (broken) return
    if (phase === 'briefing' && actions.length === 0) clearRun()
    else saveRun({ ...ref, actions, phase: phase === 'choose' ? 'briefing' : phase })
  }, [ref, actions, phase, broken])

  function act(action: DraftAction) {
    if (!draft || draft.endedBy) return
    // Refuse anything the engine would throw on, so one bad click cannot
    // poison a log that has to replay cleanly for the rest of the run.
    if (action.t === 'place' && (draft.picks[action.role] || !draft.candidates.some((c) => c.id === action.id))) return
    if (action.t === 'bench' && (draft.benches <= 0 || !draft.candidates.some((c) => c.id === action.id))) return
    if (action.t === 'respin' && draft.respins <= 0) return

    const next = applyAction(replayDraft(createRun(ref.seed, EVENTS, ref.eventId).rng, FIGURES, actions)!, action)
    setActions([...actions, action])
    if (next.endedBy) setPhase('gameover')
    else if (isDraftComplete(next)) setPhase('sim')
  }

  function startRun(next: RunRef) {
    setRef(next)
    setActions([])
    setPhase('briefing')
    // Keep the address bar honest: it should always name the game on screen.
    window.history.replaceState(null, '', next.eventId ? linkTo(next) : window.location.pathname)
  }

  return (
    <div className="app">
      <Masthead isDaily={daily} seed={ref.seed} />
      <main className="desk">
      <section className={`pinboard phase-${phase}`} aria-label="Cabinet pinboard">
      <span className="board-screw screw-tl" aria-hidden="true" /><span className="board-screw screw-tr" aria-hidden="true" />
      <span className="board-screw screw-bl" aria-hidden="true" /><span className="board-screw screw-br" aria-hidden="true" />
      <div className="board-stage">
      <div className="board-main">
      {broken ? (
        <Unresumable onFresh={() => startRun({ seed: todayKey(), eventId: null })} />
      ) : (<>
      {phase === 'choose' && (
        <ChooseEvent current={run.event.id} onPick={(id) => startRun({ seed: randomSeed(), eventId: id })}
          onDaily={() => startRun({ seed: todayKey(), eventId: null })} isDaily={daily} />
      )}

      {phase === 'briefing' && (
        <Briefing run={run} isDaily={daily} onBegin={() => setPhase('draft')} onChoose={() => setPhase('choose')} />
      )}

      {phase === 'draft' && draft && (
        <Draft
          draft={draft}
          onPlace={(id, role) => act({ t: 'place', id, role })}
          onRespin={() => act({ t: 'respin' })}
          onBench={(id) => act({ t: 'bench', id })}
        />
      )}

      {phase === 'gameover' && draft?.endedBy && (
        <GameOver figure={draft.endedBy} onAgain={() => setPhase('choose')} />
      )}

      {phase === 'sim' && result && (
        <Sim result={result} onDone={() => setPhase('verdict')} />
      )}

      {phase === 'verdict' && result && (
        <Verdict result={result} runRef={ref} isDaily={daily} onChoose={() => setPhase('choose')} />
      )}
      </>)}
      </div>
      <DeskAside event={run.event} showBriefing={phase === 'draft'} />
      </div>
      </section>
      </main>
      <footer className="desk-footer"><span>A little history. A lot of bad decisions.</span><span>Hell’s Cabinet · an alternate-history game <a href="/portrait-credits.html" target="_blank" rel="noreferrer">Portrait credits</a></span></footer>
    </div>
  )
}

/** A saved game that no longer replays, rather than a wrong game resumed silently. */
function Unresumable({ onFresh }: { onFresh: () => void }) {
  return (
    <div className="gameover">
      <div className="stamp">FILE CORRUPTED</div>
      <h1>That game cannot be reopened.</h1>
      <p className="said">The saved run does not match the current roster, so resuming it would put a different game in front of you.</p>
      <div className="sim-actions" style={{ justifyContent: 'center' }}>
        <button className="primary" onClick={onFresh}>Start today’s crisis <Icon name="arrow" /></button>
      </div>
    </div>
  )
}

function ChooseEvent({ current, isDaily, onPick, onDaily }: {
  current: string
  isDaily: boolean
  onPick: (id: string) => void
  onDaily: () => void
}) {
  return (
    <div className="briefing-area">
      <div className="board-title"><h2>Pick your crisis.</h2><p>Ten of them. None went well the first time.</p></div>
      <ul className="crisis-list">
        {EVENTS.map((event) => (
          <li key={event.id}>
            <button className={`crisis ${event.id === current ? 'current' : ''}`} onClick={() => onPick(event.id)}>
              <span className="crisis-year">{event.year}</span>
              <span className="crisis-body">
                <span className="crisis-title">{event.title}</span>
                <span className="crisis-where">{EVENT_LOCATIONS[event.id]?.label ?? 'Location not yet mapped'}</span>
              </span>
              <span className="crisis-go" aria-hidden="true"><Icon name="arrow" size={16} /></span>
            </button>
          </li>
        ))}
      </ul>
      {!isDaily && (
        <div className="sim-actions">
          <button onClick={onDaily}>Back to today’s crisis</button>
        </div>
      )}
    </div>
  )
}

function Briefing({ run, isDaily, onBegin, onChoose }: {
  run: ReturnType<typeof createRun>
  isDaily: boolean
  onBegin: () => void
  onChoose: () => void
}) {
  const { event } = run
  return (
    <div className="board-layout briefing-layout">
      <SlotStrip order={ROLES} picks={{}} />
      <div className="briefing-area">
        <div className="board-title"><h2>Your country needs a cabinet.</h2><p>Qualifications are… negotiable.</p></div>
        <section className="briefing-paper">
          <span className="tape" aria-hidden="true" />
          <div className="brief-fileline"><span>{isDaily ? 'Today’s briefing' : 'Your next briefing'}</span><span>{event.year}</span></div>
          <h3>{event.title}</h3>
          <p className="dossier">{event.dossier}</p>
          <p className="hint">{event.briefing_hint}</p>
          <div className="brief-scrutiny"><span>Under scrutiny</span><p>{event.spotlight.map((role) => ROLE_LABEL[role]).join(' / ')}</p></div>
          <button className="primary begin-button" onClick={onBegin}>Assemble your cabinet <Icon name="arrow" /></button>
          <p className="brief-rules">Five rounds. Six candidates each. One appointment per round.</p>
          <span className="confidential-stamp" aria-hidden="true">EYES ONLY</span>
        </section>
        <p className="board-handwriting">Pin your hopes on the right people.</p>
        <div className="sim-actions"><button onClick={onChoose}>Play a different crisis</button></div>
      </div>
    </div>
  )
}

function Draft({ draft, onPlace, onRespin, onBench }: {
  draft: DraftState
  onPlace: (id: string, role: Role) => void
  onRespin: () => void
  onBench: (id: string) => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const open = openRoles(draft)
  const filled = ROLES.length - open.length
  const candidate = draft.candidates.find((c) => c.id === selected)
  useEffect(() => { heading.current?.focus() }, [draft.wave])

  function place(role: Role, draggedId?: string) {
    const id = draggedId ?? selected
    if (!id || !draft.candidates.some((c) => c.id === id) || !open.includes(role)) return
    setSelected(null)
    onPlace(id, role)
  }

  return (
    <div className="board-layout">
      <SlotStrip order={ROLES} picks={draft.picks} armed={!!candidate} selectedName={candidate?.name} onPlace={place} />
      <div className="draft-area">
        <div className="draft-heading">
          <div><h2 ref={heading} tabIndex={-1}>Make your appointments.</h2><p>Six hopefuls. One seat to fill.</p></div>
          <div className="round-counter"><span>Round <strong>{draft.wave + 1}</strong> / {ROLES.length}</span><div className="round-marks" aria-label={`${filled} of ${ROLES.length} posts filled`}>{ROLES.map((r, i) => <span key={r} className={i < filled ? 'done' : i === filled ? 'current' : ''} />)}</div></div>
        </div>
        <div className="draft-instruction" role="status" aria-live="polite"><Icon name="pin" size={16} /><span>{candidate ? `${candidate.name} selected. Choose a vacant role.` : 'Drag a photo to a role, or tap a photo then a role.'}</span>{candidate && <button className="cancel-selection" onClick={() => setSelected(null)} aria-label="Cancel selection"><Icon name="close" size={14} /></button>}</div>
        <div className="candidate-grid">
          {draft.candidates.map((c, index) => <CandidateCard key={c.id} figure={c} selected={selected === c.id} index={index}
            onSelect={() => setSelected((cur) => cur === c.id ? null : c.id)} onDragSelect={() => setSelected(c.id)}
            onBench={() => { setSelected(null); onBench(c.id) }} canBench={draft.benches > 0} />)}
        </div>
        <div className="draft-tools"><button className="reshuffle-button" onClick={() => { setSelected(null); onRespin() }} disabled={draft.respins <= 0}><Icon name="shuffle" size={16} />Reshuffle <span>{draft.respins} left</span></button><p>One appointment per round.<br /><span>The other five leave with the round.</span></p></div>
        <div className="board-bottom-note"><span>{draft.benches > 0 ? 'Need a different face? Use × to replace one candidate.' : 'Your one candidate replacement has been used.'}</span><span>All appointments are final.</span></div>
      </div>
    </div>
  )
}

/** The one card that ends a run the moment it is appointed. */
function GameOver({
  figure,
  onAgain,
}: {
  figure: NonNullable<DraftState['endedBy']>
  onAgain: () => void
}) {
  return (
    <>
      <div className="panel gameover">
        <div className="stamp">ADMINISTRATION ENDED</div>
        <h1>{figure.name}</h1>
        <p className="said">{figure.endsRun}</p>
      </div>
      <div className="row mt">
        <button className="primary" onClick={onAgain}>Try that again</button>
      </div>
    </>
  )
}

/**
 * The crisis playing out, one beat at a time.
 *
 * The cabinet stays pinned on the left throughout, and the slot belonging to
 * whoever is acting lights up as their beat lands. That is the whole reason
 * this screen exists: without the faces, a beat is an anonymous sentence and
 * skipping to the end costs the player nothing.
 */
function Sim({ result, onDone }: { result: Resolution; onDone: () => void }) {
  const fallback = useMemo(() => narrate(result), [result])
  const [written, setWritten] = useState<Beat[] | null>(null)
  const [waiting, setWaiting] = useState(true)
  const [shown, setShown] = useState(1)
  const newest = useRef<HTMLLIElement>(null)

  /**
   * The written story is fetched the moment this screen appears, while the
   * player is still reading the opening beat. Most of the wait is spent behind
   * something worth looking at, and if it never arrives the templated version
   * was on screen the whole time anyway.
   */
  useEffect(() => {
    const abort = new AbortController()
    fetchNarration(result, abort.signal).then((beats) => {
      if (abort.signal.aborted) return
      // Swapping under the player would rewrite a beat they already read, so a
      // late arrival is only taken while they are still on the first one.
      if (beats) setWritten((current) => current ?? beats)
      setWaiting(false)
    })
    return () => abort.abort()
  }, [result])

  const beats = written ?? fallback
  const finished = shown >= beats.length
  const latest = beats[shown - 1]
  // Hold at the opening beat while there is still a chance of a written story.
  const pending = waiting && written === null && shown === 1

  // Move focus to each new beat so a screen reader hears it and a keyboard
  // player is left next to the button they just pressed.
  useEffect(() => { if (shown > 1) newest.current?.focus() }, [shown])

  return (
    <div className="board-layout">
      <SlotStrip order={ROLES} picks={result.roster} activeRole={latest?.role} heading="In the room"
        note={finished ? <>Well.<br />That happened.</> : <>The room is<br />in session.</>} />
      <div className="draft-area">
        <div className="draft-heading">
          <div>
            <h2>{result.event.title}</h2>
            <p>{finished ? 'That is how it went.' : 'How it is going.'}</p>
          </div>
          <div className="round-counter">
            <span>Beat <strong>{shown}</strong> / {beats.length}</span>
            <div className="round-marks" aria-label={`Beat ${shown} of ${beats.length}`}>
              {beats.map((b, i) => <span key={`${b.id}-${i}`} className={i < shown - 1 ? 'done' : i === shown - 1 ? 'current' : ''} />)}
            </div>
          </div>
        </div>

        <ol className="beats">
          {beats.slice(0, shown).map((b, i) => (
            <li className={`beat ${b.tone}`} key={`${b.id}-${i}`} ref={i === shown - 1 ? newest : undefined} tabIndex={-1}>
              {b.who && <div className="who">{b.role ? `${ROLE_LABEL[b.role]} · ` : ''}{b.who}</div>}
              <div>{b.text}</div>
            </li>
          ))}
          {/* Blank slips hold the space the story will fill, so the board does
              not grow under the player one beat at a time. */}
          {beats.slice(shown).map((b, i) => <li className="beat pending" key={`pending-${b.id}-${i}`} aria-hidden="true" />)}
        </ol>

        <div className="sim-actions">
          {finished ? (
            <button className="primary" onClick={onDone}>See the verdict <Icon name="arrow" /></button>
          ) : (
            <>
              <button className="primary" onClick={() => setShown((n) => n + 1)} disabled={pending}>
                {pending ? 'The room is deliberating…' : <>Continue <Icon name="arrow" /></>}
              </button>
              <button onClick={() => setShown(beats.length)} disabled={pending}>Skip to the end</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Verdict({
  result,
  runRef,
  isDaily,
  onChoose,
}: {
  result: Resolution
  runRef: RunRef
  isDaily: boolean
  onChoose: () => void
}) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  // The link carries the seed, so whoever opens it is dealt the same six faces
  // in the same order and can try to beat the result they were just sent.
  const share = [
    `Hell’s Cabinet — ${result.event.title}${isDaily ? ` · ${runRef.seed}` : ''}`,
    `${result.grid} · ${Math.round(result.score)}/100 · ${result.tier.toUpperCase()}`,
    linkTo(runRef),
  ].join('\n')

  async function copy() {
    try {
      await navigator.clipboard.writeText(share)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  return (
    <>
      <div className="panel verdict">
        <div className="label">{result.event.title}</div>
        <div className="grid-squares">{result.grid}</div>
        <div className={`tier tier-${result.tier.replace(/\s/g, '')}`}>{result.tier}</div>
        <div className="score">{Math.round(result.score)} / 100</div>
      </div>

      <div className="panel mt-s table-panel">
        <div className="label">What each of them actually was</div>
        <table className="breakdown">
          <thead>
            <tr>
              <th>Role</th>
              <th>Figure</th>
              {STATS.map((s) => <th key={s} style={{ textAlign: 'right' }}>{STAT_ABBR[s]}</th>)}
              <th style={{ textAlign: 'right' }}>Fit</th>
            </tr>
          </thead>
          <tbody>
            {ROLES.map((role) => {
              const checks = result.checks.filter((c) => c.role === role)
              const p = checks[0]
              return (
                <tr key={role}>
                  <td>{ROLE_LABEL[role]}</td>
                  <td className={p ? (p.passed ? 'pass' : 'fail') : ''}>{result.roster[role].name}</td>
                  {STATS.map((s) => (
                    <td className="num" key={s}>{result.roster[role].stats[s]}</td>
                  ))}
                  <td className="num">{Math.round(roleScore(result.roster[role].stats, role))}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {(result.chemistry.effects.length > 0 || result.chemistry.coup) && (
        <div className="panel mt-s">
          <div className="label">Cabinet chemistry</div>
          {result.chemistry.coup && (
            <div className="mt-s">
              <span className="fail">Coup</span>{' '}
              {result.roster[result.chemistry.coup.usurper].name} took the chair from{' '}
              {result.roster.President.name}.
            </div>
          )}
          {result.chemistry.effects.map((e) => (
            <div key={`${e.id}-${e.roles.join("-")}`} className="mt-s">
              <span className={e.delta < 0 ? 'fail' : 'pass'}>
                {e.delta > 0 ? '+' : ''}{e.delta}
              </span>{' '}
              {e.text}
            </div>
          ))}
        </div>
      )}

      {copyState === 'failed' && <p className="copy-fallback" role="status">Copy wasn’t available. Select and copy this result: <span>{share}</span></p>}
      <div className="row mt">
        <button className="primary" onClick={copy}>{copyState === 'copied' ? 'Copied' : 'Copy result and link'}</button>
        <button onClick={onChoose}>Play another crisis</button>
      </div>
    </>
  )
}
