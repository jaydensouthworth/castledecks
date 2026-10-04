import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
import {MemoryStorage,TestLocks,settle} from './helpers/local-storage.mjs';
import {captureDeck,exportDeckCode,parseDeckCode,previewDeck} from '../site/dist/deck-presets-model.mjs';
import {createLocalCampaignStore} from '../site/dist/local-campaign-store.mjs';
const empty=(name='Reserve all')=>({name,slots:Array(30).fill(null),companion:null,castle:{id:'classic',level:1}});
const prepare=(ui,deck)=>{ui.get('deckImportCode').value=exportDeckCode([deck]);ui.click('deckImportPrepare');ui.click('deckConfirmAccept');};
async function editor(t,options={}){const ui=await loadGameUI(t,options);ui.click('introLoadout');ui.click('openDeckPresets');return ui;}
function shots(b){const arrow=b.profile.skills.find(s=>s.id==='arrow');b.queuePlayerShot({canFire:true,vx:6,vy:-3},arrow);b.queuedAim={canFire:true,vx:8,vy:-4};b.queuedSelection=0;b.shooter.intentSkill=arrow;b.input.mouseDown=true;}
function assertBowless(ui){const b=ui.battle;assert.equal(b.activeSkill,null);assert.equal(b.hotbar.active,null);assert.equal(b.playerShots.length,0);assert.equal(b.queuedAim,null);assert.equal(b.shooter.intentSkill,undefined);assert.match(ui.get('combatSkillName').textContent,/No bow equipped/);assert.equal(ui.get('battleFire').disabled,true);}

test('empty deck is permitted, explains bowless state and clears active and pending shot intents',async t=>{
 const ui=await editor(t),b=ui.battle,p=b.profile,arrow=p.skills[0];prepare(ui,empty());assert.match(ui.get('deckBowWarning').textContent,/no bow.*will not fire.*Squad keys.*Basic Arrow/);assert.equal(ui.get('deckApply').disabled,false);shots(b);ui.click('deckApply');assertBowless(ui);assert.equal(b.queuedSelection,null);assert.equal(b.input.mouseDown,false);assert.equal(arrow.binding,-1);assert.equal(p.owned.has('arrow'),true);assert.equal(p.gold,0);assert.equal(ui.visible('deckBowRecovery'),true);assert.equal(ui.visible('loadoutBowRecovery'),true);ui.click('closeDeckPresets');ui.click('loadoutContinue');ui.frames(3);assertBowless(ui);assert.equal(b.projectiles.length,0);assert.equal(b.stats.shotsFired,0);
});

test('zero-gold Basic Arrow recovery in saved decks is explicit, free and never edits saved arrangement',async t=>{
 const ui=await editor(t),b=ui.battle,p=b.profile,arrow=p.skills[0];prepare(ui,empty());ui.click('deckApply');ui.click('deckShowExport');const code=ui.get('deckExportCode').value;arrow.cooldown=42;ui.click('deckRecoverArrow');assert.equal(p.gold,0);assert.equal(p.skills[0],arrow);assert.equal(arrow.cooldown,42);assert.equal(arrow.binding,0);assert.equal(b.activeSkill,arrow);assert.equal(ui.visible('deckBowRecovery'),false);assert.match(ui.get('deckStatus').textContent,/equipped for free.*Bar 1, key 1.*saved decks are unchanged/);assert.equal(ui.get('deckExportCode').value,code);assert.equal(parseDeckCode(code)[0].slots.every(id=>id===null),true);assert.equal(ui.document.activeElement,ui.get('closeDeckPresets'));
});

test('squad-only preset keeps contracts in place and zero-gold recovery survives collection filters',async t=>{
 const ui=await loadGameUI(t),p=ui.battle.profile;p.addSkill('grunt');p.gold=0;ui.click('introLoadout');ui.click('openDeckPresets');const deck=empty('Squads only');deck.slots[0]='grunt';prepare(ui,deck);assert.equal(previewDeck(deck,p).canApply,true);shots(ui.battle);ui.click('deckApply');assertBowless(ui);assert.equal(p.skills.find(s=>s.id==='grunt').binding,0);ui.click('closeDeckPresets');ui.get('loadoutSearch').value='no matching card';ui.dispatch(ui.get('loadoutSearch'),'input');assert.equal(ui.get('ownedSkillList').querySelectorAll('article').length,0);ui.click('loadoutRecoverArrow');assert.equal(p.skills.find(s=>s.id==='arrow').binding,1);assert.equal(p.skills.find(s=>s.id==='grunt').binding,0);assert.equal(p.gold,0);assert.equal(ui.battle.activeSkill.id,'arrow');assert.equal(ui.visible('loadoutBowRecovery'),false);
});

test('squad-only battle can summon through a key while pointer aiming cannot spend gold or fire',async t=>{
 const ui=await loadGameUI(t),p=ui.battle.profile;const grunt=p.addSkill('grunt');grunt.cooldown=0;grunt.autocast=false;p.gold=40;ui.click('introLoadout');ui.click('openDeckPresets');const d=empty('Squads only');d.slots[0]='grunt';prepare(ui,d);ui.click('deckApply');ui.click('closeDeckPresets');ui.click('loadoutContinue');const b=ui.battle;ui.frames();assertBowless(ui);const before=p.gold;ui.pointer('pointerdown',71,{x:900,y:600});ui.pointer('pointerup',71,{x:1100,y:500});ui.frames(2);assert.equal(p.gold,before);assert.equal(b.stats.shotsFired,0);assert.equal(b.playerShots.length,0);ui.click('quick-grunt');ui.frames();assert.equal(p.gold,before-20);assert.equal(b.friendlyQueue.queue.length,4);assertBowless(ui);ui.click('battlePause');ui.click('pauseSkills');const queued=[...b.friendlyQueue.queue],tick=b.tick;ui.click('loadoutRecoverArrow');assert.equal(p.gold,before-20);assert.deepEqual(b.friendlyQueue.queue,queued);assert.equal(b.tick,tick);assert.equal(b.activeSkill.id,'arrow');
});

test('bowless recovery is gated during active combat even through stale handlers',async t=>{
 const ui=await editor(t);prepare(ui,empty());ui.click('deckApply');const recovery=ui.get('loadoutRecoverArrow').onclick;ui.click('closeDeckPresets');ui.click('loadoutContinue');const p=ui.battle.profile,before=p.skills.map(s=>s.binding);recovery();assert.deepEqual(p.skills.map(s=>s.binding),before);assertBowless(ui);
});

test('v3 checkpoint restores deliberately empty deck and keeps free recovery at zero gold',async t=>{
 const storage=new MemoryStorage(),ui=await editor(t,{storage});prepare(ui,empty());ui.click('deckApply');await settle();const store=createLocalCampaignStore({storage,locks:new TestLocks()});assert.equal(store.read(1).latest.schema,'castledecks-local-checkpoint-3');ui.click('closeDeckPresets');ui.click('closeSkills');ui.click('introSave');ui.get('localSlots').querySelector('[data-local-continue="1"]').click();await settle();ui.click('localConfirmAccept');await settle();assertBowless(ui);assert.equal(ui.battle.profile.gold,0);ui.click('introLoadout');assert.equal(ui.visible('loadoutBowRecovery'),true);ui.click('loadoutRecoverArrow');assert.equal(ui.battle.activeSkill.id,'arrow');assert.equal(ui.battle.profile.gold,0);
});

test('Wayfarer deck metadata stays session-only and never changes campaign checkpoint banks',async t=>{
 const storage=new MemoryStorage(),ui=await editor(t,{storage});ui.get('deckNewName').value='Crownroad';ui.dispatch(ui.get('deckSaveForm'),'submit');await settle();ui.click('closeDeckPresets');ui.click('closeSkills');const bytes=[...storage.data];ui.get('hubDestinations').querySelector('[data-hub-destination="expedition"]').click();ui.click('start');ui.click('introLoadout');ui.click('openDeckPresets');assert.match(ui.get('deckCount').textContent,/0 \/ 12/);ui.get('deckNewName').value='Wayfarer';ui.dispatch(ui.get('deckSaveForm'),'submit');assert.match(ui.get('deckStorageNote').textContent,/stay in this session/);await settle();assert.deepEqual([...storage.data],bytes);ui.click('closeDeckPresets');ui.click('closeSkills');ui.get('hubDestinations').querySelector('[data-hub-destination="campaign"]').click();ui.click('start');ui.click('introLoadout');ui.click('openDeckPresets');ui.click('deckShowExport');assert.deepEqual(parseDeckCode(ui.get('deckExportCode').value).map(d=>d.name),['Crownroad']);
});

test('bowless deck keeps an active matching companion, recovery timer and already-launched objects',async t=>{
 const ui=await editor(t,{search:'?mode=demo&showcase=companions'}),b=ui.battle,p=b.profile,d=empty('Companion only');d.companion=p.companionId;const unit={id:'same-companion'};b.companions.unit=unit;b.companions.recoveryTicks=111;b.companions.recoveryReason='recalled';const projectile={id:'existing-flight'};b.projectiles.push(projectile);prepare(ui,d);shots(b);const owned=[...p.owned],gold=p.gold;ui.click('deckApply');assertBowless(ui);assert.equal(b.companions.unit,unit);assert.equal(b.companions.recoveryTicks,111);assert.equal(b.companions.recoveryReason,'recalled');assert.equal(p.companionId,d.companion);assert.ok(b.projectiles.includes(projectile));assert.deepEqual([...p.owned],owned);assert.equal(p.gold,gold);
});

test('presets preserve precise-shot cooldown gate after repeated loadout redraws',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=test'});ui.click('start');ui.battle.activeSkill.cooldown=80;ui.frames();assert.equal(ui.get('battleFire').disabled,true);ui.click('battlePause');ui.click('pauseSkills');ui.click('openDeckPresets');ui.get('deckNewName').value='Current';ui.dispatch(ui.get('deckSaveForm'),'submit');ui.click('closeDeckPresets');ui.click('closeSkills');ui.click('resumeGame');ui.frames();assert.equal(ui.get('battleFire').disabled,true);
});
