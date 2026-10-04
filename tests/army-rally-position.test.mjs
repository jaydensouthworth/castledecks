import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CampaignBattle} from '../site/dist/engine/first-battle.mjs';
import {PlayerProfile,serializeProfile} from '../site/dist/engine/progression.mjs';
import {seededRandom} from '../site/dist/engine/combat.mjs';
import {ARMY_RALLY_POSITIONS,armyRallyAnchor} from '../site/dist/engine/army-orders.mjs';
import {createLiveRallyPositionUI,armyOrderStatus,drawArmyOrderMarker} from '../site/dist/army-orders-ui.mjs';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
const fresh=()=>new CampaignBattle({profile:new PlayerProfile(),random:seededRandom(83)});
const place=(u,x)=>{u.x=x;u.y=u.world.elevationAt(x);u.vx=0;u.actionDuration=0;return u;};
const positions={rear:600,center:1050,forward:1500};

test('named anchors have meaningful spacing and stay bounded across every campaign terrain',()=>{
 assert.deepEqual(ARMY_RALLY_POSITIONS,['rear','center','forward']);
 for(let level=1;level<=30;level++){
  const b=new CampaignBattle({level,random:seededRandom(level)});
  for(const [position,anchor]of Object.entries(positions)){
   assert.equal(b.setArmyOrder('rally',position),true);assert.equal(b.armyOrder.position,position);assert.equal(b.armyOrder.anchorX,anchor);assert.ok(Number.isFinite(b.elevationAt(anchor)));
   for(const heroX of [-1000,325,1050,1900,10000]){b.hero.x=heroX;assert.equal(b.setArmyOrder('rally',position),true);assert.equal(b.armyOrder.anchorX,anchor);}
  }
 }
});
for(const position of ARMY_RALLY_POSITIONS)for(const type of ['grunt','tallGrunt','mount','fireDemon','iceDemon'])test(`${type} reaches and leaves ${position} line using its normal action loop`,()=>{
 const b=fresh(),u=place(b.createUnit(type,{team:'good'}),480);b.setArmyOrder('rally',position);const x=b.armyOrder.anchorX;
 for(let i=0;i<2400;i++)u.step();assert.ok(Math.abs(u.x-x)<=24,`${type} stopped at ${u.x}`);assert.equal(u.actionMode,'block');assert.equal(u.vx,0);
 b.setArmyOrder('rally','rear');for(let i=0;i<2400;i++)u.step();assert.ok(Math.abs(u.x-600)<=24);assert.equal(u.actionMode,'block');
 b.setArmyOrder('advance');for(let i=0;i<300;i++)u.step();assert.ok(u.x>624);
});
test('repeated position commands are idempotent and Advance remembers the chosen line',()=>{
 const events=[],b=new CampaignBattle({onEvent:e=>{if(e.type==='army-order')events.push(e);}}),u=place(b.createUnit('grunt',{team:'good'}),700);let interrupted=0;const interrupt=u.interruptAction.bind(u);u.interruptAction=()=>{interrupted++;interrupt();};
 u.chooseNextAction();b.setArmyOrder('rally','forward');const changes=interrupted;
 for(let i=0;i<12;i++){b.hero.x+=25;b.setArmyOrder('rally','forward');}assert.equal(events.length,1);assert.equal(interrupted,changes);assert.equal(b.armyOrder.anchorX,1500);
 b.setArmyOrder('advance');assert.equal(b.armyOrder.anchorX,null);assert.equal(b.armyOrder.position,'forward');b.hero.x=500;b.setArmyOrder('rally');assert.equal(b.armyOrder.anchorX,1500);assert.equal(events.length,3);
 b.finishOutcome('victory');assert.deepEqual(b.armyOrder,{...fresh().armyOrder,mode:'advance',position:'rear',anchorX:null,affected:1,groups:{frontline:{mode:'advance',position:'rear',anchorX:null,affected:1},support:{mode:'advance',position:'rear',anchorX:null,affected:0}}});assert.equal(fresh().armyOrder.position,'rear');
});
test('invalid positions and dead or settled battles reject commands without mutations',()=>{
 for(const position of ['','left','REAR',null,0,Infinity]){const b=fresh(),before=b.armyOrder;assert.equal(b.setArmyOrder('rally',position),false);assert.deepEqual(b.armyOrder,before);}
 for(const stop of [b=>b.hero.takeDamage(1e9),b=>{b.hero.hp=0;},b=>b.badCastle.takeDamage(1e9),b=>b.finishOutcome('defeat'),b=>{b.summary={outcome:'victory'};}]){
  const b=fresh();stop(b);const before=b.armyOrder;for(const position of ARMY_RALLY_POSITIONS)assert.equal(b.setArmyOrder('rally',position),false);assert.deepEqual(b.armyOrder,before);
 }
 for(const width of [NaN,Infinity,-1,0])assert.equal(armyRallyAnchor({...fresh(),width},'rear'),null);
 const b=fresh();b.width=900;b.goodCastle.x=-9999;b.badCastle.x=9999;for(const p of ARMY_RALLY_POSITIONS)assert.ok(armyRallyAnchor(b,p)>=450&&armyRallyAnchor(b,p)<=550);
});
test('friendly keep loss leaves rally available while the hero and flag defend the battle',()=>{const b=fresh();b.createUnit('grunt');b.goodCastle.takeDamage(b.goodCastle.hp);assert.equal(b.outcome,null);for(const p of ARMY_RALLY_POSITIONS){assert.equal(b.setArmyOrder('rally',p),true);assert.equal(b.armyOrder.anchorX,positions[p]);}});
test('position changes do not alter resources, save data, queue tickets, cooldowns or battle stats',()=>{
 const b=fresh();b.friendlyQueue.queue.push({type:'grunt',cost:1});const before=JSON.stringify({profile:serializeProfile(b.profile),queue:b.friendlyQueue,stats:b.stats});
 for(const p of ARMY_RALLY_POSITIONS){b.setArmyOrder('rally',p);b.setArmyOrder('advance');}
 assert.equal(JSON.stringify({profile:serializeProfile(b.profile),queue:b.friendlyQueue,stats:b.stats}),before);
});
test('repositioning preserves nearby combat, active attack timers, flag carriers and home-flag emergencies',()=>{
 const b=fresh(),u=place(b.createUnit('mount',{team:'good'}),1040),enemy=place(b.createUnit('grunt'),1055);b.setArmyOrder('rally','center');u.chooseNextAction();assert.equal(u.actionMode,'attack');assert.ok(u.attacking.includes(enemy));const timer=u.actionDuration;
 b.setArmyOrder('rally','rear');assert.equal(u.actionMode,'attack');assert.equal(u.actionDuration,timer);
 for(const flag of ['holdingEnemyFlag','holdingFriendFlag']){const carrier=place(b.createUnit('grunt',{team:'good'}),900);carrier[flag]=true;b.setArmyOrder('rally','forward');assert.equal(b.armyOrders.frontlineAction(carrier),null);carrier.chooseNextAction();assert.equal(carrier.lastAction,'retreat');}
 const rescuer=place(b.createUnit('grunt',{team:'good'}),900);b.ownFlag.status=0;b.ownFlag.x=500;b.setArmyOrder('rally','center');assert.equal(b.armyOrders.frontlineAction(rescuer),null);rescuer.chooseNextAction();assert.equal(rescuer.lastAction,'retreat');
});
test('archers pursue only to their selected support line and still shoot nearby targets',()=>{
 for(const [p,x]of Object.entries(positions)){
  const b=fresh(),u=place(b.createUnit('archer',{team:'good'}),x),target=place(b.createUnit('grunt'),1900);b.setArmyOrder('rally',p);u.inShotRange=()=>false;u.chooseNextAction();assert.equal(u.lastAction,'retreat');place(u,x-100);u.chooseNextAction();assert.equal(u.lastAction,'block');u.inShotRange=()=>true;u.chooseNextAction();assert.equal(u.actionMode,'load_arrow');assert.ok(target.hp>0);
 }
});
test('keep defeat releases any chosen line and normal battle cleanup reaches a real outcome',()=>{
 for(const p of ARMY_RALLY_POSITIONS){
  const b=fresh();for(let i=0;i<4;i++)place(b.createUnit('grunt',{team:'good',rank:8}),600+i*10);place(b.createUnit('grunt'),1650);b.setArmyOrder('rally',p);b.badCastle.takeDamage(b.badCastle.hp);
  assert.equal(b.armyOrder.mode,'advance');assert.equal(b.enemies.remaining,0);assert.equal(b.setArmyOrder('rally',p),false);
  for(let i=0;i<12000&&!b.summary;i++)b.step();assert.ok(b.outcome,`no outcome after keep fell with ${p} chosen`);assert.ok(b.summary);assert.equal(b.armyOrder.mode,'advance');
 }
});
test('marker identifies the selected named line without changing renderer arguments',()=>{
 const b=fresh(),calls=[],ctx=new Proxy({},{get:(_,p)=>(...args)=>calls.push([p,args]),set:()=>true});
 for(const p of ARMY_RALLY_POSITIONS){calls.length=0;b.setArmyOrder('rally',p);assert.equal(drawArmyOrderMarker(ctx,b,.4),true);assert.ok(calls.some(([fn,args])=>fn==='translate'&&args[0]===positions[p]));assert.ok(calls.some(([fn,args])=>fn==='fillText'&&args[0]===p.toUpperCase()));assert.match(armyOrderStatus(b),new RegExp('^'+p,'i'));}
 b.setArmyOrder('advance');assert.equal(drawArmyOrderMarker(ctx,b),false);assert.match(armyOrderStatus(b),/forward line ready/);
});

function mountLive(ui){
 const root=ui.document.createElement('div'),state={battle:ui.battle,active:true,started:true,readOnly:false,visible:true};ui.document.appendChild(root);let changes=0;
 const control=createLiveRallyPositionUI({root,getState:()=>state,onChanged:()=>{changes++;}});control.render();const select=root.querySelector('select');
 const choose=p=>{select.value=p;ui.dispatch(select,'change');};return {root,state,control,select,choose,get changes(){return changes;}};
}
test('Army panel exposes accessible direct Rear/Center/Forward commands that work paused',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=demo'});ui.click('start');ui.frames();ui.click('battlePause');ui.click('openQueue');assert.equal(ui.battle.paused,true);
 const buttons=ui.get('armyOrders').querySelectorAll('[data-rally-position]');assert.deepEqual(buttons.map(b=>b.getAttribute('data-rally-position')),ARMY_RALLY_POSITIONS);
 for(const button of buttons){button.click();const p=button.getAttribute('data-rally-position');assert.equal(ui.battle.armyOrder.position,p);assert.equal(ui.battle.armyOrder.anchorX,positions[p]);assert.equal(button.getAttribute('aria-pressed'),'true');assert.match(button.getAttribute('aria-label'),/Rally/);assert.match(ui.get('armyOrders').querySelector('.army-order-status').textContent,/Movement resumes/);}
 const tick=ui.battle.tick;ui.frames(20);assert.equal(ui.battle.tick,tick);ui.click('closeQueue');ui.click('resumeGame');ui.frames();assert.equal(ui.battle.armyOrder.position,'forward');assert.equal(ui.battle.paused,false);
});
test('live native selection orders a line without pausing, spending or canceling queued shots',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=demo'});ui.click('start');ui.frames();const b=ui.battle,live=mountLive(ui),before=serializeProfile(b.profile),shots=b.playerShots;
 for(const p of ARMY_RALLY_POSITIONS){live.choose(p);assert.equal(b.armyOrder.position,p);assert.equal(b.armyOrder.anchorX,positions[p]);assert.equal(live.select.value,p);assert.equal(b.paused,false);assert.equal(live.root.getAttribute('data-holding'),'true');}
 assert.equal(live.changes,3);assert.equal(serializeProfile(b.profile),before);assert.equal(b.playerShots,shots);
 // Keyboard focus uses the existing SELECT text-input guard, not a new global listener.
 live.select.focus();ui.key('keydown','r',{target:live.select});assert.equal(b.armyOrder.mode,'rally');ui.key('keydown','ArrowLeft',{target:live.select});assert.equal(b.input.left,false);
 ui.get('battlefield').focus();ui.key('keydown','r');assert.equal(b.armyOrder.mode,'advance');ui.key('keyup','r');ui.key('keydown','r');assert.equal(b.armyOrder.mode,'rally');assert.equal(b.armyOrder.position,'forward');assert.equal(b.armyOrder.anchorX,1500);
});
test('live control leaves an in-progress native choice alone during unchanged frame renders',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=demo'});ui.click('start');ui.frames();const live=mountLive(ui);live.select.value='center';for(let i=0;i<100;i++)live.control.render();assert.equal(live.select.value,'center');assert.equal(ui.battle.armyOrder.position,'rear');ui.dispatch(live.select,'change');assert.equal(ui.battle.armyOrder.position,'center');
});
test('live selection guards paused, inactive, preparation, hidden, guided, stale and settled flows',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=demo'});ui.click('start');ui.frames();
 for(const mutate of [x=>{x.state.active=false;},x=>{x.state.started=false;},x=>{x.state.visible=false;},x=>{x.state.readOnly=true;},x=>{x.state.battle.paused=true;},x=>{x.state.battle=fresh();},x=>{x.state.battle.hero.hp=0;},x=>{x.state.battle.outcome='victory';},x=>{x.state.battle.summary={outcome:'defeat'};}]){
  const live=mountLive(ui),original=fresh();live.state.battle=original;live.control.render();mutate(live);live.choose('forward');assert.equal(original.armyOrder.mode,'advance');assert.equal(live.state.battle.armyOrder.mode,'advance');assert.equal(live.changes,0);assert.equal(live.select.value,'current');
 }
});
test('live selector and panel fit existing 390px portrait / 740px landscape source constraints',()=>{
 const css=readFileSync(new URL('../site/dist/army-orders.css',import.meta.url),'utf8');assert.match(css,/\.live-rally-position-select\{[^}]*min-height:44px;[^}]*height:44px/);assert.match(css,/\.live-rally-position-select\{width:91px/);assert.match(css,/grid-template-columns:minmax\(0,1fr\) auto auto/);
 // Existing lane bounds: portrait uses the full safe width, short landscape
 // reserves106px for movement. Caption controls stay in their existing row.
 for(const [width,movement,inset,orderWidth,selectWidth,padding]of[[390,0,12,82,91,12],[740,106,44,94,100,10]]){const lane=width-movement-inset*2;const free=lane-orderWidth-selectWidth-padding-10;assert.ok(free>=100,`${free}px left for current skill`);}
});
