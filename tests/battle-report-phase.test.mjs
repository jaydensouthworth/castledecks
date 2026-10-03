import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattleReportRecorder,formatBattleReport} from '../site/dist/battle-report.mjs';
import {CampaignBattle} from '../site/dist/engine/first-battle.mjs';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
const reportText=ui=>ui.get('battleReportText').value;

test('diagnostic phase is an explicit allowlisted fact, independent of the raw paused flag',()=>{
 const b=new CampaignBattle(),recorder=createBattleReportRecorder();
 for(const phase of ['preparation','paused','running','settling','settled']){
  b.paused=phase==='running';const snapshot=recorder.snapshot(b,{build:'50',mode:'training',phase});
  assert.equal(snapshot.phase,phase);assert.match(formatBattleReport(snapshot),new RegExp(` \\| ${phase} \\| `));
 }
});
test('missing or unrecognized phase stays unknown and never leaks arbitrary context text',()=>{
 const b=new CampaignBattle(),recorder=createBattleReportRecorder();
 for(const phase of [undefined,null,'PRIVATE_PHASE',{},'RUNNING']){
  const snapshot=recorder.snapshot(b,{build:'50',mode:'training',phase});assert.equal(snapshot.phase,'unknown');assert.ok(!formatBattleReport(snapshot).includes('PRIVATE_PHASE'));
 }
});
for(const [name,search]of [['campaign',''],['Training','?mode=test']])test(`${name} report says preparation before Start without changing the clock or raw paused flag`,async t=>{
 const ui=await loadGameUI(t,{search}),b=ui.battle,paused=b.paused;assert.equal(b.tick,0);ui.click('introBattleReport');
 assert.match(reportText(ui),/ \| preparation \| unsettled/);assert.doesNotMatch(reportText(ui),/ \| running \|/);ui.frames(4);
 assert.equal(b.tick,0);assert.equal(b.paused,paused);ui.click('closeBattleReport');assert.equal(ui.visible('intro'),true);assert.equal(b.tick,0);
});
test('report says paused after Start and keeps that battlefield paused when closed',async t=>{
 const ui=await loadGameUI(t);ui.click('start');ui.frames(2);ui.click('battlePause');const tick=ui.battle.tick;ui.click('pauseBattleReport');
 assert.match(reportText(ui),/ \| paused \| unsettled/);ui.frames(3);assert.equal(ui.battle.tick,tick);ui.click('closeBattleReport');assert.equal(ui.battle.paused,true);
});
test('outcome-pending and completed result reports distinguish settling from settled',async t=>{
 const ui=await loadGameUI(t);ui.click('start');const b=ui.battle;b.finishOutcome('defeat');ui.click('pauseBattleReport');
 assert.equal(b.summary,null);assert.match(reportText(ui),/ \| settling \| defeat/);ui.click('closeBattleReport');ui.frames(150);assert.ok(b.summary);
 ui.click('endingLobby');ui.click('introBattleReport');assert.match(reportText(ui),/ \| settled \| defeat/);const tick=b.tick;ui.frames(3);assert.equal(b.tick,tick);
});
test('same-tab Training preparation remains preparation after leaving a paused campaign',async t=>{
 const ui=await loadGameUI(t);ui.click('start');ui.frames(2);ui.click('battlePause');ui.click('pauseLobby');const campaign=ui.battle,tick=campaign.tick;
 ui.get('hubDestinations').querySelector('[data-hub-destination="training"]').click();ui.click('start');if(ui.visible('switchSessionConfirm'))ui.click('confirmSessionSwitch');ui.frames();ui.click('introBattleReport');
 assert.match(reportText(ui),/ \| training \|/);assert.match(reportText(ui),/ \| preparation \| unsettled/);assert.equal(ui.battle.tick,0);assert.equal(campaign.tick,tick);assert.equal(campaign.paused,true);
});
