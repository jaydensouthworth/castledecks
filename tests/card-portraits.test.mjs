import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {CARD_PORTRAITS,CARD_PORTRAIT_BUDGET,cardPortrait,preferCardIcons,bindCardPortraits} from '../site/dist/card-portraits.mjs';
import {buildArmoryRecords} from '../site/dist/armory-catalog-data.mjs';
import {SKILLS} from '../site/dist/engine/progression.mjs';
import {COMPANIONS} from '../site/dist/engine/recruitment.mjs';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
const records=buildArmoryRecords(SKILLS,COMPANIONS,{}),environment={};

test('every real card has a unique atlas cell; no invented catalog card or rarity',()=>{
 assert.deepEqual(Object.keys(CARD_PORTRAITS).sort(),records.map(item=>item.id).sort());
 assert.equal(new Set(Object.values(CARD_PORTRAITS).map(art=>`${art.sheet}:${art.index}`)).size,26);
 assert.equal(CARD_PORTRAITS.gorath.sheet,'martial');assert.equal(CARD_PORTRAITS.healWave.sheet,'arcane');assert.equal(CARD_PORTRAITS.bombWave.sheet,'beasts');
 for(const art of Object.values(CARD_PORTRAITS)){assert.ok(art.x>=0&&art.y>=0&&art.x+art.w<1448&&art.y+art.h<1086);assert.ok(art.w>450&&art.h>330);assert.ok(!('rarity'in art));}
});
test('three shared atlases respect the declared encoded and decoded bounds',async()=>{
 const files=[...new Set(Object.values(CARD_PORTRAITS).map(art=>art.file))];assert.equal(files.length,3);let total=0;
 for(const file of files){const path=new URL('../site/dist/images/cards/'+file,import.meta.url),bytes=await readFile(path);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');total+=(await stat(path)).size;}
 assert.equal(total,CARD_PORTRAIT_BUDGET.encodedBytes);assert.ok(total<660000);assert.ok(CARD_PORTRAIT_BUDGET.decodedBytes<8*1024*1024);
});
test('known portraits have one lazy decorative image and preserved trusted fallback',()=>{
 for(const {id}of records){const html=cardPortrait(id,'<svg data-original="yes"></svg>',{environment});assert.equal((html.match(/<img /g)??[]).length,1);assert.match(html,/loading="lazy" decoding="async" fetchpriority="low"/);assert.match(html,/alt=""/);assert.match(html,/width="960" height="720"/);assert.match(html,/data-original="yes"/);assert.doesNotMatch(html,/onerror|onload|preload|base64|<canvas/);}
});
test('unknown ids and save-data/forced-color environments retain icons without a network source',()=>{
 for(const env of [{navigator:{connection:{saveData:true}}},{matchMedia:q=>({matches:q==='(prefers-reduced-data: reduce)'})},{matchMedia:q=>({matches:q==='(forced-colors: active)'})}]){assert.equal(preferCardIcons(env),true);const html=cardPortrait('fireArrow','<svg></svg>',{environment:env});assert.doesNotMatch(html,/<img|src=/);assert.match(html,/<svg>/);}
 for(const id of ['__proto__','constructor','toString','hasOwnProperty'])assert.doesNotMatch(cardPortrait(id,'<svg></svg>',{environment}),/<img|src=|NaN/);
 assert.equal(preferCardIcons({}),false);assert.doesNotMatch(cardPortrait('<img onerror="alert(1)">','<svg></svg>',{environment}),/<img|onerror|src=/);
});
test('load/error capture preserves fallback until load success and removes bindings at disposal',()=>{
 const handlers=new Map(),root={addEventListener:(type,fn,capture)=>{assert.equal(capture,true);handlers.set(type,fn);},removeEventListener:(type,fn,capture)=>{assert.equal(capture,true);assert.equal(handlers.get(type),fn);handlers.delete(type);}};
 const cleanup=bindCardPortraits(root);bindCardPortraits(root);assert.equal(handlers.size,2);
 const state={},frame={classList:{contains:name=>name==='card-portrait'},setAttribute:(key,value)=>state[key]=value},img={getAttribute:key=>key==='data-card-atlas'?'martial':null,parentElement:{parentElement:frame},naturalWidth:960};
 assert.equal(state['data-art-state'],undefined);handlers.get('load')({type:'load',target:img});assert.equal(state['data-art-state'],'ready');handlers.get('error')({type:'error',target:img});assert.equal(state['data-art-state'],'failed');img.naturalWidth=0;handlers.get('load')({type:'load',target:img});assert.equal(state['data-art-state'],'failed');cleanup();assert.equal(handlers.size,0);
});
test('catalog remains limited to 12 portraits and keeps actionable card labels/facts',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=test'});ui.click('introArmory');ui.click('shopCatalogTab');const grid=ui.get('shopGrid');assert.equal(grid.querySelectorAll('article').length,12);assert.equal(grid.querySelectorAll('img').length,12);assert.ok(ui.get('inspect-fireArrow'));assert.match(grid.textContent,/Reload/);assert.match(grid.textContent,/Delivery/);assert.match(grid.textContent,/gold/);ui.click('shopNext');assert.equal(grid.querySelectorAll('article').length,12);assert.equal(grid.querySelectorAll('img').length,12);ui.click('shopNext');assert.equal(grid.querySelectorAll('img').length,1);assert.match(grid.textContent,/Gorath/);
});
