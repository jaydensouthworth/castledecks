import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
const text=ui=>ui.get('battleReportText').value;
function sample(ui,state){
 ui.click('introBattleReport');ui.click('renderProfileStart');
 if(state==='armed'){assert.match(text(ui),/State: armed/);ui.click('closeBattleReport');return;}
 ui.click('closeBattleReport');ui.click('start');ui.frames(2);ui.click('battlePause');ui.click('pauseBattleReport');
 assert.match(text(ui),/State: recording/);
 if(state==='complete'){ui.click('renderProfileStop');assert.match(text(ui),/State: complete · stopped/);}
 ui.click('closeBattleReport');
}
function inspect(ui,id){ui.click('shopCatalogTab');ui.get('shopSearch').value=id==='grunt'?'Grunt':'Priest';ui.dispatch(ui.get('shopSearch'),'input');ui.dispatch(ui.get('shopSearchForm'),'submit');ui.click('inspect-'+id);}
function state(b){return JSON.stringify({tick:b.tick,hp:b.hero.hp,profile:b.profile,stats:b.stats,good:b.goodTeam.map(u=>[u.id,u.type,u.hp,u.x,u.y]),bad:b.badTeam.map(u=>[u.id,u.type,u.hp,u.x,u.y]),queue:b.friendlyQueue.queue,population:b.friendlyQueue.population,outcome:b.outcome,summary:b.summary});}
const switchWithoutFrame=(ui,id)=>{ui.get('hubDestinations').querySelector(`[data-hub-destination="${id}"]`).click();ui.click('start');if(ui.visible('switchSessionConfirm'))ui.click('confirmSessionSwitch');};

for(const originState of ['armed','recording','complete'])test(`${originState} origin sample is invalidated when a trial enters and returns before any animation frame`,async t=>{
 const ui=await loadGameUI(t);sample(ui,originState);const origin=ui.battle,before=state(origin);
 ui.click(originState==='armed'?'introArmory':'openShop');inspect(ui,'grunt');ui.click('shopTryCard');
 assert.notEqual(ui.battle,origin);assert.equal(ui.visible('shopPanel'),false);
 // Deliberately no frames or report reads between entering and restoring origin.
 ui.click('battlePause');ui.click('pauseLobby');assert.equal(ui.visible('shopPanel'),true);
 ui.click('closeShop');ui.click(originState==='armed'?'introBattleReport':'pauseBattleReport');
 assert.match(text(ui),/RENDERING SAMPLE · LOCAL ONLY\nState: idle/);assert.equal(ui.get('renderProfileStart').disabled,false);assert.equal(ui.get('renderProfileStop').disabled,true);
 assert.equal(state(origin),before);ui.click('closeBattleReport');ui.frames();assert.equal(ui.battle,origin);assert.equal(state(origin),before);
});
for(const originState of ['armed','recording','complete'])test(`${originState} playground sample is invalidated by a guided-practice round trip between frames`,async t=>{
 const ui=await loadGameUI(t,{search:'?mode=test'});sample(ui,originState);const origin=ui.battle,before=state(origin);
 ui.click('introGuidedTraining');assert.notEqual(ui.battle,origin);ui.click('introExitTraining');
 // Restoration must clear immediately, without any frame observing the drill.
 ui.click('introBattleReport');assert.match(text(ui),/State: idle/);assert.match(text(ui),/\| training \|/);assert.equal(state(origin),before);
 ui.click('closeBattleReport');ui.frames();assert.equal(ui.battle,origin);assert.equal(state(origin),before);
});
test('same-tab destination round trip before a frame cannot resurrect an armed cached sample',async t=>{
 const ui=await loadGameUI(t);sample(ui,'armed');const origin=ui.battle,before=state(origin);
 switchWithoutFrame(ui,'training');switchWithoutFrame(ui,'campaign');ui.click('introBattleReport');assert.match(text(ui),/State: idle/);assert.match(text(ui),/\| campaign \|/);assert.equal(state(origin),before);
 ui.click('closeBattleReport');ui.frames();assert.equal(ui.battle,origin);
});
test('ordinary management and a rejected stale trial button preserve same-session recording',async t=>{
 const ui=await loadGameUI(t);sample(ui,'recording');const origin=ui.battle,before=state(origin);ui.click('openShop');inspect(ui,'grunt');const stale=ui.get('shopTryCard');ui.click('shopCloseDetails');inspect(ui,'priest');stale.click();assert.equal(ui.battle,origin);
 ui.click('closeShop');ui.click('pauseBattleReport');assert.match(text(ui),/State: recording/);assert.match(text(ui),/Animation callback intervals: n=1/);assert.equal(state(origin),before);
 ui.click('closeBattleReport');ui.click('resumeGame');ui.frames(2);ui.click('battlePause');ui.click('pauseBattleReport');assert.match(text(ui),/State: recording/);assert.match(text(ui),/Animation callback intervals: n=2/);
});
test('cancelling a destination change and selecting the same destination retain the original sample',async t=>{
 const ui=await loadGameUI(t);sample(ui,'recording');const origin=ui.battle;ui.click('pauseLobby');ui.get('hubDestinations').querySelector('[data-hub-destination="training"]').click();ui.click('start');assert.equal(ui.visible('switchSessionConfirm'),true);ui.click('cancelSessionSwitch');
 ui.get('hubDestinations').querySelector('[data-hub-destination="campaign"]').click();ui.click('introBattleReport');assert.match(text(ui),/State: recording/);assert.match(text(ui),/Animation callback intervals: n=1/);assert.equal(ui.battle,origin);
});
test('new-battle and temporary-session hooks invalidate explicitly, after invalid-entry guards',async()=>{
 const s=await readFile(new URL('../site/dist/battle.mjs',import.meta.url),'utf8');
 assert.match(s,/function setup\([^\n]+\{\n invalidateRenderProfile\(\);/);
 assert.match(s,/function switchDestination\(id\)\{\n if\(id===activeDestination\)return;\n invalidateRenderProfile\(\);/);
 assert.match(s,/const run=createUnitTrial\(id,createArmorySnapshot\(profile\)\);\n invalidateRenderProfile\(\);/);
 assert.match(s,/const saved=cardPracticeOrigin;if\(!saved\)return false;\n invalidateRenderProfile\(\);/);
 assert.match(s,/function enterGuidedTraining\(\)\{[\s\S]*?if\(battle.outcome&&!battle.summary\)return;\n invalidateRenderProfile\(\);/);
 assert.match(s,/if\(!trainingRun\|\|activeDestination!=='training'\)return;\n invalidateRenderProfile\(\);/);
});
