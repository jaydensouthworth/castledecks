import test from 'node:test';
import assert from 'node:assert/strict';
import {CampaignBattle} from '../site/dist/engine/first-battle.mjs';
import {PlayerProfile} from '../site/dist/engine/progression.mjs';
import {seededRandom} from '../site/dist/engine/combat.mjs';
import {FlagTrebuchet,RANGED_ACTION as R} from '../site/dist/engine/ranged-troop.mjs';
import {selectSiegeStructureTarget,hostileSiegeStructure,canReleaseSiegeTarget} from '../site/dist/engine/siege-targeting.mjs';
import {collectProjectileTargets} from '../site/dist/engine/projectile-targets.mjs';
const source=()=>({type:'trebuchet',team:'good',recruited:true,hp:300,x:450,y:700,shotRange:1600,garrisonBuilding:null});
const building=(x,permanentTeam='bad',occupiedBy='neutral')=>({x,y:700,hp:3000,permanentTeam,occupiedBy});
function fixture(seed=42){
 const profile=new PlayerProfile('Controlled siege fixture');
 const battle=new CampaignBattle({profile,level:7,random:seededRandom(seed)});
 const unit=battle.createUnit('trebuchet',{team:'good',rank:0});
 unit.x=500;unit.y=battle.elevationAt(500);unit.shotRange=1700;
 return {battle,unit};
}
function release(unit){unit.transition(R.RELEASE_AMMO);unit.actionDuration=120;unit.doAction();}

test('empty permanent enemy keep is a legal target, allied/neutral buildings are not',()=>{
 const u=source(),enemy=building(1800),home=building(1600,'good','bad'),neutral=building(1500,'neutral','neutral'),own=building(1700,'neutral','good'),occupiedKeep=building(1800,'bad','good');
 assert.equal(selectSiegeStructureTarget(u,[home,neutral,own,occupiedKeep,enemy]),enemy);
 assert.equal(selectSiegeStructureTarget(u,[home,neutral,own,occupiedKeep]),null);
});
test('hostile tower affiliation is read live; stale list membership cannot authorize a shot',()=>{
 const u=source(),tower=building(1500,'neutral','bad'),structures=[tower];
 assert.equal(hostileSiegeStructure(u,tower,structures),true);
 for(const team of ['good','neutral',null]){tower.occupiedBy=team;assert.equal(hostileSiegeStructure(u,tower,structures),false);}
 tower.occupiedBy='bad';assert.equal(hostileSiegeStructure(u,tower,[]),false);
});
test('structure range retains 700-unit dead zone and maximum siege range',()=>{
 const u=source(),near=building(1150),inside=building(1150.001),edge=building(2050),far=building(2050.001);
 for(const [target,expected] of [[near,false],[inside,true],[edge,true],[far,false]])assert.equal(hostileSiegeStructure(u,target,[target]),expected);
 assert.equal(selectSiegeStructureTarget(u,[inside,edge]),edge);
});
test('dead, destroyed, missing, and nonfinite targets are rejected',()=>{
 const u=source();
 for(const change of [{hp:0},{dead:true},{destroyed:true},{x:NaN},{y:Infinity},{x:undefined}]){
  const target={...building(1800),...change};assert.equal(selectSiegeStructureTarget(u,[target]),null);
 }
 assert.equal(canReleaseSiegeTarget(u,null,[]),false);
});
test('only an alive nongarrisoned recruited good trebuchet uses the modern policy',()=>{
 const keep=building(1800);
 for(const change of [{team:'bad'},{recruited:false},{type:'archer'},{hp:0},{dead:true},{destroyed:true},{x:NaN},{garrisonBuilding:keep}]){
  assert.equal(selectSiegeStructureTarget({...source(),...change},[keep]),null);
 }
});
test('actual allied recruit chooses keep with zero enemy actors; live actor choice stays first',()=>{
 const {battle:b,unit:u}=fixture();assert.equal(u.selectTarget(),b.badCastle);
 const enemy=b.createUnit('grunt');enemy.x=1450;enemy.y=b.elevationAt(enemy.x);
 assert.equal(u.selectTarget(),enemy);enemy.hp=0;assert.equal(u.selectTarget(),b.badCastle);
});
test('enemy siege and standalone troop retain their prior no-building-target behavior',()=>{
 const {battle:b}=fixture();const enemy=b.createUnit('trebuchet');enemy.x=1500;enemy.y=b.elevationAt(enemy.x);
 enemy.enemies=[];assert.equal(enemy.services.selectSiegeStructure,undefined);assert.equal(enemy.selectTarget(),null);
 const lone=new FlagTrebuchet({team:'good',rank:0,x:500,y:700,world:b,friendFlag:b.ownFlag,enemyFlag:b.enemyFlag,enemies:[],structures:[b.badCastle],height:75,random:seededRandom(1)});
 assert.equal(lone.selectTarget(),null);
});
test('real building launch is finite with no building vx, after original load/aim/release windup',()=>{
 const {battle:b,unit:u}=fixture();const requests=[],queue=u.services.queueProjectile;
 u.services.queueProjectile=r=>{requests.push(r);return queue(r);};
 assert.equal(u.chooseNextAction(),R.LOAD_AMMO);assert.equal(u.actionDuration,200);
 for(let i=0;i<360;i++)u.step();assert.equal(requests.length,0);
 for(let i=0;i<15;i++)u.step();assert.equal(requests.length,1);
 const [shot]=requests;assert.equal(shot.target,b.badCastle);assert.equal(b.badCastle.vx,undefined);
 assert.ok([shot.x,shot.y,shot.vx,shot.vy].every(Number.isFinite));assert.equal(shot.impactDamage,125);
});
test('building destroyed during windup consumes release without firing or instant retargeting',()=>{
 const {battle:b,unit:u}=fixture();u.selectTarget();b.badCastle.takeDamage(b.badCastle.maxHp);
 const before=b.projectiles.length;release(u);assert.equal(b.projectiles.length,before);assert.equal(u.fired,true);assert.equal(u.actionMode,R.RELEASE_AMMO);
});
test('building ownership change, range loss, and target removal are checked at release',()=>{
 for(const invalidation of [(b,t)=>t.occupiedBy='good',(b,t)=>t.x=600,(b,t)=>b.structures.splice(b.structures.indexOf(t),1)]){
  const {battle:b,unit:u}=fixture();const tower=b.createTower(1500);tower.occupiedBy='bad';b.badCastle.hp=0;
  assert.equal(u.selectTarget(),tower);invalidation(b,tower);const before=b.projectiles.length;release(u);assert.equal(b.projectiles.length,before);
 }
});
test('actor death during windup is checked for modern recruits',()=>{
 const {battle:b,unit:u}=fixture();const target=b.createUnit('grunt');target.x=1500;target.y=b.elevationAt(1500);u.selectTarget();target.takeDamage(target.maxHp);
 release(u);assert.equal(b.projectiles.length,0);
});
test('source dies or becomes garrisoned before release: no shot',()=>{
 for(const change of [{hp:0},{dead:true},{destroyed:true},{garrisonBuilding:{}}]){
  const {battle:b,unit:u}=fixture();u.selectTarget();Object.assign(u,change);release(u);assert.equal(b.projectiles.length,0);
 }
});
test('allied siege ammunition preserves target-team filtering and allied flyer immunity',()=>{
 const {battle:b,unit:u}=fixture();u.selectTarget();release(u);const p=b.projectiles[0];
 assert.equal(p.team,'good');assert.equal(p.addGoodTargets,false);assert.equal(p.addBadTargets,true);
 const ally=b.createUnit('grunt',{team:'good'}),flyer=b.createUnit('air',{team:'good'});ally.x=p.x;ally.y=p.y;flyer.x=p.x;flyer.y=p.y;
 const candidates=collectProjectileTargets(p,b);assert.ok(candidates.includes(b.badCastle));assert.ok(!candidates.includes(b.goodCastle));assert.ok(!candidates.includes(ally));assert.ok(!candidates.includes(flyer));
 const hp=flyer.hp;p.impact(flyer);flyer.effects.step();for(const spell of b.spells)spell.step();flyer.effects.step();assert.equal(flyer.hp,hp);
});
test('a real fired shell can damage an intact keep and terminates finitely',()=>{
 const {battle:b,unit:u}=fixture(1234);u.selectTarget();release(u);const p=b.projectiles[0];let ticks=0;
 while(p.active&&ticks++<500){p.step();b.badCastle.effects.step();assert.ok([p.x,p.y,p.vx,p.vy].every(Number.isFinite));}
 assert.equal(p.active,false);assert.ok(ticks<500);assert.ok(b.badCastle.hp<b.badCastle.maxHp);
});
test('shell already airborne when keep dies causes no duplicate collapse',()=>{
 let collapsed=0;const {battle:b,unit:u}=fixture();b.onEvent=e=>{if(e.type==='castle-destroyed'&&e.castle===b.badCastle)collapsed++;};
 u.selectTarget();release(u);const p=b.projectiles[0];b.badCastle.takeDamage(b.badCastle.maxHp);let ticks=0;
 while(p.active&&ticks++<500){p.step();b.badCastle.effects.step();}
 assert.equal(p.active,false);assert.equal(collapsed,1);assert.equal(b.badCastle.hp,0);
});

test('red-to-empty-to-blue tower stays transparent to an already launched recruited siege shell',()=>{
 const {battle:b,unit:u}=fixture();const tower=b.createTower(1500),red=b.createUnit('archer');
 red.attemptGarrison(tower);red.x=1500;red.y=b.elevationAt(1500);red.leaveGarrison();red.takeDamage(red.hp);
 u.selectTarget();release(u);const p=b.projectiles[0],cached=collectProjectileTargets(p,b);assert.ok(cached.includes(tower));
 const blue=b.createUnit('archer',{team:'good'});blue.attemptGarrison(tower);
 assert.equal(tower.occupiedBy,'good');assert.ok(b.badStructures.includes(tower),'reproduce historical stale enemy affiliation');
 p.x=tower.x;p.y=tower.y-70;
 assert.notEqual(p.testHit(b.elevationAt(p.x),cached)?.target,tower);
 const hp=tower.hp;p.impact(tower);tower.effects.step();assert.equal(tower.hp,hp);assert.equal(p.active,true);
 // Protection belongs to the launched shell even if its crew subsequently dies.
 u.takeDamage(u.hp);p.impact(tower);tower.effects.step();assert.equal(tower.hp,hp);
});
test('neutral masonry, enemy siege, and existing grounded-allied blast risk are preserved',()=>{
 const {battle:b,unit:u}=fixture();u.selectTarget();release(u);const p=b.projectiles[0],tower=b.createTower(1500);
 p.x=tower.x;p.y=tower.y-70;assert.equal(p.testHit(b.elevationAt(p.x),[tower])?.target,tower);
 tower.occupiedBy='good';p.team='bad';assert.equal(p.testHit(b.elevationAt(p.x),[tower])?.target,tower);p.team='good';
 const ally=b.createUnit('grunt',{team:'good'});ally.x=p.x=700;ally.y=p.y=b.elevationAt(700);const hp=ally.hp;
 p.impact(null);for(const spell of b.spells)spell.step();ally.effects.step();assert.ok(ally.hp<hp,'ordinary ground splash remains a positional risk');
});

test('a removed enemy keep cannot be mistaken for an actor at release',()=>{
 const {battle:b,unit:u}=fixture();assert.equal(u.selectTarget(),b.badCastle);
 b.structures.splice(b.structures.indexOf(b.badCastle),1);release(u);assert.equal(b.projectiles.length,0);
});
