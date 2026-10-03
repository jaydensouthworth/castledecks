import test from 'node:test';
import assert from 'node:assert/strict';
import {getCardInsights,getRankPreview} from '../site/dist/armory-insights.mjs';
import {SKILLS,PlayerProfile,serializeProfile} from '../site/dist/engine/progression.mjs';
import {COMPANIONS} from '../site/dist/engine/recruitment.mjs';
import {buildArmoryRecords} from '../site/dist/armory-catalog-data.mjs';
import {createArmorySnapshot} from '../site/dist/armory-catalog-model.mjs';
import {troopStats,heroArrowBaseDamage} from '../site/dist/engine/combat.mjs';
import {laterEnemyStats,AirFighter,DragonScoutFire,DragonScoutIce,DragonScoutPoison,FlagFireDemon,FlagIceDemon} from '../site/dist/engine/later-enemies.mjs';
import {FlagPriest,FlagArcher,FlagTrebuchet} from '../site/dist/engine/ranged-troop.mjs';
import {GorathCompanion} from '../site/dist/engine/companions.mjs';
import {FireArrow,IceArrow,PierceArrow,BombArrow,FlakBombSpell,GroundWaveSpell,SkyFallSpell,Comet,ThunderArrow,ThunderCloudSpell,PoisonArrow} from '../site/dist/engine/special-projectiles.mjs';
const records=buildArmoryRecords(SKILLS,COMPANIONS,{});
const world=()=>({width:2000,goodHomeBoundary:200,badHomeBoundary:1800,elevationAt:()=>400,rotationAt:()=>0,gravity:.3,goodTeam:[],badTeam:[],airUnits:[],structures:[]});
const options=rank=>({rank,world:world(),random:()=>.5,x:100,y:100,vx:0,vy:0,height:50,width:20,friendFlag:{x:100},enemyFlag:{x:1900}});
const value=(facts,key)=>{const metric=facts.metrics.find(metric=>metric.key===key);assert.ok(metric,`${facts.id} is missing ${key}`);return metric.value;};
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} differs from ${expected}`);

test('all 26 collection cards have finite distinct compare-safe facts at every skill rank and difficulty',()=>{
 assert.equal(records.length,26);
 const definitions=new Map();
 for(const difficulty of ['easy','medium','hard','insane'])for(let rank=0;rank<=10;rank++)for(const record of records){
  const facts=getCardInsights(record,{rank,heroRank:rank+1,difficulty});
  assert.equal(facts.id,record.id);assert.ok(facts.metrics.length>=2);assert.ok(facts.tactics.length>0);assert.ok(facts.notes.length>0);
  assert.equal(new Set(facts.metrics.map(metric=>metric.key)).size,facts.metrics.length);
  for(const metric of facts.metrics){
   assert.equal(typeof metric.value,'number');assert.ok(Number.isFinite(metric.value));assert.ok(metric.value>=0);
   const definition=[metric.label,metric.unit,metric.scope];
   if(definitions.has(metric.key))assert.deepEqual(definition,definitions.get(metric.key));else definitions.set(metric.key,definition);
  }
 }
});

test('rank previews never mutate profiles, invoke randomness, buy items, or apply progression',()=>{
 const profile=new PlayerProfile('Read-only fixture');profile.gold=40000;const fire=profile.addSkill('fireArrow');fire.rank=4;fire.threshold=500;fire.xp=77;
 profile.companionOwned.add('gorath');profile.companionId='gorath';profile.rank=8;
 const before=serializeProfile(profile),snapshot={...createArmorySnapshot(profile),heroRank:profile.rank,difficulty:profile.difficulty};
 const oldRandom=Math.random;Math.random=()=>{throw new Error('Stats cannot call random');};
 try{
  for(const record of records){getCardInsights(record,{rank:4});getRankPreview(record,snapshot,10);}
 }finally{Math.random=oldRandom;}
 assert.equal(serializeProfile(profile),before);assert.equal(fire.cooldown,SKILLS.fireArrow.cooldown);assert.equal(fire.rank,4);assert.equal(fire.xp,77);
 const preview=getRankPreview('fireArrow',snapshot);assert.equal(preview.current.rank,4);assert.equal(preview.preview.rank,5);assert.equal(preview.rank,5);assert.ok(preview.changes.some(change=>change.key==='impactDamage'));
});

test('skill ranks cap at 10, hero ranks cap at 26, and unknown records never invent combat stats',()=>{
 assert.equal(getCardInsights('fireArrow',{rank:-3}).rank,0);assert.equal(getCardInsights('fireArrow',{rank:99}).rank,10);
 assert.equal(getCardInsights('gorath',{heroRank:99}).heroRank,26);assert.equal(getCardInsights('grunt',{difficulty:'unknown'}).difficulty,'medium');
 assert.equal(getRankPreview('fireArrow',{rank:10}).isMax,true);assert.equal(getRankPreview('fireArrow',{rank:10}).changes.length,0);
 assert.equal(getRankPreview('gorath',{heroRank:26}).isMax,true);
 for(const id of ['fixture-1','constructor','__proto__',undefined]){
  const facts=getCardInsights({id});assert.deepEqual(facts.metrics,[]);assert.equal(facts.progression.kind,'none');assert.deepEqual(getRankPreview({id}).changes,[]);
 }
});

test('skill cooldown and deployment facts read the live catalog rather than duplicate economy data',()=>{
 for(const item of records.filter(item=>item.kind==='skill')){
  const facts=getCardInsights(item),entry=SKILLS[item.id];assert.equal(value(facts,'reloadSeconds'),entry.cooldown/66);
  if(entry.summon){assert.equal(value(facts,'summonGold'),entry.summon.cost);assert.equal(value(facts,'squadUnits'),entry.summon.amount);assert.equal(value(facts,'reserveCost'),entry.summon.amount*entry.summon.population);}
 }
});

test('ordinary and later recruit health and ground movement match the live stat functions',()=>{
 const later={air:'air',poisonDragon:'dragon_scout_poison',fireDragon:'dragon_scout_fire',iceDragon:'dragon_scout_ice',fireDemon:'fire_demon',iceDemon:'ice_demon'};
 for(const difficulty of ['easy','medium','hard','insane'])for(let rank=0;rank<=10;rank++)for(const item of records.filter(item=>SKILLS[item.id]?.summon)){
  const facts=getCardInsights(item,{rank,difficulty}),expected=later[item.id]?laterEnemyStats(later[item.id],{rank,difficulty}):troopStats(item.id,{rank,difficulty});
  assert.equal(value(facts,'perUnitHp'),expected.maxHp);
  if(!['air','poisonDragon','fireDragon','iceDragon'].includes(item.id))close(value(facts,'perUnitSpeed'),expected.speed);
  if(['grunt','tallGrunt','mount','fireDemon','iceDemon'].includes(item.id))close(value(facts,'perUnitMeleeDamage'),expected.damage);
  if(['archer','trebuchet'].includes(item.id))close(value(facts,'perUnitProjectileDamage'),expected.damage);
 }
});

test('archer, priest and siege extra stats agree with their actual rank-sensitive fields',()=>{
 for(let rank=0;rank<=10;rank++){
  const archer=new FlagArcher(options(rank)),priest=new FlagPriest({...options(rank),random:()=>0}),maxPriest=new FlagPriest({...options(rank),random:()=>.999999}),siege=new FlagTrebuchet(options(rank));
  const a=getCardInsights('archer',{rank}),p=getCardInsights('priest',{rank}),s=getCardInsights('trebuchet',{rank});
  assert.equal(value(a,'shotAimTime'),archer.shotAimTime/66);assert.equal(value(s,'shotAimTime'),siege.shotAimTime/66);
  assert.equal(value(p,'healBasePower'),priest.healPower);assert.equal(value(p,'healCooldown'),priest.healCooldownMax/33);
  assert.equal(value(p,'healRangeMin'),priest.healRange);assert.equal(value(p,'healRangeMax'),maxPriest.healRange);
  assert.ok(siege.immunities.has('heal'));assert.match(s.notes.join(' '),/cannot heal|immune to healing/i);
 }
});

test('fire, ice and piercing direct formulas match the active projectile classes for ranks 0–10',()=>{
 for(let rank=0;rank<=10;rank++){
  for(const [id,Class] of [['fireArrow',FireArrow],['iceArrow',IceArrow],['pierceArrow',PierceArrow]]){
   const projectile=new Class(options(rank)),facts=getCardInsights(id,{rank});assert.equal(value(facts,'impactDamage'),projectile.impactDamage);
   if(id==='iceArrow'){close(value(facts,'slowPercent'),(1-projectile.slowFactor)*100);assert.equal(value(facts,'slowDuration'),projectile.frostDuration/33);}
  }
 }
});

test('bomb random endpoints and flak charge counts match actual rank setters',()=>{
 for(let rank=0;rank<=10;rank++){
  const low=new BombArrow({...options(rank),random:()=>0}),high=new BombArrow({...options(rank),random:()=>.999999}),bomb=getCardInsights('bombArrow',{rank});
  assert.equal(value(bomb,'blastDamageMin'),low.bombDamage);assert.equal(value(bomb,'blastDamageMax'),high.bombDamage);assert.equal(value(bomb,'blastRadius'),low.bombRadius);
  const actual=new FlakBombSpell(options(rank)),flak=getCardInsights('flakArrow',{rank});assert.equal(value(flak,'blastDamageMax'),actual.maxDamage);assert.equal(value(flak,'flakBursts'),actual.charges);assert.equal(value(flak,'blastRadius'),actual.radius);
 }
});

test('wave facts include the actual extra terminal pulse and correct rank formulas',()=>{
 for(let rank=0;rank<=10;rank++)for(const [id,element] of [['fireWave','fire'],['iceWave','ice'],['bombWave','bomb'],['healWave','heal']]){
  const spell=new GroundWaveSpell({...options(rank),element}),facts=getCardInsights(id,{rank});
  if(element==='fire'||element==='ice')assert.equal(value(facts,'waveDamage'),spell.impactDamage);
  if(element==='bomb')assert.equal(value(facts,'blastDamageMax'),spell.maxDamage);
  if(element==='heal')assert.equal(value(facts,'healBasePower'),spell.maxHeal);
  if(element==='ice'){close(value(facts,'slowPercent'),(1-spell.slowFactor)*100);assert.equal(value(facts,'slowDuration'),spell.frostDuration/33);}
  for(let tick=0;tick<100&&!spell.dead;tick++)spell.step();
  assert.ok(spell.dead);assert.equal(value(facts,'wavePulses'),spell.strikes);
 }
});

test('meteor uses its carrier formula; comet uses its actual falling-object formula',()=>{
 for(let rank=0;rank<=10;rank++){
  const meteor=new SkyFallSpell({...options(rank),element:'meteor'}),m=getCardInsights('meteorArrow',{rank});assert.equal(value(m,'blastDamageMax'),meteor.maxDamage);assert.equal(value(m,'blastRadius'),meteor.radius);
  const comet=new Comet(options(rank)),c=getCardInsights('cometArrow',{rank});assert.equal(value(c,'blastDamageMax'),comet.maxDamage);assert.equal(value(c,'blastRadius'),comet.blastRadius);assert.equal(value(c,'slowDuration'),comet.frostDuration/33);close(value(c,'slowPercent'),(1-comet.slowFactor)*100);
 }
});

test('Thunder rank preview honestly remains unchanged because the active launcher omits rank',()=>{
 for(let rank=0;rank<=10;rank++){
  const carrier=new ThunderArrow(options(rank));assert.equal(carrier.rank,0);
  const spell=new ThunderCloudSpell({...options(carrier.rank)}),facts=getCardInsights('thunderArrow',{rank});assert.equal(value(facts,'lightningDamage'),spell.lightningDamage);assert.equal(value(facts,'cloudDuration'),spell.maxDuration/66);
  assert.deepEqual(getRankPreview('thunderArrow',{rank}).changes,[]);assert.match(facts.notes.join(' '),/does not pass skill rank/);
 }
});

test('aerial attack facts use actual projectile attributes instead of unused unit damage',()=>{
 for(let rank=0;rank<=10;rank++){
  const air=new AirFighter(options(rank));assert.equal(value(getCardInsights('air',{rank}),'perUnitProjectileDamage'),air.projectileAttributes().impactDamage);
  for(const [id,Class,Projectile] of [['fireDragon',DragonScoutFire,FireArrow],['iceDragon',DragonScoutIce,IceArrow],['poisonDragon',DragonScoutPoison,PoisonArrow]]){
   const unit=new Class(options(rank)),shot=new Projectile({...options(rank),...unit.projectileAttributes()}),facts=getCardInsights(id,{rank});assert.equal(value(facts,'perUnitProjectileDamage'),shot.impactDamage);
   if(id==='poisonDragon'){assert.equal(value(facts,'poisonDuration'),shot.poisonDuration/33);assert.equal(value(facts,'poisonInitialSickness'),Math.floor(shot.impactDamage*.5));}
  }
 }
});

test('Gorath scales from hero rank, not skill rank or difficulty, and preserves separate-slot mechanics',()=>{
 for(let heroRank=1;heroRank<=26;heroRank++){
  const unit=new GorathCompanion(options(heroRank)),facts=getCardInsights('gorath',{rank:10,heroRank,difficulty:'insane'});
  assert.equal(value(facts,'perUnitHp'),unit.maxHp);assert.equal(value(facts,'perUnitMeleeDamage'),unit.damage);assert.equal(value(facts,'signatureDamage'),unit.damage*1.5);
  assert.equal(value(facts,'pierceTaken'),unit.multipliers.pierce);assert.equal(value(facts,'bluntTaken'),unit.multipliers.blunt);assert.equal(facts.progression.kind,'hero');
  assert.deepEqual(facts.metrics,getCardInsights('gorath',{rank:0,heroRank,difficulty:'easy'}).metrics);
 }
 const preview=getRankPreview('gorath',{heroRank:5,rank:0});assert.equal(preview.preview.heroRank,6);assert.equal(preview.preview.rank,0);assert.equal(preview.changes.find(change=>change.key==='perUnitHp').delta,80);assert.equal(preview.changes.find(change=>change.key==='signatureDamage').delta,9);
});

test('returned data is independent and comparison never conflates hits, blast totals or healing with DPS',()=>{
 const first=getCardInsights('iceDragon',{rank:2});first.metrics[0].value=-1;first.notes.push('mutated');
 const second=getCardInsights('iceDragon',{rank:2});assert.ok(second.metrics[0].value>=0);assert.ok(!second.notes.includes('mutated'));
 for(const record of records)for(const metric of getCardInsights(record).metrics)assert.ok(!/dps/i.test(metric.key+metric.label));
 const preview=getRankPreview('grunt',{rank:1},5);for(const change of preview.changes){assert.equal(change.to-change.from,change.delta);assert.equal(change.value,change.to);}
});

 test('Basic Arrow is a supported collection card with engine-derived base damage',()=>{for(let rank=0;rank<=10;rank++){const facts=getCardInsights('arrow',{rank});assert.equal(value(facts,'impactDamage'),heroArrowBaseDamage(rank));assert.equal(value(facts,'reloadSeconds'),SKILLS.arrow.cooldown/66);assert.match(facts.notes.join(' '),/Already owned/);}});

test('demon rank previews explicitly disclose that the live melee action awards no skill XP',()=>{
 for(const [id,Class] of [['fireDemon',FlagFireDemon],['iceDemon',FlagIceDemon]]){
  let xp=0;const unit=new Class({...options(0),skill:{addXP(amount){xp+=amount;}}});
  unit.attacking=[{x:110,y:100,hp:500,isFighter:true,team:'bad',multipliers:{fire:1},garrisoned:()=>false}];unit.attackEngagementTarget();
  assert.equal(xp,0);assert.equal(unit.pendingImpacts.length,1);
  const facts=getCardInsights(id);assert.match(facts.progression.description,/awards no skill XP/);assert.match(facts.notes.join(' '),/awards no skill XP/);
 }
});

test('player-facing facts avoid implementation-field wording without changing damage',()=>{
 for(const id of ['air','poisonDragon','grunt']){const text=getCardInsights(id).notes.join(' ');assert.doesNotMatch(text,/unit damage field|effect-queue|poison-resistance multiplier/);}
 assert.match(getCardInsights('air').notes.join(' '),/30 base damage at every rank/);assert.match(getCardInsights('poisonDragon').notes.join(' '),/ignores poison resistance/);
});
