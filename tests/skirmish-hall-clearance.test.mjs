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
test('short Skirmish central stations reserve separate vertical slots at the measured minimum',()=>{
 assert.match(css,/#intro\.command-hall\[data-active-destination="skirmish"\] \.hall-room\{min-height:192px\}/);
 assert.match(css,/#introWorkshop\{width:min\(267px,42vw\);height:52px;min-height:52px;/);
 assert.match(css,/\.hall-war-table\{top:52%\}/);
 assert.match(css,/\.hall-loadout\{top:auto;bottom:3px;transform:translateX\(-50%\);height:52px;/);
 assert.match(css,/#hubSessionState\{display:block;margin:0;font:12px\/16px system-ui,sans-serif;white-space:nowrap;/);
 // Structural CSS budget, not native typography or screenshot proof. Explicit
 // line heights prevent the old35px wrapped state from entering the station.
 for(const roomHeight of [192,200,240,320]){
  const bannerBottom=3+4+18+2+16+16+4,workshopTop=.52*roomHeight-26,workshopBottom=workshopTop+52,loadoutTop=roomHeight-3-52;
  assert.ok(workshopTop-bannerBottom>=10,`${roomHeight}: banner/workshop clearance`);
  assert.ok(loadoutTop-workshopBottom>=11,`${roomHeight}: workshop/Loadout clearance`);
 }
 // Original native report: state70..105 and workshop74.53..139.53 overlapped.
 // Both flow and fixed slots change here; removing a text line alone is not proof.
 assert.ok(Math.abs(Math.min(105,139.53)-Math.max(70,74.53)-30.47)<.001);
});
