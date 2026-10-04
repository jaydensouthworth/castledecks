import test from 'node:test';import assert from 'node:assert/strict';
import {causewayOccupants} from '../site/dist/engine/causeway-objective.mjs';
import {SkirmishBattle} from '../site/dist/skirmish-battle.mjs';
import {makePolicy,applyControl} from './helpers/causeway-control-policy73.mjs';
/** Deterministic normal-control reachability regressions, NOT human/native QA.
 * All five use unchanged Standard/Oaks seed 42 and supplied practice resources.
 */
function complete(config,{clearedAtSecure=false}={}){
 let b;const events=[],flags=[],purchases=[],shotTicks=[];let lastFlag=3,peak=0,peakPaid=0,minHP=360,unsafeProgress=null,troopOnlyCredits=0,firstTroopCredit=null,lastTroopCredit=null;
 b=new SkirmishBattle({descriptor:{version:1,seed:42,biome:'oaks',threat:'standard',doctrine:'causeway'},shootingMode:'classic',onEvent:e=>{
  if(e.type==='shot'){assert.equal(e.skill,'arrow');shotTicks.push(e.tick);}
  if(['army-order','causeway-secured','outcome'].includes(e.type))events.push({type:e.type,tick:e.tick,withdrawn:e.withdrawn,group:e.group,issuedMode:e.issuedMode,issuedPosition:e.issuedPosition,...(b?{live:b.badTeam.filter(u=>u.hp>0&&!u.dead).length}:{} )});
 }});
 assert.equal(b.badTeam.length,5);assert.deepEqual(b.badTeam.map(u=>[u.type,u.x]),[['grunt',1040],['grunt',1160],['tallGrunt',1100],['archer',1280],['priest',1340]]);
 assert.equal(b.enemies.roster.length,24);assert.equal(b.friendlyQueue.population,70);assert.equal(b.profile.gold,1200);assert.equal(b.friendlyQueue.cap,14);assert.equal(b.enemies.cap,20);assert.ok(b.profile.skills.every(s=>!s.autocast));
 if(config.policy==='garrison'){assert.equal(b.hero.garrisonBuilding,b.goodCastle);assert.equal(b.hero.x,350);}
 const policy=makePolicy(config);
 while(!b.outcome&&b.tick<6000){
  const before={tick:b.tick,progress:b.objectiveProgress.ticks,spent:b.stats.goldSpent,reserve:b.friendlyQueue.population};
  const controls=policy(b);applyControl(b,controls);b.step();
  assert.equal(b.tick,before.tick+1);assert.equal(b.testing,false);assert.equal(b.protectedTesting,false);assert.equal(b.profile.shootingMode,'classic');
  assert.equal(b.enemies.spawned+b.enemies.remaining+b.enemies.withdrawn,24);assert.ok(b.regularArmyCount<=14);assert.ok(b.badTeam.length<=20);
  assert.ok(b.objectiveProgress.ticks>=before.progress&&b.objectiveProgress.ticks<=before.progress+1);
  if(config.policy==='garrison'){
   assert.equal(b.hero.garrisonBuilding,b.goodCastle,'hero stays in its original home garrison every tick');assert.equal(b.hero.x,350);
   if(b.objectiveProgress.ticks>before.progress){const occupants=causewayOccupants(b);assert.ok(occupants.friendly.length>0);assert.ok(!occupants.friendly.includes(b.hero),'hero never supplies occupation');assert.ok(occupants.friendly.every(u=>u.type==='grunt'),'paid infantry supplies every credited tick');troopOnlyCredits++;firstTroopCredit??=b.tick;lastTroopCredit=b.tick;}
  }
  if(b.ownFlag.status!==lastFlag){flags.push([b.tick,lastFlag,b.ownFlag.status,b.objectiveProgress.ticks]);lastFlag=b.ownFlag.status;}
  if(b.ownFlag.status!==3){unsafeProgress??=b.objectiveProgress.ticks;assert.equal(b.objectiveProgress.ticks,unsafeProgress);}else unsafeProgress=null;
  if(b.stats.goldSpent!==before.spent)purchases.push([b.tick,b.profile.skills.find(s=>s.binding===controls.select)?.id,b.stats.goldSpent-before.spent,before.reserve-b.friendlyQueue.population]);
  peak=Math.max(peak,b.goodTeam.length+b.badTeam.length);peakPaid=Math.max(peakPaid,b.regularArmyCount);minHP=Math.min(minHP,b.hero.hp);
 }
 assert.equal(b.outcome,'victory','6000 ticks is an observation limit, not a forced outcome');assert.equal(b.objectiveProgress.ticks,990);assert.equal(b.ownFlag.status,3);assert.equal(b.badTeam.length,0);assert.equal(b.enemies.remaining,0);assert.ok(b.hero.hp>0);assert.ok(b.goodCastle.hp>0);
 for(let i=1;i<shotTicks.length;i++)assert.ok(shotTicks[i]-shotTicks[i-1]>=30,'ordinary Basic cooldown');
 const secured=events.filter(e=>e.type==='causeway-secured');assert.equal(secured.length,1);
 if(clearedAtSecure){assert.equal(b.tick,secured[0].tick);assert.equal(secured[0].live,0);}else{assert.ok(b.tick>secured[0].tick);assert.ok(secured[0].live>0,'secured does not remove deployed army');}
 return {b,events,flags,purchases,peak,peakPaid,minHP,troopOnlyCredits,firstTroopCredit,lastTroopCredit,secured:secured[0]};
}
test('scripted Classic hero-only early secure: safe flag, 8 finite withdrawals, ordinary cleanup',()=>{const r=complete({hold:200});assert.equal(r.b.tick,2374);assert.equal(r.secured.tick,1524);assert.equal(r.secured.withdrawn,8);assert.equal(r.b.enemies.spawned,16);assert.equal(r.b.hero.hp,360);assert.equal(r.minHP,360);assert.equal(r.b.stats.shotsFired,73);assert.equal(r.b.stats.goldSpent,0);assert.equal(r.b.friendlyQueue.population,70);assert.equal(r.peakPaid,0);assert.equal(r.peak,8);assert.deepEqual(r.flags,[]);assert.ok(r.b.badCastle.hp>0);});
for(const [plan,unit,cost] of [['infantry','grunt',90],['riders','mount',110]])test(`scripted paid ${plan} Center plan: real costs/caps and one-time Advance to cleanup`,()=>{const r=complete({plan,hold:200,cleanup:'advance'});assert.equal(r.b.tick,1947);assert.equal(r.secured.tick,1524);assert.equal(r.secured.withdrawn,0);assert.equal(r.b.enemies.spawned,24);assert.equal(r.b.hero.hp,360);assert.equal(r.b.stats.goldSpent,cost);assert.equal(r.b.friendlyQueue.population,56);assert.equal(r.peakPaid,14);assert.equal(r.peak,29);assert.deepEqual(r.flags,[]);assert.deepEqual(r.purchases,[[1,unit,plan==='infantry'?20:30,4],[2,'archer',20,4],[3,'priest',30,2],[332,unit,plan==='infantry'?20:30,4]]);const orders=r.events.filter(e=>e.type==='army-order');assert.deepEqual(orders.slice(0,2).map(e=>[e.tick,e.group,e.issuedMode,e.issuedPosition]),[[0,'frontline','rally','center'],[0,'support','rally','center']]);assert.equal(orders.filter(e=>e.issuedMode==='advance').length,1);assert.equal(orders.find(e=>e.issuedMode==='advance').tick,1524);});
test('scripted natural dropped-flag recovery: paid Grunts preserve earned credit and restore safe victory',()=>{const r=complete({recover:true});assert.equal(r.b.tick,3801);assert.equal(r.secured.tick,3489);assert.equal(r.b.hero.hp,200);assert.equal(r.b.stats.goldSpent,20);assert.equal(r.b.friendlyQueue.population,66);assert.deepEqual(r.purchases,[[1761,'grunt',20,4]]);assert.deepEqual(r.flags,[[1171,3,1,693],[1760,1,0,693],[2558,0,2,693],[3193,2,3,694]]);});

test('scripted paid infantry supplies all 990 occupation ticks while hero stays home-garrisoned',()=>{
 const r=complete({plan:'infantry',policy:'garrison'},{clearedAtSecure:true});
 assert.equal(r.b.tick,2600);assert.equal(r.secured.tick,2600);assert.equal(r.secured.withdrawn,0);assert.equal(r.b.enemies.spawned,24);
 assert.equal(r.troopOnlyCredits,990);assert.equal(r.firstTroopCredit,1611);assert.equal(r.lastTroopCredit,2600);assert.equal(r.b.objectiveProgress.friendly,8);
 assert.equal(r.b.hero.garrisonBuilding,r.b.goodCastle);assert.equal(r.b.hero.x,350);assert.equal(r.b.hero.hp,360);assert.equal(r.minHP,360);
 assert.equal(r.b.stats.shotsFired,63);assert.equal(r.b.stats.goldSpent,90);assert.equal(r.b.friendlyQueue.population,56);assert.equal(r.peakPaid,14);assert.equal(r.peak,31);assert.deepEqual(r.flags,[]);
 assert.deepEqual(r.purchases,[[1,'grunt',20,4],[2,'archer',20,4],[3,'priest',30,2],[332,'grunt',20,4]]);
 const orders=r.events.filter(e=>e.type==='army-order');assert.deepEqual(orders.slice(0,2).map(e=>[e.tick,e.group,e.issuedMode,e.issuedPosition]),[[0,'frontline','rally','center'],[0,'support','rally','center']]);
 assert.equal(orders.filter(e=>e.issuedMode==='advance').length,1);assert.equal(orders.find(e=>e.issuedMode==='advance').tick,2600);
 assert.ok(r.b.badCastle.hp>0);assert.ok(r.b.structures.find(s=>s.type==='tower').hp>0);
});
