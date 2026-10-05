import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadGameUI} from './helpers/game-ui-harness.mjs';

// Real browsers report zero layout scroll metrics after display:none. The
// general fake DOM retains the assigned value, so model that boundary here.
function nativeHiddenScroll(node){let top=0;Object.defineProperty(node,'scrollTop',{configurable:true,get(){return node.classList.contains('hidden')?0:top;},set(value){top=value;}});}
async function setup(t){const ui=await loadGameUI(t,{search:'?mode=test'});ui.click('introTesting');ui.click('testGoldLarge');ui.click('closeTesting');ui.click('introArmory');for(const id of ['shopDiscover','shopPlanView','shopCartView','shopCompareView'])nativeHiddenScroll(ui.get(id));return ui;}

test('Discover captures native vertical scroll before hiding for inspection, cart, wishlist and comparison',async t=>{
 const ui=await setup(t),discover=ui.get('shopDiscover');
 discover.scrollTop=114;ui.get('shopFeaturedShelf').scrollLeft=383;
 ui.click('front-inspect-gorath');ui.click('shopCloseDetails');assert.equal(discover.scrollTop,114);assert.equal(ui.get('shopFeaturedShelf').scrollLeft,383);assert.equal(ui.document.activeElement.id,'front-inspect-gorath');
 discover.scrollTop=99;ui.click('front-inspect-gorath');ui.key('keydown','Escape');assert.equal(discover.scrollTop,99);
 discover.scrollTop=147;ui.click('front-cart-gorath');ui.click('shopDiscoverCart');ui.click('shopCartBack');assert.equal(discover.scrollTop,147);
 discover.scrollTop=163;ui.click('front-save-gorath');ui.click('shopDiscoverWishlist');ui.click('shopDiscoverTab');assert.equal(discover.scrollTop,163);
 discover.scrollTop=181;ui.click('front-compare-fireArrow');ui.click('front-compare-tallGrunt');ui.click('shopCompareOpen');ui.click('shopCompareBack');assert.equal(discover.scrollTop,181);
});

test('collection, cart and comparison preserve scroll across nested native-hidden stages',async t=>{
 const ui=await setup(t);ui.click('plan-open-frost-and-fire');const plan=ui.get('shopPlanView');plan.scrollTop=172;
 ui.click('plan-inspect-iceArrow');ui.key('keydown','Escape');assert.equal(plan.scrollTop,172);
 ui.click('plan-compare-iceArrow');ui.click('plan-compare-fireArrow');ui.click('shopCompareOpen');const compare=ui.get('shopCompareView');compare.scrollTop=126;
 ui.click('comparison-inspect-iceArrow');ui.key('keydown','Escape');assert.equal(compare.scrollTop,126);ui.key('keydown','Escape');assert.equal(plan.scrollTop,172);
 ui.click('plan-cart-iceArrow');ui.click('shopCartOpen');const cart=ui.get('shopCartView');cart.scrollTop=121;ui.click('cart-inspect-iceArrow');ui.key('keydown','Escape');assert.equal(cart.scrollTop,121);ui.key('keydown','Escape');assert.equal(plan.scrollTop,172);
});


test('illustrated collection detail keeps readable single-column cards throughout portrait phones',()=>{
 const css=readFileSync(new URL('../site/dist/armory-catalog.css',import.meta.url),'utf8').split('/* Card-led Discover.')[1];
 assert.match(css,/@media\(max-width:620px\) and \(orientation:portrait\)\{[\s\S]*?market-plan-content \.market-plan-cards\{grid-template-columns:minmax\(0,1fr\);gap:14px\}/);
});
