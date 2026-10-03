import test from 'node:test';
import assert from 'node:assert/strict';
import {CampaignBattle} from '../site/dist/engine/first-battle.mjs';
import {PlayerProfile,serializeProfile} from '../site/dist/engine/progression.mjs';
import {seededRandom} from '../site/dist/engine/combat.mjs';
import {armyCompany,ARMY_ORDER_GROUPS} from '../site/dist/engine/army-orders.mjs';
import {armyOrderStatus,drawArmyOrderMarker} from '../site/dist/army-orders-ui.mjs';
const fresh=(seed=83)=>new CampaignBattle({profile:new PlayerProfile(),random:seededRandom(seed)});
const place=(u,x)=>{u.x=x;u.y=u.world.elevationAt(x);u.vx=0;u.actionDuration=0;return u;};
const stepUnit=(unit,ticks)=>{for(let i=0;i<ticks;i++)unit.step();};
const hold=(b,group,position='rear')=>assert.equal(b.setArmyOrder('rally',position,group),true);

test('companies classify only ordinary allied ground types',()=>{
 assert.deepEqual(ARMY_ORDER_GROUPS,['all','frontline','support']);const b=fresh();
 for(const type of ['grunt','tallGrunt','mount','fireDemon','iceDemon'])assert.equal(armyCompany(b.createUnit(type,{team:'good'})),'frontline');
 for(const type of ['archer','priest'])assert.equal(armyCompany(b.createUnit(type,{team:'good'})),'support');
 for(const type of ['air','trebuchet','fireDragon','iceDragon','poisonDragon'])assert.equal(armyCompany(b.createUnit(type,{team:'good'})),null);
 assert.equal(armyCompany(b.createUnit('gorath',{team:'good',companion:true})),null);
 for(const type of ['grunt','archer','priest'])assert.equal(armyCompany(b.createUnit(type,{team:'bad'})),null);
});
test('independent holds and Advance update only their target role; all-ground overrides both',()=>{
 const b=fresh();hold(b,'frontline','forward');assert.equal(b.armyOrder.mode,'split');assert.equal(b.armyOrder.groups.support.mode,'advance');
 hold(b,'support','rear');assert.equal(b.armyOrder.groups.frontline.anchorX,1500);assert.equal(b.armyOrder.groups.support.anchorX,600);
 assert.equal(b.setArmyOrder('advance',undefined,'frontline'),true);assert.equal(b.armyOrder.groups.frontline.mode,'advance');assert.equal(b.armyOrder.groups.support.mode,'rally');
 hold(b,'all','center');assert.equal(b.armyOrder.mode,'rally');for(const group of ['frontline','support'])assert.equal(b.armyOrder.groups[group].anchorX,1050);
 b.setArmyOrder('advance',undefined,'all');assert.equal(b.armyOrder.mode,'advance');for(const group of ['frontline','support'])assert.equal(b.armyOrder.groups[group].anchorX,null);
});
test('invalid target/mode/position and unavailable terrain reject transactionally',()=>{
 for(const args of [['rally','rear','siege'],['rally','rear',null],['rally','rear',{}],['rally',null,'support'],['rally','unknown','support'],['other','rear','frontline']]){const b=fresh(),before=b.armyOrder;assert.equal(b.setArmyOrder(...args),false);assert.deepEqual(b.armyOrder,before);}
 const b=fresh(),terrain=b.elevationAt.bind(b);b.elevationAt=x=>x===500?NaN:terrain(x);assert.equal(b.setArmyOrder('rally','rear','support'),false);assert.equal(b.armyOrder.mode,'advance');
});
test('role snapshots count only responsive troops and are detached values',()=>{
 const b=fresh();for(const type of ['grunt','mount','archer','priest','air','trebuchet'])b.createUnit(type,{team:'good'});
 const carrier=b.createUnit('grunt',{team:'good'});carrier.holdingEnemyFlag=true;
 const dead=b.createUnit('priest',{team:'good'});dead.hp=0;
 const garrison=b.createUnit('archer',{team:'good'});garrison.garrisonBuilding=b.goodCastle;
 assert.equal(b.armyOrder.affected,4);assert.equal(b.armyOrder.groups.frontline.affected,2);assert.equal(b.armyOrder.groups.support.affected,2);
 const snap=b.armyOrder;snap.groups.support.mode='rally';assert.equal(b.armyOrder.groups.support.mode,'advance');
});
test('repeated group hold is idempotent and hero movement never moves either line',()=>{
 const b=fresh(),u=place(b.createUnit('priest',{team:'good'}),500);let interrupts=0;u.interruptAction=()=>interrupts++;
 hold(b,'support','rear');const before=interrupts;for(let i=0;i<20;i++){b.hero.x+=10;hold(b,'support','rear');}
 assert.equal(interrupts,before);assert.equal(b.armyOrder.groups.support.anchorX,600);assert.equal(b.armyOrder.groups.frontline.mode,'advance');
});
for(const type of ['archer','priest'])for(const position of ['rear','center','forward'])test(`${type} really reaches and holds ${position}, without chasing far targets`,()=>{
 const b=fresh(),u=place(b.createUnit(type,{team:'good'}),470),front=place(b.createUnit('grunt',{team:'good'}),1900);front.hp-=30;
 hold(b,'support',position);const x=b.armyOrder.groups.support.anchorX-100;
 if(type==='archer')u.inShotRange=()=>false;
 u.healCooldown=-1;stepUnit(u,3500);assert.ok(Math.abs(u.x-x)<=24,`${u.x} should hold ${x}`);assert.equal(u.vx,0);
 place(u,x+175);stepUnit(u,1500);assert.ok(Math.abs(u.x-x)<=24);assert.equal(u.vx,0);
 assert.equal(front.hp,front.maxHp-30);assert.equal(b.armyOrder.groups.frontline.mode,'advance');
});
for(const type of ['archer','priest'])test(`new ${type} inherits Support hold and advances after release`,()=>{
 const b=fresh();hold(b,'support','center');const u=place(b.createUnit(type,{team:'good'}),500),front=place(b.createUnit('grunt',{team:'good'}),1500);place(b.createUnit('grunt'),1900);
 if(type==='archer')u.inShotRange=()=>false;else front.hp-=20;
 stepUnit(u,3000);assert.ok(Math.abs(u.x-950)<=24);b.setArmyOrder('advance',undefined,'support');stepUnit(u,200);assert.ok(u.x>974);
});
for(const action of ['heal','purge'])test(`held priest ${action}s only a real in-range recipient; distant poisoned allies do not starve nearby injured allies`,()=>{
 const b=fresh(),u=place(b.createUnit('priest',{team:'good'}),500),near=place(b.createUnit('grunt',{team:'good'}),550),far=place(b.createUnit('mount',{team:'good'}),1400);
 hold(b,'support');u.healRange=200;u.healCooldown=-1;near.hp-=20;
 far.effects.effects.push({kind:'poison'});if(action==='purge')near.effects.effects.push({kind:'poison'});
 u.chooseNextAction();assert.equal(u.actionMode,action);assert.equal(u.healTarget,near);
 const requests=[];u.services.queueEffect=request=>requests.push(request);u.actionDuration=-1;u.doAction();assert.equal(requests.length,1);assert.equal(requests[0].target,near);
});
for(const action of ['heal','purge'])test(`held priest never ${action}s at or beyond exact range and retains spell priority inside it`,()=>{
 const b=fresh(),u=place(b.createUnit('priest',{team:'good'}),500),friend=place(b.createUnit('grunt',{team:'good'}),700);
 hold(b,'support');u.healRange=200;u.healCooldown=-1;if(action==='heal')friend.hp-=20;else friend.effects.effects.push({kind:'poison'});
 u.chooseNextAction();assert.equal(u.actionMode,'block');assert.equal(u.vx,0);
 place(friend,699.9);u.chooseNextAction();assert.equal(u.actionMode,action);assert.equal(u.healTarget,friend);
});
for(const action of ['heal','purge'])for(const mutation of ['leaves-range','dies','advance-during-cast'])test(`held ${action} windup finishes safely when recipient ${mutation}`,()=>{
 const b=fresh(),u=place(b.createUnit('priest',{team:'good'}),500),friend=place(b.createUnit('grunt',{team:'good'}),550);
 hold(b,'support');u.healRange=200;u.healCooldown=-1;if(action==='heal')friend.hp-=20;else friend.effects.effects.push({kind:'poison'});
 u.chooseNextAction();assert.equal(u.actionMode,action);const timer=u.actionDuration,requests=[];u.services.queueEffect=request=>requests.push(request);
 if(mutation==='dies')friend.hp=0;else place(friend,1000);
 if(mutation==='advance-during-cast'){b.setArmyOrder('advance',undefined,'support');assert.equal(u.actionDuration,timer);assert.equal(u.actionMode,action);}
 u.actionDuration=-1;u.doAction();assert.equal(requests.length,0);assert.equal(u.healCooldown,u.healCooldownMax);
});
test('a priest already casting when Hold arrives does not gain out-of-range healing',()=>{
 const b=fresh(),u=place(b.createUnit('priest',{team:'good'}),500),friend=place(b.createUnit('grunt',{team:'good'}),550);friend.hp-=20;u.healCooldown=-1;u.chooseNextAction();assert.equal(u.actionMode,'heal');const timer=u.actionDuration;
 hold(b,'support');assert.equal(u.actionDuration,timer);place(friend,1400);const requests=[];u.services.queueEffect=r=>requests.push(r);u.actionDuration=-1;u.doAction();assert.equal(requests.length,0);
});
test('held archer returns to its line before loading, shoots normally there, and never cancels a committed shot',()=>{
 const b=fresh(),u=place(b.createUnit('archer',{team:'good'}),750),enemy=place(b.createUnit('grunt'),800);u.inShotRange=()=>true;hold(b,'support');u.chooseNextAction();assert.equal(u.lastAction,'retreat');
 place(u,500);u.chooseNextAction();assert.equal(u.actionMode,'load_arrow');assert.equal(u.rangedTarget,enemy);const timer=u.actionDuration;hold(b,'support','forward');assert.equal(u.actionDuration,timer);assert.equal(u.actionMode,'load_arrow');
 u.actionDuration=-1;u.doAction();assert.equal(u.actionMode,'aim');b.setArmyOrder('advance',undefined,'support');assert.equal(u.actionMode,'aim');
});
test('held support stays near its line even with no target or when it could otherwise seek a forward garrison',()=>{
 const b=fresh(),u=place(b.createUnit('archer',{team:'good'}),500);u.enemies=[];u.structures=[];u.forwardGarrison=()=>({x:900});hold(b,'support');u.chooseNextAction();assert.equal(u.lastAction,'block');
});
for(const type of ['grunt','archer','priest'])for(const action of ['attack','flinch','knock_back','daze','get_up_daze','pickup_friend_flag','pickup_enemy_flag','capture_flag','die','rot','heal','purge','load_arrow','aim','release_arrow'])test(`${type} command preserves committed ${action}`,()=>{
 const b=fresh(),u=b.createUnit(type,{team:'good'});u.actionMode=action;u.actionDuration=27;hold(b,type==='grunt'?'frontline':'support');assert.equal(u.actionMode,action);assert.equal(u.actionDuration,27);b.setArmyOrder('advance');assert.equal(u.actionDuration,27);
});
test('retaliation and nearby frontline engagements still precede hold movement',()=>{
 const b=fresh(),p=place(b.createUnit('priest',{team:'good'}),500),g=place(b.createUnit('grunt',{team:'good'}),600),e=place(b.createUnit('grunt'),510),f=place(b.createUnit('grunt'),610);
 p.attackedBy.push(e);e.attacking.push(p);g.runner=1;hold(b,'all');p.chooseNextAction();g.chooseNextAction();assert.equal(p.actionMode,'attack');assert.equal(g.actionMode,'attack');assert.ok(g.attacking.includes(f));
});
test('home-flag retrieval and all carriers bypass split company orders',()=>{
 const b=fresh();hold(b,'frontline','forward');hold(b,'support');const rescuer=place(b.createUnit('mount',{team:'good'}),900);b.ownFlag.status=0;b.ownFlag.x=500;rescuer.chooseNextAction();assert.equal(rescuer.lastAction,'retreat');assert.equal(b.armyOrders.frontlineAction(rescuer),null);
 for(const type of ['archer','priest'])assert.equal(b.armyOrders.supportAction(b.createUnit(type,{team:'good'})),null);
 b.ownFlag.status=3;for(const flag of ['holdingFriendFlag','holdingEnemyFlag'])for(const type of ['grunt','archer','priest']){const u=b.createUnit(type,{team:'good'});u[flag]=true;assert.equal(b.armyOrders.activeFor(u),false);}
});
test('garrisoned, dead, destroyed, enemies and companions never obey a support leash',()=>{
 const b=fresh();hold(b,'all');for(const property of ['garrisonBuilding','dead','destroyed','holdingEnemyFlag','holdingFriendFlag','isCompanion','airUnit']){const u=b.createUnit('priest',{team:'good'});u[property]=true;assert.equal(b.armyOrders.supportAction(u),null);}assert.equal(b.armyOrders.supportAction(b.createUnit('priest')),null);
});
test('keep fall releases split groups and cannot strand the last hostile target',()=>{
 const b=fresh();for(let i=0;i<4;i++)place(b.createUnit('grunt',{team:'good',rank:8}),600+i*10);place(b.createUnit('archer',{team:'good',rank:8}),500);place(b.createUnit('priest',{team:'good',rank:8}),500);place(b.createUnit('grunt'),1650);
 hold(b,'frontline','center');hold(b,'support','rear');b.badCastle.takeDamage(b.badCastle.hp);assert.equal(b.armyOrder.mode,'advance');assert.equal(b.armyOrder.groups.support.mode,'advance');assert.equal(b.setArmyOrder('rally','rear','support'),false);
 for(let i=0;i<12000&&!b.summary;i++)b.step();assert.equal(b.outcome,'victory');assert.ok(b.summary);
});
test('paused split orders freeze; outcome, retry and reset never persist them',()=>{
 const b=fresh();hold(b,'support');b.paused=true;const snapshot=b.armyOrder;for(let i=0;i<100;i++)b.step();assert.equal(b.tick,0);assert.deepEqual(b.armyOrder,snapshot);b.finishOutcome('defeat');assert.equal(b.armyOrder.mode,'advance');assert.equal(fresh().armyOrder.mode,'advance');
});
test('all role commands leave gold, reserve, queued tickets, cooldowns, profile and stats unchanged',()=>{
 const b=fresh();b.friendlyQueue.queue.push({type:'archer',rank:4,cost:1});const before=JSON.stringify({save:serializeProfile(b.profile),queue:b.friendlyQueue,stats:b.stats});
 for(const group of ARMY_ORDER_GROUPS)for(const position of ['rear','center','forward']){hold(b,group,position);b.setArmyOrder('advance',undefined,group);}
 assert.equal(JSON.stringify({save:serializeProfile(b.profile),queue:b.friendlyQueue,stats:b.stats}),before);
});
test('split status and markers expose each independent held company',()=>{
 const b=fresh();hold(b,'frontline','forward');hold(b,'support','rear');assert.match(armyOrderStatus(b),/Split orders.*Frontline Forward hold.*Support Rear hold/);
 const calls=[],ctx=new Proxy({},{get:(_,key)=>(...args)=>calls.push([key,args]),set:()=>true});assert.equal(drawArmyOrderMarker(ctx,b),true);
 for(const label of ['FRONTLINE','SUPPORT'])assert.ok(calls.some(([key,args])=>key==='fillText'&&args[0]===label));
 assert.deepEqual(calls.filter(([key])=>key==='translate').map(([,args])=>args[0]),[1500,500]);
});
test('actual battle effects heal a held in-range ally, but never add HP to an out-of-range ally',()=>{
 for(const distance of [100,300]){
  const b=fresh(),p=place(b.createUnit('priest',{team:'good'}),500),friend=place(b.createUnit('grunt',{team:'good'}),500+distance);
  b.enemies.step=()=>null;p.healCooldown=-1;p.healRange=200;friend.hp-=30;const before=friend.hp;friend.transition('block');friend.actionDuration=1000;hold(b,'support');
  for(let i=0;i<30;i++)b.step();assert.equal(friend.hp,distance===100?friend.maxHp:before);assert.ok(Math.abs(p.x-500)<=24);
 }
});
test('real queued recruits inherit Support hold without an extra ticket or actor',()=>{
 const b=fresh();b.enemies.step=()=>null;hold(b,'support');b.friendlyQueue.queue.push({type:'priest',rank:2,cost:1},{type:'archer',rank:2,cost:1});const reserve=b.friendlyQueue.population;
 for(let i=0;i<1600;i++)b.step();const units=b.goodTeam.filter(u=>armyCompany(u)==='support');assert.equal(units.length,2);assert.equal(b.friendlyQueue.queue.length,0);assert.equal(b.friendlyQueue.population,reserve);
 for(const u of units){assert.ok(Math.abs(u.x-500)<=24,`${u.type}: ${u.x}`);assert.equal(b.armyOrders.supportAction(u),'block');}
});
test('an unheld priest keeps legacy committed-cast range semantics',()=>{
 const b=fresh(),p=place(b.createUnit('priest',{team:'good'}),500),friend=place(b.createUnit('grunt',{team:'good'}),550);friend.hp-=30;p.healCooldown=-1;p.chooseNextAction();assert.equal(p.actionMode,'heal');place(friend,1500);const requests=[];p.services.queueEffect=r=>requests.push(r);p.actionDuration=-1;p.doAction();assert.equal(requests.length,1);
});
