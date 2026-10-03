import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
import {serializeProfile} from '../site/dist/engine/progression.mjs';

test('Army explains contract survival visibly and distinguishes per-battle reserve from spent gold',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=demo'});ui.click('introArmy');
 const panel=ui.get('queuePanel'),rules=panel.querySelector('.army-rules');
 assert.match(panel.querySelector('.army-roster-caption').textContent,/Contracts &(?:amp;)? ranks survive defeat/);
 assert.match(ui.get('queueStatus').textContent,/Contracts and ranks survive defeat/);
 assert.ok(panel.querySelector('.army-roster-caption').getClientRects().length);
 assert.match(rules.textContent,/Reserve is supplied again for each new battle or retry, according to its campaign or practice kit/);
 assert.match(rules.textContent,/Gold spent on squads is not returned/);
 ui.click('army-card-grunt');assert.equal(ui.visible('armyInspector'),true);
 assert.match(ui.get('armyRecruitRule').textContent,/Owned contracts and ranks survive defeat/);
 assert.match(ui.get('armyRecruitRule').textContent,/Reserve refills for each new battle or retry; spent gold is not returned/);
 const copy=ui.get('armyRecruitRule').textContent;ui.click('armyInspectAuto');assert.equal(ui.get('armyRecruitRule').textContent,copy);ui.click('armyCloseInspector');ui.click('army-card-grunt');assert.equal(ui.get('armyRecruitRule').textContent,copy);
 assert.ok(ui.get('armyRecruitRule').getClientRects().length);
});

test('opening and reading continuity guidance has no economy, queue, save, or battle-time mutation',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=demo'}),b=ui.battle,before=serializeProfile(b.profile),reserve=b.friendlyQueue.population,tick=b.tick,queue=[...b.friendlyQueue.queue];
 for(let i=0;i<5;i++){ui.click('introArmy');ui.click('army-card-grunt');ui.click('armyCloseInspector');ui.click('closeQueue');}
 assert.equal(serializeProfile(b.profile),before);assert.equal(b.friendlyQueue.population,reserve);assert.deepEqual(b.friendlyQueue.queue,queue);assert.equal(b.tick,tick);
});

test('an old queued receipt clears after battle time advances, without refunding or changing paid recruits',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=skirmish'});ui.click('skirmishPrepare');ui.click('start');ui.frames(2);ui.click('battlePause');ui.click('pauseQueue');
 ui.click('army-card-grunt');ui.click('armyRecruit');assert.match(ui.get('queueStatus').textContent,/4 queued/);assert.equal(ui.battle.profile.gold,1180);
 ui.click('armyCloseInspector');ui.click('closeQueue');ui.click('resumeGame');ui.frames(150);ui.click('battlePause');ui.click('pauseQueue');
 assert.doesNotMatch(ui.get('queueStatus').textContent,/queued|Deploys after Resume/);assert.match(ui.get('queueStatus').textContent,/Contracts and ranks survive defeat/);
 assert.equal(ui.battle.profile.gold,1180);assert.equal(ui.battle.friendlyQueue.population,66);assert.equal(ui.battle.friendlyQueue.queue.length,0);
});
