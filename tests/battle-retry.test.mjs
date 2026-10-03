import test from 'node:test';
import assert from 'node:assert/strict';
import {CampaignBattle} from '../site/dist/engine/first-battle.mjs';
import {CampaignProfiles} from '../site/dist/engine/profile-manager.mjs';
import {PlayerProfile} from '../site/dist/engine/progression.mjs';
import {seededRandom} from '../site/dist/engine/combat.mjs';
import {FLAG_STATUS} from '../site/dist/engine/flag-troop.mjs';

const MAX_TICKS = 15000;

function startBattle(profile, seed = 1234) {
  const events = [];
  const battle = new CampaignBattle({
    profile,
    // Matches the current UI's retry-level choice, without loading a DOM.
    level: Math.min(30, Math.max(1, profile.highestLevel)),
    random: seededRandom(seed),
    onEvent: event => {
      if (['spawn', 'outcome', 'summary'].includes(event.type)) {
        events.push({type: event.type, tick: event.tick, outcome: event.outcome, team: event.unit?.team});
      }
    },
  });
  return {battle, events};
}

function simulateUnattended(run) {
  let refills = 0;
  for (let i = 0; i < MAX_TICKS && !run.battle.summary; i++) {
    const remaining = run.battle.wave.remaining;
    run.battle.step();
    if (run.battle.wave.remaining > remaining) refills++;
  }
  assert.ok(run.battle.summary, `battle must end within ${MAX_TICKS} ticks`);
  assert.equal(run.battle.outcome, 'defeat');
  assert.equal(run.battle.ownFlag.status, FLAG_STATUS.CAPTURED);
  assert.equal(run.battle.enemyFlag.status, FLAG_STATUS.AT_BASE);
  assert.ok(run.battle.hero.hp > 0, 'this fixture loses by natural flag capture');
  const spawns = run.events.filter(event => event.type === 'spawn' && event.team === 'bad');
  assert.ok(spawns.length > run.battle.wave.maximum, 'enemies must spawn beyond the first wave');
  assert.ok(refills >= 1, 'the real wave countdown must replenish its budget');
  const outcomes = run.events.filter(event => event.type === 'outcome');
  const summaries = run.events.filter(event => event.type === 'summary');
  assert.equal(outcomes.length, 1);
  assert.equal(summaries.length, 1);
  assert.ok(summaries[0].tick > outcomes[0].tick, 'summary follows the engine end countdown');
  assert.deepEqual(run.battle.summary, {outcome: 'defeat', gold: 0, xp: 0, campaignComplete: false});
  return {tick: run.battle.tick, enemySpawns: spawns.length, waveRefills: refills};
}

test('natural flag defeat reaches summary; retry creates fresh waves and can finish again', t => {
  const profile = new PlayerProfile('Defender');
  const first = startBattle(profile);
  const firstMetrics = simulateUnattended(first);
  assert.equal(profile.defeats, 1);
  assert.equal(profile.victories, 0);
  assert.equal(profile.level, 1);
  assert.equal(profile.highestLevel, 1);
  const profileAfterDefeat = new CampaignProfiles({profiles: [profile]}).exportBundle();
  const finishedTick = first.battle.tick;
  const eventCount = first.events.length;
  for (let i = 0; i < 200; i++) first.battle.step();
  assert.equal(first.battle.tick, finishedTick);
  assert.equal(first.events.length, eventCount);
  assert.equal(profile.defeats, 1, 'a completed battle must not count another defeat');

  const retry = startBattle(profile);
  assert.equal(retry.battle.profile, profile);
  assert.notEqual(retry.battle.hero, first.battle.hero);
  assert.notEqual(retry.battle.wave, first.battle.wave);
  assert.notEqual(retry.battle.enemies, first.battle.enemies);
  assert.equal(retry.battle.tick, 0);
  assert.equal(retry.battle.outcome, null);
  assert.equal(retry.battle.summary, null);
  assert.equal(retry.battle.badTeam.length, 0);
  assert.equal(retry.battle.wave.remaining, retry.battle.wave.maximum);
  assert.equal(retry.battle.ownFlag.status, FLAG_STATUS.AT_BASE);
  assert.equal(retry.battle.hero.hp, retry.battle.hero.maxHp);
  assert.equal(new CampaignProfiles({profiles: [profile]}).exportBundle(), profileAfterDefeat);
  const retryMetrics = simulateUnattended(retry);
  assert.equal(profile.defeats, 2);
  assert.equal(profile.highestLevel, 1);
  t.diagnostic(`Seed 1234, first: ${JSON.stringify(firstMetrics)}; retry: ${JSON.stringify(retryMetrics)}`);
});

test('a saved defeat restores campaign progress and starts a new battle with fresh waves', t => {
  const manager = new CampaignProfiles();
  const first = startBattle(manager.active);
  simulateUnattended(first);
  const saved = manager.exportBundle();
  const restored = CampaignProfiles.fromBundle(saved);
  assert.equal(restored.active.defeats, 1);
  assert.notEqual(restored.active, manager.active);
  const resumed = startBattle(restored.active);
  assert.equal(resumed.battle.tick, 0);
  assert.equal(resumed.battle.outcome, null);
  assert.equal(resumed.battle.ownFlag.status, FLAG_STATUS.AT_BASE);
  assert.equal(resumed.battle.enemies.index, 0);
  assert.equal(resumed.battle.wave.remaining, resumed.battle.wave.maximum);
  const metrics = simulateUnattended(resumed);
  assert.equal(restored.active.defeats, 2);
  assert.equal(manager.active.defeats, 1, 'resumed progress is independent of the exported campaign');
  assert.equal(manager.exportBundle(), saved);
  t.diagnostic(`Restored campaign, seed 1234: ${JSON.stringify(metrics)}`);
});
