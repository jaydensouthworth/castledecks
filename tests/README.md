# Regression suites

Run `npm test` from the repository root with Node.js 22 or later. First install the pinned canvas test dependency with `npm ci --ignore-scripts --no-audit --no-fund`. No private reference files are needed.

Tests load the real engine and UI modules. They cover input ownership, interrupted interactions, natural defeat/retry, campaign profiles, purchases, loadouts, aiming, camera projection, damage lifetimes, recruitment and companions. Deterministic fixtures use seeded random values and bounded simulation ticks. Assisted fixtures explicitly identify supplied gold, unlocks or protection rather than presenting them as normal progression.

The UI harness is intentionally bounded. Rendering, layout, focus order, native pointer/touch capture and device lifecycle behavior still need browser/device acceptance. The suites do not establish full game balance or original Flash runtime equivalence.
