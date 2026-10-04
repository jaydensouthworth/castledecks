import test from 'node:test';
import assert from 'node:assert/strict';
import {inlineGame,inlinePreview,cloudCheckpoint,cloudServer} from './helpers/cloud-inline-fixture.mjs';
import {deferredFile} from './helpers/game-ui-harness.mjs';
import {MemoryStorage,TestLocks} from './helpers/local-storage.mjs';
import {createLocalCampaignStore,parseLocalCheckpoint,checkpointSlotKey} from '../site/dist/local-campaign-store.mjs';
import {CampaignProfiles} from '../site/dist/engine/profile-manager.mjs';
import {PlayerProfile,serializeProfile} from '../site/dist/engine/progression.mjs';
import {captureDeck,exportDeckCode} from '../site/dist/deck-presets-model.mjs';
const allBytes=storage=>[...storage.data];
const cloudReads=backend=>backend.requests.filter(r=>r.path.startsWith('/api/saves/')).length;
const openDecks=ui=>{ui.click('closeSave');ui.click('introLoadout');ui.click('openDeckPresets');};
const saveDeck=(ui,name)=>{ui.get('deckNewName').value=name;ui.dispatch(ui.get('deckSaveForm'),'submit');};

test('Crownroad review has explicit final destinations in Saves with no second confirmation',async t=>{
 const {ui,storage,backend}=await inlineGame(t),before=allBytes(storage),original=ui.battle;
 await inlinePreview(ui);assert.equal(ui.visible('savePanel'),true);assert.equal(ui.visible('localConfirm'),false);assert.equal(ui.get('cloud-preview').hidden,false);
 assert.equal(ui.get('cloud-confirm').textContent,'Load into device slot 2');assert.equal(ui.get('cloud-session').textContent,'Load for this session only');
 assert.match(ui.get('cloud-preview').textContent,/replaces your current campaign session.*Export any unsaved progress first/);
 assert.match(ui.get('cloud-preview').textContent,/Existing device saves and the cloud copy stay unchanged/);
 assert.equal(ui.get('cloud-confirm').getAttribute('aria-describedby'),'cloud-review-effect');assert.equal(ui.get('cloud-preview').getAttribute('role'),null);
 assert.equal(ui.battle,original);assert.deepEqual(allBytes(storage),before);assert.equal(cloudReads(backend),1);
 ui.click('cloud-session');await ui.settle();assert.equal(ui.battle.profile.name,'Cloud second');assert.equal(ui.visible('localConfirm'),false);assert.deepEqual(allBytes(storage),before);
 assert.match(ui.get('introNotice').textContent,/session only/);assert.doesNotMatch(ui.get('cloud-status').textContent,/cancelled/);assert.equal(cloudReads(backend),2);
});

test('inline Cancel restores Load focus and neither transfers nor switches the running game',async t=>{
 const {ui,storage,backend}=await inlineGame(t),before=allBytes(storage),original=ui.battle;await inlinePreview(ui);ui.click('cloud-cancel');
 assert.equal(ui.document.activeElement,ui.get('cloud-restore'));assert.equal(ui.get('cloud-preview').hidden,true);assert.equal(ui.battle,original);assert.deepEqual(allBytes(storage),before);assert.equal(cloudReads(backend),1);
});

test('review remains inline during final checks and Cancel invalidates their late completion',async t=>{
 const {ui,storage,backend}=await inlineGame(t),before=allBytes(storage),original=ui.battle;await inlinePreview(ui);const held=backend.holdDownload();ui.click('cloud-session');await ui.settle();
 assert.equal(ui.get('cloud-preview').hidden,false);assert.equal(ui.get('cloud-confirm').disabled,true);assert.equal(ui.get('cloud-session').disabled,true);assert.equal(ui.visible('localConfirm'),false);
 ui.click('cloud-cancel');held.resolve();await ui.settle();assert.equal(ui.battle,original);assert.deepEqual(allBytes(storage),before);assert.equal(ui.get('cloud-preview').hidden,true);
});

test('repeated final clicks dispatch one recheck and reserve one new device slot',async t=>{
 const {ui,storage,backend}=await inlineGame(t),store=createLocalCampaignStore({storage,locks:new TestLocks()});await inlinePreview(ui);const held=backend.holdDownload(),accept=ui.get('cloud-confirm').onclick;accept();accept();await ui.settle();assert.equal(cloudReads(backend),2);held.resolve();await ui.settle();
 assert.equal(store.read(1).latest.manager.active.name,'Castledecks');assert.equal(store.read(2).latest.manager.active.name,'Cloud second');assert.equal(store.read(3).status,'empty');
});

test('stale final-action closures cannot accept a different review',async t=>{
 const {ui,storage,backend}=await inlineGame(t),original=ui.battle,before=allBytes(storage);await inlinePreview(ui);const oldAccept=ui.get('cloud-session').onclick;ui.click('cloud-cancel');await inlinePreview(ui);const reads=cloudReads(backend);await oldAccept();await ui.settle();
 assert.equal(cloudReads(backend),reads);assert.equal(ui.battle,original);assert.deepEqual(allBytes(storage),before);assert.equal(ui.get('cloud-preview').hidden,false);ui.click('cloud-session');await ui.settle();assert.equal(ui.battle.profile.name,'Cloud second');
});

for(const change of ['revision','document','account'])test(`a changed ${change} cannot commit from an inline destination choice`,async t=>{
 const changedDocument=cloudCheckpoint(change==='document'?'Changed remote':'Cloud second'),{ui,storage,backend}=await inlineGame(t),original=ui.battle,before=allBytes(storage);await inlinePreview(ui);
 if(change==='revision')backend.setRemote(changedDocument,2);else if(change==='document')backend.setRemote(changedDocument,1);else backend.setIdentity('synthetic-inline-B');
 ui.click('cloud-session');await ui.settle();assert.equal(ui.battle,original);assert.deepEqual(allBytes(storage),before);assert.equal(ui.get('cloud-preview').hidden,true);assert.match(ui.get('cloud-status').textContent,/changed/);
});

test('new code import immediately clears inline cloud review and retains its own explicit confirmation',async t=>{
 const {ui}=await inlineGame(t);await inlinePreview(ui);const stale=ui.get('cloud-session').onclick;ui.get('loadCode').value=new CampaignProfiles({defaultName:'New local intent'}).exportBundle();ui.click('importCode');
 assert.equal(ui.get('cloud-preview').hidden,true);assert.equal(ui.visible('localConfirm'),true);await stale();ui.click('localConfirmAccept');await ui.settle();assert.equal(ui.battle.profile.name,'New local intent');
});

test('a new cloud-load choice cancels an older staged local import before previewing',async t=>{
 const {ui}=await inlineGame(t);ui.get('loadCode').value=new CampaignProfiles({defaultName:'Old local intent'}).exportBundle();ui.click('importCode');assert.equal(ui.visible('localConfirm'),true);await ui.settle();await inlinePreview(ui);assert.equal(ui.visible('localConfirm'),false);ui.click('localConfirmAccept');await ui.settle();assert.equal(ui.battle.profile.name,'Castledecks');ui.click('cloud-session');await ui.settle();assert.equal(ui.battle.profile.name,'Cloud second');
});

test('a new cloud load supersedes a still-reading local file without adopting its late result',async t=>{
 const {ui}=await inlineGame(t),file=deferredFile(),loading=ui.load(file.file);await inlinePreview(ui);file.resolve(new CampaignProfiles({defaultName:'Late file'}).exportBundle());await loading;assert.equal(ui.visible('localConfirm'),false);assert.equal(ui.get('cloud-preview').hidden,false);ui.click('cloud-session');await ui.settle();assert.equal(ui.battle.profile.name,'Cloud second');
});

test('navigation and Escape dismiss review; reopening cannot revive captured final callbacks',async t=>{
 for(const action of ['close','escape','navigate'])await t.test(action,async t=>{const {ui,storage}=await inlineGame(t),original=ui.battle,before=allBytes(storage);await inlinePreview(ui);const stale=ui.get('cloud-session').onclick;
 if(action==='close')ui.click('closeSave');else if(action==='escape')ui.dispatch(ui.document,'keydown',{key:'Escape',target:ui.get('cloud-session')});else ui.click('shell-savePanel-profiles');
 assert.equal(ui.visible('savePanel'),false);ui.click('introSave');await ui.settle();await stale();assert.equal(ui.get('cloud-preview').hidden,true);assert.equal(ui.visible('localConfirm'),false);assert.equal(ui.battle,original);assert.deepEqual(allBytes(storage),before);});
});

test('a device slot occupied during final read is preserved and the session does not change',async t=>{
 const remotePayload=parseLocalCheckpoint(cloudCheckpoint('Another tab')).payload,{ui,storage,backend}=await inlineGame(t),store=createLocalCampaignStore({storage,locks:new TestLocks()}),original=ui.battle;await inlinePreview(ui);const held=backend.holdDownload();ui.click('cloud-confirm');await ui.settle();await store.write(2,remotePayload);const before=allBytes(storage);held.resolve();await ui.settle();assert.equal(ui.battle,original);assert.deepEqual(allBytes(storage),before);assert.equal(store.read(3).status,'empty');assert.match(ui.get('cloud-status').textContent,/device slot changed/);
});

test('an earlier pending save stays with its original manager when cloud load takes a new slot',async t=>{
 const locks=new TestLocks(),{ui,storage}=await inlineGame(t,{locks}),store=createLocalCampaignStore({storage,locks});ui.click('closeSave');locks.pauseNext=true;ui.battle.profile.gold=654;ui.click('introSave');await ui.settle();assert.ok(locks.release);await inlinePreview(ui);assert.equal(ui.get('cloud-confirm').textContent,'Load into device slot 2');ui.click('cloud-confirm');await ui.settle();assert.equal(ui.battle.profile.name,'Cloud second');assert.equal(store.read(2).status,'empty');locks.release();await ui.settle();assert.equal(store.read(1).latest.manager.active.gold,654);assert.equal(store.read(2).latest.manager.active.gold,4321);assert.equal(store.read(2).latest.payload.activeIndex,1);
});

test('late write conflict keeps the competing bytes and reports the loaded session needs attention',async t=>{
 const raw=cloudCheckpoint('Competing writer'),locks=new TestLocks(),{ui,storage}=await inlineGame(t,{locks}),store=createLocalCampaignStore({storage,locks});await inlinePreview(ui);locks.pauseNext=true;ui.click('cloud-confirm');await ui.settle();assert.ok(locks.release);assert.equal(ui.battle.profile.name,'Cloud second');
 storage.setItem(checkpointSlotKey(2,'a'),raw);locks.release();await ui.settle();assert.equal(storage.getItem(checkpointSlotKey(2,'a')),raw);assert.equal(store.read(2).latest.manager.active.name,'Competing writer');assert.match(ui.get('localHubStatus').textContent,/already has a campaign/);ui.click('introSave');ui.click('showSaveCode');assert.equal(CampaignProfiles.fromBundle(ui.get('saveCode').value).profiles[1].name,'Cloud second');
});

test('no Web Locks offers only a session load and preserves every local byte',async t=>{
 const {ui,storage}=await inlineGame(t,{locks:null}),before=allBytes(storage);await inlinePreview(ui);assert.equal(ui.get('cloud-confirm').disabled,true);assert.equal(ui.get('cloud-session').disabled,false);ui.click('cloud-session');await ui.settle();assert.equal(ui.battle.profile.name,'Cloud second');assert.deepEqual(allBytes(storage),before);
});

test('inline deck review previews renamed duplicates and missing cards, then adds without equipping',async t=>{
 const p=new PlayerProfile('Imported');p.gold=999999;p.purchase('grunt');const incoming=captureDeck(p,'Same name'),{ui,backend}=await inlineGame(t,{document:exportDeckCode([incoming])});openDecks(ui);saveDeck(ui,'Same name');ui.click('closeDeckPresets');ui.click('closeSkills');ui.click('introSave');await ui.settle();const before=serializeProfile(ui.battle.profile);await inlinePreview(ui,'decks');assert.match(ui.get('cloud-preview').textContent,/Same name \(2\)/);assert.match(ui.get('cloud-preview').textContent,/Missing cards: Grunt/);ui.click('cloud-confirm');await ui.settle();assert.equal(ui.visible('savePanel'),true);assert.equal(ui.visible('deckConfirm'),false);assert.equal(serializeProfile(ui.battle.profile),before);assert.equal(backend.requests.some(r=>r.options.method==='PUT'),false);openDecks(ui);assert.match(ui.get('deckList').textContent,/Same name \(2\)/);
});

test('full deck library refuses the cloud review without deleting, replacing or equipping anything',async t=>{
 const p=new PlayerProfile('Imported'),{ui}=await inlineGame(t,{document:exportDeckCode([captureDeck(p,'Extra')])});openDecks(ui);for(let i=0;i<12;i++)saveDeck(ui,'Deck '+i);ui.click('closeDeckPresets');ui.click('closeSkills');ui.click('introSave');await ui.settle();const before=serializeProfile(ui.battle.profile);await inlinePreview(ui,'decks');assert.equal(ui.get('cloud-preview').hidden,true);assert.match(ui.get('cloud-status').textContent,/0 available.*No decks were added/);assert.equal(serializeProfile(ui.battle.profile),before);openDecks(ui);assert.match(ui.get('deckCount').textContent,/12 \/ 12/);
});

test('empty deck cloud copy reports nothing to add without opening another workspace',async t=>{
 const {ui}=await inlineGame(t,{document:exportDeckCode([])});await inlinePreview(ui,'decks');assert.equal(ui.visible('savePanel'),true);assert.equal(ui.visible('skillsPanel'),false);assert.equal(ui.visible('deckConfirm'),false);assert.equal(ui.get('cloud-preview').hidden,true);assert.match(ui.get('cloud-status').textContent,/contains no saved decks/);
});

for(const phase of ['preview download','final validation'])for(const action of ['Cancel','Back','Escape'])test(`${action} during ${phase} cancels its late response and preserves all local data`,async t=>{
 const {ui,storage,backend}=await inlineGame(t),original=ui.battle,before=allBytes(storage);
 if(phase==='final validation')await inlinePreview(ui);
 const held=backend.holdDownload();ui.click(phase==='final validation'?'cloud-session':'cloud-restore');await ui.settle();
 // Back/Escape are the visible initial-download exits. This Cancel invocation
 // also proves a queued callback from the previous inline review is harmless.
 if(action==='Cancel')await ui.get('cloud-cancel').onclick();else if(action==='Back')ui.click('closeSave');else ui.key('keydown','Escape');
 held.resolve();await ui.settle();assert.equal(ui.battle,original);assert.deepEqual(allBytes(storage),before);assert.equal(ui.get('cloud-preview').hidden,true);assert.equal(ui.visible('localConfirm'),false);
 if(action!=='Cancel'){ui.click('introSave');await ui.settle();assert.equal(ui.get('cloud-preview').hidden,true);}
 assert.equal(backend.requests.some(r=>r.options.method==='PUT'),false);
});

test('rapid Load clicks perform one preview request and expose one inline choice',async t=>{
 const {ui,backend}=await inlineGame(t),held=backend.holdDownload(),before=backend.requests.filter(r=>r.path==='/api/account').length;
 ui.click('cloud-restore');ui.click('cloud-restore');await ui.settle();assert.equal(backend.requests.filter(r=>r.path==='/api/account').length,before+1);assert.equal(cloudReads(backend),1);held.resolve();await ui.settle();assert.equal(ui.get('cloud-preview').hidden,false);assert.equal(ui.visible('localConfirm'),false);
});

test('cloud slot/type changes invalidate captured final actions without a transfer',async t=>{
 const {ui,storage,backend}=await inlineGame(t),original=ui.battle,before=allBytes(storage);await inlinePreview(ui);const old=ui.get('cloud-session').onclick;ui.click('cloud-slot-2');await old();assert.equal(cloudReads(backend),1);assert.equal(ui.get('cloud-preview').hidden,true);await inlinePreview(ui);const next=ui.get('cloud-session').onclick;ui.get('cloud-kind').value='decks';ui.get('cloud-kind').onchange();await next();assert.equal(cloudReads(backend),2);assert.equal(ui.battle,original);assert.deepEqual(allBytes(storage),before);
});

test('uncertain upload recovery survives an explicit session load and still blocks new uploads',async t=>{
 const document=cloudCheckpoint(),storage=new MemoryStorage(),key='castledecks:cloud:pending-upload:v1',note=JSON.stringify({schema:'castledecks-cloud-upload-1',accountID:'synthetic-inline-A',kind:'crownroad',slot:1,expectedRevision:1,document,createdAt:1});storage.setItem(key,note);
 const {ui,backend}=await inlineGame(t,{storage,document});assert.equal(ui.get('cloud-upload').disabled,true);await inlinePreview(ui);ui.click('cloud-session');await ui.settle();assert.equal(ui.battle.profile.name,'Cloud second');assert.equal(storage.getItem(key),note);ui.click('introSave');await ui.settle();assert.equal(ui.get('cloud-upload').disabled,true);assert.equal(ui.get('cloud-reconcile').hidden,false);ui.click('cloud-reconcile');await ui.settle();assert.equal(storage.getItem(key),note);assert.match(ui.get('cloud-status').textContent,/has not verified/);assert.equal(backend.requests.some(r=>r.options.method==='PUT'),false);
});

test('model refuses absent, disabled or stale destination choices before doing any final account read',async()=>{
 const {createCloudAccountModel}=await import('../site/dist/cloud-account-model.mjs');let reads=0,restores=0;
 const bridge={kinds:()=>['crownroad'],capture:()=>({}),matches:()=>true,planRestore:()=>({choices:[{id:'local',label:'No empty device slot',disabled:true},{id:'session',label:'Session only'}]}),restore(_kind,_document,_capture,choice){assert.equal(choice,'session');restores++;return {restored:true};}};
 const client={async account(){reads++;return {id:'synthetic',expiresAt:1};},async download(){return {revision:1,document:'fixture'};}};
 const model=createCloudAccountModel({client,bridge,journal:{read:()=>({pending:null,blocked:false})},enabled:true});await model.prepareRestore('crownroad',1);const old=model.snapshot().review;
 for(const choice of [null,'local','unreviewed'])await assert.rejects(model.confirm(choice),/reviewed load options/);assert.equal(reads,1);assert.equal(restores,0);
 await model.prepareRestore('crownroad',1);await assert.rejects(model.confirm('session',old),/Review a cloud action first/);assert.equal(reads,2);assert.equal(restores,0);await model.confirm('session');assert.equal(restores,1);assert.equal(reads,3);
});
