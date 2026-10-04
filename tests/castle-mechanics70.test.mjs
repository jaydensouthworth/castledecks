import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {FirstBattle, prepareCastleSelection} from '../site/dist/engine/first-battle.mjs';
import {CASTLE_CATALOG, DEFAULT_CASTLE_SELECTION, validateCastleSelection, resolveCastleConfig} from '../site/dist/engine/castle-catalog.mjs';
import {COLLISION_REGIONS, unitRegions} from '../site/dist/engine/collision.mjs';
import {validateBattleEncounter} from '../site/dist/engine/battle-encounter.mjs';
import {PlayerProfile, serializeProfile} from '../site/dist/engine/progression.mjs';
import {seededRandom} from '../site/dist/engine/combat.mjs';
import {assistedAutoAim} from '../site/dist/engine/assisted-auto-aim.mjs';
import {sampleManualAim} from '../site/dist/manual-aim-guide.mjs';
import {autoAimFeedback} from '../site/dist/auto-aim-feedback.mjs';
import {createSkirmish, skirmishCombatRandom, decodeSkirmishDescriptor, encodeSkirmishDescriptor} from '../site/dist/skirmish-model.mjs';

const selection = id => ({id, level: 1});
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
function profile(id = 'classic', mode = 'classic') {
  const p = new PlayerProfile();
  p.castleLevels = new Map([['classic', 1], ['highwatch', 1]]);
  p.castleId = id;
  p.shootingMode = mode;
  return p;
}
function encounter(enemyCastle) {
  return {
    id: 'mechanics70-supplied-flat', scenery: 'oaks', timeOfDay: 'noon',
    heights: Array(101).fill(700), roster: ['grunt', 'archer', 'archer'],
    towers: [], enemyKeepHP: 6000, objective: 'break-keep',
    ...(enemyCastle ? {enemyCastle: selection(enemyCastle)} : {}),
  };
}
function fresh({id = 'highwatch', enemy = 'highwatch', mode = 'classic', ...options} = {}) {
  return new FirstBattle({profile: profile(id, mode), random: seededRandom(3441), encounter: encounter(enemy), ...options});
}
function prepare(b, id, options = {}) {
  return prepareCastleSelection(b, selection(id), {started: false, profile: b.profile, ...options});
}
function castleState(c) {
  return {
    castleId: c.castleId, castleLevel: c.castleLevel, x: c.x, y: c.y,
    hp: c.hp, maxHp: c.maxHp, width: c.width, height: c.height,
    regionKind: c.regionKind, hitbox: {...c.hitbox}, shotOffset: {...c.shotOffset},
    maxOccupants: c.maxOccupants, occupants: [...c.occupants],
  };
}

test('castle catalog is immutable, contains only two level-1 sidegrades and never executes accessors', () => {
  assert.deepEqual(Object.keys(CASTLE_CATALOG), ['classic', 'highwatch']);
  assert.equal(CASTLE_CATALOG.highwatch.price, 1500);
  assert.ok(Object.isFrozen(CASTLE_CATALOG));
  for (const id of ['classic', 'highwatch']) {
    assert.ok(Object.isFrozen(CASTLE_CATALOG[id]));
    assert.ok(Object.isFrozen(validateCastleSelection(selection(id))));
  }
  let reads = 0;
  const accessor = {get id() { reads++; return 'classic'; }, level: 1};
  for (const value of [null, undefined, 'classic', [], {}, {id: 'classic'},
    {id: 'classic', level: '1'}, {id: 'classic', level: 0}, {id: 'classic', level: 2},
    {id: 'highwatch', level: Infinity}, {id: 'future', level: 1},
    {id: 'classic', level: 1, hp: 999999}, {...selection('classic'), [Symbol('hidden')]: true}, accessor]) {
    assert.throws(() => validateCastleSelection(value));
  }
  assert.equal(reads, 0);
  assert.throws(() => validateCastleSelection({id: 'future', level: 1}), {code: 'unsupported-castle'});
  assert.throws(() => validateCastleSelection({id: 'classic', level: 2}), {code: 'unsupported-castle-level'});
  assert.throws(() => resolveCastleConfig(selection('classic'), {team: 'neutral', baseHp: 8400}));
  for (const baseHp of [0, -1, NaN, Infinity, '8400', 8400.5]) {
    assert.throws(() => resolveCastleConfig(selection('classic'), {team: 'good', baseHp}));
  }
});

test('resolver preserves each original side boundary and applies height/HP/capacity exactly once', () => {
  for (const team of ['good', 'bad']) for (const baseHp of [6000, 8266, 8400, 12000]) {
    const oldKind = team === 'good' ? 'friendlyCastle' : 'enemyCastle';
    const old = COLLISION_REGIONS[oldKind].hitbox;
    const classic = resolveCastleConfig(selection('classic'), {team, baseHp});
    const high = resolveCastleConfig(selection('highwatch'), {team, baseHp});
    assert.equal(classic.regionKind, oldKind);
    assert.equal(classic.hp, baseHp);
    assert.equal(high.hp, Math.floor(baseHp * .8));
    assert.equal(classic.maxOccupants, 4);
    assert.equal(high.maxOccupants, 2);
    assert.deepEqual(classic.shotOffset, {x: 0, y: -200});
    assert.deepEqual(high.shotOffset, {x: 0, y: -250});
    assert.deepEqual(COLLISION_REGIONS[high.regionKind].hitbox, [old[0], old[1], old[2] - 50, old[3]]);
    assert.equal(high.width, classic.width);
    near(high.height, classic.height + 50);
    assert.ok(Object.isFrozen(high));
    assert.ok(Object.isFrozen(high.shotOffset));
  }
});

test('old eight-field encounters retain shape; only exact explicit enemyCastle is added', () => {
  const old = encounter();
  assert.deepEqual(validateBattleEncounter(old), old);
  assert.equal(Object.keys(validateBattleEncounter(old)).length, 8);
  assert.equal(Object.hasOwn(validateBattleEncounter(old), 'enemyCastle'), false);
  const explicit = validateBattleEncounter(encounter('highwatch'));
  assert.ok(Object.isFrozen(explicit.enemyCastle));
  assert.deepEqual(explicit.enemyCastle, selection('highwatch'));
  for (const value of [ {...old, castle: selection('highwatch')}, {...old, enemyCastle: 'highwatch'},
    {...old, enemyCastle: {id: 'highwatch', level: 2}}, {...old, enemyCastle: undefined},
    {...old, [Symbol('extra')]: 1} ]) assert.throws(() => validateBattleEncounter(value));
  const getter = {...old};
  Object.defineProperty(getter, 'enemyCastle', {enumerable: true, get() { throw Error('must not execute'); }});
  assert.throws(() => validateBattleEncounter(getter), /fields/);
});

test('player and explicit enemy use shared config without changing flags, aprons, damage or economy', () => {
  let classicCalls = 0, highCalls = 0;
  const aRandom = seededRandom(77), bRandom = seededRandom(77);
  const classic = fresh({id: 'classic', enemy: 'classic', random: () => { classicCalls++; return aRandom(); }});
  const high = fresh({random: () => { highCalls++; return bRandom(); }});
  assert.equal(high.goodCastle.hp, 6720);
  assert.equal(high.badCastle.hp, 4800);
  assert.deepEqual(high.terrain.samples, classic.terrain.samples);
  for (const key of ['ownFlag', 'enemyFlag']) {
    assert.deepEqual([high[key].x, high[key].y, high[key].status], [classic[key].x, classic[key].y, classic[key].status]);
  }
  assert.deepEqual(high.stats, classic.stats);
  assert.equal(high.profile.gold, classic.profile.gold);
  assert.deepEqual(high.friendlyQueue, classic.friendlyQueue);
  assert.deepEqual(high.enemies.roster, classic.enemies.roster);
  assert.equal(high.enemies.timer, classic.enemies.timer);
  assert.equal(highCalls, classicCalls);
  for (const key of ['goodCastle', 'badCastle']) {
    const c = classic[key], h = high[key];
    assert.deepEqual(h.multipliers, c.multipliers);
    assert.equal(h.immunity, c.immunity);
    assert.equal(h.x, c.x);
    assert.equal(h.y, c.y);
    near(h.hitbox.y, c.hitbox.y - 50);
    near(h.hitbox.y + h.hitbox.height, c.hitbox.y + c.hitbox.height);
    assert.equal(h.hitbox.x, c.hitbox.x);
    assert.equal(h.hitbox.width, c.hitbox.width);
    h.hitbox = {x: 0, y: 0, width: 1, height: 1};
    high.updateGeometry(h);
    assert.deepEqual(h.hitbox, unitRegions(h.regionKind, h).hitbox);
  }
});

function probe({side, edge, delta, kind, id = 'highwatch'}) {
  const b = fresh({id, enemy: id}), target = side === 'good' ? b.goodCastle : b.badCastle, h = target.hitbox;
  const point = {x: h.x + h.width / 2, y: h.y + h.height / 2, vx: 8};
  if (edge === 'left') point.x = h.x + delta;
  if (edge === 'right') { point.x = h.x + h.width - delta; point.vx = -8; }
  if (edge === 'top') point.y = h.y + delta;
  if (edge === 'bottom') point.y = h.y + h.height - delta;
  const impacts = [], events = [], original = b.queueImpact.bind(b);
  b.queueImpact = request => { impacts.push(request); return original(request); };
  b.onEvent = event => events.push(event);
  const shot = b.queueProjectile({kind, team: side === 'good' ? 'bad' : 'good', source: b.hero, owner: b.hero,
    x: point.x - point.vx * 2, y: point.y, vx: point.vx, vy: 0, gravity: 0, impactDamage: 100});
  shot.step();
  target.effects.step();
  return {hit: impacts.some(r => r.target === target) || events.some(e => e.type === 'projectile-hit' && e.target === target),
    damage: target.maxHp - target.hp, shot, target, impacts, b};
}

for (const side of ['good', 'bad']) for (const kind of ['hero_arrow', 'standard_arrow', 'fire_arrow', 'ice_arrow', 'pierce_arrow', 'trebuchet_ammo']) {
  test(`Highwatch ${side} ${kind} uses all four actual inclusive live boundaries`, () => {
    for (const edge of ['left', 'right', 'top', 'bottom']) {
      assert.equal(probe({side, kind, edge, delta: .01}).hit, true, `${edge} inside`);
      assert.equal(probe({side, kind, edge, delta: 0}).hit, true, `${edge} exact`);
      assert.equal(probe({side, kind, edge, delta: -.01}).hit, false, `${edge} outside`);
      const high = probe({side, kind, edge, delta: 1});
      const classic = probe({side, kind, edge, delta: 1, id: 'classic'});
      assert.equal(high.damage, classic.damage, 'castle type never modifies projectile damage');
      assert.equal(high.b.profile.gold, classic.b.profile.gold, 'no reward or economy modifier');
      if (kind === 'pierce_arrow') {
        assert.equal(high.shot.active, false);
        assert.equal(high.damage, 0, 'existing structure-pierce behavior remains a stop without damage');
      }
    }
  });
}

for (const mode of ['classic', 'anywhere', 'point_aim']) test(`Highwatch ${mode} preview and actual controller release launch from raised station`, () => {
  const b = fresh({mode}), origin = b.hero.launchPosition;
  const anchor = mode === 'anywhere' ? {x: 900, y: 450} : origin;
  const pointer = mode === 'point_aim' ? {x: 650, y: 360} : {x: anchor.x - 126, y: anchor.y + 65};
  const preview = sampleManualAim({mode, origin, anchor, pointer});
  let aim;
  if (mode === 'point_aim') { b.shooter.press(pointer); aim = b.shooter.step(); }
  else {
    b.shooter.press(anchor); b.shooter.step();
    b.shooter.move(pointer); b.shooter.step();
    b.shooter.release(pointer); aim = b.shooter.step();
  }
  near(aim.vx, preview.vx); near(aim.vy, preview.vy);
  b.activeSkill.cooldown = 0;
  assert.equal(b.shoot(aim), true);
  const shot = b.projectiles.at(-1);
  assert.deepEqual(shot.previous, origin, 'real projectile spawn, before its source-compatible immediate move');
  assert.equal(origin.y, b.goodCastle.y - 250);
  near(shot.vx, preview.vx); near(shot.vy, preview.vy);
  assert.equal(shot.gravity, .3);
  assert.equal(b.stats.shotsFired, 1);
});

for (const angleMode of [0, 1]) for (const powerPercent of [50, 100]) test(`Highwatch Auto ${angleMode ? 'low' : 'high'} arc at ${powerPercent}% uses actual elevated solver and preview`, () => {
  const b = fresh({mode: 'auto_aim'}), origin = b.hero.launchPosition, target = {x: 650, y: 410};
  b.shooter.angleMode = angleMode; b.shooter.powerPercent = powerPercent;
  const expected = assistedAutoAim(origin, target, {angleMode, powerPercent});
  const preview = autoAimFeedback(origin, target, {angleMode, powerPercent});
  b.shooter.press(target);
  const actual = b.shooter.step();
  assert.ok(actual.canFire);
  assert.deepEqual(actual, expected);
  assert.deepEqual(preview.aim, actual);
  assert.deepEqual(actual.origin, origin);
  b.activeSkill.cooldown = 0;
  assert.equal(b.shoot(actual), true);
  const shot = b.projectiles.at(-1);
  assert.deepEqual(shot.previous, origin);
  near(shot.vx, actual.vx); near(shot.vy, actual.vy);
  near(Math.hypot(shot.vx, shot.vy), 22.8 * powerPercent / 100);
  assert.equal(shot.gravity, actual.gravity);
});

test('hero uses one berth, exits with Down, cannot enter full gallery, and dead archer releases its real slot', () => {
  const b = fresh(), castle = b.goodCastle, first = b.createUnit('archer', {team: 'good'}), second = b.createUnit('archer', {team: 'good'});
  assert.deepEqual(castle.occupants, [b.hero]);
  assert.equal(first.attemptGarrison(castle), true);
  assert.equal(second.attemptGarrison(castle), false);
  assert.deepEqual(first.shotOrigin(), b.hero.launchPosition);
  b.input.down = true; b.hero.step(); b.input.down = false;
  assert.equal(b.hero.garrisoned(), false);
  assert.deepEqual(b.hero.launchPosition, {x: b.hero.x, y: b.hero.y - 30});
  assert.equal(second.attemptGarrison(castle), true);
  b.input.up = true; b.hero.step(); b.input.up = false;
  assert.equal(b.hero.garrisoned(), false, 'two archers occupy both actual slots');
  first.takeDamage(first.hp);
  for (let i = 0; i < 80 && !first.destroyed; i++) first.step();
  assert.equal(first.destroyed, true);
  assert.equal(first.garrisonBuilding, null);
  assert.equal(castle.occupants.includes(first), false);
  assert.equal(b.goodTeam.includes(first), false);
  b.input.up = true; b.hero.step(); b.input.up = false;
  assert.equal(b.hero.garrisonBuilding, castle);
  assert.equal(castle.occupants.length, 2);
});

for (const side of ['good', 'bad']) test(`${side} archers naturally choose raised home gallery and actual arrows start there`, () => {
  const b = fresh(), castle = side === 'good' ? b.goodCastle : b.badCastle;
  const archer = b.createUnit('archer', {team: side}), enemy = b.createUnit('grunt', {team: side === 'good' ? 'bad' : 'good'});
  archer.x = castle.x; archer.y = castle.y;
  enemy.x = castle.x + (side === 'good' ? 160 : -160); enemy.y = b.elevationAt(enemy.x);
  archer.chooseNextAction();
  assert.equal(archer.garrisonBuilding, castle, 'normal proximity/target/range decision entered the available gallery');
  const request = archer.shootAtTarget(enemy), shot = b.projectiles.at(-1);
  assert.equal(request.kind, 'standard_arrow');
  assert.deepEqual({x: request.x, y: request.y}, {x: castle.x, y: castle.y - 250});
  assert.deepEqual(shot.previous, {x: castle.x, y: castle.y - 250});
  castle.takeDamage(castle.hp); archer.checkGarrison();
  assert.equal(archer.garrisonBuilding, null);
  assert.equal(archer.canGetHit, true);
  assert.equal(archer.visible, true);
  assert.equal(castle.occupants.includes(archer), false);
});

test('preparation changes the same castle, clears stale aim, never rerolls or compounds HP, and leaves profile to caller', () => {
  const random = seededRandom(10); let calls = 0;
  const b = fresh({id: 'classic', random: () => {calls++; return random();}}), c = b.goodCastle;
  const beforeCalls = calls, objects = [...b.objects.items], terrain = b.terrain, flags = [b.ownFlag, b.enemyFlag], hero = b.hero;
  const stats = {...b.stats}, profileBefore = serializeProfile(b.profile), queues = JSON.stringify(b.friendlyQueue), roster = [...b.enemies.roster];
  const oldOrigin = {...b.hero.launchPosition};
  b.shooter.press(oldOrigin); b.shooter.step();
  b.queuePlayerShot({canFire: true, vx: 10, vy: -5}); b.queuedAim = {vx: 1, vy: 2}; b.input.mouseDown = true;
  const transaction = prepare(b, 'highwatch');
  assert.equal(transaction.changed, true);
  assert.equal(c.maxHp, 8400, 'preparation is nonmutating until apply');
  assert.equal(transaction.apply(), c);
  assert.throws(() => transaction.apply(), /already applied/);
  assert.equal(c.maxHp, 6720);
  assert.equal(b.goodCastle, c); assert.equal(b.hero, hero); assert.equal(b.terrain, terrain);
  assert.deepEqual(b.objects.items, objects); assert.deepEqual([b.ownFlag, b.enemyFlag], flags);
  assert.equal(b.hero.garrisonBuilding, c);
  assert.deepEqual(c.occupants, [hero]);
  assert.equal(b.playerShots.length, 0); assert.equal(b.queuedAim, null); assert.equal(b.shooter.active, null);
  assert.equal(b.shooter.holding, false); assert.equal(b.input.mouseDown, false);
  assert.deepEqual(b.shooter.origin, b.hero.launchPosition);
  assert.equal(b.hero.launchPosition.y, oldOrigin.y - 50);
  for (let i = 0; i < 5; i++) {
    prepare(b, 'classic').apply(); assert.equal(c.maxHp, 8400);
    prepare(b, 'highwatch').apply(); assert.equal(c.maxHp, 6720);
  }
  assert.equal(b.tick, 0); assert.equal(calls, beforeCalls);
  assert.deepEqual(b.stats, stats); assert.equal(serializeProfile(b.profile), profileBefore);
  assert.equal(JSON.stringify(b.friendlyQueue), queues); assert.deepEqual(b.enemies.roster, roster);
});

test('preparation rejects live, ended, stale, unowned and overcapacity requests before any mutation', () => {
  const cases = [
    b => ({started: true}), b => {b.tick = 1; return {};}, b => {b.outcome = 'victory'; return {};},
    b => {b.summary = {outcome: 'victory'}; return {};}, b => ({profile: profile()}),
    b => {b.profile.castleLevels.delete('highwatch'); return {};},
    b => {b.goodCastle.hp--; return {};}, b => {b.goodCastle.lastAttackTimer = 1; return {};},
    b => {b.queueImpact({source: b.hero, target: b.goodCastle, amount: 10}); return {};},
    b => {for (let i = 0; i < 2; i++) b.createUnit('archer', {team: 'good'}).attemptGarrison(b.goodCastle); return {};},
  ];
  for (const setup of cases) {
    const b = fresh({id: 'classic'}), options = setup(b), before = castleState(b.goodCastle);
    assert.throws(() => prepare(b, 'highwatch', options));
    assert.deepEqual(castleState(b.goodCastle), before);
  }
  const b = fresh({id: 'classic'});
  assert.throws(() => prepareCastleSelection(b, selection('highwatch'), {profile: b.profile}));
  const state = {started: false, profile: b.profile}, tx = prepareCastleSelection(b, selection('highwatch'), state);
  state.started = true;
  assert.throws(() => tx.apply(), /before starting/);
  assert.equal(b.goodCastle.castleId, 'classic');
  state.started = false; b.profile = profile();
  assert.throws(() => tx.apply(), /profile and battlefield/);
});

test('prepared transaction refuses stale castle identity or capacity at commit', () => {
  for (const change of [b => {b.goodCastle = b.badCastle;}, b => {b.goodCastle.maxHp++;},
    b => {for (let i = 0; i < 2; i++) b.createUnit('archer', {team: 'good'}).attemptGarrison(b.goodCastle);}]) {
    const b = fresh({id: 'classic'}), c = b.goodCastle, tx = prepare(b, 'highwatch');
    change(b);
    const before = castleState(c);
    assert.throws(() => tx.apply());
    assert.deepEqual(castleState(c), before);
  }
});

test('same-castle no-op remains safe during paused combat and does not heal or cancel aim', () => {
  const b = fresh(); b.step(); b.paused = true; b.goodCastle.takeDamage(300);
  b.shooter.press({x: 900, y: 450});
  const before = castleState(b.goodCastle), tx = prepare(b, 'highwatch', {started: true});
  assert.equal(tx.changed, false); tx.apply();
  assert.deepEqual(castleState(b.goodCastle), before);
  assert.equal(b.shooter.holding, true);
});

// Existing immutable engine fixture is executed with the real current shared
// dependencies, as in the project's established parity test. No native claim.
const frozen = readFileSync(new URL('./fixtures/frozen41-first-battle.mjs.txt', import.meta.url), 'utf8');
assert.equal(createHash('sha256').update(frozen).digest('hex'), '731ac6f8b9cd82ffd763a2b476bee05ec214554b934a0bf90333cb73730869cf');
const engineURL = new URL('../site/dist/engine/', import.meta.url);
const source = frozen.replace(/from '(\.\/[^']+)'/g, (_, specifier) => `from '${new URL(specifier, engineURL).href}'`);
const {FirstBattle: FrozenFirstBattle} = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const entity = u => [u.type, u.kind, u.team, u.x, u.y, u.hp, u.maxHp, u.dead, u.destroyed, u.actionMode, u.occupiedBy,
  u.status, u.active, u.vx, u.vy, u.regionKind, u.hitbox, u.width, u.height, u.maxOccupants, u.shotOffset];
function runDefault(Factory, level, legacy) {
  const p = profile('classic');
  if (legacy) {delete p.castleId; delete p.castleLevels;}
  const r = seededRandom(42), events = []; let calls = 0;
  const b = new Factory({profile: p, level, random: () => {calls++; return r();},
    onEvent: e => events.push([e.type, e.tick, e.damage, e.kind, e.outcome, e.target?.type, e.castle?.team])});
  const snap = () => ({tick: b.tick, terrain: b.terrain.samples, flags: [b.ownFlag, b.enemyFlag].map(entity),
    objects: b.objects.items.map(entity), stats: {...b.stats}, roster: [...b.enemies.roster],
    index: b.enemies.index, timer: b.enemies.timer, phase: b.enemies.phase,
    outcome: b.outcome, summary: b.summary, gold: b.profile.gold, xp: b.profile.xp});
  const trace = [snap()];
  for (let n = 0; n < 2400 && !b.summary; n++) {b.step(); if (n % 300 === 299) trace.push(snap());}
  trace.push(snap());
  return {calls, events, trace};
}
for (const level of [1, 16, 30]) test(`Classic level ${level} preserves frozen default RNG, geometry and object trace with absent or explicit selection`, () => {
  const old = runDefault(FrozenFirstBattle, level, true);
  assert.deepEqual(runDefault(FirstBattle, level, true), old);
  assert.deepEqual(runDefault(FirstBattle, level, false), old);
});

test('all frozen legacy58 Skirmish seeds remain byte-identical with eight-field Classic encounters', () => {
  const fixtures = JSON.parse(readFileSync(new URL('./fixtures/skirmish-legacy58.json', import.meta.url), 'utf8'));
  for (const {descriptor, sha256} of fixtures) {
    const field = createSkirmish(descriptor);
    const random = skirmishCombatRandom(descriptor), combat = Array.from({length: 12}, random);
    assert.equal(createHash('sha256').update(JSON.stringify({scenario: field, combat})).digest('hex'), sha256);
    assert.deepEqual(decodeSkirmishDescriptor(field.code), descriptor);
    assert.equal(encodeSkirmishDescriptor(descriptor), field.code);
    assert.equal(Object.keys(field.encounter).length, 8);
    assert.equal(Object.hasOwn(field.encounter, 'enemyCastle'), false);
  }
});


test('preparation preflights every changed object and queue descriptor before touching the keep', () => {
  const locks = [
    b => Object.defineProperty(b.goodCastle, 'maxHp', {writable: false}),
    b => Object.defineProperty(b.goodCastle, 'hitbox', {writable: false}),
    b => Object.defineProperty(b.shooter, 'origin', {writable: false}),
    b => Object.defineProperty(b.shooter, 'active', {get() {return null;}, configurable: true}),
    b => Object.freeze(b.input),
    b => Object.freeze(b.playerShots),
    b => {b.playerShots.push({canFire: true}); Object.defineProperty(b.playerShots, '0', {configurable: false});},
    b => Object.defineProperty(b.shooter, 'intentSkill', {value: b.activeSkill, configurable: false}),
  ];
  for (const lock of locks) for (const afterPrepare of [false, true]) {
    const b = fresh({id: 'classic'}), before = castleState(b.goodCastle);
    let tx;
    if (afterPrepare) tx = prepare(b, 'highwatch');
    lock(b);
    assert.throws(() => afterPrepare ? tx.apply() : prepare(b, 'highwatch'), /writable|cleared/);
    assert.deepEqual(castleState(b.goodCastle), before);
    assert.equal(b.profile.castleId, 'classic');
  }
});

test('preparation commit never invokes replaceable geometry, cancellation or observation callbacks', () => {
  const b = fresh({id: 'classic', mode: 'auto_aim'});
  b.shooter.press({x: 600, y: 500}); b.shooter.step();
  b.shooter.intentSkill = b.activeSkill;
  b.queuePlayerShot({canFire: true, vx: 10, vy: -2});
  const reject = () => {throw new Error('external hook must not run during atomic commit');};
  b.assignGeometry = reject; b.cancelPlayerShots = reject; b.shooter.cancel = reject;
  b.onEvent = reject; b.goodCastle.services.healthChanged = reject;
  prepare(b, 'highwatch').apply();
  assert.equal(b.goodCastle.maxHp, 6720);
  assert.deepEqual(b.goodCastle.hitbox, unitRegions('friendlyHighwatchCastle', b.goodCastle).hitbox);
  assert.deepEqual(b.shooter.origin, b.hero.launchPosition);
  assert.equal(b.shooter.active, null); assert.equal(b.shooter.lastAttempt, null);
  assert.equal(b.shooter.holding, false); assert.equal(b.shooter.fired, false);
  assert.equal(b.playerShots.length, 0); assert.equal(Object.hasOwn(b.shooter, 'intentSkill'), false);
});
