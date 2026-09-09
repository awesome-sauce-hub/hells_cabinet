# Politidle code review — 9 September 2026

The game already has a useful separation between a deterministic engine, authored content, and React presentation. The redesign builds on that structure. Its priority is the user’s pinboard, portrait placement, and event-location map.

## Fixed in this pass

- Replaced the dark dashboard with a cork pinboard, five paper role slots, six pinned portrait cards, and a map with red location circles. The map covers all ten existing scenarios; the influenza scenario is explicitly worldwide.
- Added 121 sourced character/object images, an original HAL 9000 vector panel, local fonts, missing-image fallback, image credits, and public-domain map provenance. Numerical stats remain hidden until the verdict; the existing visible biographies and traits remain intact.
- Removed the nested interactive bench control: selection and replacement are separate native buttons. Bench is visible without hover, and keyboard Space/Enter work normally.
- Clear candidate selection when replacing or reshuffling the pool. Ignore invalid or stale drops and occupied posts instead of forwarding them to the throwing engine API.
- Initialize each draft with a fresh seeded run. Avoid mutating the React-held picks/candidates arrays when calling the existing mutable engine functions.
- Added selection announcements, round-heading focus, visible keyboard focus, reduced-motion support, and a horizontally scrolling sticky role strip on phones.
- Keep the crisis briefing available while drafting. Contain verdict-table overflow on phones. Show a selectable result if clipboard copying fails.
- Use distinct React keys for multiple rivalry effects.

## Improvements to consider next

### 1. Save and resume a daily game

`src/app/App.tsx:26` stores seed, phase, draft and result only in component state. Refreshing returns to the briefing and loses all appointments. There is no saved completed result or streak history.

Persist a versioned seed plus an action log and replay it through the deterministic engine on reload. This avoids trying to serialize the RNG closure. Include the content version so changing the roster cannot silently alter an old game.

### 2. Decide whether dismissed candidates should stay dismissed — RESOLVED

`src/engine/draft.ts:152` reshuffled from `remaining`, which still included the current candidates. `bench()` replaced a visible candidate but did not retire the dismissed figure from `remaining`.

Observed in the daily game for 2026-09-09: bench Benito Mussolini, reshuffle, appoint Augusto Pinochet as President; Mussolini appears again in round two. A reshuffle can also re-offer faces from the replaced pool.

Resolved: a token means “guarantee different candidates.” Both `respin()` and `bench()` now retire what they dismiss, matching the rule `placeCandidate()` already applied to a wave that passes — dismissal is permanent everywhere in the draft. Four tests in `src/engine/__tests__/draft.test.ts` cover it, including the reported repro; all three fail against the previous engine. Balance is unaffected: the harnesses' `randomDraft()` never spends a token.

### 3. Make engine transitions independently replayable

`startDraft`, `placeCandidate`, `respin`, and `bench` mutate their state and advance a closure-based RNG. This works in the simulation harness, but requires defensive copying at the React boundary and complicates persistence, undo, and reproducible bug reports.

A small action-based reducer or explicit serializable RNG state would make these transitions easier to reason about. Keep the present determinism tests and add action-log replay tests before changing the engine.

### 4. Make free-play results reproducible for another player

`src/app/App.tsx:246` shares “free play” instead of its seed, and the app does not read a run seed from the URL. A recipient cannot recreate that game from its copied result. Include a seed-based link and preserve a content version when adding sharing.

### 5. Add repeatable browser regression coverage

The existing suite tested the engine only. This pass adds event-map coverage and manually exercises the interface, but does not add a browser-test dependency. The highest-value automated flows are selection → replacement → appointment, reshuffle with a selected card, one keyboard-only complete game, the instant-loss character, mobile role scrolling, and save/reload once implemented.

### 6. Curate release artwork and narration

The current portraits are a prototype mix of photos, historical depictions, fictional-character images and objects from Wikipedia/Wikimedia, each with its source-file attribution link. Their individual licenses and character usage have not been cleared for a public release; some sources are subject to non-free usage restrictions. Replace or clear that set before publishing. No site was deployed by this task.

`src/app/narrate.ts` explicitly remains a template narrator. More event-specific authored outcomes would improve replay variety without changing the scoring engine.

## Verification

- Production build and TypeScript check passed.
- All 22 tests passed: 20 original engine tests plus two event-map coverage tests.
- Content validation passed: 122 figures and 10 events.
- Manually completed a five-round game through narrative and verdict. Verified drag appointment, keyboard selection/appointment, bench, reshuffle, copy result, and starting another game.
- At 390px width, page scrollWidth matched the viewport. The verdict table scrolled within its own container, not the page. There were no nested buttons and no console errors during the tested playthrough.
- Checked desktop and mobile pinboard and map screenshots. The Suez scenario shows its circle and “Suez Canal, Egypt.” Map entries and projection bounds are tested for all scenarios.
- Impeccable’s executable context loader and detector were unavailable (exit 1, no diagnostic output). Browser inspection and independent finish review substitute for those unavailable checks; this is not a claim of a full accessibility audit.
