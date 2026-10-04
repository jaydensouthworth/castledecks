import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {PlayerProfile,serializeProfile,restoreProfile} from '../site/dist/engine/progression.mjs';
import {CampaignProfiles} from '../site/dist/engine/profile-manager.mjs';
import {FirstBattle,prepareCastleSelection} from '../site/dist/engine/first-battle.mjs';
import {seededRandom} from '../site/dist/engine/combat.mjs';
import {captureDeck,applyDeck,previewDeck,parseDeckCode,exportDeckCode,createProfileDecks,validateDeck,validateProfileDecks} from '../site/dist/deck-presets-model.mjs';
import {captureCastleCollection,validateCastleCollection,selectedCastle} from '../site/dist/castle-loadout-model.mjs';
import {createLocalCampaignStore,snapshotCampaign,parseLocalCheckpoint,createLocalCheckpointEnvelope,checkpointSlotKey} from '../site/dist/local-campaign-store.mjs';
import {ExpeditionProfiles,restoreExpeditions} from '../site/dist/expedition-model.mjs';
import {createGameSaveCodecs} from '../site/dist/cloud-save-codecs.mjs';
import {createCloudGameBridge} from '../site/dist/cloud-game-bridge.mjs';
import {createAccountClient} from '../site/dist/cloud-account-client.mjs';
import {createUploadJournal,UPLOAD_JOURNAL_KEY} from '../site/dist/cloud-upload-journal.mjs';
import {MemoryStorage,TestLocks} from './helpers/local-storage.mjs';
const root=fileURLToPath(new URL('../site/dist/',import.meta.url));
const classic={id:'classic',level:1},highwatch={id:'highwatch',level:1};
const profile=()=>{const p=new PlayerProfile('Castle tester');p.gold=1500;p.cheated=false;return p;};
const owned=()=>{const p=profile();assert.equal(p.purchaseCastle('highwatch'),true);return p;};
const fixture=kind=>readFile(new URL(`./cloud-fixtures/${kind}.json`,import.meta.url),'utf8');
const codecs=createGameSaveCodecs({parseLocalCheckpoint,restoreExpeditions,parseDeckCode});
const clone=value=>JSON.parse(JSON.stringify(value));
const snapshot=p=>({save:serializeProfile(p),skills:p.skills.map(skill=>({...skill})),identities:[...p.skills]});

test('new profiles own only free Classic level1 and Azure; bow slots are unchanged',()=>{
 const p=new PlayerProfile();assert.deepEqual(captureCastleCollection(p),{owned:[classic],selected:'classic'});assert.equal(p.paletteId,'azure');assert.deepEqual(p.skills.map(s=>[s.id,s.binding]),[['arrow',0]]);
});
for(const gold of [1499,1500,1501])test(`castle purchase uses only existing gold at ${gold}`,()=>{
 const p=profile();p.gold=gold;const before=snapshot(p);const result=p.purchaseCastle('highwatch');assert.equal(result,gold>=1500);
 assert.equal(p.gold,gold>=1500?gold-1500:gold);assert.equal(p.castleId,'classic');assert.equal(p.castleLevels.has('highwatch'),gold>=1500);assert.deepEqual(p.skills,before.identities);assert.deepEqual(p.skills.map(s=>({...s})),before.skills);
 if(result){assert.equal(p.purchaseCastle('highwatch'),false);assert.equal(p.gold,gold-1500);}
});
test('unknown castle, invalid currency and nonwritable purchase fields fail without mutation',()=>{
 for(const gold of [NaN,Infinity,-1,1500.5]){const p=profile();p.gold=gold;assert.equal(p.purchaseCastle('highwatch'),false);assert.equal(p.castleLevels.size,1);}
 const p=profile();assert.equal(p.purchaseCastle('future'),false);Object.defineProperty(p,'castleLevels',{writable:false});assert.equal(p.purchaseCastle('highwatch'),false);assert.equal(p.gold,1500);
});
test('level-bearing ownership validates all records but rejects any current paid level above1',()=>{
 for(const value of [{owned:[],selected:'classic'},{owned:[highwatch],selected:'highwatch'},{owned:[classic,classic],selected:'classic'},{owned:[classic],selected:'highwatch'},{owned:[classic,{id:'highwatch',level:2}],selected:'classic'},{owned:[classic,{id:'future',level:1}],selected:'classic'}])assert.throws(()=>validateCastleCollection(value));
 const p=owned();assert.throws(()=>p.equipCastle({id:'highwatch',level:2}));assert.equal(p.castleId,'classic');
});
test('profile3 round-trips castle levels selection palette and all ordinary progress',()=>{
 const p=owned();p.equipCastle(highwatch);p.paletteId='indigo-brass';const save=JSON.parse(serializeProfile(p));assert.equal(save.schema,'bowmaster-reconstruction-3');assert.deepEqual(save.castles,{owned:[classic,highwatch],selected:'highwatch'});
 const restored=restoreProfile(JSON.stringify(save));assert.deepEqual(selectedCastle(restored),highwatch);assert.equal(restored.paletteId,'indigo-brass');assert.equal(serializeProfile(restored),serializeProfile(p));
});
for(const version of [1,2])test(`legacy profile${version} migrates to Classic/Azure without spending or purchases`,async()=>{
 const legacy=JSON.parse((JSON.parse(await fixture('crownroad'))).payload.bundle).profiles[0].profile;legacy.schema=`bowmaster-reconstruction-${version}`;if(version===1)delete legacy.companions;
 const restored=restoreProfile(JSON.stringify(legacy));assert.deepEqual(captureCastleCollection(restored),{owned:[classic],selected:'classic'});assert.equal(restored.paletteId,'azure');assert.equal(restored.gold,legacy.gold);assert.deepEqual(restored.skills.map(s=>[s.id,s.rank,s.binding]),legacy.skills.map(s=>[s.id,s.rank,s.binding]));
});
test('future castle profile import fails atomically without replacing active manager or timers',()=>{
 const p=owned(),manager=new CampaignProfiles({profiles:[p]});p.skills[0].cooldown=17;
 for(const alter of [v=>v.profiles[0].profile.castles.owned.push({id:'future',level:1}),v=>v.profiles[0].profile.castles.owned[0].level=2,v=>v.profiles[0].profile.appearance.palette='future',v=>v.schema='bowmaster-reconstruction-profiles-9']){
  const value=JSON.parse(manager.exportBundle());alter(value);assert.throws(()=>manager.importBundle(JSON.stringify(value)));assert.equal(manager.active,p);assert.equal(p.skills[0].cooldown,17);assert.equal(p.gold,0);
 }
});
test('new profile cannot be mislabeled as old collection envelope',()=>{
 const manager=new CampaignProfiles({profiles:[owned()]}),value=JSON.parse(manager.exportBundle());value.schema='bowmaster-reconstruction-profiles-1';assert.throws(()=>CampaignProfiles.fromBundle(JSON.stringify(value)));
});
test('deck2 contains one castle and30 untouched keys, never appearance or ownership',()=>{
 const p=owned();p.equipCastle(highwatch);p.paletteId='ivory-slate';const deck=captureDeck(p,'Highwatch');assert.equal(deck.slots.length,30);assert.deepEqual(deck.castle,highwatch);assert.deepEqual(deck.slots.filter(Boolean),['arrow']);assert.deepEqual(Object.keys(deck),['name','slots','companion','castle']);
 const code=exportDeckCode([deck]);assert.equal(JSON.parse(code).schema,'castledecks-deck-presets-2');assert.doesNotMatch(code,/palette|gold|owned/);assert.deepEqual(parseDeckCode(code),[deck]);
});
test('legacy deck code and metadata explicitly migrate to Classic without granting it as a purchase',async()=>{
 const decks=parseDeckCode(await fixture('decks'));assert.ok(decks.every(deck=>deck.castle.id==='classic'));
 const manager=new CampaignProfiles({profiles:[owned()]});const raw=JSON.parse(await fixture('decks')).decks;
 const migrated=validateProfileDecks({schema:'castledecks-profile-decks-1',profiles:[raw],retired:[]},manager);assert.equal(migrated.schema,'castledecks-profile-decks-2');assert.deepEqual(migrated.profiles[0][0].castle,classic);
});
test('missing castle ownership blocks every part of a deck apply without changing keys',()=>{
 const p=profile(),deck=captureDeck(p,'Unowned');deck.castle=highwatch;deck.slots[1]=deck.slots[0];deck.slots[0]=null;const before=snapshot(p);const result=applyDeck(deck,p);assert.equal(result.ok,false);assert.deepEqual(result.missing,['highwatch']);assert.deepEqual(snapshot(p),before);
});
test('live paused castle change blocks full deck while same-castle edits retain old behavior',()=>{
 const p=owned(),deck=captureDeck(p,'Swap');deck.castle=highwatch;deck.slots[1]=deck.slots[0];deck.slots[0]=null;const before=snapshot(p);
 const blocked=applyDeck(deck,p,{started:true,paused:true});assert.equal(blocked.ok,false);assert.deepEqual(snapshot(p),before);
 deck.castle=classic;assert.equal(applyDeck(deck,p,{started:true,paused:true}).ok,true);assert.equal(p.skills[0].binding,1);assert.equal(p.castleId,'classic');
});
test('preparation deck apply uses live transaction and preserves all keys when only castle changes',()=>{
 const p=owned(),battle=new FirstBattle({profile:p,random:seededRandom(33)}),keep=battle.goodCastle,deck=captureDeck(p,'Highwatch');deck.castle=highwatch;const before=p.skills.map(s=>[s,s.binding,s.cooldown]);
 assert.equal(applyDeck(deck,p,{battle,started:false,prepareCastle:selection=>prepareCastleSelection(battle,selection,{started:false,profile:p})}).ok,true);
 assert.equal(battle.goodCastle,keep);assert.equal(keep.castleId,'highwatch');assert.equal(p.castleId,'highwatch');assert.equal(battle.hero.launchPosition.y,keep.y-250);assert.deepEqual(p.skills.map(s=>[s,s.binding,s.cooldown]),before);
});
test('failed preparation transaction is atomic across deck profile and keep',()=>{
 const p=owned(),battle=new FirstBattle({profile:p}),deck=captureDeck(p,'Bad context');deck.castle=highwatch;deck.slots[1]=deck.slots[0];deck.slots[0]=null;const before=snapshot(p),hp=battle.goodCastle.hp;
 assert.throws(()=>applyDeck(deck,p,{battle,prepareCastle:s=>prepareCastleSelection(battle,s,{started:true,profile:p})}));assert.deepEqual(snapshot(p),before);assert.equal(battle.goodCastle.hp,hp);assert.equal(battle.goodCastle.castleId,'classic');
});
test('settled selection edits the next castle but leaves the completed battle and report intact',()=>{
 const p=owned(),battle=new FirstBattle({profile:p}),deck=captureDeck(p,'Next');deck.castle=highwatch;battle.outcome='defeat';battle.summary={outcome:'defeat'};const keep=battle.goodCastle,hp=keep.hp;
 assert.equal(applyDeck(deck,p,{battle,started:true,summary:true}).ok,true);assert.equal(p.castleId,'highwatch');assert.equal(keep.castleId,'classic');assert.equal(keep.hp,hp);assert.equal(battle.summary.outcome,'defeat');
});
test('unknown and future castle deck records reject before library or profile mutation',()=>{
 const p=owned(),deck=captureDeck(p,'Safe'),manager=new CampaignProfiles({profiles:[p]}),book=createProfileDecks();book.set(p,[deck]);
 for(const castle of [{id:'future',level:1},{id:'classic',level:2},{id:'classic'},{id:'classic',level:1,owned:true}]){const bad={...deck,castle};assert.throws(()=>validateDeck(bad));assert.throws(()=>book.set(p,[bad]));assert.deepEqual(book.get(p),[deck]);}
 assert.equal(manager.active,p);
});
test('new checkpoints always use3 and preserve selected profile plus all saved castle decks',async()=>{
 const first=profile(),second=owned();second.equipCastle(highwatch);second.paletteId='indigo-brass';const manager=new CampaignProfiles({profiles:[first,second]});manager.select(1);const battle=new FirstBattle({profile:second}),book=createProfileDecks();book.set(second,[captureDeck(second,'High')]);
 const storage=new MemoryStorage(),store=createLocalCampaignStore({storage,locks:new TestLocks()}),payload=snapshotCampaign({profiles:manager,battle,deckPresets:book.snapshot(manager)});const result=await store.write(1,payload);assert.equal(result.ok,true);assert.equal(result.record.schema,'castledecks-local-checkpoint-3');assert.equal(result.record.manager.active.castleId,'highwatch');assert.equal(result.record.manager.active.paletteId,'indigo-brass');const restored=createProfileDecks();restored.restore(result.record.manager,result.record.payload.deckPresets);assert.deepEqual(restored.get(result.record.manager.active)[0].castle,highwatch);
 for(const schema of ['castledecks-local-checkpoint-1','castledecks-local-checkpoint-2'])assert.throws(()=>parseLocalCheckpoint(JSON.stringify({...createLocalCheckpointEnvelope(payload),schema})));
});
test('legacy checkpoint1 and checkpoint2 remain readable and become Classic',async()=>{
 const old=JSON.parse(await fixture('crownroad'));assert.equal(parseLocalCheckpoint(JSON.stringify(old)).manager.active.castleId,'classic');old.schema='castledecks-local-checkpoint-2';old.payload.deckPresets={schema:'castledecks-profile-decks-1',profiles:[JSON.parse(await fixture('decks')).decks],retired:[]};assert.equal(parseLocalCheckpoint(JSON.stringify(old)).manager.active.castleId,'classic');
});
test('frozen69 reader refuses v3 writes and deletion while preserving both banks byte-for-byte',async t=>{
 const directory=await mkdtemp(path.join(tmpdir(),'castledecks69-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const manifestBytes=await readFile(new URL('./fixtures/frozen69-codecs/SHA256.json',import.meta.url));assert.equal(createHash('sha256').update(manifestBytes).digest('hex'),'b04b69998ef38fe0acf1f8b9bfd7609535ff39ee4d2af118265558c6a6cd1cdb');const manifest=JSON.parse(manifestBytes);
 for(const [name,hash] of Object.entries(manifest)){const data=await readFile(new URL('./fixtures/frozen69-codecs/'+name,import.meta.url));assert.equal(createHash('sha256').update(data).digest('hex'),hash);await mkdir(path.dirname(path.join(directory,name)),{recursive:true});await writeFile(path.join(directory,name),data);}
 const frozen=await import(pathToFileURL(path.join(directory,'local-campaign-store.mjs')));
 const storage=new MemoryStorage(),locks=new TestLocks(),store=createLocalCampaignStore({storage,locks}),old=frozen.createLocalCampaignStore({storage,locks});storage.setItem(checkpointSlotKey(1,'a'),await fixture('crownroad'));
 const p=owned(),profiles=new CampaignProfiles({profiles:[p]}),battle=new FirstBattle({profile:p});const prior=store.read(1);assert.equal((await store.write(1,snapshotCampaign({profiles,battle}),{expected:prior.raw})).ok,true);
 assert.equal(old.read(1).status,'newer');
 const before=[...storage.data],read=old.read(1);assert.equal(read.status,'newer');assert.equal(read.latest,null);assert.equal((await old.write(1,JSON.parse(await fixture('crownroad')).payload,{expected:read.raw})).code,'newer-version');assert.equal((await old.remove(1,{expected:read.raw,confirmed:true})).code,'newer-version');assert.deepEqual([...storage.data],before);
});
test('new reader preserves unknown future envelopes and their castle IDs',async()=>{
 const storage=new MemoryStorage(),store=createLocalCampaignStore({storage,locks:new TestLocks()}),raw='{"schema":"castledecks-local-checkpoint-4","castle":"future"}';storage.setItem(checkpointSlotKey(1,'a'),raw);const p=profile(),profiles=new CampaignProfiles({profiles:[p]}),battle=new FirstBattle({profile:p});const before=[...storage.data];assert.equal(store.read(1).status,'newer');assert.equal((await store.write(1,snapshotCampaign({profiles,battle}))).code,'newer-version');assert.deepEqual([...storage.data],before);
});
test('old and new charter saves retain route seeds and exact owned castle selection',async()=>{
 const legacy=restoreExpeditions(await fixture('wayfarer'));assert.equal(legacy.active.castleId,'classic');const seed=legacy.activeRun.state.seed;legacy.active.gold=1500;legacy.active.purchaseCastle('highwatch');legacy.active.equipCastle(highwatch);legacy.active.paletteId='ivory-slate';const saved=legacy.exportBundle();assert.equal(JSON.parse(saved).schema,'castledecks-expeditions-2');const restored=restoreExpeditions(saved);assert.equal(restored.activeRun.state.seed,seed);assert.equal(restored.active.castleId,'highwatch');assert.equal(restored.active.paletteId,'ivory-slate');assert.equal(restored.active.gold,0);
 const misleading=JSON.parse(saved);misleading.schema='castledecks-expeditions-1';assert.throws(()=>restoreExpeditions(JSON.stringify(misleading)));
});
test('dormant real game codecs accept new local charter and deck documents and reject future content',()=>{
 const p=owned();p.equipCastle(highwatch);const profiles=new CampaignProfiles({profiles:[p]}),battle=new FirstBattle({profile:p}),charters=new ExpeditionProfiles({seedFactory:()=>123});const docs={crownroad:JSON.stringify(createLocalCheckpointEnvelope(snapshotCampaign({profiles,battle}))),wayfarer:charters.exportBundle(),decks:exportDeckCode([captureDeck(p,'Cloud')])};
 for(const [kind,text] of Object.entries(docs))assert.ok(codecs.validate(kind,text));assert.throws(()=>codecs.validate('decks',docs.decks.replace('highwatch','future')));
});
test('dormant bridge invalidates review after castle or appearance changes',()=>{
 const p=owned(),profiles=new CampaignProfiles({profiles:[p]}),battle=new FirstBattle({profile:p}),state={profiles,battle,started:false,destination:'campaign',loadGeneration:0,localReviewIntent:0,temporarySession:false};
 const bridge=createCloudGameBridge({getState:()=>state,captureDocument:()=>JSON.stringify(createLocalCheckpointEnvelope(snapshotCampaign({profiles,battle}),{writtenAt:1})),validateDocument:codecs.validate,reviewCrownroad:()=>({staged:true}),replaceWayfarer(){},reviewDecks:()=>({staged:true})});
 const first=bridge.capture('crownroad');p.castleId='highwatch';assert.equal(bridge.matches(first),false);const next=bridge.capture('crownroad');p.paletteId='ivory-slate';assert.equal(bridge.matches(next),false);
});
test('dormant transport refuses unknown castle document before PUT and preserves unresolved journal bytes',async()=>{
 const p=owned();p.equipCastle(highwatch);const valid=exportDeckCode([captureDeck(p,'Cloud')]),bad=valid.replace('highwatch','future');let calls=0;
 const client=createAccountClient({validateDocument:codecs.validate,fetch:async()=>{calls++;return new Response(JSON.stringify({id:'synthetic',csrfToken:'a'.repeat(43),expiresAt:1}),{headers:{'content-type':'application/json'}});}});await client.account();await assert.rejects(client.upload('decks',1,bad,0));assert.equal(calls,1);
 const storage=new MemoryStorage(),raw=JSON.stringify({schema:'castledecks-cloud-upload-1',accountID:'synthetic',kind:'decks',slot:1,expectedRevision:1,document:bad,createdAt:1});storage.setItem(UPLOAD_JOURNAL_KEY,raw);const journal=createUploadJournal({storage,validateDocument:codecs.validate});assert.equal(journal.read().blocked,true);assert.equal(storage.getItem(UPLOAD_JOURNAL_KEY),raw);assert.throws(()=>journal.save({schema:'castledecks-cloud-upload-1',accountID:'synthetic',kind:'decks',slot:1,expectedRevision:1,document:valid,createdAt:1}));assert.equal(storage.getItem(UPLOAD_JOURNAL_KEY),raw);
});

test('explicit missing/null new live profile fields cannot silently reset owned castles or heraldry',()=>{
 const p=owned();p.castleLevels=undefined;p.castleId=undefined;assert.throws(()=>serializeProfile(p));
 const q=profile();q.paletteId=null;assert.throws(()=>serializeProfile(q));q.paletteId=undefined;assert.throws(()=>serializeProfile(q));
});
test('all-empty modern deck still leaves30 empty ability keys and its explicit castle slot',()=>{
 const p=owned(),deck={name:'Castle only',slots:Array(30).fill(null),companion:null,castle:classic};
 const beforeGold=p.gold;assert.equal(applyDeck(deck,p).ok,true);assert.equal(p.skills[0].binding,-1);assert.equal(p.owned.has('arrow'),true);assert.equal(p.castleId,'classic');assert.equal(p.gold,beforeGold);
});

test('unknown catalog content inside current-number checkpoint preserves both banks and forbids write/delete',async()=>{
 for(const alter of [v=>v.castles.owned.push({id:'future',level:1}),v=>v.castles.owned[0].level=2,v=>v.appearance.palette='future']){
  const storage=new MemoryStorage(),store=createLocalCampaignStore({storage,locks:new TestLocks()}),p=owned(),profiles=new CampaignProfiles({profiles:[p]}),battle=new FirstBattle({profile:p});
  storage.setItem(checkpointSlotKey(1,'a'),await fixture('crownroad'));const payload=snapshotCampaign({profiles,battle}),envelope=createLocalCheckpointEnvelope(clone(payload)),bundle=JSON.parse(envelope.payload.bundle);alter(bundle.profiles[0].profile);envelope.payload.bundle=JSON.stringify(bundle);storage.setItem(checkpointSlotKey(1,'b'),JSON.stringify(envelope));
  const before=[...storage.data],read=store.read(1);assert.equal(read.status,'newer');assert.equal(read.latest,null);assert.equal((await store.write(1,payload,{expected:read.raw})).code,'newer-version');assert.equal((await store.remove(1,{expected:read.raw,confirmed:true})).code,'newer-version');assert.deepEqual([...storage.data],before);
 }
});

test('future nested codec versions inside current checkpoint preserve exact banks before recovery',async()=>{
 for(const target of ['profile','retired-profile','bundle','decks','single-profile']){
  const p=profile(),profiles=new CampaignProfiles({profiles:[p]}),battle=new FirstBattle({profile:p}),payload=snapshotCampaign({profiles,battle}),storage=new MemoryStorage(),store=createLocalCampaignStore({storage,locks:new TestLocks()});
  const first=createLocalCheckpointEnvelope(clone(payload)),second=createLocalCheckpointEnvelope(clone(payload),{revision:2});let bundle=JSON.parse(second.payload.bundle);
  if(target==='profile')bundle.profiles[0].profile.schema='bowmaster-reconstruction-4';
  if(target==='retired-profile'){bundle.retired=[clone(bundle.profiles[0])];bundle.retired[0].profile.schema='bowmaster-reconstruction-4';}
  if(target==='bundle')bundle.schema='bowmaster-reconstruction-profiles-3';
  if(target==='single-profile')bundle={...bundle.profiles[0].profile,schema:'bowmaster-reconstruction-4'};
  if(target==='decks')second.payload.deckPresets={schema:'castledecks-profile-decks-3',profiles:[[]],retired:[]};
  second.payload.bundle=JSON.stringify(bundle);storage.setItem(checkpointSlotKey(1,'a'),JSON.stringify(first));storage.setItem(checkpointSlotKey(1,'b'),JSON.stringify(second));
  const before=[...storage.data],read=store.read(1);assert.equal(read.status,'newer',target);assert.equal(read.latest,null);assert.equal((await store.write(1,payload,{expected:read.raw})).code,'newer-version');assert.equal((await store.remove(1,{expected:read.raw,confirmed:true})).code,'newer-version');assert.deepEqual([...storage.data],before);
 }
});

test('profile serialization rejects accessor-backed castle and palette fields without executing them',()=>{
 for(const field of ['paletteId','castleId','castleLevels']){
  const p=profile();let calls=0;Object.defineProperty(p,field,{enumerable:true,configurable:true,get(){calls++;p.gold=0;return field==='paletteId'?'azure':field==='castleId'?'classic':new Map([['classic',1]]);}});
  assert.throws(()=>serializeProfile(p));assert.equal(calls,0);assert.equal(p.gold,1500);
 }
});
test('castle collection rejects sparse arrays accessors and exotic objects before reading entries',()=>{
 const sparse=[classic];sparse.length=2;assert.throws(()=>validateCastleCollection({owned:sparse,selected:'classic'}));
 assert.throws(()=>validateCastleCollection(Object.assign(Object.create({inherited:true}),{owned:[classic],selected:'classic'})));
 let calls=0;const getter=[classic];Object.defineProperty(getter,0,{get(){calls++;return classic;}});assert.throws(()=>validateCastleCollection({owned:getter,selected:'classic'}));assert.equal(calls,0);
 const collection={selected:'classic'};Object.defineProperty(collection,'owned',{enumerable:true,get(){calls++;return [classic];}});assert.throws(()=>validateCastleCollection(collection));assert.equal(calls,0);
});
test('profile snapshot uses intrinsic Map entries rather than running a custom iterator',()=>{
 const p=profile();p.castleLevels[Symbol.iterator]=()=>{throw new Error('must not run');};assert.doesNotThrow(()=>serializeProfile(p));assert.equal(p.gold,1500);
});
