import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../site/dist/'+name,import.meta.url),'utf8');
test('Crownroad preserves the authored 1200 by 360 world in every outer frame',()=>{
 const css=read('campaign-atlas.css'),source=read('campaign-atlas.mjs');
 assert.match(css,/#managementFrame #campaignPanel \.atlas-map-world\{flex:0 0 1200px;width:1200px;height:360px;min-height:360px;margin:auto\}/);
 assert.match(source,/viewBox="0 0 1200 360" preserveAspectRatio="xMidYMid meet"/);
 assert.match(source,/viewBox="0 0 600 145" preserveAspectRatio="xMidYMid meet"/);
 assert.match(css,/\.atlas-terrain svg\{display:block;width:100%;height:auto;aspect-ratio:600\/145\}/);
});
test('desktop Charter and Skirmish compose their content without changing the common frame',()=>{
 assert.match(read('expedition.css'),/\.charter-map\{flex:0 0 auto;width:min\(100%,1200px\);height:auto;min-height:0;aspect-ratio:30\/11/);
 assert.match(read('skirmish.css'),/grid-template-columns:300px minmax\(0,1fr\);gap:32px;align-items:start/);
});
test('Hall scout separates company selection from full counterplay and card review',()=>{
 const html=read('battle.html'),css=read('hall-home.css');
 assert.match(html,/class="hall-scout-workspace"/);assert.match(html,/class="hall-scout-reading" aria-labelledby="hallScoutName"/);
 assert.match(html,/Counterplay<\/p><p id="hallScoutCounter"/);assert.match(html,/A card to consider<\/p><p id="hallScoutCard"/);
 assert.match(css,/\.hall-scout-workspace\{display:grid;grid-template-columns:minmax\(132px,\.7fr\) minmax\(0,1\.5fr\)/);
 assert.match(css,/\.hall-scout-roster button\{display:flex;justify-content:space-between/);
});
test('Catalog departments retain a separate count column and responsive text width',()=>{
 const css=read('deck-composition.css');
 assert.match(css,/grid-template-columns:190px minmax\(0,1fr\) 210px/);
 assert.match(css,/#shopDepartmentRail>button\{display:grid;grid-template-columns:minmax\(0,1fr\) auto;[^}]*white-space:normal;overflow-wrap:anywhere/);
 assert.match(css,/#shopDepartmentRail>button>span\{min-width:2ch;justify-self:end;white-space:nowrap/);
});
test('expanded scout uses the full reading area and an allocated roster column',()=>{
 const css=read('hall-home.css');
 assert.match(css,/\.hall-home-grid:has\(#hallScout\[open\]\)\{grid-template-columns:minmax\(0,1fr\)\}/);
 assert.match(css,/\.hall-scout-workspace\{grid-template-columns:minmax\(160px,220px\) minmax\(0,1fr\);max-width:1080px/);
});
