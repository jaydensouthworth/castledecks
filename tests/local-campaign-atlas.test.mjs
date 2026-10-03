import test from 'node:test';import assert from 'node:assert/strict';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
import {MemoryStorage,TestLocks} from './helpers/local-storage.mjs';
import {CampaignProfiles} from '../site/dist/engine/profile-manager.mjs';
import {PlayerProfile} from '../site/dist/engine/progression.mjs';
import {regionForBattle} from '../site/dist/campaign-atlas-model.mjs';
import {createLocalCampaignStore} from '../site/dist/local-campaign-store.mjs';
const makeProfile=()=>{const p=new PlayerProfile('Roadkeeper');Object.assign(p,{level:7,highestLevel:7,scene:8,highestScene:8,victories:6,gold:6001});assert.equal(p.purchase('grunt'),true);p.skills.find(s=>s.id==='grunt').autocast=false;return p;};
async function importCampaign(ui){ui.click('introLoad');ui.get('loadCode').value=new CampaignProfiles({profiles:[makeProfile()]}).exportBundle();ui.click('importCode');assert.equal(ui.visible('localConfirm'),true);ui.click('localConfirmAccept');await ui.settle();assert.equal(ui.battle.level,7);assert.equal(ui.battle.profile.name,'Roadkeeper');}
async function prepareReplay(ui,level=2){ui.click('introAtlas');const region=regionForBattle(level);ui.get('campaignAtlasHost').querySelector(`[data-atlas-region="${region.id}"]`).click();ui.get('campaignAtlasHost').querySelector(`[data-atlas-level="${level}"]`).click();assert.equal(ui.get('atlasPrepare').disabled,false);ui.click('atlasPrepare');await ui.settle();assert.equal(ui.visible('intro'),true);assert.equal(ui.battle.level,level);assert.equal(ui.battle.campaignReplay,true);assert.equal(ui.battle.profile.highestLevel,7);assert.equal(ui.battle.tick,0);}
async function continueLocal(ui){ui.click('localContinue');await ui.settle();assert.equal(ui.visible('localConfirm'),true);ui.click('localConfirmAccept');await ui.settle();}

test('atlas replay Start captures opening resources; a real page reload returns to earned frontier',async t=>{
 const storage=new MemoryStorage(),locks=new TestLocks(),store=createLocalCampaignStore({storage,locks});let openingGold,bankBeforeReload;
 await t.test('prepare replay, start, and retain its safe opening while combat mutates',async t=>{
  const ui=await loadGameUI(t,{storage,locks});await importCampaign(ui);await prepareReplay(ui);
  assert.equal(store.read(2).latest.payload.resume.level,7);assert.equal(store.read(2).latest.manager.active.level,2);assert.equal(store.read(2).latest.manager.active.highestLevel,7);
  openingGold=ui.battle.profile.gold;ui.click('start');await ui.settle();const opening=store.read(2).latest;assert.equal(opening.payload.resume.phase,'opening');assert.equal(opening.payload.resume.level,7);assert.equal(opening.manager.active.gold,openingGold);
  const squad=ui.battle.profile.skills.find(s=>s.id==='grunt');squad.cooldown=0;ui.battle.hotbar.activate(squad);assert.equal(ui.battle.profile.gold,openingGold-20);assert.equal(ui.battle.friendlyQueue.queue.length,4);ui.battle.profile.gold+=31;ui.battle.profile.addXP(25);
  ui.click('battlePause');ui.click('pauseLobby');await ui.settle();assert.equal(store.read(2).latest.manager.active.gold,openingGold);assert.equal(store.read(2).latest.manager.active.xp,0);assert.equal(store.read(2).latest.manager.active.victories,6);bankBeforeReload=store.read(2).raw;
 });
 await t.test('new page explicitly continues that slot without recharging or preserving live objects',async t=>{
  const ui=await loadGameUI(t,{storage,locks});assert.deepEqual(store.read(2).raw,bankBeforeReload,'fresh page does not overwrite a saved campaign');await continueLocal(ui);
  assert.equal(ui.battle.level,7);assert.equal(ui.battle.campaignReplay,false);assert.equal(ui.battle.profile.highestLevel,7);assert.equal(ui.battle.profile.gold,openingGold);assert.equal(ui.battle.profile.xp,0);assert.equal(ui.battle.profile.victories,6);assert.equal(ui.battle.profile.cheated,false);
  assert.equal(ui.battle.tick,0);assert.equal(ui.battle.projectiles.length,0);assert.equal(ui.battle.friendlyQueue.queue.length,0);assert.equal(ui.battle.friendlyQueue.population,20);assert.equal(ui.visible('intro'),true);ui.frames(5);assert.equal(ui.battle.tick,0);
  ui.click('start');await ui.settle();assert.equal(ui.battle.profile.gold,openingGold);assert.equal(store.read(2).latest.payload.resume.level,7);
 });
});

test('settled atlas replay saves its earned reward once, then next and reload return to frontier',async t=>{
 const storage=new MemoryStorage(),locks=new TestLocks(),store=createLocalCampaignStore({storage,locks});let settledGold,settledXP,settledWins;
 await t.test('reward is absent at outcome, saved after summary, and unchanged by Return to frontier',async t=>{
  const ui=await loadGameUI(t,{storage,locks});await importCampaign(ui);await prepareReplay(ui);ui.click('start');await ui.settle();const opening=store.read(2).latest.payload;
  const squad=ui.battle.profile.skills.find(s=>s.id==='grunt');squad.cooldown=0;ui.battle.hotbar.activate(squad);ui.battle.stats.goldEarned=150;ui.battle.profile.gold+=150;ui.battle.profile.addXP(75);
  ui.battle.finishOutcome('victory');assert.equal(ui.battle.summary,null);await ui.settle();assert.deepEqual(store.read(2).latest.payload,opening,'partial victory cannot be checkpointed');ui.frames(105);await ui.settle();assert.equal(ui.battle.summary.outcome,'victory');
  settledGold=ui.battle.profile.gold;settledXP=ui.battle.profile.xp;settledWins=ui.battle.profile.victories;const result=store.read(2).latest;assert.equal(result.payload.resume.phase,'result');assert.equal(result.payload.resume.outcome,'victory');assert.equal(result.payload.resume.level,7);assert.equal(result.manager.active.gold,settledGold);assert.equal(result.manager.active.xp,settledXP);assert.equal(result.manager.active.victories,7);assert.equal(result.manager.active.highestLevel,7);assert.match(ui.get('replay').textContent,/frontier.*7/);
  const writes=storage.writes;ui.frames(20);await ui.settle();assert.equal(storage.writes,writes);ui.click('replay');await ui.settle();assert.equal(ui.battle.level,7);assert.equal(ui.battle.campaignReplay,false);assert.equal(ui.battle.profile.gold,settledGold);assert.equal(ui.battle.profile.xp,settledXP);assert.equal(ui.battle.profile.victories,settledWins);assert.equal(store.read(2).latest.payload.resume.phase,'opening');assert.equal(store.read(2).latest.payload.resume.level,7);assert.equal(store.read(2).latest.manager.active.gold,settledGold);
 });
 await t.test('reload of the next opening never awards the previous replay again',async t=>{
  const ui=await loadGameUI(t,{storage,locks});await continueLocal(ui);assert.equal(ui.battle.level,7);assert.equal(ui.battle.profile.gold,settledGold);assert.equal(ui.battle.profile.xp,settledXP);assert.equal(ui.battle.profile.victories,settledWins);assert.equal(ui.battle.summary,null);assert.equal(ui.battle.friendlyQueue.queue.length,0);ui.click('start');await ui.settle();ui.frames(5);assert.equal(ui.battle.profile.gold,settledGold);assert.equal(ui.battle.profile.victories,settledWins);
 });
});
