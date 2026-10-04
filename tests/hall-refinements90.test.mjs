import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
import {MemoryStorage,TestLocks} from './helpers/local-storage.mjs';
import {CampaignProfiles} from '../site/dist/engine/profile-manager.mjs';
import {PlayerProfile,serializeProfile} from '../site/dist/engine/progression.mjs';
import {CampaignBattle} from '../site/dist/engine/first-battle.mjs';
import {createLocalCampaignStore,snapshotCampaign} from '../site/dist/local-campaign-store.mjs';
const scroll=ui=>ui.get('intro').querySelector('.hall-orders-scroll');
const view=ui=>ui.get('intro').getAttribute('data-hall-view');
const browse=(ui,{level=12,offset=340}={})=>{
 ui.click('hallCampaignsTab');const input=ui.get('hallStageSearch');input.value='Battle';input.oninput();
 ui.click('hallFieldsNext');ui.get('hallCampaignBrowser').querySelector(`[data-hall-stage="${level}"]`).click();scroll(ui).scrollTop=offset;ui.click('hallInspectField');
};
const assertDirectory=(ui,{offset=340,level=12}={})=>{
 assert.equal(view(ui),'campaigns');assert.equal(ui.visible('hallBrowse'),true);assert.equal(ui.visible('hallHome'),false);
 assert.equal(ui.get('hallStageSearch').value,'Battle');assert.deepEqual(ui.get('hallCampaignBrowser').querySelectorAll('[data-hall-stage]').map(b=>b.getAttribute('data-hall-stage')),['9','10','11','12','13','14','15','16']);
 assert.equal(ui.get('hallCampaignBrowser').querySelector(`[data-hall-stage="${level}"]`).getAttribute('aria-pressed'),'true');assert.equal(scroll(ui).scrollTop,offset);assert.equal(ui.document.activeElement,ui.get('hallInspectField'));
};
async function seed(storage,{name='Saved banner',slot=1}={}){
 const profile=new PlayerProfile(name),profiles=new CampaignProfiles({profiles:[profile]}),battle=new CampaignBattle({profile,level:1}),store=createLocalCampaignStore({storage,locks:new TestLocks()});
 await store.write(slot,snapshotCampaign({profiles,battle}));return store;
}

test('directory inspection returns query, page, selected stage, scroll and real focus through every Back route',async t=>{
 const ui=await loadGameUI(t),battle=ui.battle,code=serializeProfile(battle.profile);
 for(const [index,close] of ['atlasReturn','closeAtlas','Escape'].entries()){
  browse(ui,{offset:340+index});assert.equal(ui.visible('campaignPanel'),true);assert.equal(view(ui),'campaigns');assert.match(ui.get('atlasEncounterTitle').textContent,/King/);
  if(close==='Escape')ui.key('keydown','Escape');else ui.click(close);
  assertDirectory(ui,{offset:340+index});assert.equal(ui.battle,battle);assert.equal(battle.tick,0);assert.equal(serializeProfile(battle.profile),code);
 }
});

test('paused directory inspection and repeated Back retain the exact paused battlefield',async t=>{
 const ui=await loadGameUI(t);ui.click('start');ui.frames(8);ui.click('battlePause');ui.click('pauseLobby');const battle=ui.battle,tick=battle.tick;
 browse(ui);assert.equal(ui.get('atlasPrepare').disabled,true);ui.click('atlasReturn');assertDirectory(ui);
 assert.equal(ui.battle,battle);assert.equal(battle.tick,tick);assert.equal(battle.paused,true);
 ui.click('hallHomeTab');ui.click('start');ui.frames(2);assert.ok(battle.tick>tick);
});

test('explicit global Hall navigation discards the directory return marker and resets Home, scroll and focus',async t=>{
 const ui=await loadGameUI(t);browse(ui);ui.click('shell-campaignPanel-hall');
 assert.equal(view(ui),'home');assert.equal(scroll(ui).scrollTop,0);assert.equal(ui.document.activeElement,ui.get('start'));assert.equal(ui.visible('campaignPanel'),false);
 ui.click('shell-intro-map');ui.click('atlasReturn');assert.equal(view(ui),'home');assert.equal(ui.document.activeElement,ui.get('start'));
});

test('a real preparation replaces inspection return with the newly prepared Home without advancing the frontier',async t=>{
 const ui=await loadGameUI(t),before=ui.battle;before.profile.highestLevel=15;
 ui.get('hubDestinations').querySelector('[data-hub-destination="campaign"]').click();browse(ui,{level:12});assert.equal(ui.get('atlasPrepare').disabled,false);
 ui.click('atlasPrepare');ui.frames();assert.notEqual(ui.battle,before);assert.equal(ui.battle.level,12);assert.equal(ui.battle.profile.highestLevel,15);assert.equal(ui.battle.tick,0);
 assert.equal(view(ui),'home');assert.equal(scroll(ui).scrollTop,0);assert.equal(ui.document.activeElement,ui.get('start'));assert.match(ui.get('hallOrderTitle').textContent,/King/);
 ui.click('introAtlas');ui.click('atlasReturn');assert.equal(view(ui),'home');
});

test('unrelated workspace navigation clears inspection focus ownership rather than resurrecting it on later map closure',async t=>{
 const ui=await loadGameUI(t);browse(ui);ui.click('shell-campaignPanel-deck');assert.equal(ui.visible('shopPanel'),true);ui.click('closeShop');
 assert.equal(ui.document.activeElement,ui.get('start'));ui.click('shell-intro-map');ui.click('atlasReturn');assert.equal(view(ui),'home');assert.equal(ui.document.activeElement,ui.get('start'));
});

test('profile replacement and destination round trips cannot restore an old company directory marker',async t=>{
 const ui=await loadGameUI(t);browse(ui);const original=ui.battle;ui.click('shell-campaignPanel-profiles');ui.get('newProfileName').value='Another banner';ui.click('createProfile');ui.frames();
 assert.notEqual(ui.battle,original);assert.notEqual(ui.battle.profile,original.profile);assert.equal(view(ui),'home');assert.equal(scroll(ui).scrollTop,0);
 ui.click('closeProfiles');ui.click('introAtlas');ui.click('closeAtlas');assert.equal(view(ui),'home');assert.equal(ui.document.activeElement,ui.get('start'));
 const current=ui.battle;ui.get('hubDestinations').querySelector('[data-hub-destination="expedition"]').click();ui.click('start');ui.frames();ui.get('hubDestinations').querySelector('[data-hub-destination="campaign"]').click();ui.click('start');ui.frames();
 assert.equal(ui.battle,current);assert.equal(view(ui),'home');assert.equal(ui.document.activeElement,ui.get('start'));
});

test('an empty required chooser focuses and reveals enabled New campaign after blocked Start, with no save mutation',async t=>{
 const storage=new MemoryStorage(),ui=await loadGameUI(t,{storage,search:'?open=local-saves'});assert.equal(ui.document.activeElement,ui.get('localNewVault'));ui.click('closeSave');const battle=ui.battle,before=[...storage.data];let revealed=0;ui.get('localNewVault').scrollIntoView=options=>{assert.equal(options.block,'nearest');revealed++;};
 for(let attempt=0;attempt<2;attempt++){
  ui.click('start');await ui.settle();assert.equal(ui.visible('savePanel'),true);assert.equal(ui.document.activeElement,ui.get('localNewVault'));assert.equal(ui.document.activeElement.disabled,false);assert.equal(ui.battle,battle);assert.equal(battle.tick,0);assert.deepEqual([...storage.data],before);
  ui.click('closeSave');
 }
 assert.equal(revealed,2);ui.click('localSessionOnly');ui.click('start');ui.frames(2);assert.ok(battle.tick>0);assert.deepEqual([...storage.data],before);
});

test('an existing saved campaign stays untouched until explicit Continue confirmation and blocked Start focuses its enabled control',async t=>{
 const storage=new MemoryStorage();await seed(storage);const before=[...storage.data],ui=await loadGameUI(t,{storage}),battle=ui.battle;
 assert.equal(ui.visible('localHubChoices'),true);ui.click('start');await ui.settle();const target=ui.document.activeElement;assert.equal(target.getAttribute('data-local-continue'),'1');assert.equal(target.disabled,false);assert.equal(ui.visible('localConfirm'),false);assert.equal(ui.battle,battle);assert.deepEqual([...storage.data],before);
 target.click();await ui.settle();assert.equal(ui.visible('localConfirm'),true);assert.equal(ui.battle,battle);ui.click('localConfirmCancel');await ui.settle();assert.deepEqual([...storage.data],before);assert.equal(ui.battle,battle);
});

test('read-only local slots without safe autosave retain a usable Session only choice and perform no writes',async t=>{
 const storage=new MemoryStorage();await seed(storage);const before=[...storage.data],ui=await loadGameUI(t,{storage,locks:null});
 ui.click('start');await ui.settle();assert.equal(ui.document.activeElement.disabled,false);assert.equal(ui.document.activeElement.getAttribute('data-local-continue'),'1');assert.equal(ui.get('localNewVault').disabled,true);ui.click('localSessionOnlyVault');ui.click('closeSave');ui.click('start');ui.frames(2);assert.ok(ui.battle.tick>0);assert.deepEqual([...storage.data],before);
});

test('compact mission title precedes metadata and the full objective remains in the reading section; pending choices lead Home',async()=>{
 const html=await readFile(new URL('../site/dist/battle.html',import.meta.url),'utf8'),css=await readFile(new URL('../site/dist/hall-home.css',import.meta.url),'utf8');
 assert.match(html,/<div id="hallFieldPainting"[^>]*><h3 id="hallOrderTitle"><\/h3><p class="eyebrow" id="hallOrderRegion"><\/p><p class="hall-current-banner" id="hallCurrentBanner"><\/p><\/div><div class="hall-mission-details"><p id="hallOrderObjective"><\/p>/);
 assert.match(css,/\.hall-field-painting\{min-height:0;padding:12px;justify-content:flex-start\}/);assert.match(css,/#hallCurrentBanner\{margin:4px 0 0\}/);assert.match(css,/\.hall-save-state:has\(#localHubChoices:not\(\.hidden\)\)\{order:-1/);assert.match(css,/#start\{min-height:48px/);
 assert.doesNotMatch(css,/text-overflow:ellipsis|line-clamp|transform:scale|font-size:(?:[6-9]|10|11)px/);
});

test('integrated player-home title band overrides the legacy shelf at full reading size without styling portrait art',async()=>{
 const css=await readFile(new URL('../site/dist/hall-home.css',import.meta.url),'utf8');
 assert.match(css,/\.hall-playing-card>span:not\(\.card-portrait\)\{font:14px\/1\.25 Georgia;[^}]*max-height:none;overflow:visible/);
});
