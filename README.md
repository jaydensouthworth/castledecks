# Castledecks

Castledecks is a browser-based archery and army campaign prototype. Defend your keep, recruit allies, equip ability cards, and progress through a campaign. It began with BowMaster Prelude-inspired mechanics and is developing its own presentation and game systems.

The game uses native JavaScript modules, HTML, CSS, and Canvas. There is no bundler or runtime dependency installation step. `site/dist/` contains the editable runtime source, despite its directory name.

## Run locally

With Node.js 22 or later, run the local server from the repository root:

```sh
npm start
```

Open <http://127.0.0.1:8000/battle>. Use the lobby to start a campaign or choose a rehearsal. Serving the files over HTTP is required for browser ES modules; do not open the HTML through `file://`.

## Deploy with Docker or Dokploy

The root `Dockerfile` serves the static game with Nginx on container port 80. In Dokploy, use branch `main`, the Dockerfile build type, `Dockerfile` as the file path, `.` as the build context and port `80` for the domain. No environment variables or application backend are required.

The homepage is `/`, developer details are at `/about`, and the playable game is `/battle`. Extensionless page routes are supported. Saved games belong to the browser and website address; export a portable backup before moving to another address.

With Docker installed, `bash scripts/check-container.sh` builds the image and checks its Nginx configuration, real HTTP routes, served source bytes, JavaScript MIME type, cache headers and missing-file responses. CI runs this check after the portable suite.

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

See [release 78 candidate notes](docs/releases/78.md) for this snapshot and its known limits. An optional comparison inside the owned-card Inspector explains an occupied-key replacement or swap before placement, including verified army-job coverage and current-rank facts. Selecting a comparison is read-only; placement still uses the ordinary key action. Native acceptance of 78 is pending; [accepted release 77](https://github.com/jaydensouthworth/castledecks/commit/6b5dd335c5042f8d9476118aec07ea55b91422df) remains the rollback. Account feature-off defaults remain unchanged.

The prototype includes a 30-field campaign atlas, a live preparation table, a separate Wayfarer Charter expedition mode, seeded Skirmish practice, optional guided Training, remappable controls, named deck presets, campaign profile import/export, device-local checkpoints, three action-bar pages, a shared full-viewport card discovery and deck workspace, an Army command ledger, 12 regular recruit types and a companion. Allied field caps grow with campaign progress, with quick Advance/Rally commands and fixed Rear/Center/Forward lines. Wayfarer now has a six-field branching route board, and recruited allied trebuchets can target hostile buildings when no distant troop target remains. Balance, presentation and mobile input are still under development.

Campaign checkpoints stay in this browser, using three collection slots and two verified checkpoint copies per slot. They preserve battle openings and settled results, not a live battlefield. Clearing site data removes local checkpoints; export a file or code for a portable backup. Training, Skirmish and expeditions remain separate from earned campaign progress. Saved decks arrange owned abilities; they never grant cards or resources. There is no backend or account service.

The test harness is not a browser emulator. Automated passes do not prove native touch behavior, layout correctness, long-session stability, game balance or exact compatibility with the original Flash game. See the development guide for the manual acceptance checklist.

This repository contains independently written implementation code and newly created presentation assets. Original Flash files, recovered ActionScript, original media, private research, user saves and deployment credentials are excluded. No original-game runtime is needed to run the game or its tests.

The repository is the reviewable source mirror and Docker build source. The Sites publishing workflow remains separate. A configured Dokploy deployment may rebuild when its tracked branch changes.
