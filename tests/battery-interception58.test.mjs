import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createSkirmish,DEFAULT_SKIRMISH,encodeSkirmishDescriptor,decodeSkirmishDescriptor,skirmishCombatRandom,SKIRMISH_KIT} from '../site/dist/skirmish-model.mjs';
import {SkirmishBattle,SkirmishProfiles} from '../site/dist/skirmish-battle.mjs';
import {BatteryObjective,BATTERY_TARGETS,BATTERY_ESCORT} from '../site/dist/engine/battery-objective.mjs';
import {validateBattleEncounter} from '../site/dist/engine/battle-encounter.mjs';
import {troopStats} from '../site/dist/engine/combat.mjs';
import {FLAG_STATUS as FS} from '../site/dist/engine/flag-troop.mjs';
import {summonSquad} from '../site/dist/engine/progression.mjs';
const descriptor={...DEFAULT_SKIRMISH,seed:42,doctrine:'battery'};
const make=options=>new SkirmishBattle({descriptor,...options});
const targets=b=>b.badTeam.filter(u=>u.type==='trebuchet');
const destroy=units=>{for(const unit of units)unit.takeDamage(unit.hp);};
const summary=b=>{for(let i=0;i<102;i++)b.step();};
const account=b=>assert.equal(b.enemies.spawned+b.enemies.remaining+b.enemies.withdrawn,b.enemies.roster.length);
const progress=p=>[p.level,p.scene,p.highestLevel,p.highestScene];

test('58 all 144 old SK1 scenario and combat streams remain byte-for-byte equivalent',()=>{
 const fixtures=JSON.parse(fs.readFileSync(new URL('./fixtures/skirmish-legacy58.json',import.meta.url)));
 assert.equal(fixtures.length,144);
 for(const {descriptor,sha256} of fixtures){const scenario=createSkirmish(descriptor),r=skirmishCombatRandom(descriptor),combat=Array.from({length:12},r);assert.equal(createHash('sha256').update(JSON.stringify({scenario,combat})).digest('hex'),sha256,scenario.code);}
});
test('58 battery is strict optional SK1 doctrine; old default and kit are unchanged',()=>{
 const code=encodeSkirmishDescriptor(descriptor);assert.match(code,/:battery$/);assert.deepEqual(decodeSkirmishDescriptor(code),descriptor);assert.equal(DEFAULT_SKIRMISH.doctrine,'vanguard');
 for(const bad of ['battery-extra','Battery0','battery:evil'])assert.throws(()=>decodeSkirmishDescriptor(code.replace('battery',bad)));
 assert.equal(createSkirmish(descriptor).kit,SKIRMISH_KIT);
});
test('58 minimal encounter extension retains strict key and roster validation',()=>{
 const e=createSkirmish(descriptor).encounter;assert.equal(validateBattleEncounter(e).objective,'intercept-battery');
 assert.throws(()=>validateBattleEncounter({...e,objective:'free-form'}));assert.throws(()=>validateBattleEncounter({...e,extra:2}));
 for(const type of ['grunt','tallGrunt','mount','priest'])assert.throws(()=>validateBattleEncounter({...e,roster:e.roster.filter(t=>t!==type)}),/opening escort/);
 for(const n of [0,1,3])assert.throws(()=>validateBattleEncounter({...e,roster:[...e.roster.filter(t=>t!=='trebuchet'),...Array(n).fill('trebuchet')]}),/exactly two/);
});
test('58 all four landscapes and three tiers have two ordinary targets and finite mixed escorts',()=>{
 for(const biome of ['oaks','lowlands','pines','wasteland'])for(const threat of ['scout','standard','veteran'])for(const seed of [1,42,4294967295]){
  const b=new SkirmishBattle({descriptor:{...descriptor,biome,threat,seed}});assert.equal(targets(b).length,2);assert.equal(b.enemies.spawned,6);assert.equal(b.tick,0);account(b);
  for(const {type} of BATTERY_ESCORT)assert.ok(b.badTeam.some(u=>u.type===type));
  assert.equal(b.badTeam.length,6);assert.ok(b.badTeam.every(u=>[u.x,u.y,u.hp].every(Number.isFinite)));
 }
});
test('58 tick-zero opening uses real roster entries, normal stats, no cooldown or resource advance',()=>{
 const b=make(),siege=targets(b),ordinary=troopStats('trebuchet',{level:b.level,difficulty:b.profile.difficulty});
 assert.equal(b.tick,0);assert.equal(b.profile.gold,1200);assert.equal(b.friendlyQueue.population,70);assert.equal(b.friendlyQueue.queue.length,0);assert.ok(b.profile.skills.every(s=>s.cooldown===0));
 assert.deepEqual(siege.map(u=>u.x),BATTERY_TARGETS.map(t=>t.x));assert.equal(b.enemies.pending.length,0);assert.equal(b.enemies.timer,b.enemies.assemblyTicks);
 for(const u of siege){assert.equal(u.hp,ordinary.maxHp);assert.equal(u.damage,ordinary.damage);assert.equal(u.speed,ordinary.speed);assert.equal(u.shotLoadTime,200);assert.equal(u.releaseTime,160);assert.ok(u.immunities.has('convert'));}
});
test('58 preparation snapshots are immutable read-only copies with finite visible marker coordinates',()=>{
 const b=make(),before=JSON.stringify([b.tick,b.enemies.timer,b.badTeam.map(u=>[u.hp,u.actionDuration,u.x])]),p=b.objectiveProgress;
 assert.equal(p.state,'active');assert.equal(p.resolved,0);assert.equal(p.remaining,2);assert.equal(p.flagSafe,true);
 assert.ok(Object.isFrozen(p)&&Object.isFrozen(p.targets)&&p.targets.every(Object.isFrozen));
 assert.ok(b.objectiveMarkers.every(m=>[m.x,m.y,m.markerY].every(Number.isFinite)));assert.throws(()=>{p.targets[0].x=2;});
 for(let n=0;n<30;n++){void b.objectiveProgress;void b.objectiveMarkers;}assert.equal(JSON.stringify([b.tick,b.enemies.timer,b.badTeam.map(u=>[u.hp,u.actionDuration,u.x])]),before);
});
test('58 keep destruction cannot withdraw bound targets or win the challenge',()=>{
 const b=make(),marked=targets(b);b.badCastle.takeDamage(b.badCastle.hp);b.checkOutcome();assert.equal(b.outcome,null);assert.equal(b.enemies.remaining,0);assert.equal(b.enemies.withdrawn,b.enemies.roster.length-6);assert.deepEqual(targets(b),marked);account(b);
 destroy(marked);b.checkOutcome();assert.equal(b.outcome,'victory');
});
test('58 enemy flag capture and spent reserves cannot bypass live battery',()=>{
 const b=make();b.enemyFlag.status=FS.CAPTURED;b.checkOutcome();assert.equal(b.outcome,null);b.enemies.closeReserves();b.badTeam.length=0;b.checkOutcome();assert.equal(b.outcome,null);assert.equal(b.objectiveProgress.resolved,0);
});
test('58 target removal, unrelated dead siege and dead allied siege never substitute for original identities',()=>{
 const b=make(),marked=targets(b),other=b.createUnit('trebuchet'),ally=b.createUnit('trebuchet',{team:'good',rank:2});destroy([other,ally]);b.checkOutcome();assert.equal(b.objectiveProgress.resolved,0);
 for(const u of marked){b.objects.remove(u);b.badTeam.splice(b.badTeam.indexOf(u),1);}b.checkOutcome();assert.equal(b.objectiveProgress.resolved,0);assert.equal(b.outcome,null);
});
test('58 pending controller cannot win and bindings reject duplicate identities and alien targets',()=>{
 const b=make(),controller=new BatteryObjective(b),[a,c]=targets(b);assert.equal(controller.snapshot.state,'pending');assert.equal(controller.outcome(),null);
 controller.bind('battery-1',a);assert.equal(controller.snapshot.targets[1].state,'pending');assert.throws(()=>controller.bind('battery-2',a));assert.throws(()=>controller.bind('battery-1',c));assert.throws(()=>controller.bind('unknown',c));
 const other=make();assert.throws(()=>controller.bind('battery-2',targets(other)[0]));
});
test('58 binding rejects present or permanent friendly affiliation, invalid actors and absent membership',()=>{
 for(const modify of [u=>u.team='good',u=>u.permanentTeam='good',u=>u.recruited=true,u=>u.hp=0,u=>u.hp=Infinity,u=>u.x=NaN,u=>u.maxHp=Infinity,u=>u.destroyed=true,u=>u.dead=true,u=>u.type='grunt',u=>u.world=null]){
  const b=make(),controller=new BatteryObjective(b),u=targets(b)[0];modify(u);assert.throws(()=>controller.bind('battery-1',u));
 }
 const b=make(),c=new BatteryObjective(b),u=targets(b)[0];b.badTeam.splice(b.badTeam.indexOf(u),1);assert.throws(()=>c.bind('battery-1',u));
});
test('58 original hostile secured by allegiance is distinct from a hostile kill and reversible before settlement',()=>{
 const b=make(),[a,c]=targets(b);a.team='good';b.checkOutcome();assert.equal(b.objectiveProgress.secured,1);assert.equal(b.objectiveProgress.neutralized,0);assert.equal(b.objectiveProgress.targets[0].state,'secured');assert.equal(b.outcome,null);
 a.team='bad';b.checkOutcome();assert.equal(b.objectiveProgress.resolved,0);a.team='good';c.team='good';b.checkOutcome();assert.equal(b.outcome,'victory');assert.equal(b.objectiveProgress.secured,2);assert.equal(b.objectiveProgress.neutralized,0);
});
test('58 no hostile-kill credit after team change or invalid permanent team; original allied target stays secured',()=>{
 const b=make(),[a,c]=targets(b);a.team='good';destroy([a]);c.permanentTeam='good';destroy([c]);b.checkOutcome();assert.equal(b.objectiveProgress.neutralized,0);assert.equal(b.objectiveProgress.secured,1);assert.equal(b.outcome,null);
});
test('58 neutralization is identity-bound, monotonic and only settled once',()=>{
 const events=[],b=make({onEvent:e=>events.push(e.type)}),p=progress(b.profile);destroy(targets(b));b.checkOutcome();const receipt=b.outcome;
 for(let n=0;n<5;n++)b.checkOutcome();assert.equal(receipt,'victory');assert.equal(b.profile.victories,1);assert.equal(events.filter(x=>x==='outcome').length,1);assert.equal(b.finishOutcome('defeat'),false);assert.deepEqual(progress(b.profile),p);
 summary(b);const gold=b.profile.gold;summary(b);assert.equal(events.filter(x=>x==='summary').length,1);assert.equal(b.profile.gold,gold);assert.deepEqual(progress(b.profile),p);
});
test('58 both engines resolved waits for home flag recovery and explains its phase',()=>{
 const b=make();b.ownFlag.status=FS.GROUNDED;destroy(targets(b));b.checkOutcome();assert.equal(b.outcome,null);assert.equal(b.objectiveProgress.resolved,2);assert.equal(b.objectiveProgress.state,'recover-flag');assert.equal(b.objectiveProgress.flagSafe,false);
 b.ownFlag.status=FS.HELD_BY_FRIEND;b.checkOutcome();assert.equal(b.outcome,null);b.ownFlag.status=FS.AT_BASE;b.checkOutcome();assert.equal(b.outcome,'victory');
});
test('58 no-army starter can pay for normal Grunts while the resolved objective awaits a loose flag',()=>{
 const b=make();b.ownFlag.status=FS.GROUNDED;destroy(targets(b));b.checkOutcome();const s=b.profile.skills.find(s=>s.id==='grunt');assert.ok(summonSquad(s,b.profile,b.friendlyQueue,b.stats));assert.equal(b.profile.gold,1180);assert.equal(b.friendlyQueue.population,66);assert.equal(b.friendlyQueue.queue.length,4);assert.equal(b.outcome,null);
});
test('58 hero loss beats battery completion in the same complete simulation tick regardless of callback order',()=>{
 for(const reverse of [false,true]){
  const events=[],b=make({onEvent:e=>{if(e.type==='outcome')events.push(e.outcome);}});
  const acts=[()=>{destroy(targets(b));b.checkOutcome();},()=>{b.hero.takeDamage(b.hero.hp);b.checkOutcome();}];if(reverse)acts.reverse();
  for(const act of acts)b.objects.add({step:act});b.step();assert.equal(b.outcome,'defeat');assert.deepEqual(events,['defeat']);assert.equal(b.profile.victories,0);
 }
});
test('58 late spell-phase flag capture beats earlier target completion and enemy flag capture',()=>{
 const b=make();b.objects.add({step(){destroy(targets(b));b.enemyFlag.status=FS.CAPTURED;b.checkOutcome();}});b.spells.push({step(){b.ownFlag.status=FS.CAPTURED;b.checkOutcome();}});b.step();assert.equal(b.outcome,'defeat');
});
test('58 pause cannot move targets, process damage, change objective credit or advance clocks',()=>{
 const b=make();b.paused=true;const before=JSON.stringify([b.tick,b.objectiveProgress,b.enemies.timer,b.badTeam.map(u=>u.actionDuration)]);for(let n=0;n<50;n++)b.step();assert.equal(JSON.stringify([b.tick,b.objectiveProgress,b.enemies.timer,b.badTeam.map(u=>u.actionDuration)]),before);b.paused=false;b.step();assert.equal(b.tick,1);
});
test('58 retry rebuilds target identities and untouched supplies without mutating prior attempt',()=>{
 const a=make();a.step();destroy([targets(a)[0]]);a.checkOutcome();const before=JSON.stringify(a.objectiveProgress),b=make();assert.equal(b.tick,0);assert.equal(b.profile.gold,1200);assert.equal(b.objectiveProgress.resolved,0);assert.notEqual(targets(a)[0],targets(b)[0]);assert.equal(JSON.stringify(a.objectiveProgress),before);assert.equal(a.skirmish.code,b.skirmish.code);
});
test('58 terminal battle and frozen summary retain only the same two markers with bounded actor arrays',()=>{
 const b=make();destroy(targets(b));b.step();summary(b);const sizes=[b.objects.items.length,b.projectiles.length,b.badTeam.length],tick=b.tick;for(let n=0;n<5000;n++)b.step();assert.equal(b.tick,tick);assert.deepEqual([b.objects.items.length,b.projectiles.length,b.badTeam.length],sizes);assert.equal(b.objectiveMarkers.length,2);
});
test('58 ordinary doctrines keep no objective controller and remain isolated from campaign saves',()=>{
 const b=new SkirmishBattle({descriptor:DEFAULT_SKIRMISH});assert.equal(b.objectiveProgress,null);assert.deepEqual(b.objectiveMarkers,[]);assert.equal(b.badTeam.length,0);
 const profiles=new SkirmishProfiles(createSkirmish(descriptor));assert.throws(()=>profiles.exportBundle());assert.throws(()=>profiles.importBundle('{}'));assert.equal(profiles.active.gold,1200);
});

test('58 malformed later team metadata cannot settle either target',()=>{const b=make();for(const u of targets(b)){u.team='good';u.permanentTeam='unknown';}b.checkOutcome();assert.equal(b.objectiveProgress.resolved,0);assert.equal(b.outcome,null);});
