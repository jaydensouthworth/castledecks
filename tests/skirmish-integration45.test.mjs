import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadGameUI,deferredFile} from './helpers/game-ui-harness.mjs';
import {MemoryStorage,TestLocks,settle} from './helpers/local-storage.mjs';
import {CampaignProfiles} from '../site/dist/engine/profile-manager.mjs';
import {ExpeditionProfiles} from '../site/dist/expedition-model.mjs';
import {createLocalCampaignStore,snapshotCampaign} from '../site/dist/local-campaign-store.mjs';
import {SkirmishBattle,SkirmishProfiles} from '../site/dist/skirmish-battle.mjs';
import {createSkirmish,DEFAULT_SKIRMISH,validateSkirmishDescriptor,decodeSkirmishDescriptor} from '../site/dist/skirmish-model.mjs';
import {campaignScene} from '../site/dist/campaign-region-art.mjs';
const switchTo=(ui,id)=>{ui.get('hubDestinations').querySelector(`[data-hub-destination="${id}"]`).click();ui.click('start');if(ui.visible('switchSessionConfirm'))ui.click('confirmSessionSwitch');ui.frames();};
const frozen=b=>JSON.stringify({profile:b.profile,tick:b.tick,stats:b.stats,remaining:b.enemies.remaining,withdrawn:b.enemies.withdrawn,queue:b.friendlyQueue.queue,reserve:b.friendlyQueue.population,good:b.goodTeam.map(u=>[u.type,u.x,u.y,u.hp]),bad:b.badTeam.map(u=>[u.type,u.x,u.y,u.hp])});
function naturalDefeat(ui){ui.click('start');for(let n=0;n<15000&&!ui.battle.summary;n++)ui.battle.step();assert.equal(ui.battle.summary?.outcome,'defeat');}

test('strict descriptor rejects hidden keys, symbols and accessors without reading getters',()=>{
 let reads=0;const accessor={...DEFAULT_SKIRMISH};Object.defineProperty(accessor,'seed',{get(){reads++;return 1;}});
 const hidden={...DEFAULT_SKIRMISH};Object.defineProperty(hidden,'extra',{value:true});
 for(const invalid of [accessor,hidden,{...DEFAULT_SKIRMISH,[Symbol('extra')]:true},{...DEFAULT_SKIRMISH,seed:Number.MAX_SAFE_INTEGER},{...DEFAULT_SKIRMISH,version:2},{...DEFAULT_SKIRMISH,threat:'insane'}])assert.throws(()=>validateSkirmishDescriptor(invalid));
 assert.equal(reads,0);for(const code of ['SK2:1:oaks:standard:vanguard','SK1:01:oaks:standard:vanguard','x'.repeat(101)])assert.throws(()=>decodeSkirmishDescriptor(code));
});
test('bounded fallback branch uses four attempts, reaches flat terrain, and rejects complete failure',async()=>{
 // Isolated branch probe only: production source is unchanged. Replace only the
 // reach sampler with controlled decisions, preserving the actual generator.
 const url=new URL('../site/dist/skirmish-model.mjs',import.meta.url),original=await readFile(url,'utf8');
 for(const succeeds of [true,false]){
  let source=original.replaceAll("from './engine/",`from '${new URL('../site/dist/engine/',import.meta.url).href}`);
  source=source.replace(/import \{validateAutoAimZones\} from '[^']+';/,`let attempts=0;const validateAutoAimZones=()=>({ok:${succeeds}&&++attempts===4,checkedZones:6});`);
  const isolated=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  if(succeeds){const scenario=isolated.createSkirmish();assert.equal(scenario.reach.attempts,4);assert.equal(new Set(scenario.encounter.heights).size,1);}else assert.throws(()=>isolated.createSkirmish(),/bounded fallback/);
 }
});
test('all biome previews use the identical generated terrain, company and regional artwork metadata',()=>{
 for(const biome of ['oaks','lowlands','pines','wasteland'])for(const threat of ['scout','standard','veteran'])for(const doctrine of ['vanguard','skywatch','siege']){
  const descriptor={...DEFAULT_SKIRMISH,biome,threat,doctrine},s=createSkirmish(descriptor),b=new SkirmishBattle({descriptor});
  assert.deepEqual(b.encounter,s.encounter);assert.deepEqual(b.terrain.samples,s.encounter.heights);assert.equal(b.badCastle.hp,s.encounter.enemyKeepHP);assert.equal(b.enemies.roster.length,s.encounter.roster.length);assert.equal(campaignScene(b.levelData).scenery,biome);assert.equal(campaignScene(b.levelData).timeOfDay,s.encounter.timeOfDay);assert.equal(b.profile.gold,1200);assert.equal(b.stats.goldSpent,0);assert.equal(b.friendlyQueue.population,70);
 }
});
test('practice checkpoint boundary never invokes forbidden profile codec for any checkpoint reason',()=>{
 const scenario=createSkirmish(),profiles=new SkirmishProfiles(scenario),battle=new SkirmishBattle({descriptor:scenario.descriptor,profile:profiles.active});let exports=0;profiles.exportBundle=()=>{exports++;throw new Error('Forbidden practice codec');};
 for(const reason of ['ready','battle-start','result','purchase','settings','loadout','import','unknown'])assert.equal(snapshotCampaign({profiles,battle,destination:'skirmish'},reason),null);assert.equal(exports,0);
});
test('current Army keeps post-result practice auto, queue and management read-only',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=skirmish'});ui.click('skirmishPrepare');naturalDefeat(ui);const old=ui.battle,before=frozen(old);ui.click('endingLobby');ui.click('introArmy');
 assert.match(ui.get('queueStatus').textContent,/read-only/);assert.equal(ui.get('armyAuto-grunt').disabled,true);ui.click('armyAuto-grunt');ui.click('army-card-grunt');assert.equal(ui.get('armyInspectAuto').disabled,true);assert.equal(ui.get('armyRecruit').disabled,true);assert.equal(ui.get('armyInspectLoadout').disabled,true);ui.click('armyInspectAuto');ui.click('armyRecruit');ui.click('armyCloseInspector');assert.equal(ui.get('armyArmory').disabled,true);assert.equal(ui.get('armyLoadout').disabled,true);assert.equal(frozen(old),before);
 ui.click('closeQueue');ui.click('start');ui.click('introArmy');assert.equal(ui.get('armyAuto-grunt').disabled,false);ui.click('armyAuto-grunt');assert.equal(ui.battle.profile.skills.find(s=>s.id==='grunt').autocast,true);assert.equal(old.profile.skills.find(s=>s.id==='grunt').autocast,false);
});
test('local campaign slots and exact paused campaign, charter and training survive practice result and retry',async t=>{
 const storage=new MemoryStorage(),ui=await loadGameUI(t,{storage}),store=createLocalCampaignStore({storage,locks:new TestLocks()}),campaign=ui.battle;
 ui.click('start');await settle();ui.frames(5);ui.click('battlePause');ui.click('pauseLobby');await settle();const campaignBefore=frozen(campaign),saved=[...storage.data];
 switchTo(ui,'expedition');const charter=ui.battle;ui.click('start');ui.frames(8);ui.click('battlePause');ui.click('pauseLobby');const charterBefore=frozen(charter);
 switchTo(ui,'training');const training=ui.battle;ui.click('start');ui.frames(7);ui.click('battlePause');ui.click('pauseLobby');const trainingBefore=frozen(training);
 switchTo(ui,'skirmish');ui.click('skirmishPrepare');assert.equal(ui.get('localManage').getClientRects().length,0);assert.equal(ui.visible('localSaveManager'),false);assert.match(ui.get('localHubStatus').textContent,/seed code/);assert.doesNotMatch(ui.get('localHubStatus').textContent,/Local slot|Export a file/);naturalDefeat(ui);ui.click('replay');await settle();assert.equal(ui.battle.profile.gold,1200);assert.deepEqual([...storage.data],saved);assert.equal(store.read(1).latest.manager.active.cheated,false);
 const practice=ui.battle;for(const [id,b,before]of [['expedition',charter,charterBefore],['training',training,trainingBefore],['campaign',campaign,campaignBefore]]){switchTo(ui,id);assert.equal(ui.battle,b);assert.equal(frozen(b),before);await settle();assert.deepEqual([...storage.data],saved);}
 switchTo(ui,'skirmish');assert.equal(ui.battle,practice);assert.equal(practice.tick,0);assert.equal(practice.profile.gold,1200);assert.equal(practice.stats.goldSpent,0);assert.equal(practice.friendlyQueue.population,70);await settle();assert.deepEqual([...storage.data],saved);
});
test('late campaign checkpoint finishes in its original slot without leaking save status into workshop',async t=>{
 const storage=new MemoryStorage(),locks=new TestLocks(),ui=await loadGameUI(t,{storage,locks}),store=createLocalCampaignStore({storage,locks});locks.pauseNext=true;ui.battle.profile.gold=321;ui.click('introSave');await settle();assert.ok(locks.release);ui.click('closeSave');switchTo(ui,'skirmish');const practice=ui.battle;locks.release();await settle();
 assert.equal(ui.battle,practice);assert.equal(store.read(1).latest.manager.active.gold,321);assert.equal(store.read(1).latest.manager.active.cheated,false);assert.match(ui.get('localHubStatus').textContent,/seed code/);assert.equal(ui.get('localHubStatus').getClientRects().length,0);assert.equal(ui.visible('localSaveManager'),false);
});
test('all unsupported campaign and charter imports leave workshop identity and local saves unchanged',async t=>{
 const storage=new MemoryStorage(),ui=await loadGameUI(t,{storage,search:'?mode=skirmish'}),battle=ui.battle,before=frozen(battle);
 for(const text of [new CampaignProfiles().exportBundle(),new ExpeditionProfiles().exportBundle(),'SK9:1:oaks:standard:vanguard','{"version":99}']){ui.get('loadCode').value=text;ui.click('importCode');await ui.load({size:text.length,text:async()=>text});ui.click('localConfirmAccept');await settle();assert.equal(ui.battle,battle);assert.equal(frozen(battle),before);assert.equal(storage.writes,0);}
});
test('new workshop selection keeps a paused campaign frontier and pending import untouched',async t=>{
 const ui=await loadGameUI(t),campaign=ui.battle,file=deferredFile();const pending=ui.load(file.file);switchTo(ui,'skirmish');ui.get('skirmishSeed').value='983';ui.click('skirmishPrepare');const practice=ui.battle;file.resolve(new CampaignProfiles({defaultName:'Late'}).exportBundle());await pending;assert.equal(ui.battle,practice);switchTo(ui,'campaign');assert.equal(ui.battle,campaign);assert.equal(campaign.profile.highestLevel,1);assert.equal(campaign.profile.cheated,false);
});

test('practice restart and automatic recruitment help describe disposable supplies accurately',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=skirmish'});assert.match(ui.get('autoHelp').textContent,/starts off/);assert.match(ui.get('restartDescription').textContent,/discarded/);ui.click('skirmishPrepare');switchTo(ui,'campaign');assert.match(ui.get('autoHelp').textContent,/on by default/);assert.match(ui.get('restartDescription').textContent,/stay with this profile/);
});
test('45 modal focus excludes inert seed controls during replacement confirmation',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=skirmish'});ui.click('skirmishPrepare');ui.click('start');ui.frames(2);ui.click('battlePause');ui.click('pauseWorkshop');ui.click('skirmishPrepare');assert.equal(ui.get('skirmishWorkshopHost').inert,true);
 ui.get('closeWorkshop').focus();ui.key('keydown','Tab',{shiftKey:true});assert.equal(ui.document.activeElement,ui.get('skirmishReplaceAttempt'));ui.key('keydown','Tab');assert.equal(ui.document.activeElement,ui.get('closeWorkshop'));
 ui.key('keydown','Escape');assert.equal(ui.visible('skirmishPanel'),false);assert.equal(ui.get('skirmishWorkshopHost').inert,false);assert.equal(ui.visible('skirmishReplaceConfirm'),false);
});
