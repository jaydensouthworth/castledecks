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

## Independent ground companies

Frontline and Support may Advance or hold separate fixed Rear/Center/Forward lines. Frontline contains the supported melee roles; Support contains archers and priests. The current Army selector targets one company or All ground. Live shortcuts and the live line selector always override both companies and disclose split orders. New troops inherit their role; flag recovery, carriers and ordinary exclusions retain priority. Enemy-keep destruction releases both groups.

Held Support regroups before starting new actions. Committed attacks/spells finish, with living-recipient and real-range checks at heal/purge release; switching to Advance mid-cast must not bypass those checks. Keep ordinary Advance deterministic. This is a tactical tradeoff rather than a universal advantage: holding support too far away can remove useful healing. Orders are transient battle state, with no new save, contract, cost or stat persistence. Native acceptance passed with release 63. The release-63 correction keeps real company ground anchors fixed while choosing a bounded frame-local cloth position clear of existing objective-label rectangles. It uses camera CSS geometry without DOM measurements, input targets, timers or game-state writes. Clearing an old Army receipt after its battle tick changes only restores the default explanation; it must not change recruitment or refund resources.

## Disposable Armory contract trials

Every regular Army contract card may launch a disposable assisted trial, including unowned contracts. Trials copy owned rank, hero rank and difficulty by value into a supplied profile, then use ordinary recruitment, reserve, cooldown, arrival, AI and damage. The protected hero, stopped reinforcements and disabled settlement are explicit practice fixtures. No earned unlock or campaign progress is granted.

Returning must restore the original profile, battle, clock, motion state, paused origin, management selection, card/query/scroll, cart and wishlist. Preserve any cached Training session. Trial guards cover both direct save routes and asynchronous file-import completion; ordinary assisted Playground remains saveable. Contract-specific practice targets and stage feedback must describe real simulation rather than shortcut damage or outcomes. Authored trial actors wait for the first actual selected-contract spawn; ordinary queue timing, recruitment costs, reserve, cooldown, player arrows and effects continue. Restore the actors' original step functions permanently on that spawn and never rearm after a recruit dies; Reset creates a fresh fixture. This is explicit preparation assistance. Trial-only incoming/Pause labels must reflect the stopped reinforcement stream and selected contract. Release 65 passed native delayed-deployment, actual-cost/damage, Reset and compact-control checks. Release 66 additionally passed the trial-only flag-reminder correction.

## Returning-player Crownroad Hall

The homepage previews only validated same-origin local Crownroad checkpoints. Its reader never writes, removes, acquires save locks, restores a game, starts combat or sends network requests. Keep active profile/provenance, saved frontier/region artwork, timestamps and preparation/opening/result semantics truthful. Names are bounded textContent/bdi and artwork comes from fixed authored mappings. Newer, corrupt, recovered or unavailable storage must be explicit, and stale text/art must clear after storage or lifecycle refresh.

The explicit battle?open=local-saves entry opens the existing chooser before initial creation. It must not create a blank slot merely by setting up or displaying the chooser; ordinary battle entry retains its normal autosave behavior. Continue, New, import and Session only retain their existing explicit decisions. Entry is synchronous, unstarted and unavailable during temporary sessions or an open panel.

## Finite levy defense candidate

The fifth optional Skirmish doctrine supplies four manually called five-unit waves: three Grunts, one Archer and one Priest each. The 20 temporary tickets and 10 auxiliary slots are separate from paid contracts/caps. Living ownership, corpses, cooldowns and dispatch timing matter; finite tickets cannot provide indefinite replacements. Existing company orders follow actual troop roles.

Four enemy stages begin at 0/45/100/160 simulation seconds. Breaking the hostile keep withdraws undispatched reserves, but living enemies and the home flag still matter. Resolve terminal outcomes after the whole tick, prioritizing actual hero, home-keep and flag loss. Status/results use immutable recorded loss conditions; unknown forced defeats use neutral wording. Preserve ordinary CTF and existing doctrine behavior.

## Bounded local profiling and synthetic test field

The optional profiler is off initially, memory-only, and stops after a fixed 30-second elapsed deadline. Keep raw animation callback intervals, render-submission intervals, render CPU and tick CPU distinct. Counts follow actual identities and distinguish living, draw-eligible and viewport anchors. The input metric begins at a trusted accepted canvas-event handler and ends at the next completed render submission; it is not OS, touch-device or GPU presentation latency. Backgrounding and pauses break chains and consume the same deadline. Explicitly invalidate samples on source transitions, even when trial entry/return occurs entirely between frames. No telemetry, persistent counters, storage or automatic export.

The disposable Testing preset stages 44 or 48 ordinary rank-2 troops at monotonic staging tick 201 without simulating setup steps. These are explicitly synthetic supplies, not paid purchases or naturally arriving waves. Auxiliary ownership and caps are real. It starts paused; ordinary combat runs after Resume. Zero reserve and guarded actions prevent replenishment. A 120-simulation-second bound or terminal field condition ends it without settlement. Reset/Return discard the fixture and restore the exact origin. Snapshot and restore temporary presentation too: labels, hidden state, banner ARIA/objective metadata and disabled controls must return immediately, even before a render callback. Synthetic profile/save/load entry is visibly disabled and explains that transfers require Return, supplies are temporary and zero reserve prevents replacements. Preserve exact normal/guided session control locks. Guard exports, imports, pending file completions, profile/local restore and stale handlers. Profiler reports must identify controlled-fixture mode. Factory counts and headless timings establish neither native rendering performance nor guaranteed FPS.

## Tactical discovery and finite-levy clarity

Unit contracts expose engine-grounded jobs, capabilities, tradeoffs and actual gold/reserve cost per squad. Role filters retain generic roles and add six grouped jobs. Current-deck counts describe equipped contracts, not active troops or strength scores; roles may overlap. Build inspection and two-card Compare reuse existing lazy atlas portraits. Unknown/custom records must not inherit capabilities from a copied name or portrait.

Compact Build unit cards expose only the existing deployment-cost entry under the actual shared-shell CSS cascade; purpose and deployment rows span the card width. Preserve collapsed squad/non-unit facts, 44-pixel actions, scrolling and placement. Accessible unit button names include actual gold/reserve deployment cost. Native inspection must check nonzero cost bounds in narrow portrait and short landscape; DOM text alone does not prove visibility.

The paused Army entry opens Muster directly only in real finite-levy encounters, and reports readiness, dispatch and slot state. Opening it never commits troops or charges supplies; the explicit Call action retains that responsibility. Full temporary slots, including corpses, continue to block replacement. Ordinary and synthetic Army navigation remains unchanged.

Counted nearby pennants use bounded screen-space grouping with separate teams and genuine controller ownership. Dead, hidden, destroyed and garrisoned units do not acquire visible counts. Layout respects actual status/marker geometry, bounds and ordinary drawing order, with connectors beneath markers. Impossible tiny viewports explicitly omit a label instead of painting an overlap. This presentation adds no permanent live HUD row, input target or engine-state mutation.

## Castle loadouts, heraldry and schema migration

Castle identity is independent of the 30 ability keys. Classic remains the free/default old-save choice; Highwatch uses the shared catalog for both player and enemy health, shelter capacity, shot station and collision geometry. Purchasing does not equip. Preparation must mutate the same pristine keep atomically without field setup, RNG consumption or rerolling. Block mid-field castle changes, including through imported decks and stale handlers, while preserving ordinary same-castle ability edits. Settled choices apply next field.

Palette preview and cancellation are pure. Apply changes only the current profile's approved appearance ID, and renderers read fixed tokens without overriding enemy, health, elemental or status cues. Retain two-tone allied chevrons so team identity is not solely color-based. Deck imports never import appearance.

Keep old imports and new schema writers explicit. Independent frozen44/69 codec fixtures must retain their recorded hashes; do not adapt them to the current writer or replace their dependency closure with current modules. Verify both banks are unchanged when old readers encounter future metadata, unknown IDs/levels or unsupported palettes. A green current-reader round trip is insufficient migration evidence.

SK2 is limited to the optional Highwatch doctrine; it supplies its own disposable profile and cannot confer campaign ownership. SK1 seeds and old default stages retain their pinned behavior. The optional enemy archers leave their gallery immediately under ordinary AI. Keep staged gallery evidence clearly separate from that default scenario and keep bounded unresolved balance observations unresolved.

The portrait fixed Build grid owns two independent scroll regions. Open castle/help disclosures must not inherit legacy overflow-visible behavior. Keep the higher-specificity correction scoped to portrait and preserve short-landscape controls. After castle Equip replaces its buttons, restore focus to a live enabled action with preventScroll; retain pane offsets and prepared-field identity. Saved-deck action copy includes both dedicated slots and wraps within narrow screens. Battle-report actor classification uses an explicit authored keep-type allowlist, never untrusted region text.

## Causeway occupation and conservative recovery

Only explicitly registered Causeway objectives may extend their ground-order availability or count occupation. Keep ordinary encounter behavior unchanged. Validate actual world/controller ownership and eligible living ground identities on every tick; snapshots are pure and repeated reads never award time. Occupation advances once after the whole normal tick and retains cumulative progress across interruptions. Victory requires secured occupation, resolved finite enemies and the home flag at base, with ordinary mandatory losses taking priority.

Grounded-flag impossibility is a separate conservative proof. Preserve recoverers already alive, pending paid arrivals, refundable reserve and affordable-or-later-affordable owned contracts. Unknown producers, actors, transformations or effects must not become false terminal losses. Do not use present gold, cooldowns, menu assignments or battlefield capacity as impossibility proofs. The diagnostic reads state and cannot mutate queues or grant supplies.

Castle Equip should retain focus on the same card choice and its stable accessible name while aria-pressed changes. Reselecting the current choice must return before invoking the host, rerendering, announcing or writing a checkpoint. Preserve unowned, live, read-only and stale-profile guards, pane offsets and all ability identities. The bounded keyboard harness models the resulting native button click explicitly; real keyboard activation, tab order and visible focus still require native acceptance.

## Short-landscape Build collection

Keep one inventory scroll owner in short landscape, with search, complete card rows and pagination in ordinary flow. The card list itself no longer owns a tiny nested viewport in this scope. Register inventory with the existing drag-scroll mechanism and retain placement scrolling independently. Search/page transitions reset both applicable offsets; inspection and castle updates preserve the inventory element and current offset. Read-only resources may use the header center only within the explicit minimum-width/short-landscape media condition; keep navigation and Back clear.

Verify real browser dimensions and native mouse/keyboard assignment in addition to source-cascade tests. Entire cards should be scroll-reachable with their 44-pixel controls intact, without granting ownership, spending gold or changing bindings during mere navigation. Preserve portrait/desktop rules and existing castle focus/scroll behavior.

## Portrait Build rows and header clearance

Compact illustrated portrait rows are scoped to Build at widths up to 620 pixels. Preserve real art, identity, rank, tactical role, binding and supplied facts; do not hide data to achieve density. Keep actual unit deployment costs and squad count, bow facts and native 44-pixel actions. Inventory owns scrolling in this scope while placement/castle scrolling stays independent. Responsive column sizing must remain safe when the pane is narrower than the nominal 260-pixel minimum.

Search, paging, inspection, drag edge scrolling, keyboard placement and rotation retain their existing state callbacks and node identities. Header resource reservation must accommodate the longest current return action and allow factual wrapping without intercepting pointer input. Verify real pixels, current long labels and native interactions; source selectors alone are not clearance evidence. Catalog and desktop remain separate from this bounded presentation change.

Portrait Build tracks must share the actual available flex height rather than forcing positive minimums beyond the footer. The final scoped rule uses zero-minimum fractional tracks (.65fr/1fr), with placement and inventory keeping independent scroll ownership. Verify the complete Previous/Next rectangles at maximum collection scroll in the native browser, including safe-bottom insets; a button present in the DOM or partly clickable is not a full-target pass.

Archer liveness checks apply when acquiring a new target on either team. Do not generalize the caller prefilter for newer recruit skills to regular archers: they receive unfiltered opponents too. New acquisition excludes dead/destroyed targets, but existing windups and launched shots intentionally keep their committed target. Review deterministic trajectory and resource changes with causal receipts; do not describe unchanged prices or cooldowns as proof of balance neutrality.

The optional owned-card Inspector comparison reads current visible slots and wrappers. Keep replacement and swap semantics distinct: swapping equipped cards does not change deck membership or army-job coverage. Revalidate the source, target, ownership, layout and profile before arming a reviewed destination; stale or dismissed handlers must not overwrite current intent. Only compare metrics sharing key, unit and scope, and never infer mechanics from copied artwork. Keep actual placement in the existing action-bar path.

The live company picker issues complete named commands on native SELECT change. Preserve native arrow/Enter/Escape semantics and keep focus in the picker until the player exits; global battle shortcuts remain blocked while it owns focus. Current-state labels must read the real order snapshot, not retain last-command text. Revalidate shown and interaction battle identities before dispatch. The separate all-ground shortcut always targets both companies. An issued-order toast owns only its matching displayed text, so external orders/outcomes clear stale receipts without hiding unrelated warnings. Keep engine rules and the existing 44-pixel input slot unchanged.

Keep optional Build comparisons decision-first: consequence and equipped-job changes precede both actual current ranks and squad costs. Auto and reserve consequences remain outside collapsed detail. Preserve real compact art, metric scopes and all full tactics in native disclosures. Ordinary inspection remains expanded, and No comparison restores it. Do not rebuild unchanged comparison markup on harmless renders: preserve open details and focused summary identity. Stale reviews cannot arm destinations. Keep Select separate from actual placement, retain the previous arm/search/scroll on cancellation, and verify decision and action reachability in the native browser rather than inferring layout from DOM tests.

## Dormant account frontend

Account UI/client/model/codec/journal modules are included with feature-off defaults and no visible or network footprint. This repository contains no Go service or configured production provider. Do not activate accounts as part of static deployment.

When separately enabled in a supported integration, preserve the dynamic temporary-session predicate, battle import generation and local-vault review intent. Downloads and uploads require explicit decisions; never automatically migrate or upload saves. Preserve reviewed revisions, validation and uncertain-write reconciliation. Tests include synthetic own-format fixtures, never user saves. Google sign-in is an explicit new-tab flow only when configured. Frontend tests do not establish backend security, provider operation or enabled native layout acceptance.

## Diagnostics

Optional battle diagnostics are disabled initially and stay in bounded memory. They capture an explicit allowlist of gameplay facts, with no profile identity, save/replay payload, network transmission or automatic export. Keep enable/reset/export actions explicit and ensure diagnostics cannot consume gameplay RNG or mutate the engine.

Viewport-lab interaction warnings must distinguish painted geometry from exposed interaction targets. Inert and closed-disclosure content is ineligible; each disclosure's first direct summary stays exposed, subject to all enclosing disclosure and visibility checks. Preserve painted inert HUD area in occlusion totals and retain thresholds, clipping, deduplication, aim samples and genuine live warnings. Synthetic geometry tests are a regression boundary, not native layout acceptance.

Portrait thumb controls follow measured arsenal height through the presentation-only dock helper. Preserve 48px height and accepted minimum 44px widths, complete action labels and cooldowns, sparse/full dock behavior, company/companion utilities, and unchanged landscape placement. Ignore invalid or hidden measurements and avoid repeated identical style writes. The existing camera uses movement geometry; verify resulting framing and clearance natively rather than treating synthetic geometry as browser acceptance.

Portrait two-line card labels must not flex-shrink. Preserve the 48px target budget: 20px icon, two 12px line boxes with 10px type, zero gap, and 4px combined vertical padding/border. Selected and unselected borders need matching inner budgets. Cooldown overlays retain their own 14px type and 24px height. Check actual long-label rectangles and zoom in the native browser; CSS arithmetic and source checks are not layout proof.

Scout preparation is a read-only bridge from the actual starting roster to shared atlas advice and exact card inspection. Preserve battle-identity-scoped selection across contract trials, invalidate it for new fields, and retain browsed destination and return focus. Equipped, reserve and unowned status must use real ownership and bindings. Inspection must never buy, equip, arm placement or start a field. Keep the disclosure closed by default inside the orders scroll and verify native wrapping, reachability and inspector/cart/trial return at phone proportions.

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
