# Castledecks

Castledecks is a browser-based archery and army campaign prototype. Defend your keep, recruit allies, equip ability cards, and progress through a campaign. It began with BowMaster Prelude-inspired mechanics and is developing its own presentation and game systems.

The game uses native JavaScript modules, HTML, CSS, and Canvas. There is no bundler or runtime dependency installation step. `site/dist/` contains the editable runtime source, despite its directory name.

## Run locally

With Node.js 22 or later, run the local server from the repository root:

```sh
npm start
```

Open <http://127.0.0.1:8000/battle>. Use the lobby to start a campaign or choose a rehearsal. Serving the files over HTTP is required for browser ES modules; do not open the HTML through `file://`.

## Validate and test

Use Node.js 22 or later. Rendering regressions use the pinned, test-only `@napi-rs/canvas` package; the game and local server themselves require no dependencies.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run check
```

The check validates source syntax, local asset references, packaging hygiene and markup, then runs the deterministic engine and bounded UI regression suites. CI runs the same command on pushes and pull requests.

## Source layout

- `site/dist/`: editable game code, styles, pages and newly created artwork
- `site/dist/engine/`: simulation, actors, campaign, progression and input models
- `tests/`: engine and UI regressions, including the bounded DOM/canvas harness
- `tests-recruitment/`: recruitment, companion and friendly-fire regressions
- `scripts/`: portable source validation
- `docs/development.md`: architecture, test boundaries and contribution workflow

## Current scope

The prototype includes a 30-field campaign configuration, a lobby, campaign profile import/export, three action-bar pages, an ability-card armory, 12 regular recruit types and a companion. Balance, presentation and mobile input are still under development.

The test harness is not a browser emulator. Automated passes do not prove native touch behavior, layout correctness, long-session stability, game balance or exact compatibility with the original Flash game. See the development guide for the manual acceptance checklist.

This repository contains independently written implementation code and newly created presentation assets. Original Flash files, recovered ActionScript, original media, private research, user saves and deployment credentials are excluded. No original-game runtime is needed to run the game or its tests.

The repository is the reviewable source mirror. The existing Sites publishing workflow remains separate; pushing here does not automatically publish the live game.
