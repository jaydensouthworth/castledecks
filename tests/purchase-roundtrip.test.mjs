import test from 'node:test';
import assert from 'node:assert/strict';
import {PlayerProfile, SKILLS, serializeProfile, restoreProfile} from '../site/dist/engine/progression.mjs';
import {CampaignProfiles} from '../site/dist/engine/profile-manager.mjs';
import {CampaignBattle} from '../site/dist/engine/first-battle.mjs';
import {seededRandom} from '../site/dist/engine/combat.mjs';

test('modern displayed-price purchase accepts exact gold, persists zero and charges only once', () => {
  const profile = new PlayerProfile('Buyer');
  const price = SKILLS.fireArrow.price;
  for (const gold of [0, price - 1, price - 0.5]) {
    profile.gold = gold;
    assert.equal(profile.purchase('fireArrow'), false);
    assert.equal(profile.gold, gold);
    assert.deepEqual([...profile.owned], ['arrow']);
  }
  // Funding is a controlled engine fixture, not claimed gameplay earnings.
  profile.gold = price;
  assert.equal(profile.purchase('fireArrow'), true);
  assert.equal(profile.gold, 0);
  assert.equal(profile.skills.length, 2);
  const restored = restoreProfile(serializeProfile(profile));
  assert.equal(restored.gold, 0);
  assert.equal(restored.owned.has('fireArrow'), true);
  profile.gold = price; // Even renewed funds cannot buy the same skill twice.
  assert.equal(profile.purchase('fireArrow'), false);
  assert.equal(profile.purchase('missingSkill'), false);
  assert.equal(profile.gold, price);
  assert.equal(profile.skills.length, 2);
});

test('funded projectile and squad purchases survive a portable bundle and work in a fresh battle', () => {
  const manager = new CampaignProfiles();
  const profile = manager.active;
  profile.gold = 5001;
  assert.equal(profile.purchase('fireArrow'), true);
  assert.equal(profile.purchase('grunt'), true);
  const fire = profile.skills.find(s => s.id === 'fireArrow');
  const grunt = profile.skills.find(s => s.id === 'grunt');
  fire.addXP(250.5);
  fire.binding = 4;
  grunt.binding = 5;
  grunt.autocast = false;
  fire.cooldown = 1;
  const saved = manager.exportBundle();
  const restoredManager = CampaignProfiles.fromBundle(saved);
  const restored = restoredManager.active;
  assert.equal(restoredManager.exportBundle(), saved);
  assert.equal(restored.gold, 3001);
  assert.deepEqual([...restored.owned], ['arrow', 'fireArrow', 'grunt']);
  assert.equal(restored.purchase('fireArrow'), false);
  assert.equal(restored.gold, 3001);
  const restoredFire = restored.skills.find(s => s.id === 'fireArrow');
  const restoredGrunt = restored.skills.find(s => s.id === 'grunt');
  assert.equal(restoredFire.rank, 1);
  assert.equal(restoredFire.xp, 150.5);
  assert.equal(restoredFire.cooldown, SKILLS.fireArrow.cooldown);
  assert.equal(restoredGrunt.autocast, false);
  const battle = new CampaignBattle({profile: restored, random: seededRandom(5678)});
  assert.equal(battle.hotbar.bars[0][4], restoredFire);
  assert.equal(battle.hotbar.bars[0][5], restoredGrunt);
  // Tick the real engine to readiness; do not override either cooldown.
  for (let i = 0; i < 330; i++) battle.step();
  assert.equal(battle.outcome, null);
  assert.equal(restoredFire.cooldown, 0);
  assert.equal(restoredGrunt.cooldown, 0);
  battle.selectSkill(4);
  battle.step();
  assert.equal(battle.activeSkill, restoredFire);
  assert.equal(battle.shoot({canFire: true, vx: 18, vy: -8}), true);
  assert.equal(restoredFire.cooldown, restoredFire.maximum);
  assert.ok(battle.projectiles.some(projectile => projectile.kind === 'fire_arrow'));
  const population = battle.friendlyQueue.population;
  battle.selectSkill(5);
  battle.step();
  assert.equal(restored.gold, 3001 - SKILLS.grunt.summon.cost);
  assert.equal(battle.friendlyQueue.population, population - 4);
  assert.equal(battle.friendlyQueue.queue.length, 4);
  assert.equal(restoredGrunt.cooldown, restoredGrunt.maximum - 2);
});
