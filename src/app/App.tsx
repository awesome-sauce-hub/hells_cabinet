import { useEffect, useMemo, useRef, useState } from 'react'
import { EVENTS, FIGURES } from './data.js'
import { CandidateCard, Icon, ROLE_LABEL, SlotStrip } from './components.js'
import { DeskAside, Masthead } from './Desk.js'
import { narrate } from './narrate.js'
import {
  bench,
  finishDraft,
  isDraftComplete,
  openRoles,
  placeCandidate,
  respin,
  startDraft,
} from '../engine/draft.js'
import type { DraftState } from '../engine/draft.js'
import { createRun, randomSeed, todayKey } from '../engine/run.js'
import { resolveEvent } from '../engine/resolve.js'
import type { Resolution } from '../engine/resolve.js'
import { roleScore } from '../engine/score.js'
import { ROLES, STAT_ABBR, STATS } from '../engine/types.js'
import type { Role } from '../engine/types.js'

type Phase = 'briefing' | 'draft' | 'gameover' | 'sim' | 'verdict'

export default function App() {
  const [seed, setSeed] = useState(todayKey())
  const [phase, setPhase] = useState<Phase>('briefing')
  const [draft, setDraft] = useState<DraftState | null>(null)
  const [result, setResult] = useState<Resolution | null>(null)

  const run = useMemo(() => createRun(seed, EVENTS), [seed])
  const isDaily = seed === todayKey()

  function begin() {
    // The draft continues the run's rng, so one seed determines the pools too.
    setDraft(startDraft(createRun(seed, EVENTS).rng, FIGURES))
    setPhase('draft')
  }

  function choose(id: string, role: Role) {
    if (!draft || draft.endedBy || draft.picks[role] || !draft.candidates.some((c) => c.id === id)) return
    const next = { ...placeCandidate({ ...draft, picks: { ...draft.picks } }, id, role) }
    setDraft(next)
    if (next.endedBy) {
      setPhase('gameover')
      return
    }
    if (isDraftComplete(next)) {
      setResult(resolveEvent(run.event, finishDraft(next)))
      setPhase('sim')
    }
  }

  function newRun(nextSeed: string) {
    setSeed(nextSeed)
    setDraft(null)
    setResult(null)
    setPhase('briefing')
  }

  return (
    <div className="app">
      <Masthead isDaily={isDaily} seed={seed} />
      <main className="desk-layout">
      <section className={`pinboard phase-${phase}`} aria-label="Cabinet pinboard">
      <span className="board-screw screw-tl" aria-hidden="true" /><span className="board-screw screw-tr" aria-hidden="true" />
      <span className="board-screw screw-bl" aria-hidden="true" /><span className="board-screw screw-br" aria-hidden="true" />
      {phase === 'briefing' && (
        <Briefing run={run} isDaily={isDaily} onBegin={begin} />
      )}

      {phase === 'draft' && draft && (
        <Draft
          draft={draft}
          onPlace={choose}
          onRespin={() => { if (draft.respins > 0) setDraft({ ...respin({ ...draft }) }) }}
          onBench={(id) => { if (draft.benches > 0 && draft.candidates.some((c) => c.id === id)) setDraft({ ...bench({ ...draft, candidates: [...draft.candidates] }, id) }) }}
        />
      )}

      {phase === 'gameover' && draft?.endedBy && (
        <GameOver figure={draft.endedBy} onAgain={() => newRun(randomSeed())} />
      )}

      {phase === 'sim' && result && (
        <Sim result={result} onDone={() => setPhase('verdict')} />
      )}

      {phase === 'verdict' && result && (
        <Verdict
          result={result}
          seed={seed}
          isDaily={isDaily}
          onFreePlay={() => newRun(randomSeed())}
          onDaily={() => newRun(todayKey())}
        />
      )}
      </section>
      <DeskAside event={run.event} showBriefing={phase === 'draft'} />
      </main>
      <footer className="desk-footer"><span>A little history. A lot of bad decisions.</span><span>Hell’s Cabinet · an alternate-history game <a href="/portrait-credits.html" target="_blank" rel="noreferrer">Portrait credits</a></span></footer>
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

function Sim({ result, onDone }: { result: Resolution; onDone: () => void }) {
  const beats = useMemo(() => narrate(result), [result])
  const [shown, setShown] = useState(1)
  const finished = shown >= beats.length

  return (
    <>
      <div className="row spread">
        <span className="label">{result.event.title}</span>
        <span className="label">{shown} / {beats.length}</span>
      </div>

      <div className="beats mt-s">
        {beats.slice(0, shown).map((b, i) => (
          <div className={`beat ${b.tone}`} key={`${b.id}-${i}`}>
            {b.who && <div className="who">{b.role ? `${ROLE_LABEL[b.role]} · ` : ''}{b.who}</div>}
            <div>{b.text}</div>
          </div>
        ))}
      </div>

      <div className="row mt">
        {finished ? (
          <button className="primary" onClick={onDone}>See the verdict</button>
        ) : (
          <>
            <button className="primary" onClick={() => setShown((n) => n + 1)}>Continue</button>
            <button onClick={() => setShown(beats.length)}>Skip to the end</button>
          </>
        )}
      </div>
    </>
  )
}

function Verdict({
  result,
  seed,
  isDaily,
  onFreePlay,
  onDaily,
}: {
  result: Resolution
  seed: string
  isDaily: boolean
  onFreePlay: () => void
  onDaily: () => void
}) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const share = `Hell’s Cabinet ${isDaily ? seed : 'free play'} — ${result.grid} · ${Math.round(result.score)} · ${result.tier.toUpperCase()}`

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
        <button className="primary" onClick={copy}>{copyState === 'copied' ? 'Copied' : 'Copy result'}</button>
        <button onClick={onFreePlay}>Play another</button>
        {!isDaily && <button onClick={onDaily}>Today's puzzle</button>}
      </div>
    </>
  )
}
