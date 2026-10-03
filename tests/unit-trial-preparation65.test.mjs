import test from 'node:test';
import assert from 'node:assert/strict';
import {createUnitTrial,unitTrialOptions,prepareUnitTrial,unitTrialCopy} from '../site/dist/unit-trial.mjs';
import {CampaignBattle} from '../site/dist/engine/first-battle.mjs';
import {REGULAR_RECRUIT_IDS} from '../site/dist/engine/recruitment.mjs';
import {SKILLS} from '../site/dist/engine/progression.mjs';
import {FriendlyReinforcements} from '../site/dist/engine/campaign.mjs';
import {FLAG_STATUS} from '../site/dist/engine/flag-troop.mjs';
import {assistedAutoAim} from '../site/dist/engine/assisted-auto-aim.mjs';

// Authored field fixtures only: no fabricated spawn/hit/damage events, injected
// combatants, replacement AI, stat boosts or altered queue/cooldown timers.
function trial(id,run=createUnitTrial(id)){
 let controller;const events=[];
 const battle=new CampaignBattle({...unitTrialOptions(run),onEvent:e=>{events.push(e);controller?.observe(e);}});
 controller=prepareUnitTrial(battle,run);
 const step=(ticks=1)=>{for(let i=0;i<ticks;i++)battle.step();};
 return {run,battle,controller,events,step};
}
const fixtureActors=f=>f.run.cardId==='priest'?[f.controller.target]:f.battle.badTeam;
const state=u=>({x:u.x,y:u.y,hp:u.hp,maxHp:u.maxHp,damage:u.damage,speed:u.speed,rank:u.rank,actionMode:u.actionMode,actionDuration:u.actionDuration});
const effect=s=>s.healed+s.damage;
for(const id of REGULAR_RECRUIT_IDS)test(`${id}: 20 s / reset / 60 s reading preserves the authored target and normal role demonstration`,()=>{
 const immediate=trial(id);immediate.battle.hotbar.select(0);immediate.step(2400);
 const expected=immediate.controller.snapshot,run=createUnitTrial(id);
 for(const delay of [20*33,60*33]){
  const f=trial(id,run),{battle:b,controller:c}=f,entry=SKILLS[id],before=fixtureActors(f).map(state);
  const queueStep=b.friendlyQueue.step,battleStep=b.step;
  f.step(delay);
  assert.equal(c.snapshot.preparing,true);assert.equal(c.snapshot.deployed,0);assert.equal(effect(c.snapshot),0);
  assert.deepEqual(fixtureActors(f).map(state),before);
  assert.equal(b.ownFlag.status,FLAG_STATUS.AT_BASE);assert.equal(b.enemyFlag.status,FLAG_STATUS.AT_BASE);
  assert.equal(b.profile.gold,500);assert.equal(b.friendlyQueue.population,20);assert.equal(c.contract.cooldown,0);
  assert.equal(battleStep,CampaignBattle.prototype.step);assert.equal(queueStep,FriendlyReinforcements.prototype.step);
  assert.equal(b.tick,delay,'the ordinary tick and queue remain available');
  assert.match(unitTrialCopy(c).instruction,/Preparation: targets wait until your first squad enters/);
  assert.equal(unitTrialCopy(c).canDeploy,true);
  assert.equal(b.hotbar.activate(c.contract),true);assert.equal(c.snapshot.preparing,true,'payment is not a spawn');
  assert.equal(b.profile.gold,500-entry.summon.cost);assert.equal(c.contract.cooldown,entry.cooldown);
  assert.equal(b.friendlyQueue.population,20-entry.summon.amount*entry.summon.population);
  f.step(2400);
  assert.equal(c.snapshot.preparing,false);assert.equal(c.snapshot.deployed,entry.summon.amount);
  assert.ok(effect(c.snapshot)>0,`${id} needs actual recruit damage or healing within 73 s`);
  assert.deepEqual(c.snapshot,expected,'reading delays must not change the seeded live role demonstration');
  assert.doesNotMatch(unitTrialCopy(c).instruction,/Preparation:/);
  for(const u of fixtureActors(f))assert.equal(u.step,Object.getPrototypeOf(u).step,'normal actor step is restored');
  assert.equal(b.outcome,null);assert.equal(b.summary,null);assert.equal(b.profile.victories,0);assert.equal(b.profile.defeats,0);
 }
});

test('waiting ends at the actual first spawn, preserving queue phase, cooldown, payment and paused state',()=>{
 const f=trial('fireDragon'),{battle:b,controller:c}=f,target=c.target,heldStep=target.step;
 f.step(7);const originalTimer=b.friendlyQueue.timer;assert.equal(originalTimer,26);
 assert.equal(b.hotbar.activate(c.contract),true);assert.equal(b.profile.gold,435);assert.equal(b.friendlyQueue.queue.length,1);
 assert.equal(b.hotbar.activate(c.contract),false,'cooldown blocks a duplicate paid order');
 f.step(13);assert.equal(c.snapshot.preparing,true);assert.equal(target.x,1050);assert.equal(b.friendlyQueue.timer,0);assert.equal(c.contract.cooldown,1294);
 b.paused=true;f.step(50);assert.equal(b.friendlyQueue.timer,0);assert.equal(c.snapshot.preparing,true);assert.equal(target.step,heldStep);
 b.paused=false;f.step();assert.equal(c.snapshot.preparing,false);assert.equal(c.snapshot.deployed,1);assert.equal(b.friendlyQueue.timer,38);assert.equal(c.contract.cooldown,1292);assert.equal(b.profile.gold,435);
 assert.equal(target.step,Object.getPrototypeOf(target).step);assert.ok(f.events.some(e=>e.type==='spawn'&&e.unit.skill===c.contract));
});

test('Basic Arrow can really damage and kill a waiting target without recruit credit or ending preparation',()=>{
 const f=trial('fireDragon'),{battle:b,controller:c}=f,arrow=b.profile.skills.find(s=>s.id==='arrow'),target=c.target;
 for(let i=0;i<10&&target.hp>0;i++){
  const aim=assistedAutoAim(b.hero.launchPosition,c.targetPoint(),{powerPercent:b.shooter.powerPercent,angleMode:1,gravity:b.gravity});
  assert.equal(b.queuePlayerShot(aim,arrow),true);f.step(150);
 }
 assert.ok(f.events.some(e=>e.type==='damage'&&e.source?.skill===arrow&&e.target===target&&e.actualDamage>0));
 assert.equal(target.hp,0);f.step(400);assert.equal(target.destroyed,true,'real death cleanup still runs while preparing');
 assert.equal(c.snapshot.preparing,true);assert.equal(c.snapshot.deployed,0);assert.equal(c.snapshot.damage,0);
 assert.equal(b.badTeam.length,1,'the trial does not replace targets the player kills');
 assert.equal(b.hotbar.activate(c.contract),true);f.step(20);
 assert.equal(c.snapshot.preparing,false);assert.equal(target.step,Object.getPrototypeOf(target).step);
});

test('first deployment permanently releases the actors even after all recruits die; reset creates a new preparation',()=>{
 const f=trial('fireDragon'),{battle:b,controller:c}=f;
 b.hotbar.activate(c.contract);f.step(20);assert.equal(c.snapshot.preparing,false);
 // Explicit post-start death fault: do not inject replacement actors or spawns.
 for(const u of b.goodTeam.filter(u=>u.skill===c.contract))u.takeDamage(u.hp);
 f.step(300);assert.equal(c.snapshot.alive,0);assert.equal(c.snapshot.preparing,false);
 const restored=c.target.step;assert.equal(restored,Object.getPrototypeOf(c.target).step);f.step(100);assert.equal(c.target.step,restored);
 const reset=trial('fireDragon',f.run);assert.equal(reset.controller.snapshot.preparing,true);assert.equal(reset.controller.snapshot.deployed,0);assert.equal(reset.controller.target.x,1050);assert.equal(reset.controller.target.hp,100);assert.equal(reset.battle.profile.gold,500);
 reset.step(1980);assert.equal(reset.controller.target.x,1050);assert.equal(c.snapshot.preparing,false,'an old trial never rearms');
});
