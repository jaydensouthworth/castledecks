import test from 'node:test';
import assert from 'node:assert/strict';
import {CampaignBattle} from '../site/dist/engine/first-battle.mjs';
import {createArmyOrdersUI,createLiveRallyPositionUI} from '../site/dist/army-orders-ui.mjs';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
const selectGroup=(ui,group)=>{const select=ui.get('armyOrders').querySelector('select');select.value=group;ui.dispatch(select,'change');return select;};
const order=(ui,mode)=>ui.get('armyOrders').querySelector(`[data-army-order="${mode}"]`).click();
const line=(ui,position)=>ui.get('armyOrders').querySelector(`[data-rally-position="${position}"]`).click();
const prepare=async t=>{const ui=await loadGameUI(t,{search:'?mode=demo'});ui.click('start');ui.frames();ui.click('battlePause');ui.click('openQueue');return ui;};

test('Army selector changes focus only; existing controls command the visibly selected company',async t=>{
 const ui=await prepare(t),b=ui.battle,before=b.armyOrder,select=selectGroup(ui,'support');assert.deepEqual(b.armyOrder,before);assert.equal(select.value,'support');assert.match(select.getAttribute('aria-label'),/Orders for/);
 line(ui,'rear');assert.equal(b.armyOrder.groups.support.mode,'rally');assert.equal(b.armyOrder.groups.frontline.mode,'advance');assert.match(ui.get('armyOrders').querySelector('.army-order-status').textContent,/Orders for Support.*Frontline advancing.*Support Rear hold/);
 selectGroup(ui,'frontline');line(ui,'forward');assert.equal(b.armyOrder.mode,'split');assert.equal(b.armyOrder.groups.support.position,'rear');assert.equal(b.armyOrder.groups.frontline.position,'forward');
 order(ui,'advance');assert.equal(b.armyOrder.groups.frontline.mode,'advance');assert.equal(b.armyOrder.groups.support.mode,'rally');
 selectGroup(ui,'all');order(ui,'advance');assert.equal(b.armyOrder.mode,'advance');
});
test('split orders are disclosed on both existing live controls; R explicitly advances both',async t=>{
 const ui=await prepare(t),b=ui.battle;selectGroup(ui,'frontline');line(ui,'forward');selectGroup(ui,'support');line(ui,'rear');ui.click('closeQueue');ui.click('resumeGame');ui.frames();
 assert.equal(ui.get('liveArmyOrderLabel').textContent,'Split');assert.match(ui.get('liveArmyOrder').getAttribute('aria-label'),/Split company orders.*All ground.*Release both companies/);
 const select=ui.get('liveRallyPosition').querySelector('select');assert.equal(select.value,'current');assert.match(select.getAttribute('aria-label'),/Companies: Split orders.*all-ground button always targets both/);
 ui.get('battlefield').focus();ui.key('keydown','r');ui.key('keyup','r');assert.equal(b.armyOrder.mode,'advance');for(const g of ['frontline','support'])assert.equal(b.armyOrder.groups[g].mode,'advance');assert.equal(b.paused,false);
});
test('live line selector replaces both split orders without changing resources, time, pause or shot queue',async t=>{
 const ui=await prepare(t),b=ui.battle;selectGroup(ui,'support');line(ui,'rear');ui.click('closeQueue');ui.click('resumeGame');ui.frames();
 const before={tick:b.tick,gold:b.profile.gold,reserve:b.friendlyQueue.population},shots=b.playerShots,select=ui.get('liveRallyPosition').querySelector('select');select.value='center';ui.dispatch(select,'change');
 assert.equal(b.armyOrder.mode,'rally');for(const g of ['frontline','support'])assert.equal(b.armyOrder.groups[g].position,'center');assert.deepEqual({tick:b.tick,gold:b.profile.gold,reserve:b.friendlyQueue.population},before);assert.equal(b.playerShots,shots);assert.equal(b.paused,false);
});
test('reopening Army keeps one visible selected group and does not silently alter orders',async t=>{
 const ui=await prepare(t),b=ui.battle;selectGroup(ui,'support');line(ui,'center');const orders=b.armyOrder;
 for(let i=0;i<3;i++){ui.click('closeQueue');ui.click('openQueue');assert.equal(ui.get('armyOrders').querySelector('select').value,'support');assert.deepEqual(b.armyOrder,orders);}
});
test('company selector uses existing SELECT keyboard guard and never dispatches gameplay keys',async t=>{
 const ui=await prepare(t),b=ui.battle,select=selectGroup(ui,'support');select.focus();ui.key('keydown','r',{target:select});ui.key('keydown','d',{target:select});assert.equal(b.armyOrder.mode,'advance');assert.equal(b.input.right,false);
});
test('a new battle resets visible target to All ground and stale callbacks cannot issue orders',async t=>{
 const ui=await prepare(t),root=ui.document.createElement('div');ui.document.appendChild(root);const state={battle:ui.battle,active:true,started:true,readOnly:false};let changes=0;
 const view=createArmyOrdersUI({root,getState:()=>state,onChanged:()=>changes++});view.render();const select=root.querySelector('select');select.value='support';ui.dispatch(select,'change');assert.equal(select.value,'support');const stale=root.querySelector('[data-rally-position="forward"]');state.battle=new CampaignBattle();stale.click();assert.equal(changes,0);assert.equal(state.battle.armyOrder.mode,'advance');view.render();assert.equal(select.value,'all');
});
test('group commands retain preparation, paused, inactive, guided, outcome and stale guards',async t=>{
 const ui=await prepare(t);for(const mutate of [s=>{s.started=false;},s=>{s.active=false;},s=>{s.readOnly=true;},s=>{s.battle.outcome='victory';},s=>{s.battle.summary={outcome:'victory'};}]){
  const root=ui.document.createElement('div');ui.document.appendChild(root);const state={battle:new CampaignBattle(),active:true,started:true,readOnly:false};const view=createArmyOrdersUI({root,getState:()=>state});view.render();const select=root.querySelector('select');select.value='support';ui.dispatch(select,'change');mutate(state);ui.dispatch(root.querySelector('[data-army-order="rally"]'),'click');assert.equal(state.battle.armyOrder.mode,'advance');
 }
});
test('split live display preserves uncommitted native choice during repeated render and rejects invalid option',async t=>{
 const ui=await prepare(t),root=ui.document.createElement('div');ui.document.appendChild(root);const b=ui.battle;b.setArmyOrder('rally','rear','support');b.paused=false;const state={battle:b,active:true,started:true,readOnly:false,visible:true};const view=createLiveRallyPositionUI({root,getState:()=>state});view.render();const select=root.querySelector('select');assert.equal(select.value,'current');select.value='forward';for(let i=0;i<100;i++)view.render();assert.equal(select.value,'forward');assert.equal(b.armyOrder.mode,'split');ui.dispatch(select,'change');assert.equal(b.armyOrder.mode,'rally');assert.equal(b.armyOrder.groups.support.position,'forward');
 select.value='split';ui.dispatch(select,'change');assert.equal(b.armyOrder.mode,'rally');assert.equal(select.value,'current');
});
test('split Army control still uses the remapped order key and announces all-ground override',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=demo'});ui.click('introSettings');ui.click('openControls');ui.click('control-armyOrder');ui.key('keydown','h');ui.click('applyControls');ui.click('closeSettings');ui.click('start');ui.frames();const b=ui.battle;b.setArmyOrder('rally','rear','support');ui.frames();assert.match(ui.get('liveArmyOrder').getAttribute('aria-label'),/Split.*All ground.*H/);
 ui.key('keydown','r');ui.key('keyup','r');assert.equal(b.armyOrder.mode,'split');ui.key('keydown','h');ui.key('keyup','h');assert.equal(b.armyOrder.mode,'advance');
});
