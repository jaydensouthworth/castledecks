import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGameUI,deferredFile} from './helpers/game-ui-harness.mjs';
import {CampaignProfiles} from '../site/dist/engine/profile-manager.mjs';
test('visible campaign code restores funded assisted progress after switching to a new profile',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=test'});ui.click('introTesting');ui.click('testGoldLarge');ui.get('testLevel').value='17';ui.click('testLevelApply');ui.click('start');ui.click('battlePause');ui.click('saveGame');ui.click('showSaveCode');const code=ui.get('saveCode').value;assert.equal(ui.visible('saveCodeArea'),true);assert.match(ui.get('vaultStatus').textContent,/does not save/);assert.equal(JSON.parse(code).profiles[0].cheated,true);
 ui.click('closeSave');ui.click('openProfiles');ui.get('newProfileName').value='Fresh';ui.click('createProfile');assert.equal(ui.battle.profile.gold,0);ui.click('start');ui.click('battlePause');ui.click('saveGame');ui.get('loadCode').value=code;ui.click('importCode');
 assert.equal(ui.battle.profile.name,'Playground');assert.equal(ui.battle.profile.gold,10000);assert.equal(ui.battle.level,17);assert.equal(ui.battle.profile.cheated,true);assert.equal(ui.visible('intro'),true);assert.equal(ui.visible('savePanel'),false);assert.equal(ui.battle.tick,0);
});
test('invalid campaign code preserves current live objects and leaves a visible vault error',async t=>{
 const ui=await loadGameUI(t);ui.click('start');ui.frames(4);ui.click('battlePause');ui.click('saveGame');const battle=ui.battle,profile=battle.profile;ui.get('loadCode').value='not a campaign';ui.click('importCode');assert.equal(ui.battle,battle);assert.equal(ui.battle.profile,profile);assert.equal(ui.battle.paused,true);assert.equal(ui.visible('savePanel'),true);assert.match(ui.get('vaultStatus').textContent,/kept/);
});
test('an accepted code invalidates an older pending file read',async t=>{
 const ui=await loadGameUI(t);const old=deferredFile(),pending=ui.load(old.file);ui.click('start');ui.click('battlePause');ui.click('saveGame');ui.get('loadCode').value=new CampaignProfiles({defaultName:'From code'}).exportBundle();ui.click('importCode');old.resolve(new CampaignProfiles({defaultName:'Old file'}).exportBundle());await pending;assert.equal(ui.battle.profile.name,'From code');
});
test('fullscreen changes clear held movement and Escape never resumes a paused fullscreen battle',async t=>{
 const ui=await loadGameUI(t);ui.click('start');ui.key('keydown','d');ui.document.fullscreenElement=ui.get('gameShell');ui.dispatch(ui.document,'fullscreenchange');assert.equal(ui.battle.input.right,false);assert.equal(ui.battle.paused,true);assert.match(ui.get('pauseReason').textContent,/Display mode/);
 ui.document.exitFullscreen=async()=>{ui.document.fullscreenElement=null;ui.dispatch(ui.document,'fullscreenchange');};await ui.key('keydown','Escape').completed;assert.equal(ui.document.fullscreenElement,null);assert.equal(ui.battle.paused,true);assert.equal(ui.visible('pauseOverlay'),true);
});
test('unsupported fullscreen feedback is visible in the paused menu',async t=>{
 const ui=await loadGameUI(t);ui.click('start');ui.click('battlePause');await ui.click('toggleFullscreen').completed;assert.equal(ui.visible('pauseOverlay'),true);assert.match(ui.get('pauseReason').textContent,/unavailable/);assert.equal(ui.battle.paused,true);
});
test('a fresh visit can load a code from the intro without starting a battle',async t=>{
 const ui=await loadGameUI(t);ui.click('introLoad');assert.equal(ui.visible('savePanel'),true);assert.equal(ui.document.activeElement,ui.get('loadCode'));ui.get('loadCode').value=new CampaignProfiles({defaultName:'Restored'}).exportBundle();ui.click('importCode');assert.equal(ui.battle.profile.name,'Restored');assert.equal(ui.battle.tick,0);assert.equal(ui.visible('intro'),true);assert.equal(ui.get('battlePause').textContent,'Ⅱ Pause');
});
test('reopening the vault hides its earlier generated snapshot',async t=>{
 const ui=await loadGameUI(t);ui.click('introLoad');ui.click('showSaveCode');assert.equal(ui.visible('saveCodeArea'),true);ui.click('closeSave');ui.click('introLoad');assert.equal(ui.visible('saveCodeArea'),false);assert.equal(ui.get('saveCode').value,'');
});
