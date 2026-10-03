import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGameUI} from '../tests/helpers/game-ui-harness.mjs';
import {MemoryStorage,TestLocks,settle} from '../tests/helpers/local-storage.mjs';
import {PlayerProfile} from '../site/dist/engine/progression.mjs';
import {CampaignProfiles} from '../site/dist/engine/profile-manager.mjs';
import {CampaignBattle} from '../site/dist/engine/first-battle.mjs';
import {createProfileDecks,captureDeck,applyDeck,parseDeckCode,exportDeckCode,mergeDeckLibraries} from '../site/dist/deck-presets-model.mjs';
import {createLocalCampaignStore,snapshotCampaign,checkpointSlotKey} from '../site/dist/local-campaign-store.mjs';
const submit=(ui,id)=>ui.dispatch(ui.get(id),'submit');
async function editor(t,options={}){const ui=await loadGameUI(t,options);ui.click('introLoadout');ui.click('openDeckPresets');return ui;}
function save(ui,name){ui.get('deckNewName').value=name;submit(ui,'deckSaveForm');}
function prepare(ui,decks){ui.get('deckImportCode').value=exportDeckCode(decks);ui.click('deckImportPrepare');}
function deck(name='One'){return captureDeck(new PlayerProfile(),name);}
function exported(ui){ui.click('deckShowExport');return parseDeckCode(ui.get('deckExportCode').value);}

test('profile and retired snapshots remain identity-aligned after sorting and deletion',()=>{
 const first=new PlayerProfile('same'),second=new PlayerProfile('same'),retiredA=new PlayerProfile('Retired A'),retiredB=new PlayerProfile('Retired B');
 retiredA.gold=3;retiredB.gold=8;
 const manager=new CampaignProfiles({profiles:[first,second],retired:[retiredA,retiredB]}),presets=createProfileDecks();
 [first,second,retiredA,retiredB].forEach((p,i)=>presets.set(p,[deck('Set '+i)]));manager.getSortedRetiredProfiles();manager.select(1);manager.deleteCurrent();
 const metadata=presets.snapshot(manager),restored=CampaignProfiles.fromBundle(manager.exportBundle()),loaded=createProfileDecks();loaded.restore(restored,metadata);
 assert.equal(loaded.get(restored.active)[0].name,'Set 0');assert.equal(loaded.get(restored.retired[0])[0].name,'Set 3');assert.equal(loaded.get(restored.retired[1])[0].name,'Set 2');assert.equal(presets.get(second)[0].name,'Set 1');
});

test('library get and snapshots are defensive copies of every slots array',()=>{
 const p=new PlayerProfile(),manager=new CampaignProfiles({profiles:[p]}),library=createProfileDecks(),original=deck();library.set(p,[original]);original.slots.fill(null);
 const got=library.get(p);got[0].slots.fill(null);got[0].name='Mutation';const snapshot=library.snapshot(manager);snapshot.profiles[0][0].slots.fill(null);snapshot.profiles[0][0].name='Mutation';
 assert.equal(library.get(p)[0].name,'One');assert.equal(library.get(p)[0].slots[0],'arrow');
});

test('failed metadata restore commits no partial profile libraries',()=>{
 const p=new PlayerProfile(),q=new PlayerProfile(),manager=new CampaignProfiles({profiles:[p,q]}),library=createProfileDecks();library.set(p,[deck('Kept P')]);library.set(q,[deck('Kept Q')]);
 const incoming=library.snapshot(manager);incoming.profiles[0][0].name='Changed';incoming.profiles[1][0].slots[0]='unknown';assert.throws(()=>library.restore(manager,incoming));
 assert.equal(library.get(p)[0].name,'Kept P');assert.equal(library.get(q)[0].name,'Kept Q');
});

test('non-ASCII byte limit and known IDs reject malformed or grant-bearing imports',()=>{
 const base=JSON.parse(exportDeckCode([deck()]));
 for(const mutate of [v=>v.decks[0].slots[1]='arrow',v=>v.decks[0].slots[1]='__proto__',v=>v.decks[0].companion='arrow',v=>v.decks[0].gold=999,v=>v.decks[0].slots[1]=0,v=>v.decks[0].name='bad\nname',v=>v.decks[0].slots.pop()]){const value=structuredClone(base);mutate(value);assert.throws(()=>parseDeckCode(JSON.stringify(value)));}
 assert.throws(()=>parseDeckCode('é'.repeat(17000)),/32 KiB/);
});

test('max-capacity import fails atomically and deeply preserves inputs',()=>{
 const current=Array.from({length:12},(_,i)=>deck('Deck '+i)),incoming=[deck('Deck 0')],before=JSON.stringify({current,incoming});assert.throws(()=>mergeDeckLibraries(current,incoming),/No decks were added/);assert.equal(JSON.stringify({current,incoming}),before);
});

test('owned set without matching live skill cannot apply even one valid replacement',()=>{
 const p=new PlayerProfile();p.owned.add('fireArrow');const d=deck();d.slots[0]='fireArrow';d.slots[29]='arrow';const original=JSON.stringify(p);const result=applyDeck(d,p,{paused:true});assert.equal(result.ok,false);assert.deepEqual(result.missing,['fireArrow']);assert.equal(JSON.stringify(p),original);
});

test('corrupted deck metadata falls back to previous v1 bank without changing either',async()=>{
 const p=new PlayerProfile(),profiles=new CampaignProfiles({profiles:[p]}),battle=new CampaignBattle({profile:p}),storage=new MemoryStorage(),store=createLocalCampaignStore({storage,locks:new TestLocks()}),library=createProfileDecks();
 await store.write(1,snapshotCampaign({profiles,battle}));library.set(p,[deck()]);let prior=store.read(1);await store.write(1,snapshotCampaign({profiles,battle,deckPresets:library.snapshot(profiles)}),{expected:prior.raw});
 const raw=JSON.parse(storage.getItem(checkpointSlotKey(1,'b')));raw.payload.deckPresets.profiles[0][0].slots[1]='arrow';storage.setItem(checkpointSlotKey(1,'b'),JSON.stringify(raw));const before=[...storage.data];const read=store.read(1);
 assert.equal(read.status,'recovered');assert.equal(read.latest.schema,'castledecks-local-checkpoint-1');assert.deepEqual([...storage.data],before);
});

test('locked pending snapshot does not adopt later deck name or slot edits',async()=>{
 const p=new PlayerProfile(),profiles=new CampaignProfiles({profiles:[p]}),battle=new CampaignBattle({profile:p}),storage=new MemoryStorage(),locks=new TestLocks(),store=createLocalCampaignStore({storage,locks}),library=createProfileDecks();library.set(p,[deck()]);
 const payload=snapshotCampaign({profiles,battle,deckPresets:library.snapshot(profiles)});locks.pauseNext=true;const pending=store.write(1,payload);await settle();payload.deckPresets.profiles[0][0].name='Later';payload.deckPresets.profiles[0][0].slots.fill(null);library.set(p,[deck('Latest')]);locks.release();await pending;
 assert.equal(store.read(1).latest.payload.deckPresets.profiles[0][0].name,'One');assert.equal(store.read(1).latest.payload.deckPresets.profiles[0][0].slots[0],'arrow');
});

test('apply integration retains actual queued shot content and companion recovery',async t=>{
 const ui=await editor(t),b=ui.battle,p=b.profile,d=deck('Last key');d.slots[0]=null;d.slots[29]='arrow';prepare(ui,[d]);ui.click('deckConfirmAccept');
 const skill=p.skills[0];const queuedAim={canFire:true,vx:4,vy:-3};b.queuePlayerShot(queuedAim,skill);b.queuedAim=queuedAim;b.queuedSelection=9;b.shooter.intentSkill=skill;b.companions.recoveryTicks=111;b.companions.recoveryReason='recalled';
 const beforeShots=[...b.playerShots],beforeSkill={...skill};ui.click('deckApply');assert.deepEqual(b.playerShots,beforeShots);assert.equal(b.queuedAim,queuedAim);assert.equal(b.queuedSelection,9);assert.equal(b.shooter.intentSkill,skill);assert.equal(b.companions.recoveryTicks,111);assert.equal(b.companions.recoveryReason,'recalled');assert.equal(skill.binding,29);for(const key of Object.keys(beforeSkill).filter(k=>k!=='binding'))assert.deepEqual(skill[key],beforeSkill[key]);
});

test('saving while checkpoint locked then navigating/profile switch preserves original deck ownership',async t=>{
 const storage=new MemoryStorage(),locks=new TestLocks(),ui=await editor(t,{storage,locks});locks.pauseNext=true;save(ui,'First only');await settle();assert.ok(locks.release);ui.click('closeDeckPresets');ui.click('closeSkills');ui.click('introProfiles');ui.get('newProfileName').value='Second';ui.click('createProfile');locks.release();await settle();ui.click('closeProfiles');ui.click('introLoadout');ui.click('openDeckPresets');assert.match(ui.get('deckCount').textContent,/0 \/ 12/);
 const store=createLocalCampaignStore({storage,locks}),saved=store.read(1).latest;assert.equal(saved.payload.deckPresets.profiles[0][0].name,'First only');assert.equal(saved.payload.deckPresets.profiles[1].length,0);
});

test('navigation away cancels pending deck import before another profile is active',async t=>{
 const ui=await editor(t);prepare(ui,[deck()]);ui.click('closeDeckPresets');ui.click('closeSkills');ui.click('introProfiles');ui.get('newProfileName').value='Second';ui.click('createProfile');ui.click('closeProfiles');ui.click('introLoadout');ui.click('openDeckPresets');ui.get('deckConfirmAccept').onclick();assert.match(ui.get('deckCount').textContent,/0 \/ 12/);assert.equal(ui.visible('deckConfirm'),false);
});

test('deck selection moves focus to its inspector heading',async t=>{
 const ui=await editor(t);save(ui,'One');await settle();const row=ui.get('deckList').querySelector('[data-deck-index="0"]');row.focus();row.click();const replacement=ui.get('deckList').querySelector('[data-deck-index="0"]');assert.notEqual(replacement,row);assert.equal(ui.document.activeElement,ui.get('deckTitle'));assert.equal(ui.get('deckTitle').tagName,'H3');
});

test('late checkpoint refresh retains a focused deck row',async t=>{
 const storage=new MemoryStorage(),locks=new TestLocks(),ui=await editor(t,{storage,locks});locks.pauseNext=true;save(ui,'One');await settle();const row=ui.get('deckList').querySelector('[data-deck-index="0"]');row.focus();locks.release();await settle();assert.equal(ui.document.activeElement,ui.get('deckList').querySelector('[data-deck-index="0"]'));
});

test('closed transfer disclosure is reachable after the last ordinary focus target',async t=>{
 const ui=await editor(t),details=ui.get('deckPresets').querySelector('details'),summary=details.querySelector('summary');
 // The bounded harness does not implement native closed-details layout, so
 // supply only its rect visibility contract; no browser claim is made here.
 for(const node of details.querySelectorAll('button,input,textarea,select'))node.getClientRects=()=>[];
 const last=ui.get('deckSaveCurrent');last.focus();const forward=ui.dispatch(last,'keydown',{key:'Tab'});assert.equal(forward.event.defaultPrevented,false,'Tab can proceed to summary instead of wrapping');
 summary.focus();const wrap=ui.dispatch(summary,'keydown',{key:'Tab'});assert.equal(wrap.event.defaultPrevented,true);assert.equal(ui.document.activeElement,ui.get('closeDeckPresets'));
});

test('cancel restores focus and edited/invalid import review cannot commit the old source',async t=>{
 const ui=await editor(t);save(ui,'Kept');ui.click('deckDelete');ui.click('deckConfirmCancel');assert.equal(ui.document.activeElement,ui.get('deckDelete'));
 prepare(ui,[deck('Incoming')]);ui.get('deckImportCode').value='{bad';ui.click('deckImportPrepare');assert.equal(ui.visible('deckConfirm'),false);ui.get('deckConfirmAccept').onclick();assert.deepEqual(exported(ui).map(d=>d.name),['Kept']);
 prepare(ui,[deck('Incoming')]);ui.get('deckImportCode').value=exportDeckCode([deck('Changed')]);ui.get('deckConfirmAccept').onclick();assert.equal(ui.visible('deckConfirm'),false);assert.deepEqual(exported(ui).map(d=>d.name),['Kept']);
});
