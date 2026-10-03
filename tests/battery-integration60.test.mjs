import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
import {DEFAULT_SKIRMISH,encodeSkirmishDescriptor} from '../site/dist/skirmish-model.mjs';
import {BATTERY_BRIEF} from '../site/dist/objective-feedback.mjs';
import {FLAG_STATUS as FS} from '../site/dist/engine/flag-troop.mjs';
const search='?mode=skirmish&sk='+encodeURIComponent(encodeSkirmishDescriptor({...DEFAULT_SKIRMISH,seed:42,doctrine:'battery'}));

test('battery preparation and existing HUD agree on marked objective without advancing simulation',async t=>{
 const ui=await loadGameUI(t,{search});ui.click('skirmishPrepare');ui.frames();
 assert.equal(ui.battle.tick,0);assert.equal(ui.battle.badTeam.length,6);assert.equal(ui.battle.profile.gold,1200);
 assert.equal(ui.get('hallOrderObjective').textContent,BATTERY_BRIEF.goal);
 assert.match(ui.get('hallOrderAdvice').textContent,/finite company/);
 assert.equal(ui.get('combatBattleTitle').textContent,'Battery · 0/2');
 assert.equal(ui.get('viewStatus').textContent,'Battery 0/2 · Silence both guns');
 assert.equal(ui.visible('batteryObjectiveBrief'),true);
});
test('actual UI distinguishes partial progress, flag recovery and settled victory; retry resets original targets',async t=>{
 const ui=await loadGameUI(t,{search});ui.click('skirmishPrepare');ui.click('start');ui.frames(2);const b=ui.battle,targets=b.badTeam.filter(u=>u.type==='trebuchet');
 targets[0].takeDamage(targets[0].hp);ui.frames(2);
 assert.equal(ui.get('combatBattleTitle').textContent,'Battery · 1/2');
 b.ownFlag.status=FS.GROUNDED;b.ownFlag.x=1400;targets[1].takeDamage(targets[1].hp);ui.frames(2);
 assert.equal(b.outcome,null);assert.equal(ui.get('combatEnemyState').textContent,'Recover home flag');
 b.ownFlag.status=FS.AT_BASE;ui.frames(110);
 assert.equal(b.summary.outcome,'victory');assert.equal(ui.get('endingTitle').textContent,'Battery · Battery cleared');
 assert.match(ui.get('endingText').textContent,/2\/2 marked engines resolved\. Home flag safe\./);
 ui.click('replay');ui.frames();assert.notEqual(ui.battle,b);assert.equal(ui.battle.tick,0);assert.equal(ui.battle.objectiveProgress.resolved,0);assert.equal(ui.battle.profile.gold,1200);
});
test('ordinary skirmish retains existing preparation and hides objective-only paragraph',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=skirmish'});ui.frames();
 assert.match(ui.get('hallOrderObjective').textContent,/Defeat the company or bring the enemy flag home/);
 assert.equal(ui.visible('batteryObjectiveBrief'),false);assert.equal(ui.get('batteryObjectiveBrief').textContent,'');
});
