import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
import {modalFocusCandidates} from '../site/dist/modal-focus.mjs';

const select=(ui,id)=>ui.get('hubDestinations').querySelector(`[data-hub-destination="${id}"]`).click();
const rebind=(ui,action,key)=>{ui.click('control-'+action);ui.key('keydown',key);};
const switchTo=(ui,id)=>{select(ui,id);ui.click('start');if(ui.visible('switchSessionConfirm'))ui.click('confirmSessionSwitch');ui.frames();};

test('optional Training entry follows the launch selection and adds no separate hall card',async t=>{
 const ui=await loadGameUI(t),campaign=ui.battle;
 assert.equal(ui.get('trainingEntry').parentElement.classList.contains('hall-launch-copy'),true);
 assert.equal(ui.visible('trainingEntry'),true);assert.equal(ui.visible('trainingEntryNote'),false);
 for(const id of ['expedition','midgame','allies']){select(ui,id);assert.equal(ui.visible('trainingEntry'),false);assert.equal(ui.battle,campaign);}
 select(ui,'campaign');ui.click('dismissTrainingInvite');assert.equal(ui.visible('trainingEntry'),false);
 select(ui,'training');assert.equal(ui.visible('trainingEntry'),true);assert.equal(ui.visible('trainingEntryNote'),true);assert.equal(ui.visible('dismissTrainingInvite'),false);
 ui.click('introGuidedTraining');ui.frames();assert.ok(ui.battle.guidedTraining);assert.equal(ui.battle.tick,0);ui.click('introExitTraining');ui.frames();assert.equal(ui.battle,campaign);assert.equal(campaign.tick,0);assert.equal(ui.visible('trainingEntry'),false);
});

test('Controls capture and wrapping use the shared enabled modal focus candidates',async t=>{
 const ui=await loadGameUI(t);ui.click('introSettings');ui.click('openControls');ui.click('control-arc');
 assert.equal(ui.get('applyControls').disabled,true);assert.equal(modalFocusCandidates(ui.get('controlsPanel')).includes(ui.get('applyControls')),false);
 ui.key('keydown','Tab');assert.equal(ui.get('applyControls').disabled,false);
 const items=modalFocusCandidates(ui.get('controlsPanel'));items[0].focus();ui.key('keydown','Tab',{shiftKey:true});assert.equal(ui.document.activeElement,items.at(-1));ui.key('keydown','Tab');assert.equal(ui.document.activeElement,items[0]);
 ui.key('keydown','Escape');assert.equal(ui.visible('settingsPanel'),true);assert.equal(ui.document.activeElement,ui.get('openControls'));ui.key('keydown','Escape');assert.equal(ui.visible('intro'),true);assert.equal(ui.battle.tick,0);
});

test('remapping during guided practice refreshes cached coach, live arc and companion references',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=test&guide=1'});ui.click('start');ui.frames();ui.click('trainingSkip');ui.frames();assert.match(ui.get('trainingInstruction').textContent,/V on keyboard/);
 ui.click('battlePause');ui.click('openSettings');ui.click('openControls');rebind(ui,'arc','j');rebind(ui,'companion','h');ui.click('applyControls');ui.click('closeSettings');ui.click('resumeGame');ui.frames();
 assert.match(ui.get('trainingInstruction').textContent,/J on keyboard/);assert.match(ui.get('liveArc').getAttribute('aria-label'),/Shortcut J/);const arc=ui.battle.shooter.angleMode;ui.key('keydown','v');assert.equal(ui.battle.shooter.angleMode,arc);ui.key('keydown','j');assert.notEqual(ui.battle.shooter.angleMode,arc);
 for(let i=0;i<3;i++){ui.click('trainingSkip');ui.frames();}assert.equal(ui.battle.guidedTraining.lesson.id,'companion');ui.key('keydown','g');assert.equal(ui.battle.companions.unit,null);ui.key('keydown','h');ui.frames();assert.ok(ui.battle.companions.unit);assert.match(ui.get('trainingInstruction').textContent,/press H again/);assert.match(ui.get('companionAction').getAttribute('aria-label'),/Shortcut H/);
});

test('guided practice launched from a charter restores the exact charter and its menu routes',async t=>{
 const ui=await loadGameUI(t);switchTo(ui,'expedition');const charter=ui.battle,profile=charter.profile,before=JSON.stringify({profile,tick:charter.tick,level:charter.level,stats:charter.stats});
 select(ui,'training');ui.click('introGuidedTraining');ui.frames();assert.notEqual(ui.battle,charter);assert.ok(ui.battle.guidedTraining);ui.click('introSettings');ui.click('openControls');ui.click('cancelControls');ui.click('closeSettings');ui.click('introExitTraining');ui.frames(10);
 assert.equal(ui.battle,charter);assert.equal(ui.battle.profile,profile);assert.equal(JSON.stringify({profile,tick:charter.tick,level:charter.level,stats:charter.stats}),before);assert.equal(ui.get('intro').getAttribute('data-active-destination'),'expedition');assert.equal(ui.visible('introRoute'),true);assert.equal(ui.visible('trainingEntry'),false);
 ui.click('introSave');assert.equal(ui.get('savePanelTitle').textContent,'Charter vault');ui.click('closeSave');ui.click('introLoadout');ui.click('closeSkills');assert.equal(ui.battle,charter);assert.equal(charter.tick,0);
});
