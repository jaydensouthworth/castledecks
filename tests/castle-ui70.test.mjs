import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
import {MemoryStorage,TestLocks,settle} from './helpers/local-storage.mjs';
import {createLocalCampaignStore} from '../site/dist/local-campaign-store.mjs';
import {captureDeck,exportDeckCode,parseDeckCode} from '../site/dist/deck-presets-model.mjs';
import {serializeProfile} from '../site/dist/engine/progression.mjs';
import {drawFortification} from '../site/dist/fortress-art.mjs';
import {drawCombatTroop} from '../site/dist/combat-poses.mjs';
import {resolvePlayerPalette} from '../site/dist/player-palette.mjs';
const change=(ui,id,value)=>{ui.get(id).value=value;ui.dispatch(ui.get(id),'change');};
const funded=async(t,options={})=>{const ui=await loadGameUI(t,options);ui.battle.profile.gold=1500;return ui;};
function inspectCastle(ui){ui.click('introArmory');ui.click('shopCatalogTab');ui.get('shopSearch').value='Highwatch';ui.dispatch(ui.get('shopSearch'),'input');ui.dispatch(ui.get('shopSearchForm'),'submit');ui.click('inspect-highwatch');}
function buyAndBuild(ui){inspectCastle(ui);ui.click('shopDetailAction');ui.click('shopOpenCastleBuild');}
const loadoutSnapshot=p=>p.skills.map(s=>[s,s.id,s.binding,s.cooldown,s.xp,s.rank]);
const fieldSnapshot=b=>JSON.stringify({tick:b.tick,terrain:b.terrain.samples,roster:b.enemies.roster,flags:[b.ownFlag.x,b.ownFlag.y,b.enemyFlag.x,b.enemyFlag.y],gold:b.profile.gold,stats:b.stats,queue:b.friendlyQueue.queue,population:b.friendlyQueue.population});

test('real Armory buy uses exact in-game price once, keeps Classic equipped, then Build changes same prepared keep',async t=>{
 const ui=await funded(t),b=ui.battle,p=b.profile,castle=b.goodCastle,before=loadoutSnapshot(p);inspectCastle(ui);assert.match(ui.get('shopDetails').textContent,/Higher firing station/);const buy=ui.get('shopDetailAction');buy.click();buy.onclick();assert.equal(p.gold,0);assert.equal(p.castleLevels.get('highwatch'),1);assert.equal(p.castleId,'classic');assert.equal(b.goodCastle.castleId,'classic');assert.deepEqual(loadoutSnapshot(p),before);
 ui.click('shopOpenCastleBuild');assert.equal(ui.visible('skillsPanel'),true);assert.equal(ui.get('loadoutCompanionSection').open,true);const field=fieldSnapshot(b);ui.click('castleEquip-highwatch');assert.equal(ui.battle,b);assert.equal(b.goodCastle,castle);assert.equal(p.castleId,'highwatch');assert.equal(castle.maxHp,6720);assert.equal(b.hero.launchPosition.y,castle.y-250);assert.equal(fieldSnapshot(b),field);assert.deepEqual(loadoutSnapshot(p),before);assert.match(ui.get('loadoutCompanionSummary').textContent,/Highwatch/);
 ui.click('castleEquip-classic');assert.equal(castle.maxHp,8400);assert.equal(castle.castleId,'classic');assert.equal(fieldSnapshot(b),field);
});
test('dedicated castle slot is inside existing disclosure and compact70 cards retain their grid allocation',async()=>{
 const html=await readFile(new URL('../site/dist/battle.html',import.meta.url),'utf8'),css=await readFile(new URL('../site/dist/castle-loadout.css',import.meta.url),'utf8'),shell=await readFile(new URL('../site/dist/game-shell.css',import.meta.url),'utf8');
 assert.match(html,/<details id="loadoutCompanionSection"[^>]*>[\s\S]*?<section id="castleLoadout"[\s\S]*?<section id="companionLoadout"/);assert.doesNotMatch(css,/loadout-workspace\s*\{|grid-template-rows|height:\s*61px/);assert.match(css,/min-height:44px/);assert.match(shell,/loadout-unit-deployment/);
});
test('only-castle deck preview enables apply and retains all30 ability slots, timers and live identities',async t=>{
 const ui=await funded(t);buyAndBuild(ui);const p=ui.battle.profile,deck=captureDeck(p,'High gallery');deck.castle={id:'highwatch',level:1};const before=loadoutSnapshot(p);ui.click('openDeckPresets');ui.get('deckImportCode').value=exportDeckCode([deck]);ui.click('deckImportPrepare');ui.click('deckConfirmAccept');assert.equal(ui.get('deckApply').disabled,false);assert.match(ui.get('deckChanges').textContent,/Classic Keep.*Highwatch Keep/);ui.click('deckApply');assert.equal(p.castleId,'highwatch');assert.equal(ui.battle.goodCastle.castleId,'highwatch');assert.deepEqual(loadoutSnapshot(p),before);ui.click('deckShowExport');assert.deepEqual(parseDeckCode(ui.get('deckExportCode').value)[0].castle,{id:'highwatch',level:1});
});
test('live paused castle change blocks whole deck and stale direct castle handler, but keys remain editable',async t=>{
 const ui=await funded(t);buyAndBuild(ui);const stale=ui.get('castleEquip-highwatch').onclick;ui.click('closeSkills');ui.click('closeShop');ui.click('start');ui.frames(2);ui.click('battlePause');ui.click('pauseSkills');const b=ui.battle,p=b.profile,before=fieldSnapshot(b),keys=loadoutSnapshot(p);assert.equal(ui.get('castleEquip-highwatch').disabled,true);stale();assert.equal(p.castleId,'classic');assert.equal(fieldSnapshot(b),before);
 ui.click('openDeckPresets');const d=captureDeck(p,'Live blocked');d.castle={id:'highwatch',level:1};d.slots[1]=d.slots[0];d.slots[0]=null;ui.get('deckImportCode').value=exportDeckCode([d]);ui.click('deckImportPrepare');ui.click('deckConfirmAccept');assert.equal(ui.get('deckApply').disabled,true);ui.get('deckApply').onclick();assert.deepEqual(loadoutSnapshot(p),keys);assert.equal(b.goodCastle.castleId,'classic');assert.match(ui.get('deckBlockers').textContent,/before starting or after/);
});
test('heraldry preview and Cancel are pure; Apply changes only profile palette and actual ally rendering tokens',async t=>{
 const ui=await loadGameUI(t);ui.click('introLoadout');const b=ui.battle,p=b.profile,before=serializeProfile(p),field=fieldSnapshot(b);change(ui,'playerPalette','indigo-brass');assert.equal(p.paletteId,'azure');assert.equal(serializeProfile(p),before);assert.match(ui.get('playerPalettePreview').getAttribute('aria-label'),/Indigo/);ui.click('cancelPlayerPalette');assert.equal(ui.get('playerPalette').value,'azure');assert.equal(p.paletteId,'azure');change(ui,'playerPalette','ivory-slate');ui.click('applyPlayerPalette');assert.equal(p.paletteId,'ivory-slate');assert.equal(fieldSnapshot(b),field);const after=JSON.parse(serializeProfile(p)),prior=JSON.parse(before);after.appearance=prior.appearance;assert.deepEqual(after,prior);
 change(ui,'playerPalette','indigo-brass');ui.click('closeSkills');ui.click('introLoadout');assert.equal(ui.get('playerPalette').value,'ivory-slate');assert.equal(p.paletteId,'ivory-slate');
});
test('local checkpoint restores castle selection and colors before setup; unknown deck grants nothing',async t=>{
 const storage=new MemoryStorage(),ui=await funded(t,{storage});buyAndBuild(ui);ui.click('castleEquip-highwatch');change(ui,'playerPalette','ivory-slate');ui.click('applyPlayerPalette');await settle();const store=createLocalCampaignStore({storage,locks:new TestLocks()});assert.equal(store.read(1).latest.manager.active.castleId,'highwatch');assert.equal(store.read(1).latest.manager.active.paletteId,'ivory-slate');ui.click('closeSkills');ui.click('closeShop');ui.click('introSave');ui.get('localSlots').querySelector('[data-local-continue="1"]').click();await settle();ui.click('localConfirmAccept');assert.equal(ui.battle.profile.castleId,'highwatch');assert.equal(ui.battle.goodCastle.castleId,'highwatch');assert.equal(ui.battle.profile.paletteId,'ivory-slate');
});
test('temporary contract trial returns exact Highwatch/heraldry profile and prepared keep identity',async t=>{
 const ui=await funded(t,{search:'?mode=test'});buyAndBuild(ui);ui.click('castleEquip-highwatch');change(ui,'playerPalette','indigo-brass');ui.click('applyPlayerPalette');ui.click('closeSkills');const source=ui.battle,p=source.profile,castle=source.goodCastle,save=serializeProfile(p);ui.click('shopCatalogTab');ui.get('shopSearch').value='Grunt';ui.dispatch(ui.get('shopSearch'),'input');ui.dispatch(ui.get('shopSearchForm'),'submit');ui.click('inspect-grunt');ui.click('shopTryCard');ui.frames(2);assert.notEqual(ui.battle,source);ui.click('unitTrialReturn');ui.frames();assert.equal(ui.battle,source);assert.equal(ui.battle.goodCastle,castle);assert.equal(ui.battle.profile,p);assert.equal(serializeProfile(p),save);
});
function ctxRecorder(){const fills=[],strokes=[];const data={};return {fills,strokes,ctx:new Proxy(data,{get:(target,key)=>target[key]??(()=>{}),set:(target,key,value)=>{target[key]=value;if(key==='fillStyle')fills.push(value);if(key==='strokeStyle')strokes.push(value);return true;}})};}
test('palette renderer mount changes only allied cloth; health, enemy and elemental contracts remain separate',async t=>{
 const ui=await loadGameUI(t),b=ui.battle;
 for(const id of ['azure','indigo-brass','ivory-slate']){const good=ctxRecorder(),bad=ctxRecorder();drawFortification(good.ctx,b.goodCastle,{paletteId:id});drawFortification(bad.ctx,b.badCastle,{paletteId:id});assert.ok(good.fills.includes(resolvePlayerPalette(id).tokens.fortress.cloth));assert.ok(bad.fills.includes('#914654'));assert.ok(good.strokes.includes('#f4ecd5'));const hero=ctxRecorder();drawCombatTroop(hero.ctx,{...b.hero,visible:true},{dead:false,alpha:1,walk:{moving:false},down:0,crouch:0,lean:0,windup:0,strike:0,bowDraw:0,bowRelease:0,casting:0,castBurst:0},{paletteId:id});assert.ok(hero.fills.includes(resolvePlayerPalette(id).tokens.troopPose.cloth));}
});

test('SK2 Highwatch Hall Pause result and trial-return labels retain the actual keep/cleanup objective',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=skirmish&sk=SK2:1KNH:oaks:standard:highwatch'});ui.click('closeWorkshop');ui.frames();assert.match(ui.get('hallOrderObjective').textContent,/Break their keep.*clear.*recover/);assert.doesNotMatch(ui.get('hallOrderObjective').textContent,/or bring the enemy flag/);assert.match(ui.get('hubLaunchNote').textContent,/Highwatch comparison/);assert.match(ui.get('castlePracticeBrief').textContent,/Enemy flag capture alone cannot win/);
 const source=ui.battle,brief=ui.get('castlePracticeBrief').textContent;ui.click('introArmory');ui.click('shopCatalogTab');ui.get('shopSearch').value='Grunt';ui.dispatch(ui.get('shopSearch'),'input');ui.dispatch(ui.get('shopSearchForm'),'submit');ui.click('inspect-grunt');ui.click('shopTryCard');ui.frames(2);assert.equal(ui.get('castlePracticeBrief').classList.contains('hidden'),true);ui.click('unitTrialReturn');assert.equal(ui.get('castlePracticeBrief').textContent,brief);ui.frames();assert.equal(ui.battle,source);ui.click('closeShop');ui.click('start');ui.battle.goodCastle.takeDamage(ui.battle.goodCastle.hp);ui.frames(105);assert.match(ui.get('endingTitle').textContent,/Highwatch attempt lost/);assert.match(ui.get('endingText').textContent,/home keep fell/);assert.doesNotMatch(ui.get('endingText').textContent,/enemy captured your flag/i);
});
