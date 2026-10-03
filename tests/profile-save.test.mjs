import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PlayerProfile, serializeProfile, restoreProfile,
} from '../site/dist/engine/progression.mjs';
import {
  CampaignProfiles, MAX_PROFILE_BUNDLE_BYTES, PROFILE_BUNDLE_SCHEMA,
} from '../site/dist/engine/profile-manager.mjs';

// New implementation-level regression checks; not the unavailable original suite.
function makeManager() {
  const first = new PlayerProfile('Highland 🏹');
  first.gold = 4001; // Explicit funding fixture, not naturally earned gold.
  assert.equal(first.purchase('fireArrow'), true);
  first.skills[1].addXP(150.5);
  first.skills[1].binding = 12;
  first.skills[1].cooldown = 7;
  first.skills[1].strobe = 3;
  first.difficulty = 'hard';
  first.shootingMode = 'point_aim';
  const second = new PlayerProfile('Second');
  second.gold = 91;
  const retired = new PlayerProfile('Previous');
  retired.victories = 30;
  retired.level = retired.highestLevel = 31;
  retired.scene = retired.highestScene = 33;
  retired.gold = 123;
  retired.cheated = true;
  return new CampaignProfiles({profiles: [first, second], retired: [retired], activeIndex: 1});
}

test('single-profile save preserves progress and rebuilds independent skills with fresh timers', () => {
  const profile = makeManager().profiles[0];
  const saved = serializeProfile(profile);
  const restored = restoreProfile(saved);
  assert.equal(serializeProfile(restored), saved);
  assert.notEqual(restored, profile);
  assert.notEqual(restored.skills[1], profile.skills[1]);
  assert.notEqual(restored.owned, profile.owned);
  assert.deepEqual([...restored.owned], ['arrow', 'fireArrow']);
  assert.equal(restored.skills[1].xp, 50.5);
  assert.equal(restored.skills[1].binding, 12);
  for (const skill of restored.skills) {
    assert.equal(skill.cooldown, skill.maximum);
    assert.equal(skill.strobe, 33);
  }
  assert.equal(profile.skills[1].cooldown, 7);
  assert.equal(profile.skills[1].strobe, 3);
  restored.gold++;
  assert.equal(serializeProfile(profile), saved);
});

test('bundle export is pure; restoration preserves ordered records and resets selection', () => {
  const manager = makeManager();
  const active = manager.active;
  const profiles = manager.profiles;
  const retired = manager.retired;
  const saved = manager.exportBundle();
  assert.equal(manager.active, active);
  assert.equal(manager.activeIndex, 1);
  assert.deepEqual(manager.profiles, profiles);
  assert.deepEqual(manager.retired, retired);
  assert.equal(manager.profiles[0].skills[1].cooldown, 7);
  const restored = CampaignProfiles.fromBundle(saved);
  assert.equal(restored.exportBundle(), saved);
  assert.equal(restored.activeIndex, 0);
  assert.equal(restored.active.name, 'Highland 🏹');
  assert.deepEqual(restored.profiles.map(p => p.name), ['Highland 🏹', 'Second']);
  assert.equal(restored.retired[0].name, 'Previous');
  assert.equal(restored.retired[0].cheated, true);
  assert.equal(restored.retired[0].highestLevel, 31);
  assert.notEqual(restored.profiles[0], profiles[0]);
});

test('bundle importer accepts the supported standalone reconstruction profile', () => {
  const profile = makeManager().profiles[0];
  const manager = CampaignProfiles.fromBundle(serializeProfile(profile));
  assert.equal(manager.profiles.length, 1);
  assert.equal(manager.retired.length, 0);
  assert.equal(serializeProfile(manager.active), serializeProfile(profile));
});

test('successful import replaces the complete manager only after validation', () => {
  const manager = makeManager();
  const oldActive = manager.active;
  const oldSnapshot = serializeProfile(oldActive);
  const replacement = new CampaignProfiles({profiles: [new PlayerProfile('Replacement')]});
  const imported = manager.importBundle(replacement.exportBundle());
  assert.equal(imported, manager.active);
  assert.notEqual(imported, oldActive);
  assert.equal(manager.activeIndex, 0);
  assert.equal(manager.profiles.length, 1);
  assert.equal(manager.retired.length, 0);
  assert.equal(manager.active.name, 'Replacement');
  assert.equal(serializeProfile(oldActive), oldSnapshot);
});

test('invalid imports leave the active object, all records, selection, and timers intact', async t => {
  const valid = JSON.parse(makeManager().exportBundle());
  const cases = [
    ['malformed JSON', () => '{'],
    ['unknown schema', v => { v.schema = 'original-flash-save'; }],
    ['unexpected bundle field', v => { v.selected = 1; }],
    ['too many active profiles', v => { v.profiles = Array(10).fill(v.profiles[0]); }],
    ['invalid retired record after valid active records', v => { v.retired[0].profile.gold = -1; }],
    ['non-boolean cheated flag', v => { v.profiles[0].cheated = 'false'; }],
    ['duplicate skill', v => { v.profiles[0].profile.skills.push(v.profiles[0].profile.skills[0]); }],
    ['missing basic arrow', v => { v.profiles[0].profile.skills.shift(); }],
    ['unknown skill', v => { v.profiles[0].profile.skills[1].id = 'unknownArrow'; }],
    ['inconsistent skill threshold', v => { v.profiles[0].profile.skills[1].threshold = 100; }],
    ['out-of-range binding', v => { v.profiles[0].profile.skills[1].binding = 30; }],
    ['string currency', v => { v.profiles[0].profile.gold = '3001'; }],
    ['unsupported aiming mode', v => { v.profiles[0].profile.shootingMode = 'unknown'; }],
    ['missing required progress field', v => { delete v.profiles[0].profile.highestLevel; }],
    ['UTF-8 bundle larger than 1 MiB despite shorter UTF-16 length', v => {
      v.profiles[0].profile.name = '🏹'.repeat(262144);
      const text = JSON.stringify(v);
      assert.ok(text.length < MAX_PROFILE_BUNDLE_BYTES);
      assert.ok(new TextEncoder().encode(text).length > MAX_PROFILE_BUNDLE_BYTES);
      return text;
    }],
  ];
  for (const [name, corrupt] of cases) {
    await t.test(name, () => {
      const manager = makeManager();
      const original = manager.exportBundle();
      const profiles = manager.profiles;
      const retired = manager.retired;
      const active = manager.active;
      const skills = profiles[0].skills;
      const value = structuredClone(valid);
      const text = corrupt(value) ?? JSON.stringify(value);
      assert.throws(() => manager.importBundle(text));
      assert.equal(manager.exportBundle(), original);
      assert.equal(manager.active, active);
      assert.equal(manager.activeIndex, 1);
      manager.profiles.forEach((profile, i) => assert.equal(profile, profiles[i]));
      manager.retired.forEach((profile, i) => assert.equal(profile, retired[i]));
      assert.equal(manager.profiles[0].skills, skills);
      assert.equal(skills[1].cooldown, 7);
      assert.equal(skills[1].strobe, 3);
    });
  }
});

test('standalone save enforces its UTF-8 64 KiB bound', () => {
  const value = JSON.parse(serializeProfile(new PlayerProfile('Bounded')));
  value.name = '🏹'.repeat(16384);
  const text = JSON.stringify(value);
  assert.ok(text.length < 65536);
  assert.ok(new TextEncoder().encode(text).length > 65536);
  assert.throws(() => restoreProfile(text), /64 KiB/);
});

test('export rejects invalid raw scalar values without normalizing the live profile', () => {
  const profile = new PlayerProfile('Invalid');
  profile.gold = {toJSON: () => 1000};
  const originalGold = profile.gold;
  assert.throws(() => serializeProfile(profile), /scalar/);
  assert.equal(profile.gold, originalGold);
  profile.gold = Number.NaN;
  assert.throws(() => serializeProfile(profile));
  assert.ok(Number.isNaN(profile.gold));
});

test('an empty bundle creates a fresh profile; a failed fallback does not commit', () => {
  const empty = JSON.stringify({schema: PROFILE_BUNDLE_SCHEMA, profiles: [], retired: []});
  const restored = CampaignProfiles.fromBundle(empty, {defaultName: 'Fresh'});
  assert.equal(restored.active.name, 'Fresh');
  assert.equal(restored.profiles.length, 1);
  assert.equal(restored.active.defeats, 0);
  const manager = makeManager();
  const original = manager.exportBundle();
  const active = manager.active;
  manager.defaultName = () => { throw new Error('name unavailable'); };
  assert.throws(() => manager.importBundle(empty), /name unavailable/);
  assert.equal(manager.exportBundle(), original);
  assert.equal(manager.active, active);
  assert.equal(manager.activeIndex, 1);
});
