import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
const css=readFileSync(new URL('../site/dist/game-shell.css',import.meta.url),'utf8'),portrait=css.slice(css.indexOf('/* Portrait Build uses'),css.indexOf('/* The same secondary Deck navigation'));
// Structural cascade guards and actual UI callbacks; native painting is separate.
test('portrait compact cards are scoped to Build at620px and preserve the independent placement grid',()=>{
 assert.match(portrait,/@media\(max-width:620px\) and \(orientation:portrait\)/);assert.equal((portrait.match(/@media/g)||[]).length,2);assert.doesNotMatch(portrait,/#shopPanel|\.shop-card|\.loadout-placement\{/);
 assert.match(css,/grid-template-rows:minmax\(0,\.65fr\) minmax\(0,1fr\)/);
});
test('portrait collection scrolls whole card rows with real44px controls and narrow-safe columns',()=>{
 assert.match(portrait,/grid-template-rows:44px max-content 44px;align-content:start;overflow:auto;overscroll-behavior:contain/);
 assert.match(portrait,/grid-template-columns:repeat\(auto-fit,minmax\(min\(260px,100%\),1fr\)\);overflow:visible/);
 assert.match(portrait,/\.loadout-card-tools>button[^}]*height:44px;min-height:44px/);assert.match(portrait,/\.loadout-pagination[^}]*min-height:44px/);
});
test('compact portrait preserves artwork, tactical title, rank, binding and every supplied card fact',()=>{
 assert.match(portrait,/\.loadout-card-art\{grid-column:1;grid-row:1\/4;width:52px;height:54px/);
 assert.match(portrait,/\.loadout-card-select strong\{grid-column:2;grid-row:2;font-size:17px;line-height:18px/);
 assert.match(portrait,/\.loadout-card-facts\{display:flex;flex-wrap:wrap/);assert.match(portrait,/\.loadout-unit-deployment>span:first-child\{display:flex\}/);
 assert.doesNotMatch(portrait,/display:none|visibility:hidden|opacity:0/);
});
test('short header reserves space for the longest current return label and allows factual wrapping',()=>{
 assert.match(css,/>\.loadout-resources\{position:absolute;left:110px;right:180px;/);
 assert.match(css,/line-height:1.3;white-space:normal;text-overflow:clip;overflow:visible;box-sizing:border-box;pointer-events:none/);
});
async function editor(t,width,height){const ui=await loadGameUI(t,{search:'?mode=test'});ui.click('introTesting');ui.click('testUnlock');ui.click('closeTesting');ui.click('introLoadout');ui.window.innerWidth=width;ui.window.innerHeight=height;ui.dispatch(ui.window,'resize');ui.frames();return ui;}
for(const [width,height] of [[360,640],[412,780]])test(`portrait${width}x${height} search, pagination and inspection preserve paid facts and profile`,async t=>{
 const ui=await editor(t,width,height),p=ui.battle.profile,before=p.skills.map(s=>[s.id,s.rank,s.binding]),inv=ui.get('skillsPanel').querySelector('.loadout-inventory');inv.scrollTop=1000;ui.click('loadoutNext');assert.equal(inv.scrollTop,0);assert.match(ui.get('loadoutPageLabel').textContent,/Page 2 of 3/);
 ui.get('loadoutSearch').value='Horse';ui.dispatch(ui.get('loadoutSearch'),'input');assert.equal(inv.scrollTop,0);assert.ok(ui.get('owned-mount'));assert.match(ui.get('owned-mount').textContent,/4 units/);assert.match(ui.get('owned-mount').textContent,/30 gold.*4 reserve/);
 inv.scrollTop=40;ui.click('loadout-inspect-mount');assert.match(ui.get('loadoutInspectorFacts').textContent,/4 units/);ui.click('loadoutCloseInspector');assert.equal(inv.scrollTop,40);assert.equal(ui.document.activeElement,ui.get('loadout-inspect-mount'));assert.deepEqual(p.skills.map(s=>[s.id,s.rank,s.binding]),before);
});
test('rotation keeps both scroll owner nodes and the selected card without modifying the loadout',async t=>{
 const ui=await editor(t,360,640),inv=ui.get('skillsPanel').querySelector('.loadout-inventory'),place=ui.get('skillsPanel').querySelector('.loadout-placement');ui.click('owned-fireArrow');inv.scrollTop=240;place.scrollTop=120;const before=ui.battle.profile.skills.map(s=>s.binding);
 for(const [width,height]of [[740,320],[412,780],[915,360],[360,640]]){ui.window.innerWidth=width;ui.window.innerHeight=height;ui.dispatch(ui.window,'resize');ui.frames();assert.equal(ui.get('skillsPanel').querySelector('.loadout-inventory'),inv);assert.equal(ui.get('skillsPanel').querySelector('.loadout-placement'),place);assert.equal(ui.get('owned-fireArrow').getAttribute('aria-pressed'),'true');assert.deepEqual(ui.battle.profile.skills.map(s=>s.binding),before);}
});

test('final portrait grid rule overrides positive minima so neither scroller can extend under the footer',()=>{
 const rules=[...css.matchAll(/#skillsPanel\.game-management \.loadout-workspace\{([^}]*)\}/g)];assert.ok(rules.length>1);
 assert.equal(rules.at(-1)[1],'grid-template-rows:minmax(0,.65fr) minmax(0,1fr)');
 const tail=css.slice(css.lastIndexOf('/* The portrait grid must fit'));assert.match(tail,/@media\(max-width:620px\) and \(orientation:portrait\)/);assert.doesNotMatch(tail,/minmax\([1-9]\d*px/);
 // Structural fractional-budget arithmetic, not a rendering measurement.
 for(const available of [358,375,510,517]){const placement=available*.65/1.65,inventory=available/1.65;assert.ok(Math.abs(placement+inventory-available)<1e-9);assert.ok(placement>44&&inventory>44);}
});
