import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
import {MemoryStorage} from './helpers/local-storage.mjs';
import {CONTROL_STORAGE_KEY} from '../site/dist/control-bindings.mjs';
const select=(ui,id)=>ui.get('hubDestinations').querySelector(`[data-hub-destination="${id}"]`).click();
const switchTo=(ui,id)=>{select(ui,id);ui.click('start');if(ui.visible('switchSessionConfirm'))ui.click('confirmSessionSwitch');ui.frames();};
const hub=ui=>{ui.click('battlePause');ui.click('pauseLobby');ui.frames();};
const snapshot=b=>JSON.stringify({profile:b.profile,tick:b.tick,stats:b.stats,level:b.level,queue:b.friendlyQueue.queue,reserve:b.friendlyQueue.population,good:b.goodTeam.map(u=>[u.id,u.type,u.x,u.y,u.hp]),bad:b.badTeam.map(u=>[u.id,u.type,u.x,u.y,u.hp]),shots:b.projectiles.map(p=>[p.x,p.y,p.vx,p.vy]),training:b.guidedTraining?.snapshot,outcome:b.outcome,summary:b.summary});
const campaignBytes=storage=>[...storage.data].filter(([key])=>key.startsWith('castledecks:campaign:'));
const released=b=>{for(const key of ['left','right','up','down','space','mouseDown'])assert.equal(b.input[key],false,key);assert.equal(b.playerShots.length,0);assert.deepEqual(b.input.digits,[]);};
function remap(ui){ui.click('introSettings');ui.click('openControls');for(const [action,key]of [['arc','j'],['companion','h'],['right','l'],['pause','o'],['activate','k']]){ui.click('control-'+action);ui.key('keydown',key);}ui.click('applyControls');ui.click('closeSettings');}

test('47 guided Training, original playground and Skirmish retain independent exact paused identities',async t=>{
 const storage=new MemoryStorage(),ui=await loadGameUI(t,{search:'?mode=test',storage}),playground=ui.battle;
 playground.profile.gold=713;ui.click('start');ui.frames(4);hub(ui);const playgroundBefore=snapshot(playground);
 ui.click('introGuidedTraining');ui.click('start');ui.frames(3);ui.click('trainingSkip');ui.frames(3);hub(ui);remap(ui);
 const drill=ui.battle,controller=drill.guidedTraining,run=controller.run,before=snapshot(drill);assert.equal(controller.lesson.id,'arc');assert.deepEqual([...run.skipped],['aim']);const saveBytes=campaignBytes(storage);
 switchTo(ui,'skirmish');assert.equal(ui.visible('skirmishPanel'),true);ui.get('skirmishSeed').value='384';ui.click('skirmishPrepare');const practice=ui.battle;assert.equal(practice.guidedTraining,undefined);assert.equal(practice.testing,false);assert.equal(practice.protectedTesting,false);assert.equal(practice.profile.gold,1200);assert.equal(practice.friendlyQueue.population,70);assert.equal(ui.get('aimMode').disabled,false);assert.equal(ui.get('difficulty').disabled,true);assert.equal(ui.get('gameShell').dataset.guidedTraining,'false');
 ui.click('start');ui.frames(6);hub(ui);const practiceBefore=snapshot(practice);
 for(let n=0;n<2;n++){switchTo(ui,'training');assert.equal(ui.battle,drill);assert.equal(ui.battle.guidedTraining,controller);assert.equal(controller.run,run);assert.equal(snapshot(drill),before);assert.equal(ui.get('aimMode').disabled,true);assert.equal(ui.get('introProfiles').disabled,true);assert.equal(ui.get('gameShell').dataset.guidedTraining,'true');assert.match(ui.get('start').textContent,/Resume guided/);assert.match(ui.get('pauseControlsReference').textContent,/H commands.*J switches/);released(drill);switchTo(ui,'skirmish');assert.equal(ui.battle,practice);assert.equal(snapshot(practice),practiceBefore);assert.equal(ui.get('aimMode').disabled,false);released(practice);}
 switchTo(ui,'training');ui.click('introExitTraining');ui.frames(4);assert.equal(ui.battle,playground);assert.equal(snapshot(playground),playgroundBefore);assert.equal(ui.get('introProfiles').disabled,false);assert.equal(ui.visible('introTesting'),true);assert.deepEqual(campaignBytes(storage),saveBytes);assert.equal(JSON.parse(storage.getItem(CONTROL_STORAGE_KEY)).bindings.arc,'j');
});

test('47 guided Training through Skirmish keeps the original campaign or charter return destination',async t=>{
 for(const origin of ['campaign','expedition'])await t.test(origin,async t=>{
  const storage=new MemoryStorage(),ui=await loadGameUI(t,{storage});if(origin==='expedition')switchTo(ui,origin);ui.click('start');ui.frames(4);hub(ui);await ui.settle();const original=ui.battle,before=snapshot(original),slots=campaignBytes(storage);
  select(ui,'training');ui.click('introGuidedTraining');if(ui.visible('switchSessionConfirm'))ui.click('confirmSessionSwitch');ui.frames();const drill=ui.battle;assert.ok(drill.guidedTraining);ui.click('start');ui.frames(3);hub(ui);const drillBefore=snapshot(drill);
  switchTo(ui,'skirmish');ui.click('skirmishPrepare');ui.click('start');ui.frames(4);hub(ui);const practice=ui.battle,practiceBefore=snapshot(practice);switchTo(ui,'training');assert.equal(ui.battle,drill);assert.equal(snapshot(drill),drillBefore);ui.click('introExitTraining');ui.frames(3);assert.equal(ui.battle,original);assert.equal(snapshot(original),before);assert.equal(ui.get('intro').getAttribute('data-active-destination'),origin);assert.equal(ui.get('gameShell').dataset.guidedTraining,'false');await ui.settle();assert.deepEqual(campaignBytes(storage),slots);
  switchTo(ui,'skirmish');assert.equal(ui.battle,practice);assert.equal(snapshot(practice),practiceBefore);assert.deepEqual(campaignBytes(storage),slots);
 });
});

test('47 Skirmish-origin guided exit retains seed, controls, paused battle and fresh retry input labels',async t=>{
 const storage=new MemoryStorage(),ui=await loadGameUI(t,{search:'?mode=skirmish',storage});ui.click('skirmishPrepare');ui.click('introSettings');ui.get('aimMode').value='auto_aim';ui.click('applySettings');ui.click('start');ui.frames(3);hub(ui);const practice=ui.battle,before=snapshot(practice),code=practice.skirmish.code;
 select(ui,'training');ui.click('introGuidedTraining');if(ui.visible('switchSessionConfirm'))ui.click('confirmSessionSwitch');ui.frames();remap(ui);ui.click('start');ui.frames();ui.click('trainingSkip');ui.frames();assert.match(ui.get('trainingInstruction').textContent,/J on keyboard/);hub(ui);ui.click('introExitTraining');ui.frames(2);
 assert.equal(ui.battle,practice);assert.equal(snapshot(practice),before);assert.equal(practice.skirmish.code,code);assert.equal(ui.get('difficulty').disabled,true);assert.match(ui.get('pauseControlsReference').textContent,/L move|A \/ L move/);assert.match(ui.get('pauseControlsReference').textContent,/H commands.*J switches.*O or Escape/);assert.match(ui.get('liveArc').getAttribute('aria-label'),/Shortcut J/);
 ui.click('start');const arc=practice.shooter.angleMode;ui.key('keydown','v');assert.equal(practice.shooter.angleMode,arc);ui.key('keydown','j');assert.notEqual(practice.shooter.angleMode,arc);ui.key('keydown','l',{code:'KeyL'});assert.equal(practice.input.right,true);ui.key('keyup','l',{code:'KeyL'});ui.key('keydown','o');assert.equal(practice.paused,true);released(practice);
 ui.click('battleRestart');ui.click('confirmRestart');ui.frames();assert.notEqual(ui.battle,practice);assert.equal(ui.battle.skirmish.code,code);assert.match(ui.get('liveArc').getAttribute('aria-label'),/Shortcut J/);assert.match(ui.get('pauseControlsReference').textContent,/H commands.*J switches/);ui.key('keydown','l',{code:'KeyL'});assert.equal(ui.battle.input.right,true);ui.key('keyup','l',{code:'KeyL'});assert.equal(campaignBytes(storage).length,0);
});

test('47 Controls capture and modified shortcuts remain isolated from the frozen seed workshop',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=skirmish'});ui.click('skirmishPrepare');remap(ui);const b=ui.battle,before=snapshot(b);ui.click('introWorkshop');ui.get('skirmishSeed').focus();for(const key of ['o','j','h','l','k'])ui.key('keydown',key);ui.frames(4);assert.equal(snapshot(b),before);assert.equal(ui.visible('skirmishPanel'),true);ui.key('keydown','Escape',{ctrlKey:true});assert.equal(ui.visible('skirmishPanel'),true);ui.key('keydown','Escape');assert.equal(ui.visible('skirmishPanel'),false);ui.click('introSettings');ui.click('openControls');ui.click('control-arc');ui.key('keydown','Escape');assert.equal(ui.visible('controlsPanel'),true);ui.key('keydown','Escape');assert.equal(ui.visible('settingsPanel'),true);ui.key('keydown','Escape');assert.equal(snapshot(b),before);
});
