import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {ArmoryCatalog,armoryCardState,createArmorySnapshot,ARMORY_PAGE_SIZE} from '../site/dist/armory-catalog-model.mjs';
import {buildArmoryRecords} from '../site/dist/armory-catalog-data.mjs';
import {createArmoryCatalogUI} from '../site/dist/armory-catalog.mjs';
import {SKILLS,PlayerProfile} from '../site/dist/engine/progression.mjs';
import {COMPANIONS} from '../site/dist/engine/recruitment.mjs';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
const records=buildArmoryRecords(SKILLS,COMPANIONS,{});
const state=()=>createArmorySnapshot(new PlayerProfile());
const synthetic=count=>Array.from({length:count},(_,i)=>({id:`fixture-${i}`,name:`Fixture ${String(i).padStart(5,'0')}`,description:`Private scale-test fixture ${i}`,kind:'skill',department:i%2?'army':'bow',role:i%2?'frontline':'bow',category:i%2?'army':'arrows',price:i*10,reloadSeconds:i%80,traits:i%3?['ground']:['fire']}));
const change=(ui,id,value)=>{const el=ui.get(id);el.value=value;el.focus();ui.dispatch(el,'change');};
const search=(ui,value)=>{const el=ui.get('shopSearch');el.value=value;el.focus();ui.dispatch(el,'input');ui.dispatch(ui.get('shopSearchForm'),'submit');};
async function armory(t,gold=10000){const ui=await loadGameUI(t,{search:'?mode=test'});ui.click('introTesting');ui.click('testVictory');ui.frames(105);ui.battle.profile.gold=gold;ui.click('endingShop');ui.click('shopCatalogTab');return ui;}

test('shipping records have exactly the real purchase inventory, explicit kinds and grounded facts',()=>{
 assert.equal(records.length,Object.keys(SKILLS).length+Object.keys(COMPANIONS).length);
 assert.equal(records.find(item=>item.id==='arrow').storefront,false);assert.ok(!records.some(item=>item.id.startsWith('fixture-')));
 assert.equal(records.find(item=>item.id==='gorath').kind,'companion');
 assert.deepEqual(records.filter(item=>item.alliedProtection).map(item=>item.id),['air','poisonDragon','fireDragon','iceDragon']);
 assert.ok(!records.some(item=>'rarity'in item||'pack'in item));
});
test('eligibility matches separate skill and companion boundaries and never scans owned skills per card',()=>{
 const p=new PlayerProfile();p.gold=1000;let snapshot=createArmorySnapshot(p);
 assert.equal(armoryCardState(records.find(item=>item.id==='fireArrow'),snapshot).eligible,false);
 p.gold=1001;snapshot=createArmorySnapshot(p);assert.equal(armoryCardState(records.find(item=>item.id==='fireArrow'),snapshot).eligible,true);
 p.gold=7500;snapshot=createArmorySnapshot(p);assert.equal(armoryCardState(records.find(item=>item.id==='gorath'),snapshot).eligible,true);
 assert.ok(snapshot.skills instanceof Map);
});
test('query/filter/sort/page preserve selected stable ID, clamp pages and can reveal hidden selection',()=>{
 const catalog=new ArmoryCatalog(records),snapshot=state();catalog.select('iceDragon');
 catalog.setView({category:'arrows',query:'fire'});let result=catalog.query(snapshot);assert.equal(catalog.selectedId,'iceDragon');assert.equal(result.selectedIndex,-1);assert.deepEqual(result.items.map(x=>x.id),['fireArrow','meteorArrow']);
 catalog.setView({query:'',category:'all',sort:'price-desc',page:999});result=catalog.query(snapshot);assert.equal(catalog.selectedId,'iceDragon');assert.equal(result.page,0);
 catalog.setView({page:999});result=catalog.query(snapshot);assert.equal(result.page,result.pageCount-1);
 catalog.setView({query:'nothing_matches'});assert.equal(catalog.query(snapshot).total,0);assert.equal(catalog.selectedId,'iceDragon');
 result=catalog.revealSelected(snapshot);assert.equal(result.selectedOnPage,true);assert.equal(catalog.selectedId,'iceDragon');
});
test('a purchase under Available keeps selected detail, next Arrange action and useful focus',async t=>{
 const ui=await armory(t),proto=Object.getPrototypeOf(ui.get('shopSearch')),scrolled=[];const originalScroll=proto.scrollIntoView;proto.scrollIntoView=function(){scrolled.push(this.id);};t.after(()=>{if(originalScroll)proto.scrollIntoView=originalScroll;else delete proto.scrollIntoView;});change(ui,'shopOwnership','available');ui.get('buy-fireArrow').focus();ui.click('buy-fireArrow');
 assert.equal(ui.battle.profile.gold,9000);assert.ok(!ui.document.querySelector('#buy-fireArrow'));
 assert.match(ui.get('shopDetails').textContent,/Fire Arrow/);assert.match(ui.get('shopDetails').textContent,/Selected outside these filters/);assert.match(ui.get('shopDetailAction').textContent,/Arrange in loadout/);
 assert.equal(ui.document.activeElement.id,'shopDetailAction');assert.ok(scrolled.includes('shopDetailAction'));ui.click('shopDetailAction');assert.equal(ui.visible('shopDetailDrawer'),true);assert.match(ui.get('shopDetails').textContent,/Place in your loadout/);assert.equal(ui.battle.profile.gold,9000);
});
test('stale affordability and repeated clicks are checked against current campaign state',async t=>{
 const ui=await armory(t,1001),oldButton=ui.get('buy-fireArrow');oldButton.focus();ui.battle.profile.gold=1000;oldButton.click();assert.equal(ui.document.activeElement,ui.get('inspect-fireArrow'));assert.match(ui.get('shopStatus').textContent,/Need 1 more gold/);assert.equal(ui.battle.profile.owned.has('fireArrow'),false);assert.equal(ui.battle.profile.gold,1000);
 ui.click('closeShop');ui.battle.profile.gold=1001;ui.click('endingShop');const purchase=ui.get('buy-fireArrow');purchase.click();purchase.click();assert.equal(ui.battle.profile.gold,1);assert.equal(ui.battle.profile.skills.filter(x=>x.id==='fireArrow').length,1);assert.equal(ui.visible('shopDetailDrawer'),true);
});
test('a changed source price is rejected before charging the campaign',async t=>{
 const ui=await armory(t,10000),price=SKILLS.fireArrow.price;t.after(()=>{SKILLS.fireArrow.price=price;});SKILLS.fireArrow.price=1200;ui.click('buy-fireArrow');assert.equal(ui.battle.profile.gold,10000);assert.equal(ui.battle.profile.owned.has('fireArrow'),false);assert.match(ui.get('shopStatus').textContent,/price changed/);
});
test('search typing retains input DOM/focus, ignores combat keys and cleanly returns with Escape',async t=>{
 const ui=await armory(t),input=ui.get('shopSearch'),heroX=ui.battle.hero.x,shots=ui.battle.stats.shotsFired,selected=ui.battle.activeSkill;
 input.focus();for(const key of ['a','d','w','s','1','0','p','ArrowDown','ArrowLeft',' ']){ui.key('keydown',key,{target:input});ui.key('keyup',key,{target:input});}
 search(ui,'fire');assert.equal(ui.get('shopSearch'),input);assert.equal(ui.document.activeElement,input);ui.frames(3);assert.equal(ui.battle.hero.x,heroX);assert.equal(ui.battle.stats.shotsFired,shots);assert.equal(ui.battle.activeSkill,selected);assert.deepEqual(ui.battle.input.digits,[]);assert.equal(ui.battle.input.left,false);assert.equal(ui.battle.input.right,false);assert.equal(ui.battle.input.space,false);
 ui.key('keydown','Escape',{target:input});assert.equal(ui.visible('shopPanel'),false);ui.click('endingShop');assert.equal(ui.get('shopSearch').value,'fire');ui.key('keydown','Escape');ui.click('replay');ui.frames(2);assert.equal(ui.battle.input.left,false);assert.equal(ui.battle.input.right,false);assert.equal(ui.battle.input.space,false);
});
test('a held combat movement key is cleared before armory entry and never returns after catalog navigation',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=test'});ui.click('start');ui.key('keydown','d');assert.equal(ui.battle.input.right,true);ui.click('battlePause');assert.equal(ui.battle.input.right,false);ui.click('pauseTesting');ui.click('testVictory');ui.frames(105);ui.click('endingShop');search(ui,'fire');change(ui,'shopSort','name');ui.key('keydown','Escape');ui.click('replay');ui.frames(3);assert.equal(ui.battle.input.right,false);assert.equal(ui.battle.input.left,false);assert.deepEqual(ui.battle.input.digits,[]);assert.equal(ui.battle.input.space,false);
});
test('query, sort, pages, zero results, reveal and reopen keep the chosen card and navigation',async t=>{
 const ui=await armory(t);ui.click('inspect-iceArrow');change(ui,'shopSort','price-desc');assert.match(ui.get('shopDetails').textContent,/Ice Arrow/);ui.click('shopNext');assert.match(ui.get('shopDetails').textContent,/Ice Arrow/);assert.ok(ui.document.activeElement.id.startsWith('inspect-'));
 search(ui,'missing_item');assert.equal(ui.get('shopGrid').querySelectorAll('article').length,0);assert.match(ui.get('shopDetails').textContent,/Ice Arrow/);ui.click('shopBrowse');assert.ok(ui.get('inspect-iceArrow'));assert.equal(ui.document.activeElement.id,'inspect-iceArrow');assert.equal(ui.get('inspect-iceArrow').getAttribute('aria-pressed'),'true');
 ui.get('shopFilters').querySelector('[data-ability-filter="army"]').click();ui.click('closeShop');ui.click('endingShop');assert.equal(ui.get('shopCategoryCompact').value,'army');assert.match(ui.get('shopDetails').textContent,/Ice Arrow/);
});
test('paused frames never rebuild a catalog, and repeated selections remain bounded',async t=>{
 const ui=await armory(t),card=ui.get('inspect-fireArrow'),searchBox=ui.get('shopSearch');ui.frames(90);assert.equal(ui.get('inspect-fireArrow'),card);assert.equal(ui.get('shopSearch'),searchBox);
 const counts=[];for(let i=0;i<40;i++){ui.click(i%2?'inspect-fireArrow':'inspect-iceArrow');counts.push(ui.get('armoryCatalogHost').querySelectorAll('button,input,select,option,span,svg,path,div,section,p,article').length);assert.equal(ui.get('shopGrid').querySelectorAll('article').length,ARMORY_PAGE_SIZE);}
 assert.ok(Math.max(...counts)<500);assert.equal(new Set(counts.filter((_,i)=>i%2===0)).size,1);assert.equal(new Set(counts.filter((_,i)=>i%2===1)).size,1);
});
test('large synthetic catalogs render one bounded page, escaped text, and report harness-only latency',async t=>{
 const ui=await loadGameUI(t),root=ui.document.createElement('div');
 const summary=[];
 for(const count of [1000,10000]){
  const fixture=synthetic(count);fixture[0]={...fixture[0],name:'<img src=x onerror="alert(1)">',description:'<script>alert(1)</script> & a "quote"'};
  const snapshot=state();snapshot.gold=50000;const begin=performance.now();const view=createArmoryCatalogUI({root,records:fixture,getSnapshot:()=>snapshot,onPurchase:()=>false,onArrange:()=>{}});view.refresh();root.querySelector('#shopCatalogTab').click();const initMs=performance.now()-begin;
  assert.equal(root.querySelectorAll('article').length,12);assert.equal(root.querySelectorAll('script,img').length,0);assert.match(root.querySelector('#shopGrid').textContent,/&lt;img/);assert.match(root.querySelector('#shopDetails').textContent,/&lt;script/);
  const samples=[];for(let i=0;i<40;i++){const start=performance.now();view.model.setView({query:i%2?'fixture':'',sort:i%3?'price':'name',page:i});view.refresh();samples.push(performance.now()-start);assert.ok(root.querySelectorAll('article').length<=12);assert.ok(root.querySelectorAll('button,input,select,option,span,div,section,p,article,aside,nav,form,label,h3,h4,ul,li,table,thead,tbody,tr,th,td,small,strong,b').length<650);}
  const ownedStart=performance.now();snapshot.owned=new Set(fixture.map(item=>item.id));snapshot.skills=new Map(fixture.map(item=>[item.id,{id:item.id,rank:2,binding:-1}]));view.model.setView({query:'',status:'owned',sort:'catalog'});view.refresh();const allOwnedRefreshMs=performance.now()-ownedStart;assert.equal(view.diagnostics.resultCount,count);assert.equal(view.diagnostics.cardCount,12);
  for(const page of [1,17,Math.ceil(count/12)-1,0]){view.model.setView({page});view.refresh();assert.ok(view.diagnostics.cardCount<=12);assert.ok(root.querySelectorAll('article').length<=12);}
  samples.sort((a,b)=>a-b);summary.push({count,initMs:+initMs.toFixed(2),medianUpdateMs:+samples[20].toFixed(2),p95UpdateMs:+samples[38].toFixed(2),allOwnedRefreshMs:+allOwnedRefreshMs.toFixed(2),maxCards:view.diagnostics.cardCount,nodes:root.querySelectorAll('button,input,select,option,span,div,section,p,article,aside,nav,form,label,h3,h4,ul,li,table,thead,tbody,tr,th,td,small,strong,b').length});view.dispose();
 }
 t.diagnostic('Bounded Node DOM harness, not browser/phone performance: '+JSON.stringify(summary));
});
test('model rejects unsafe duplicate IDs, caps page size and handles empty catalogs',()=>{
 assert.throws(()=>new ArmoryCatalog([{id:'x" onclick="bad',kind:'skill',price:1}]),/DOM-safe/);
 assert.throws(()=>new ArmoryCatalog([records[0],records[0]]),/unique/);
 const empty=new ArmoryCatalog([],{pageSize:10000});assert.equal(empty.pageSize,48);assert.equal(empty.query(state()).total,0);assert.equal(empty.selectedId,null);
});
