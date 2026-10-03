import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
import {MemoryStorage,TestLocks} from './helpers/local-storage.mjs';
import {createLocalCampaignStore} from '../site/dist/local-campaign-store.mjs';
import {serializeProfile,restoreProfile} from '../site/dist/engine/progression.mjs';
import {CampaignProfiles} from '../site/dist/engine/profile-manager.mjs';

// Combined-only coverage: source-level boundaries also have standalone suites.
// These funded UI fixtures deliberately supply gold; they are not earned play.
test('zero-balance purchase survives report opt-in and checkpoint/export without diagnostics contamination',async t=>{
 const storage=new MemoryStorage(),ui=await loadGameUI(t,{storage}),store=createLocalCampaignStore({storage,locks:new TestLocks()});
 ui.battle.profile.gold=1000;ui.battle.profile.name='PRIVATE_PROFILE_NAME';
 ui.click('introArmory');await ui.settle();ui.click('shopCatalogTab');ui.click('buy-fireArrow');await ui.settle();
 assert.equal(ui.battle.profile.gold,0);assert.equal(ui.battle.profile.owned.has('fireArrow'),true);
 ui.click('closeShop');await ui.settle();const before=serializeProfile(ui.battle.profile),saved=store.read(1).latest.payload;
 ui.click('introBattleReport');ui.get('battleReportRecording').checked=true;ui.dispatch(ui.get('battleReportRecording'),'change');
 ui.battle.emit({type:'damage',target:ui.battle.hero,damage:1});ui.click('battleReportRefresh');
 const report=ui.get('battleReportText').value;assert.match(report,/← unavailable/);assert.ok(!report.includes('PRIVATE_PROFILE_NAME'));
 ui.click('closeBattleReport');await ui.settle();
 assert.equal(serializeProfile(ui.battle.profile),before);assert.deepEqual(store.read(1).latest.payload,saved);
 assert.equal(restoreProfile(before).gold,0);assert.equal(restoreProfile(before).owned.has('fireArrow'),true);
 ui.click('introSave');ui.click('showSaveCode');await ui.settle();
 const bundle=ui.get('saveCode').value,restored=CampaignProfiles.fromBundle(bundle);
 assert.equal(restored.active.gold,0);assert.equal(restored.active.owned.has('fireArrow'),true);
 assert.doesNotMatch(bundle,/battleReports|recording|sourceKnown|actor-\d|rate-limited/);
});

test('reporting and exact-budget practice purchases preserve the campaign checkpoint and same-tab identity',async t=>{
 const storage=new MemoryStorage(),ui=await loadGameUI(t,{storage}),store=createLocalCampaignStore({storage,locks:new TestLocks()});
 const campaign=ui.battle;ui.click('introBattleReport');ui.get('battleReportRecording').checked=true;ui.dispatch(ui.get('battleReportRecording'),'change');
 campaign.emit({type:'shot',skill:'arrow'});ui.click('closeBattleReport');await ui.settle();const campaignSave=store.read(1).raw;
 ui.get('hubDestinations').querySelector('[data-hub-destination="training"]').click();ui.click('start');if(ui.visible('switchSessionConfirm'))ui.click('confirmSessionSwitch');await ui.settle();ui.frames();
 ui.click('introTesting');ui.click('testGoldSmall');ui.click('closeTesting');ui.click('introArmory');ui.click('shopCatalogTab');ui.click('buy-fireArrow');ui.click('closeShop');await ui.settle();
 assert.equal(ui.battle.profile.gold,0);assert.equal(ui.battle.profile.cheated,true);assert.equal(ui.battle.profile.owned.has('fireArrow'),true);
 ui.click('introBattleReport');assert.equal(ui.get('battleReportRecording').checked,false);assert.match(ui.get('battleReportText').value,/No recorded events/);
 ui.get('battleReportRecording').checked=true;ui.dispatch(ui.get('battleReportRecording'),'change');ui.battle.emit({type:'shot',skill:'fireArrow'});ui.click('closeBattleReport');await ui.settle();
 assert.deepEqual(store.read(1).raw,campaignSave);
 ui.get('hubDestinations').querySelector('[data-hub-destination="campaign"]').click();ui.click('start');if(ui.visible('switchSessionConfirm'))ui.click('confirmSessionSwitch');await ui.settle();ui.frames();
 assert.equal(ui.battle,campaign);assert.equal(campaign.profile.cheated,false);assert.equal(campaign.profile.owned.has('fireArrow'),false);
 ui.click('introBattleReport');assert.equal(ui.get('battleReportRecording').checked,true);assert.match(ui.get('battleReportText').value,/0 shot/);assert.doesNotMatch(ui.get('battleReportText').value,/Fire Arrow|fireArrow/);
 assert.deepEqual(store.read(1).raw,campaignSave);
});
