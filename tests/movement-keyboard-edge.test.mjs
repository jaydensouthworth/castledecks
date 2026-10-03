import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
import {MemoryStorage} from './helpers/local-storage.mjs';
import {CONTROL_STORAGE_KEY,DEFAULT_CONTROL_BINDINGS} from '../site/dist/control-bindings.mjs';
const tap=(ui,key,code=key)=>{ui.key('keydown',key,{code});ui.key('keyup',key,{code});};
async function ready(t,action,remapped=false){
 const storage=new MemoryStorage();if(remapped)storage.data.set(CONTROL_STORAGE_KEY,JSON.stringify({version:1,bindings:{...DEFAULT_CONTROL_BINDINGS,up:'arrowup',down:'arrowdown'}}));
 const ui=await loadGameUI(t,{storage});ui.click('start');ui.frames();if(action==='up'){ui.document.querySelector('[data-key="down"]').click();ui.frames();assert.equal(ui.battle.hero.garrisoned(),false);}return ui;
}
for(const remapped of [false,true])for(const [action,key,code,target]of [['down','s','KeyS',false],['up','w','KeyW',true]])test(`${remapped?'remapped':'default'} ${action}: down and up before a tick reaches the real garrison action`,async t=>{
 const ui=await ready(t,action,remapped),b=ui.battle,tick=b.tick;tap(ui,remapped?'Arrow'+(action==='up'?'Up':'Down'):key,remapped?'Arrow'+(action==='up'?'Up':'Down'):code);assert.equal(b.tick,tick);ui.frames();assert.equal(b.hero.garrisoned(),target);assert.equal(b.input[action],false);
});
for(const action of ['up','down'])for(const interruption of ['pause','blur','settings','remap','session'])test(`${interruption} cancels a pending remapped ${action} edge`,async t=>{
 const ui=await ready(t,action,true),b=ui.battle,before=b.hero.garrisoned();tap(ui,action==='up'?'ArrowUp':'ArrowDown');
 if(interruption==='blur')ui.dispatch(ui.window,'blur');else ui.click('battlePause');
 if(interruption==='settings'||interruption==='remap'){ui.click('openSettings');if(interruption==='remap'){ui.click('openControls');ui.click('control-'+action);ui.key('keydown',action==='up'?'i':'k');ui.click('applyControls');}ui.click('closeSettings');}
 if(interruption==='session'){ui.click('pauseLobby');ui.get('hubDestinations').querySelector('[data-hub-destination="training"]').click();ui.click('start');ui.click('confirmSessionSwitch');ui.get('hubDestinations').querySelector('[data-hub-destination="campaign"]').click();ui.click('start');if(ui.visible('switchSessionConfirm'))ui.click('confirmSessionSwitch');ui.frames();assert.equal(ui.battle,b);ui.click('start');}else ui.click('resumeGame');
 ui.frames();assert.equal(b.hero.garrisoned(),before);assert.equal(b.input[action],false);
});
test('left and right remain continuous controls without a retained tap edge',async t=>{
 const ui=await ready(t,'up'),b=ui.battle,x=b.hero.x;for(const [key,code]of [['a','KeyA'],['d','KeyD']]){tap(ui,key,code);ui.frames();assert.equal(b.hero.x,x);assert.equal(b.input.left,false);assert.equal(b.input.right,false);}
});
