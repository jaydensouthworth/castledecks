import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
import {CONTROL_STORAGE_KEY,DEFAULT_CONTROL_BINDINGS} from '../site/dist/control-bindings.mjs';
import {MemoryStorage} from './helpers/local-storage.mjs';

test('coach resets scroll for a new or restarted drill and preserves scrolling within a drill',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=test&guide=1'}),coach=ui.get('trainingCoach');ui.click('start');ui.frames();assert.equal(coach.scrollTop,0);
 coach.scrollTop=74;ui.frames(3);assert.equal(coach.scrollTop,74);ui.click('battlePause');ui.frames();ui.click('resumeGame');ui.frames();assert.equal(coach.scrollTop,74);
 ui.click('trainingSkip');ui.frames();assert.equal(ui.battle.guidedTraining.run.index,1);assert.equal(coach.scrollTop,0);coach.scrollTop=63;ui.click('liveArc');ui.frames();assert.equal(coach.scrollTop,63);
 ui.click('trainingRestart');ui.frames();assert.equal(ui.battle.guidedTraining.run.index,1);assert.equal(coach.scrollTop,0);
 for(let i=1;i<5;i++){ui.click('trainingSkip');ui.frames();}assert.equal(ui.battle.guidedTraining.run.index,5);coach.scrollTop=91;ui.click('trainingLoadout');ui.click('closeSkills');ui.frames();assert.equal(coach.scrollTop,91);assert.equal(ui.get('trainingExit').textContent,'Finish practice');
});

for(const method of ['pointer','aim help'])test(`High arc completion repaints on its real hit without Pause through ${method}`,async t=>{
 const storage=new MemoryStorage();storage.data.set(CONTROL_STORAGE_KEY,JSON.stringify({version:1,bindings:{...DEFAULT_CONTROL_BINDINGS,arc:'j'}}));
 const ui=await loadGameUI(t,{search:'?mode=test&guide=1',storage});ui.click('start');ui.frames();ui.click('trainingSkip');ui.frames();const b=ui.battle,coach=ui.get('trainingCoach');ui.key('keydown','j',{code:'KeyJ'});ui.key('keyup','j',{code:'KeyJ'});ui.frames();assert.equal(b.shooter.angleMode,0);assert.match(ui.get('trainingInstruction').textContent,/J on keyboard/);coach.scrollTop=53;
 if(method==='pointer'){const point=b.guidedTraining.targetPoint();ui.pointer('pointerdown',88,point);ui.pointer('pointerup',88,point);}else ui.click('trainingAssist');
 let frames=0;while(!b.guidedTraining.complete&&frames++<500)ui.frames();
 assert.equal(b.guidedTraining.complete,true);assert.equal(b.paused,false);assert.equal(ui.visible('pauseOverlay'),false);assert.equal(ui.visible('trainingNext'),true);assert.match(ui.get('trainingInstruction').textContent,/High arc landed/);assert.match(ui.get('trainingFeedback').textContent,/Drill complete/);assert.equal(coach.scrollTop,53);assert.ok(b.profile.gold>600);assert.equal(b.profile.victories,0);
});

test('only live coach Loadout entry labels its actual return as guided practice',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=test&guide=1'});ui.click('start');ui.frames();for(let i=0;i<5;i++){ui.click('trainingSkip');ui.frames();}
 ui.click('trainingLoadout');assert.equal(ui.get('closeSkills').textContent,'Back to guided practice');assert.equal(ui.get('closeSkills').getAttribute('aria-label'),'Back to guided practice');ui.click('closeSkills');ui.frames();assert.equal(ui.battle.paused,false);assert.equal(ui.visible('trainingCoach'),true);
 ui.click('battlePause');ui.click('pauseSkills');assert.equal(ui.get('closeSkills').textContent,'Back to Pause');ui.click('closeSkills');ui.frames();assert.equal(ui.battle.paused,true);assert.equal(ui.visible('pauseOverlay'),true);
 ui.click('pauseLobby');ui.click('introLoadout');assert.equal(ui.get('closeSkills').textContent,'Back to lobby');ui.click('closeSkills');assert.equal(ui.visible('intro'),true);assert.equal(ui.battle.paused,true);
});
