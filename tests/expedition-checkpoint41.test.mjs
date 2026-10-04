import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadGameUI,deferredFile} from './helpers/game-ui-harness.mjs';
import {MemoryStorage,TestLocks,settle} from './helpers/local-storage.mjs';
import {CampaignProfiles} from '../site/dist/engine/profile-manager.mjs';
import {ExpeditionProfiles} from '../site/dist/expedition-model.mjs';
import {createLocalCampaignStore,checkpointSlotKey,snapshotCampaign} from '../site/dist/local-campaign-store.mjs';
const charter=seed=>new ExpeditionProfiles({seedFactory:()=>seed}).exportBundle();
const select=(ui,id)=>{ui.get('hubDestinations').querySelector(`[data-hub-destination="${id}"]`).click();ui.click('start');if(ui.visible('switchSessionConfirm'))ui.click('confirmSessionSwitch');ui.frames();};
const state=b=>JSON.stringify({tick:b.tick,profile:b.profile,stats:b.stats,units:[...b.goodTeam,...b.badTeam].map(u=>[u.type,u.x,u.y,u.hp]),projectiles:b.projectiles.map(p=>[p.x,p.y,p.vx,p.vy]),queue:b.friendlyQueue.queue,wave:b.wave.countdown,outcome:b.outcome,summary:b.summary});

test('direct charter never opens or writes campaign checkpoints across menus, purchases, settings and import',async t=>{
 const storage=new MemoryStorage(),ui=await loadGameUI(t,{search:'?mode=expedition',storage});
 assert.equal(snapshotCampaign({profiles:new ExpeditionProfiles(),battle:ui.battle,destination:'expedition'}),null);
 assert.equal(storage.writes,0);assert.equal(ui.visible('localSaveManager'),false);assert.equal(ui.visible('localHubChoices'),false);assert.equal(ui.get('localManage').textContent,'Open charter vault');
 assert.match(ui.get('localHubStatus').textContent,/independent.*supplied.*no local checkpoints/);assert.doesNotMatch(ui.get('localHubStatus').textContent,/assisted/);
 // Explicit funded purchase fixture; natural combat is checked separately below.
 ui.battle.profile.gold=1501;ui.click('introArmory');ui.get('shopDiscover').querySelector('[data-discover-department="army"]').click();ui.click('buy-mount');assert.equal(ui.battle.profile.gold,1);ui.click('closeShop');ui.click('introSettings');ui.get('difficulty').value='hard';ui.click('applySettings');
 ui.click('introLoad');ui.get('loadCode').value=charter(131);ui.click('importCode');assert.equal(ui.visible('localConfirm'),false);
 ui.click('introProfiles');ui.get('newProfileName').value='Second';ui.click('createProfile');ui.click('introSave');ui.click('showSaveCode');assert.equal(JSON.parse(ui.get('saveCode').value).schema,'castledecks-expeditions-2');await settle();assert.equal(storage.writes,0);assert.equal(storage.data.size,0);
});
test('release41 campaign and charter return to exact same-tab battles while preserving campaign checkpoint bytes',async t=>{
 const storage=new MemoryStorage(),ui=await loadGameUI(t,{storage});ui.click('start');ui.frames(18);ui.click('battlePause');ui.click('pauseLobby');await settle();
 const campaign=ui.battle,campaignState=state(campaign),before=[...storage.data];select(ui,'expedition');ui.click('start');ui.frames(24);ui.click('battlePause');ui.click('pauseLobby');const expedition=ui.battle,expeditionState=state(expedition);
 select(ui,'campaign');assert.equal(ui.battle,campaign);assert.equal(state(ui.battle),campaignState);assert.match(ui.get('start').textContent,/Resume battle/);assert.equal(ui.get('saveGame').textContent,'Save campaign');assert.equal(ui.get('savePanelTitle').textContent,'Campaign vault');assert.match(ui.get('endingSaveStatus').textContent,/checkpointed locally/);
 select(ui,'expedition');assert.equal(ui.battle,expedition);assert.equal(state(ui.battle),expeditionState);assert.match(ui.get('start').textContent,/Resume The Tollgate/);assert.equal(ui.get('saveGame').textContent,'Save charter');await settle();assert.deepEqual([...storage.data],before);
});
test('delayed campaign write completes only its original checkpoint while charter stays manual-only',async t=>{
 const storage=new MemoryStorage(),locks=new TestLocks(),ui=await loadGameUI(t,{storage,locks}),store=createLocalCampaignStore({storage,locks});locks.pauseNext=true;ui.battle.profile.gold=321;ui.click('introSave');await settle();assert.ok(locks.release);ui.click('closeSave');select(ui,'expedition');const b=ui.battle;locks.release();await settle();
 assert.equal(ui.battle,b);assert.equal(b.profile.gold,1000);assert.equal(store.read(1).latest.manager.active.gold,321);assert.equal(store.read(2).status,'empty');assert.match(ui.get('localVaultStatus').textContent,/no local checkpoints/);assert.doesNotMatch(ui.get('localHubStatus').textContent,/Local slot|Saving checkpoint|assisted/);
});
test('future41 checkpoint guard survives a charter visit and refuses stale overwrite on return',async t=>{
 const storage=new MemoryStorage(),ui=await loadGameUI(t,{storage}),store=createLocalCampaignStore({storage,locks:new TestLocks()}),current=store.read(1);storage.setItem(checkpointSlotKey(1,'b'),JSON.stringify({...JSON.parse(current.raw[0]),schema:'castledecks-local-checkpoint-99',revision:2}));const before=[...storage.data];
 select(ui,'expedition');ui.click('introSave');ui.click('showSaveCode');ui.click('closeSave');select(ui,'campaign');ui.click('introLoadout');ui.click('closeSkills');await settle();assert.deepEqual([...storage.data],before);assert.match(ui.get('localHubStatus').textContent,/newer game version.*Reload/);
});
test('staged campaign import and late file read cannot replace a selected charter',async t=>{
 const storage=new MemoryStorage(),ui=await loadGameUI(t,{storage});ui.click('introLoad');ui.get('loadCode').value=new CampaignProfiles({defaultName:'Staged'}).exportBundle();ui.click('importCode');assert.equal(ui.visible('localConfirm'),true);const accept=ui.get('localConfirmAccept').onclick,late=deferredFile(),reading=ui.load(late.file);assert.equal(ui.visible('localConfirm'),false);ui.click('closeSave');select(ui,'expedition');const b=ui.battle,before=[...storage.data];
 accept();late.resolve(new CampaignProfiles({defaultName:'Late'}).exportBundle());await reading;await settle();assert.equal(ui.battle,b);assert.deepEqual([...storage.data],before);assert.equal(ui.visible('localConfirm'),false);
});
test('newer charter file owns import and older charter reads cannot cross the Crownroad return',async t=>{
 const storage=new MemoryStorage(),ui=await loadGameUI(t,{storage});select(ui,'expedition');ui.click('introLoad');const older=deferredFile(),reading=ui.load(older.file),newer=deferredFile(),wanted=ui.load(newer.file);newer.resolve(charter(22));await wanted;assert.equal(ui.battle.expeditionRun.state.seed,22);const current=ui.battle;older.resolve(charter(11));await reading;assert.equal(ui.battle,current);
 ui.click('introLoad');const cross=deferredFile(),pending=ui.load(cross.file);ui.click('closeSave');select(ui,'campaign');const campaign=ui.battle,before=[...storage.data];cross.resolve(charter(33));await pending;await settle();assert.equal(ui.battle,campaign);assert.deepEqual([...storage.data],before);assert.doesNotMatch(ui.get('saveStatus').textContent,/charter/i);
});
test('natural supplied-army settlement opens a real branch, preserves one receipt, and never checkpoints charter earnings',async t=>{
 const storage=new MemoryStorage(),ui=await loadGameUI(t,{search:'?mode=expedition',storage});ui.click('introLoad');ui.get('loadCode').value=charter(131);ui.click('importCode');ui.click('start');const b=ui.battle;
 // Ordinary unattended combat with the declared starter army. No forced result,
 // HP, flag, roster, cooldown, or economy mutations are used in this run.
 for(let i=0;i<30000&&!b.summary;i++)b.step();ui.frames();assert.equal(b.summary?.outcome,'victory');assert.equal(b.expeditionRun.state.cleared,1);const gold=b.profile.gold,wins=b.profile.victories,receipt=JSON.stringify(b.expeditionRun.exportState());ui.frames(110);assert.equal(b.profile.gold,gold);assert.equal(b.profile.victories,wins);assert.equal(JSON.stringify(b.expeditionRun.exportState()),receipt);
 ui.click('replay');assert.equal(ui.visible('expeditionPanel'),true);ui.get('expeditionRouteHost').querySelector('[data-charter-choice="skyglass"]').click();assert.equal(ui.battle.encounter.id,'skyglass');assert.equal(ui.battle.tick,0);assert.equal(ui.battle.profile.gold,gold);ui.frames(10);assert.equal(ui.battle.tick,0);await settle();assert.equal(storage.writes,0);
});
test('charter save descriptions and labels reset completely when returning to Crownroad',async t=>{
 const ui=await loadGameUI(t);select(ui,'expedition');ui.click('introSave');for(const id of ['saveGame','loadGame','chooseSaveFile','saveCodeLabel','loadCodeLabel','restoreTitle'])assert.match(ui.get(id).textContent,/charter/i);assert.match(ui.get('restoreDescription').textContent,/settled result and route choice/);assert.match(ui.get('importDescription').textContent,/replaces the charter banners/);assert.doesNotMatch(ui.get('endingSaveStatus').textContent,/checkpoint/);ui.click('closeSave');select(ui,'campaign');ui.click('introSave');for(const id of ['saveGame','loadGame','chooseSaveFile','saveCodeLabel','loadCodeLabel','restoreTitle'])assert.match(ui.get(id).textContent,/campaign/i);assert.match(ui.get('importDescription').textContent,/reviewed.*local slot/);assert.equal(ui.get('loadCode').getAttribute('placeholder'),'Paste your campaign code here');
});
test('viewport lab copy distinguishes default assisted sessions from explicitly chosen Campaign checkpoints',()=>{
 const markup=readFileSync(new URL('../site/dist/phone-preview.html',import.meta.url),'utf8');assert.match(markup,/default playground and midgame demo are separate assisted sessions/);assert.match(markup,/Explicitly selecting Campaign uses this browser’s normal local checkpoints/);assert.doesNotMatch(markup,/All play here uses a separate marked assisted profile/);
});
