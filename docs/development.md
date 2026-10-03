# Development guide

## Architecture

The application is a static web game. `site/dist/battle.html` supplies the UI and loads `battle.mjs`; engine modules own simulation and game rules. The simulation runs at a fixed 33 Hz while presentation follows browser animation frames. Keep simulation state changes separate from rendering so frame rate cannot change combat outcomes.

The campaign, atlas, armory, loadout, profile manager, recruit army and companion UI share the running battle state. Menu transitions must preserve pause state and clear interrupted input. Campaign checkpoints use device-local browser storage with same-origin Web Locks, two-bank validation, conflict checks and newer-version protection. Checkpoints cover safe openings and settled results, never an in-progress battlefield. Portable own-format files/codes remain the backup route. Preserve clear player feedback, session-only fallbacks and the separation of rehearsal/expedition state from earned campaign progress. There is no backend, account service or telemetry. Any future game backend is planned to use Rust; the Node server here is only local static-development tooling.

The `dist` folder is the source of truth for the runtime, not generated build output. Edit its modules directly. The player homepage is `index.html`, developer details are in `about.html`, and the playable entry is `battle.html`. Additional lab and phone-preview pages are development surfaces.

## Practice, controls and decks

Skirmish descriptors are versioned seeds for bounded practice fields, finite companies and supplied starting kits. Keep their RNG separate from earned campaign state. Guided Training is optional and disposable; its camera, objectives and control labels must track the actual input mode and remapped keys. Keyboard preferences are browser-local and separate from campaign bindings.

Named decks describe 30-key arrangements and a companion choice. Applying a deck validates ownership and combat-state restrictions; importing or naming a deck never grants resources. Preserve result-screen inspection/export while loadout mutations remain locked. The local checkpoint schema has forward-version guards so an older tab cannot overwrite newer deck metadata.

## Route board and battlefield orders

Wayfarer presents six fields in a branching route board; a run still contains four battles. Inspection is separate from taking an available road, and preparation remains separate from starting combat. Preserve locked-route guards, earned resources and session separation.

Rally positions are fixed Rear/Center/Forward world landmarks, independent of hero movement and camera motion. Advance retains the ordinary AI path. Keep orders transient: no save schema, costs or combat values change. Allied recruited trebuchets may fall back to a living hostile keep or occupied hostile tower when normal distant-actor selection finds nothing. Validate live ownership both before release and at impact, retain actor priority/range limits, and preserve enemy siege behavior. The reviewed engine fingerprint changes with these deliberately tested extensions.

## Diagnostics

Optional battle diagnostics are disabled initially and stay in bounded memory. They capture an explicit allowlist of gameplay facts, with no profile identity, save/replay payload, network transmission or automatic export. Keep enable/reset/export actions explicit and ensure diagnostics cannot consume gameplay RNG or mutate the engine.

## Local checks

Run `npm start` for a loopback-only development server. It supports the same extensionless HTML routes used by the deployed game. `PORT=8080 npm start` selects another port.

- `npm run validate`: syntax, markup, local-resource existence and public-source hygiene
- `npm test`: all committed engine and UI tests
- `npm run check`: both gates, as used in CI
- `bash scripts/check-container.sh`: production Docker build, Nginx syntax and HTTP smoke checks; requires Docker

The suites use Node's built-in test runner and assertions, with two concurrent test files to keep the full UI harness's memory use bounded. Two pixel-level rendering suites also use the pinned test-only `@napi-rs/canvas` package. Run `npm ci --ignore-scripts --no-audit --no-fund` before testing; native canvas packages are platform-specific. Tests require no private files or machine-specific runtime paths. Some tests deliberately select deterministic random numbers or start with clearly identified funded/assisted profiles. Preserve those distinctions when adding coverage.

`tests/helpers/game-ui-harness.mjs` loads the real UI module and engine with a small deterministic DOM/canvas surface. It verifies event/state behavior. It does not verify browser layout, pointer capture, rendering, focus order or real device lifecycle behavior.

`elemental-feedback.test.mjs` includes a reviewed-engine byte-hash boundary. When a reviewed engine edit is intentional, update that fixture in the same commit and explain the behavior change. Do not change it merely to make a failing test green.

## Manual acceptance

After input, menu, HUD, camera or responsive-layout edits, test in a real browser:

1. Fresh profile, lobby, campaign start, defeat and retry
2. Armory purchase and equip, Loadout changes, Army/companion management, and return to lobby/battle
3. Pause, resume, repeated buttons, interrupted drags, cancelled imports and navigation between modes
4. Manual, point and Auto aiming; action-bar selection; keyboard shortcuts
5. Desktop, narrow portrait and short landscape layouts, with rotation and resizing
6. A real touch device for touch capture, orientation and app/background interruptions
7. Local checkpoint recovery, reload, cancelled import, quota/unavailable-storage fallback and two-tab conflicts
8. Campaign atlas/replay, Wayfarer route/rewards, card-market inspection and Army ledger across viewport sizes
9. Remapped controls and reload persistence; optional Training with pointer, touch and keyboard input
10. Seeded Skirmish descriptor round trips, fresh supplied kits, natural outcomes and result-screen deck inspection
11. Named deck capture/compare/apply/import/export, ownership failures, bowless recovery and older-checkpoint protection
12. An extended session for memory, frame pacing and accumulated state

Record what was actually tested. Do not infer device acceptance from the Node harness.

## Review and publishing

Keep commits focused and run the aggregate checks on the exact final tree. Use branches and reviewable diffs for changes. Preserve repository visibility and history; do not force-push shared branches.

GitHub is the source mirror and includes static Docker packaging for Dokploy. Live Sites deployment is a separate controlled workflow with its own source repository. This GitHub repository intentionally contains no Sites project configuration or deployment credentials. Its CI tests the production container but never deploys it.

When importing a released snapshot, use a frozen source revision, audit the allowlist, and include only game source, portable tests and public development documentation. Never recursively copy a research workspace. Exclude original archives, recovered source, private reports, credentials, machine-specific tools and user saves.

## Asset and compatibility boundaries

Artwork in this repository was created for the prototype. Existing code comments distinguish independently reconstructed numerical behavior from newly designed extensions. Do not add original-game art, audio, bytecode or recovered implementation source. No claim of exact original-runtime equivalence is made.

This repository does not currently declare a software license. Keep any license decision explicit rather than adding a third-party license by assumption.
