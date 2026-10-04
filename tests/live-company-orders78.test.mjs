import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
import {CampaignBattle} from '../site/dist/engine/first-battle.mjs';
import {serializeProfile} from '../site/dist/engine/progression.mjs';
import {createLiveRallyPositionUI} from '../site/dist/army-orders-ui.mjs';
const root=ui=>ui.get('liveRallyPosition'),select=ui=>root(ui).querySelector('select');
const readout=ui=>{const box=root(ui).querySelector('.live-company-order-readout');return [box.querySelector('strong').textContent,box.querySelector('span').textContent];};
const choose=(ui,value)=>{const s=select(ui);s.focus();ui.dispatch(s,'pointerdown');s.value=value;ui.dispatch(s,'change');};
const live=async t=>{const ui=await loadGameUI(t,{search:'?mode=demo'});ui.click('start');ui.frames();return ui;};
const actions=['advance','rear','center','forward'],groups=['all','frontline','support'];
const value=(group,action)=>group==='all'?action:`${group}:${action}`;

test('one existing live slot contains twelve full atomic company/action choices and actual-state readout',async t=>{
 const ui=await live(t),s=select(ui),options=s.querySelectorAll('option');
 assert.equal(options.length,13);assert.equal(options[0].value,'current');assert.equal(options[0].disabled,true);
 for(const g of groups)for(const a of actions){const o=options.find(o=>o.value===value(g,a));assert.ok(o);assert.match(o.textContent,new RegExp(g==='all'?'All ground':g==='frontline'?'Frontline':'Support'));assert.match(o.textContent,new RegExp(a==='advance'?'Advance':a[0].toUpperCase()+a.slice(1)+' hold'));}
 assert.deepEqual(readout(ui),['All ground','Advancing']);assert.equal(s.value,'current');
});
for(const group of groups)for(const action of actions)test(`live ${group} ${action} preserves other company and all economy, time, shots, stats and persistence`,async t=>{
 const ui=await live(t),b=ui.battle;b.setArmyOrder('rally','center','frontline');b.setArmyOrder('rally','rear','support');ui.frames();
 const before={profile:serializeProfile(b.profile),tick:b.tick,population:b.friendlyQueue.population,queue:[...b.friendlyQueue.queue],stats:JSON.stringify(b.stats),shots:b.playerShots,other:group==='all'?null:b.armyOrder.groups[group==='frontline'?'support':'frontline']};
 choose(ui,value(group,action));assert.equal(b.paused,false);
 for(const target of group==='all'?['frontline','support']:[group]){assert.equal(b.armyOrder.groups[target].mode,action==='advance'?'advance':'rally');if(action!=='advance')assert.equal(b.armyOrder.groups[target].position,action);}
 if(group!=='all')assert.deepEqual(b.armyOrder.groups[group==='frontline'?'support':'frontline'],before.other);
 assert.equal(serializeProfile(b.profile),before.profile);assert.equal(b.tick,before.tick);assert.equal(b.friendlyQueue.population,before.population);assert.deepEqual(b.friendlyQueue.queue,before.queue);assert.equal(JSON.stringify(b.stats),before.stats);assert.equal(b.playerShots,before.shots);
 assert.equal(ui.visible('hudToast'),true);const receipt=ui.get('hudToast').textContent;assert.match(receipt,/ordered:/);assert.doesNotMatch(receipt,/arrived|reached|in position/);
 if(group==='support')assert.match(receipt,/Frontline: center hold/);if(group==='frontline')assert.match(receipt,/Support: rear hold/);
 assert.equal(ui.document.activeElement,select(ui));
});

test('native change is the only commit edge; arrows/Enter/Space never leak gameplay or duplicate an order',async t=>{
 const ui=await live(t),b=ui.battle,s=select(ui);let commands=0;const set=b.setArmyOrder.bind(b);b.setArmyOrder=(...args)=>{commands++;return set(...args);};
 s.focus();ui.dispatch(s,'focus');ui.dispatch(s,'keydown',{key:'ArrowDown',code:'ArrowDown'});s.value='support:rear';ui.dispatch(s,'change');assert.equal(commands,1);
 for(const key of ['ArrowDown','ArrowRight','ArrowLeft','d','r',' ','Enter']){ui.dispatch(s,'keydown',{key,code:key});ui.dispatch(s,'keyup',{key,code:key});}
 assert.equal(commands,1);assert.equal(b.input.left,false);assert.equal(b.input.right,false);assert.equal(b.input.space,false);assert.equal(ui.document.activeElement,s);assert.equal(b.armyOrder.groups.frontline.mode,'advance');
 // A further collapsed-select change is an explicit native commit, not a preview.
 s.value='support:center';ui.dispatch(s,'change');assert.equal(commands,2);assert.equal(b.armyOrder.groups.support.position,'center');assert.equal(ui.document.activeElement,s);
 ui.get('battlefield').focus();ui.key('keydown','r');ui.key('keyup','r');assert.equal(b.armyOrder.mode,'advance');assert.equal(commands,3);
});

test('native Escape dismisses without pausing or undoing a committed order; cancel without change issues nothing',async t=>{
 const ui=await live(t),b=ui.battle,s=select(ui);choose(ui,'support:rear');const committed=b.armyOrder;
 s.value='frontline:forward';const {event}=ui.dispatch(s,'keydown',{key:'Escape',code:'Escape'});assert.equal(event.defaultPrevented,false);assert.equal(event.stopped,true);assert.deepEqual(b.armyOrder,committed);assert.equal(b.paused,false);
 ui.get('battlefield').focus();ui.dispatch(s,'blur');assert.equal(s.value,'current');assert.deepEqual(readout(ui),['Support','Rear hold']);assert.deepEqual(b.armyOrder,committed);
});

test('actual order readout refreshes for external changes, R and automatic keep release, never last command text',async t=>{
 const ui=await live(t),b=ui.battle;choose(ui,'support:rear');assert.deepEqual(readout(ui),['Support','Rear hold']);assert.equal(ui.get('liveArmyOrderLabel').textContent,'Split');
 b.setArmyOrder('rally','forward','support');ui.frames();assert.deepEqual(readout(ui),['Support','Forward hold']);assert.equal(select(ui).value,'current');
 ui.get('battlefield').focus();ui.key('keydown','r');ui.key('keyup','r');ui.frames();assert.deepEqual(readout(ui),['All ground','Advancing']);
 choose(ui,'frontline:center');b.badCastle.takeDamage(b.badCastle.hp);ui.frames();assert.deepEqual(readout(ui),['All ground','Advancing']);assert.equal(select(ui).disabled,true);
});

test('paused Army changes refresh the live company readout without changing Army target state',async t=>{
 const ui=await live(t);choose(ui,'support:rear');ui.click('battlePause');ui.click('pauseQueue');
 const panel=ui.get('armyOrders'),target=panel.querySelector('select');target.value='support';ui.dispatch(target,'change');panel.querySelector('[data-rally-position="center"]').click();
 ui.click('closeQueue');ui.click('resumeGame');ui.frames();assert.deepEqual(readout(ui),['Support','Center hold']);assert.equal(target.value,'support');
});

test('unchanged frame renders preserve native option navigation while readout stays actual; repeated committed order is idempotent',async t=>{
 const ui=await live(t),b=ui.battle;choose(ui,'support:center');const s=select(ui),before=b.armyOrder;s.value='frontline:forward';
 // Drive UI render only: advancing world time would change eligible troop counts.
 const isolated=ui.document.createElement('div');ui.document.appendChild(isolated);const state={battle:b,active:true,started:true,visible:true};const view=createLiveRallyPositionUI({root:isolated,getState:()=>state});view.render();const native=isolated.querySelector('select'),summary=isolated.querySelector('option');let text=summary.textContent,writes=0;Object.defineProperty(summary,'textContent',{get:()=>text,set:value=>{text=value;writes++;}});native.value='support:forward';for(let i=0;i<100;i++)view.render();assert.equal(writes,0);assert.equal(native.value,'support:forward');assert.deepEqual(b.armyOrder,before);
 choose(ui,'support:center');assert.deepEqual(b.armyOrder,before);assert.deepEqual(readout(ui),['Support','Center hold']);
});

test('new battle resets current readout and rejects a stale native change even after rendering the replacement',async t=>{
 const ui=await live(t),host=ui.document.createElement('div');ui.document.appendChild(host);const state={battle:ui.battle,active:true,started:true,visible:true};let changed=0;const view=createLiveRallyPositionUI({root:host,getState:()=>state,onChanged:()=>changed++});view.render();const s=host.querySelector('select');s.value='support:rear';ui.dispatch(s,'change');assert.equal(changed,1);
 state.battle=new CampaignBattle();view.render();assert.equal(host.querySelector('strong').textContent,'All ground');assert.equal(host.querySelector('.live-company-order-readout').querySelector('span').textContent,'Advancing');assert.equal(s.value,'current');
 s.value='support:forward';ui.dispatch(s,'change');assert.equal(changed,1);assert.equal(state.battle.armyOrder.mode,'advance');
 ui.dispatch(s,'pointerdown');s.value='support:forward';ui.dispatch(s,'change');assert.equal(changed,2);assert.equal(state.battle.armyOrder.groups.support.position,'forward');
});

test('all command options reject preparation, pause, inactive, hidden, drills, invalid hero and settlement',async t=>{
 const ui=await live(t);
 for(const mutation of [s=>s.started=false,s=>s.active=false,s=>s.visible=false,s=>s.readOnly=true,s=>s.battle.paused=true,s=>s.battle.hero.hp=0,s=>s.battle.hero.x=NaN,s=>s.battle.outcome='victory',s=>s.battle.summary={outcome:'victory'}]){
  const host=ui.document.createElement('div');ui.document.appendChild(host);const state={battle:new CampaignBattle(),active:true,started:true,visible:true};let changed=0;const view=createLiveRallyPositionUI({root:host,getState:()=>state,onChanged:()=>changed++});view.render();mutation(state);const s=host.querySelector('select');
  for(const group of groups)for(const action of actions){s.value=value(group,action);ui.dispatch(s,'change');assert.equal(state.battle.armyOrder.mode,'advance');assert.equal(s.value,'current');}assert.equal(changed,0);
 }
});

test('a direct company order preserves an active draw and queued shot identity without creating a shot',async t=>{
 const ui=await live(t),b=ui.battle,canvas=ui.get('battlefield'),origin=b.hero.launchPosition;
 ui.pointer('pointerdown',47,{x:origin.x,y:origin.y},canvas);ui.pointer('pointermove',47,{x:origin.x-80,y:origin.y+20},canvas);
 const before={shooter:b.shooter.active,pointer:{...b.shooter.pointer},shots:b.playerShots,fire:b.shooter.fired};const s=select(ui);s.value='support:rear';ui.dispatch(s,'change');
 assert.equal(b.shooter.active,before.shooter);assert.deepEqual(b.shooter.pointer,before.pointer);assert.equal(b.playerShots,before.shots);assert.equal(b.shooter.fired,before.fire);assert.equal(canvas.hasPointerCapture(47),true);
 ui.pointer('pointercancel',47,{x:origin.x-80,y:origin.y+20},canvas);
});

test('two-line live command readout stays within the existing 44px slot and full native options remain readable',()=>{
 const css=readFileSync(new URL('../site/dist/army-orders.css',import.meta.url),'utf8');assert.match(css,/#liveRallyPosition\{position:relative;width:100px;height:44px/);assert.match(css,/#liveRallyPosition\{width:91px\}/);assert.match(css,/\.live-company-order-readout\{[^}]*pointer-events:none/);assert.match(css,/\.live-rally-position-select option\{color:#ebd7ad;background:#30222d/);assert.match(css,/#liveRallyPosition\[data-holding\] \.live-rally-position-select\{[^}]*color:transparent;background:transparent;border-color:transparent;box-shadow:none;text-shadow:none/);assert.ok(css.lastIndexOf('#liveRallyPosition[data-holding] .live-rally-position-select{')>css.indexOf('#liveRallyPosition[data-holding=true] .live-rally-position-select{'));
});

test('native keyboard traversal commits each intermediate option to only its explicitly named company',async t=>{
 const ui=await live(t),b=ui.battle,s=select(ui);s.focus();ui.dispatch(s,'focus');
 for(const group of groups)for(const action of actions){
  const other=group==='frontline'?'support':'frontline',before=b.armyOrder.groups[other];
  ui.dispatch(s,'keydown',{key:'ArrowDown',code:'ArrowDown'});s.value=value(group,action);ui.dispatch(s,'change');ui.dispatch(s,'keyup',{key:'ArrowDown',code:'ArrowDown'});
  if(group!=='all')assert.deepEqual(b.armyOrder.groups[other],before);
  const order=b.armyOrder.groups[group==='all'?'frontline':group];assert.equal(order.mode,action==='advance'?'advance':'rally');if(action!=='advance')assert.equal(order.position,action);
  assert.equal(ui.document.activeElement,s);assert.equal(b.input.right,false);assert.equal(b.input.left,false);assert.equal(b.paused,false);
 }
 const before=b.armyOrder;ui.dispatch(s,'keydown',{key:'Enter',code:'Enter'});ui.dispatch(s,'keydown',{key:'Escape',code:'Escape'});assert.deepEqual(b.armyOrder,before);assert.equal(b.paused,false);
});

test('live company readout retains early-Causeway orders then refreshes when occupation automatically releases both',async t=>{
 // Controlled objective fixture; this is not a native or natural balance result.
 const ui=await loadGameUI(t,{search:'?mode=skirmish&sk=SK1:16:oaks:scout:causeway'});ui.click('skirmishPrepare');ui.click('start');ui.frames();const b=ui.battle;
 choose(ui,'frontline:center');choose(ui,'support:rear');b.badCastle.takeDamage(b.badCastle.hp);ui.frames();assert.equal(b.armyOrder.mode,'split');assert.deepEqual(readout(ui),['Support','Rear hold']);assert.equal(select(ui).disabled,false);assert.equal(ui.visible('hudToast'),true);
 b.hero.leaveGarrison();b.hero.x=1050;b.hero.y=b.elevationAt(1050);for(const u of b.badTeam){u.x=1600;u.y=b.elevationAt(1600);}for(let n=0;n<989;n++){b.tick++;b.causewayObjective.afterTick();}ui.frames();
 assert.equal(b.objectiveProgress.secured,true);assert.equal(b.armyOrder.mode,'advance');assert.deepEqual(readout(ui),['All ground','Advancing']);assert.equal(select(ui).disabled,true);assert.equal(select(ui).value,'current');assert.equal(ui.visible('hudToast'),false);
});

test('R, external company change, keep release and battle replacement immediately clear only the issued company receipt',async t=>{
 const ui=await live(t),b=ui.battle;
 choose(ui,'support:rear');assert.equal(ui.visible('hudToast'),true);ui.get('battlefield').focus();ui.key('keydown','r');ui.key('keyup','r');assert.equal(ui.visible('hudToast'),false);
 choose(ui,'support:rear');b.setArmyOrder('rally','center','support');assert.equal(ui.visible('hudToast'),false);
 choose(ui,'support:rear');b.badCastle.takeDamage(b.badCastle.hp);assert.equal(ui.visible('hudToast'),false);
 // New battle through the real restart flow also invalidates the old owner.
 ui.click('battlePause');ui.click('battleRestart');ui.click('confirmRestart');ui.click('start');ui.frames();choose(ui,'support:rear');assert.equal(ui.visible('hudToast'),true);const previous=ui.battle;
 ui.click('battlePause');ui.click('battleRestart');ui.click('confirmRestart');assert.notEqual(ui.battle,previous);assert.equal(ui.visible('hudToast'),false);
});
for(const trigger of ['R','keep'])test(`an unrelated real insufficient-gold toast survives ${trigger} after replacing the company receipt`,async t=>{
 const ui=await live(t),b=ui.battle;choose(ui,'support:rear');const prior=ui.get('hudToast').textContent;
 const grunt=b.profile.skills.find(s=>s.id==='grunt');b.profile.gold=0;grunt.cooldown=0;b.hotbar.bar=Math.floor(grunt.binding/10);ui.frames();ui.click('quick-grunt');ui.frames();const warning=ui.get('hudToast').textContent;
 assert.notEqual(warning,prior);assert.match(warning,/gold/i);assert.equal(ui.visible('hudToast'),true);
 if(trigger==='R'){ui.get('battlefield').focus();ui.key('keydown','r');ui.key('keyup','r');}else b.badCastle.takeDamage(b.badCastle.hp);
 assert.equal(ui.visible('hudToast'),true);assert.equal(ui.get('hudToast').textContent,warning);
});
