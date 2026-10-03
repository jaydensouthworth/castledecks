import test from 'node:test';
import assert from 'node:assert/strict';
import {createDragonCounterGuide,DRAGON_COUNTER_TIMING} from '../site/dist/dragon-counter-guide.mjs';
import {drawElementalNotice} from '../site/dist/elemental-feedback.mjs';
import {CampaignBattle} from '../site/dist/engine/first-battle.mjs';
import {seededRandom} from '../site/dist/engine/combat.mjs';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
const target=(type='dragon_scout_fire')=>({type,team:'bad',x:1200,y:250,height:40,hp:208,dead:false,destroyed:false,multipliers:{pierce:.1,fire:.01,ice:4}});
const event=(unit=target(),tick=0)=>({type:'hit',target:unit,tick,projectile:{kind:'hero_arrow',heroShot:true,team:'good'}});
function trace(){const calls=[];const ctx=new Proxy({},{get:(_,name)=>(...args)=>{for(const x of args)if(typeof x==='number')assert.ok(Number.isFinite(x));calls.push({name,args});},set:()=>true});return {ctx,calls};}

test('Fire, Ice and Poison dragons recommend their actual stronger counter',()=>{
 for(const [kind,multipliers,advice] of [
  ['dragon_scout_fire',{pierce:.1,fire:.01,ice:4},'Try Ice Arrow'],
  ['dragon_scout_ice',{pierce:.1,fire:4,ice:.01},'Try Fire Arrow'],
  ['dragon_scout_poison',{pierce:.2,fire:1,ice:.1},'Try Fire Arrow'],
 ]){const unit={...target(kind),multipliers};const cue=createDragonCounterGuide()(event(unit));assert.equal(cue.advice,advice);assert.equal(cue.text,'ARROW RESISTANCE');assert.equal(cue.life,70);assert.equal(cue.y,210);}
});

test('coaching follows changed live multipliers and suppresses advice when neither counter is stronger',()=>{
 const unit=target();unit.multipliers={pierce:.1,fire:3,ice:2};assert.equal(createDragonCounterGuide()(event(unit)).advice,'Try Fire Arrow');
 unit.multipliers={pierce:.2,fire:.1,ice:.1};assert.equal(createDragonCounterGuide()(event(unit)),null);
 unit.multipliers.pierce=1;unit.multipliers.fire=4;assert.equal(createDragonCounterGuide()(event(unit)),null);
});

test('per-target twelve-second cooldown and three-second global spacing avoid hit spam',()=>{
 const guide=createDragonCounterGuide(),a=target(),b=target(),c=target();
 assert.ok(guide(event(a,0)));assert.equal(guide(event(a,30)),null);assert.equal(guide(event(b,98)),null);
 assert.ok(guide(event(b,99)));assert.ok(guide(event(c,198)));
 assert.equal(guide(event(a,DRAGON_COUNTER_TIMING.perTarget-1)),null);assert.ok(guide(event(a,DRAGON_COUNTER_TIMING.perTarget)));
 assert.ok(DRAGON_COUNTER_TIMING.life<DRAGON_COUNTER_TIMING.global,'at most one coach panel from this guide remains visible');
});

test('a new guide resets presentation cooldown for the next battle without touching actors',()=>{
 const unit=target(),guide=createDragonCounterGuide();assert.ok(guide(event(unit,400)));assert.equal(guide(event(unit,410)),null);
 assert.ok(createDragonCounterGuide()(event(unit,0)));
});

test('only real living hostile dragon player Basic hits qualify',()=>{
 for(const mutate of [e=>e.type='damage',e=>e.type='projectile-hit',e=>e.projectile.kind='standard_arrow',e=>e.projectile.kind='fire_arrow',e=>e.projectile.heroShot=false,e=>e.projectile.team='bad',e=>e.target.team='good',e=>e.target.type='air',e=>e.target.type='grunt',e=>e.target.hp=0,e=>e.target.dead=true,e=>e.target.destroyed=true,e=>e.target.x=NaN,e=>e.target.y=Infinity,e=>e.tick=NaN,e=>e.tick=-1,e=>e.target.multipliers.pierce=NaN]){const e=event();mutate(e);assert.equal(createDragonCounterGuide()(e),null);}
 for(const e of [null,{},undefined])assert.equal(createDragonCounterGuide()(e),null);
});

test('frozen events and targets are not mutated',()=>{
 const unit=target();Object.freeze(unit.multipliers);Object.freeze(unit);const e=event(unit);Object.freeze(e.projectile);Object.freeze(e);
 const before=JSON.stringify(e);assert.ok(createDragonCounterGuide()(e));assert.equal(JSON.stringify(e),before);
});

test('two-line advice uses finite fixed-screen rendering and expires normally',()=>{
 const cue=createDragonCounterGuide()(event()),{ctx,calls}=trace();
 assert.equal(drawElementalNotice(ctx,cue,10,.27),true);
 assert.ok(calls.some(c=>c.name==='fillRect'&&c.args[2]===132&&c.args[3]===30));
 assert.ok(calls.some(c=>c.name==='fillText'&&c.args[0]==='ARROW RESISTANCE'));
 assert.ok(calls.some(c=>c.name==='fillText'&&c.args[0]==='Try Ice Arrow'));
 assert.equal(calls.filter(c=>c.name==='save').length,calls.filter(c=>c.name==='restore').length);
 assert.equal(drawElementalNotice(ctx,cue,70,.27),false);
});

test('observing and drawing real Basic hits leaves complete engine state and RNG unchanged',()=>{
 function run(show){const guide=createDragonCounterGuide(),notices=[],{ctx}=trace();let randomCalls=0;const rng=seededRandom(48);
  const b=new CampaignBattle({level:16,random:()=>{randomCalls++;return rng();},onEvent:e=>{if(show){const n=guide(e);if(n)notices.push(n);}}});
  const unit=b.createUnit('fireDragon');unit.x=1100;unit.y=400;b.updateGeometry(unit);
  for(let i=0;i<600;i++){
   if(i%40===0)b.queueProjectile({kind:'hero_arrow',source:b.hero,team:'good',x:unit.x-10,y:unit.y,vx:2,vy:0,skill:b.profile.skills[0]});
   b.step();if(show)for(const n of notices)drawElementalNotice(ctx,n,b.tick,.27);
  }
  return {randomCalls,stats:b.stats,gold:b.profile.gold,xp:b.profile.xp,rank:b.profile.rank,tick:b.tick,outcome:b.outcome,skills:b.profile.skills.map(s=>[s.id,s.rank,s.xp,s.cooldown]),actors:[...b.goodTeam,...b.badTeam].map(u=>[u.type,u.hp,u.x,u.y,u.vx,u.vy,u.actionMode,u.effects.effects.map(e=>[e.kind,e.duration])]),projectiles:b.projectiles.map(p=>[p.kind,p.x,p.y,p.vx,p.vy,p.active]),notices:show?notices.length:undefined};
 }
 const shown=run(true),hidden=run(false);assert.ok(shown.notices>0,'actual hit event was exercised');delete shown.notices;delete hidden.notices;assert.deepEqual(shown,hidden);
});

test('current full UI hooks real Basic hit into the existing resistance renderer',async t=>{
 const ui=await loadGameUI(t);ui.click('start');const b=ui.battle;
 b.enemies.step=()=>null;b.friendlyQueue.step=()=>null;
 const unit=b.createUnit('fireDragon');unit.x=950;unit.y=400;unit.step=()=>{};b.updateGeometry(unit);
 const p=b.queueProjectile({kind:'hero_arrow',source:b.hero,team:'good',x:930,y:401,vx:4,vy:0,skill:b.profile.skills[0]});p.step();
 const canvas=ui.get('battlefield');canvas.captureDraws=true;canvas.drawCalls=[];ui.frames();
 assert.ok(canvas.drawCalls.some(c=>c.name==='fillText'&&c.args[0]==='ARROW RESISTANCE'));
 assert.ok(canvas.drawCalls.some(c=>c.name==='fillText'&&c.args[0]==='Try Ice Arrow'));
 ui.frames(75);canvas.drawCalls=[];ui.frames();assert.equal(canvas.drawCalls.some(c=>c.name==='fillText'&&c.args[0]==='Try Ice Arrow'),false);
});
