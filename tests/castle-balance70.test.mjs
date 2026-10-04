import test from 'node:test';
import assert from 'node:assert/strict';
import {manualCrest, siegeShelter, stagedGallery, matchedScenario} from './castle-balance70-harness.mjs';

test('actual matched manual drag clears authored crest only from raised Highwatch station', () => {
  const classic = manualCrest('classic'), high = manualCrest('highwatch');
  assert.deepEqual(classic.drag, high.drag);
  assert.equal(classic.launch.vx, high.launch.vx); assert.equal(classic.launch.vy, high.launch.vy);
  assert.equal(classic.launch.origin.y - high.launch.origin.y, 50);
  assert.equal(classic.reason, 'ground'); assert.equal(classic.enemyKeepDamage, 0);
  assert.equal(high.reason, 'target'); assert.ok(high.enemyKeepDamage > 0);
  for (const r of [classic, high]) {assert.equal(r.shots, 1); assert.equal(r.goldSpent, 0); assert.equal(r.protectedTesting, false);}
});

test('ordinary steeper manual release gives Classic counterplay over the same crest', () => {
  const r = manualCrest('classic', 75);
  assert.equal(r.reason, 'target'); assert.ok(r.enemyKeepDamage > 0); assert.equal(r.shots, 1);
});

test('natural ordinary siege removes lower-HP/taller Highwatch shelter sooner in matched fixture', () => {
  const classic = siegeShelter('classic'), high = siegeShelter('highwatch');
  assert.equal(high.startHP, classic.startHP * .8);
  assert.ok(high.destroyedAt < classic.destroyedAt);
  assert.equal(high.exposedAt, high.destroyedAt + 1);
  assert.equal(high.at10318.sheltered, false); assert.equal(classic.at10318.sheltered, true);
  for (const r of [classic, high]) {assert.equal(r.outcome, 'defeat'); assert.equal(r.goldSpent, 0); assert.equal(r.shots, 0);}
});

test('staged paid-rider approach triggers real enemy gallery AI and exposes Highwatch third archer', () => {
  const classic = stagedGallery('classic'), high = stagedGallery('highwatch');
  assert.deepEqual(classic.first, {occupancy: 3, exposedArchers: 0});
  assert.deepEqual(high.first, {occupancy: 2, exposedArchers: 1});
  assert.equal(classic.galleryShots.length, 6); assert.equal(high.galleryShots.length, 4);
  assert.ok(classic.galleryShots.every(s => s.y === 500)); assert.ok(high.galleryShots.every(s => s.y === 450));
  for (const r of [classic, high]) {assert.equal(r.paid, true); assert.equal(r.goldSpent, 30); assert.equal(r.reserveSpent, 4); assert.equal(r.finiteEnemyReserve, 0);}
});

for (const plan of ['army', 'army-auto']) test(`default optional scenario wins with identical paid ${plan} schedule and no injected stats`, () => {
  const classic = matchedScenario({castleId: 'classic', plan});
  const high = matchedScenario({castleId: 'highwatch', plan});
  assert.deepEqual(classic.receipts, high.receipts);
  assert.ok(classic.receipts.every(r => r.accepted));
  assert.deepEqual(classic.initial.skills, high.initial.skills);
  assert.deepEqual(classic.target, high.target);
  for (const r of [classic, high]) {
    assert.equal(r.initial.rank, 6); assert.equal(r.initial.gold, 1200); assert.equal(r.initial.reserve, 70);
    assert.equal(r.outcome, 'victory'); assert.equal(r.goldSpent, 280); assert.equal(r.reserveSpent, 31);
    assert.equal(r.enemyKeepHP, 0); assert.equal(r.enemyAlive, 0); assert.equal(r.enemyReserve, 0);
    assert.equal(r.protectedTesting, false);
    // This limitation is deliberately asserted, never presented as gallery efficacy.
    assert.equal(r.initial.enemyGarrison, 2); assert.equal(r.enemyPeakAfterOpening, 0);
    assert.equal(r.enemyGarrisonTicksAfterOpening, 0); assert.equal(r.enemyGalleryShots, 0);
  }
});

test('keep-focused Auto without a paid army still loses to ordinary flag counterplay', () => {
  for (const castleId of ['classic', 'highwatch']) {
    const r = matchedScenario({castleId, plan: 'bow-auto'});
    assert.equal(r.outcome, 'defeat'); assert.equal(r.enemyKeepHP, 0); assert.ok(r.enemyAlive > 0);
    assert.equal(r.goldSpent, 0); assert.ok(r.shots > 0); assert.equal(r.heroDamage, 0);
  }
});
