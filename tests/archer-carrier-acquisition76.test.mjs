/** Acquisition-only regression. Synthetic fixtures exercise both team paths;
 * ordinary-control replay evidence is retained separately from these fixtures. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FlagArcher,RANGED_ACTION as R} from '../site/dist/engine/ranged-troop.mjs';
import {FLAG_ACTION as A,FLAG_STATUS as S} from '../site/dist/engine/flag-troop.mjs';
import {CampaignBattle} from '../site/dist/engine/first-battle.mjs';
import {createMidgameDemoBattleOptions,prepareMidgameDemoBattle} from '../site/dist/midgame-demo.mjs';

function fixture(team='good') {
 let draws=0;
 const enemies=[],structures=[];
 const world={width:2000,goodHomeBoundary:200,badHomeBoundary:1800,elevationAt:()=>400,rotationAt:()=>0,gravity:.3,structures};
 const archer=new FlagArcher({rank:0,x:1000,y:400,height:50,team,forward:team==='good'?1:-1,
  friendFlag:{x:team==='good'?100:1900,y:400,status:S.AT_BASE},enemyFlag:{x:team==='good'?1900:100,y:400,status:S.AT_BASE},
  enemies:()=>enemies,structures,world,random:()=>{draws++;return .5;}});
 const actor=(distance,extra={})=>({x:1000+(team==='good'?1:-1)*distance,y:400,height:50,hp:100,team:team==='good'?'bad':'good',...extra});
 return {archer,enemies,structures,actor,draws:()=>draws};
}

for(const team of ['good','bad']) {
 for(const [state,extra] of Object.entries({zeroHP:{hp:0},negativeHP:{hp:-1},dead:{dead:true},destroyed:{destroyed:true},hasHPFalse:{hasHP:()=>false}})) {
  test(`76 ${team}: new acquisition rejects ${state} carrier and uses live fallback`,()=>{
   const {archer,enemies,actor,draws}=fixture(team),corpse=actor(100,{holdingEnemyFlag:true,...extra}),live=actor(200);
   enemies.push(corpse,live);const before=draws();
   assert.equal(archer.closestFlagCarrier(),null);
   assert.equal(archer.chooseNextAction(),R.LOAD_ARROW);assert.equal(archer.rangedTarget,live);
   assert.equal(archer.actionDuration,60);assert.equal(draws(),before,'selection consumes no RNG');
  });
 }
 test(`76 ${team}: only ineligible carriers block without assigning a new target`,()=>{
  const {archer,enemies,actor,draws}=fixture(team);enemies.push(actor(100,{hp:0,holdingFriendFlag:true}),actor(120,{destroyed:true,holdingEnemyFlag:true}));
  const before=draws();assert.equal(archer.chooseNextAction(),A.BLOCK);assert.equal(archer.rangedTarget,null);assert.equal(draws(),before);
 });
 test(`76 ${team}: ineligible carriers do not consume the existing first-two-carrier budget`,()=>{
  const {archer,enemies,actor}=fixture(team),first=actor(300,{holdingFriendFlag:true}),second=actor(200,{holdingEnemyFlag:true}),third=actor(100,{holdingEnemyFlag:true});
  enemies.push(actor(20,{hp:0,holdingEnemyFlag:true}),actor(30,{dead:true,holdingFriendFlag:true}),first,second,third);
  assert.equal(archer.closestFlagCarrier(),second,'closest of first two eligible carriers, not all carriers');
  archer.chooseNextAction();assert.equal(archer.rangedTarget,second);
 });
 test(`76 ${team}: living carrier method, ties, hidden/garrisoned status and priority stay unchanged`,()=>{
  const {archer,enemies,actor}=fixture(team),first=actor(250,{holdingFlag:()=>true,hasHP:()=>true,visible:false,canGetHit:false,garrisonBuilding:{}}),tie=actor(250,{holdingFriendFlag:true});
  enemies.push(actor(50),first,tie);assert.equal(archer.closestFlagCarrier(),first);archer.chooseNextAction();assert.equal(archer.rangedTarget,first);
 });
 test(`76 ${team}: existing structure distance selection still wins over a farther living carrier`,()=>{
  const {archer,enemies,structures,actor}=fixture(team),carrier=actor(250,{holdingEnemyFlag:true}),structure=actor(100,{occupiedBy:team==='good'?'bad':'good'});
  enemies.push(carrier);structures.push(structure);archer.chooseNextAction();assert.equal(archer.rangedTarget,structure);
 });
 test(`76 ${team}: living nearest-fallback ties follow caller ordering in either direction`,()=>{
  const {archer,enemies,actor}=fixture(team),first=actor(150),second=actor(-150);
  enemies.push(first,second);archer.chooseNextAction();assert.equal(archer.rangedTarget,first);
  enemies.reverse();archer.chooseNextAction();assert.equal(archer.rangedTarget,second);
 });
 test(`76 ${team}: live windup commits through death/disposal and one normal shot, then reacquires a living target`,()=>{
  const {archer,enemies,actor,draws}=fixture(team),target=actor(150,{holdingEnemyFlag:true}),fallback=actor(220);
  enemies.push(target,fallback);assert.equal(archer.chooseNextAction(),R.LOAD_ARROW);const before=draws();
  target.hp=0;target.dead=true;target.destroyed=true;
  const phases=[],shots=[];let previous=archer.actionMode;
  for(let tick=1;tick<=298;tick++){
   archer.step();if(archer.actionMode!==previous){phases.push([tick,archer.actionMode,archer.actionDuration]);previous=archer.actionMode;}
   if(archer.pendingProjectiles.length>shots.length)shots.push([tick,archer.pendingProjectiles.at(-1)]);
  }
  assert.deepEqual(phases,[[30,R.AIM,500],[280,R.RELEASE_ARROW,33],[297,R.LOAD_ARROW,60]]);
  assert.equal(shots.length,1);assert.equal(shots[0][0],281);assert.equal(shots[0][1].target,target);
  assert.equal(shots[0][1].kind,'standard_arrow');assert.equal(draws()-before,3,'unchanged three shot variance draws');
  assert.equal(archer.rangedTarget,fallback,'the next cycle does not reacquire the disposed carrier');
  assert.equal(shots[0][1].target,target,'already-requested projectile still owns original target');
 });
}

test('76 ordinary idle-demo acquisition has the reviewed causal receipt and keeps its committed dead-target shot',()=>{
 const receipt=JSON.parse(readFileSync(new URL('./fixtures/archer-acquisition76-idle-demo.json',import.meta.url))),expected=receipt.candidate76;
 const b=new CampaignBattle(createMidgameDemoBattleOptions());prepareMidgameDemoBattle(b);
 const previous=new WeakMap();let corpse,source,target,shot,alreadyDeadAcquisitions=0;
 const observe=()=>{
  const actors=[...b.goodTeam,...b.badTeam];
  for(const u of actors)if(u.type==='archer'){
   const old=previous.get(u),t=u.rangedTarget;
   if(u.actionMode===R.LOAD_ARROW&&(old?.mode!==R.LOAD_ARROW||u.actionDuration>old.duration)){
    const before=previous.get(t);if(before?.tick===b.tick-1&&(before.hp<=0||before.dead||before.destroyed))alreadyDeadAcquisitions++;
   }
  }
  if(b.tick===4749){corpse=b.badTeam.find(u=>u.type==='mount'&&u.hp===0&&u.holdingEnemyFlag);assert.ok(corpse);}
  if(b.tick===receipt.causal.firstAcquisitionDifferenceTick){
   source=b.goodTeam.find(u=>u.type==='archer'&&u.actionMode===R.LOAD_ARROW&&u.actionDuration===60&&Math.abs(u.x-334.8832000000002)<1e-8);assert.ok(source);
   target=source.rangedTarget;assert.notEqual(target,corpse);assert.equal(target.type,'tallGrunt');assert.equal(target.hp,receipt.causal.liveReplacementHP);
  }
  if(b.tick===receipt.causal.liveReplacementDeathTick)assert.equal(target.hp,0);
  if(b.tick===receipt.causal.committedShotTick){
   assert.equal(source.rangedTarget,target);assert.equal(target.hp,0);shot=b.projectiles.find(p=>p.owner===source);assert.ok(shot);assert.equal(shot.impactDamage,receipt.causal.committedShotDamage);
  }
  for(const u of actors)previous.set(u,{tick:b.tick,hp:u.hp,dead:u.dead,destroyed:u.destroyed,mode:u.actionMode,duration:u.actionDuration});
 };
 observe();while(!b.outcome&&b.tick<15000){b.step();observe();}
 assert.ok(shot);assert.equal(alreadyDeadAcquisitions,expected.corpseAcquisitions);
 const actual={tick:b.tick,outcome:b.outcome,homeHP:b.goodCastle.hp,enemyHP:b.badCastle.hp,heroHP:b.hero.hp,heroDead:b.hero.dead,gold:b.profile.gold,goldSpent:b.stats.goldSpent,reserve:b.friendlyQueue.population,populationGiven:b.stats.populationGiven,queue:b.friendlyQueue.queue.length,victories:b.profile.victories,defeats:b.profile.defeats,enemiesRemaining:b.enemies.remaining,enemiesSpawned:b.enemies.spawned,homeFlagStatus:b.ownFlag.status};
 for(const [key,value] of Object.entries(actual))assert.equal(value,expected[key],key);
});
