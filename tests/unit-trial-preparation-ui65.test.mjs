import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGameUI} from './helpers/game-ui-harness.mjs';

// Real UI module, Deploy adapter and engine in the bounded DOM harness. Native
// browser layout/input remain the parent task's QA responsibility.
test('unowned Fire Dragon Deploy stays usable after reading, then reset restores a fresh waiting field',async t=>{
 const ui=await loadGameUI(t),origin=ui.battle;
 ui.click('introArmory');ui.click('shopCatalogTab');ui.get('shopSearch').value='Fire Dragon';ui.dispatch(ui.get('shopSearch'),'input');ui.dispatch(ui.get('shopSearchForm'),'submit');ui.click('inspect-fireDragon');ui.click('shopTryCard');ui.frames();
 for(const delay of [667,1980]){
  const trial=ui.battle,controller=trial.guidedTraining;
  ui.frames(delay);
  assert.equal(controller.snapshot.preparing,true);assert.equal(controller.target.x,1050);assert.equal(trial.ownFlag.status,3);
  assert.match(ui.get('trainingInstruction').textContent,/Preparation: targets wait until your first squad enters/);
  assert.match(ui.get('trainingFeedback').textContent,/Preparing · 0 deployed/);
  assert.equal(ui.get('unitTrialDeploy').disabled,false);assert.match(ui.get('unitTrialDeploy').textContent,/65 gold/);
  ui.click('unitTrialDeploy');ui.frames(40);
  assert.equal(controller.snapshot.preparing,false);assert.equal(controller.snapshot.deployed,1);
  assert.equal(trial.profile.gold,435);assert.equal(trial.friendlyQueue.population,17);
  assert.doesNotMatch(ui.get('trainingInstruction').textContent,/Preparation:/);
  ui.frames(1280);assert.ok(controller.snapshot.damage>0,'real Deploy-button path reaches a target after a 40 s observation');
  ui.click('trainingRestart');ui.frames();
  assert.notEqual(ui.battle,trial);assert.equal(ui.battle.guidedTraining.snapshot.preparing,true);
  assert.equal(ui.battle.guidedTraining.snapshot.damage,0);assert.equal(ui.battle.profile.gold,500);
  assert.equal(controller.snapshot.preparing,false,'old trial stays released after reset');
 }
 ui.click('unitTrialReturn');ui.frames();assert.equal(ui.battle,origin);assert.equal(origin.profile.owned.has('fireDragon'),false);assert.equal(ui.visible('shopDetailDrawer'),true);
});
