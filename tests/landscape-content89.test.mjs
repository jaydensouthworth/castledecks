import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
const css=readFileSync(new URL('../site/dist/management-frame.css',import.meta.url),'utf8');
test('Army rows remain content sized and the compact native card grid is not replaced by a vertical flex column',()=>{
 assert.match(css,/#managementFrame #shopPanel \.shop-grid,#managementFrame #queuePanel \.army-roster\{align-items:stretch;grid-auto-rows:max-content\}/);
 assert.match(css,/#managementFrame #queuePanel \.army-contract\{align-self:stretch\}/);
 assert.doesNotMatch(css,/#managementFrame #queuePanel \.army-contract\{[^}]*display:flex/);
});
test('Build reserves both the68px global rail and80px secondary rail without altering its outer bounds',()=>{
 assert.match(css,/#managementFrame>#skillsPanel\{padding-left:148px\}/);
 assert.match(css,/#managementFrame>#skillsPanel>\.panel-head\{margin-left:-148px\}/);
 assert.match(css,/#managementFrame>#skillsPanel>\.deck-workspace-nav\{left:68px;width:80px\}/);
});
test('Build labels grow in real content-sized cells and region metadata wraps without ellipsis',()=>{
 assert.match(css,/grid-template-columns:repeat\(auto-fit,minmax\(min\(92px,100%\),1fr\)\);grid-auto-rows:max-content/);
 assert.match(css,/height:auto;min-height:128px/);
 assert.match(css,/max-height:none;white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:anywhere;font-size:12px/);
 assert.match(css,/\.atlas-regions\{width:144px;grid-template-rows:repeat\(4,max-content\)/);
 assert.match(css,/\.atlas-regions small\{white-space:normal;overflow:visible;text-overflow:clip/);
});
test('Populated Army/Build navigation retains supplied units, bindings, resources and frozen battle',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=demo'}),battle=ui.battle,profile=battle.profile,before={gold:profile.gold,bindings:profile.skills.map(s=>s.binding),tick:battle.tick};
 ui.click('shell-intro-army');assert.ok(ui.get('armyRoster').children.length>=6);
 ui.click('shell-queuePanel-deck');ui.click('shopBuildTab');
 assert.deepEqual(profile.skills.map(s=>s.binding),before.bindings);assert.equal(profile.gold,before.gold);
 ui.click('shell-skillsPanel-army');ui.frames(10);assert.equal(ui.battle,battle);assert.equal(battle.tick,before.tick);
});
test('Skirmish has an explicit shrinking body scroller inside the fixed shared frame',()=>{
 assert.match(css,/#managementFrame #skirmishWorkshopHost\{flex:1;min-height:0;min-width:0;overflow:auto/);
 assert.match(css,/#managementFrame #skirmishReplaceConfirm\{flex:none;min-height:0;max-height:calc\(100% - 44px\);overflow:auto/);
});
test('Narrow legacy Hall and Refine allocate new rows instead of hiding or shrinking long text',()=>{
 assert.match(css,/\.hall-atlas-board \.hub-destinations\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\);height:auto/);
 assert.match(css,/\.ability-filters>button\{flex:1 1 112px;min-width:0;min-height:44px;height:auto;white-space:normal/);
});
test('All-owned supplied kit keeps every contract and long slot name through Build and Army return',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=test'});ui.click('introTesting');ui.click('testUnlock');ui.click('closeTesting');
 const battle=ui.battle,profile=battle.profile,skills=profile.skills.map(s=>[s.id,s.binding,s.rank]);
 ui.click('shell-intro-army');assert.equal(ui.get('armyRoster').children.length,12);
 assert.match(ui.get('armyRoster').textContent,/Heavy Soldiers/);assert.match(ui.get('armyRoster').textContent,/Trebuchet/);
 ui.click('shell-queuePanel-deck');ui.click('shopBuildTab');
 assert.match(ui.get('skillsPanel').textContent,/Basic Arrow/);assert.match(ui.get('skillsPanel').textContent,/Bomb Wave Arrow/);assert.deepEqual(profile.skills.map(s=>[s.id,s.binding,s.rank]),skills);
 ui.click('shell-skillsPanel-army');assert.equal(ui.get('armyRoster').children.length,12);assert.equal(ui.battle,battle);
});
