import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadGameUI} from './helpers/game-ui-harness.mjs';

const css=readFileSync(new URL('../site/dist/armory-catalog.css',import.meta.url),'utf8');
const repair=css.slice(css.indexOf('/* Cart readability follows'));

test('Cart breakpoint is bound to actual surface width rather than physical viewport orientation',()=>{
 assert.match(repair,/\.armory-cart-view\{container:market-cart-stage \/ inline-size\}/);
 assert.match(repair,/@container market-cart-stage \(max-width:760px\)\{[^}]*\.market-cart-layout\{grid-template-columns:minmax\(0,1fr\)\}/);
 assert.match(repair,/\.market-cart-summary\{position:static\}/);
 assert.doesNotMatch(repair,/@media|font-size|text-overflow|line-clamp/);
});

test('narrow illustrated Cart rows move the separate Remove action below the full-width inspector',()=>{
 assert.match(repair,/\.market-cart-line\{container:market-cart-row \/ inline-size\}/);
 assert.match(repair,/@container market-cart-row \(max-width:460px\)/);
 assert.match(repair,/\.market-cart-inspect\{flex-basis:100%;width:100%\}/);
 assert.match(repair,/\.market-cart-line>button:not\(\.market-cart-inspect\)\{margin:0 9px 9px auto\}/);
 assert.match(repair,/\.market-cart-line\{flex-wrap:wrap\}/);
});

test('illustrated Cart keeps full companion and castle labels, prices and actions after return',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=test'});ui.click('introTesting');ui.click('testGoldLarge');ui.click('closeTesting');ui.click('introArmory');ui.click('front-cart-gorath');ui.click('front-cart-highwatch');ui.click('shopCartOpen');
 const cart=ui.get('shopCartView'),before=cart.textContent;assert.match(before,/Gorath/);assert.match(before,/Highwatch/);assert.match(before,/Companion/);assert.match(before,/Castle sidegrade/);assert.match(before,/7,500 gold/);assert.ok(cart.querySelector('img'));assert.ok(cart.querySelector('[data-castle-preview]'));
 ui.click('cart-inspect-gorath');ui.click('shopCloseDetails');assert.equal(ui.visible('shopCartView'),true);assert.equal(ui.get('shopCartView').textContent,before);assert.equal(ui.battle.profile.gold,10000);
});
