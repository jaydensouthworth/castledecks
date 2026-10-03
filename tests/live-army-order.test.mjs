import test from 'node:test';import assert from 'node:assert/strict';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
import {MemoryStorage} from './helpers/local-storage.mjs';
import {CONTROL_STORAGE_KEY,DEFAULT_CONTROL_BINDINGS,createControlBindings,migrateControlBindings} from '../site/dist/control-bindings.mjs';
test('legacy default keys migrate without writes or changes to the original ten actions',()=>{
 const legacy={...DEFAULT_CONTROL_BINDINGS};delete legacy.armyOrder;const storage=new MemoryStorage();storage.data.set(CONTROL_STORAGE_KEY,JSON.stringify({version:1,bindings:legacy}));const c=createControlBindings({getStorage:()=>storage});for(const [key,value]of Object.entries(legacy))assert.equal(c.bindings[key],value);assert.equal(c.bindings.armyOrder,'r');assert.equal(storage.writes,0);assert.equal(c.apply(c.bindings).persisted,true);assert.equal(JSON.parse(storage.getItem(CONTROL_STORAGE_KEY)).version,2);
});
test('legacy custom R mapping is preserved and Rally receives a free key',()=>{
 const legacy={...DEFAULT_CONTROL_BINDINGS,arc:'r',left:'arrowleft'};delete legacy.armyOrder;const migrated=migrateControlBindings(legacy);assert.equal(migrated.arc,'r');assert.equal(migrated.left,'arrowleft');assert.equal(migrated.armyOrder,'b');assert.equal(migrateControlBindings({...legacy,arc:'g'}),null);
});
test('live order click and key issue/cancel a fixed line without pausing or spending',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=demo'}),b=ui.battle;assert.equal(ui.get('liveArmyOrder').disabled,true);ui.click('start');ui.frames();const gold=b.profile.gold,reserve=b.friendlyQueue.population,tick=b.tick;ui.click('liveArmyOrder');assert.equal(b.armyOrder.mode,'rally');assert.equal(b.paused,false);assert.equal(b.tick,tick);assert.equal(b.profile.gold,gold);assert.equal(b.friendlyQueue.population,reserve);assert.equal(ui.get('liveArmyOrderLabel').textContent,'Rally');const anchor=b.armyOrder.anchorX;ui.key('keydown','r',{repeat:true});assert.equal(b.armyOrder.anchorX,anchor);ui.key('keydown','r');assert.equal(b.armyOrder.mode,'advance');ui.key('keyup','r');assert.equal(b.input.left,false);assert.equal(b.input.right,false);
});
test('live order ignores preparation, pause, text, modifiers, guided drills and settlement',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=demo'}),b=ui.battle;ui.click('liveArmyOrder');ui.key('keydown','r');assert.equal(b.armyOrder.mode,'advance');ui.click('start');ui.frames();ui.key('keydown','r',{ctrlKey:true});assert.equal(b.armyOrder.mode,'advance');ui.click('battlePause');ui.key('keydown','r');ui.click('liveArmyOrder');assert.equal(b.armyOrder.mode,'advance');ui.click('pauseSkills');ui.get('loadoutSearch').focus();ui.key('keydown','r',{target:ui.get('loadoutSearch')});assert.equal(b.armyOrder.mode,'advance');ui.click('closeSkills');ui.click('resumeGame');ui.frames();b.hero.takeDamage(1e9);ui.frames();ui.click('liveArmyOrder');assert.equal(b.armyOrder.mode,'advance');
});
test('ground-line key remaps through existing controls and labels follow the new mapping',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=demo'});ui.click('introSettings');ui.click('openControls');ui.click('control-armyOrder');ui.key('keydown','h');ui.click('applyControls');ui.click('closeSettings');ui.click('start');ui.frames();ui.key('keydown','r');assert.equal(ui.battle.armyOrder.mode,'advance');ui.key('keydown','h');assert.equal(ui.battle.armyOrder.mode,'rally');ui.frames();assert.match(ui.get('liveArmyOrder').getAttribute('aria-label'),/H/);
});
