import {writeFileSync, readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {manualCrest, siegeShelter, stagedGallery, matchedScenario, MATCHED_SCHEDULE} from './castle-balance70-harness.mjs';
import {DEFAULT_CASTLE_PRACTICE} from '../site/dist/skirmish-model.mjs';

const evidence = {
  scope: 'Deterministic engine examples; not native acceptance or broad human balance evidence.',
  invariant: 'No stat, damage, HP, cooldown, protectedTesting, resource or outcome injection. Same seeded descriptor, supplied kit and scheduled input policy within each castle pair.',
  schedule: MATCHED_SCHEDULE,
  auto: 'High arc, 100% supplied default power, Basic only; press the fixed enemy keep point (1800, keep ground Y minus110) every32 ticks; release one tick later. No target or damage feedback drives the input.',
  sourceHashes: Object.fromEntries([
    '../site/dist/engine/first-battle.mjs', '../site/dist/engine/castle-catalog.mjs',
    '../site/dist/engine/ranged-troop.mjs', '../site/dist/skirmish-model.mjs', '../site/dist/skirmish-battle.mjs',
    './castle-balance70-harness.mjs',
  ].map(path => [path, createHash('sha256').update(readFileSync(new URL(path, import.meta.url))).digest('hex')])),
  manual: [manualCrest('classic'), manualCrest('highwatch'), manualCrest('classic', 75)],
  siege: ['classic', 'highwatch'].map(siegeShelter),
  stagedGallery: ['classic', 'highwatch'].map(stagedGallery),
  scenarios: [],
};
for (const [threat, seed] of [['scout', 91], ['standard', 73421], ['veteran', 814]]) {
  for (const plan of ['army', 'army-auto', 'bow-auto']) for (const castleId of ['classic', 'highwatch']) {
    evidence.scenarios.push(matchedScenario({castleId, plan, descriptor: {...DEFAULT_CASTLE_PRACTICE, threat, seed}}));
  }
}
const destination = name => new URL(name, import.meta.url);
writeFileSync(destination('./castle-balance70-evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
const rows = evidence.scenarios.map(r => `| ${r.descriptor.threat}/${r.descriptor.seed} | ${r.plan} | ${r.castleId} | ${r.outcome} | ${r.tick} | ${r.homeKeepDamage}/${r.initial.friendlyHP} | ${r.heroDamage} | ${r.goldSpent}/${r.reserveSpent} | ${r.shots} | ${r.friendlyDeaths}/${r.enemyDeaths} | ${r.homePeak}/${r.homeGalleryShots} | ${r.enemyPeakAfterOpening}/${r.enemyGalleryShots} | ${r.peakActors} |`);
const text = `# Castle comparison70: bounded engine evidence

Run: node --test tests/castle-balance70.test.mjs (7/7 passed).
Regenerate: node tests/castle-balance70-report.mjs.
Machine-readable inputs, full receipts, results and source hashes: castle-balance70-evidence.json.

## What is demonstrated

- Actual Classic manual controller press/move/release, ordinary Basic cooldown and projectile collision: identical drag(-158,+59) grounds Classic at x950.4/y406.3, while Highwatch clears the authored ridge and hits the ordinary enemy keep for22 damage. Only launch elevation changes (500 to450); velocity is identical. Classic can also clear it with the ordinary steeper drag(-158,+75). This terrain is a standalone fixture, not the generated SK2 field.
- Same idle seed and single ordinary enemy trebuchet: Classic starts8400HP, Highwatch6720HP. Natural siege destroys shelter at ticks21043 and10317 respectively; the hero leaves on the next tick. These times include BOTH the20% HP reduction and larger/taller collision geometry; they are not an isolated estimate of the HP multiplier. Ordinary siege later kills the exposed hero in both runs.
- Explicitly staged gallery fixture: three finite-roster ordinary enemy archers at x1800 and one normally paid rider at x1300. Only initial positions are authored. No attemptGarrison call or stat/cooldown adjustment. Normal chooseNextAction shelters3 archers in Classic versus2 in Highwatch, leaving one Highwatch archer exposed. Over601 ticks, actual gallery projectiles number6 versus4, originating at y500 versus450. The rider squad costs30 gold/4 reserve in both. This is mechanical evidence, not proof the optional field uses its gallery well.
- Default SK2 supplies rank6/gold1200/reserve70 and both castle choices. Identical successful paid schedules win with army alone and with army+Basic Auto. The10 summon actions at ticks0/330/660 spend280 gold and31 reserve. No stat/resource injections, protected testing or forced outcome are used.
- Keep-focused bow-only Auto breaks the default enemy keep but loses to ordinary flag counterplay with surviving enemies. Breaking the keep is not enough to complete the cleanup objective.

## Important limitation

Default enemy Highwatch starts with2 sheltered archers, but they leave on tick1. In both matched winning plans and bow-only default runs, post-opening enemy keep occupancy and gallery shots are zero. Ten additional exploratory rider-rush runs across seeds73421,91,814,17,1234 also found zero post-opening enemy gallery use. Do not claim the optional encounter demonstrates an active enemy gallery defense. The separate staged fixture is clearly distinguished above.

## Matched observation matrix

Every pair shares descriptor seed, kit, fixed summon schedule and fixed Auto input policy. Outcomes naturally end at different ticks; identical attempted schedules may yield different paid admissions in nondefault scenarios, which are fully recorded in JSON. Observation limit is30000 ticks; unresolved means unresolved, never a win. Tick durations use the engine33Hz timebase. Home occupancy includes the hero. Enemy gallery occupancy excludes ticks0/1. Death counts are spawned ordinary units with nonpositive HP; reserve withdrawals are not deaths. Stats stop at combat outcome, before summary rewards.

| Field | Plan | Castle | Outcome | Ticks | Home damage/startHP | Hero damage | Gold/reserve spent | Basic shots | Deaths ally/enemy | Home max/archer shots | Enemy post-opening max/shots | Peak actors |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${rows.join('\n')}

These three practice threat levels4/6/8 are not an early/mid/late campaign sweep. Native input/layout, full campaign balance, physical-device performance and broad human fun/balance remain unverified.
`;
writeFileSync(destination('./castle-balance70-evidence.md'), text);
console.log(JSON.stringify({runs: evidence.scenarios.length, outcomes: evidence.scenarios.map(r => [r.descriptor.threat, r.plan, r.castleId, r.outcome, r.tick]), outputs: ['castle-balance70-evidence.json', 'castle-balance70-evidence.md']}, null, 2));
