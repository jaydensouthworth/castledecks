// Reconstructed levy65 adds only two opt-in engine modules. All 35 existing
// engine files match accepted65; fresh focused and parity tests cover additions.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {CampaignBattle} from '../site/dist/engine/first-battle.mjs';
import {createStatusEffect, ReactiveElement} from '../site/dist/engine/special-projectiles.mjs';
import {elementalNotice, drawElementalNotice, drawReactiveElement, dragonElement, drawElementalDragon, dragonResistanceNotice} from '../site/dist/elemental-feedback.mjs';
import {statusBadges, drawStatusBadges} from '../site/dist/combat-feedback.mjs';
import {loadGameUI} from './helpers/game-ui-harness.mjs';

function drawingTrace() {
  const calls = [], properties = [];
  const ctx = new Proxy({}, {get: (_, name) => (...args) => {
    for (const value of args) if (typeof value === 'number') assert.ok(Number.isFinite(value), `${String(name)} received non-finite data`);
    calls.push({name, args});
  }, set: (target, name, value) => { target[name] = value; properties.push({name, value}); return true; }});
  return {ctx, calls, properties};
}
function balanced(calls) { assert.equal(calls.filter(c => c.name === 'save').length, calls.filter(c => c.name === 'restore').length); }

for (const [kind, element] of [['fire_arrow', 'fire'], ['ice_arrow', 'ice']]) {
  test(`${element}: existing tracer event is drawn at its exact segment and duration`, () => {
    const events = [], battle = new CampaignBattle({onEvent: e => events.push(e)});
    const p = battle.queueProjectile({kind, x: 700, y: 200, vx: 16, vy: -4});
    p.step();
    const event = events.find(e => e.kind === `${kind}-tracer`), n = elementalNotice(event);
    assert.ok(n); assert.equal(n.element, element); assert.equal(n.width, event.width); assert.equal(n.life, event.duration);
    assert.equal(n.width, Math.hypot(p.x - p.previous.x, p.y - p.previous.y));
    const {ctx, calls} = drawingTrace();
    assert.equal(drawElementalNotice(ctx, n, n.tick, .27), true);
    assert.ok(calls.some(c => c.name === 'translate' && c.args[0] === event.x && c.args[1] === event.y));
    assert.ok(calls.some(c => c.name === 'rotate' && c.args[0] === event.angle)); balanced(calls);
    assert.equal(drawElementalNotice(ctx, n, n.tick + n.life), false);
    assert.equal(drawElementalNotice(ctx, n, n.tick - 1), false);
  });

  test(`${element}: sticky art and badges track real attachment, movement and dying`, () => {
    const b = new CampaignBattle(), target = b.createUnit('grunt');
    target.x = 1000; target.y = 600;
    const p = b.queueProjectile({kind, x: 999, y: 580, vx: 0, vy: 0});
    p.impact(target);
    const reactive = b.reactiveElements[0];
    assert.equal(reactive.stuckTo, target); assert.equal(reactive.element, element);
    assert.ok(statusBadges(target, b.reactiveElements).includes(element));
    target.x += 40; reactive.step();
    const {ctx, calls} = drawingTrace();
    assert.equal(drawReactiveElement(ctx, reactive, .27), true);
    assert.ok(calls.some(c => c.name === 'translate' && c.args[0] === reactive.draw.x)); balanced(calls);
    reactive.kill();
    // Ice can retain its independent slowing effect after the reactive shard
    // dies; fire has no such target-local effect.
    assert.equal(statusBadges(target, b.reactiveElements).includes(element), element === 'ice');
    reactive.destroy(); assert.equal(drawReactiveElement(ctx, reactive), false);
    target.hp = 0; assert.deepEqual(statusBadges(target, b.reactiveElements), []);
  });
}

test('critical markers consume both existing event formats without a new random draw', () => {
  for (const event of [{type: 'critical'}, {type: 'visual', kind: 'critical-marker'}]) {
    const n = elementalNotice({...event, x: 100, y: 200, rotation: 91, tick: 10});
    assert.equal(n.kind, 'critical'); assert.equal(n.rotation, 91);
    const {ctx, calls} = drawingTrace(); drawElementalNotice(ctx, n, 11, .27);
    assert.ok(calls.some(c => c.name === 'rotate' && c.args[0] === 91 * Math.PI / 180)); balanced(calls);
    assert.equal(drawElementalNotice(ctx, n, n.tick + n.life), false);
  }
});

test('dragon resistance cues read actual live multiplier values and do not claim immunity', () => {
  const b = new CampaignBattle();
  for (const [type, kind, text] of [
    ['fireDragon', 'fire_arrow', 'FIRE RESISTANCE'], ['fireDragon', 'ice_arrow', 'ICE WEAKNESS'],
    ['iceDragon', 'ice_arrow', 'ICE RESISTANCE'], ['iceDragon', 'fire_arrow', 'FIRE WEAKNESS'],
    ['poisonDragon', 'ice_arrow', 'ICE RESISTANCE'], ['poisonDragon', 'fire_arrow', null],
  ]) {
    const target = b.createUnit(type);
    const event = {type: 'projectile-hit', kind: 'target', target, projectile: {kind}, tick: 0};
    assert.equal(dragonResistanceNotice(event)?.text ?? null, text);
    if (text) {
      const n = elementalNotice(event), {ctx, calls} = drawingTrace();
      drawElementalNotice(ctx, n, 2, .27); assert.ok(calls.some(c => c.name === 'fillText' && c.args[0] === text)); balanced(calls);
    }
  }
  const target = b.createUnit('fireDragon'); target.multipliers.fire = 2;
  assert.equal(dragonResistanceNotice({type: 'projectile-hit', kind: 'target', target, projectile: {kind: 'fire_arrow'}}).text, 'FIRE WEAKNESS');
  assert.equal(dragonResistanceNotice({type: 'projectile-hit', kind: 'ground', target, projectile: {kind: 'fire_arrow'}}), null);
});

test('three dragon variants have distinct procedural geometry and translucent wings', () => {
  const traces = [];
  for (const [type, element] of [['dragon_scout_fire', 'fire'], ['dragon_scout_ice', 'ice'], ['dragon_scout_poison', 'poison']]) {
    const unit = Object.freeze({type, animation: Object.freeze({frame: 4})}), {ctx, calls, properties} = drawingTrace();
    assert.equal(dragonElement(unit), element); assert.equal(drawElementalDragon(ctx, unit), true); balanced(calls);
    assert.ok(properties.some(p => p.name === 'globalAlpha' && p.value < .5));
    traces.push(JSON.stringify(calls));
  }
  assert.equal(new Set(traces).size, 3, 'distinct silhouettes/details, not color swaps only');
  assert.equal(drawElementalDragon(drawingTrace().ctx, {type: 'air'}), false);
});

test('opposite reactive elements stop their sticky badge immediately; independent slow remains truthful', () => {
  const b = new CampaignBattle(), unit = b.createUnit('grunt');
  const fire = new ReactiveElement({element: 'fire', x: unit.x, y: unit.y}), ice = new ReactiveElement({element: 'ice', x: unit.x, y: unit.y});
  fire.attach(unit); ice.attach(unit); fire.world.reactiveElements = [fire, ice];
  unit.effects.add(createStatusEffect({kind: 'ice', target: unit, duration: 2}));
  assert.deepEqual(statusBadges(unit, [fire, ice]), ['ice', 'fire']);
  fire.reactToElements(); assert.deepEqual(statusBadges(unit, [fire, ice]), ['ice']);
  unit.effects.step(); unit.effects.step(); assert.deepEqual(statusBadges(unit, [fire, ice]), []);
});

test('badges stay readable at small view scales and are deduplicated', () => {
  const unit = {visible: true, hp: 100, x: 100, y: 100, height: 40, effects: {effects: [{kind: 'ice', duration: 10}]}};
  const reactive = {element: 'ice', active: true, stuckTo: unit};
  assert.deepEqual(statusBadges(unit, [reactive]), ['ice']);
  const {ctx, calls} = drawingTrace(); drawStatusBadges(ctx, unit, {reactiveElements: [reactive], scale: .2});
  assert.ok(calls.some(c => c.name === 'scale' && c.args[0] * .2 >= .75)); balanced(calls);
});

test('new notices reject malformed coordinates and irrelevant events', () => {
  for (const event of [null, {}, {type: 'critical', x: NaN, y: 1, tick: 0},
    {type: 'visual', kind: 'fire_arrow-tracer', x: 1, y: 2, tick: 0, width: -1, duration: 25, angle: 0},
    {type: 'visual', kind: 'fire_arrow-tracer', x: 1, y: 2, tick: 0, width: 5, duration: 25, angle: NaN},
    {type: 'shot', x: 1, y: 2, tick: 0}]) assert.equal(elementalNotice(event), null);
});

test('real UI consumes trail, critical, resistance and sticky art', async t => {
  const ui = await loadGameUI(t); ui.click('start');
  const b = ui.battle; b.enemies.step = () => null; b.friendlyQueue.step = () => null;
  const target = b.createUnit('fireDragon'); target.x = 950; target.y = 400; target.step = () => {}; b.updateGeometry(target);
  const events = [], original = b.onEvent; b.onEvent = e => {events.push(e); original(e);};
  const p = b.queueProjectile({kind: 'fire_arrow', team: 'good', x: 930, y: 401, vx: 4, vy: 0, advanceOnSpawn: false}); p.step();
  assert.ok(events.some(e => e.kind === 'fire_arrow-tracer'));
  assert.ok(events.some(e => e.kind === 'critical-marker'));
  assert.ok(events.some(e => e.type === 'projectile-hit' && e.target === target));
  assert.equal(b.reactiveElements.length, 1);
  const canvas = ui.get('battlefield'); canvas.captureDraws = true; canvas.drawCalls = []; ui.frames();
  assert.ok(canvas.drawCalls.some(c => c.name === 'fillText' && c.args[0] === 'FIRE RESISTANCE'));
  assert.ok(canvas.drawCalls.some(c => c.name === 'translate' && c.args[0] === p.x));
  ui.frames(45); canvas.drawCalls = []; ui.frames();
  assert.equal(canvas.drawCalls.some(c => c.name === 'fillText' && c.args[0] === 'FIRE RESISTANCE'), false, 'hit cue expires');
});

test('rendering preserves complete engine outcomes, random stream, stats and projectiles', () => {
  function run(render) {
    let seed = 19, randomCalls = 0; const notices = [], {ctx} = drawingTrace();
    const random = () => {randomCalls++; seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296;};
    const b = new CampaignBattle({random, onEvent: e => { if (render) {const n = elementalNotice(e); if (n) notices.push(n);} }});
    for (const [i, kind] of ['fireDragon', 'iceDragon', 'poisonDragon'].entries()) {
      const unit = b.createUnit(kind); unit.x = 1100 + i * 100; unit.y = 400; b.updateGeometry(unit);
      b.queueProjectile({kind: i % 2 ? 'ice_arrow' : 'fire_arrow', team: 'good', x: unit.x - 10, y: unit.y, vx: 2, vy: 0});
    }
    for (let i = 0; i < 240; i++) {
      b.step();
      if (render) {
        for (const n of notices) drawElementalNotice(ctx, n, b.tick, .27);
        for (const r of b.reactiveElements) drawReactiveElement(ctx, r, .27);
        for (const u of [...b.goodTeam, ...b.badTeam]) {drawStatusBadges(ctx, u, {reactiveElements: b.reactiveElements, scale: .27}); drawElementalDragon(ctx, u);}
      }
    }
    return {randomCalls, seed, stats: b.stats, gold: b.profile.gold, tick: b.tick,
      units: [...b.goodTeam, ...b.badTeam].map(u => [u.type, u.hp, u.x, u.y, u.vx, u.vy, u.speedFactor, u.effects.effects.map(e => [e.kind, e.duration])]),
      projectiles: b.projectiles.map(p => [p.kind, p.x, p.y, p.vx, p.vy, p.active]),
      reactive: b.reactiveElements.map(r => [r.element, r.x, r.y, r.active, r.dying, r.pulseCount])};
  }
  assert.deepEqual(run(true), run(false));
});

test('wording describes slowing and core engine matches reviewed gameplay boundary',()=>{
 const ui=readFileSync(new URL('../site/dist/battle.mjs',import.meta.url),'utf8');
 assert.match(ui,/iceArrow:'Ice damage that slows affected targets\.'/);assert.doesNotMatch(ui,/iceArrow:'[^']*freeze|iceWave:'Freezing/);
 // Snapshot updated only after source-reviewed siege/roster/scheduler corrections
 // plus recruitment/flyer protection, finite-ground safeguards the modern finite squad director, bounded Auto range assist, and validated
 // opt-in authored encounter data. expedition-engine-parity41.test.mjs compares
 // default Battle 1/16/30 simulation with the exact frozen41 constructor source.
 // The intentional modern displayed-price purchase rule now permits zero gold
 // after a purchase; purchase-roundtrip and armory-cart cover that exact boundary.
 // Impact events now expose immediate source and applied HP loss; the causal
 // training audit verifies unchanged combat state, legacy events and RNG.
 // Build55 adds reviewed fixed named Rally positions and an allied-only siege
 // building fallback with live-ownership release/impact guards. See army-rally-
 // position and siege-targeting tests; costs, damage, enemy AI and artwork stay unchanged.
 // See the dedicated source, recruitment, and flying-friendly-fire regressions.
 // Candidate61 adds transient independent company orders and a held-support
 // movement/range leash. Default/explicit Advance matches frozen60 in 30
 // seed/level cases. See company-orders61 and the isolated parity report.
 const candidate=new URL('../site/dist/engine/',import.meta.url),hash=createHash('sha256');
 for(const name of readdirSync(candidate).sort())hash.update(name+'\0').update(readFileSync(new URL(name,candidate))).update('\0');
 assert.equal(hash.digest('hex'),'02f77b93877f5d2210bbfce93645155bf41d9a4bff80c1cf109cfc18df2ebf18','reviewed engine boundary');
});
