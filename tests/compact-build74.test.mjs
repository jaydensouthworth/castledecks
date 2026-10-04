import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
const css=readFileSync(new URL('../site/dist/game-shell.css',import.meta.url),'utf8');
const markup=readFileSync(new URL('../site/dist/battle.html',import.meta.url),'utf8');
const marker='/* Compact Build owns one collection scroller';
const nextPortrait=css.indexOf('/* Portrait Build uses',css.indexOf(marker));
const compact=css.slice(css.indexOf(marker),nextPortrait<0?undefined:nextPortrait);
// Source/behavior checks only. These do not claim browser-computed pixel sizes.
test('single-scroll correction is bounded to short landscape and follows legacy shell rules',()=>{
 assert.ok(css.indexOf(marker)>css.indexOf('Retire legacy absolute resource/header placement'));
 assert.match(compact,/@media\(max-height:600px\) and \(orientation:landscape\)/);
 assert.equal((compact.match(/@media/g)||[]).length,2);
 assert.match(compact,/@media\(min-width:640px\) and \(max-height:600px\) and \(orientation:landscape\)/);
 assert.doesNotMatch(compact,/!important|display:none|min-height:0.*button/);
});
test('collection owns scrolling while complete card rows and pagination remain in normal flow',()=>{
 assert.match(compact,/\.loadout-inventory\{grid-template-rows:44px max-content 44px;align-content:start;overflow:auto;overscroll-behavior:contain;padding:4px;gap:4px\}/);
 assert.match(compact,/\.loadout-owned-list\{overflow:visible;min-height:0;max-height:none;padding:0\}/);
 assert.match(compact,/\.loadout-pagination\{min-height:44px\}/);
 assert.doesNotMatch(compact,/\.loadout-owned-list\{[^}]*(?:\{|;)height:\d/);
});
test('header resource facts remain visible, read-only and outside the collection height budget',()=>{
 assert.match(compact,/>\.loadout-resources\{position:absolute;left:110px;right:180px;top:0;display:flex;align-items:center;min-height:44px;height:44px;/);
 assert.match(compact,/\.loadout-resources\{[^}]*pointer-events:none/);
 assert.match(markup,/id="skillsResources"/);
 assert.match(compact,/\.loadout-refine-sheet\{top:49px;max-height:calc\(100% - 53px\)\}/);
});
test('the new collection scroll owner participates in existing drag edge scrolling',()=>{
 assert.match(markup,/<section class="loadout-inventory" aria-labelledby="inventoryTitle" data-loadout-scroll>/);
 assert.match(markup,/<div id="ownedSkillList"[^>]*data-loadout-scroll/);
 assert.match(markup,/<section class="loadout-placement"[^>]*data-loadout-scroll/);
});
async function editor(t){const ui=await loadGameUI(t,{search:'?mode=test'});ui.click('introTesting');ui.click('testUnlock');ui.click('closeTesting');ui.click('introLoadout');ui.window.innerWidth=740;ui.window.innerHeight=320;ui.dispatch(ui.window,'resize');ui.frames();return ui;}
test('search resets the whole collection scroller and nested legacy offset without changing ownership',async t=>{
 const ui=await editor(t),inventory=ui.get('skillsPanel').querySelector('.loadout-inventory'),list=ui.get('ownedSkillList'),before=ui.battle.profile.skills.map(s=>[s.id,s.binding,s.rank]);inventory.scrollTop=950;list.scrollTop=35;
 ui.get('loadoutSearch').value='priest';ui.dispatch(ui.get('loadoutSearch'),'input');assert.equal(inventory.scrollTop,0);assert.equal(list.scrollTop,0);assert.equal(ui.document.activeElement,ui.get('loadoutSearch'));assert.ok(ui.get('owned-priest'));assert.equal(list.querySelectorAll('article').length,1);assert.deepEqual(ui.battle.profile.skills.map(s=>[s.id,s.binding,s.rank]),before);
});
test('paging resets collection scroll and focuses a real first card with all25 owned cards reachable',async t=>{
 const ui=await editor(t),inventory=ui.get('skillsPanel').querySelector('.loadout-inventory'),bindings=ui.battle.profile.skills.map(s=>s.binding);inventory.scrollTop=1700;ui.click('loadoutNext');assert.equal(inventory.scrollTop,0);assert.match(ui.get('loadoutPageLabel').textContent,/Page 2 of 3/);assert.match(ui.document.activeElement.id,/^owned-/);assert.equal(ui.get('ownedSkillList').querySelectorAll('article').length,12);inventory.scrollTop=1700;ui.click('loadoutNext');assert.equal(inventory.scrollTop,0);assert.equal(ui.get('ownedSkillList').querySelectorAll('article').length,1);assert.equal(ui.get('loadoutNext').disabled,true);assert.deepEqual(ui.battle.profile.skills.map(s=>s.binding),bindings);
});
test('inspect and castle rerender preserve the same whole-collection scroll owner',async t=>{
 const ui=await editor(t),inventory=ui.get('skillsPanel').querySelector('.loadout-inventory'),gold=ui.battle.profile.gold;inventory.scrollTop=500;ui.click('loadout-inspect-arrow');assert.equal(ui.visible('loadoutInspector'),true);ui.click('loadoutCloseInspector');assert.equal(ui.get('skillsPanel').querySelector('.loadout-inventory'),inventory);assert.equal(inventory.scrollTop,500);ui.get('loadoutCompanionSection').open=true;ui.click('castleEquip-classic');assert.equal(inventory.scrollTop,500);assert.equal(ui.battle.profile.gold,gold);
});
