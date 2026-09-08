import { useMemo, useState } from 'react'
import { EVENTS, FIGURES } from './data.js'
import { CandidateCard, ROLE_LABEL, SlotStrip } from './components.js'
import { narrate } from './narrate.js'
import {
  bench,
  finishDraft,
  isDraftComplete,
  pickCandidate,
  respin,
  startDraft,
} from '../engine/draft.js'
import type { DraftState } from '../engine/draft.js'
import { createRun, randomSeed, todayKey } from '../engine/run.js'
import { resolveEvent } from '../engine/resolve.js'
import type { Resolution } from '../engine/resolve.js'
import { roleScore } from '../engine/score.js'
import { ROLES, STAT_ABBR, STATS } from '../engine/types.js'

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
    setDraft(startDraft(run.rng, FIGURES))
    setPhase('draft')
  }

  function choose(id: string) {
    if (!draft) return
    const next = { ...pickCandidate(draft, id) }
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
      {phase === 'briefing' && (
        <Briefing run={run} isDaily={isDaily} onBegin={begin} />
      )}

      {phase === 'draft' && draft && (
        <Draft
          draft={draft}
          onPick={choose}
          onRespin={() => setDraft({ ...respin(draft) })}
          onBench={(id) => setDraft({ ...bench(draft, id) })}
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
    </div>
  )
}

function Briefing({
  run,
  isDaily,
  onBegin,
}: {
  run: ReturnType<typeof createRun>
  isDaily: boolean
  onBegin: () => void
}) {
  const { event } = run
  return (
    <>
      <div className="row spread">
        <span className="label">Politidle · {isDaily ? `Daily ${run.seed}` : 'Free play'}</span>
        <span className="label">Briefing</span>
      </div>

      <div className="panel mt-s">
        <div className="brief-head">
          <h1>{event.title}</h1>
          <span className="brief-year">{event.year}</span>
        </div>
        <p className="dossier">{event.dossier}</p>
        <div className="hint">{event.briefing_hint}</div>

        <div className="mt">
          <div className="label">Under scrutiny</div>
          <div className="chips">
            {ROLES.map((role) => (
              <span className={`chip ${event.spotlight.includes(role) ? 'on' : ''}`} key={role}>
                {ROLE_LABEL[role]}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="row mt">
        <button className="primary" onClick={onBegin}>Assemble your cabinet</button>
        <span className="label">Five rounds · six candidates each</span>
      </div>
    </>
  )
}

function Draft({
  draft,
  onPick,
  onRespin,
  onBench,
}: {
  draft: DraftState
  onPick: (id: string) => void
  onRespin: () => void
  onBench: (id: string) => void
}) {
  const role = ROLES[draft.round]!
  return (
    <>
      <div className="row spread">
        <span className="label">Round {draft.round + 1} of {ROLES.length}</span>
        <span className="label">Choose 1 of {draft.candidates.length}</span>
      </div>

      <SlotStrip order={ROLES} picks={draft.picks} activeIndex={draft.round} />

      <div className="row spread mt-s">
        <h2 style={{ margin: 0, fontSize: 24 }}>{ROLE_LABEL[role]}</h2>
        <div className="row">
          <button onClick={onRespin} disabled={draft.respins <= 0}>
            Respin ({draft.respins})
          </button>
          <span className="label">Bench ({draft.benches})</span>
        </div>
      </div>

      <div className="board mt-s">
        {draft.candidates.map((c) => (
          <CandidateCard
            key={c.id}
            figure={c}
            onPick={() => onPick(c.id)}
            onBench={() => onBench(c.id)}
            canBench={draft.benches > 0}
          />
        ))}
      </div>
    </>
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
  const [copied, setCopied] = useState(false)
  const share = `Politidle ${isDaily ? seed : 'free play'} — ${result.grid} · ${Math.round(result.score)} · ${result.tier.toUpperCase()}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(share)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
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
            <div key={e.id} className="mt-s">
              <span className={e.delta < 0 ? 'fail' : 'pass'}>
                {e.delta > 0 ? '+' : ''}{e.delta}
              </span>{' '}
              {e.text}
            </div>
          ))}
        </div>
      )}

      <div className="row mt">
        <button className="primary" onClick={copy}>{copied ? 'Copied' : 'Copy result'}</button>
        <button onClick={onFreePlay}>Play another</button>
        {!isDaily && <button onClick={onDaily}>Today's puzzle</button>}
      </div>
    </>
  )
}
