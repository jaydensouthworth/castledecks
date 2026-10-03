import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGameUI} from './helpers/game-ui-harness.mjs';

function unlock(ui) {
  ui.click('introTesting');ui.click('testGoldLarge');ui.click('testUnlock');ui.click('closeTesting');ui.click('start');
}

for(const interruption of ['pause','blur','resize','loadout']) {
  test(`queued wheel is discarded by ${interruption}, with no stale page switch on return`,async t=>{
    const ui=await loadGameUI(t,{search:'?mode=test'});unlock(ui);
    ui.dispatch(ui.get('battlefield'),'wheel',{deltaY:100});
    assert.equal(ui.battle.hotbar.wheel,-100);
    if(interruption==='pause')ui.click('battlePause');
    else if(interruption==='blur')ui.dispatch(ui.window,'blur');
    else if(interruption==='resize')ui.dispatch(ui.window,'resize');
    else {ui.click('battlePause');ui.click('pauseSkills');ui.click('closeSkills');}
    // Snapshot after loadout refresh, which intentionally resets selection.
    const bar=ui.battle.hotbar.bar,skill=ui.battle.activeSkill;
    assert.equal(ui.battle.hotbar.wheel,0,'an interrupted scroll must not survive the input-clear boundary');
    if(ui.battle.paused)ui.click('resumeGame');
    ui.frames();
    assert.equal(ui.battle.hotbar.bar,bar);assert.equal(ui.battle.activeSkill,skill);
  });
}

test('uninterrupted wheel still switches bars at the ordinary next engine tick',async t=>{
  const ui=await loadGameUI(t,{search:'?mode=test'});unlock(ui);const bar=ui.battle.hotbar.bar;
  ui.dispatch(ui.get('battlefield'),'wheel',{deltaY:100});assert.equal(ui.battle.hotbar.bar,bar);
  ui.frames();assert.notEqual(ui.battle.hotbar.bar,bar);assert.equal(ui.battle.hotbar.wheel,0);
});
