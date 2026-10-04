import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {revealManagementRoute} from '../site/dist/management-frame.mjs';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
test('active workspace is kept inside the scrollable rail after switching and rotation',()=>{
 const nav={scrollTop:0,scrollLeft:0,getBoundingClientRect:()=>({top:45,bottom:295,left:45,right:113,width:68,height:250}),querySelector:()=>({getBoundingClientRect:()=>({top:309,bottom:353,left:45,right:113})})};
 revealManagementRoute(nav);assert.equal(nav.scrollTop,58);assert.equal(nav.scrollLeft,0);
 nav.querySelector=()=>({getBoundingClientRect:()=>({top:-13,bottom:31,left:45,right:113})});revealManagementRoute(nav);assert.equal(nav.scrollTop,0);
 nav.getBoundingClientRect=()=>({top:57,bottom:101,left:1,right:359,width:358,height:44});nav.querySelector=()=>({getBoundingClientRect:()=>({top:57,bottom:101,left:400,right:465})});revealManagementRoute(nav);assert.equal(nav.scrollLeft,106);
});
test('workspace transitions retain the navigation scroller before the previous screen is hidden',async t=>{
 const ui=await loadGameUI(t);const hall=ui.get('intro').querySelector('.game-shell-nav');hall.scrollTop=58;hall.scrollLeft=110;
 ui.click('shell-intro-vault');const saves=ui.get('savePanel').querySelector('.game-shell-nav');assert.equal(saves.scrollTop,58);assert.equal(saves.scrollLeft,110);
 saves.scrollTop=30;saves.scrollLeft=40;ui.click('shell-savePanel-settings');const settings=ui.get('settingsPanel').querySelector('.game-shell-nav');assert.equal(settings.scrollTop,30);assert.equal(settings.scrollLeft,40);
});
test('Hall inner wrapper cannot offset or clip the shared landscape rail or header',()=>{
 const css=readFileSync(new URL('../site/dist/management-frame.css',import.meta.url),'utf8');assert.match(css,/#managementFrame #intro \.preparation-shell\{position:static;overflow:visible\}/);assert.match(css,/#managementFrame #intro \.hall-heading\{display:block;min-width:0\}/);
 const html=readFileSync(new URL('../site/dist/battle.html',import.meta.url),'utf8');assert.match(html,/id="introTitle">Hall<\/h1>/);assert.doesNotMatch(html,/Back to lobby/);
});

test('Catalog name bands keep the title above its subtitle, rather than competing for card width',()=>{
 const css=readFileSync(new URL('../site/dist/management-frame.css',import.meta.url),'utf8');assert.match(css,/\.shop-card \.card-name\{min-height:52px;display:flex;flex-direction:column/);
});
