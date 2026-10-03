import test from 'node:test';
import assert from 'node:assert/strict';
import {CampaignBattle} from '../site/dist/engine/first-battle.mjs';
import {createCombatPoseController, walkCycle, walkFoot, personRig, combatPose} from '../site/dist/combat-poses.mjs';

const types = ['grunt', 'tallGrunt', 'archer', 'priest', 'hero', 'mount'];
const heights = {grunt:43, tallGrunt:60, archer:40, priest:36, hero:55, mount:60};
function walker(type, direction = 1, speed = null) {
  const poses = createCombatPoseController();
  const battle = new CampaignBattle({onEvent: e => poses.event(e)}); poses.attach(battle);
  const unit = type === 'hero' ? battle.hero : battle.createUnit(type, {team: direction > 0 ? 'good' : 'bad', rank:1});
  unit.leaveGarrison?.(); unit.x = 1000; unit.y = battle.elevationAt(unit.x);
  if (speed !== null) unit.speed = speed;
  if (type === 'hero') battle.input[direction > 0 ? 'right' : 'left'] = true;
  else {unit.chooseNextAction = () => unit.transition('advance'); unit.transition('advance');}
  poses.observeTick({actorsAdvanced:false});
  const step = () => {battle.tick++; unit.step(); poses.observeTick({actorsAdvanced:true}); return poses.pose(unit);};
  return {unit, battle, poses, step};
}

for (const type of types) for (const direction of [-1, 1]) {
  test(`${type} ${direction > 0 ? 'right' : 'left'} support feet stay planted during real-engine movement`, () => {
    const f = walker(type, direction); let prior = null, contacts = 0, wraps = 0;
    for (let tick = 0; tick < 220; tick++) {
      const pose = f.step(), feet = [0,.5].map(offset => walkFoot(pose.walk, offset));
      if (prior) {
        if (pose.walk.phase < prior.phase) wraps++;
        feet.forEach((foot, index) => {
          const old = prior.feet[index];
          if (foot.planted && old.planted && foot.x < old.x) {
            assert.ok(Math.abs(f.unit.x + direction * foot.x - prior.x - direction * old.x) < 1e-9);
            assert.equal(foot.y, -2); contacts++;
          }
        });
      }
      prior = {x:f.unit.x, phase:pose.walk.phase, feet};
    }
    assert.ok(contacts > 80, `actual support samples: ${contacts}`);
    assert.ok(wraps > 1, 'several full cycles, including real move action resets');
  });
}

test('all human legs retain both segment lengths and one foot supports every walk frame', () => {
  for (const type of types.filter(t => t !== 'mount')) for (let i = 0; i < 200; i++) {
    const walk = walkCycle({type, actionMode:'move', vx:1, hp:1}, {walkDistance:i * .37});
    const rig = personRig({walk, crouch:0, down:0, dead:false},heights[type]);
    assert.ok(rig.legs.some(leg => leg.foot.planted));
    const length = rig.length;
    rig.legs.forEach(leg => {
      assert.ok(Math.abs(Math.hypot(leg.hip.x-leg.knee.x,leg.hip.y-leg.knee.y)-length)<1e-9);
      assert.ok(Math.abs(Math.hypot(leg.foot.x-leg.knee.x,leg.foot.y-leg.knee.y)-length)<1e-9);
      assert.ok(leg.foot.y <= -2 && leg.foot.y >= -7, 'foot never crosses ground');
    });
  }
});

test('cadence follows distance at slow and fast speeds, including animation-frame resets', () => {
  const slow=walker('grunt',1,.5), fast=walker('grunt',1,1);
  let slowPose, fastPose;
  for(let i=0;i<60;i++) {slowPose=slow.step();slowPose=slow.step();fastPose=fast.step();}
  assert.ok(Math.abs(slow.unit.x-fast.unit.x)<1e-9);
  assert.deepEqual(slowPose.walk,fastPose.walk);
  const before=slow.poses.pose(slow.unit).walk;
  slow.unit.transition('advance');slow.poses.observeTick({actorsAdvanced:false});
  assert.deepEqual(slow.poses.pose(slow.unit).walk,before,'fresh engine animation must not restart a step');
});

test('stationary actions, paused observation, garrison transfers and teleport placement do not walk', () => {
  const f=walker('grunt');for(let i=0;i<8;i++)f.step();
  const before=f.poses.pose(f.unit).walk.distance;
  f.unit.transition('block');f.step();assert.equal(f.poses.pose(f.unit).walk.moving,false);
  assert.equal(f.poses.pose(f.unit).walk.distance,before);
  f.unit.transition('advance');f.poses.observeTick({actorsAdvanced:false});
  const pose=f.poses.pose(f.unit);f.battle.tick++;f.poses.observeTick({actorsAdvanced:false});
  assert.deepEqual(f.poses.pose(f.unit),pose);
  f.unit.x+=500;f.battle.tick++;f.poses.observeTick({actorsAdvanced:true});
  assert.equal(f.poses.pose(f.unit).walk.distance,before,'placement jump is ignored');
  f.unit.garrisonBuilding=f.battle.goodCastle;
  assert.equal(f.poses.pose(f.unit).walk.moving,false);
});

test('pure pose lookup does not depend on engine frame, action generation or wall-clock time', () => {
  const base={type:'grunt',hp:100,vx:1,actionMode:'move',actionDuration:20,animation:{start:5,end:14,frame:5,rate:.2}};
  const a=combatPose(base,{walkDistance:11});
  const b=combatPose({...base,animation:{...base.animation,frame:14}},{walkDistance:11});
  assert.equal(a.gait,b.gait);assert.deepEqual(a.walk,b.walk);
});
