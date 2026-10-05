import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
import {LoadoutCollection} from '../site/dist/loadout-collection-model.mjs';
import {collectionSpotlight,discoveryPlans} from '../site/dist/armory-discovery.mjs';
import {buildArmoryRecords} from '../site/dist/armory-catalog-data.mjs';
import {createArmorySnapshot} from '../site/dist/armory-catalog-model.mjs';
import {SKILLS,PlayerProfile} from '../site/dist/engine/progression.mjs';
import {COMPANIONS} from '../site/dist/engine/recruitment.mjs';
const records=buildArmoryRecords(SKILLS,COMPANIONS,{});
async function playground(t){const ui=await loadGameUI(t,{search:'?mode=test'});ui.click('introTesting');ui.click('testGoldLarge');ui.click('closeTesting');return ui;}

test('Hall save management is a secondary closed disclosure, preserving explicit local choice controls',async t=>{
 const ui=await playground(t),summary=ui.get('hallSaveSummary'),details=summary.parentElement;
 assert.equal(details.tagName,'DETAILS');assert.equal(details.getAttribute('open'),null);assert.ok(ui.get('localHubStatus'));assert.ok(ui.get('localContinue'));assert.ok(ui.get('localSessionOnly'));
 const css=readFileSync(new URL('../site/dist/hall-home.css',import.meta.url),'utf8');assert.doesNotMatch(css,/hall-save-state:has\([^}]*order:-1/);
 ui.click('hallOpenSaves');assert.equal(ui.visible('savePanel'),true);
});

test('Build has matching session-local market counts and opens the same cart',async t=>{
 const ui=await playground(t);ui.click('introArmory');ui.click('front-save-gorath');ui.click('front-cart-fireArrow');ui.click('front-compare-fireArrow');ui.click('front-compare-tallGrunt');ui.click('shopBuildTab');
 assert.equal(ui.get('buildWishlistCount').textContent,'1');assert.equal(ui.get('buildCartCount').textContent,'1');assert.equal(ui.get('buildCompareCount').textContent,'2/2');assert.equal(ui.get('build-compare').getAttribute('aria-disabled'),'false');
 ui.click('build-cart');assert.equal(ui.visible('shopCartView'),true);assert.ok(ui.get('cart-inspect-fireArrow'));assert.equal(ui.battle.profile.gold,10000);
});

test('Build quick controls filter actual owned cards and current action bar without moving cards',async t=>{
 const ui=await playground(t);ui.click('introTesting');ui.click('testUnlock');ui.click('closeTesting');ui.click('introLoadout');ui.document.querySelector('[data-loadout-bar="0"]').onclick();const bindings=ui.battle.profile.skills.map(x=>[x.id,x.binding]);
 ui.get('loadoutState').value='bar';ui.get('loadoutState').onchange();assert.match(ui.get('loadoutFilterContext').textContent,/Bar 1/);assert.equal(ui.get('ownedSkillList').querySelectorAll('.loadout-owned-card').length<=10,true);
 ui.get('loadoutTypeQuick').value='army';ui.get('loadoutTypeQuick').onchange();assert.equal(ui.get('loadoutTypeQuick').value,'army');assert.deepEqual(ui.battle.profile.skills.map(x=>[x.id,x.binding]),bindings);
});

test('five-hundred-card synthetic collection remains bounded and searchable with exact current-bar membership',()=>{
 const synthetic=Array.from({length:500},(_,i)=>({id:'fixture-'+i,kind:'skill',name:'Fixture '+String(i).padStart(3,'0'),description:'Synthetic test only',category:i%3===0?'army':'arrows',traits:[],reloadSeconds:1,role:'frontline'}));
 const wrappers=synthetic.map((item,i)=>({binding:i<30?i:-1,skill:{id:item.id,rank:i%5}})),model=new LoadoutCollection(synthetic);
 assert.equal(model.query(wrappers).items.length,12);assert.equal(model.query(wrappers).pageCount,42);
 model.actionBar=2;model.setView({status:'bar'});assert.deepEqual(model.query(wrappers).items.map(x=>x.wrapper.binding),[20,21,22,23,24,25,26,27,28,29]);
 model.setView({status:'reserve',query:'Fixture 499'});assert.equal(model.query(wrappers).total,1);assert.equal(model.query(wrappers).items[0].item.id,'fixture-499');
});

test('empty Wishlist has a truthful browse entry and populated wishlist reuses actual card artwork',async t=>{
 const ui=await playground(t);ui.click('introArmory');ui.click('shopWishlistTab');assert.match(ui.get('shopGrid').textContent,/Your next idea starts with a card/);ui.click('shopEmptyReset');assert.equal(ui.get('armoryCatalogHost').getAttribute('data-armory-mode'),'catalog');
 ui.click('shopDiscoverTab');ui.click('front-save-gorath');ui.click('shopWishlistTab');assert.equal(ui.get('shopGrid').querySelectorAll('article').length,1);assert.ok(ui.get('shopGrid').querySelector('img'));assert.ok(ui.get('inspect-gorath'));
});

test('cart rows retain real portraits and prices without acquiring on inspection',async t=>{
 const ui=await playground(t);ui.click('introArmory');ui.click('front-cart-gorath');ui.click('front-cart-highwatch');ui.click('shopCartOpen');assert.ok(ui.get('shopCartView').querySelector('img'));assert.ok(ui.get('shopCartView').querySelector('[data-castle-preview]'));assert.match(ui.get('shopCartView').textContent,/7,500 gold/);assert.equal(ui.battle.profile.gold,10000);
});

test('Discover search enters an unfiltered real catalog and collection spotlight reflects ownership',async t=>{
 const ui=await playground(t);ui.click('introArmory');ui.get('shopDiscoverSearch').value='priest';ui.get('shopDiscoverSearch').oninput();ui.click('front-save-gorath');assert.equal(ui.get('shopDiscoverSearch').value,'priest');ui.get('shopDiscoverSearchForm').onsubmit({preventDefault(){}});assert.equal(ui.get('shopSearch').value,'priest');assert.ok(ui.get('inspect-priest'));assert.equal(ui.get('armoryCatalogHost').getAttribute('data-armory-mode'),'catalog');
 const p=new PlayerProfile();p.gold=20000;p.purchase('iceArrow');const plans=discoveryPlans(records,createArmorySnapshot(p));assert.equal(collectionSpotlight(plans).id,'frost-and-fire');assert.equal(collectionSpotlight([]),null);
});

test('Build resource and market-nav order matches the shop and quick filters have explicit scroll rows',()=>{
 const html=readFileSync(new URL('../site/dist/battle.html',import.meta.url),'utf8'),start=html.indexOf('id="skillsPanel"'),end=html.indexOf('id="loadoutWorkspace"',start),part=html.slice(start,end);
 assert.ok(part.indexOf('id="skillsResources"')<part.indexOf('deck-workspace-nav'));
 const css=readFileSync(new URL('../site/dist/game-shell.css',import.meta.url),'utf8');assert.match(css,/loadout-quick-filters\{grid-column:1\/-1;grid-row:3/);assert.match(css,/deck-workspace-nav>#build-cart\{margin-left:auto/);
});

test('collapsed Hall save disclosure still exposes a save failure attention label',async t=>{
 const storage={getItem(){return null;},setItem(){throw new Error('Synthetic quota failure');},removeItem(){}};
 const ui=await loadGameUI(t,{storage});await ui.settle();assert.equal(ui.get('hallSaveSummary').textContent,'Save needs attention');assert.equal(ui.get('hallSaveSummary').getAttribute('data-attention'),'true');assert.equal(ui.get('hallSaveSummary').parentElement.getAttribute('open'),null);
});

test('Build market counts cannot leak a previous profile’s temporary cart or wishlist',async t=>{
 const ui=await playground(t);ui.click('introArmory');ui.click('front-save-gorath');ui.click('front-cart-fireArrow');ui.click('shopBuildTab');ui.get('skillsPanel').querySelector('[data-menu-route="profiles"]').click();ui.get('newProfileName').value='Separate fixture';ui.click('createProfile');ui.click('introLoadout');assert.equal(ui.get('buildWishlistCount').textContent,'0');assert.equal(ui.get('buildCartCount').textContent,'0');assert.equal(ui.get('buildCompareCount').textContent,'0/2');
});
