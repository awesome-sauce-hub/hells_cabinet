# Claude handoff — Politidle pinboard UI

## User intent and decisions

Work in `/Users/macbook/Desktop/projects/ass-hub/politidle`, NOT the neighboring Hungryraccoon project. The user asked for a codebase review, but prioritised implementing their drawing as the UI.

Confirmed direction:

- Cork pinboard with names and portrait photographs pinned on it.
- Five role slots on the left. Drag a card into a role, or select a card and then a role.
- Keep the existing rule: six fresh candidates each round, ONE appointment per round, five rounds.
- The user explicitly replaced the original coffee-cup idea with a wall map. Do not reintroduce the cup or desk-only decorations.
- The map must circle WHERE THE CURRENT EVENT HAPPENS. It now changes by event; worldwide events are labelled appropriately.
- The user asked to wrap up and hand over to Claude when Codex usage is low. At the last check, Codex had 35% of its five-hour allowance and 68% of the weekly allowance left. No Claude session has been launched automatically by this document.

## Implementation

- `src/app/App.tsx`: pinboard shell, briefing/draft/resolution views, guarded placement, cleared selection on bench/reshuffle, fresh deterministic draft initialization, copy failure feedback, distinct chemistry keys.
- `src/app/components.tsx`: real portraits, fallback silhouette, accessible separate selection and replacement buttons, role drop targets, custom SVG icons.
- `src/app/Desk.tsx`: masthead, help, current-event map, context memo. The legacy filename/class names are internal only; there is no coffee cup in the interface.
- `src/app/eventLocations.ts`: ten event locations and map projection. Influenza is worldwide with representative affected-region circles; 2008 is labelled New York with worldwide impact.
- `src/app/styles.css`: warm wall, wood-framed corkboard, paper cards, red pins, local typography, responsive role rail, reduced motion.
- `src/app/portraits.json`, `public/portraits/`, `public/fonts/`, `public/maps/`, `public/portrait-credits.html`: self-hosted imagery, typography, map and provenance.
- `src/app/__tests__/eventLocations.test.ts`: all events mapped within visible bounds; global influenza is not shown as one local origin.
- `PRODUCT.md`, `DESIGN.md`, `REVIEW.md`: product decisions, visual system, and review findings.

The engine and authored event/figure content were preserved. No application dependencies were added, no commits were made, and nothing was deployed.

## Verification already completed

Production build/typecheck passed. All 22 tests passed. Content validation passed (122 figures, 10 events). Browser tested: drag, keyboard selection and appointment, bench, reshuffle, all five rounds, narrative progression, verdict, copying a result, and replay. The 390px layout has no page overflow; its result table scrolls internally. All six current-round images loaded and no console errors appeared in the tested playthrough.

The map was checked at desktop and mobile widths. Screenshot evidence is under `.impeccable/review/`. Browser full-page capture produced bad scaling, so use the viewport captures `desktop.png`, `mobile.png`, and `mobile-map.png` instead.

Run normal checks with `npm run build` and `npm test`. In a sandbox where the tsx CLI cannot create its IPC pipe, use `node node_modules/vitest/vitest.mjs run` followed by `node --import tsx scripts/validate-content.ts`.

## Outstanding product decisions, not implemented

See REVIEW.md. Main next steps: save/resume daily games, decide whether benched/reshuffled candidates should be retired permanently, make engine actions replayable, and include the seed in free-play sharing. Portraits have source attribution links but still need release-level license/identity curation; narration remains templated.

Do not change the fresh-six-per-round rule or rebalance the roster without a new user request. Do not treat old content-review suggestions as independently verified facts.

## Environment and continuation

Development was staged and tested at `/private/tmp/politidle-pinboard` because the original Codex task belonged to a neighboring workspace. The final files are copied into the real Politidle repo at completion; use that real repo for future edits. The temporary preview ran at `http://127.0.0.1:5181/`; start a server in the real repo if it is not running. Never rely on the temporary directory as the durable deliverable.

Read `REVIEW.md` for precise findings and `.impeccable/review/finish-review.md` for the independent visual-review result if present. Preserve uncommitted work. Ask the user which next improvement they want after this UI pass, unless they have already supplied a follow-up request.
