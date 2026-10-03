import test from 'node:test';import assert from 'node:assert/strict';
import {loadGameUI,deferredFile} from './helpers/game-ui-harness.mjs';
import {TestLocks,settle} from './helpers/local-storage.mjs';
import {CampaignProfiles} from '../site/dist/engine/profile-manager.mjs';
class Storage{constructor(){this.data=new Map();}getItem(k){return this.data.get(k)??null;}setItem(k,v){this.data.set(k,String(v));}removeItem(k){this.data.delete(k);}}
const search=(ui,value)=>{ui.get('shopSearch').value=value;ui.dispatch(ui.get('shopSearch'),'input');ui.dispatch(ui.get('shopSearchForm'),'submit');};
const inspect=(ui,id)=>{ui.click('shopCatalogTab');search(ui,id==='grunt'?'Grunt':id==='priest'?'Priest':id==='fireDragon'?'Fire Dragon':id==='trebuchet'?'Trebuchet':id);ui.click('inspect-'+id);};
function state(b){return JSON.stringify({profile:b.profile,owned:[...b.profile.owned],tick:b.tick,stats:b.stats,good:b.goodTeam.map(u=>[u.id,u.type,u.hp,u.x,u.y]),bad:b.badTeam.map(u=>[u.id,u.type,u.hp,u.x,u.y]),shots:b.projectiles.map(p=>[p.kind,p.x,p.y,p.vx,p.vy]),queue:b.friendlyQueue.queue,population:b.friendlyQueue.population,summary:b.summary,outcome:b.outcome,hotbar:[b.hotbar.bar,b.hotbar.glow,b.activeSkill?.id]});}
function select(ui,id){ui.get('hubDestinations').querySelector(`[data-hub-destination="${id}"]`).click();ui.click('start');if(ui.visible('switchSessionConfirm'))ui.click('confirmSessionSwitch');ui.frames();}

test('unowned contract trial returns to exact prepared profile, card, wishlist, cart, query and scroll',async t=>{
 const storage=new Storage(),ui=await loadGameUI(t,{storage});const origin=ui.battle;
 ui.click('introArmory');inspect(ui,'fireDragon');ui.click('shopCartSelected');ui.click('shopSaveSelected');ui.get('shopDetailDrawer').scrollTop=120;await ui.settle();
 const before=state(origin),saved=[...storage.data];assert.match(ui.get('shopDetails').textContent,/supplied rank-0/i);const originalButton=ui.get('shopTryCard');originalButton.click();ui.frames();
 const trial=ui.battle;assert.notEqual(trial,origin);assert.equal(trial.guidedTraining.run.cardId,'fireDragon');assert.equal(trial.profile.owned.has('fireDragon'),true);assert.equal(origin.profile.owned.has('fireDragon'),false);assert.equal(ui.visible('shopPanel'),false);assert.equal(ui.visible('trainingCoach'),true);assert.equal(ui.get('gameShell').dataset.unitTrial,'true');
 originalButton.click();assert.equal(ui.battle,trial);ui.click('unitTrialDeploy');ui.frames(70);assert.equal(trial.profile.gold,435);assert.equal(trial.guidedTraining.snapshot.deployed,1);assert.equal(state(origin),before);await ui.settle();assert.deepEqual([...storage.data],saved);
 ui.click('unitTrialReturn');ui.frames(20);await ui.settle();assert.equal(ui.battle,origin);assert.equal(state(origin),before);assert.deepEqual([...storage.data],saved);assert.equal(ui.visible('shopPanel'),true);assert.equal(ui.visible('shopDetailDrawer'),true);assert.equal(ui.get('shopSearch').value,'Fire Dragon');assert.equal(ui.get('shopCartCount').textContent,'1');assert.equal(ui.get('shopWishlistCount').textContent,'1');assert.equal(ui.get('shopDetailDrawer').scrollTop,120);assert.equal(ui.document.activeElement.id,'shopTryCard');assert.equal(ui.get('gameShell').dataset.unitTrial,'false');
});
test('paused live battle and existing cached Training session remain exact through repeat/reset/return',async t=>{
 const ui=await loadGameUI(t);const campaign=ui.battle;select(ui,'training');const playground=ui.battle;playground.profile.gold=713;select(ui,'campaign');assert.equal(ui.battle,campaign);ui.click('start');ui.frames(25);ui.click('battlePause');ui.click('openShop');inspect(ui,'grunt');const before=state(campaign),otherBefore=state(playground);
 for(let i=0;i<2;i++){
  ui.click('shopTryCard');ui.frames(5);ui.click('unitTrialDeploy');ui.frames(100);assert.equal(ui.battle.profile.gold,480);const trial=ui.battle,stale=ui.get('unitTrialDeploy').onclick;
  ui.click('trainingRestart');ui.frames();assert.notEqual(ui.battle,trial);assert.equal(ui.battle.profile.gold,500);assert.equal(ui.battle.guidedTraining.snapshot.deployed,0);
  ui.click('unitTrialReturn');stale({detail:1});ui.frames(10);assert.equal(ui.battle,campaign);assert.equal(state(campaign),before);assert.equal(state(playground),otherBefore);assert.equal(campaign.paused,true);
 }
 ui.click('closeShop');ui.click('pauseLobby');select(ui,'training');assert.equal(ui.battle,playground);assert.equal(state(playground),otherBefore);
});
test('trial pause Hall and Deck return directly to the selected card without caching supplied state',async t=>{
 const ui=await loadGameUI(t);const origin=ui.battle;ui.click('introArmory');inspect(ui,'priest');ui.click('shopTryCard');ui.frames(2);ui.click('battlePause');assert.match(ui.get('pauseLobby').textContent,/Return to card/);ui.click('pauseLobby');ui.frames();assert.equal(ui.battle,origin);assert.equal(ui.visible('shopPanel'),true);
 ui.click('shopTryCard');ui.frames(2);ui.click('battlePause');ui.click('openShop');ui.frames();assert.equal(ui.battle,origin);assert.equal(ui.visible('shopDetailDrawer'),true);
});
test('late import completion and checkpoint callback cannot replace or persist a trial',async t=>{
 const storage=new Storage(),locks=new TestLocks(),ui=await loadGameUI(t,{storage,locks}),origin=ui.battle;
 ui.click('introLoad');const deferred=deferredFile(),reading=ui.load(deferred.file);ui.click('closeSave');ui.click('introArmory');inspect(ui,'trebuchet');await ui.settle();const saved=[...storage.data];ui.click('shopTryCard');ui.frames();const trial=ui.battle;
 deferred.resolve(new CampaignProfiles({defaultName:'Late import'}).exportBundle());await reading;await settle();assert.equal(ui.battle,trial);assert.deepEqual([...storage.data],saved);assert.equal(ui.visible('savePanel'),false);assert.equal(ui.visible('localConfirm'),false);
 ui.click('unitTrialReturn');ui.frames();assert.equal(ui.battle,origin);assert.equal(origin.profile.name,'Castledecks');
});
test('late detached card launch is rejected after selecting a newer card or switching sessions',async t=>{
 const ui=await loadGameUI(t);const origin=ui.battle;ui.click('introArmory');inspect(ui,'grunt');const stale=ui.get('shopTryCard');ui.click('shopCloseDetails');inspect(ui,'priest');stale.click();assert.equal(ui.battle,origin);
 ui.click('closeShop');select(ui,'training');const other=ui.battle;stale.click();assert.equal(ui.battle,other);assert.equal(ui.visible('trainingCoach'),false);
});
test('charter and seeded-skirmish source sessions restore their exact battle objects',async t=>{
 for(const mode of ['expedition','skirmish']){
  const ui=await loadGameUI(t,{search:'?mode='+mode});if(ui.visible('skirmishPanel'))ui.click('closeWorkshop');const original=ui.battle;ui.click('introArmory');inspect(ui,'grunt');const before=state(original);ui.click('shopTryCard');ui.frames(50);ui.click('unitTrialReturn');ui.frames(5);assert.equal(ui.battle,original);assert.equal(state(original),before);assert.equal(ui.visible('shopPanel'),true);
 }
});

test('temporary trial rejects direct save-code, import and late file-picker change handlers',async t=>{
 const ui=await loadGameUI(t);const origin=ui.battle;ui.click('introArmory');inspect(ui,'grunt');ui.click('shopTryCard');ui.frames();const trial=ui.battle;
 ui.click('showSaveCode');assert.equal(ui.get('saveCode').value,'');ui.get('loadCode').value=new CampaignProfiles({defaultName:'Forbidden trial import'}).exportBundle();ui.click('importCode');ui.frames();assert.equal(ui.battle,trial);assert.equal(ui.visible('savePanel'),false);
 let read=false;await ui.load({size:1,text:()=>{read=true;return Promise.resolve(new CampaignProfiles().exportBundle());}});assert.equal(read,false);assert.equal(ui.battle,trial);
 ui.click('unitTrialReturn');ui.frames();assert.equal(ui.battle,origin);
});
test('an already queued origin checkpoint finishes against its origin while the supplied field is active',async t=>{
 const storage=new Storage(),locks=new TestLocks(),ui=await loadGameUI(t,{storage,locks});
 locks.pauseNext=true;ui.battle.profile.gold=321;ui.click('introArmory');await settle();assert.ok(locks.release);inspect(ui,'grunt');ui.click('shopTryCard');ui.frames();const trial=ui.battle;trial.profile.gold=888;
 locks.release();await settle();assert.equal(ui.battle,trial);assert.match(ui.get('localHubStatus').textContent,/Practice and showcase/);assert.ok([...storage.data.values()].some(value=>value.includes('321')));assert.ok([...storage.data.values()].every(value=>!value.includes('Contract trial')));
 ui.click('unitTrialReturn');ui.frames();await settle();assert.equal(ui.battle.profile.gold,321);
});
test('ordinary assisted playground keeps its normal save-code export and import outside temporary practice',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=test'});ui.click('introSave');ui.click('showSaveCode');assert.equal(CampaignProfiles.fromBundle(ui.get('saveCode').value).active.name,'Playground');
 const supplied=new CampaignProfiles({defaultName:'Existing test save'});supplied.active.gold=725;ui.get('loadCode').value=supplied.exportBundle();ui.click('importCode');ui.frames();assert.equal(ui.battle.profile.name,'Existing test save');assert.equal(ui.battle.profile.gold,725);assert.equal(ui.battle.profile.cheated,true);
});
test('settled-result origin, earned contract rank and selected bar are preserved after a trial',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=test'});ui.battle.profile.gold=3000;ui.click('introArmory');inspect(ui,'grunt');ui.click('shopDetailAction');ui.click('closeShop');ui.click('start');ui.frames(20);ui.battle.finishOutcome('victory');ui.frames(105);
 const origin=ui.battle,skill=origin.profile.skills.find(s=>s.id==='grunt');skill.rank=4;skill.xp=333;skill.threshold=500;ui.click('endingShop');inspect(ui,'grunt');ui.get('shopDetailMode').value='card';ui.dispatch(ui.get('shopDetailMode'),'change');const before=state(origin);ui.click('shopTryCard');ui.frames();assert.equal(ui.battle.guidedTraining.contract.rank,4);ui.click('unitTrialDeploy');ui.frames(100);ui.click('unitTrialReturn');ui.frames();assert.equal(ui.battle,origin);assert.equal(state(origin),before);assert.match(ui.get('shopDetails').textContent,/Your card’s rank 4/);
});
test('choosing another demo during a paused trial closes the trial before showing the origin switch confirmation',async t=>{
 const ui=await loadGameUI(t);ui.click('start');ui.frames(10);ui.click('battlePause');ui.click('openShop');inspect(ui,'grunt');const origin=ui.battle,before=state(origin);ui.click('shopTryCard');ui.frames(3);ui.click('battlePause');ui.click('pauseDemo');ui.frames();
 assert.equal(ui.battle,origin);assert.equal(state(origin),before);assert.equal(ui.visible('shopPanel'),false);assert.equal(ui.visible('intro'),true);assert.equal(ui.visible('switchSessionConfirm'),true);
 ui.click('confirmSessionSwitch');ui.frames();assert.notEqual(ui.battle,origin);assert.equal(ui.battle.level,13);assert.equal(ui.battle.guidedTraining,undefined);select(ui,'campaign');assert.equal(ui.battle,origin);assert.equal(state(origin),before);
});
