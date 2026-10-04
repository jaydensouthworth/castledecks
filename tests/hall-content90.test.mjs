import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
const css=readFileSync(new URL('../site/dist/management-frame.css',import.meta.url),'utf8');
test('Hall deck header bounds legal long names and keeps the full count and action within its own rows',()=>{
 assert.match(css,/\.hall-deck-workbench>header\{display:grid;grid-template-columns:minmax\(0,1fr\) auto/);
 assert.match(css,/\.hall-deck-workbench>header>div\{min-width:0\}/);
 assert.match(css,/\.hall-deck-workbench h3\{min-width:0;max-width:100%;white-space:normal;overflow-wrap:anywhere\}/);
 assert.match(css,/#hallDeckCount\{grid-column:1\/-1;grid-row:2/);
});
test('Hall cards own an explicit scrolling row and uncropped natural-height title bands',()=>{
 assert.match(css,/\.hall-card-spread\{[^}]*overflow-x:auto;overflow-y:hidden/);
 assert.match(css,/\.hall-playing-card\{flex:0 0 84px;width:84px;min-width:84px;height:auto;min-height:120px/);
 assert.match(css,/\.hall-playing-card>span:not\(\.card-portrait\)\{[^}]*max-height:none;overflow:visible;white-space:normal;overflow-wrap:anywhere;font-size:12px/);
});
test('Hall populated card inspection remains read-only and returns focus with full authored names',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=demo'}),battle=ui.battle,profile=battle.profile;
 const before={gold:profile.gold,bindings:profile.skills.map(s=>[s.id,s.binding,s.rank]),tick:battle.tick};
 const cards=ui.get('hallDeckCards').querySelectorAll('[data-hall-card]');assert.ok(cards.length>1);
 const target=cards.find(c=>c.getAttribute('data-hall-card')==='fireArrow')??cards[0];target.click();
 assert.equal(ui.visible('hallCardInspect'),true);assert.ok(ui.get('hallCardInspectTitle').textContent.length>0);
 ui.click('hallCloseCard');assert.equal(ui.visible('hallCardInspect'),false);assert.equal(ui.document.activeElement,target);
 assert.equal(ui.battle,battle);assert.equal(profile.gold,before.gold);assert.equal(battle.tick,before.tick);assert.deepEqual(profile.skills.map(s=>[s.id,s.binding,s.rank]),before.bindings);
});
