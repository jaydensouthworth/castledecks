import test from 'node:test';import assert from 'node:assert/strict';
import {loadGameUI,deferredFile} from './helpers/game-ui-harness.mjs';
import {CampaignProfiles} from '../site/dist/engine/profile-manager.mjs';
const unlock=ui=>{ui.click('introTesting');ui.click('testGoldLarge');ui.click('testUnlock');ui.click('closeTesting');};
function page(ui,id){for(let i=0;i<3;i++){if(ui.get('hotbar').querySelector('#quick-'+id))return;ui.click('nextBar');}throw new Error('Skill page unavailable '+id);}
const down=ui=>ui.document.querySelector('[data-key="down"]'),right=ui=>ui.document.querySelector('[data-key="right"]');

async function flakReady(t){const ui=await loadGameUI(t,{search:'?mode=test'});unlock(ui);ui.click('start');page(ui,'flakArrow');ui.click('quick-flakArrow');const o={...ui.battle.hero.launchPosition},end={x:o.x-150,y:o.y+65};ui.pointer('pointerdown',1,o);ui.pointer('pointermove',1,end);ui.pointer('pointerup',1,end);ui.frames();assert.equal(ui.battle.activationObjects.length,1);assert.equal(ui.get('activate').disabled,false);return ui;}
test('activation click preserves physically held Space after its pulse',async t=>{const ui=await flakReady(t);ui.key('keydown',' ');ui.click('activate');ui.frames();assert.equal(ui.battle.activationObjects.length,0);assert.equal(ui.battle.input.space,true,'keyboard owner remains held');});
test('Space release does not cancel a same-tick activation button pulse',async t=>{const ui=await flakReady(t);ui.key('keydown',' ');ui.click('activate');ui.key('keyup',' ');ui.frames();assert.equal(ui.battle.activationObjects.length,0,'button pulse activates the flak projectile');});
