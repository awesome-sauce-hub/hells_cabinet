import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EVENTS, FIGURES } from './data.js'
import { CandidateCard, Icon, Portrait, ROLE_LABEL, SlotStrip } from './components.js'
import { DeskAside, Masthead } from './Desk.js'
import { DevBar } from './DevBar.js'
import { narrate } from './narrate.js'
import type { Beat, Tone } from './narrate.js'
import { fetchJudgement } from './narrateRemote.js'
import type { Judged } from './narrateRemote.js'
import { EVENT_LOCATIONS } from './eventLocations.js'
import { clearRun, isDaily, isStaleDaily, linkTo, loadRun, runFromUrl, saveRun, sharedFromUrl } from './session.js'
import type { RunRef, SavedPhase, SharedCabinet } from './session.js'
import { finishDraft, isDraftComplete, openRoles } from '../engine/draft.js'
import type { DraftState } from '../engine/draft.js'
import { demandByRole, demandsFor } from '../engine/demands.js'
import { applyAction, replayDraft } from '../engine/replay.js'
import type { DraftAction } from '../engine/replay.js'
import { createRun, msUntilMidnight, todayKey } from '../engine/run.js'
import { assemble, resolveEvent } from '../engine/resolve.js'
import type { Resolution } from '../engine/resolve.js'
import { breakdown, squareFor, tierFor } from '../engine/verdict.js'
import type { RoleVerdict } from '../engine/verdict.js'
import { ROLES } from '../engine/types.js'
import type { GameEvent, Role } from '../engine/types.js'

/**
 * How a played beat reads at a glance in the ledger. Shape rather than colour
 * alone, so the run is still legible to a player who cannot separate the two.
 */
const LEDGER_MARK: Record<Tone, string> = {
  good: '\u2713', bad: '\u2715', twist: '!', neutral: '\u00b7',
}

type Phase = SavedPhase | 'shared'

/**
 * How long the opening beat waits for a written story before the game goes on
 * without one.
 *
 * This is a stuck-request escape hatch, not a deadline. It has to sit well
 * clear of how long the work actually takes: judged runs measure 16-22s, and
 * at 12s this fired on every single game - releasing the player into the
 * templated story, and captioning it "no adjudicator reached", while the real
 * judgement was still four seconds from arriving. The game looked like it had
 * no adjudicator at all.
 */
const HOLD_MS = 45_000

/** A link beats a save: someone opening a shared game should get that game. */
function openingRun(): { ref: RunRef; actions: DraftAction[]; phase: Phase; verdicts?: RoleVerdict[]; sent?: SharedCabinet } {
  // A link carrying a cabinet opens on that cabinet: the sender is showing
  // you what they did, and the same deal is one button away.
  const sent = sharedFromUrl(window.location.search)
  if (sent) return { ref: sent.ref, actions: [], phase: 'shared', sent }

  const shared = runFromUrl(window.location.search)
  if (shared) return { ref: shared, actions: [], phase: 'briefing' }

  const saved = loadRun()
  if (saved) return { ref: { seed: saved.seed, eventId: saved.eventId }, actions: saved.actions, phase: saved.phase, verdicts: saved.verdicts }

  return { ref: { seed: todayKey(), eventId: null }, actions: [], phase: 'briefing' }
}

export default function App() {
  const [opening] = useState(openingRun)
  const [ref, setRef] = useState<RunRef>(opening.ref)
  const [phase, setPhase] = useState<Phase>(opening.phase)
  // The log is the saved game. Draft state is rebuilt from it, never stored.
  const [actions, setActions] = useState<DraftAction[]>(opening.actions)
  // Set once the adjudicator has judged, and saved with the run.
  const [verdicts, setVerdicts] = useState<RoleVerdict[] | null>(opening.verdicts ?? null)

  const run = useMemo(() => createRun(ref.seed, EVENTS, ref.eventId), [ref])
  const daily = isDaily(ref)

  /**
   * The draft is derived, not held: replaying the log over a fresh rng is the
   * same operation whether the actions arrived from a click a second ago or
   * from localStorage a week ago, so resuming cannot drift from playing.
   */
  const draft = useMemo(
    () => (phase === 'briefing' || phase === 'shared' ? null : replayDraft(createRun(ref.seed, EVENTS, ref.eventId).rng, FIGURES, actions)),
    [ref, actions, phase],
  )
  const result = useMemo(() => {
    if (!draft || !isDraftComplete(draft)) return null
    const roster = finishDraft(draft)
    // The fallback adjudicator runs first so a run is always complete and
    // scored; a judgement, when one arrives, replaces its verdicts and is
    // rescored through the same aggregation.
    return verdicts ? assemble(run.event, roster, verdicts, true) : resolveEvent(run.event, roster)
  }, [draft, run.event, verdicts])

  // A save that cannot be replayed is a save that would resume the wrong game.
  const broken = phase !== 'briefing' && phase !== 'shared' && draft === null

  useEffect(() => {
    if (broken) return
    // Looking at a cabinet someone sent is not playing: it must not overwrite
    // or clear the run this player has of their own.
    if (phase === 'shared') return
    if (phase === 'briefing' && actions.length === 0) clearRun()
    else saveRun({ ...ref, actions, phase, ...(verdicts ? { verdicts } : {}) })
  }, [ref, actions, phase, verdicts, broken])

  function act(action: DraftAction) {
    if (!draft || draft.endedBy) return
    // Refuse anything the engine would throw on, so one bad click cannot
    // poison a log that has to replay cleanly for the rest of the run.
    if (action.t === 'place' && (draft.picks[action.role] || !draft.candidates.some((c) => c.id === action.id))) return
    if (action.t === 'bench' && (draft.benches <= 0 || !draft.candidates.some((c) => c.id === action.id))) return
    if (action.t === 'respin' && draft.respins <= 0) return

    const next = applyAction(replayDraft(createRun(ref.seed, EVENTS, ref.eventId).rng, FIGURES, actions)!, action)
    setActions([...actions, action])
    setVerdicts(null)
    if (next.endedBy) setPhase('gameover')
    else if (isDraftComplete(next)) setPhase('sim')
  }

  // Stable identity: this lands in a fetching effect's dependencies.
  const onJudged = useCallback((judged: Judged) => setVerdicts(judged.resolution.verdicts), [])

  const startRun = useCallback((next: RunRef) => {
    setRef(next)
    setActions([])
    setVerdicts(null)
    setPhase('briefing')
    // Keep the address bar honest: it should always name the game on screen.
    window.history.replaceState(null, '', next.eventId ? linkTo(next) : window.location.pathname)
  }, [])

  /**
   * The daily turns over on the player's own midnight, without a reload.
   *
   * loadRun() has always discarded a daily the calendar has overtaken, but it
   * only runs at page load, and openingRun() is a useState initialiser that
   * runs once. So the check never fired for the player it was written for: the
   * one who leaves the tab open, comes back after midnight and is still being
   * shown yesterday's crisis with yesterday's date on the masthead.
   *
   * Everything here is keyed off todayKey(), which is the device's own
   * calendar - so the game turns over at midnight where the player is, not at
   * midnight in Greenwich, and it follows them if they fly somewhere or the
   * clock moves under them.
   *
   * A timer alone is not enough: a sleeping laptop does not fire one on time,
   * and a phone browser may not fire it at all. So the wake events re-check as
   * well, and the timer is re-armed off the real clock every pass rather than
   * counted on. isStaleDaily() is the single source of truth for all of them,
   * which is what keeps a slept-through midnight and a stale timer from
   * disagreeing.
   *
   * Only the daily rolls. A free-play run and a cabinet somebody sent both
   * carry their own crisis, and isStaleDaily() leaves them alone - a shared
   * link is no more stale tomorrow than it was when it arrived.
   */
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    const check = () => {
      if (isStaleDaily(ref)) startRun({ seed: todayKey(), eventId: null })
      else arm()
    }

    const arm = () => {
      clearTimeout(timer)
      // A second the far side of the hour. Firing on the stroke races the
      // clock the check then reads, and losing that race parks the game on
      // yesterday until the next wake.
      timer = setTimeout(check, msUntilMidnight() + 1_000)
    }

    arm()
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
    }
  }, [ref, startRun])

  return (
    <div className={`app app-${phase}`}>
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
      {phase === 'shared' && opening.sent && (
        <SharedRun sent={opening.sent} onPlay={() => startRun(opening.sent!.ref)} />
      )}

      {phase === 'briefing' && (
        <Briefing run={run} isDaily={daily} onBegin={() => setPhase('draft')} />
      )}

      {phase === 'draft' && draft && (
        <Draft
          draft={draft}
          event={run.event}
          onPlace={(id, role) => act({ t: 'place', id, role })}
          onRespin={() => act({ t: 'respin' })}
          onBench={(id) => act({ t: 'bench', id })}
        />
      )}

      {phase === 'gameover' && draft?.endedBy && (
        <GameOver figure={draft.endedBy} />
      )}

      {phase === 'sim' && result && (
        <Sim result={result} onJudged={onJudged} onDone={() => setPhase('verdict')} />
      )}

      {phase === 'verdict' && result && (
        <Verdict result={result} runRef={ref} isDaily={daily} />
      )}
      </>)}
      </div>
      <DeskAside event={run.event} showBriefing={phase === 'draft' || phase === 'shared'} />
      </div>
      </section>
      </main>
      <footer className="desk-footer"><span>A little history. A lot of bad decisions.</span><span>Hell’s Cabinet · an alternate-history game <a href="/portrait-credits.html" target="_blank" rel="noreferrer">Portrait credits</a></span></footer>
      {/* Dropped from the production bundle: import.meta.env.DEV is a literal
          false there, so the branch and the module behind it are dead code. */}
      {import.meta.env.DEV && <DevBar current={ref} onStart={startRun} />}
    </div>
  )
}


/**
 * A cabinet somebody sent, with how it went for them.
 *
 * Read-only on purpose: the recipient is looking at someone else's run, not
 * resuming it. The numbers are the sender's own, read off the link rather than
 * re-judged here - asking the adjudicator again would cost money per view and
 * could return a different account of a game that is already over.
 */
function SharedRun({ sent, onPlay }: { sent: SharedCabinet; onPlay: () => void }) {
  const event = useMemo(() => createRun(sent.ref.seed, EVENTS, sent.ref.eventId).event, [sent])
  const tier = sent.score === undefined ? null : tierFor(sent.score)

  return (
    <div className="board-layout">
      <SlotStrip order={ROLES} picks={sent.picks} heading="They appointed"
        note={<>Your turn,<br />if you dare.</>} />
      <div className="draft-area">
        <div className="board-title">
          <h2>{event.title}</h2>
          <p>{event.year} · someone sent you their cabinet</p>
        </div>

        {tier && (
          <div className="panel verdict">
            <div className="label">How it went for them</div>
            <div className={`tier tier-${tier.replace(/\s/g, '')}`}>{tier}</div>
            <div className="score">{Math.round(sent.score ?? 0)} / 100</div>
          </div>
        )}

        {sent.marks && (
          <div className={`panel ${tier ? 'mt-s' : ''}`}>
            <div className="label">Post by post</div>
            <ul className="verdict-list">
              {ROLES.map((role) => (
                <li key={role}>
                  <span className={`verdict-mark verdict-${sent.marks?.[role] ?? 'none'}`} aria-hidden="true" />
                  <span className="verdict-body">
                    <span className="verdict-head">
                      <span className="verdict-who">{sent.picks[role].name}</span>
                      <span className="verdict-role">{ROLE_LABEL[role]}</span>
                    </span>
                  </span>
                  <span className={`verdict-word verdict-${sent.marks?.[role] ?? 'none'}`}>{sent.marks?.[role] ?? '—'}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="sim-actions">
          <button className="primary" onClick={onPlay}>Play this crisis yourself <Icon name="arrow" /></button>
        </div>
        <p className="brief-rules">The same crisis, dealt the same way: six hopefuls a round, six seats, one reshuffle. See if you can do better than that.</p>
      </div>
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

function Briefing({ run, isDaily, onBegin }: {
  run: ReturnType<typeof createRun>
  isDaily: boolean
  onBegin: () => void
}) {
  const { event } = run
  return (
    <div className="board-layout briefing-layout">
      <SlotStrip order={ROLES} picks={{}} demands={demandByRole(event)} />
      <div className="briefing-area">
        <div className="board-title"><h2>Your country needs a cabinet.</h2><p>Qualifications are… negotiable.</p></div>
        <section className="briefing-paper">
          <span className="tape" aria-hidden="true" />
          <div className="brief-fileline"><span>{isDaily ? 'Today’s briefing' : 'Your next briefing'}</span><span>{event.year}</span></div>
          <h3>{event.title}</h3>
          <p className="dossier">{event.dossier}</p>
          <p className="hint">{event.briefing_hint}</p>
          <div className="brief-scrutiny">
            <span>What this one will ask for</span>
            <ul className="demand-list">
              {demandsFor(event).map((d) => (
                <li key={d.role} className={event.spotlight.includes(d.role) ? 'spotlit' : ''}>
                  <span className="demand-role">{ROLE_LABEL[d.role]}</span>
                  <span className="demand-text">{d.text}</span>
                </li>
              ))}
            </ul>
            <p className="demand-sealed">One further demand arrives partway through. It is not in this file.</p>
          </div>
          <button className="primary begin-button" onClick={onBegin}>Assemble your cabinet <Icon name="arrow" /></button>
          <p className="brief-rules">Six rounds. Six candidates each. One appointment per round.</p>
          <span className="confidential-stamp" aria-hidden="true">EYES ONLY</span>
        </section>
        <p className="board-handwriting">Pin your hopes on the right people.</p>
      </div>
    </div>
  )
}

function Draft({ draft, event, onPlace, onRespin, onBench }: {
  draft: DraftState
  event: GameEvent
  onPlace: (id: string, role: Role) => void
  onRespin: () => void
  onBench: (id: string) => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const open = openRoles(draft)
  const filled = ROLES.length - open.length
  const candidate = draft.candidates.find((c) => c.id === selected)
  const demands = useMemo(() => demandByRole(event), [event])
  useEffect(() => { heading.current?.focus() }, [draft.wave])

  function place(role: Role, draggedId?: string) {
    const id = draggedId ?? selected
    if (!id || !draft.candidates.some((c) => c.id === id) || !open.includes(role)) return
    setSelected(null)
    onPlace(id, role)
  }

  return (
    <div className="board-layout">
      <SlotStrip order={ROLES} picks={draft.picks} armed={!!candidate} selectedName={candidate?.name} onPlace={place} demands={demands} />
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
/**
 * There is no button here on purpose.
 *
 * The run-ender is a one-in-ten bet the player chose to take, rolled off the
 * draft's own seeded stream so it cannot be re-rolled by reloading. A "try
 * again" button would hand back the thing the gamble was supposed to cost, and
 * with one crisis a day there is nothing else to offer them until tomorrow.
 */
function GameOver({ figure }: { figure: NonNullable<DraftState['endedBy']> }) {
  return (
    <>
      <div className="panel gameover">
        <div className="stamp">ADMINISTRATION ENDED</div>
        <h1>{figure.name}</h1>
        <p className="said">{figure.endsRun}</p>
      </div>
      <p className="said mt">That was today's. There will be another one tomorrow.</p>
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
function Sim({ result, onJudged, onDone }: {
  result: Resolution
  onJudged: (judged: Judged) => void
  onDone: () => void
}) {
  const fallback = useMemo(() => narrate(result), [result])
  const [written, setWritten] = useState<Beat[] | null>(null)
  const [waiting, setWaiting] = useState(true)
  // Only set once the request has actually resolved one way or the other, so
  // the fallback notice cannot appear while an answer is still in flight.
  const [settled, setSettled] = useState<'judged' | 'failed' | null>(null)
  // Bumped to ask again. A failed judgement used to be the end of it, leaving
  // the player holding a templated story with no way to get the real one.
  const [attempt, setAttempt] = useState(0)
  const [shown, setShown] = useState(1)
  /**
   * The story plays itself.
   *
   * Nine presses of Continue is a reading task with a button in the way: the
   * player supplies all the energy and the screen supplies none. On a clock it
   * is a scene, and the presses that remain - pause, next, skip - are there for
   * someone who wants to take it at their own pace rather than required of
   * everyone who wants to reach the end.
   */
  const [playing, setPlaying] = useState(true)
  // Where the player has got to, readable from the fetch's callback without
  // making the request depend on it.
  const shownRef = useRef(1)
  useEffect(() => { shownRef.current = shown }, [shown])

  /**
   * The judgement is fetched the moment this screen appears, while the player
   * is still reading the opening beat, so most of the wait sits behind
   * something worth looking at. If it never arrives, the fallback adjudicator
   * has already produced a complete scored run and the player loses only the
   * quality of the account.
   */
  /**
   * Judging costs money, so it must happen once per run and no more.
   *
   * Two things made that harder than it looks. onJudged's identity changed on
   * every render, so the effect re-ran constantly and billed one game
   * thirty-two times. Guarding that with a ref then broke it the other way,
   * because StrictMode aborts the first run of an effect and the ref blocked
   * the second, so nothing was ever fetched.
   *
   * The fix is to need no guard: onJudged is stable, and the resolution object
   * changes exactly once, when the judgement replaces it - at which point
   * result.judged is true and there is nothing left to ask for.
   */
  useEffect(() => {
    if (result.judged) {
      setWaiting(false)
      return
    }

    const abort = new AbortController()
    /**
     * The hold ends on a clock of its own, not on the request.
     *
     * fetchJudgement caps itself, but a cap is not a guarantee: a background
     * tab throttles the abort timer, and a proxy or a dev server can sit on a
     * POST for longer than the cap while the promise stays unsettled. Either
     * way the player was left staring at a disabled button with no way
     * forward. A complete templated story is already on screen, so after
     * HOLD_MS the game continues and a judgement that turns up later is still
     * taken for the verdict.
     */
    const release = setTimeout(() => setWaiting(false), HOLD_MS)
    fetchJudgement(result, abort.signal).then((judged) => {
      if (abort.signal.aborted) return
      if (judged) {
        // Swapping the story under a player who has read past the opening beat
        // would rewrite what they just read, so late beats are only taken
        // while they are still on the first one. The judgement itself is
        // always taken: it is what the verdict is scored on.
        if (shownRef.current === 1) setWritten((current) => current ?? judged.beats)
        onJudged(judged)
      }
      setSettled(judged ? 'judged' : 'failed')
      setWaiting(false)
    })
    return () => {
      clearTimeout(release)
      abort.abort()
    }
  }, [result, onJudged, attempt])

  const beats = written ?? fallback
  const finished = shown >= beats.length
  const latest = beats[shown - 1]
  // Hold at the opening beat while there is still a chance of a written story.
  const pending = waiting && written === null && shown === 1

  /**
   * How long a beat holds the stage: long enough to read it, scaled to its
   * length, and capped so the longest line cannot strand someone watching.
   */
  useEffect(() => {
    if (!playing || pending || finished) return
    const text = beats[shown - 1]?.text ?? ''
    const hold = Math.min(6200, 1500 + text.length * 42)
    const tick = setTimeout(() => setShown((n) => n + 1), hold)
    return () => clearTimeout(tick)
  }, [playing, pending, finished, shown, beats])

  // Taking a beat by hand means taking the pace by hand: a press should show
  // the next line, not race the clock that was about to show it anyway.
  function advance() {
    setPlaying(false)
    setShown((n) => Math.min(n + 1, beats.length))
  }

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

        {settled === 'failed' && !result.judged && (
          <p className="unjudged" role="status">
            No adjudicator reached. Everything below is a stand-in written from templates, and the
            verdicts are a rough reading rather than a judgement of who these people were.
            <button className="retry-judgement" onClick={() => {
              setSettled(null)
              setWaiting(true)
              setAttempt((n) => n + 1)
            }}>Ask again</button>
          </p>
        )}

        {/*
          * One beat holds the stage, with the face of whoever is acting.
          *
          * The screen used to be the whole story stacked at one weight, which
          * is a wall of prose by the fourth beat and unreadable by the ninth.
          * Only the current line is at reading size now; everything played
          * drops into the ledger below, where it stays glanceable without
          * competing. The portrait is the point: a beat about restraint under
          * pressure reads differently over Bokassa's face than it does over a
          * caption with his name in it.
          */}
        <div className={`stage-beat ${latest?.tone ?? 'neutral'} ${latest?.role ? '' : 'stage-room'}`}
          aria-live="polite" aria-atomic="true">
          {latest?.role && (
            <span className="stage-face">
              <Portrait key={result.roster[latest.role].id} figure={result.roster[latest.role]} size="lg" />
            </span>
          )}
          <div className="stage-body">
            <div className="stage-attr">
              {latest?.role ? (
                <>
                  <span className="stage-role">{ROLE_LABEL[latest.role]}</span>
                  <span className="stage-who">{result.roster[latest.role].name}</span>
                </>
              ) : (
                <span className="stage-role">{latest?.tone === 'twist' ? 'The complication' : 'The room'}</span>
              )}
            </div>
            <p className="stage-line">{latest?.text}</p>
          </div>
        </div>

        {/* Newest first, so the line that just left the stage is the one
            nearest it and the eye does not travel to follow the story. */}
        <ol className="ledger">
          {beats.slice(0, Math.max(0, shown - 1)).reverse().map((b, i) => (
            <li className={`ledger-item ${b.tone}`} key={`${b.id}-${i}`}>
              {b.role
                ? <Portrait figure={result.roster[b.role]} size="sm" />
                : <span className="ledger-noface" aria-hidden="true" />}
              <span className="ledger-text">{b.role ? `${ROLE_LABEL[b.role]} \u2014 ` : ''}{b.text}</span>
              <span className="ledger-mark" aria-hidden="true">{LEDGER_MARK[b.tone]}</span>
            </li>
          ))}
          {/* Blank rows hold the space the rest of the story will take, so the
              board is full from the first beat and does not grow under the
              player as it plays. */}
          {beats.slice(shown).map((b, i) => (
            <li className="ledger-pending" key={`pending-${b.id}-${i}`} aria-hidden="true" />
          ))}
        </ol>

        <div className="sim-actions">
          {finished ? (
            <button className="primary" onClick={onDone}>See the verdict <Icon name="arrow" /></button>
          ) : (
            <>
              <button className="primary" onClick={() => setPlaying((p) => !p)} disabled={pending}>
                {pending ? 'The room is deliberating…' : playing ? 'Pause' : <>Play <Icon name="arrow" /></>}
              </button>
              <button onClick={advance} disabled={pending}>Next beat</button>
              {/* Never disabled: the templated story is complete from the
                  first render, so skipping it needs nobody's permission. */}
              <button onClick={() => { setPlaying(false); setShown(beats.length) }}>Skip to the end</button>
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
}: {
  result: Resolution
  runRef: RunRef
  isDaily: boolean
}) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  /**
   * The result as a cabinet, not as a link.
   *
   * A row of coloured squares over a URL says nothing about the run: the whole
   * point of the game is which specific person you put in which specific chair,
   * and that was the one thing the shared result left out. Reading who somebody
   * appointed - and watching the Attorney-General line say Mussolini - is the
   * result. The squares belong against the names that earned them; repeating
   * them as a row above was a second, worse copy of the same information.
   *
   * Laid out one post per line with a separator rather than padded columns,
   * because most places this gets pasted render it in a proportional font and
   * any alignment done with spaces arrives crooked.
   */
  const share = [
    `Hell’s Cabinet — ${result.event.title}${isDaily ? ` · ${runRef.seed}` : ''}`,
    `${Math.round(result.score)}/100 · ${result.tier.toUpperCase()}`,
    '',
    ...ROLES.map((role) =>
      `${squareFor(result.verdicts, role)} ${ROLE_LABEL[role]} · ${result.roster[role].name}`),
    '',
    // Last, because it is for the reader who wants a go rather than the one
    // reading the cabinet. The bare name rather than the seeded link: a wall of
    // query string was the ugliest line in the paste, and the invitation reads
    // better than the machinery behind it.
    //
    // Written in full, with the scheme. A bare domain is not a link: most
    // clients leave it as plain text, and the ones that do linkify it still
    // skip the preview card, so the shared result arrived as a naked string.
    // The cost of keeping it seedless is that SharedRun and the result branch
    // of linkTo() are now reachable only from the address bar - deliberate, and
    // noted in CLAUDE.md so it is not rediscovered as a bug.
    'Play now: https://hellscabinet.com/',
  ].join('\n')

  /**
   * The score, decomposed. The weights are authored per crisis and have never
   * been visible, so a player could not tell which post the run turned on -
   * only that a number arrived. These are the same numbers scoreFrom() uses.
   */
  const points = new Map(
    breakdown(result.verdicts, result.event.twist.check.role, result.chemistry.total)
      .posts.map((p) => [p.role, p]),
  )

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

      <div className="panel mt-s">
        <div className="label">How each of them handled it</div>
        {!result.judged && (
          <p className="unjudged">
            No adjudicator reached, so these verdicts are a rough reading from their traits rather than a judgement of who they were.
          </p>
        )}
        <ul className="verdict-list">
          {ROLES.map((role) => {
            const v = result.verdicts.find((x) => x.role === role)
            const post = points.get(role)
            // The row takes its own class prefix. verdict-* already means
            // "paint this element in the verdict's colour", which is right for
            // a dot and a word and floods a whole row.
            return (
              <li key={role} className={`took-${v?.verdict ?? 'none'} ${post?.isTwist ? 'verdict-twist-row' : ''}`}>
                <span className={`verdict-mark verdict-${v?.verdict ?? 'none'}`} aria-hidden="true" />
                {/* The face, on the screen the whole game was played to reach.
                    Reading that the Attorney-General line says Mussolini is the
                    result; it was set as plain text until now. */}
                <Portrait figure={result.roster[role]} size="md" />
                <span className="verdict-body">
                  <span className="verdict-head">
                    <span className="verdict-who">{result.roster[role].name}</span>
                    <span className="verdict-role">{ROLE_LABEL[role]}</span>
                    {/* Named only now. During the briefing this demand is
                        sealed, and it stays sealed until it has been paid for. */}
                    {post?.isTwist && <span className="verdict-twist">the complication</span>}
                  </span>
                  <span className="verdict-reason">{v?.reason ?? 'This crisis never tested them.'}</span>
                </span>
                <span className="verdict-tally">
                  <span className={`verdict-word verdict-${v?.verdict ?? 'none'}`}>{v?.verdict ?? '—'}</span>
                  {post && (
                    <>
                      <span className="verdict-points">
                        {post.earned.toFixed(1)} of {post.available.toFixed(1)}
                      </span>
                      {/* The same numbers as a length, because which seat lost
                          the run is not a thing anyone reads out of decimals. */}
                      <span className="verdict-bar" aria-hidden="true">
                        <i style={{ width: `${post.available > 0 ? (post.earned / post.available) * 100 : 0}%` }} />
                      </span>
                    </>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
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

      {copyState === 'failed' && <p className="copy-fallback" role="status">Copy wasn’t available. Select and copy this result: <span className="copy-share">{share}</span></p>}
      <div className="row mt">
        <button className="primary" onClick={copy}>{copyState === 'copied' ? 'Copied' : 'Copy your cabinet'}</button>
        <span className="next-edition">Next crisis tomorrow.</span>
      </div>
    </>
  )
}
