import test from 'node:test';
import assert from 'node:assert/strict';
import {FirstBattle} from '../site/dist/engine/first-battle.mjs';
import {PlayerProfile} from '../site/dist/engine/progression.mjs';
import {attackTeam,protectsAlliedFlyer} from '../site/dist/engine/attack-allegiance.mjs';
import {collectProjectileTargets} from '../site/dist/engine/projectile-targets.mjs';
import {sampleStandardHit} from '../site/dist/engine/ballistics.mjs';
import {impactEffect} from '../site/dist/engine/effects.mjs';
import {createSpecialSpell,createStatusEffect,ReactiveElement,spawnStructureShrapnel} from '../site/dist/engine/special-projectiles.mjs';
import {createSupportEffect} from '../site/dist/engine/ranged-troop.mjs';

const flyers=['air','poisonDragon','fireDragon','iceDragon'];
function fixture(type='air',{team='good',above=false}={}){
  const profile=new PlayerProfile();profile.gold=100000;
  const b=new FirstBattle({profile,random:()=>.5});
  b.elevationAt=()=>500;b.maxElevationAt=()=>above?450:100;b.rotationAt=()=>0;
  const target=b.createUnit(type,{team,rank:2});
  target.x=600;target.y=300;b.updateGeometry(target);
  return {b,target};
}
const settle=target=>{for(let i=0;i<3;i++)target.effects.step();};
const shoot=(b,kind,options={})=>b.queueProjectile({kind,source:b.hero,team:'good',x:500,y:300,vx:20,vy:0,gravity:0,rank:2,...options});
const snapshot=u=>({hp:u.hp,speed:u.speedFactor,action:u.actionMode,effects:u.effects.effects.map(e=>e.kind)});

test('only friendly flyers are protected; neutral descendants resolve source before a struck structure owner',()=>{
  const flyer={team:'good',airUnit:true},ground={team:'good',airUnit:false};
  const hero={team:'good'},enemy={team:'bad'},child={team:'neutral',source:{source:hero},owner:enemy};
  assert.equal(attackTeam(child),'good');assert.equal(protectsAlliedFlyer(child,flyer),true);
  assert.equal(protectsAlliedFlyer(child,ground),false);
  assert.equal(protectsAlliedFlyer(enemy,flyer),false);
  assert.equal(protectsAlliedFlyer({team:'neutral'},flyer),false);
  assert.equal(protectsAlliedFlyer(hero,{team:'bad',airUnit:true}),false);
  assert.equal(protectsAlliedFlyer(hero,{team:'good',isAirUnit:()=>true}),true);
  const cycle={};cycle.source=cycle;cycle.owner=hero;assert.equal(attackTeam(cycle),'good');
});

for(const type of flyers)for(const above of [false,true])test(`${type}: hero arrow passes through ally in ${above?'upper air':'terrain'} target branch and reaches an enemy`,()=>{
  const {b,target}=fixture(type,{above}),enemy=b.createUnit('air');
  enemy.x=850;enemy.y=300;b.updateGeometry(enemy);
  const p=shoot(b,'hero_arrow'),before=snapshot(target);
  assert.equal(collectProjectileTargets({...p,x:590},b).includes(target),false);
  for(let i=0;i<20&&p.active;i++)p.step();
  assert.equal(p.reason,'target');assert.ok(p.x>target.x+100);
  settle(target);settle(enemy);
  assert.deepEqual(snapshot(target),before);assert.ok(enemy.hp<enemy.maxHp);
});

for(const kind of ['hero_arrow','standard_arrow','fire_arrow','ice_arrow','poison_arrow','pierce_arrow','bomb_arrow','trebuchet_ammo','fire_wave_arrow','ice_wave_arrow','bomb_wave_arrow','heal_wave_arrow','bounce_arrow','sky_marker','meteor','comet','fire_ball','ice_ball'])test(`${kind}: protected flyer in stale cache cannot intercept, deflect, or spend projectile momentum`,()=>{
  const {b,target}=fixture();const p=shoot(b,kind,{x:target.x-40}),before=snapshot(target);
  const cache=p.cache??p.targetCache;cache.targets=[target];cache.timer=100;cache.above=false;
  const momentum=p.momentum;p.step();
  assert.equal(p.active,true);assert.equal(p.deflections,0);assert.equal(p.momentum,momentum);
  assert.equal(p.critical,false);assert.deepEqual(snapshot(target),before);
  assert.equal(b.spells.length,0);assert.equal(b.reactiveElements.length,0);
});

test('standalone standard collision sampling also skips a protected flyer and chooses the next real target',()=>{
  const {b,target}=fixture(),enemy=b.createUnit('air');enemy.x=target.x;enemy.y=target.y;b.updateGeometry(enemy);
  const arrow={team:'good',x:600,y:300,midpoint:{x:600,y:300}};
  assert.equal(sampleStandardHit(arrow,500,[target,enemy]).target,enemy);
});

for(const kind of ['bomb','flak_bomb','fire_wave','ice_wave','bomb_wave','thunder_cloud'])test(`${kind}: player splash cannot hurt, slow, react, or consume status slots on allied flyers`,()=>{
  const {b,target}=fixture();const ground=b.createUnit('grunt',{team:'good'});
  ground.x=target.x;ground.y=target.y;b.updateGeometry(ground);
  const spell=createSpecialSpell({kind,x:600,y:kind==='thunder_cloud'?200:300,rank:2,source:{source:b.hero},world:b,random:()=>.5});
  const before=snapshot(target);
  spell.testHitObjects(600,300);settle(target);settle(ground);
  assert.deepEqual(snapshot(target),before);assert.ok(ground.hp<ground.maxHp,'ground friendly fire remains');
});

for(const kind of ['meteor','comet','fire_ball'])test(`${kind}: player collateral protects flyers and cannot farm skill XP from them`,()=>{
  const {b,target}=fixture();let earned=0;
  const p=shoot(b,kind,{source:{source:b.hero},team:'neutral',x:600,y:300,vx:0,vy:0,skill:{addXP:n=>{earned+=n;}}});
  const before=snapshot(target);p.impact(null);settle(target);
  assert.deepEqual(snapshot(target),before);assert.equal(earned,0);
});

for(const element of ['fire','ice'])test(`${element}: player sticky fields retain attribution; hostile fields and friendly ground damage remain`,()=>{
  const {b,target}=fixture();const ground=b.createUnit('grunt',{team:'good'});ground.x=600;ground.y=300;b.updateGeometry(ground);
  const p=shoot(b,`${element}_arrow`,{x:600,y:300,vx:0,vy:0});p.impact(null);
  const reactive=b.reactiveElements.at(-1),before=snapshot(target);
  assert.equal(reactive.source,p);assert.equal(attackTeam(reactive),'good');
  assert.equal(reactive.targets.includes(target),false);
  reactive.damageTarget(target);reactive.damageTarget(ground);settle(target);settle(ground);
  assert.deepEqual(snapshot(target),before);assert.ok(ground.hp<ground.maxHp);
  const hostile=new ReactiveElement({element,x:600,y:300,source:{team:'bad'},world:b,damage:20,random:()=>.5});
  hostile.damageTarget(target);settle(target);assert.ok(target.hp<target.maxHp);
});

test('allied ice wave neither cancels enemy fire nor consumes a status slot',()=>{
  const {b,target}=fixture();const existing=createStatusEffect({kind:'fire',target,duration:100,damage:1});target.effects.add(existing);
  const wave=createSpecialSpell({kind:'ice_wave',source:b.hero,x:600,y:300,world:b,random:()=>.5});
  wave.testHitObjects(600,300);assert.deepEqual(target.effects.effects,[existing]);
});

for(const kind of ['hero_arrow','standard_arrow','fire_arrow','ice_arrow','poison_arrow'])test(`${kind}: hostile attacks still damage allied flyers`,()=>{
  const {b,target}=fixture();const p=shoot(b,kind,{source:{team:'bad'},team:'bad',x:560});
  for(let i=0;i<8&&p.active;i++)p.step();settle(target);
  assert.equal(p.active,false);assert.ok(target.hp<target.maxHp);
  if(kind==='ice_arrow')assert.ok(target.speedFactor<1);
  if(kind==='poison_arrow')assert.ok(target.effects.effects.some(e=>e.kind==='poison'));
});

test('enemy flak, waves and thunder remain harmful to allied flyers',()=>{
  for(const kind of ['bomb','flak_bomb','fire_wave','ice_wave','bomb_wave','thunder_cloud']){
    const {b,target}=fixture();const spell=createSpecialSpell({kind,source:{team:'bad'},x:600,y:kind==='thunder_cloud'?200:300,world:b,random:()=>.5});
    spell.testHitObjects(600,300);settle(target);assert.ok(target.hp<target.maxHp,kind);
  }
});

test('healing wave and priest heal still restore allied flyers',()=>{
  for(const type of flyers){const {b,target}=fixture(type);target.hp-=60;
    const wave=createSpecialSpell({kind:'heal_wave',team:'good',source:b.hero,x:600,y:300,world:b,random:()=>0});
    wave.testHitObjects(600,300);settle(target);assert.equal(target.hp,target.maxHp);
    target.effects.effects=[];target.hp-=20;
    target.effects.add(createSupportEffect({kind:'heal',source:{team:'good'},target,amount:20,duration:10,interval:1},{random:()=>0}));
    settle(target);assert.equal(target.hp,target.maxHp);
  }
});

test('melee/companion impact service blocks friendly flyer knockback while retaining hostile and ground impacts',()=>{
  const {b,target}=fixture(),ground=b.createUnit('grunt',{team:'good'});
  for(const source of [b.hero,b.createUnit('archer',{team:'good'}),b.createUnit('fireDragon',{team:'good'}),{team:'good',isCompanion:true}]){
    assert.equal(b.queueImpact({source,target,amount:999}).status,'protected');
  }
  const before=snapshot(target);settle(target);assert.deepEqual(snapshot(target),before);
  b.queueImpact({source:{team:'bad'},target,amount:10});settle(target);assert.equal(target.hp,before.hp-10);
  b.queueImpact({source:b.hero,target:ground,amount:10});settle(ground);assert.equal(ground.hp,ground.maxHp-10);
});

test('delayed impact rechecks protection and permits negative healing amounts',()=>{
  const {target}=fixture();let reactions=0,damageEvents=0;
  const effect=impactEffect({source:{team:'good'},target,amount:100,onReaction:()=>reactions++,onDamage:()=>damageEvents++});
  effect.step();assert.equal(target.hp,target.maxHp);assert.equal(reactions,0);assert.equal(damageEvents,0);
  target.hp-=10;impactEffect({source:{team:'good'},target,amount:-10}).step();assert.equal(target.hp,target.maxHp);
});

test('actual meteor/comet child chains and neutral enemy-structure debris keep the initiating side',()=>{
  for(const kind of ['meteor_arrow','comet_arrow']){
    const {b,target}=fixture();const carrier=shoot(b,kind,{x:600,y:490,vx:0,vy:0});carrier.impact();
    const spell=b.spells.at(-1);spell.launch();const falling=b.projectiles.find(p=>p.kind===(kind==='meteor_arrow'?'meteor':'comet'));
    assert.ok(falling);assert.equal(attackTeam(falling),'good');falling.x=600;falling.y=300;falling.impact(null);
    const children=b.projectiles.filter(p=>['fire_ball','ice_ball','sky_marker','ice_arrow'].includes(p.kind));
    assert.ok(children.length>0);for(const child of children){assert.equal(attackTeam(child),'good');assert.equal(protectsAlliedFlyer(child,target),true);}
    const requests=spawnStructureShrapnel(carrier,b.badCastle,1,60);assert.equal(requests[0].owner,b.badCastle);assert.equal(attackTeam(requests[0]),'good');
  }
});
