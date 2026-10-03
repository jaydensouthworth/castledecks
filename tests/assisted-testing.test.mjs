import test from 'node:test';
import assert from 'node:assert/strict';
import {CampaignBattle} from '../site/dist/engine/first-battle.mjs';
import {CampaignProfiles} from '../site/dist/engine/profile-manager.mjs';
import {PlayerProfile, SKILLS, serializeProfile} from '../site/dist/engine/progression.mjs';
import {FLAG_STATUS} from '../site/dist/engine/flag-troop.mjs';
import {
  markTestingProfiles, grantTestGold, unlockTestSkills, readyTestSkills,
  protectTestBattle, finishTestBattle, selectTestLevel,
} from '../site/dist/testing.mjs';

// These fixtures exercise explicitly modern assisted QA controls. Forced flags,
// damage, grants, and outcomes below are test inputs, not earned gameplay or
// evidence of equivalence with the original game.
const assisted = options => new CampaignBattle({testing: true, ...options});
const helpers = [
  ['gold', battle => grantTestGold(battle)],
  ['unlock', battle => unlockTestSkills(battle)],
  ['ready', battle => readyTestSkills(battle)],
  ['protection', battle => protectTestBattle(battle, true)],
  ['victory', battle => finishTestBattle(battle, 'victory')],
  ['defeat', battle => finishTestBattle(battle, 'defeat')],
];

function snapshot(battle) {
  return {
    save: new CampaignProfiles({profiles: [battle.profile]}).exportBundle(),
    timers: battle.profile.skills.map(skill => [skill.cooldown, skill.strobe]),
    protectedTesting: battle.protectedTesting,
    outcome: battle.outcome,
    summary: battle.summary,
    hotbar: battle.hotbar.bars.map(bar => bar.map(skill => skill?.id ?? null)),
  };
}

test('test helpers require both an explicit test battle and its assisted profile marker', () => {
  for (const config of [
    {testing: false, cheated: false},
    {testing: false, cheated: true},
    {testing: true, cheated: false},
    {testing: 'true', cheated: true},
    {testing: true, cheated: 'true'},
  ]) {
    const battle = new CampaignBattle();
    battle.testing = config.testing;
    battle.profile.cheated = config.cheated;
    // Invalid marker types cannot be saved, so the test uses a live snapshot.
    const before = {
      gold: battle.profile.gold,
      skills: [...battle.profile.skills],
      cooldown: battle.profile.skills[0].cooldown,
      active: battle.activeSkill,
    };
    for (const [name, invoke] of helpers) {
      assert.throws(() => invoke(battle), /Assisted testing is not enabled/, `${name}: ${JSON.stringify(config)}`);
      assert.equal(battle.profile.gold, before.gold);
      assert.deepEqual(battle.profile.skills, before.skills);
      assert.equal(battle.profile.skills[0].cooldown, before.cooldown);
      assert.equal(battle.activeSkill, before.active);
      assert.equal(battle.protectedTesting, false);
      assert.equal(battle.outcome, null);
    }
  }
});

test('only literal testing=true marks a newly constructed battle and profile', () => {
  for (const testing of [undefined, false, 1, 'true']) {
    const profile = new PlayerProfile();
    const battle = new CampaignBattle({profile, testing});
    assert.equal(battle.testing, false);
    assert.notEqual(profile.cheated, true);
  }
  const battle = assisted();
  assert.equal(battle.testing, true);
  assert.equal(battle.profile.cheated, true);
  assert.equal(battle.protectedTesting, false);
});

test('marking a test campaign includes active and retired records and survives bundle saves', () => {
  const first = new PlayerProfile('First');
  const second = new PlayerProfile('Second');
  const retired = new PlayerProfile('Retired');
  retired.victories = 30;
  const manager = new CampaignProfiles({profiles: [first, second], retired: [retired], activeIndex: 1});
  markTestingProfiles(manager);
  assert.equal(manager.active, second);
  for (const profile of [...manager.profiles, ...manager.retired]) assert.equal(profile.cheated, true);
  const battle = assisted({profile: second});
  grantTestGold(battle, 1000);
  unlockTestSkills(battle);
  selectTestLevel(second, 23);
  const saved = manager.exportBundle();
  const restored = CampaignProfiles.fromBundle(saved);
  assert.equal(restored.exportBundle(), saved);
  for (const profile of [...restored.profiles, ...restored.retired]) assert.equal(profile.cheated, true);
  assert.equal(restored.profiles[1].gold, 1000);
  assert.equal(restored.profiles[1].highestLevel, 23);
  assert.deepEqual([...restored.profiles[1].owned].sort(), Object.keys(SKILLS).sort());
  const normalReload = new CampaignBattle({profile: restored.profiles[1]});
  assert.equal(normalReload.testing, false, 'an assisted save does not silently enable test controls');
  assert.equal(normalReload.profile.cheated, true, 'its progress remains labelled assisted');
  assert.equal(normalReload.protectedTesting, false, 'protection is battle-local');
  for (const [, invoke] of helpers) assert.throws(() => invoke(normalReload), /Assisted testing is not enabled/);
});

test('gold grants accept only supported values, preserve gameplay counters, and cap safely', () => {
  const battle = assisted();
  assert.equal(grantTestGold(battle, 1000), 1000);
  assert.equal(grantTestGold(battle), 11000);
  assert.equal(grantTestGold(battle, 10000), 21000);
  assert.equal(battle.stats.goldEarned, 0);
  assert.equal(battle.profile.xp, 0);
  const before = snapshot(battle);
  for (const amount of [0, -1000, 999, 1001, 1000.5, '1000', null, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => grantTestGold(battle, amount), RangeError);
    assert.deepEqual(snapshot(battle), before);
  }
  battle.profile.gold = Number.MAX_SAFE_INTEGER - 1;
  assert.equal(grantTestGold(battle, 1000), Number.MAX_SAFE_INTEGER);
  assert.equal(grantTestGold(battle), Number.MAX_SAFE_INTEGER);
  assert.doesNotThrow(() => new CampaignProfiles({profiles: [battle.profile]}).exportBundle());
});

test('unlocking all skills preserves existing progress and rebuilds every hotbar binding without spending gold', () => {
  const battle = assisted();
  const original = battle.profile.skills[0];
  original.addXP(101);
  original.binding = 29;
  original.autocast = true;
  const xp = original.xp, rank = original.rank;
  unlockTestSkills(battle);
  assert.equal(battle.profile.skills[0], original);
  assert.equal(original.xp, xp);
  assert.equal(original.rank, rank);
  assert.equal(original.binding, 29);
  assert.equal(battle.profile.gold, 0);
  assert.equal(battle.stats.goldSpent, 0);
  assert.equal(battle.friendlyQueue.queue.length, 0);
  assert.equal(battle.profile.skills.length, Object.keys(SKILLS).length);
  assert.deepEqual([...battle.profile.owned].sort(), Object.keys(SKILLS).sort());
  for (const skill of battle.profile.skills) {
    assert.equal(skill.cooldown, 0);
    assert.equal(skill.autocast, false, 'unlocking must not silently start all summons');
    assert.equal(battle.hotbar.bars[Math.floor(skill.binding / 10)][skill.binding % 10], skill);
  }
  assert.equal(battle.activeSkill, battle.hotbar.active);
  const before = snapshot(battle);
  unlockTestSkills(battle);
  assert.deepEqual(snapshot(battle), before, 'repeated unlock is idempotent');
  assert.equal(battle.profile.skills[0], original);
});

test('readying skills resets only cooldowns and leaves rank, bindings, autocast, and balances alone', () => {
  const battle = assisted();
  battle.profile.addSkill('fireArrow');
  const grunt = battle.profile.addSkill('grunt');
  grunt.strobe = 7;
  grunt.autocast = true;
  grunt.addXP(101);
  const save = serializeProfile(battle.profile);
  const strobes = battle.profile.skills.map(skill => skill.strobe);
  readyTestSkills(battle);
  assert.ok(battle.profile.skills.every(skill => skill.cooldown === 0));
  assert.deepEqual(battle.profile.skills.map(skill => skill.strobe), strobes);
  assert.equal(serializeProfile(battle.profile), save);
  readyTestSkills(battle);
  assert.ok(battle.profile.skills.every(skill => skill.cooldown === 0));
});

test('level selection accepts all campaign battles and rejects invalid input atomically', () => {
  const battle = assisted();
  for (let level = 1; level <= 30; level++) {
    assert.equal(selectTestLevel(battle.profile, level), level);
    assert.equal(battle.profile.level, level);
    assert.equal(battle.profile.highestLevel, level);
    assert.equal(battle.profile.scene, level + 1);
    assert.equal(battle.profile.highestScene, level + 1);
    assert.equal(battle.profile.victories, 0);
    assert.equal(battle.profile.defeats, 0);
  }
  assert.equal(selectTestLevel(battle.profile, 1), 1, 'test selection can return to an earlier battle');
  const before = snapshot(battle);
  for (const level of [undefined, null, 0, -1, 31, 1.5, '1', NaN, Infinity, true]) {
    assert.throws(() => selectTestLevel(battle.profile, level), RangeError);
    assert.deepEqual(snapshot(battle), before);
  }
  for (const cheated of [undefined, false, 1, 'true']) {
    const profile = new PlayerProfile();
    profile.cheated = cheated;
    assert.throws(() => selectTestLevel(profile, 30), /assisted profile is required/);
    assert.equal(profile.level, 1);
    assert.equal(profile.scene, 1);
  }
});

test('test protection blocks direct and queued hero damage and can be disabled', () => {
  const battle = assisted();
  const hp = battle.hero.hp;
  assert.equal(protectTestBattle(battle, true), true);
  battle.hero.takeDamage(hp * 2);
  assert.equal(battle.hero.hp, hp);
  assert.equal(battle.hero.dead, false);
  assert.equal(battle.outcome, null);
  battle.queueImpact({target: battle.hero, amount: hp * 2});
  battle.hero.effects.step();
  assert.equal(battle.hero.hp, hp);
  assert.equal(battle.hero.dead, false);
  assert.equal(battle.outcome, null);
  assert.equal(protectTestBattle(battle, false), false);
  battle.hero.takeDamage(hp * 2);
  assert.equal(battle.hero.dead, true);
  assert.equal(battle.outcome, 'defeat');
});

test('hero protection still permits healing through the engine negative-damage convention', () => {
  const battle = assisted();
  battle.hero.takeDamage(100);
  const woundedHp = battle.hero.hp;
  protectTestBattle(battle, true);
  battle.hero.takeDamage(-25);
  assert.equal(battle.hero.hp, woundedHp + 25);
});

test('test protection suppresses natural flag defeat, allows victory, and stays off in new battles', () => {
  const battle = assisted();
  protectTestBattle(battle, true);
  battle.ownFlag.status = FLAG_STATUS.CAPTURED;
  battle.checkOutcome();
  assert.equal(battle.outcome, null);
  assert.equal(battle.profile.defeats, 0);
  protectTestBattle(battle, false);
  battle.checkOutcome();
  assert.equal(battle.outcome, 'defeat');
  assert.equal(battle.profile.defeats, 1);

  const retry = assisted({profile: battle.profile});
  assert.equal(retry.protectedTesting, false);
  protectTestBattle(retry, true);
  retry.enemyFlag.status = FLAG_STATUS.CAPTURED;
  retry.checkOutcome();
  assert.equal(retry.outcome, 'victory');
  assert.equal(retry.profile.victories, 1);
});

test('normal battles retain hero damage and natural defeats even if a protection field is set', () => {
  for (const cheated of [false, true]) {
    const battle = new CampaignBattle();
    battle.profile.cheated = cheated;
    battle.protectedTesting = true;
    battle.hero.takeDamage(1);
    assert.equal(battle.hero.hp, battle.hero.maxHp - 1);
    battle.ownFlag.status = FLAG_STATUS.CAPTURED;
    battle.checkOutcome();
    assert.equal(battle.outcome, 'defeat');
    assert.equal(battle.profile.defeats, 1);
  }
});

test('forced outcome validation is atomic, activates queued objects once, and respects an existing outcome', () => {
  const battle = assisted();
  let activations = 0;
  battle.addActivationObject({activate: () => activations++});
  const before = snapshot(battle);
  for (const outcome of [undefined, null, '', 'win', 'Victory', true]) {
    assert.throws(() => finishTestBattle(battle, outcome), RangeError);
    assert.deepEqual(snapshot(battle), before);
    assert.equal(activations, 0);
  }
  protectTestBattle(battle, true);
  assert.equal(finishTestBattle(battle, 'defeat'), true, 'explicit defeat remains available while protected');
  assert.equal(activations, 1);
  assert.equal(battle.profile.defeats, 1);
  assert.equal(battle.summary, null);
  assert.equal(finishTestBattle(battle, 'victory'), false);
  assert.equal(finishTestBattle(battle, 'defeat'), false);
  assert.equal(activations, 1);
  assert.equal(battle.profile.victories, 0);
  assert.equal(battle.profile.defeats, 1);
});

for (const level of [1, 17, 30]) {
  for (const outcome of ['victory', 'defeat']) {
    test(`forced ${outcome} at battle ${level} follows ordinary progression, countdown, and summary`, () => {
      const build = testing => {
        const events = [];
        const battle = new CampaignBattle({level, testing, onEvent: event => events.push(event)});
        battle.profile.gold = 250;
        battle.profile.xp = 10;
        Object.assign(battle.stats, {shotsFired: 10, bodyShots: 4, headShots: 2, goldEarned: 100, goldSpent: 20});
        return {battle, events};
      };
      const forced = build(true), natural = build(false);
      assert.equal(finishTestBattle(forced.battle, outcome), true);
      if (outcome === 'victory') natural.battle.enemyFlag.status = FLAG_STATUS.CAPTURED;
      else natural.battle.ownFlag.status = FLAG_STATUS.CAPTURED;
      natural.battle.checkOutcome();
      for (const {battle, events} of [forced, natural]) {
        assert.equal(battle.outcome, outcome);
        assert.equal(battle.profile.victories, outcome === 'victory' ? 1 : 0);
        assert.equal(battle.profile.defeats, outcome === 'defeat' ? 1 : 0);
        assert.equal(battle.profile.level, outcome === 'victory' ? level + 1 : level);
        assert.equal(battle.summary, null);
        for (let step = 0; step < 100; step++) battle.step();
        assert.equal(battle.summary, null, 'the full ordinary 200-count delay is retained');
        battle.step();
        assert.equal(battle.summary.outcome, outcome);
        assert.equal(battle.summary.campaignComplete, outcome === 'victory' && level === 30);
        if (outcome === 'defeat' || level === 30) {
          assert.equal(battle.summary.gold, 0);
          assert.equal(battle.summary.xp, 0);
          assert.equal(battle.profile.gold, 250);
          assert.equal(battle.profile.xp, 10);
        } else {
          assert.ok(battle.summary.gold > 0);
          assert.ok(battle.summary.xp > 0);
        }
        const completed = snapshot(battle), tick = battle.tick;
        for (let step = 0; step < 150; step++) battle.step();
        assert.equal(battle.tick, tick);
        assert.deepEqual(snapshot(battle), completed);
        assert.equal(events.filter(event => event.type === 'outcome').length, 1);
        assert.equal(events.filter(event => event.type === 'summary').length, 1);
      }
      assert.deepEqual(forced.battle.summary, natural.battle.summary);
      const progression = battle => {
        const saved = JSON.parse(serializeProfile(battle.profile));
        delete saved.cheated;
        return saved;
      };
      assert.deepEqual(progression(forced.battle), progression(natural.battle));
      assert.equal(forced.battle.profile.cheated, true);
    });
  }
}

test('assisted final victory remains marked after retirement and a portable campaign round-trip', () => {
  const manager = new CampaignProfiles({defaultName: 'Testing'});
  markTestingProfiles(manager);
  selectTestLevel(manager.active, 30);
  const battle = assisted({profile: manager.active, level: 30});
  grantTestGold(battle);
  finishTestBattle(battle, 'victory');
  for (let step = 0; step < 101; step++) battle.step();
  assert.equal(battle.summary.campaignComplete, true);
  assert.equal(battle.profile.level, 31);
  const retired = manager.retireCurrent();
  assert.equal(retired.cheated, true);
  assert.equal(retired.gold, 1, 'assisted campaigns cannot create an earned retirement score');
  markTestingProfiles(manager); // The test UI must mark the fresh replacement too.
  const restored = CampaignProfiles.fromBundle(manager.exportBundle());
  assert.equal(restored.retired[0].cheated, true);
  assert.equal(restored.retired[0].gold, 1);
  assert.equal(restored.active.cheated, true);
});
