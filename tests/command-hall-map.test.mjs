import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CAMPAIGN_MAP_POINTS,campaignRoadPath,mapRegionScrollLeft} from '../site/dist/campaign-map-layout.mjs';
import {CAMPAIGN_REGIONS} from '../site/dist/campaign-atlas-model.mjs';
import {loadGameUI} from './helpers/game-ui-harness.mjs';

test('thirty fixed route points cover actual region boundaries with non-overlapping 48px targets',()=>{
 assert.equal(CAMPAIGN_MAP_POINTS.length,30);
 for(const [i,p] of CAMPAIGN_MAP_POINTS.entries()){assert.equal(CAMPAIGN_REGIONS[p.regionIndex],CAMPAIGN_REGIONS.find(r=>i+1>=r.first&&i+1<=r.last));assert.ok(p.x>=24&&p.x<=1176&&p.y>=24&&p.y<=336);}
 for(const height of [240,295,360,480])for(let i=0;i<30;i++)for(let j=i+1;j<30;j++){
  const a=CAMPAIGN_MAP_POINTS[i],b=CAMPAIGN_MAP_POINTS[j];assert.ok(Math.abs(a.x-b.x)>=48||Math.abs((a.y-b.y)*height/360)>=48,`Hit targets ${i+1}/${j+1} overlap at map height ${height}`);
 }
 assert.equal(campaignRoadPath().match(/[ML]/g).length,30);assert.equal(mapRegionScrollLeft(0,300),0);assert.equal(mapRegionScrollLeft(3,300),900);
});
test('command hall preserves real room actions and explicit launch without starting from a station',async t=>{
 const ui=await loadGameUI(t),battle=ui.battle;assert.match(ui.get('introTitle').textContent,/command hall/);assert.equal(ui.get('hallSelectedName').textContent,'The Crownroad');
 for(const [open,close] of [['introArmy','closeQueue'],['introLoadout','closeSkills'],['introArmory','closeShop'],['introSettings','closeSettings']]){ui.click(open);assert.equal(battle.tick,0);ui.click(close);assert.equal(ui.visible('intro'),true);assert.equal(ui.battle,battle);}
 assert.equal(battle.tick,0);ui.click('start');ui.frames(3);assert.ok(battle.tick>0);
});
test('destination drawer closes after selection and keeps current campaign until explicit Open',async t=>{
 const ui=await loadGameUI(t),battle=ui.battle;ui.get('hallDestinationDrawer').open=true;ui.get('hubDestinations').querySelector('[data-hub-destination="expedition"]').click();assert.equal(ui.get('hallDestinationDrawer').open,false);assert.equal(ui.get('hallSelectedName').textContent,'Wayfarer Charter');assert.equal(ui.battle,battle);assert.equal(battle.tick,0);ui.click('start');assert.equal(ui.get('intro').getAttribute('data-active-destination'),'expedition');assert.equal(ui.visible('introRoute'),true);assert.equal(ui.visible('introAtlas'),false);
});
test('full map frontier jump preserves source progress and locked inspection remains read-only',async t=>{
 const ui=await loadGameUI(t),battle=ui.battle;ui.click('introAtlas');const host=ui.get('campaignAtlasHost');assert.equal(host.querySelectorAll('[data-atlas-level]').length,30);assert.equal(host.querySelector('.atlas-intelligence').getAttribute('open'),null);host.querySelector('[data-atlas-level="30"]').click();assert.equal(ui.get('atlasPrepare').disabled,true);host.querySelector('[data-atlas-frontier]').click();assert.equal(ui.document.activeElement.getAttribute('data-atlas-level'),'1');assert.equal(ui.get('atlasPrepare').disabled,false);assert.equal(battle.tick,0);assert.equal(battle.profile.highestLevel,1);
});
test('map scrolling and mouse drag use bounded handlers and preserve selection scroll offsets',async t=>{
 const ui=await loadGameUI(t);ui.click('introAtlas');let host=ui.get('campaignAtlasHost'),map=host.querySelector('.atlas-map-window');map.scrollLeft=170;map.scrollTop=25;host.querySelector('[data-atlas-level="3"]').click();map=host.querySelector('.atlas-map-window');assert.equal(map.scrollLeft,170);assert.equal(map.scrollTop,25);map.onpointerdown({pointerType:'mouse',button:0,pointerId:3,clientX:100,clientY:100,target:{closest:()=>null}});map.onpointermove({pointerId:3,clientX:40,clientY:80});assert.equal(map.scrollLeft,230);assert.equal(map.scrollTop,45);map.onpointercancel();map.onpointermove({pointerId:3,clientX:0,clientY:0});assert.equal(map.scrollLeft,230);
});
test('local checkpoint controls and save label spans remain present exactly once',async()=>{
 const html=await readFile(new URL('../site/dist/battle.html',import.meta.url),'utf8');for(const id of ['localHubStatus','localHubChoices','localContinue','localNew','localSessionOnly','localManage','introSaveLabel','introLoadLabel','hubExpeditionProgress','introRoute'])assert.equal(html.split(`id="${id}"`).length-1,1,id);
 const css=await readFile(new URL('../site/dist/command-hall.css',import.meta.url),'utf8');assert.match(css,/command-hall\.webp/);assert.match(css,/regal-great-hall\.png/);assert.match(css,/prefers-reduced-motion/);
});

test('region focus puts every standard inside its own 48px-safe camera at phone and wider sizes',()=>{
 for(const width of [292,300,360,500,720])for(let index=0;index<4;index++){
  const left=mapRegionScrollLeft(index,width);assert.ok(left>=0&&left<=1200-width);
  for(const point of CAMPAIGN_MAP_POINTS.filter(p=>p.regionIndex===index)){assert.ok(point.x-24>=left,`Region ${index}, width ${width}, left edge`);assert.ok(point.x+24<=left+width,`Region ${index}, width ${width}, right edge`);}
 }
});
test('region controls reveal all four real regions and frontier control returns to the earned start',async t=>{
 const ui=await loadGameUI(t);ui.click('introAtlas');for(const [index,region] of CAMPAIGN_REGIONS.entries()){
  ui.get('campaignAtlasHost').querySelector(`[data-atlas-region="${region.id}"]`).click();assert.equal(ui.get('campaignAtlasHost').querySelector('.atlas-map-window').scrollLeft,index*300);assert.match(ui.get('atlasEncounterTitle').textContent,new RegExp(region.first===1?'First Light':region.first===7?'Lowland Crossing':region.first===16?'Pinewatch Dawn':'Ashfall'));assert.equal(ui.document.activeElement.getAttribute('data-atlas-region'),region.id);
 }ui.get('campaignAtlasHost').querySelector('[data-atlas-frontier]').click();assert.equal(ui.get('campaignAtlasHost').querySelector('.atlas-map-window').scrollLeft,0);assert.equal(ui.document.activeElement.getAttribute('data-atlas-level'),'1');
});

test('new disclosures participate in the existing modal focus trap and destination selection focuses launch',async t=>{
 const ui=await loadGameUI(t);for(const summary of ui.get('intro').querySelectorAll('summary'))assert.equal(summary.getAttribute('tabindex'),'0');ui.get('hubDestinations').querySelector('[data-hub-destination="midgame"]').click();assert.equal(ui.document.activeElement,ui.get('start'));ui.get('hubDestinations').querySelector('[data-hub-destination="campaign"]').click();ui.click('introAtlas');for(const summary of ui.get('campaignAtlasHost').querySelectorAll('summary'))assert.equal(summary.getAttribute('tabindex'),'0');
});

test('Escape dismisses only the destination drawer without changing the preserved session',async t=>{
 const ui=await loadGameUI(t),battle=ui.battle,drawer=ui.get('hallDestinationDrawer');let stopped=false,prevented=false;drawer.open=true;drawer.onkeydown({key:'Escape',stopPropagation:()=>stopped=true,preventDefault:()=>prevented=true});assert.equal(drawer.open,false);assert.equal(stopped,true);assert.equal(prevented,true);assert.equal(ui.document.activeElement,drawer.querySelector('summary'));assert.equal(ui.battle,battle);assert.equal(battle.tick,0);
});
