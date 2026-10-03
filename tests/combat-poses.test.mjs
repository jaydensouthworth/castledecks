import test from 'node:test';
import assert from 'node:assert/strict';
import {CampaignBattle} from '../site/dist/engine/first-battle.mjs';
import {FLAG_ACTION as A} from '../site/dist/engine/flag-troop.mjs';
import {RANGED_ACTION as R} from '../site/dist/engine/ranged-troop.mjs';
import {actionSpan, combatPose, createCombatPoseController, drawCombatTroop} from '../site/dist/combat-poses.mjs';
import {loadGameUI} from './helpers/game-ui-harness.mjs';

function fixture(type = 'grunt', rank = 1) {
  const poses = createCombatPoseController(), events = [];
  const battle = new CampaignBattle({onEvent: event => { events.push(event); poses.event(event); }});
  poses.attach(battle);
  const unit = battle.createUnit(type, {team: 'good', rank});
  const target = battle.createUnit('grunt', {team: 'bad', rank});
  unit.x = 900; target.x = 915; unit.y = target.y = battle.elevationAt(900);
  unit.attacking = [target]; unit.rangedTarget = target;
  unit.chooseNextAction = () => unit.transition(A.BLOCK);
  const requests = [];
  for (const key of ['queueImpact', 'queueProjectile', 'queueEffect']) {
    const original = unit.services[key];
    unit.services[key] = function (request) { requests.push({key, tick: battle.tick, request}); return original.call(this, request); };
  }
  const step = (count = 1) => {
    for (let i = 0; i < count; i++) {
      battle.tick++; unit.step(); poses.observeTick({actorsAdvanced: true});
    }
  };
  const enter = action => { unit.transition(action); poses.observeTick({actorsAdvanced: false}); };
  return {battle, poses, events, unit, target, step, enter, requests};
}

for (const [type, ticks] of [['grunt',25], ['tallGrunt',25], ['archer',63], ['priest',25], ['mount',25]]) {
  test(`${type} winds up until the real melee request, including an immediate same-mode restart`, () => {
    const f = fixture(type), {unit, poses, step, requests} = f;
    unit.chooseNextAction = () => unit.transition(A.ATTACK);
    f.enter(A.ATTACK); step(ticks - 1);
    assert.equal(requests.length, 0); assert.equal(poses.pose(unit).strike, 0);
    assert.ok(poses.pose(unit).windup > .99);
    const priorAnimation = unit.animation;
    step();
    assert.equal(requests.length, 1); assert.equal(requests[0].tick, ticks);
    assert.notEqual(unit.animation, priorAnimation);
    assert.equal(unit.actionMode, 'attack'); assert.equal(poses.pose(unit).progress, 0);
    assert.equal(poses.pose(unit).strike, 1);
    step(10); assert.equal(poses.pose(unit).strike, 0);
  });
}

test('a melee request remains visible after the maximum UI catch-up batch', () => {
  const f = fixture(); f.enter(A.ATTACK); f.step(24);
  f.step(9); // One capped paint can follow nine observed simulation updates.
  assert.equal(f.requests[0].tick, 25); assert.ok(f.poses.pose(f.unit).strike > 0);
});

test('ice changes current speed without retiming an already-entered melee pose', () => {
  const f = fixture(); f.enter(A.ATTACK); f.step(10);
  const before = f.poses.pose(f.unit).progress;
  f.unit.speedFactor = .25;
  assert.equal(actionSpan(f.unit), 48); assert.equal(f.poses.pose(f.unit).progress, before);
  f.step(15); assert.equal(f.requests[0].tick, 25);
});

test('an absent or out-of-range melee target never produces a fabricated strike cue', () => {
  for (const missing of [true, false]) {
    const f = fixture();
    if (missing) f.unit.attacking = []; else f.target.x += 300;
    f.enter(A.ATTACK); f.step(25);
    assert.equal(f.requests.length, 0); assert.equal(f.poses.pose(f.unit).strike, 0);
  }
});

test('archer load/aim/release follow actual ticks and fired state', () => {
  const f = fixture('archer'); f.target.x = 1050; f.enter(R.LOAD_ARROW);
  assert.equal(f.poses.pose(f.unit).bowDraw, 0);
  f.step(15); assert.ok(f.poses.pose(f.unit).bowDraw > .4 && f.poses.pose(f.unit).bowDraw < .6);
  f.step(15); assert.equal(f.unit.actionMode, 'aim'); assert.equal(f.poses.pose(f.unit).bowDraw, 1);
  f.step(240); assert.equal(f.unit.actionMode, 'release_arrow'); assert.equal(f.unit.fired, false);
  assert.equal(f.requests.length, 0); assert.equal(f.poses.pose(f.unit).nocked, true);
  f.step(); assert.equal(f.requests.length, 1); assert.equal(f.requests[0].tick, 271);
  assert.equal(f.poses.pose(f.unit).bowRelease, 1); assert.equal(f.poses.pose(f.unit).nocked, false);
});

for (const mode of [R.HEAL, R.PURGE]) {
  test(`priest ${mode} has a staff cast and request flare, without claiming HP application`, () => {
    const f = fixture('priest'); f.unit.healTarget = f.target; f.target.hp -= 40;
    f.enter(mode); f.step(17);
    assert.equal(f.requests.length, 0); assert.equal(f.poses.pose(f.unit).casting, 1);
    const hp = f.target.hp; f.step();
    assert.equal(f.requests[0].tick, 18); assert.equal(f.requests[0].request.kind, mode);
    assert.equal(f.poses.pose(f.unit).castKind, mode); assert.equal(f.poses.pose(f.unit).castBurst, 1);
    assert.equal(f.target.hp, hp, 'request cue is not a fabricated heal result');
  });
}

for (const type of ['grunt', 'archer', 'priest']) {
  test(`${type} knockdown and get-up are continuous at real state transitions`, () => {
    const f = fixture(type); f.enter(A.KNOCKBACK); f.step(3);
    assert.ok(f.poses.pose(f.unit).down > 0 && f.poses.pose(f.unit).down < 1);
    f.step(3); assert.equal(f.unit.actionMode, 'daze'); assert.equal(f.poses.pose(f.unit).down, 1);
    f.step(121); assert.equal(f.unit.actionMode, 'get_up_daze');
    assert.equal(f.unit.knockedDown, false); assert.equal(f.poses.pose(f.unit).down, 1);
    f.step(24); assert.ok(f.poses.pose(f.unit).down > .4 && f.poses.pose(f.unit).down < .6);
    f.step(25); assert.equal(f.unit.actionMode, 'block'); assert.equal(f.poses.pose(f.unit).down, 0);
  });
}

test('mounted reactions stay limited to transitions accepted by the engine', () => {
  const f = fixture('mount'); f.enter(A.BLOCK);
  for (const action of [A.KNOCKBACK, A.DAZE, A.FLINCH]) {
    assert.equal(f.unit.transition(action), null); assert.equal(f.unit.actionMode, 'block');
    assert.equal(f.poses.pose(f.unit).down, 0);
  }
});

for (const [type, ticks] of [['grunt',19], ['tallGrunt',19], ['archer',13], ['priest',19], ['mount',13]]) {
  test(`${type} hp zero starts collapse and reaches rot on the actual engine tick`, () => {
    const f = fixture(type); f.enter(A.BLOCK); f.unit.takeDamage(f.unit.hp);
    f.poses.observeTick({actorsAdvanced:false});
    assert.equal(f.unit.hp, 0); assert.equal(f.poses.pose(f.unit).down, 0);
    f.step(Math.floor(ticks / 2));
    assert.equal(f.unit.actionMode, 'die');
    assert.ok(f.poses.pose(f.unit).down > .25 && f.poses.pose(f.unit).down < .8);
    f.step(ticks - Math.floor(ticks / 2));
    assert.equal(f.unit.actionMode, 'rot'); assert.equal(f.poses.pose(f.unit).down, 1);
  });
}

test('death while prone does not stand the soldier up before collapsing again', () => {
  const f = fixture(); f.enter(A.DAZE); f.unit.takeDamage(f.unit.hp);
  f.poses.observeTick({actorsAdvanced:false});
  assert.equal(f.unit.knockedDown, true); assert.equal(f.poses.pose(f.unit).down, 1);
  f.step(5); assert.equal(f.poses.pose(f.unit).down, 1);
});

test('hero gait, draw, release and cosmetic collapse use available hero/input/event state', () => {
  const f = fixture(), {battle, poses} = f, hero = battle.hero;
  hero.leaveGarrison(); hero.vx = 2; hero.x += 2; battle.tick++;
  poses.observeTick({actorsAdvanced:true}); assert.notEqual(poses.pose(hero).gait, 0);
  const shooter = battle.shooter, origin = hero.launchPosition;
  shooter.origin = origin; shooter.press(origin); shooter.step();
  shooter.move({x:origin.x - 100, y:origin.y + 30}); shooter.step();
  assert.ok(poses.pose(hero).bowDraw > 0); assert.equal(poses.pose(hero).nocked, true);
  shooter.release(shooter.pointer); const aim = shooter.step();
  assert.equal(battle.shoot(aim), false); assert.equal(poses.pose(hero).bowRelease, 0);
  for(let i=0;i<30;i++)battle.activeSkill.step();
  assert.equal(battle.shoot(aim), true); assert.equal(poses.pose(hero).bowRelease, 1);
  f.unit.transition(A.ATTACK); battle.tick++; poses.observeTick({actorsAdvanced:true});
  const troopPose = poses.pose(f.unit);
  hero.takeDamage(hero.hp); poses.observeTick({actorsAdvanced:false});
  assert.equal(battle.outcome, 'defeat'); assert.equal(poses.pose(hero).down, 0);
  for (let i=0; i<12; i++) { battle.step(); poses.observeTick({actorsAdvanced:false}); }
  assert.equal(poses.pose(hero).down, 1);
  assert.deepEqual(poses.pose(f.unit), troopPose, 'troop pose remains frozen during the outcome countdown');
});

test('observer service wrappers preserve arguments, this, return and throw behavior', () => {
  const returned = {}, request = {}, error = new Error('expected original failure');
  let calls = 0, receivedThis;
  const unit = {type:'grunt', x:0, actionMode:'attack', actionDuration:48,
    animation:{rate:.25}, services:{queueImpact(...args){ calls++; receivedThis=this; assert.deepEqual(args,[request,7]); return returned; }}};
  request.source = unit;
  const poses = createCombatPoseController(); poses.attach({tick:0,goodTeam:[unit],badTeam:[]});
  assert.equal(unit.services.queueImpact(request,7), returned); assert.equal(calls,1);
  assert.equal(receivedThis,unit.services); assert.equal(poses.pose(unit).strike,1);
  const failing = {...unit,services:{queueImpact(){throw error;}}};
  const second = createCombatPoseController(); second.attach({tick:0,goodTeam:[failing],badTeam:[]});
  assert.throws(()=>failing.services.queueImpact({source:failing}),e=>e===error);
  assert.equal(second.pose(failing).strike,0);
});

function canvasTrace() {
  const calls=[], stack=[];
  const state={globalAlpha:1};
  const ctx=new Proxy(state,{get(target,key){
    if(key in target)return target[key];
    return (...args)=>{
      for(const value of args)if(typeof value==='number')assert.ok(Number.isFinite(value),`${String(key)}: ${value}`);
      calls.push([key,...args]);
      if(key==='save')stack.push({...state});
      if(key==='restore'){assert.ok(stack.length);Object.assign(state,stack.pop());}
    };
  },set(target,key,value){if(typeof value==='number')assert.ok(Number.isFinite(value));target[key]=value;return true;}});
  return {ctx,calls,stack};
}

test('all supported action poses draw finite balanced Canvas calls without mutating units', () => {
  for(const type of ['grunt','tallGrunt','archer','priest','mount']) {
    const f=fixture(type);
    for(const mode of [A.ADVANCE,A.ATTACK,A.BLOCK,A.PICKUP_ENEMY,A.FLINCH,A.KNOCKBACK,A.DAZE,A.GET_UP,A.DIE,A.ROT]) {
      f.enter(mode);
      for(const fraction of [0,.5,1]) {
        f.unit.actionDuration=actionSpan(f.unit)*(1-fraction);
        const before=JSON.stringify({x:f.unit.x,y:f.unit.y,hp:f.unit.hp,mode:f.unit.actionMode,d:f.unit.actionDuration,animation:f.unit.animation,hitbox:f.unit.hitbox});
        const {ctx,calls,stack}=canvasTrace(); assert.equal(drawCombatTroop(ctx,f.unit,f.poses.pose(f.unit)),true);
        assert.ok(calls.length>0); assert.equal(stack.length,0);
        assert.equal(JSON.stringify({x:f.unit.x,y:f.unit.y,hp:f.unit.hp,mode:f.unit.actionMode,d:f.unit.actionDuration,animation:f.unit.animation,hitbox:f.unit.hitbox}),before);
      }
    }
  }
  const {ctx,calls}=canvasTrace();
  assert.equal(drawCombatTroop(ctx,{type:'hero',visible:false}),true); assert.equal(calls.length,0);
  assert.equal(drawCombatTroop(ctx,{type:'trebuchet'}),false);
});

function semanticState(value, seen = new Map()) {
  if(typeof value==='function')return '[function]';
  if(value===null||typeof value!=='object')return value;
  if(seen.has(value))return {$ref:seen.get(value)};
  seen.set(value,seen.size);
  if(value instanceof Set)return [...value].map(item=>semanticState(item,seen));
  if(Array.isArray(value))return value.map(item=>semanticState(item,seen));
  return Object.fromEntries(Object.keys(value).sort().filter(key=>!['services','onEvent','random'].includes(key))
    .map(key=>[key,semanticState(value[key],seen)]));
}

test('600 deterministic battle updates preserve complete semantic state, events and RNG usage', () => {
  function run(observed) {
    const poses=createCombatPoseController(), events=[];let state=73,rolls=0;
    const random=()=>{rolls++;state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
    const battle=new CampaignBattle({random,onEvent:event=>{
      events.push([event.type,event.tick,event.kind,event.damage,event.amount]);if(observed)poses.event(event);
    }});
    if(observed)poses.attach(battle);
    for(const type of ['grunt','tallGrunt','archer','priest','mount'])for(const team of ['good','bad']) {
      const unit=battle.createUnit(type,{team,rank:1});unit.x=team==='good'?870:900;unit.y=battle.elevationAt(unit.x);
    }
    return {battle,poses,events,get rolls(){return rolls;}};
  }
  const plain=run(false),observed=run(true);
  for(let tick=0;tick<600;tick++) {
    const advanced=!observed.battle.paused&&!observed.battle.summary&&!observed.battle.outcome;
    plain.battle.step();observed.battle.step();observed.poses.observeTick({actorsAdvanced:advanced});
    assert.equal(observed.rolls,plain.rolls,`RNG calls at tick ${tick}`);
    assert.deepEqual(semanticState(observed.battle),semanticState(plain.battle),`semantic state at tick ${tick}`);
  }
  assert.deepEqual(observed.events,plain.events);
});

test('shipped integration runs actual UI callbacks, handles invisible hero and animates die before rot', async t => {
  const ui=await loadGameUI(t);ui.click('start');ui.frames();
  const unit=ui.battle.createUnit('grunt',{team:'good',rank:1});
  unit.x=900;unit.y=ui.battle.elevationAt(unit.x);unit.transition(A.BLOCK);unit.takeDamage(unit.hp);
  const canvas=ui.get('battlefield');canvas.captureDraws=true;canvas.drawCalls=[];
  ui.frames();
  assert.equal(unit.actionMode,'die');
  assert.ok(canvas.drawCalls.some(call=>call.name==='rotate'&&call.args[0]<0&&call.args[0]>-1.48), 'actual shipped troop branch draws a partially rotated death pose');
  ui.frames(18);assert.equal(unit.actionMode,'rot');
  ui.click('battlePause');const duration=unit.actionDuration;ui.frames(4);assert.equal(unit.actionDuration,duration);
});
