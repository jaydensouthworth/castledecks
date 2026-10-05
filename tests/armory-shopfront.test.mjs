import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
import {buildArmoryRecords,ARMORY_DEPARTMENTS} from '../site/dist/armory-catalog-data.mjs';
import {shopfrontCards,discoveryPlans} from '../site/dist/armory-discovery.mjs';
import {createArmoryCatalogUI} from '../site/dist/armory-catalog.mjs';
import {createArmorySnapshot} from '../site/dist/armory-catalog-model.mjs';
import {SKILLS,PlayerProfile} from '../site/dist/engine/progression.mjs';
import {COMPANIONS} from '../site/dist/engine/recruitment.mjs';
const records=buildArmoryRecords(SKILLS,COMPANIONS,{});
async function market(t,{gold=20000,owned=false}={}){
 const ui=await loadGameUI(t,{search:'?mode=test'});ui.click('introTesting');if(owned)ui.click('testUnlock');ui.click('testVictory');ui.frames(105);ui.battle.profile.gold=gold;ui.click('endingShop');return ui;
}
const card=(ui,id)=>ui.get('shopFeaturedShelf').querySelector(`[data-card-id="${id}"]`);

test('the first Discover section is a bounded real illustrated shelf, ahead of departments, collections and budget',async t=>{
 const ui=await market(t),discover=ui.get('shopDiscover');
 assert.deepEqual(discover.children.slice(0,5).map(node=>node.tagName),['HEADER','SECTION','SECTION','SECTION','SECTION']);
 assert.equal(discover.children[1].getAttribute('aria-label'),'Cards from across the armory');
 assert.equal(ui.get('shopFeaturedShelf').querySelectorAll('article').length,4);
 assert.equal(ui.get('shopFeaturedShelf').querySelectorAll('img').length,3);
 assert.ok(ui.get('shopFeaturedShelf').querySelector('[data-castle-preview]'));
 assert.equal(discover.querySelectorAll('.market-overview').length,0);
 assert.equal(discover.querySelectorAll('.market-collection-card').length,12);
 assert.equal(discover.querySelectorAll('[data-discover-department]').length,4);
 for(const item of shopfrontCards(records,ARMORY_DEPARTMENTS)){assert.match(card(ui,item.id).textContent,new RegExp(item.name));assert.match(card(ui,item.id).textContent,new RegExp(item.price.toLocaleString()+' gold'));}
 assert.equal(ui.get('shopFeaturedShelf').querySelectorAll('.shop-buy').length,0);
 assert.equal(ui.battle.profile.gold,20000);
});

test('shelf curation handles absent/hidden representatives and remains deterministic without invented cards',()=>{
 assert.deepEqual(shopfrontCards(records,ARMORY_DEPARTMENTS).map(item=>item.id),['fireArrow','tallGrunt','gorath','highwatch']);
 assert.deepEqual(shopfrontCards([],ARMORY_DEPARTMENTS),[]);
 const subset=records.filter(item=>!['fireArrow','gorath','highwatch'].includes(item.id)).map(item=>item.id==='tallGrunt'?{...item,storefront:false}:item);
 const picks=shopfrontCards(subset,ARMORY_DEPARTMENTS);
 assert.deepEqual(picks.map(item=>item.id),['pierceArrow','archer','classic']);
 assert.ok(picks.every(item=>subset.includes(item)&&item.storefront!==false));
 assert.equal(shopfrontCards(records,ARMORY_DEPARTMENTS,99).length,4);
 assert.equal(shopfrontCards(records,ARMORY_DEPARTMENTS,0).length,0);
 assert.equal(discoveryPlans(records.filter(item=>item.id!=='iceArrow'),createArmorySnapshot(new PlayerProfile())).length,3);
});

test('first shelf shows actual budget state and permits only reversible cart preparation before review',async t=>{
 const ui=await market(t,{gold:1000}),p=ui.battle.profile;
 assert.match(card(ui,'fireArrow').textContent,/Available to acquire/);assert.match(card(ui,'tallGrunt').textContent,/Need 500 more gold/);assert.match(card(ui,'gorath').textContent,/Need 6,500 more gold/);
 ui.click('front-cart-tallGrunt');assert.equal(ui.get('front-cart-tallGrunt').getAttribute('aria-pressed'),'true');assert.equal(ui.document.activeElement.id,'front-cart-tallGrunt');assert.equal(p.gold,1000);
 ui.click('shopDiscoverCart');assert.equal(ui.get('shopCheckout').disabled,true);assert.match(ui.get('shopCartView').textContent,/Need 500 more/);ui.click('shopCheckout');assert.equal(p.gold,1000);
 ui.click('shopCartBack');ui.click('front-cart-tallGrunt');ui.click('front-cart-fireArrow');ui.click('shopCartOpen');assert.equal(ui.get('shopCheckout').disabled,false);ui.click('shopCheckout');assert.equal(p.gold,0);assert.ok(p.owned.has('fireArrow'));assert.equal(p.skills.find(s=>s.id==='fireArrow').binding,-1);
 ui.click('shopDiscoverTab');assert.match(card(ui,'fireArrow').textContent,/1,000 gold · Owned/);assert.match(card(ui,'fireArrow').textContent,/In reserve/);assert.equal(ui.get('front-cart-fireArrow').disabled,true);
});

test('owned and equipped shelf cards remain inspectable and never offer repeat acquisition',async t=>{
 const ui=await market(t,{owned:true,gold:0});
 assert.match(card(ui,'fireArrow').textContent,/Owned/);assert.match(card(ui,'fireArrow').textContent,/Equipped/);assert.equal(ui.get('front-cart-fireArrow').disabled,true);
 assert.match(card(ui,'gorath').textContent,/Companion equipped/);assert.equal(ui.get('front-cart-gorath').disabled,true);
 ui.click('front-inspect-fireArrow');assert.equal(ui.visible('shopDetailDrawer'),true);assert.match(ui.get('shopDetailAction').textContent,/Arrange in loadout/);ui.click('shopCloseDetails');assert.equal(ui.visible('shopDiscover'),true);assert.equal(ui.document.activeElement.id,'front-inspect-fireArrow');assert.equal(ui.battle.profile.gold,0);
});

test('Discover details, cart and wishlist preserve vertical and horizontal shelf position and focus',async t=>{
 const ui=await market(t);ui.get('shopDiscover').scrollTop=234;ui.get('shopFeaturedShelf').scrollLeft=386;
 ui.click('front-save-gorath');assert.equal(ui.get('front-save-gorath').getAttribute('aria-pressed'),'true');assert.equal(ui.document.activeElement.id,'front-save-gorath');assert.equal(ui.get('shopFeaturedShelf').scrollLeft,386);
 ui.click('front-inspect-gorath');ui.key('keydown','Escape');assert.equal(ui.document.activeElement.id,'front-inspect-gorath');assert.equal(ui.get('shopDiscover').scrollTop,234);assert.equal(ui.get('shopFeaturedShelf').scrollLeft,386);
 ui.click('front-cart-gorath');ui.get('shopDiscoverCart').focus();ui.click('shopDiscoverCart');ui.click('cart-inspect-gorath');ui.key('keydown','Escape');ui.key('keydown','Escape');assert.equal(ui.visible('shopDiscover'),true);assert.equal(ui.document.activeElement.id,'shopDiscoverCart');assert.equal(ui.get('shopDiscover').scrollTop,234);assert.equal(ui.get('shopFeaturedShelf').scrollLeft,386);
 ui.click('shopDiscoverWishlist');assert.equal(ui.get('shopGrid').querySelectorAll('article').length,1);assert.ok(ui.get('inspect-gorath'));ui.click('shopDiscoverTab');assert.equal(ui.get('shopDiscover').scrollTop,234);assert.equal(ui.get('shopFeaturedShelf').scrollLeft,386);assert.equal(ui.get('front-save-gorath').getAttribute('aria-pressed'),'true');
});

test('comparison opened from Discover returns there, including nested inspection and removing a pin',async t=>{
 const ui=await market(t);ui.get('shopDiscover').scrollTop=212;ui.click('front-compare-fireArrow');ui.click('front-compare-tallGrunt');ui.click('front-compare-gorath');assert.equal(ui.get('shopCompareCount').textContent,'2/2');assert.match(ui.get('shopStatus').textContent,/Two cards/);
 ui.click('shopCompareOpen');ui.click('shopCompareOpen');assert.match(ui.get('shopCompareBack').textContent,/Discover/);ui.click('comparison-inspect-fireArrow');ui.key('keydown','Escape');assert.equal(ui.visible('shopCompareView'),true);ui.key('keydown','Escape');assert.equal(ui.visible('shopDiscover'),true);assert.equal(ui.get('shopDiscover').scrollTop,212);assert.equal(ui.document.activeElement.id,'shopCompareOpen');
 ui.click('shopCompareOpen');ui.click('comparison-remove-fireArrow');assert.equal(ui.visible('shopDiscover'),true);assert.equal(ui.get('shopCompareCount').textContent,'1/2');assert.equal(ui.get('front-compare-fireArrow').getAttribute('aria-pressed'),'false');
});

test('illustrated collection keeps actual cards before tactical context and preserves comparison/inspection return',async t=>{
 const ui=await market(t);ui.click('plan-open-frost-and-fire');const content=ui.get('shopPlanView').querySelector('.market-plan-content');assert.ok(content.children[0].classList.contains('market-plan-cards'));assert.equal(content.children[0].querySelectorAll('img').length,3);
 ui.get('shopPlanView').scrollTop=170;ui.click('plan-save-iceArrow');ui.click('plan-compare-iceArrow');ui.click('plan-compare-fireArrow');ui.click('shopCompareOpen');ui.click('shopCompareBack');assert.equal(ui.visible('shopPlanView'),true);assert.equal(ui.get('shopPlanView').scrollTop,170);
 ui.click('plan-inspect-iceArrow');ui.key('keydown','Escape');assert.equal(ui.visible('shopPlanView'),true);assert.equal(ui.document.activeElement.id,'plan-inspect-iceArrow');ui.click('shopPlanBack');assert.equal(ui.document.activeElement.id,'plan-open-frost-and-fire');
});

test('empty/missing catalogs and escaped long labels remain usable without phantom offers',async t=>{
 const ui=await loadGameUI(t),p=new PlayerProfile(),root=ui.document.createElement('div');const view=createArmoryCatalogUI({root,records:[],getSnapshot:()=>createArmorySnapshot(p),onPurchase:()=>false,onArrange:()=>{}});view.refresh();assert.match(root.querySelector('#shopDiscover').textContent,/The display is empty/);assert.match(root.querySelector('#shopDiscover').textContent,/Collections will appear/);assert.equal(root.querySelectorAll('[data-discover-department]').filter(node=>node.disabled).length,4);view.dispose();
 const longName='A very long training-only card name & <untrusted> '.repeat(4),fixture=[{id:'long-card',kind:'skill',department:'bow',category:'arrows',name:longName,description:'Synthetic long-label check',price:1,traits:[]}];
 const second=createArmoryCatalogUI({root,records:fixture,getSnapshot:()=>createArmorySnapshot(p),onPurchase:()=>false,onArrange:()=>{}});second.refresh();assert.equal(root.querySelectorAll('untrusted').length,0);assert.ok(root.querySelector('#front-inspect-long-card').getAttribute('aria-label').includes('training-only'));assert.equal(root.querySelector('#shopFeaturedShelf').querySelectorAll('article').length,1);second.dispose();
});

test('shopfront presentation explicitly keeps readable horizontal landscape cards, wrapping labels and target sizes',()=>{
 const css=readFileSync(new URL('../site/dist/armory-catalog.css',import.meta.url),'utf8');
 assert.match(css,/market-featured-grid\{display:flex;overflow-x:auto/);assert.match(css,/flex:0 0 clamp\(180px,26vw,240px\)/);assert.match(css,/market-playing-card\{[^}]*overflow-wrap:anywhere/);assert.match(css,/market-card-tools button\{[^}]*min-height:44px/);
 const rail=readFileSync(new URL('../site/dist/deck-composition.css',import.meta.url),'utf8');assert.match(rail,/grid-template-columns:190px minmax\(0,1fr\) 210px/);assert.match(rail,/grid-template-columns:minmax\(0,1fr\) auto;align-items:center;gap:8px;min-width:0;width:100%;white-space:normal/);
});


test('a preserved live battle shows its acquisition gate rather than claiming funded cards are unaffordable',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=test'});ui.click('introTesting');ui.click('testGoldLarge');ui.click('closeTesting');ui.click('start');ui.frames();ui.click('battlePause');ui.click('pauseLobby');ui.click('introArmory');
 const gold=ui.battle.profile.gold;assert.match(card(ui,'fireArrow').textContent,/Finish this battle/);assert.match(ui.get('front-inspect-fireArrow').getAttribute('aria-label'),/1,000 gold/);assert.match(ui.get('shopAffordableShelf').textContent,/0 cards available to acquire/);assert.doesNotMatch(ui.get('shopAffordableShelf').textContent,/affordable/);
 ui.click('front-cart-fireArrow');ui.click('shopDiscoverCart');assert.equal(ui.get('shopCheckout').disabled,true);ui.click('shopCheckout');assert.equal(ui.battle.profile.gold,gold);assert.equal(ui.battle.profile.owned.has('fireArrow'),false);
});


test('new shopfront labels and prices stay readable instead of shrinking on landscape',()=>{
 const css=readFileSync(new URL('../site/dist/armory-catalog.css',import.meta.url),'utf8').split('/* Card-led Discover.')[1];
 assert.doesNotMatch(css,/font(?:-size)?:[^;}]*\b(?:9|10|11|12|13)px/);
 assert.match(css,/market-card-state\{font:14px/);
 assert.match(css,/market-card-tools button\{font-size:14px/);
 const js=readFileSync(new URL('../site/dist/armory-catalog.mjs',import.meta.url),'utf8');assert.doesNotMatch(js,/Inspect card →/);
});
