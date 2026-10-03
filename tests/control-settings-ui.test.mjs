import test from 'node:test';import assert from 'node:assert/strict';
import {loadGameUI} from './helpers/game-ui-harness.mjs';import {MemoryStorage} from './helpers/local-storage.mjs';
import {CONTROL_STORAGE_KEY,DEFAULT_CONTROL_BINDINGS} from '../site/dist/control-bindings.mjs';
const open=ui=>{ui.click(ui.battle.paused?'openSettings':'introSettings');ui.click('openControls');};
const rebind=(ui,action,key,extra={})=>{ui.click('control-'+action);return ui.key('keydown',key,extra);};
const keyText=(ui,action)=>ui.get('control-'+action).querySelector('kbd').textContent;
async function ready(t,{storage=new MemoryStorage(),auto=true}={}){const ui=await loadGameUI(t,{search:'?mode=test',storage});ui.click('introTesting');ui.click('testGoldLarge');ui.click('testUnlock');ui.click('closeTesting');if(auto){ui.click('introSettings');ui.get('aimMode').value='auto_aim';ui.click('applySettings');}return ui;}

test('controls editor applies actual companion, arc, movement, pause, bar and airborne bindings',async t=>{
 const storage=new MemoryStorage(),ui=await ready(t,{storage});open(ui);
 for(const [action,key] of Object.entries({companion:'h',arc:'j',left:'ArrowLeft',right:'ArrowRight',up:'ArrowUp',down:'ArrowDown',pause:'o',activate:'k',previousBar:'n',nextBar:'m'}))rebind(ui,action,key);
 assert.equal(ui.battle.input.left,false);ui.click('applyControls');assert.equal(ui.visible('settingsPanel'),true);assert.match(ui.get('controlsSummary').textContent,/saved on this browser/);ui.click('closeSettings');ui.click('start');
 ui.key('keydown','g');assert.equal(ui.battle.companions.unit,null);ui.key('keydown','h');assert.ok(ui.battle.companions.unit);assert.match(ui.get('companionAction').getAttribute('aria-label'),/Shortcut H/);
 ui.key('keydown','v');assert.equal(ui.battle.shooter.angleMode,1);ui.key('keydown','j');assert.equal(ui.battle.shooter.angleMode,0);assert.match(ui.get('liveArc').getAttribute('aria-label'),/Shortcut J/);
 ui.key('keydown','ArrowLeft',{code:'ArrowLeft'});assert.equal(ui.battle.input.left,true);ui.key('keyup','ArrowLeft',{code:'ArrowLeft'});assert.equal(ui.battle.input.left,false);
 ui.key('keydown','d');assert.equal(ui.battle.input.right,false);ui.key('keydown','ArrowRight',{code:'ArrowRight'});assert.equal(ui.battle.input.right,true);ui.key('keyup','ArrowRight',{code:'ArrowRight'});
 for(const [key,direction] of [['ArrowUp','up'],['ArrowDown','down']]){ui.key('keydown',key);assert.equal(ui.battle.input[direction],true);ui.key('keyup',key);assert.equal(ui.battle.input[direction],false);}
 ui.key('keydown','k');assert.equal(ui.battle.input.space,true);ui.key('keyup','k');assert.equal(ui.battle.input.space,true);ui.frames();assert.equal(ui.battle.input.space,false);
 const before=ui.battle.hotbar.bar;ui.key('keydown','m');assert.notEqual(ui.battle.hotbar.bar,before);ui.key('keydown','n');assert.equal(ui.battle.hotbar.bar,before);
 ui.key('keydown','p');assert.equal(ui.battle.paused,false);ui.key('keydown','o');assert.equal(ui.battle.paused,true);ui.key('keydown','o',{repeat:true});assert.equal(ui.battle.paused,true);ui.key('keydown','o');assert.equal(ui.battle.paused,false);ui.key('keydown','Escape');assert.equal(ui.battle.paused,true);
 assert.equal(JSON.parse(storage.getItem(CONTROL_STORAGE_KEY)).bindings.companion,'h');assert.match(ui.get('pauseControlsReference').textContent,/H commands.*J switches/);
 ui.click('pauseSkills');assert.match(ui.get('loadoutCompanionSummary').textContent,/ · H$/);assert.match(ui.get('loadoutControlsReference').textContent,/H controls/);
});
test('Cancel, Back and Escape discard draft changes; capture Escape and Tab only stop capture',async t=>{
 const storage=new MemoryStorage(),ui=await ready(t,{storage});open(ui);rebind(ui,'arc','h');ui.click('cancelControls');ui.click('openControls');assert.equal(keyText(ui,'arc'),'V');assert.equal(storage.getItem(CONTROL_STORAGE_KEY),null);
 ui.click('control-arc');ui.key('keydown','Escape');assert.equal(ui.visible('controlsPanel'),true);assert.equal(keyText(ui,'arc'),'V');ui.click('control-arc');ui.key('keydown','Tab');assert.equal(ui.get('applyControls').disabled,false);assert.equal(ui.visible('controlsPanel'),true);
 rebind(ui,'arc','h');ui.key('keydown','Escape');assert.equal(ui.visible('controlsPanel'),false);ui.click('openControls');assert.equal(keyText(ui,'arc'),'V');rebind(ui,'arc','h');ui.click('closeControls');ui.click('openControls');assert.equal(keyText(ui,'arc'),'V');
});
test('duplicates, digits, browser keys, modifiers, IME and repeats cannot be captured',async t=>{
 const ui=await ready(t);open(ui);ui.click('control-arc');
 ui.key('keydown','g');assert.match(ui.get('controlStatus').textContent,/already used/);assert.equal(ui.get('applyControls').disabled,true);
 for(const key of ['1','0','Enter','F5','Backspace']){ui.key('keydown',key);assert.match(ui.get('controlStatus').textContent,/reserved/);assert.equal(keyText(ui,'arc'),'Press a key…');}
 for(const flag of ['ctrlKey','metaKey','altKey','shiftKey']){const result=ui.key('keydown','h',{[flag]:true});assert.equal(result.event.defaultPrevented,false);assert.equal(keyText(ui,'arc'),'Press a key…');}
 for(const extra of [{isComposing:true},{keyCode:229},{repeat:true},{target:ui.get('loadCode')},{target:{tagName:'DIV',isContentEditable:true}}]){ui.key('keydown','h',extra);assert.equal(keyText(ui,'arc'),'Press a key…');}
 ui.key('keydown','h');assert.equal(keyText(ui,'arc'),'H');assert.equal(ui.get('applyControls').disabled,false);
});
test('restore defaults is a draft action and preferences survive a fresh UI load',async t=>{
 const storage=new MemoryStorage();storage.data.set(CONTROL_STORAGE_KEY,JSON.stringify({version:1,bindings:{...DEFAULT_CONTROL_BINDINGS,companion:'h',left:'arrowleft'}}));
 const ui=await ready(t,{storage});assert.match(ui.get('pauseControlsReference').textContent,/Left Arrow/);open(ui);assert.equal(keyText(ui,'companion'),'H');ui.click('resetControls');assert.equal(keyText(ui,'companion'),'G');ui.click('cancelControls');ui.click('openControls');assert.equal(keyText(ui,'companion'),'H');ui.click('resetControls');ui.click('applyControls');assert.deepEqual(JSON.parse(storage.getItem(CONTROL_STORAGE_KEY)).bindings,DEFAULT_CONTROL_BINDINGS);
});
test('opening and applying controls clears held movement, airborne activation, pointer capture and queued shots',async t=>{
 const ui=await ready(t);ui.click('start');ui.frames(31);const button=ui.document.querySelector('[data-key="right"]');ui.key('keydown','d',{code:'KeyD'});ui.key('keydown',' ',{target:ui.get('battlefield')});ui.pointer('pointerdown',7,{x:0,y:0},button);ui.pointer('pointerdown',8,{x:1200,y:400});ui.pointer('pointerup',8,{x:1200,y:400});assert.ok(ui.battle.playerShots.length);
 ui.click('battlePause');ui.click('pauseControls');assert.equal(ui.battle.input.right,false);assert.equal(ui.battle.input.space,false);assert.equal(ui.battle.playerShots.length,0);assert.equal(button.hasPointerCapture(7),false);
 rebind(ui,'right','l');rebind(ui,'activate','k');ui.click('applyControls');assert.equal(ui.visible('pauseOverlay'),true);ui.click('resumeGame');ui.key('keydown','d',{code:'KeyD',repeat:true});assert.equal(ui.battle.input.right,false);ui.key('keydown','l',{code:'KeyL'});ui.key('keyup','d',{code:'KeyD'});assert.equal(ui.battle.input.right,true);ui.key('keyup','L',{code:'KeyL',shiftKey:true});assert.equal(ui.battle.input.right,false);ui.key('keydown','k',{code:'KeyK'});ui.key('keyup','K',{code:'KeyK',shiftKey:true});assert.equal(ui.battle.input.space,true);ui.frames();assert.equal(ui.battle.input.space,false);
});
test('live remaps ignore text, modifiers, composition, repeats and other modals while 1–9/0 stays fixed',async t=>{
 const storage=new MemoryStorage();storage.data.set(CONTROL_STORAGE_KEY,JSON.stringify({version:1,bindings:{...DEFAULT_CONTROL_BINDINGS,companion:'h',arc:'j'}}));const ui=await ready(t,{storage});ui.click('start');
 for(const extra of [{isComposing:true},{keyCode:229},{repeat:true},{ctrlKey:true},{metaKey:true},{altKey:true},{shiftKey:true},{target:ui.get('newProfileName')},{target:{tagName:'DIV',isContentEditable:true}}])for(const key of ['h','j','d','p','2'])ui.key('keydown',key,extra);
 assert.equal(ui.battle.companions.unit,null);assert.equal(ui.battle.shooter.angleMode,1);assert.equal(ui.battle.input.right,false);assert.equal(ui.battle.paused,false);
 ui.key('keydown',']');ui.key('keydown','2');assert.equal(ui.battle.activeSkill.id,'fireArrow');ui.key('keyup','2');ui.key('keydown','0');assert.equal(ui.battle.activeSkill.id,'thunderArrow');ui.key('keyup','0');
 ui.key('keydown','d');ui.dispatch(ui.document,'compositionstart');assert.equal(ui.battle.input.right,false);ui.key('keydown','d');ui.dispatch(ui.document,'focusin',{target:ui.get('newProfileName')});assert.equal(ui.battle.input.right,false);
 ui.click('battlePause');ui.click('openSettings');for(const key of ['h','j','d','p'])ui.key('keydown',key);assert.equal(ui.battle.companions.unit,null);assert.equal(ui.battle.shooter.angleMode,1);assert.equal(ui.battle.input.right,false);assert.equal(ui.battle.paused,true);
});
test('storage quota failure still applies controls and clearly reports session-only persistence',async t=>{
 const storage=new MemoryStorage(),ui=await ready(t,{storage});storage.setItem=()=>{throw new Error('Quota');};open(ui);rebind(ui,'arc','h');ui.click('applyControls');assert.match(ui.get('controlsSummary').textContent,/this tab.*unavailable or full/);ui.click('closeSettings');ui.click('start');ui.key('keydown','h');assert.equal(ui.battle.shooter.angleMode,0);
});

test('applied preferences reload into a new game UI and do not enter exported campaign data',async t=>{
 const storage=new MemoryStorage();
 await t.test('apply in first page',async child=>{const ui=await ready(child,{storage});open(ui);rebind(ui,'arc','h');ui.click('applyControls');assert.equal(JSON.parse(storage.getItem(CONTROL_STORAGE_KEY)).bindings.arc,'h');ui.click('closeSettings');ui.click('introSave');ui.click('showSaveCode');assert.doesNotMatch(ui.get('saveCode').value,/castledecks\.controls|previousBar|nextBar/);});
 await t.test('reload into another page',async child=>{const ui=await ready(child,{storage});open(ui);assert.equal(keyText(ui,'arc'),'H');ui.click('cancelControls');ui.click('closeSettings');ui.click('start');ui.key('keydown','h');assert.equal(ui.battle.shooter.angleMode,0);ui.key('keydown','v');assert.equal(ui.battle.shooter.angleMode,0);});
});
test('blur and composition start cancel capture; Space keeps native focused-button activation',async t=>{
 const ui=await ready(t);open(ui);ui.click('control-arc');ui.dispatch(ui.window,'blur');assert.equal(ui.get('applyControls').disabled,false);assert.equal(keyText(ui,'arc'),'V');ui.click('control-arc');ui.dispatch(ui.document,'compositionstart');assert.equal(keyText(ui,'arc'),'V');ui.click('cancelControls');ui.click('closeSettings');ui.click('start');
 ui.key('keydown',' ',{target:ui.get('battlePause')});assert.equal(ui.battle.input.space,false);ui.key('keydown',' ',{target:ui.get('battlefield')});assert.equal(ui.battle.input.space,true);ui.key('keyup',' ',{target:ui.get('battlefield')});assert.equal(ui.battle.input.space,true);ui.frames();assert.equal(ui.battle.input.space,false);
});

test('physical digit keys cannot be captured as punctuation or trigger two actions on another layout',async t=>{
 const storage=new MemoryStorage(),ui=await ready(t,{storage});open(ui);rebind(ui,'right','-',{code:'Digit6'});assert.match(ui.get('controlStatus').textContent,/reserved.*every keyboard layout/);assert.equal(keyText(ui,'right'),'Press a key…');ui.key('keydown','-',{code:'Minus'});ui.click('applyControls');assert.equal(ui.document.activeElement,ui.get('openControls'));ui.click('closeSettings');ui.click('start');ui.key('keydown',']');
 ui.key('keydown','-',{code:'Digit6'});assert.equal(ui.battle.input.right,false);assert.equal(ui.battle.activeSkill.id,'fireWave');ui.key('keyup','-',{code:'Digit6'});ui.key('keydown','-',{code:'Minus'});assert.equal(ui.battle.input.right,true);ui.key('keyup','-',{code:'Minus'});assert.equal(ui.battle.input.right,false);
});
test('two physical keys producing one activation character retain independent held ownership',async t=>{
 const storage=new MemoryStorage();storage.data.set(CONTROL_STORAGE_KEY,JSON.stringify({version:1,bindings:{...DEFAULT_CONTROL_BINDINGS,activate:'.'}}));const ui=await ready(t,{storage});ui.click('start');
 ui.key('keydown','.',{code:'Period'});ui.key('keydown','.',{code:'NumpadDecimal'});assert.equal(ui.battle.input.space,true);ui.key('keyup','.',{code:'NumpadDecimal'});assert.equal(ui.battle.input.space,true);ui.key('keyup','.',{code:'Period'});assert.equal(ui.battle.input.space,true);ui.frames();assert.equal(ui.battle.input.space,false);
});
test('desktop movement and airborne captions use live remapped labels',async t=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'matchMedia');Object.defineProperty(globalThis,'matchMedia',{configurable:true,writable:true,value:()=>({matches:true})});t.after(()=>{if(previous)Object.defineProperty(globalThis,'matchMedia',previous);else delete globalThis.matchMedia;});
 const storage=new MemoryStorage();storage.data.set(CONTROL_STORAGE_KEY,JSON.stringify({version:1,bindings:{...DEFAULT_CONTROL_BINDINGS,left:'arrowleft',right:'arrowright',activate:'k'}}));const ui=await ready(t,{storage});ui.click('start');ui.battle.hero.garrisoned=()=>false;ui.frames();assert.equal(ui.get('combatMoveLabel').textContent,'← / → · Move');assert.equal(ui.get('activate').dataset.detail,'K · AIRBORNE');
});
