import test from 'node:test';import assert from 'node:assert/strict';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
const fields=['battleTitle','testModeBadge','combatBattleTitle','combatEnemyState','enemyHud','waveHud','viewStatus','batteryObjectiveBrief','flagHud'];
const identity=ui=>({title:ui.document.title,fields:Object.fromEntries(fields.map(id=>{const el=ui.get(id);return[id,{text:el.textContent,aria:el.getAttribute('aria-label'),hidden:el.classList.contains('hidden')}];})),standard:{aria:ui.document.querySelector('.live-battle-standard').getAttribute('aria-label'),objective:ui.document.querySelector('.live-battle-standard').dataset.objective}});
const engine=b=>JSON.stringify({profile:b.profile,owned:[...b.profile.owned],tick:b.tick,stats:b.stats,good:b.goodTeam.map(u=>[u.type,u.hp,u.x,u.y]),bad:b.badTeam.map(u=>[u.type,u.hp,u.x,u.y]),shots:b.projectiles.map(p=>[p.kind,p.x,p.y,p.vx,p.vy]),population:b.friendlyQueue.population,queue:b.friendlyQueue.queue,summary:b.summary,outcome:b.outcome});
function inspect(ui){ui.click('shopCatalogTab');ui.get('shopSearch').value='Grunt';ui.dispatch(ui.get('shopSearch'),'input');ui.dispatch(ui.get('shopSearchForm'),'submit');ui.click('inspect-grunt');}
for(const origin of ['prepared','live','settled'])for(const kind of ['stress','trial'])test(`${kind} Return restores ${origin} Playground UI identity immediately and through repaint/reset`,async t=>{
 const ui=await loadGameUI(t,{search:'?mode=test'});ui.frames();
 if(origin!=='prepared'){ui.click('start');ui.frames(20);if(origin==='settled'){ui.battle.finishOutcome('victory');ui.frames(105);}else ui.click('battlePause');}
 const source=ui.battle;
 const open=()=>{if(kind==='stress')ui.click(origin==='settled'?'endingTesting':origin==='prepared'?'introTesting':'pauseTesting');else{ui.click(origin==='settled'?'endingShop':origin==='prepared'?'introArmory':'openShop');inspect(ui);}};
 open();ui.frames();const before=identity(ui),state=engine(source);
 for(let repeat=0;repeat<2;repeat++){
  if(kind==='stress')ui.click('stressStandard');else ui.click('shopTryCard');ui.frames(3);
  assert.notEqual(ui.battle,source);assert.notEqual(ui.get('battleTitle').textContent,before.fields.battleTitle.text);
  if(kind==='stress'){ui.click('pauseTesting');ui.click('stressReset');ui.frames();ui.click('pauseLobby');}
  else{ui.click('trainingRestart');ui.frames(2);ui.click('unitTrialReturn');}
  // No animation frame is needed to clear obsolete title, labels or ARIA.
  assert.deepEqual(identity(ui),before);assert.equal(engine(source),state);assert.equal(ui.visible(kind==='stress'?'testingPanel':'shopPanel'),true);
  ui.frames(3);assert.equal(ui.battle,source);assert.deepEqual(identity(ui),before);assert.equal(engine(source),state);
 }
});
for(const mode of ['campaign','expedition','skirmish'])test(`contract Return keeps ${mode} badge, objective ARIA and current labels`,async t=>{
 const search=mode==='campaign'?'':'?mode='+mode,ui=await loadGameUI(t,{search});if(ui.visible('skirmishPanel'))ui.click('closeWorkshop');ui.frames();ui.click('introArmory');inspect(ui);ui.frames();const source=ui.battle,before=identity(ui),state=engine(source);ui.click('shopTryCard');ui.frames(3);ui.click('unitTrialReturn');assert.deepEqual(identity(ui),before);ui.frames(2);assert.equal(ui.battle,source);assert.deepEqual(identity(ui),before);assert.equal(engine(source),state);
});

for(const doctrine of ['levy','battery'])test(`contract Return preserves ${doctrine} objective labels and ARIA immediately`,async t=>{
 const ui=await loadGameUI(t,{search:`?mode=skirmish&sk=SK1:1KNH:oaks:standard:${doctrine}`});if(ui.visible('skirmishPanel'))ui.click('closeWorkshop');ui.frames();ui.click('introArmory');inspect(ui);ui.frames();const source=ui.battle,before=identity(ui),state=engine(source);assert.ok(before.standard.objective);ui.click('shopTryCard');ui.frames(3);ui.click('unitTrialReturn');assert.deepEqual(identity(ui),before);ui.frames(2);assert.equal(ui.battle,source);assert.deepEqual(identity(ui),before);assert.equal(engine(source),state);
});
test('contract Return restores the origin flag reminder without waiting for a frame or moving the flag',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=test'});ui.click('start');ui.battle.ownFlag.status=0;ui.battle.ownFlag.x=1500;ui.frames();ui.click('battlePause');ui.click('openShop');inspect(ui);ui.frames();const source=ui.battle,before=identity(ui),state=engine(source);assert.equal(ui.visible('flagHud'),true);ui.click('shopTryCard');ui.frames();assert.equal(ui.visible('flagHud'),false);ui.click('unitTrialReturn');assert.deepEqual(identity(ui),before);assert.equal(ui.visible('flagHud'),true);assert.equal(engine(source),state);
});

const transferButtons=['introSave','introLoad','introProfiles','saveGame','loadGame','openProfiles','endingSave','endingLoad','endingProfiles'];
const transferIdentity=ui=>({disabled:Object.fromEntries(transferButtons.map(id=>[id,ui.get(id).disabled])),notes:Object.fromEntries(['saveStatus','settingsSaveNote','autoHelp'].map(id=>[id,ui.get(id).textContent]))});
test('synthetic Pause shows locked transfer/profile controls and truthful disposable/Auto help through reset',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=test'});ui.frames();const before=transferIdentity(ui);ui.click('introTesting');ui.click('stressStandard');
 for(let n=0;n<2;n++){
  for(const id of transferButtons)assert.equal(ui.get(id).disabled,true,id);assert.match(ui.get('saveStatus').textContent,/Temporary synthetic field.*No campaign progress or export/);assert.match(ui.get('settingsSaveNote').textContent,/temporary/);assert.match(ui.get('autoHelp').textContent,/Auto starts off.*zero reserve.*replacements/);assert.doesNotMatch(ui.get('autoHelp').textContent,/on by default/);
  ui.frames(2);for(const id of transferButtons)assert.equal(ui.get(id).disabled,true,id);if(n===0){ui.click('pauseTesting');ui.click('stressReset');}
 }
 ui.click('pauseLobby');assert.deepEqual(transferIdentity(ui),before);ui.frames();assert.deepEqual(transferIdentity(ui),before);
});
test('disabled synthetic transfer/profile actions still reject direct and stale handlers',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=test'});const stale=Object.fromEntries(['saveGame','loadGame','openProfiles','downloadSave','showSaveCode','importCode'].map(id=>[id,ui.get(id).onclick]));ui.click('introTesting');ui.click('stressVeteran');const lab=ui.battle,before=engine(lab);
 for(const id of ['saveGame','loadGame','openProfiles']){assert.equal(ui.get(id).disabled,true);ui.get(id).onclick();stale[id]();}
 stale.downloadSave();stale.showSaveCode();ui.get('loadCode').value='{}';stale.importCode();assert.equal(ui.visible('savePanel'),false);assert.equal(ui.visible('profilesPanel'),false);assert.equal(ui.get('saveCode').value,'');assert.equal(ui.battle,lab);assert.equal(engine(lab),before);assert.match(ui.get('saveStatus').textContent,/No campaign progress or export/);
 ui.click('pauseLobby');ui.frames();ui.click('closeTesting');assert.equal(ui.get('introSave').disabled,false);ui.click('introSave');ui.click('showSaveCode');assert.match(ui.get('saveCode').value,/Playground/);
});
test('ordinary paused Playground controls and help restore immediately after live synthetic Return',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=test'});ui.click('start');ui.frames(20);ui.click('battlePause');ui.click('pauseTesting');const source=ui.battle,before=transferIdentity(ui),state=engine(source);ui.click('stressStandard');ui.click('resumeGame');ui.frames(10);ui.click('battlePause');ui.click('pauseLobby');assert.deepEqual(transferIdentity(ui),before);assert.equal(engine(source),state);ui.frames();assert.equal(ui.battle,source);ui.click('closeTesting');ui.click('saveGame');assert.equal(ui.visible('savePanel'),true);ui.click('showSaveCode');assert.match(ui.get('saveCode').value,/Playground/);
});
test('inactive stress presentation preserves contract-trial and guided-practice transfer locks',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=test'});ui.click('introArmory');inspect(ui);ui.click('shopTryCard');ui.frames(2);for(const id of transferButtons.slice(0,6))assert.equal(ui.get(id).disabled,true,id);ui.click('unitTrialReturn');assert.equal(ui.get('saveGame').disabled,false);ui.frames();ui.click('closeShop');ui.click('introGuidedTraining');ui.frames(2);for(const id of transferButtons.slice(0,6))assert.equal(ui.get(id).disabled,true,id);ui.click('introExitTraining');ui.frames();for(const id of transferButtons.slice(0,6))assert.equal(ui.get(id).disabled,false,id);
});
