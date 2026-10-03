import test from 'node:test';
import assert from 'node:assert/strict';
import {CampaignBattle} from '../site/dist/engine/first-battle.mjs';
import {createStatusEffect} from '../site/dist/engine/special-projectiles.mjs';
import {createTrainingRun,createTrainingBattleOptions,prepareTrainingBattle} from '../site/dist/guided-training.mjs';

// These fixtures run actual assisted shots, world collisions, effect queues and
// damage callbacks. Capacity/resistance are explicit fault-induction fixtures;
// no shot, hit or damage event is forged and no HP is manually reduced.
function fixture(index=1){
 const run=createTrainingRun();run.index=index;const events=[];let controller;
 const b=new CampaignBattle({...createTrainingBattleOptions(run),onEvent:e=>{events.push({...e,hpAtEvent:controller?.target?.hp});controller?.observe(e);}});
 controller=prepareTrainingBattle(b,run);
 const tick=(n=1)=>{for(let i=0;i<n;i++){b.step();controller.afterTick();}};
 const until=(predicate,max=600)=>{for(let i=0;i<max&&!predicate();i++)tick();assert.ok(predicate(),'expected engine condition within tick bound');};
 const shoot=(skill='arrow',high=false)=>{b.shooter.angleMode=high?0:1;b.activeSkill=b.profile.skills.find(s=>s.id===skill);b.hotbar.active=b.activeSkill;assert.ok(controller.assistedShot());tick();return b.projectiles.at(-1);};
 const fill=(duration=400)=>{for(let i=0;i<4;i++)assert.equal(controller.target.effects.add(createStatusEffect({kind:'ice',target:controller.target,duration,slowFactor:1})).status,'accepted');};
 return {b,run,controller,events,tick,until,shoot,fill};
}
const contact=(f,p)=>f.events.find(e=>e.target===f.controller.target&&e.projectile===p&&(e.type==='hit'||e.type==='projectile-hit'));
const damage=(f,p)=>f.events.find(e=>e.target===f.controller.target&&e.type==='damage'&&e.source===p);

for(const index of [0,1,3])test(`lesson ${index}: real primary damage follows contact on the next target step`,()=>{
 const f=fixture(index),p=f.shoot('arrow',index===1);f.until(()=>contact(f,p));
 const hit=contact(f,p);assert.equal(f.controller.target.hp,5000);assert.equal(f.controller.complete,false);assert.equal(f.controller.stage,'waiting');
 f.tick();const hitDamage=damage(f,p);assert.ok(hitDamage);assert.equal(hitDamage.tick,hit.tick+1);assert.equal(hitDamage.actualDamage,5000-f.controller.target.hp);assert.equal(f.controller.snapshot.lastDamage,hitDamage.actualDamage);
 assert.equal(f.controller.stage,index===3?'counter':'complete');assert.equal(f.b.profile.victories,0);
});

test('full queue: a blocked high arc cannot borrow a later low-arc hit, and a fresh high arc still completes',()=>{
 const f=fixture();f.fill();const high=f.shoot('arrow',true);f.tick(359);assert.ok(contact(f,high));assert.equal(damage(f,high),undefined);assert.equal(f.controller.target.hp,5000);assert.equal(f.controller.complete,false);
 f.tick(60);assert.equal(f.controller.target.effects.effects.length,0);const low=f.shoot();f.tick(119);assert.ok(damage(f,low)?.actualDamage>0);assert.equal(f.controller.complete,false);assert.equal(f.controller.snapshot.damageDealt,0);
 const retry=f.shoot('arrow',true);f.until(()=>f.controller.complete);assert.equal(f.controller.snapshot.lastDamage,damage(f,retry).actualDamage);assert.equal(f.run.completed.has('arc'),true);
});

test('zero-damage high arc cannot borrow a later low-arc hit',()=>{
 const f=fixture(),original=f.controller.target.multipliers.pierce;f.controller.target.multipliers.pierce=0;
 const high=f.shoot('arrow',true);f.tick(359);assert.equal(damage(f,high).actualDamage,0);assert.equal(f.controller.complete,false);
 f.controller.target.multipliers.pierce=original;const low=f.shoot();f.tick(119);assert.ok(damage(f,low)?.actualDamage>0);assert.equal(f.controller.complete,false);
 f.shoot('arrow',true);f.until(()=>f.controller.complete);
});

test('blocked high arc cannot borrow later allied damage',()=>{
 const f=fixture();f.fill();const high=f.shoot('arrow',true);f.tick(419);assert.ok(contact(f,high));assert.equal(damage(f,high),undefined);
 const point=f.controller.targetPoint(),ally=f.b.createUnit('archer',{team:'good'});
 const p=f.b.queueProjectile({kind:'standard_arrow',source:ally,team:'good',x:point.x-12,y:point.y,vx:4,vy:0,impactDamage:25});
 f.until(()=>damage(f,p));assert.ok(damage(f,p).actualDamage>0);assert.equal(f.controller.complete,false);assert.equal(f.controller.snapshot.damageDealt,0);
});

test('counter first stage cannot borrow ice damage after a blocked Basic Arrow',()=>{
 const f=fixture(3);f.fill();const basic=f.shoot();f.tick(419);assert.ok(contact(f,basic));assert.equal(damage(f,basic),undefined);
 const ice=f.shoot('iceArrow');f.tick(359);assert.ok(damage(f,ice)?.actualDamage>0);assert.equal(f.controller.stage,'waiting');assert.equal(f.controller.snapshot.lastDamage,0);
 const retry=f.shoot();f.until(()=>f.controller.stage==='counter');assert.equal(f.controller.snapshot.lastDamage,damage(f,retry).actualDamage);
 f.tick(60);f.shoot('iceArrow');f.until(()=>f.controller.complete);
});

test('counter second stage cannot borrow Basic Arrow damage after all effects of a blocked Ice Arrow end',()=>{
 const f=fixture(3);f.shoot();f.tick(359);assert.equal(f.controller.stage,'counter');const resisted=f.controller.snapshot.lastDamage;
 f.fill();const ice=f.shoot('iceArrow');f.tick(419);assert.ok(contact(f,ice));assert.equal(damage(f,ice),undefined);assert.equal(f.b.reactiveElements.length,0);assert.equal(f.controller.complete,false);
 const basic=f.shoot();f.tick(119);assert.ok(damage(f,basic)?.actualDamage>0);assert.equal(f.controller.complete,false);assert.equal(f.controller.snapshot.lastDamage,resisted);
 f.shoot('iceArrow');f.until(()=>f.controller.complete);
});

test('blocked Ice Arrow can complete from its own later real reactive pulse',()=>{
 const f=fixture(3);f.shoot();f.tick(359);assert.equal(f.controller.stage,'counter');
 f.fill(30);const ice=f.shoot('iceArrow');f.until(()=>contact(f,ice));assert.equal(f.controller.complete,false);assert.equal(damage(f,ice),undefined);
 f.until(()=>f.controller.complete);const pulse=f.events.find(e=>e.type==='damage'&&e.source?.kind==='reactive_ice'&&e.source.source===ice&&e.actualDamage>0);
 assert.ok(pulse);assert.ok(pulse.tick>contact(f,ice).tick+1);assert.equal(f.controller.snapshot.lastDamage,pulse.actualDamage);assert.equal(damage(f,ice),undefined);
});

test('damage events preserve nominal amount and identify only HP actually removed, including protected targets',()=>{
 const f=fixture(0),target=f.controller.target,source=f.b.hero;target.hp=7;
 assert.equal(f.b.queueImpact({source,target,amount:99}).status,'accepted');f.tick();
 const overkill=f.events.find(e=>e.type==='damage'&&e.target===target);assert.equal(overkill.source,source);assert.equal(overkill.damage,99);assert.equal(overkill.actualDamage,7);assert.equal(f.controller.complete,false);
 const heroHp=f.b.hero.hp;assert.equal(f.b.queueImpact({source:target,target:f.b.hero,amount:50}).status,'accepted');f.tick();
 const protectedHit=f.events.find(e=>e.type==='damage'&&e.target===f.b.hero);assert.equal(protectedHit.damage,50);assert.equal(protectedHit.actualDamage,0);assert.equal(f.b.hero.hp,heroHp);
});
