import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {hallCampaignCatalog,campaignBrowserPage,HALL_BROWSER_PAGE_SIZE,hallStageStatus} from '../site/dist/hall-campaign-browser-model.mjs';
import {createHallCampaignBrowser} from '../site/dist/hall-campaign-browser.mjs';
import {serializeProfile,PlayerProfile} from '../site/dist/engine/progression.mjs';
import {ExpeditionRun} from '../site/dist/expedition-model.mjs';
import {EXPEDITION_FIELDS} from '../site/dist/expedition-data.mjs';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
import {MemoryStorage} from './helpers/local-storage.mjs';
const choose=(ui,id)=>ui.get('hubDestinations').querySelector(`[data-hub-destination="${id}"]`).click();
const open=(ui,id)=>{choose(ui,id);ui.click('start');if(ui.visible('switchSessionConfirm'))ui.click('confirmSessionSwitch');ui.frames();};
const attr=(ui,id,name)=>ui.get(id).getAttribute(name);
const fixture=({regions=4,fields=100}={})=>[{id:'campaign',name:'Synthetic test directory',groupLabel:'Regions',stageLabel:'Battle',description:'Synthetic test entries only',regions:Array.from({length:regions},(_,r)=>({id:`region-${r}`,name:`Test region ${r+1}`,art:'hearthwood',stages:Array.from({length:fields},(_,s)=>({id:`field-${r*fields+s+1}`,number:r*fields+s+1,name:`Synthetic field ${r*fields+s+1}`,regionId:`region-${r}`,regionName:`Test region ${r+1}`,state:'locked',objective:'Synthetic test only',advice:'Never registered in the game'}))}))}];

test('Hall starts on the real active banner with working deck, army, saves and explicit Start',async t=>{
 const ui=await loadGameUI(t),battle=ui.battle;
 assert.equal(attr(ui,'intro','data-hall-view'),'home');assert.equal(ui.visible('hallHome'),true);assert.equal(ui.visible('hallBrowse'),false);
 assert.match(ui.get('hallOrderRegion').textContent,/Hearthwood · Battle 1 of 30/);assert.equal(ui.get('hallOrderTitle').textContent,'First Light');
 assert.match(ui.get('hallDeckCount').textContent,/1\/30 equipped/);assert.match(ui.get('hallArmyStatus').textContent,/0 contracts/);
 ui.click('hallOpenSaves');assert.equal(ui.visible('savePanel'),true);ui.click('closeSave');assert.equal(ui.battle,battle);assert.equal(battle.tick,0);
 ui.click('hallArmyMuster');assert.equal(ui.visible('queuePanel'),true);ui.click('closeQueue');
 ui.get('intro').querySelector('[data-hall-open-loadout]').click();assert.equal(ui.visible('skillsPanel'),true);ui.click('closeSkills');
 assert.equal(battle.tick,0);ui.click('start');ui.frames(3);assert.ok(battle.tick>0);
});

test('Campaigns and Practice are separate views; browsing never replaces or starts the active company',async t=>{
 const ui=await loadGameUI(t),battle=ui.battle,before=serializeProfile(battle.profile);
 ui.click('hallCampaignsTab');assert.equal(ui.visible('hallHome'),false);assert.equal(ui.visible('hallCampaignDestinations'),true);assert.equal(ui.visible('hallPracticeDestinations'),false);
 choose(ui,'expedition');assert.equal(attr(ui,'intro','data-hall-view'),'campaigns');assert.equal(ui.battle,battle);assert.equal(serializeProfile(battle.profile),before);
 ui.click('hallPracticeTab');assert.equal(ui.visible('hallCampaignDestinations'),false);assert.equal(ui.visible('hallPracticeDestinations'),true);assert.equal(ui.visible('hallDestinationBrief'),false);
 choose(ui,'skirmish');assert.equal(ui.visible('hallDestinationBrief'),true);assert.equal(ui.visible('hallCampaignBrowser'),false);
 ui.get('intro').querySelector('.hall-orders-scroll').scrollTop=440;ui.click('hallHomeTab');assert.equal(ui.get('intro').querySelector('.hall-orders-scroll').scrollTop,0);assert.equal(attr(ui,'intro','data-hall-view'),'home');assert.equal(ui.get('hallSelectedName').textContent,'The Crownroad');assert.equal(ui.get('start').textContent,'Start battle 1');assert.equal(ui.battle,battle);assert.equal(battle.tick,0);
});

test('Live directory contains exactly Crownroad thirty fields and the authored four-leg charter, with no fabricated PvP or levels',()=>{
 const catalog=hallCampaignCatalog();assert.deepEqual(catalog.map(c=>c.id),['campaign','expedition']);
 assert.deepEqual(catalog[0].regions.map(r=>r.stages.length),[6,9,8,7]);assert.equal(catalog[0].regions.flatMap(r=>r.stages).length,30);
 assert.equal(catalog[1].regions.length,4);assert.deepEqual(catalog[1].regions.flatMap(r=>r.stages).map(s=>s.id),Object.keys(EXPEDITION_FIELDS));
 assert.equal(catalog[0].regions[0].stages[0].state,'unopened');assert.equal(catalog[1].regions[0].stages[0].state,'unopened');
});

test('Crownroad hierarchy inspects locked and earned fields through existing atlas guards',async t=>{
 const ui=await loadGameUI(t),battle=ui.battle;ui.click('hallCampaignsTab');
 ui.get('hallCampaignBrowser').querySelector('[data-hall-browser-region="cinderlands"]').click();
 assert.equal(ui.get('hallFieldName').textContent,'Ashfall');assert.equal(battle.profile.highestLevel,1);
 ui.get('hallCampaignBrowser').querySelector('[data-hall-stage="30"]').click();assert.equal(ui.get('hallFieldName').textContent,'The Ashen Throne');
 ui.click('hallInspectField');assert.equal(ui.visible('campaignPanel'),true);assert.equal(ui.get('atlasPrepare').disabled,true);assert.match(ui.get('atlasEncounterTitle').textContent,/The Ashen Throne/);
 assert.equal(battle.profile.highestLevel,1);assert.equal(battle.tick,0);
});

test('Search crosses region boundaries and preserves cursor focus; clearing restores the selected region',async t=>{
 const ui=await loadGameUI(t);ui.click('hallCampaignsTab');const before=serializeProfile(ui.battle.profile);
 let search=ui.get('hallStageSearch');search.value='ashen';search.oninput();assert.equal(ui.document.activeElement,ui.get('hallStageSearch'));assert.equal(ui.get('hallFieldName').textContent,'The Ashen Throne');assert.equal(ui.get('hallCampaignBrowser').querySelectorAll('[data-hall-stage]').length,1);
 search=ui.get('hallStageSearch');search.value='no such field';search.oninput();assert.equal(ui.get('hallCampaignBrowser').querySelectorAll('[data-hall-stage]').length,0);assert.match(ui.get('hallBrowserResults').textContent,/No fields/);assert.equal(ui.get('hallCampaignBrowser').querySelector('#hallInspectField'),null);
 ui.click('hallClearSearch');assert.equal(ui.get('hallStageSearch').value,'');assert.equal(ui.get('hallCampaignBrowser').querySelectorAll('[data-hall-stage]').length,6);assert.equal(serializeProfile(ui.battle.profile),before);
});

test('Known frontier opens on its actual page, including ninth field of a region; assisted progress stays identified',()=>{
 const profile=new PlayerProfile('Fixture');profile.highestLevel=15;profile.cheated=true;
 const catalog=hallCampaignCatalog({profile});assert.equal(catalog[0].assisted,true);assert.equal(catalog[0].regions[1].stages.at(-1).state,'frontier');
 assert.equal(hallStageStatus('cleared',true),'Reached · assisted');assert.equal(hallStageStatus('frontier',true),'Assisted frontier');
 const page=campaignBrowserPage(catalog,{regionId:'bannerfen',page:1});assert.equal(page.stages.length,1);assert.equal(page.stages[0].number,15);
});

test('Synthetic 400-field directory pages at most eight items, reaches every field, and supports direct search',()=>{
 const catalog=fixture(),seen=new Set();for(const region of catalog[0].regions){let page=0;for(;;){const result=campaignBrowserPage(catalog,{regionId:region.id,page});assert.equal(result.total,400);assert.ok(result.stages.length<=HALL_BROWSER_PAGE_SIZE);for(const stage of result.stages)seen.add(stage.id);if(++page===result.pageCount)break;}}
 assert.equal(seen.size,400);const search=campaignBrowserPage(catalog,{query:'Synthetic field 400'});assert.equal(search.matched,1);assert.equal(search.stages[0].id,'field-400');
 assert.equal(campaignBrowserPage(catalog,{page:999999,regionPage:999999}).page,12);assert.equal(campaignBrowserPage(catalog,{page:-20}).page,0);assert.equal(campaignBrowserPage([]),null);
});

test('Synthetic 400-field DOM is bounded; search, region pagination and stage selection do not dispatch game commands',async t=>{
 const ui=await loadGameUI(t),host=ui.document.createElement('div');ui.get('hallHome').appendChild(host);let inspected=0;
 const browser=createHallCampaignBrowser({host}),catalog=fixture({regions:20,fields:20});browser.sync({catalog,campaignId:'campaign',activeDestination:'training',activeLevel:1,onInspectCampaign:()=>inspected++});
 assert.equal(host.querySelectorAll('[data-hall-browser-region]').length,8);assert.equal(host.querySelectorAll('[data-hall-stage]').length,8);
 host.querySelector('[data-hall-region-page="1"]').click();host.querySelector('[data-hall-region-page="1"]').click();assert.equal(host.querySelectorAll('[data-hall-browser-region]').length,4);
 host.querySelector('[data-hall-browser-region="region-19"]').click();assert.match(host.querySelector('#hallFieldName').textContent,/381/);
 host.querySelector('#hallFieldsNext').click();host.querySelector('#hallFieldsNext').click();assert.equal(host.querySelectorAll('[data-hall-stage]').length,4);
 host.querySelector('[data-hall-stage="field-400"]').click();assert.equal(host.querySelector('#hallFieldName').textContent,'Synthetic field 400');assert.equal(host.querySelector('#hallInspectField').disabled,true);host.querySelector('#hallInspectField').click();assert.equal(inspected,0);
 const search=host.querySelector('#hallStageSearch');search.value='Synthetic field 1';search.oninput();assert.equal(host.querySelectorAll('[data-hall-stage]').length,8);assert.equal(ui.battle.tick,0);
});

test('Paused battle browser switching keeps explicit confirmation and returns to the identical ready home',async t=>{
 const ui=await loadGameUI(t);ui.click('start');ui.frames(5);ui.click('battlePause');ui.click('pauseLobby');const original=ui.battle,tick=original.tick;
 choose(ui,'expedition');ui.click('start');assert.equal(ui.visible('switchSessionConfirm'),true);ui.click('cancelSessionSwitch');assert.equal(ui.battle,original);assert.equal(original.tick,tick);
 ui.click('hallHomeTab');assert.match(ui.get('start').textContent,/Resume battle 1/);choose(ui,'expedition');ui.click('start');ui.click('confirmSessionSwitch');assert.equal(attr(ui,'intro','data-hall-view'),'home');assert.match(ui.get('hallOrderRegion').textContent,/Leg 1 of 4/);
 open(ui,'campaign');assert.equal(ui.battle,original);assert.equal(original.tick,tick);assert.equal(original.paused,true);assert.equal(attr(ui,'intro','data-hall-view'),'home');
});

test('Charter field browsing is read-only and route choices remain in the existing route workspace',async t=>{
 const ui=await loadGameUI(t);open(ui,'expedition');const battle=ui.battle,profile=serializeProfile(battle.profile);
 ui.click('hallCampaignsTab');ui.get('hallCampaignBrowser').querySelector('[data-hall-browser-region="leg-4"]').click();assert.equal(ui.get('hallFieldName').textContent,'Storm Crown');
 ui.click('hallInspectField');assert.equal(ui.visible('expeditionPanel'),true);assert.equal(ui.battle,battle);assert.equal(serializeProfile(battle.profile),profile);assert.equal(battle.tick,0);
 const run=new ExpeditionRun(),before=run.exportState();hallCampaignCatalog({run});assert.deepEqual(run.exportState(),before);
});

test('Read-only view switching and directory searches do not create local checkpoints or perform account requests',async t=>{
 const storage=new MemoryStorage();let calls=0;const ui=await loadGameUI(t,{storage,accounts:true,fetch:async()=>{calls++;throw new Error('Unexpected account request');}});
 const before=[...storage.data.entries()];ui.click('hallCampaignsTab');choose(ui,'expedition');ui.click('hallPracticeTab');choose(ui,'training');ui.click('hallHomeTab');await ui.settle();
 assert.deepEqual([...storage.data.entries()],before);assert.equal(calls,0);
});

test('Hall interior uses one flexible scroll owner, keeps readable text and never modifies the common frame',async()=>{
 const css=await readFile(new URL('../site/dist/hall-home.css',import.meta.url),'utf8');
 assert.match(css,/\.hall-orders-scroll\{flex:1;min-height:0;min-width:0;overflow:auto/);assert.match(css,/\.hall-launch\{display:grid/);assert.match(css,/\.hall-playing-card>span:not\(\.card-portrait\)\{font:14px/);assert.match(css,/\.local-hub-choices\{max-height:none;overflow:visible/);
 assert.doesNotMatch(css,/text-overflow:ellipsis|line-clamp|transform:scale|font-size:(?:[6-9]|10|11)px/);
 assert.doesNotMatch(css,/#managementFrame\s*\{|\.game-shell-nav|\.panel-head/);
 const html=await readFile(new URL('../site/dist/battle.html',import.meta.url),'utf8');assert.ok(html.indexOf('href="./hall-home.css"')>html.indexOf('href="./management-frame.css"'));assert.equal(html.split('id="start"').length-1,1);assert.equal(html.split('id="localHubStatus"').length-1,1);
});
