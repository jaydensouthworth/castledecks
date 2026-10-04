import test from 'node:test';import assert from 'node:assert/strict';
import {createStressField,stressFieldLimits,stressFieldSnapshot,stressFieldCopy,isStressField} from '../site/dist/stress-field.mjs';
import {SkirmishBattle} from '../site/dist/skirmish-battle.mjs';
import {AuxiliaryController} from '../site/dist/engine/auxiliary-controller.mjs';
import {armyCompany} from '../site/dist/engine/army-orders.mjs';
import {sampleBattleRenderLoad} from '../site/dist/battle-render-profiler.mjs';
const descriptor=threat=>({version:1,seed:660048,biome:'oaks',threat,doctrine:'levy'});
for(const preset of ['standard','veteran']){
 test(`${preset} stages exact real caps and ordinary rank2 stats/AI without actor ticks`,()=>{
  const events=[],{battle:b,profiles}=createStressField({preset,onEvent:e=>events.push(e)}),natural=new SkirmishBattle({descriptor:descriptor(preset)}),limits=stressFieldLimits(preset),s=stressFieldSnapshot(b);
  assert.equal(b.tick,201);assert.equal(b.stressField.runStartTick,201);assert.equal(s.elapsedSeconds,0);assert.equal(b.paused,true);assert.equal(s.troops.alive,preset==='standard'?44:48);
  assert.equal(b.friendlyQueue.cap,natural.friendlyQueue.cap);assert.equal(b.enemies.cap,natural.enemies.cap);assert.equal(b.regularArmyCount,limits.ordinary);assert.equal(b.auxiliaries instanceof AuxiliaryController,true);assert.equal(b.auxiliaries.snapshot.occupied,10);assert.equal(b.auxiliaries.snapshot.pending,0);assert.equal(b.auxiliaries.snapshot.wavesCalled,2);assert.equal(b.auxiliaries.snapshot.tickets.filter(t=>t.state==='discarded').length,10);assert.equal(b.auxiliaries.callWave(3),false);
  assert.equal(profiles.active,b.profile);assert.equal(b.profile.gold,0);assert.equal(b.stats.goldSpent,0);assert.equal(b.friendlyQueue.population,0);assert.equal(b.profile.victories,0);assert.equal(b.profile.defeats,0);assert.equal(b.protectedTesting,false);assert.deepEqual(events,[]);
  for(const u of [...b.goodTeam,...b.badTeam].filter(u=>u!==b.hero)){
   const v=natural.createUnit(u.type,{team:u.team,rank:2});
   for(const key of ['maxHp','hp','damage','speed','originalSpeed','speedFactor','rank','runner','actionMode','actionDuration','dead','destroyed','attackLimit','attackedByLimit','height','width'])assert.equal(u[key],v[key],`${u.team}/${u.type}/${key}`);
   assert.equal(Object.getPrototypeOf(u),Object.getPrototypeOf(v));assert.equal(u.step,v.step);assert.equal(u.effects.effects.length,0);assert.equal(u.pendingImpacts.length,0);assert.deepEqual(u.animation,v.animation);assert.equal(u.friendFlag,u.team==='good'?b.ownFlag:b.enemyFlag);assert.equal(u.enemyFlag,u.team==='good'?b.enemyFlag:b.ownFlag);
  }
  const load=sampleBattleRenderLoad(b);assert.equal(load.actorsLiving,s.troops.alive+1);assert.equal(load.alliesLiving,limits.ordinary+limits.auxiliary+1);assert.equal(load.enemiesLiving,limits.enemy);
  for(let i=0;i<100;i++)b.step();assert.equal(b.tick,201);b.paused=false;b.step();assert.equal(b.tick,202);assert.equal(stressFieldSnapshot(b).elapsedSeconds,1/33);
 });
}
test('private auxiliary ownership survives forged labels, death and real body removal',()=>{
 const {battle:b}=createStressField(),levy=b.auxiliaries.snapshot.units[0],ordinary=b.goodTeam.find(u=>u!==b.hero&&!b.auxiliaries.owns(u));
 ordinary.auxiliaryIdentity=levy.auxiliaryIdentity;assert.equal(b.regularArmyCount,14);assert.equal(b.auxiliaries.owns(ordinary),false);
 levy.hp=0;assert.equal(stressFieldSnapshot(b).auxiliary.alive,9);assert.equal(b.auxiliaries.snapshot.occupied,10);assert.equal(b.regularArmyCount,14);
 b.paused=false;for(let i=0;i<200&&b.objects.items.includes(levy);i++)b.step();assert.equal(b.objects.items.includes(levy),false);assert.equal(b.auxiliaries.snapshot.occupied,9);assert.equal(b.auxiliaries.callWave(3),false);
});
test('normal company, ally/enemy selection, healing and projectile AI stay live',()=>{
 const events=[],{battle:b}=createStressField({onEvent:e=>events.push(e)}),front=b.goodTeam.find(u=>armyCompany(u)==='frontline'),support=b.goodTeam.find(u=>armyCompany(u)==='support');
 assert.equal(b.setArmyOrder('rally','center','frontline'),true);assert.equal(b.setArmyOrder('rally','rear','support'),true);assert.equal(b.armyOrders.activeFor(front),true);assert.equal(b.armyOrders.activeFor(support),true);
 assert.equal(front.enemies().every(u=>u.team==='bad'),true);assert.equal(b.badTeam[0].enemies().every(u=>u.team==='good'),true);
 front.hp=Math.floor(front.maxHp/2);b.paused=false;for(let i=0;i<800&&!b.stressField.stopped;i++)b.step();
 assert.ok(events.some(e=>e.type==='heal'||e.type==='damage'));assert.ok(b.projectiles.length||events.some(e=>e.type==='projectile-hit'));assert.equal(b.summary,null);assert.equal(b.outcome,null);
});
test('120-second relative bound is simulation-only and cannot resume or settle',()=>{
 const events=[],{battle:b}=createStressField({onEvent:e=>events.push(e)});const baseline=[b.profile.victories,b.profile.defeats,b.profile.highestLevel];
 b.tick=b.stressField.runStartTick+b.stressField.durationTicks-1;for(let i=0;i<100;i++)b.step();assert.equal(b.stressField.stopped,false);b.paused=false;b.step();
 assert.equal(b.stressField.stopped,true);assert.equal(stressFieldSnapshot(b).elapsedSeconds,120);assert.equal(b.paused,true);const tick=b.tick;b.paused=false;b.step();assert.equal(b.tick,tick);assert.equal(b.finishOutcome('victory'),false);assert.equal(b.summary,null);assert.equal(b.outcome,null);assert.deepEqual([b.profile.victories,b.profile.defeats,b.profile.highestLevel],baseline);assert.equal(events.filter(e=>e.type==='synthetic-field-stopped').length,1);
});
test('normal combat losses reduce counts without reinforcements or stat replenishment',()=>{
 const {battle:b}=createStressField({preset:'veteran'});b.paused=false;let min=48;for(let i=0;i<3961&&!b.stressField.stopped;i++){b.step();min=Math.min(min,stressFieldSnapshot(b).troops.alive);}
 assert.ok(min<48);assert.equal(b.enemies.remaining,0);assert.equal(b.auxiliaries.snapshot.pending,0);assert.equal(b.friendlyQueue.queue.length,0);assert.equal(b.profile.victories,0);assert.equal(b.profile.defeats,0);assert.equal(b.summary,null);assert.equal(b.outcome,null);assert.ok(b.stressField.stopped);assert.ok(stressFieldSnapshot(b).elapsedSeconds<=120);
});
test('fresh factories and repeat disposal cannot mutate or serialize a campaign',()=>{
 const a=createStressField(),b=createStressField();assert.notEqual(a.battle,b.battle);assert.notEqual(a.profiles,b.profiles);assert.notEqual(a.profiles.active,b.profiles.active);assert.notEqual(a.battle.goodTeam[1],b.battle.goodTeam[1]);
 assert.throws(()=>a.profiles.exportBundle(),/cannot be exported/);assert.throws(()=>a.profiles.importBundle('{}'),/cannot load/);assert.equal(a.profiles.canCreate,false);assert.equal(a.profiles.canDelete,false);assert.equal(a.profiles.create('bad'),null);
 assert.equal(a.battle.dispose(),true);assert.equal(a.battle.dispose(),false);const tick=a.battle.tick;a.battle.paused=false;a.battle.step();assert.equal(a.battle.tick,tick);assert.equal(stressFieldSnapshot(b.battle).troops.alive,44);assert.equal(isStressField({stressField:{kind:'synthetic-stress-field'}}),false);
 assert.match(stressFieldCopy(b.battle).notice,/artificially staged/);assert.throws(()=>createStressField({preset:'late-campaign'}),/Standard or Veteran/);
});
