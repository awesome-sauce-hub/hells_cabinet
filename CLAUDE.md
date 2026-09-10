# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev            # Vite dev server (the game, with the DevBar)
npm run build          # tsc --noEmit && vite build - the CI build runs this
npm test               # vitest run && npm run validate
npm run validate       # schema/tier/id checks over content/ (no network, no cost)

npx vitest run src/engine/__tests__/draft.test.ts   # one file
npx vitest run -t "coup"                            # one test by name
npx vitest                                          # watch mode

npm run review         # AI content gate over the roster -> content/review-findings.json  (costs money)
npm run bench          # narrator latency/cost across models                              (costs money)
npm run sim | balance | solvability                 # engine simulation and draw-rate reports

npm run roster:export  # content/politicians.json -> xlsx for authoring
npm run roster:import  # xlsx -> json, then validate

npx wrangler dev       # run the real Worker locally (assets + /api/narrate)
npx wrangler deploy --dry-run                       # validate wrangler.jsonc and bindings
```

`npm run review` and `npm run bench` call the Anthropic API. Ask before running them.

Local Worker runs need `.dev.vars` with `ANTHROPIC_API_KEY` (gitignored). `npm run dev` reads `.env.local`.

## Architecture

**The engine is pure and deterministic; everything else is a view of it.** `src/engine/` has no React and no I/O. A run is fully described by a seed plus an append-only action log, and `replayDraft()` rebuilds draft state by replaying that log over a fresh RNG. `App.tsx` never stores draft state — it derives it. This is why resuming a save cannot drift from playing.

**Figures have no stats.** A figure is its `tier`, `alignment`, `traits` and `bio`, and nothing else. Stat blocks were removed because hand-assigned numbers made every figure equally gritty and no figure recognisably themselves. Anything that reads like a stat (`charisma`, `force`, …) is a `Quality` a *crisis demands*, never a number a figure carries.

**The AI judges; code scores.** `api/narrate.ts` asks Claude for one verdict per post plus the story. Turning verdicts into a number, a tier and a share grid is `src/engine/verdict.ts`, in code, because it must be identical for everyone and contains no judgement worth delegating. Chemistry, rivalries and the coup stay in code too. See `docs/NARRATOR.md`.

**The bio is load-bearing content, not flavour.** It is the only description the adjudicator gets, and the evidence every verdict rests on. A thin bio makes a figure unjudgeable.

**One handler, one convention.** `narrate(request: Request): Promise<Response>` is plain Fetch API. `worker/index.ts` routes `/api/narrate` to it and hands everything else to the assets binding. The API key never reaches the browser.

Key files: `src/engine/types.ts` (ROLES, QUALITIES, the Politician shape), `draft.ts` (draw weights), `demands.ts` (what a crisis asks of each post), `score.ts` (chemistry, coup), `verdict.ts` (scoring), `src/shared/narration.ts` (the Zod contract both the browser and the handler compile), `content/{politicians,events}.json`.

## Invariants worth knowing before you change things

- **Six seats, in `ROLES` order**: President, Spymaster, General, Attorney-General, Press Secretary, Chancellor. Draft rounds are `ROLES.length`, and share links encode picks *positionally*, so reordering `ROLES` silently reinterprets every existing link.
- **The Act 2 twist is deliberately sealed.** `demands.ts` shows every check *except* the twist's. That one demand is meant to be luck, and it is only fair as luck once everything else is knowledge. A test asserts the twist never leaks into the briefing.
- **Dismissal is permanent.** Bench and reshuffle retire whoever they dismiss; nobody dismissed comes back.
- **Changing the roster invalidates saves.** `CONTENT_FINGERPRINT` hashes figure and event *ids*, so adding or removing a figure discards every in-progress run. Editing a bio, trait, alignment or portrait does not. Bump `VERSION` in `src/app/session.ts` whenever a save's action log would replay into a different game, and add a line saying why.
- **The daily is a shuffled pack**, not an independent draw per day: every crisis appears once before any appears twice. Yesterday's daily is discarded on load.
- **The DevBar** (`src/app/DevBar.tsx`) is the only way to replay a daily. It is gated on `import.meta.env.DEV`, so it and its styles are dropped from production builds. Keep it that way — its CSS is inlined in the component because stylesheets are not tree-shaken.

## Deployment

Cloudflare Workers, deployed from `main` by Cloudflare's own build (`npm run build` then `npx wrangler deploy`). Live at **hellscabinet.com** (and `hells-cabinet.prompt-polish.workers.dev`).

`wrangler.jsonc` has two load-bearing settings that are easy to remove by accident:

- `nodejs_compat` + a compatibility date ≥ 2025-04-01 populate `process.env` from secrets. The handler reads `process.env.ANTHROPIC_API_KEY` directly; without both it answers 503 with the key sitting in the dashboard.
- `not_found_handling: "single-page-application"` is what makes shared cabinet links work, since those are paths the asset server has never heard of.

Assets are served **before** the Worker runs unless `run_worker_first` is set — so Worker code that inspects `/` will never execute.

Secrets: `npx wrangler secret put ANTHROPIC_API_KEY`.

## Today's decisions (2026-09-10)

- **Seats changed from five to six.** `VicePresident` → **Spymaster** (the deputy owned no question; every demand written for it was a President demand handed down a rank), `PropagandaMinister` → **Press Secretary** (same job, a name that survives a democracy), `Treasurer` → **Chancellor**, and **Attorney-General** added because `integrity` was the most-demanded quality and the only one no seat owned. The General was kept against a proposal to replace it: it is spotlit in 6 of 10 crises and is the sole owner of inverted `force` ("restraint under pressure"), which no lawyer can carry.
- **Vercel retired.** Its config, link and the dual-calling-convention Node adapter are gone; Cloudflare is the only host. Two Vercel *projects* are still live on the account and still build from `main` until deleted.
- **The content gate's rubric had outlived the schema** — it asked for stats that no longer exist, so 38 of 96 findings were fabricated fields. Rubric fixed; the 29 real error-level findings were applied (nine wildcards sitting at `neutral` who are plainly `bad`/`good`, which matters because alignment drives draw rarity).
- **One gate suggestion was declined**: rewriting Epstein's bio to state the trafficking conviction outright reverses a deliberate choice to keep these as jokes about self-regard and silence rather than prose restating allegations — and the bio is what the adjudicator generates fresh prose from every run.
- **A rules section** was added to the masthead's help sheet (`Rulebook` in `components.tsx`, `ROLE_BRIEF` in `types.ts`) because nothing had ever said what a post *is*, only what a given crisis wanted from it.

## Open, and blocking a real launch

- **19 portraits are non-free English-Wikipedia fair-use files** (Vader, Mario, Batman, Thanos, Voldemort, …). Wikipedia's fair-use rationale does not transfer; these need replacing or removing.
- **43 portraits are CC BY / BY-SA** and legally require the author's name and the licence in the work. `public/portrait-credits.html` currently gives only a source link, which is not sufficient. Author and licence data can be pulled from the Commons API.
- **37 of 159 figures have no portrait at all.** The politicians need licensing; the abstractions (Nine Eleven, The Concept of Time Passing) need a design treatment, since no photograph exists.
- `index.html` has **no Open Graph, description or favicon** — every shared cabinet link pastes as a bare URL, which for a game distributed by sharing is the highest-leverage gap.
- **No React error boundary**; a render exception serves a blank page. No error reporting.
- The narrator's rate limiting is **per-Cloudflare-location, not per-player** (`Map` in module scope is per-isolate on Workers). At ~8¢ a judged run, that is the cost exposure.
- 35 warns and 7 nits from the content gate are unactioned in `content/review-findings.json`.

## Notes on the docs

`docs/` predates the current shape and is unreliable: `PRODUCT.md` and `CLAUDE_HANDOFF.md` still say "Politidle", five roles and 122 figures. `docs/NARRATOR.md` is accurate on intent but says five posts. Trust the code and this file over `docs/`.
