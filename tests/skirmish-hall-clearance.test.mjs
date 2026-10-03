import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
const css=await readFile(new URL('../site/dist/skirmish.css',import.meta.url),'utf8');
test('hall station names the actual prepared field while the workshop retains its canonical copy code',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=skirmish'});ui.click('skirmishPrepare');const scenario=ui.battle.skirmish;
 assert.equal(ui.get('hubSkirmishProgress').textContent,`${scenario.name} · ${scenario.encounter.roster.length} enemies`);
 assert.equal(ui.get('hubSessionState').textContent,'Practice ready');assert.ok(!ui.get('introWorkshop').textContent.includes(scenario.code));
 ui.click('introWorkshop');assert.equal(ui.get('skirmishCode').value,scenario.code);ui.click('skirmishCancel');ui.click('start');ui.frames();ui.click('battlePause');ui.click('pauseLobby');assert.equal(ui.get('hubSessionState').textContent,'Practice paused');
});
test('Skirmish uses shared flow stations and separately scrollable orders without obsolete absolute slots',async()=>{
 assert.doesNotMatch(css,/data-active-destination="skirmish"/);
 const hall=await readFile(new URL('../site/dist/command-hall.css',import.meta.url),'utf8');
 assert.match(hall,/\.hall-orders-scroll\{[^}]*overflow:auto/);
 assert.match(hall,/\.hall-launch\{[^}]*flex:none/);
 assert.match(hall,/\.hall-station\{position:static/);
 const html=await readFile(new URL('../site/dist/battle.html',import.meta.url),'utf8');
 assert.match(html,/class="hall-orders-scroll"/);
 assert.match(html,/id="introWorkshop" class="hall-map-control hidden"/);
 // Structural ownership only: native layout/overlap is verified separately.
});
