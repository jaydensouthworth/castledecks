import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
import {MemoryStorage} from './helpers/local-storage.mjs';
import {CONTROL_STORAGE_KEY,DEFAULT_CONTROL_BINDINGS} from '../site/dist/control-bindings.mjs';

async function flakReady(t,key=' '){
 const storage=new MemoryStorage();if(key!==' ')storage.data.set(CONTROL_STORAGE_KEY,JSON.stringify({version:1,bindings:{...DEFAULT_CONTROL_BINDINGS,activate:key}}));
 const ui=await loadGameUI(t,{search:'?mode=test',storage});ui.click('introTesting');ui.click('testGoldLarge');ui.click('testUnlock');ui.click('closeTesting');ui.click('start');
 for(let page=0;page<3&&!ui.get('hotbar').querySelector('#quick-flakArrow');page++)ui.click('nextBar');ui.click('quick-flakArrow');
 const origin={...ui.battle.hero.launchPosition},end={x:origin.x-150,y:origin.y+65};ui.pointer('pointerdown',1,origin);ui.pointer('pointermove',1,end);ui.pointer('pointerup',1,end);ui.frames();
 assert.equal(ui.battle.activationObjects.length,1);assert.equal(ui.get('activate').disabled,false);return ui;
}
const tap=(ui,key,extra={})=>{ui.key('keydown',key,extra);ui.key('keyup',key,extra);};

for(const [label,key,code]of [['default Space',' ','Space'],['remapped activation','k','KeyK']])test(`${label}: down and up before a tick still burst the real Flak carrier once`,async t=>{
 const ui=await flakReady(t,key),b=ui.battle,tick=b.tick;tap(ui,key,{code,target:ui.get('battlefield')});assert.equal(b.tick,tick);assert.equal(b.activationObjects.length,1);ui.frames();assert.equal(b.activationObjects.length,0,'accepted keyboard edge must reach the ordinary activation phase');assert.equal(b.input.space,false);ui.frames();assert.equal(b.input.space,false);
});

for(const [key,code]of [[' ','Space'],['k','KeyK']])for(const interruption of ['pause','blur','settings','remap','session'])test(`${interruption} cancels a pending ${code} activation before the next tick`,async t=>{
 const ui=await flakReady(t,key),b=ui.battle;tap(ui,key,{code,target:ui.get('battlefield')});if(interruption==='blur')ui.dispatch(ui.window,'blur');else ui.click('battlePause');assert.equal(b.input.space,false);assert.equal(b.paused,true);if(interruption==='settings'||interruption==='remap'){ui.click('openSettings');if(interruption==='remap'){ui.click('openControls');ui.click('control-activate');ui.key('keydown','j');ui.click('applyControls');}ui.click('closeSettings');}if(interruption==='session'){ui.click('pauseLobby');ui.get('hubDestinations').querySelector('[data-hub-destination="campaign"]').click();ui.click('start');ui.click('confirmSessionSwitch');ui.get('hubDestinations').querySelector('[data-hub-destination="training"]').click();ui.click('start');if(ui.visible('switchSessionConfirm'))ui.click('confirmSessionSwitch');ui.frames();assert.equal(ui.battle,b);ui.click('start');}else ui.click('resumeGame');ui.frames();assert.equal(b.activationObjects.length,1,'cancelled input cannot replay on resume');assert.equal(b.input.space,false);
});

test('activation rejects repeat, modifiers, composition, text targets and modal input',async t=>{
 const ui=await flakReady(t,'k'),b=ui.battle;
 for(const extra of [{repeat:true},{ctrlKey:true},{metaKey:true},{altKey:true},{shiftKey:true},{isComposing:true},{keyCode:229},{target:ui.get('newProfileName')},{target:{tagName:'DIV',isContentEditable:true}}]){tap(ui,'k',{code:'KeyK',...extra});assert.equal(b.input.space,false);}
 ui.frames();assert.equal(b.activationObjects.length,1);ui.click('battlePause');ui.click('openSettings');tap(ui,'k',{code:'KeyK'});ui.click('closeSettings');ui.click('resumeGame');ui.frames();assert.equal(b.activationObjects.length,1);assert.equal(b.input.space,false);
});

test('Space on a focused button keeps native activation and does not pulse the carrier',async t=>{
 const ui=await flakReady(t);const event=ui.key('keydown',' ',{code:'Space',target:ui.get('battlePause')});ui.key('keyup',' ',{code:'Space',target:ui.get('battlePause')});assert.equal(event.event.defaultPrevented,false);ui.frames();assert.equal(ui.battle.activationObjects.length,1);assert.equal(ui.battle.input.space,false);ui.click('activate');ui.frames();assert.equal(ui.battle.activationObjects.length,0);
});
