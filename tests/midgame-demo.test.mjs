import test from 'node:test';
import assert from 'node:assert/strict';
import {CampaignBattle} from '../site/dist/engine/first-battle.mjs';
import {PlayerProfile, serializeProfile, restoreProfile, summonSquad} from '../site/dist/engine/progression.mjs';
import {CampaignProfiles} from '../site/dist/engine/profile-manager.mjs';
import {MIDGAME_DEMO,createMidgameDemoProfile,isMidgameDemoProfile,createMidgameDemoBattleOptions,prepareMidgameDemoBattle} from '../site/dist/midgame-demo.mjs';

function create(options) {return new CampaignBattle(createMidgameDemoBattleOptions(options));}
function prepared(options) {const battle=create(options);const receipt=prepareMidgameDemoBattle(battle);return {battle,receipt};}
const round=x=>Math.round(x*1e6)/1e6;
const unit=u=>({type:u.type,team:u.team,x:round(u.x),y:round(u.y),hp:u.hp,maxHp:u.maxHp,mode:u.actionMode??null});
function fingerprint(b) {
 return {tick:b.tick,profile:JSON.parse(serializeProfile(b.profile)),stats:b.stats,
  hero:unit(b.hero),keeps:[unit(b.goodCastle),unit(b.badCastle)],good:b.goodTeam.map(unit),bad:b.badTeam.map(unit),
  roster:b.enemies.roster,index:b.enemies.index,remaining:b.enemies.remaining,
  reserve:b.friendlyQueue.population,queue:b.friendlyQueue.queue.length,
  wave:[b.wave.remaining,b.wave.countdown,b.wave.delay],
  projectiles:b.projectiles.map(p=>({kind:p.kind,team:p.team,x:round(p.x),y:round(p.y),vx:round(p.vx),vy:round(p.vy)})),
  outcome:b.outcome,summary:b.summary};
}

test('profile is explicitly assisted, with no invented earned progress',()=>{
 const p=createMidgameDemoProfile();
 assert.ok(p instanceof PlayerProfile);assert.equal(isMidgameDemoProfile(p),true);assert.equal(p.cheated,true);
 assert.equal(p.name,'Midgame Demo');assert.equal(p.rank,8);assert.equal(p.gold,1500);
 assert.equal(p.level,13);assert.equal(p.scene,14);assert.equal(p.highestLevel,13);assert.equal(p.highestScene,14);
 assert.equal(p.difficulty,'medium');assert.equal(p.shootingMode,'classic');
 assert.equal(p.victories,0);assert.equal(p.defeats,0);assert.equal(p.xp,0);
 assert.equal(p.skills.every(s=>s.xp===0),true);
});
test('rank8 basic and ten rank2 acquired skills retain discoverable heavy infantry and cavalry',()=>{
 const p=createMidgameDemoProfile();assert.deepEqual(p.skills.map(s=>s.id),MIDGAME_DEMO.skills);
 assert.deepEqual(p.skills.map(s=>s.binding),[0,1,2,3,4,5,6,7,8,9,10]);
 for(const s of p.skills){assert.equal(s.rank,s.id==='arrow'?8:2);assert.equal(s.threshold,s.id==='arrow'?900:300);assert.equal(s.autocast,MIDGAME_DEMO.autoRecruit.includes(s.id));assert.equal(s.cooldown,0);assert.equal(s.passive,false);}
 assert.equal(p.owned.size,11);assert.equal(p.owned.has('cometArrow'),false);
});
test('constructor options get independent profiles, skills and seeded RNG streams',()=>{
 const a=createMidgameDemoBattleOptions(),b=createMidgameDemoBattleOptions();
 assert.notEqual(a.profile,b.profile);assert.notEqual(a.profile.skills[0],b.profile.skills[0]);assert.notEqual(a.random,b.random);
 assert.equal(a.level,13);assert.equal(a.testing,false);
 assert.deepEqual(Array.from({length:20},()=>a.random()),Array.from({length:20},()=>b.random()));
});
test('valid aiming preference can carry over, with invalid modes rejected',()=>{
 for(const shootingMode of ['classic','anywhere','point_aim','auto_aim'])assert.equal(createMidgameDemoProfile({shootingMode}).shootingMode,shootingMode);
 assert.throws(()=>createMidgameDemoProfile({shootingMode:'unknown'}),/aiming mode/);
});
test('assisted profile uses valid engine profile fields without fabricating wins',()=>{
 const profile=restoreProfile(serializeProfile(createMidgameDemoProfile()));
 assert.equal(profile.victories,0);assert.equal(profile.level,13);assert.equal(profile.skills.length,11);
 // Importing plain profile data does not authorize this helper to mutate it.
 assert.equal(isMidgameDemoProfile(profile),false);
});
test('campaign manager and ordinary profile remain completely untouched',()=>{
 const campaign=new PlayerProfile('Real Archer');campaign.gold=432;campaign.victories=2;campaign.level=3;
 const manager=new CampaignProfiles({profiles:[campaign]});const before=manager.exportBundle();
 const {battle}=prepared();assert.notEqual(battle.profile,campaign);assert.equal(manager.active,campaign);
 assert.equal(manager.exportBundle(),before);assert.equal(manager.profiles.length,1);
});
test('initial mixed army and automatic recruitment pay real gold and reserve costs',()=>{
 const b=create(),calls=[],orig=b.friendlyQueue.enqueueSquad.bind(b.friendlyQueue);b.friendlyQueue.enqueueSquad=(ticket,amount)=>{calls.push({type:ticket.type,cost:ticket.cost,rank:ticket.rank,amount});return orig(ticket,amount);};
 const receipt=prepareMidgameDemoBattle(b);
 assert.deepEqual(calls.slice(0,4),[{type:'tallGrunt',cost:1,rank:2,amount:3},{type:'archer',cost:1,rank:2,amount:4},{type:'priest',cost:1,rank:2,amount:2},{type:'trebuchet',cost:1,rank:2,amount:1}]);
 assert.equal(b.profile.gold,1120);assert.equal(b.stats.goldSpent,380);assert.equal(b.friendlyQueue.population,61);assert.equal(b.stats.populationGiven,90);assert.equal(b.friendlyQueue.queue.length,15);
 assert.deepEqual(receipt,{id:'midgame-13-v3',assisted:true,level:13,seed:131,ticks:1350,simulatedSeconds:1350/33,squadGoldSpent:380,remainingGold:1120,populationGiven:90,populationRemaining:61});
});
test('preparation runs exactly 1350 ordinary simulation steps, including normal edge spawns',()=>{
 const b=create();let calls=0;const original=b.step.bind(b);b.step=()=>{calls++;original();};
 const spawn=[];b.onEvent=e=>{if(e.type==='spawn')spawn.push({type:e.unit.type,team:e.unit.team,x:e.unit.x});};
 prepareMidgameDemoBattle(b);assert.equal(calls,1350);assert.equal(b.tick,1350);
 assert.equal(spawn.filter(x=>x.team==='good').length,14);assert.equal(spawn.filter(x=>x.team==='bad').length,14);
 assert.ok(spawn.filter(x=>x.team==='good').every(x=>x.x===-50));assert.ok(spawn.filter(x=>x.team==='bad').every(x=>x.x===2050));
});
test('handoff has healthy hero and lightly contested keep, no outcome, and 14 army slots with 13 living allies',()=>{
 const {battle:b}=prepared();assert.equal(b.outcome,null);assert.equal(b.summary,null);
 assert.equal(b.hero.hp,380);assert.equal(b.goodCastle.hp,11200);assert.equal(b.badCastle.hp,11466);
 assert.equal(b.hero.hp,b.hero.maxHp);assert.equal(b.goodCastle.hp,b.goodCastle.maxHp);assert.equal(b.badCastle.hp,b.badCastle.maxHp);
 assert.equal(b.goodTeam.filter(x=>x.type!=='hero'&&x.hp>0).length,13);
 assert.equal(b.profile.victories,0);assert.equal(b.profile.defeats,0);assert.equal(b.stats.shotsFired,0);assert.equal(b.stats.goldEarned,0);
});
test('handoff includes a genuine dragon, ground and siege threats with a mixed allied army',()=>{
 const {battle:b}=prepared();const types=new Set(b.badTeam.map(u=>u.type));
 for(const type of ['grunt','tallGrunt','archer','priest','trebuchet','dragon_scout_ice'])assert.ok(types.has(type),type);
 assert.equal(b.badTeam.length,14);assert.equal(b.enemies.remaining,134);assert.equal(b.projectiles.length,1);
 assert.ok(b.airUnits.some(u=>u.type==='dragon_scout_ice'&&u.x>600&&u.x<900));
 assert.equal(b.goodTeam.filter(u=>u.type==='tallGrunt').length,3);assert.equal(b.goodTeam.filter(u=>u.type==='trebuchet').length,1);
 assert.equal(b.hotbar.bar,0);assert.equal(b.activeSkill.id,'arrow');assert.equal(b.profile.skills.filter(s=>s.id!=='trebuchet').every(s=>s.cooldown===0),true);assert.equal(b.profile.skills.find(s=>s.id==='trebuchet').cooldown,1326);
});
test('same seed yields identical handoff snapshots and continuation',()=>{
 const {battle:a}=prepared(),{battle:b}=prepared();assert.deepEqual(fingerprint(a),fingerprint(b));
 for(let i=0;i<330;i++){a.step();b.step();}assert.deepEqual(fingerprint(a),fingerprint(b));
});
test('all aiming modes have the same no-input simulated opening',()=>{
 const shots=[];for(const shootingMode of ['classic','anywhere','point_aim','auto_aim']){
  const {battle}=prepared({shootingMode});shots.push({good:battle.goodTeam.map(unit),bad:battle.badTeam.map(unit),tick:battle.tick});
 }
 for(const s of shots)assert.deepEqual(s,shots[0]);
});
test('no hidden protection and ordinary future summons keep spending normally',()=>{
 const {battle:b}=prepared();assert.equal(b.testing,false);assert.equal(b.protectedTesting,false);
 b.hero.takeDamage(10);assert.equal(b.hero.hp,370);
 const s=b.profile.skills.find(s=>s.id==='grunt');while(b.friendlyQueue.queue.length>10)b.friendlyQueue.cancel(b.friendlyQueue.queue.length-1);const before=b.friendlyQueue.population;assert.equal(summonSquad(s,b.profile,b.friendlyQueue,b.stats),true);
 assert.equal(b.profile.gold,1100);assert.equal(b.friendlyQueue.population,before-4);assert.equal(b.stats.goldSpent,400);assert.equal(b.friendlyQueue.queue.length,14);
 assert.equal(summonSquad(s,b.profile,b.friendlyQueue,b.stats),false);
});
test('preparation cannot replay or mutate an ordinary campaign battle',()=>{
 const ordinary=new CampaignBattle();const before=serializeProfile(ordinary.profile);
 assert.throws(()=>prepareMidgameDemoBattle(ordinary),/temporary/);assert.equal(serializeProfile(ordinary.profile),before);assert.equal(ordinary.tick,0);
 const {battle:b}=prepared();const gold=b.profile.gold;assert.throws(()=>prepareMidgameDemoBattle(b),/already started/);assert.equal(b.tick,1350);assert.equal(b.profile.gold,gold);
});
test('paused, protected, wrong-level and already-funded/used setups fail before preroll',()=>{
 const scenarios=[b=>b.paused=true,b=>b.protectedTesting=true,b=>b.level=12,b=>b.profile.gold++,b=>b.friendlyQueue.population--,b=>b.random=()=>.5];
 for(const change of scenarios){const b=create();change(b);assert.throws(()=>prepareMidgameDemoBattle(b));assert.equal(b.tick,0);assert.equal(b.friendlyQueue.queue.length,0);}
});
test('idle continuation can naturally lose, proving the demo is not invulnerable',()=>{
 const {battle:b}=prepared();while(!b.outcome&&b.tick<15000)b.step();
 assert.equal(b.tick,11992);assert.equal(b.outcome,'defeat');assert.equal(b.goodCastle.hp,10170);assert.equal(b.hero.dead,false);assert.equal(b.ownFlag.status,4);
 assert.equal(b.profile.victories,0);assert.equal(b.profile.defeats,1);
});

test('auto recruitment keeps a full mixed army after sixty unplayed seconds within the explicitly enlarged field cap',()=>{const {battle:b}=prepared();for(let i=0;i<1980;i++)b.step();assert.equal(b.goodTeam.filter(u=>u!==b.hero&&u.hp>0).length,13);assert.equal(b.friendlyQueue.population,44);assert.equal(b.profile.gold,1000);assert.equal(b.goodCastle.hp,10499);assert.equal(b.protectedTesting,false);assert.equal(b.outcome,null);});
