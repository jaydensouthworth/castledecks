import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
const positionControl=ui=>ui.get('liveRallyPosition').querySelector('select');
const choose=(ui,position)=>{const select=positionControl(ui);select.value=position;ui.dispatch(select,'change');};

test('live named line selection is a real no-pause order without resource or time mutation',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=demo'}),b=ui.battle;
 assert.equal(positionControl(ui).disabled,true);choose(ui,'forward');assert.equal(b.armyOrder.mode,'advance');
 ui.click('start');ui.frames();const before={tick:b.tick,gold:b.profile.gold,population:b.friendlyQueue.population};
 choose(ui,'center');assert.equal(b.armyOrder.mode,'rally');assert.equal(b.armyOrder.position,'center');assert.equal(b.paused,false);
 assert.deepEqual({tick:b.tick,gold:b.profile.gold,population:b.friendlyQueue.population},before);
 assert.match(positionControl(ui).getAttribute('aria-label'),/All ground: Center hold/);
 const anchor=b.armyOrder.anchorX;b.hero.x+=100;ui.frames(2);assert.equal(b.armyOrder.anchorX,anchor);
 ui.key('keydown','r');ui.key('keyup','r');assert.equal(b.armyOrder.mode,'advance');assert.equal(b.armyOrder.position,'center');
 ui.key('keydown','r');ui.key('keyup','r');assert.equal(b.armyOrder.anchorX,anchor);
});

test('live native selector ignores gameplay keys and rejects hidden pause and invalid changes',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=demo'}),b=ui.battle;ui.click('start');ui.frames();const select=positionControl(ui);
 select.focus();ui.key('keydown','r',{target:select});ui.key('keydown','d',{target:select});assert.equal(b.armyOrder.mode,'advance');assert.equal(b.input.right,false);
 choose(ui,'unknown');assert.equal(b.armyOrder.mode,'advance');assert.equal(select.value,'current');
 ui.click('battlePause');choose(ui,'forward');assert.equal(b.armyOrder.mode,'advance');assert.equal(select.value,'current');
});

test('paused Army position orders reflect on live return and release after enemy keep falls',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=demo'}),b=ui.battle;ui.click('start');ui.frames();ui.click('battlePause');ui.click('pauseQueue');
 const forward=ui.get('armyOrders').querySelector('[data-rally-position="forward"]');assert.ok(forward);forward.click();assert.equal(b.armyOrder.position,'forward');assert.equal(b.paused,true);
 ui.click('closeQueue');ui.click('resumeGame');ui.frames();assert.equal(positionControl(ui).value,'current');assert.match(positionControl(ui).getAttribute('aria-label'),/All ground: Forward hold/);
 b.badCastle.takeDamage(b.badCastle.hp);ui.frames();assert.equal(b.armyOrder.mode,'advance');assert.equal(positionControl(ui).disabled,true);choose(ui,'rear');assert.equal(b.armyOrder.mode,'advance');
});

test('bow-only training hides and guards live rally position control',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=test'}),b=ui.battle;ui.click('start');ui.frames();assert.equal(ui.visible('liveRallyPosition'),false);choose(ui,'forward');assert.equal(b.armyOrder.mode,'advance');
});
