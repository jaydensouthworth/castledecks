import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CampaignProfiles} from '../site/dist/engine/profile-manager.mjs';
import {createLocalCampaignStore,checkpointSlotKey,LOCAL_CHECKPOINT_SCHEMA} from '../site/dist/local-campaign-store.mjs';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
import {MemoryStorage,TestLocks} from './helpers/local-storage.mjs';
const search='?open=local-saves';
class Storage extends MemoryStorage{removes=0;removeItem(key){this.removes++;super.removeItem(key);}}
function seed(storage,{name='Kept company',level=16,revision=1,writtenAt=1000,slot=1,bank='a'}={}){
 const profiles=new CampaignProfiles({defaultName:name});profiles.active.highestLevel=level;profiles.active.gold=876;
 storage.data.set(checkpointSlotKey(slot,bank),JSON.stringify({schema:LOCAL_CHECKPOINT_SCHEMA,revision,writtenAt,transaction:'entry-fixture',reason:'ready',payload:{bundle:profiles.exportBundle(),activeIndex:0,resume:{phase:'ready',level,outcome:null}}}));
}
for(const kind of ['empty','valid','recovered','newer','corrupt'])test(`URL local-save chooser ${kind} opens without restoring, advancing, writing or removing`,async t=>{
 const storage=new Storage(),locks=new TestLocks();if(['valid','recovered','newer'].includes(kind))seed(storage);
 if(kind==='recovered')storage.data.set(checkpointSlotKey(1,'b'),'broken');if(kind==='corrupt')storage.data.set(checkpointSlotKey(1,'a'),'broken');if(kind==='newer')storage.data.set(checkpointSlotKey(1,'b'),'{"schema":"castledecks-local-checkpoint-99"}');
 const before=[...storage.data],ui=await loadGameUI(t,{search,storage,locks});
 assert.equal(ui.visible('savePanel'),true);assert.equal(ui.visible('localConfirm'),false);assert.equal(ui.battle.profile.name,'Castledecks');assert.equal(ui.battle.level,1);assert.equal(ui.battle.tick,0);assert.equal(storage.writes,0);assert.equal(storage.removes,0);assert.equal(locks.requests,0);assert.deepEqual([...storage.data],before);
 ui.frames(20);assert.equal(ui.battle.tick,0);ui.click('closeSave');await ui.settle();assert.equal(ui.visible('savePanel'),false);assert.equal(ui.visible('intro'),true);ui.frames(20);assert.equal(ui.battle.tick,0);assert.equal(storage.writes,0);assert.equal(storage.removes,0);assert.equal(locks.requests,0);assert.deepEqual([...storage.data],before);
 ui.click('localManage');await ui.settle();assert.equal(ui.visible('savePanel'),true);assert.equal(storage.writes,0);assert.equal(storage.removes,0);assert.equal(locks.requests,0);assert.deepEqual([...storage.data],before);
 if(kind==='empty')assert.match(ui.get('localHubStatus').textContent,/No campaign has been created/);
});
test('unavailable storage opens chooser with warning and no false no-save claim',async t=>{
 const storage={getItem(){throw new Error('storage blocked');},setItem(){throw new Error('must not write');},removeItem(){throw new Error('must not remove');}},ui=await loadGameUI(t,{search,storage});assert.equal(ui.visible('savePanel'),true);assert.match(ui.get('localVaultStatus').textContent,/unavailable/);assert.equal(ui.battle.tick,0);ui.click('closeSave');assert.equal(ui.visible('intro'),true);
});
test('valid chooser Continue still stages an explicit confirmation and Cancel preserves both banks',async t=>{
 const storage=new Storage();seed(storage);const before=[...storage.data],ui=await loadGameUI(t,{search,storage});
 const button=ui.get('localSlots').querySelector('[data-local-continue="1"]');assert.equal(ui.document.activeElement,button);button.click();await ui.settle();assert.equal(ui.visible('localConfirm'),true);assert.equal(ui.battle.profile.name,'Castledecks');ui.click('localConfirmCancel');await ui.settle();assert.equal(ui.visible('localConfirm'),false);assert.deepEqual([...storage.data],before);assert.equal(storage.writes,0);
 ui.get('localSlots').querySelector('[data-local-continue="1"]').click();await ui.settle();ui.click('localConfirmAccept');await ui.settle();assert.equal(ui.battle.profile.name,'Kept company');assert.equal(ui.battle.level,16);assert.equal(ui.battle.tick,0);assert.equal(ui.visible('intro'),true);assert.deepEqual([...storage.data],before);ui.click('start');await ui.settle();ui.frames(4);assert.ok(ui.battle.tick>0);assert.equal(ui.visible('savePanel'),false);assert.ok(storage.writes>0);
});
test('a slot changed after chooser confirmation cannot be restored from stale text',async t=>{
 const storage=new Storage();seed(storage);const ui=await loadGameUI(t,{search,storage});ui.get('localSlots').querySelector('[data-local-continue="1"]').click();await ui.settle();seed(storage,{name:'Newer checkpoint',revision:2});const before=[...storage.data];ui.click('localConfirmAccept');await ui.settle();assert.equal(ui.battle.profile.name,'Castledecks');assert.match(ui.get('vaultStatus').textContent,/changed.*Review/);assert.deepEqual([...storage.data],before);assert.equal(storage.writes,0);
});
test('empty chooser creates a local campaign only after existing New confirmation',async t=>{
 const storage=new Storage(),ui=await loadGameUI(t,{search,storage});assert.equal(storage.writes,0);ui.click('localNewVault');await ui.settle();assert.equal(ui.visible('localConfirm'),true);assert.equal(storage.writes,0);ui.click('localConfirmAccept');await ui.settle();assert.equal(storage.writes,1);assert.equal(createLocalCampaignStore({storage}).read(1).status,'ready');assert.equal(ui.battle.tick,0);ui.click('start');await ui.settle();ui.frames(4);assert.ok(ui.battle.tick>0);assert.equal(ui.visible('savePanel'),false);
});
test('empty chooser Session only and subsequent Start never seed local data',async t=>{
 const storage=new Storage(),ui=await loadGameUI(t,{search,storage});ui.click('localSessionOnlyVault');await ui.settle();ui.click('closeSave');ui.click('start');await ui.settle();ui.frames(4);assert.ok(ui.battle.tick>0);assert.equal(storage.data.size,0);assert.equal(storage.writes,0);assert.equal(ui.visible('savePanel'),false);ui.frames(20);assert.equal(ui.visible('savePanel'),false);
});
test('closing empty chooser and pressing Start returns to choice without a blank autosave',async t=>{
 const storage=new Storage(),ui=await loadGameUI(t,{search,storage});ui.key('keydown','Escape');await ui.settle();assert.equal(ui.visible('savePanel'),false);assert.equal(ui.document.activeElement,ui.get('start'));ui.click('start');await ui.settle();assert.equal(ui.visible('savePanel'),true);assert.equal(ui.battle.tick,0);assert.equal(storage.writes,0);
});
for(const mode of ['test','demo','demo&showcase=companions','expedition','skirmish'])test(`local-saves URL is ignored by independent mode ${mode}`,async t=>{
 const storage=new Storage();seed(storage);const before=[...storage.data],ui=await loadGameUI(t,{search:`?mode=${mode}&open=local-saves`,storage});assert.equal(ui.visible('savePanel'),false);assert.deepEqual([...storage.data],before);assert.equal(storage.writes,0);assert.equal(storage.removes,0);const tick=ui.battle.tick;ui.frames(5);assert.equal(ui.battle.tick,tick);
});
test('ordinary campaign entry remains unchanged and empty storage autosaves normally',async t=>{
 const storage=new Storage(),ui=await loadGameUI(t,{search:'?open=other',storage});assert.equal(ui.visible('savePanel'),false);assert.equal(storage.writes,1);assert.equal(ui.visible('localHubChoices'),false);ui.click('start');await ui.settle();ui.frames(4);assert.ok(ui.battle.tick>0);assert.equal(storage.writes,2);
});
test('chooser import is staged without mutation and explicit acceptance uses the first free slot',async t=>{
 const storage=new Storage(),ui=await loadGameUI(t,{search,storage});ui.get('loadCode').value=new CampaignProfiles({defaultName:'Imported company'}).exportBundle();ui.click('importCode');await ui.settle();assert.equal(ui.visible('localConfirm'),true);assert.equal(storage.writes,0);ui.click('localConfirmCancel');await ui.settle();assert.equal(storage.writes,0);ui.click('importCode');await ui.settle();ui.click('localConfirmAccept');await ui.settle();const store=createLocalCampaignStore({storage});assert.equal(store.read(1).latest.manager.active.name,'Imported company');assert.equal(store.read(2).status,'empty');assert.equal(ui.battle.tick,0);
});
test('chooser entry uses no deferred startup or URL profile/slot restore',()=>{
 const script=readFileSync(new URL('../site/dist/battle.mjs',import.meta.url),'utf8');const seam=script.slice(script.indexOf('// Synchronous, one-shot entry only.'));assert.match(seam,/activeDestination==='campaign'.*!testingMode.*!demoMode.*!temporarySessionActive\(\).*?!started.*?!openPanelId/);assert.doesNotMatch(seam,/setTimeout|setInterval|Promise|requestAnimationFrame|requestContinue|onRestore|begin\(|checkpoint\(/);
});
