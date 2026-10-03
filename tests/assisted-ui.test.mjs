import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
import {CampaignProfiles} from '../site/dist/engine/profile-manager.mjs';
import {PlayerProfile} from '../site/dist/engine/progression.mjs';

// Real UI handlers and real engine. These do not claim browser layout/device QA.
test('normal campaign cannot reach or activate testing controls',async t=>{
 const ui=await loadGameUI(t);assert.equal(ui.battle.testing,false);assert.equal(ui.battle.profile.cheated,false);
 for(const id of ['openTesting','introTesting','pauseTesting','endingTesting','testModeBadge'])assert.equal(ui.visible(id),false,id);
 ui.click('openTesting');ui.click('testGoldLarge');ui.click('testUnlock');ui.click('testVictory');
 assert.equal(ui.visible('testingPanel'),false);assert.equal(ui.battle.profile.gold,0);assert.equal(ui.battle.profile.skills.length,1);assert.equal(ui.battle.outcome,null);
});
test('assisted UI buys a funded upgrade, settles victory, and continues with the upgrade',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=test'});assert.equal(ui.battle.profile.name,'Playground');assert.equal(ui.battle.profile.cheated,true);assert.equal(ui.visible('testModeBadge'),true);
 ui.click('introTesting');assert.equal(ui.visible('testingPanel'),true);ui.click('testGoldLarge');assert.equal(ui.battle.profile.gold,10000);
 ui.click('testVictory');ui.frames(105);assert.equal(ui.visible('ending'),true);assert.match(ui.get('endingTitle').textContent,/Assisted.*Victory/);assert.equal(ui.battle.profile.victories,1);
 ui.click('endingShop');assert.equal(ui.get('buy-fireArrow').disabled,false);ui.click('buy-fireArrow');assert.equal(ui.battle.profile.owned.has('fireArrow'),true);assert.equal(ui.battle.profile.gold,9000);ui.click('closeShop');ui.click('replay');
 assert.equal(ui.battle.level,2);assert.equal(ui.battle.profile.cheated,true);assert.equal(ui.battle.profile.owned.has('fireArrow'),true);assert.equal(ui.visible('ending'),false);assert.equal(ui.battle.paused,false);
});
test('assisted battle selection, protection and final campaign retirement remain marked',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=test'});ui.click('introTesting');ui.get('testProtection').checked=true;ui.dispatch(ui.get('testProtection'),'change');ui.get('testLevel').value='30';ui.click('testLevelApply');
 assert.equal(ui.battle.level,30);assert.equal(ui.battle.protectedTesting,true);assert.equal(ui.visible('intro'),true);assert.equal(ui.battle.profile.victories,0,'jumping is not an earned win');
 ui.click('introTesting');ui.click('testUnlock');assert.equal(ui.battle.profile.skills.length,25);assert.ok(ui.battle.profile.skills.every(s=>s.cooldown===0&&!s.autocast));ui.click('testVictory');ui.frames(105);
 assert.equal(ui.battle.summary.campaignComplete,true);assert.match(ui.get('endingTitle').textContent,/Assisted.*complete/);assert.equal(ui.get('endingShop').disabled,true);ui.click('replay');
 assert.equal(ui.battle.level,1);assert.equal(ui.battle.profile.cheated,true);assert.equal(ui.battle.profile.gold,0);assert.equal(ui.battle.profile.victories,0);
});
test('normal route imports assisted bundles with a visible provenance badge and no test tools',async t=>{
 const p=new PlayerProfile('Assisted');p.cheated=true;const text=new CampaignProfiles({profiles:[p]}).exportBundle();const ui=await loadGameUI(t);await ui.load({size:text.length,text:async()=>text});
 assert.equal(ui.battle.testing,false);assert.equal(ui.battle.profile.cheated,true);assert.equal(ui.visible('testModeBadge'),true);assert.equal(ui.get('testModeBadge').getAttribute('aria-label'),'Assisted profile');assert.equal(ui.visible('openTesting'),false);
});
for(const mode of ['point_aim','auto_aim'])test(`${mode} retains a quick tap between frames, but cancellation never fires`,async t=>{
 const ui=await loadGameUI(t);ui.get('aimMode').value=mode;ui.click('applySettings');ui.click('start');ui.frames(31);const target={x:650,y:550};
 ui.pointer('pointerdown',1,target);ui.pointer('pointerup',1,target);assert.equal(ui.battle.stats.shotsFired,0);ui.frames();assert.equal(ui.battle.stats.shotsFired,1);ui.frames(31);
 ui.pointer('pointerdown',2,target);ui.pointer('pointercancel',2,target);ui.frames();assert.equal(ui.battle.stats.shotsFired,1);
});
test('queued reinforcement cancellation uses the existing population refund and retains gold spending',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=test'});ui.click('introTesting');ui.click('testGoldLarge');ui.click('testUnlock');ui.click('closeTesting');ui.click('start');
 const skill=ui.battle.profile.skills.find(s=>s.id==='grunt');ui.battle.hotbar.activate(skill);const gold=ui.battle.profile.gold,pop=ui.battle.friendlyQueue.population;assert.equal(ui.battle.friendlyQueue.queue.length,4);
 ui.click('openQueue');assert.equal(ui.battle.paused,true);ui.click('cancelQueue0');assert.equal(ui.battle.friendlyQueue.queue.length,3);assert.equal(ui.battle.friendlyQueue.population,pop+1);assert.equal(ui.battle.profile.gold,gold);ui.click('closeQueue');assert.equal(ui.battle.paused,false);
});
test('orientation change clears an active draw and held movement and waits for explicit resume',async t=>{
 const ui=await loadGameUI(t);ui.click('start');ui.frames(31);ui.key('keydown','d');const origin={...ui.battle.hero.launchPosition};ui.pointer('pointerdown',7,origin);ui.frames();ui.dispatch(ui.window,'orientationchange');
 assert.equal(ui.battle.paused,true);assert.equal(ui.battle.input.right,false);assert.equal(ui.battle.input.mouseDown,false);assert.equal(ui.battlefield?.hasPointerCapture?.(7)??ui.get('battlefield').hasPointerCapture(7),false);assert.match(ui.get('pauseReason').textContent,/rotated/);const tick=ui.battle.tick;ui.frames(5);assert.equal(ui.battle.tick,tick);ui.pointer('pointerup',7,origin);ui.click('resumeGame');ui.frames();assert.equal(ui.battle.stats.shotsFired,0);assert.ok(ui.battle.tick>tick);
});
test('army panel exposes troop auto-summon without spending resources or resuming a paused battle',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=test'});ui.click('introTesting');ui.click('testUnlock');ui.click('closeTesting');ui.click('start');ui.click('battlePause');ui.click('pauseQueue');const gold=ui.battle.profile.gold,pop=ui.battle.friendlyQueue.population;const grunt=ui.battle.profile.skills.find(s=>s.id==='grunt');assert.equal(grunt.autocast,false);ui.click('armyAuto-grunt');assert.equal(grunt.autocast,true);assert.equal(ui.battle.profile.gold,gold);assert.equal(ui.battle.friendlyQueue.population,pop);assert.equal(ui.battle.friendlyQueue.queue.length,0);ui.click('closeQueue');assert.equal(ui.battle.paused,true);
});
test('quick Enter and Leave button taps survive between frames and do not stay held',async t=>{
 const ui=await loadGameUI(t);ui.click('start');const leave=ui.document.querySelector('[data-key="down"]'),enter=ui.document.querySelector('[data-key="up"]');assert.equal(ui.battle.hero.garrisoned(),true);
 ui.pointer('pointerdown',3,{x:0,y:0},leave);ui.pointer('pointerup',3,{x:0,y:0},leave);leave.click();ui.frames();assert.equal(ui.battle.hero.garrisoned(),false);assert.equal(ui.battle.input.down,false);
 enter.click();ui.frames();assert.equal(ui.battle.hero.garrisoned(),true);assert.equal(ui.battle.input.up,false);
 leave.click();ui.click('battlePause');ui.click('resumeGame');ui.frames();assert.equal(ui.battle.hero.garrisoned(),true,'pause cancels an unconsumed building action');
});
