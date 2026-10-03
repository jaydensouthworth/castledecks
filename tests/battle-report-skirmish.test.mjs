import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
import {MemoryStorage} from './helpers/local-storage.mjs';
const text=ui=>ui.get('battleReportText').value;
const enable=ui=>{ui.get('battleReportRecording').checked=true;ui.dispatch(ui.get('battleReportRecording'),'change');};
const switchTo=(ui,id)=>{ui.get('hubDestinations').querySelector(`[data-hub-destination="${id}"]`).click();ui.click('start');if(ui.visible('switchSessionConfirm'))ui.click('confirmSessionSwitch');ui.frames();};
const campaignBytes=storage=>[...storage.data].filter(([key])=>key.startsWith('castledecks:campaign:'));

test('report seed describes the current Skirmish battle rather than its unprepared workshop draft',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=skirmish'}),initial=ui.battle,seed=initial.skirmish.descriptor.seed;
 ui.get('skirmishSeed').value='42';ui.dispatch(ui.get('skirmishSeed'),'change');ui.click('skirmishCancel');
 ui.click('introBattleReport');assert.match(text(ui),new RegExp(`Seed: ${seed}\\b`));assert.equal(ui.get('battleReportRecording').checked,false);
 enable(ui);initial.emit({type:'damage',target:initial.hero,damage:2});ui.click('battleReportRefresh');assert.match(text(ui),/← unavailable/);
 assert.ok(!text(ui).includes(initial.skirmish.code));ui.click('closeBattleReport');ui.click('introWorkshop');ui.get('skirmishSeed').value='42';ui.click('skirmishPrepare');ui.frames();
 assert.notEqual(ui.battle,initial);ui.click('introBattleReport');assert.match(text(ui),/Seed: 42\b/);assert.equal(ui.get('battleReportRecording').checked,false);assert.match(text(ui),/No recorded events/);
});

test('Skirmish history follows its exact same-tab battle and resets on retry without touching campaign saves',async t=>{
 const storage=new MemoryStorage(),ui=await loadGameUI(t,{storage}),campaign=ui.battle;
 ui.click('introBattleReport');enable(ui);campaign.emit({type:'shot',skill:'arrow'});ui.click('closeBattleReport');await ui.settle();const saved=campaignBytes(storage);
 switchTo(ui,'skirmish');ui.click('skirmishPrepare');ui.frames();const practice=ui.battle,seed=practice.skirmish.descriptor.seed;
 ui.click('introBattleReport');assert.equal(ui.get('battleReportRecording').checked,false);enable(ui);practice.emit({type:'shot',skill:'fireArrow'});ui.click('closeBattleReport');
 switchTo(ui,'campaign');assert.equal(ui.battle,campaign);ui.click('introBattleReport');assert.equal(ui.get('battleReportRecording').checked,true);assert.match(text(ui),/0 shot/);assert.doesNotMatch(text(ui),/fireArrow/);ui.click('closeBattleReport');
 switchTo(ui,'skirmish');assert.equal(ui.battle,practice);ui.click('introBattleReport');assert.equal(ui.get('battleReportRecording').checked,true);assert.match(text(ui),/fireArrow/);ui.click('closeBattleReport');
 ui.click('start');practice.finishOutcome('defeat');ui.frames(150);assert.equal(practice.summary?.outcome,'defeat');ui.click('replay');ui.frames();assert.notEqual(ui.battle,practice);
 ui.click('introBattleReport');assert.equal(ui.get('battleReportRecording').checked,false);assert.match(text(ui),/No recorded events/);assert.match(text(ui),new RegExp(`Seed: ${seed}\\b`));await ui.settle();assert.deepEqual(campaignBytes(storage),saved);
});

test('Skirmish report seed hook rejects malformed runtime facts while accepting uint32 endpoints',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=skirmish'});ui.click('skirmishCancel');const b=ui.battle,scenario=b.skirmish;
 // Deliberate runtime-fault fixtures validate the diagnostics boundary only.
 for(const seed of [0,-1,2**32,NaN,Infinity,'42']){b.skirmish={...scenario,descriptor:{...scenario.descriptor,seed}};ui.click('introBattleReport');assert.match(text(ui),/Seed: unavailable/);ui.click('closeBattleReport');}
 for(const seed of [1,0xffffffff]){b.skirmish={...scenario,descriptor:{...scenario.descriptor,seed}};ui.click('introBattleReport');assert.match(text(ui),new RegExp(`Seed: ${seed}\\b`));ui.click('closeBattleReport');}
 b.skirmish=scenario;
});
