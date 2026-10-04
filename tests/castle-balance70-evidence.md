# Castle comparison70: bounded engine evidence

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
| scout/91 | army | classic | unresolved-at-observation-limit | 30000 | 948/10400 | 0 | 280/31 | 0 | 5/15 | 1/0 | 0/0 | 30 |
| scout/91 | army | highwatch | unresolved-at-observation-limit | 30000 | 237/8320 | 0 | 280/31 | 0 | 4/15 | 1/0 | 0/0 | 30 |
| scout/91 | army-auto | classic | victory | 4240 | 237/10400 | 0 | 280/31 | 133 | 8/14 | 1/0 | 0/0 | 29 |
| scout/91 | army-auto | highwatch | victory | 4151 | 237/8320 | 0 | 280/31 | 130 | 9/14 | 1/0 | 0/0 | 29 |
| scout/91 | bow-auto | classic | defeat | 8416 | 262/10400 | 0 | 0/0 | 263 | 0/0 | 1/0 | 0/0 | 5 |
| scout/91 | bow-auto | highwatch | defeat | 8416 | 257/8320 | 0 | 0/0 | 263 | 0/0 | 1/0 | 0/0 | 5 |
| standard/73421 | army | classic | victory | 10750 | 1050/10400 | 0 | 280/31 | 0 | 10/21 | 2/1 | 0/0 | 32 |
| standard/73421 | army | highwatch | victory | 9524 | 1575/8320 | 0 | 280/31 | 0 | 8/21 | 2/4 | 0/0 | 32 |
| standard/73421 | army-auto | classic | victory | 4922 | 525/10400 | 0 | 280/31 | 154 | 10/18 | 1/0 | 0/0 | 32 |
| standard/73421 | army-auto | highwatch | victory | 4134 | 1575/8320 | 0 | 280/31 | 130 | 5/17 | 1/0 | 0/0 | 31 |
| standard/73421 | bow-auto | classic | defeat | 6878 | 691/10400 | 0 | 0/0 | 215 | 0/0 | 1/0 | 0/0 | 7 |
| standard/73421 | bow-auto | highwatch | defeat | 6878 | 673/8320 | 0 | 0/0 | 215 | 0/0 | 1/0 | 0/0 | 7 |
| veteran/814 | army | classic | victory | 10003 | 0/10400 | 0 | 280/31 | 0 | 12/28 | 4/15 | 0/0 | 37 |
| veteran/814 | army | highwatch | victory | 9171 | 864/8320 | 0 | 280/31 | 0 | 12/28 | 2/10 | 0/0 | 37 |
| veteran/814 | army-auto | classic | victory | 5881 | 0/10400 | 0 | 280/31 | 184 | 11/28 | 2/9 | 0/0 | 35 |
| veteran/814 | army-auto | highwatch | victory | 4787 | 1728/8320 | 0 | 280/31 | 150 | 12/21 | 2/3 | 0/0 | 35 |
| veteran/814 | bow-auto | classic | defeat | 5639 | 1003/10400 | 0 | 0/0 | 177 | 0/0 | 1/0 | 0/0 | 7 |
| veteran/814 | bow-auto | highwatch | defeat | 5639 | 948/8320 | 0 | 0/0 | 177 | 0/0 | 1/0 | 0/0 | 7 |

These three practice threat levels4/6/8 are not an early/mid/late campaign sweep. Native input/layout, full campaign balance, physical-device performance and broad human fun/balance remain unverified.
