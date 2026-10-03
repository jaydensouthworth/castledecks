import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
import {PLAY_DESTINATIONS,canPurchaseInArmory,playDestinationURL} from '../site/dist/player-hub.mjs';
import {CampaignProfiles} from '../site/dist/engine/profile-manager.mjs';
import {PlayerProfile} from '../site/dist/engine/progression.mjs';
const route=(ui,panel,name)=>ui.get(panel).querySelector(`[data-menu-route="${name}"]`).click();
const select=(ui,id)=>ui.get('hubDestinations').querySelector(`[data-hub-destination="${id}"]`).click();
const switchTo=(ui,id)=>{select(ui,id);ui.click('start');if(ui.visible('switchSessionConfirm'))ui.click('confirmSessionSwitch');ui.frames();};
const snapshot=b=>JSON.stringify({tick:b.tick,level:b.level,profile:b.profile,stats:b.stats,good:b.goodTeam.map(u=>[u.id,u.type,u.x,u.y,u.hp]),bad:b.badTeam.map(u=>[u.id,u.type,u.x,u.y,u.hp]),wave:b.wave.countdown,population:b.friendlyQueue.population,queue:b.friendlyQueue.queue,projectiles:b.projectiles.map(p=>[p.x,p.y,p.vx,p.vy]),outcome:b.outcome,summary:b.summary});

test('registry distinguishes the real campaign from implemented practice destinations',()=>{
 assert.deepEqual(PLAY_DESTINATIONS.map(d=>[d.id,d.kind]),[['campaign','CAMPAIGN'],['midgame','PRACTICE'],['allies','PRACTICE'],['training','PRACTICE']]);
 assert.equal(playDestinationURL('allies','point_aim'),'./battle?mode=demo&showcase=companions&aim=point_aim');
 assert.throws(()=>playDestinationURL('pvp'),/Unknown/);
 assert.equal(canPurchaseInArmory({started:false}),true);assert.equal(canPurchaseInArmory({started:true}),false);assert.equal(canPurchaseInArmory({started:true,summary:{outcome:'victory'}}),true);assert.equal(canPurchaseInArmory({summary:{campaignComplete:true}}),false);
});

test('all direct entry routes show a frozen player lobby and require one explicit start',async t=>{
 for(const search of ['', '?mode=test','?mode=demo','?mode=demo&showcase=companions&aim=point_aim'])await t.test(search||'campaign',async t=>{
  const ui=await loadGameUI(t,{search}),b=ui.battle,before=snapshot(b);assert.equal(ui.visible('intro'),true);assert.equal(ui.get('introTitle').textContent,'Player lobby');assert.match(ui.get('start').textContent,/Start battle/);assert.equal(ui.visible('ending'),false);assert.equal(ui.visible('pauseOverlay'),false);
  ui.frames(120);assert.equal(snapshot(b),before);ui.click('start');ui.click('start');assert.equal(ui.battle,b);assert.equal(ui.visible('intro'),false);ui.frames(2);assert.ok(b.tick>JSON.parse(before).tick);assert.equal(b.profile.victories,0);assert.equal(b.profile.defeats,0);
 });
});

test('lobby Armory Loadout Army Settings and Save routes return without starting the demo',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=demo'}),b=ui.battle,before=snapshot(b);
 for(const [open,panel,close] of [['introArmory','shopPanel','closeShop'],['introLoadout','skillsPanel','closeSkills'],['introArmy','queuePanel','closeQueue'],['introSettings','settingsPanel','closeSettings'],['introSave','savePanel','closeSave']]){ui.click(open);assert.equal(ui.visible(panel),true);ui.frames(10);ui.click(close);assert.equal(ui.visible(panel),false);assert.equal(ui.visible('intro'),true);assert.equal(snapshot(b),before);}
 ui.click('introLoadout');ui.click('loadoutArmory');assert.equal(ui.get('closeShop').textContent,'Back to loadout');ui.click('closeShop');assert.equal(ui.visible('skillsPanel'),true);assert.equal(ui.get('closeSkills').textContent,'Back to lobby');ui.click('closeSkills');
 ui.click('introArmory');ui.click('shopLoadout');assert.equal(ui.get('closeSkills').textContent,'Back to armory');route(ui,'skillsPanel','settings');ui.click('closeSettings');assert.equal(ui.visible('intro'),true);assert.equal(snapshot(b),before);
});

test('prebattle purchases spend once and owned placement persists into the unchanged demo battle',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=demo'}),b=ui.battle;b.profile.gold=3001;ui.click('introArmory');ui.click('shopCatalogTab');const gold=b.profile.gold;ui.click('buy-pierceArrow');const bought=b.profile.skills.find(s=>s.id==='pierceArrow');assert.ok(bought);assert.equal(b.profile.gold,gold-3000);assert.equal(b.summary,null);assert.equal(b.profile.victories,0);assert.equal(b.stats.goldEarned,0);
 ui.click('buy-pierceArrow');assert.equal(b.profile.gold,gold-3000);ui.get('shopDetails').querySelector('[data-equip-page="0"]').click();ui.click('shop-slot-0');ui.click('shopEquipConfirm');assert.equal(bought.binding,0);ui.click('shopContinue');assert.equal(ui.visible('intro'),true);ui.click('start');ui.click('start');assert.equal(ui.battle,b);assert.equal(b.tick,1350);assert.equal(bought.binding,0);assert.equal(b.profile.gold,gold-3000);
});

test('entering an active lobby preserves the exact battlefield through management, Escape, P and resume',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=demo'});ui.click('start');ui.frames(40);ui.click('battlePause');ui.click('pauseLobby');const b=ui.battle,before=snapshot(b);assert.equal(ui.visible('intro'),true);assert.equal(ui.visible('pauseOverlay'),false);assert.equal(ui.get('start').textContent,'Resume battle 13');
 ui.key('keydown','Escape');ui.key('keydown','p');ui.click('battlePause');ui.frames(40);assert.equal(snapshot(b),before);assert.equal(b.paused,true);
 ui.click('introLoadout');ui.click('closeSkills');ui.click('introArmy');ui.click('closeQueue');ui.click('introSettings');ui.click('applySettings');ui.click('introSave');assert.match(ui.get('vaultStatus').textContent,/replaces this paused battlefield/);ui.click('closeSave');ui.frames(15);assert.equal(snapshot(b),before);
 ui.click('start');ui.click('start');assert.equal(ui.battle,b);assert.equal(b.paused,false);ui.frames();assert.ok(b.tick>JSON.parse(before).tick);
});

test('live lobby Armory blocks purchases with clear card copy while owned cards remain arrangeable',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=demo'});ui.click('start');ui.click('battlePause');ui.click('pauseLobby');const b=ui.battle,gold=b.profile.gold;ui.click('introArmory');assert.match(ui.get('shopStatus').textContent,/Finish this battle/);ui.click('shopCatalogTab');assert.equal(ui.get('buy-pierceArrow').disabled,true);assert.match(ui.get('buy-pierceArrow').textContent,/Finish this battle/);ui.click('buy-pierceArrow');assert.equal(b.profile.gold,gold);assert.equal(b.profile.owned.has('pierceArrow'),false);
 ui.click('buy-fireArrow');ui.click('shop-slot-0');ui.click('shopEquipConfirm');assert.equal(b.profile.skills.find(s=>s.id==='fireArrow').binding,0);ui.click('shopContinue');assert.equal(ui.visible('intro'),true);assert.equal(b.paused,true);assert.equal(b.profile.gold,gold);
});

test('prebattle same-tab destinations keep campaign data isolated and restore its original object',async t=>{
 const ui=await loadGameUI(t),campaign=ui.battle;campaign.profile.gold=321;const before=snapshot(campaign),urls=[];let popups=0;ui.window.open=()=>popups++;ui.window.history={replaceState:(state,title,url)=>urls.push(url)};
 switchTo(ui,'midgame');const demo=ui.battle;assert.notEqual(demo,campaign);assert.equal(demo.profile.gold,1120);assert.equal(demo.tick,1350);assert.equal(ui.visible('intro'),true);assert.equal(popups,0);demo.profile.gold=555;
 switchTo(ui,'allies');assert.equal(ui.battle.profile.name,'Allies Demo');assert.equal(ui.battle.profile.gold,1120);assert.ok(ui.battle.goodTeam.some(u=>u.type==='dragon_scout_fire'));assert.equal(ui.get('companionAction').disabled,true);
 switchTo(ui,'training');ui.click('introTesting');ui.click('testGoldLarge');ui.click('closeTesting');assert.equal(ui.battle.profile.cheated,true);switchTo(ui,'campaign');assert.equal(ui.battle,campaign);assert.equal(snapshot(campaign),before);switchTo(ui,'midgame');assert.equal(ui.battle,demo);assert.equal(demo.profile.gold,555);assert.equal(urls.at(-1),'./battle?mode=demo');
});

test('active destination switch supports cancel and restores the exact paused session on return',async t=>{
 const ui=await loadGameUI(t);ui.click('start');ui.frames(75);ui.click('battlePause');ui.click('pauseLobby');const campaign=ui.battle,before=snapshot(campaign);select(ui,'midgame');ui.click('start');assert.equal(ui.visible('switchSessionConfirm'),true);assert.match(ui.get('switchSessionText').textContent,/exact battlefield/);ui.frames(30);assert.equal(snapshot(campaign),before);ui.key('keydown','Escape');assert.equal(ui.visible('switchSessionConfirm'),false);assert.equal(ui.battle,campaign);
 ui.click('start');ui.click('confirmSessionSwitch');ui.frames();assert.equal(ui.battle.level,13);ui.click('start');ui.frames(5);ui.click('battlePause');ui.click('pauseLobby');const demo=ui.battle,demoBefore=snapshot(demo);switchTo(ui,'campaign');assert.equal(ui.battle,campaign);assert.equal(snapshot(campaign),before);assert.equal(ui.get('start').textContent,'Resume battle 1');ui.frames(30);assert.equal(snapshot(campaign),before);assert.equal(snapshot(demo),demoBefore);ui.click('start');ui.frames();assert.ok(campaign.tick>JSON.parse(before).tick);
});

test('Open separately and blocked-popup fallback preserve the current paused session',async t=>{
 const ui=await loadGameUI(t);ui.click('start');ui.frames(3);ui.click('battlePause');ui.click('pauseLobby');const b=ui.battle,before=snapshot(b),opened=[];ui.window.open=(url,name)=>{opened.push({url,name});return {opener:null};};select(ui,'allies');ui.click('start');ui.click('separateSessionSwitch');assert.deepEqual(opened,[{url:'./battle?mode=demo&showcase=companions',name:'_blank'}]);assert.equal(ui.visible('switchSessionConfirm'),false);assert.equal(snapshot(b),before);
 ui.window.open=()=>null;ui.click('hubOpenSeparate');const link=ui.get('introNotice').querySelector('a');assert.equal(link.getAttribute('href').replaceAll('&amp;','&'),'./battle?mode=demo&showcase=companions');assert.equal(link.getAttribute('target'),'_blank');assert.equal(snapshot(b),before);
});

test('hub cannot interrupt pending settlement; settled result starts the next battle once',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=test'});ui.click('introTesting');ui.click('testVictory');const finished=ui.battle;assert.equal(finished.outcome,'victory');assert.equal(finished.summary,null);ui.click('endingLobby');assert.equal(ui.visible('intro'),false);ui.frames(105);assert.equal(finished.summary.outcome,'victory');assert.equal(finished.profile.victories,1);const gold=finished.profile.gold;ui.click('endingLobby');assert.equal(ui.get('start').textContent,'Start battle 2');ui.frames(40);assert.equal(finished.profile.gold,gold);ui.click('start');const next=ui.battle;ui.click('start');assert.notEqual(next,finished);assert.equal(ui.battle,next);assert.equal(next.level,2);assert.equal(next.profile.victories,1);
});

test('existing save bundles still import into a ready lobby at the saved battle start',async t=>{
 const p=new PlayerProfile('Saved');p.highestLevel=7;p.highestScene=8;p.level=7;p.scene=8;p.gold=999;const bundle=new CampaignProfiles({profiles:[p]}).exportBundle();const ui=await loadGameUI(t);ui.click('introLoad');ui.get('loadCode').value=bundle;ui.click('importCode');assert.equal(ui.visible('intro'),true);assert.equal(ui.battle.level,7);assert.equal(ui.battle.tick,0);assert.equal(ui.battle.profile.gold,999);assert.equal(ui.battle.profile.cheated,false);assert.match(ui.get('saveStatus').textContent,/restart its saved battle/);ui.click('start');assert.equal(ui.battle.level,7);
});

test('session switching preserves actual shooter controls, live companion and per-battle input adapter',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=demo&showcase=companions&aim=auto_aim'});
 ui.click('introSettings');ui.get('trajectory').value='0';ui.dispatch(ui.get('trajectory'),'change');ui.get('showAssist').checked=true;ui.dispatch(ui.get('showAssist'),'change');ui.click('openAim');ui.get('battleAngle').value='37';ui.get('battlePower').value='72';ui.dispatch(ui.get('battlePower'),'input');ui.click('applyAim');ui.click('applySettings');ui.click('start');ui.click('companionAction');ui.frames(5);ui.click('battlePause');ui.click('pauseLobby');
 const allies=ui.battle,companion=allies.companions.unit,signature=companion.signatureCooldown,before=snapshot(allies);assert.ok(companion);assert.equal(allies.shooter.angleMode,0);assert.equal(allies.shooter.powerPercent,72);
 switchTo(ui,'training');ui.click('introTesting');ui.click('testGoldLarge');ui.click('testUnlock');ui.click('closeTesting');ui.click('start');ui.frames();ui.click('battlePause');ui.click('pauseLobby');const training=ui.battle;switchTo(ui,'allies');assert.equal(ui.battle,allies);assert.equal(snapshot(allies),before);assert.equal(allies.companions.unit,companion);assert.equal(companion.signatureCooldown,signature);assert.equal(ui.get('trajectory').value,'0');assert.equal(ui.get('battleAngle').value,'37');assert.equal(ui.get('battlePower').value,'72');assert.equal(ui.get('showAssist').checked,true);assert.equal(allies.shooter.angleMode,0);assert.equal(allies.shooter.powerPercent,72);
 ui.click('start');ui.frames();ui.click('companionAction');assert.ok(companion.signatureCooldown>signature);ui.click('battlePause');ui.click('pauseLobby');switchTo(ui,'training');assert.equal(ui.battle,training);assert.equal(ui.get('trajectory').value,'1');assert.equal(ui.get('battlePower').value,'100');assert.equal(ui.get('showAssist').checked,false);ui.click('start');ui.frames();for(let page=0;page<3&&!ui.document.querySelector('#quick-grunt');page++)ui.click('nextBar');assert.ok(ui.document.querySelector('#quick-grunt'));const gold=training.profile.gold;ui.click('quick-grunt');ui.frames();assert.equal(training.profile.gold,gold-20);assert.equal(allies.companions.unit,companion);
});

test('same-tab demo return restores the preserved campaign instead of closing the tab',async t=>{
 const ui=await loadGameUI(t),campaign=ui.battle;let closes=0;ui.window.close=()=>closes++;switchTo(ui,'midgame');assert.match(ui.get('demoReturnNote').textContent,/preserved in this tab/);ui.click('demoReturn');ui.frames();assert.equal(ui.battle,campaign);assert.equal(closes,0);assert.equal(ui.visible('intro'),true);
});
