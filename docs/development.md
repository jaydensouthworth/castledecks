# Development guide

## Architecture

The application is a static web game. `site/dist/battle.html` supplies the UI and loads `battle.mjs`; engine modules own simulation and game rules. The simulation runs at a fixed 33 Hz while presentation follows browser animation frames. Keep simulation state changes separate from rendering so frame rate cannot change combat outcomes.

The campaign, atlas, armory, loadout, profile manager, recruit army and companion UI share the running battle state. Menu transitions must preserve pause state and clear interrupted input. Campaign checkpoints use device-local browser storage with same-origin Web Locks, two-bank validation, conflict checks and newer-version protection. Checkpoints cover safe openings and settled results, never an in-progress battlefield. Portable own-format files/codes remain the backup route. Preserve clear player feedback, session-only fallbacks and the separation of rehearsal/expedition state from earned campaign progress. There is no backend, account service or telemetry. The Node server here is only local static-development tooling.

The `dist` folder is the source of truth for the runtime, not generated build output. Edit its modules directly. The player homepage is `index.html`, developer details are in `about.html`, and the playable entry is `battle.html`. Additional lab and phone-preview pages are development surfaces.

## Practice, controls and decks

Skirmish descriptors are versioned seeds for bounded practice fields, finite companies and supplied starting kits. Keep their RNG separate from earned campaign state. Guided Training is optional and disposable; its camera, objectives and control labels must track the actual input mode and remapped keys. Keyboard preferences are browser-local and separate from campaign bindings.

Named decks describe 30-key arrangements and a companion choice. Applying a deck validates ownership and combat-state restrictions; importing or naming a deck never grants resources. Preserve result-screen inspection/export while loadout mutations remain locked. The local checkpoint schema has forward-version guards so an older tab cannot overwrite newer deck metadata.

## Route board and battlefield orders

Wayfarer presents six fields in a branching route board; a run still contains four battles. Inspection is separate from taking an available road, and preparation remains separate from starting combat. Preserve locked-route guards, earned resources and session separation.

Rally positions are fixed Rear/Center/Forward world landmarks, independent of hero movement and camera motion. Advance retains the ordinary AI path. Keep orders transient: no save schema, costs or combat values change. Allied recruited trebuchets may fall back to a living hostile keep or occupied hostile tower when normal distant-actor selection finds nothing. Validate live ownership both before release and at impact, retain actor priority/range limits, and preserve enemy siege behavior. The reviewed engine fingerprint changes with these deliberately tested extensions.

## Battery interception

Battery interception is a supplied Skirmish doctrine with two explicitly bound ordinary enemy trebuchets and a finite escort. Only those original identities count. Resolve both marked engines and return the home flag to base; hero death or home-flag capture takes precedence over completion in the same full simulation tick. Ordinary enemy-keep or enemy-flag victories cannot bypass the objective. Retry creates a fresh supplied attempt. Do not apply this objective to earned campaign saves.

Objective presentation reads the engine state into the existing HUD, portrait status, Pause brief and Canvas labels. Keep markers in CSS-pixel geometry without new input targets, timers, RNG, spawns or resource mutations. The generated legacy Skirmish JSON fixture records our own deterministic implementation outputs, not original-game assets or recovered code. The initial candidate completed a native practice victory. Release 61 then passed native target-clearance and Army-copy inspection, including a correct defeat after losing the home flag despite resolving both engines.

## Army continuity

Regular troop contracts and ranks survive casualties and defeat; individual dispatched units do not become a persistent battlefield roster. A new battle replenishes its reserve, while gold already spent on dispatch remains spent. Supplied practice kits retain their own reset rules. Army text should explain those existing boundaries without suggesting refunds or new persistence behavior. Regression fixtures cover the actual profile and battle transitions.

## Independent ground-company candidate

Frontline and Support may Advance or hold separate fixed Rear/Center/Forward lines. Frontline contains the supported melee roles; Support contains archers and priests. The current Army selector targets one company or All ground. Live shortcuts and the live line selector always override both companies and disclose split orders. New troops inherit their role; flag recovery, carriers and ordinary exclusions retain priority. Enemy-keep destruction releases both groups.

Held Support regroups before starting new actions. Committed attacks/spells finish, with living-recipient and real-range checks at heal/purge release; switching to Advance mid-cast must not bypass those checks. Keep ordinary Advance deterministic. This is a tactical tradeoff rather than a universal advantage: holding support too far away can remove useful healing. Orders are transient battle state, with no new save, contract, cost or stat persistence. Native acceptance remains a separate gate. The release-63 correction keeps real company ground anchors fixed while choosing a bounded frame-local cloth position clear of existing objective-label rectangles. It uses camera CSS geometry without DOM measurements, input targets, timers or game-state writes. Clearing an old Army receipt after its battle tick changes only restores the default explanation; it must not change recruitment or refund resources.

## Disposable Armory contract trials

Every regular Army contract card may launch a disposable assisted trial, including unowned contracts. Trials copy owned rank, hero rank and difficulty by value into a supplied profile, then use ordinary recruitment, reserve, cooldown, arrival, AI and damage. The protected hero, stopped reinforcements and disabled settlement are explicit practice fixtures. No earned unlock or campaign progress is granted.

Returning must restore the original profile, battle, clock, motion state, paused origin, management selection, card/query/scroll, cart and wishlist. Preserve any cached Training session. Trial guards cover both direct save routes and asynchronous file-import completion; ordinary assisted Playground remains saveable. Contract-specific practice targets and stage feedback must describe real simulation rather than shortcut damage or outcomes. Authored trial actors wait for the first actual selected-contract spawn; ordinary queue timing, recruitment costs, reserve, cooldown, player arrows and effects continue. Restore the actors' original step functions permanently on that spawn and never rearm after a recruit dies; Reset creates a fresh fixture. This is explicit preparation assistance. Trial-only incoming/Pause labels must reflect the stopped reinforcement stream and selected contract. Native acceptance remains separate.

## Returning-player Crownroad Hall

The homepage previews only validated same-origin local Crownroad checkpoints. Its reader never writes, removes, acquires save locks, restores a game, starts combat or sends network requests. Keep active profile/provenance, saved frontier/region artwork, timestamps and preparation/opening/result semantics truthful. Names are bounded textContent/bdi and artwork comes from fixed authored mappings. Newer, corrupt, recovered or unavailable storage must be explicit, and stale text/art must clear after storage or lifecycle refresh.

The explicit battle?open=local-saves entry opens the existing chooser before initial creation. It must not create a blank slot merely by setting up or displaying the chooser; ordinary battle entry retains its normal autosave behavior. Continue, New, import and Session only retain their existing explicit decisions. Entry is synchronous, unstarted and unavailable during temporary sessions or an open panel.

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
