# Development guide

## Architecture

The application is a static web game. `site/dist/battle.html` supplies the UI and loads `battle.mjs`; engine modules own simulation and game rules. The simulation runs at a fixed 33 Hz while presentation follows browser animation frames. Keep simulation state changes separate from rendering so frame rate cannot change combat outcomes.

The campaign, armory, loadout, profile manager, recruit army and companion UI share the running battle state. Menu transitions must preserve pause state and clear interrupted input. Profiles are explicit own-format files: do not silently introduce storage, telemetry or network submissions.

The `dist` folder is the source of truth for the runtime, not generated build output. Edit its modules directly. The development landing page is `index.html`; the playable entry is `battle.html`. Additional lab and phone-preview pages are development surfaces.

## Local checks

Run `npm start` for a loopback-only development server. It supports the same extensionless HTML routes used by the deployed game. `PORT=8080 npm start` selects another port.

- `npm run validate`: syntax, markup, local-resource existence and public-source hygiene
- `npm test`: all committed engine and UI tests
- `npm run check`: both gates, as used in CI

The suites use Node's built-in test runner and assertions. Two pixel-level rendering suites also use the pinned test-only `@napi-rs/canvas` package. Run `npm ci --ignore-scripts --no-audit --no-fund` before testing; native canvas packages are platform-specific. Tests require no private files or machine-specific runtime paths. Some tests deliberately select deterministic random numbers or start with clearly identified funded/assisted profiles. Preserve those distinctions when adding coverage.

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
7. An extended session for memory, frame pacing and accumulated state

Record what was actually tested. Do not infer device acceptance from the Node harness.

## Review and publishing

Keep commits focused and run the aggregate checks on the exact final tree. Use branches and reviewable diffs for changes. Preserve repository visibility and history; do not force-push shared branches.

GitHub is the source mirror. Live Sites deployment is a separate controlled workflow with its own source repository. This GitHub repository intentionally contains no Sites project configuration or deployment credentials, and its CI never deploys.

When importing a released snapshot, use a frozen source revision, audit the allowlist, and include only game source, portable tests and public development documentation. Never recursively copy a research workspace. Exclude original archives, recovered source, private reports, credentials, machine-specific tools and user saves.

## Asset and compatibility boundaries

Artwork in this repository was created for the prototype. Existing code comments distinguish independently reconstructed numerical behavior from newly designed extensions. Do not add original-game art, audio, bytecode or recovered implementation source. No claim of exact original-runtime equivalence is made.

This repository does not currently declare a software license. Keep any license decision explicit rather than adding a third-party license by assumption.
