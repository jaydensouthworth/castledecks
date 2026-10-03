import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CAMPAIGN_MAP_POINTS,mapSelectionScrollLeft} from '../site/dist/campaign-map-layout.mjs';
import {loadGameUI} from './helpers/game-ui-harness.mjs';

test('selected standards keep their full 48px targets inside narrow and wide region cameras',()=>{
 for(const width of [120,220,250,280,292,320,500,720])for(const [i,p] of CAMPAIGN_MAP_POINTS.entries()){
  const left=mapSelectionScrollLeft(p.regionIndex,width,i+1);assert.ok(left>=0&&left<=1200-width);assert.ok(p.x-24>=left,`${i+1} left at ${width}`);assert.ok(p.x+24<=left+width,`${i+1} right at ${width}`);
 }
});
test('post-show recenter is called after campaign panel activation, without a timer',async()=>{
 const source=await readFile(new URL('../site/dist/battle.mjs',import.meta.url),'utf8');assert.match(source,/campaignAtlas\.open\([^\n]+panel\('#campaignPanel',true\);campaignAtlas\.recenter\(\)/);
 const atlas=await readFile(new URL('../site/dist/campaign-atlas.mjs',import.meta.url),'utf8');assert.doesNotMatch(atlas,/requestAnimationFrame|setTimeout|setInterval/);assert.match(atlas,/width<=0\|\|height<=0/);
});
test('one bounded observer recenters on rotation, ignores zero geometry and leaves ordinary panning alone',async t=>{
 const old=globalThis.ResizeObserver;let callback=null,count=0,disconnects=0;
 globalThis.ResizeObserver=class {constructor(cb){this.cb=cb;count++;}observe(host){if(host.id==='campaignAtlasHost')callback=this.cb;}disconnect(){disconnects++;}};
 t.after(()=>{if(old===undefined)delete globalThis.ResizeObserver;else globalThis.ResizeObserver=old;});
 const ui=await loadGameUI(t);ui.click('introAtlas');assert.equal(count,1);assert.equal(typeof callback,'function');
 let host=ui.get('campaignAtlasHost'),map=host.querySelector('.atlas-map-window'),world=host.querySelector('.atlas-map-world');map.clientWidth=280;map.clientHeight=160;world.clientHeight=240;map.scrollLeft=70;map.scrollTop=0;
 callback([{contentRect:{width:310,height:290}}]);assert.equal(map.scrollLeft,10);assert.equal(map.scrollTop,104);
 map.scrollLeft=55;callback([{contentRect:{width:310,height:290}}]);assert.equal(map.scrollLeft,55);
 callback([{contentRect:{width:0,height:0}}]);assert.equal(map.scrollLeft,55);
 host.querySelector('[data-atlas-region="cinderlands"]').click();host.querySelector('[data-atlas-level="30"]').click();assert.equal(count,1);
 map=host.querySelector('.atlas-map-window');world=host.querySelector('.atlas-map-world');map.clientWidth=500;map.clientHeight=200;world.clientHeight=240;callback([{contentRect:{width:880,height:280}}]);assert.equal(map.scrollLeft,700);assert.ok(map.scrollTop>80);
 map.clientWidth=280;map.clientHeight=285;world.clientHeight=295;callback([{contentRect:{width:310,height:540}}]);assert.equal(map.scrollLeft,910);assert.ok(map.scrollTop>=0);assert.equal(disconnects,0);
});
test('compact map owns remaining height while region controls and dossier stay bounded',async()=>{
 const css=await readFile(new URL('../site/dist/campaign-atlas.css',import.meta.url),'utf8');const repair=css.slice(css.indexOf('/* Short landscape is a map workspace'));
 assert.match(repair,/atlas-overview\{position:absolute/);assert.match(repair,/atlas-regions\{position:absolute/);assert.match(repair,/grid-template-rows:minmax\(0,1fr\)/);assert.match(repair,/atlas-map-window\{flex:1 1 0;min-height:0/);assert.match(repair,/repeat\(4,minmax\(44px,1fr\)\)/);assert.doesNotMatch(repair,/atlas-node-number|atlas-nodes button/);
});


test('four full-size region targets fit the 740x320 plus 24px bottom-inset panel',async()=>{
 const css=await readFile(new URL('../site/dist/campaign-atlas.css',import.meta.url),'utf8');const repair=css.slice(css.indexOf('/* Short landscape is a map workspace'));
 assert.match(repair,/atlas-regions\{position:absolute;top:53px;bottom:55px/);assert.match(repair,/border:0;border-inline:1px/);assert.match(repair,/overflow-y:auto;overscroll-behavior:contain/);
 for(const [height,label] of [[340,'915x360'],[300,'740x320'],[286,'740x320 with 24px bottom inset']]){const innerHeight=height-2;const railHeight=innerHeight-53-55;assert.ok(railHeight>=4*44,`${label}: ${railHeight}px rail`);assert.ok(53+railHeight<=innerHeight-55);}
});
