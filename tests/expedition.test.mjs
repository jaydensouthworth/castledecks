import test from 'node:test';
import assert from 'node:assert/strict';
import {EXPEDITION_FIELDS,EXPEDITION_LENGTH,EXPEDITION_STARTER,createExpeditionEncounter,encounterSeed} from '../site/dist/expedition-data.mjs';
import {ExpeditionRun,ExpeditionProfiles,restoreExpeditions,validateExpeditionState,EXPEDITION_SAVE_SCHEMA} from '../site/dist/expedition-model.mjs';
import {ExpeditionBattle} from '../site/dist/expedition-battle.mjs';
import {validateBattleEncounter} from '../site/dist/engine/battle-encounter.mjs';
import {CampaignBattle} from '../site/dist/engine/first-battle.mjs';
import {CampaignProfiles} from '../site/dist/engine/profile-manager.mjs';
import {PlayerProfile,serializeProfile} from '../site/dist/engine/progression.mjs';
import {seededRandom} from '../site/dist/engine/combat.mjs';
import {FLAG_STATUS as FS} from '../site/dist/engine/flag-troop.mjs';
import {LEVELS} from '../site/dist/engine/levels.mjs';
import {loadGameUI,deferredFile} from './helpers/game-ui-harness.mjs';
const settle=(battle,outcome='victory')=>{battle.finishOutcome(outcome);for(let i=0;i<110&&!battle.summary;i++)battle.step();assert.ok(battle.summary);return battle.summary;};
const newRun=()=>new ExpeditionRun({seed:719});
const winField=run=>{const battle=new ExpeditionBattle({run});settle(battle);return battle;};
const arrive=(run,id)=>{if(run.current.id==='tollgate'&&id!=='tollgate'){winField(run);assert.equal(run.choose(['skyglass','sunken'].includes(id)?id:'skyglass'),true);}if(['ember','frost','stormcrown'].includes(id)&&run.current.leg===2){winField(run);assert.equal(run.choose(id==='stormcrown'?'ember':id),true);}if(id==='stormcrown'&&run.current.leg===3){winField(run);assert.equal(run.choose(id),true);}return new ExpeditionBattle({run});};
const chooseDestination=(ui,id)=>{ui.get('hubDestinations').querySelector(`[data-hub-destination="${id}"]`).click();ui.click('start');if(ui.visible('switchSessionConfirm'))ui.click('confirmSessionSwitch');ui.frames();};
const finishUI=(ui,outcome='victory')=>{ui.battle.finishOutcome(outcome);ui.frames(105);assert.ok(ui.battle.summary);};
const chooseRoad=(ui,id)=>{ui.click('replay');assert.equal(ui.visible('expeditionPanel'),true);ui.get('expeditionRouteHost').querySelector(`[data-charter-choice="${id}"]`).click();};

test('six authored fields form exactly four complete four-leg routes',()=>{
 assert.equal(Object.keys(EXPEDITION_FIELDS).length,6);const routes=[];const visit=(id,path)=>{const field=EXPEDITION_FIELDS[id],next=[...path,id];assert.equal(field.leg,next.length);if(!field.next.length)routes.push(next);else field.next.forEach(id=>visit(id,next));};visit('tollgate',[]);assert.equal(routes.length,4);for(const route of routes){assert.equal(route.length,EXPEDITION_LENGTH);assert.equal(route.at(-1),'stormcrown');}
});
test('all expedition compositions and terrain are independently authored playable data',()=>{
 for(const field of Object.values(EXPEDITION_FIELDS)){const data=createExpeditionEncounter(field.id,seededRandom(22)),checked=validateBattleEncounter(data);assert.equal(checked.roster.length,Object.values(field.counts).reduce((n,c)=>n+c,0));assert.equal(checked.heights.length,101);assert.ok(checked.heights.every(Number.isFinite));assert.ok(LEVELS.every(l=>JSON.stringify(l.heights)!==JSON.stringify(checked.heights)));assert.ok(Object.isFrozen(checked));assert.ok(Object.isFrozen(checked.roster));assert.equal(field.objective==='break-keep',checked.objective==='break-keep');}
});
test('encounter data rejects malformed input before actor/profile construction',()=>{
 const valid=createExpeditionEncounter('tollgate',seededRandom(1));for(const bad of [{...valid,extra:1},{...valid,heights:[1]},{...valid,heights:Array(101).fill(NaN)},{...valid,roster:['imaginary']},{...valid,roster:[]},{...valid,towers:[1000,1000]},{...valid,enemyKeepHP:Infinity},{...valid,objective:'fake'}])assert.throws(()=>validateBattleEncounter(bad));
 const p=new PlayerProfile(),before=serializeProfile(p);assert.throws(()=>new CampaignBattle({profile:p,encounter:{...valid,enemyKeepHP:0}}));assert.equal(serializeProfile(p),before);
});
test('declared starting kit is isolated and never claims prior victories',()=>{
 const normal=new PlayerProfile(),before=serializeProfile(normal),one=newRun(),two=newRun();assert.equal(one.profile.rank,EXPEDITION_STARTER.rank);assert.equal(one.profile.gold,EXPEDITION_STARTER.gold);assert.deepEqual([...one.profile.owned],EXPEDITION_STARTER.skills);assert.equal(one.profile.cheated,false);assert.equal(one.profile.victories,0);assert.equal(one.profile.highestLevel,1);one.profile.gold-=20;assert.equal(two.profile.gold,1000);assert.equal(serializeProfile(normal),before);
});
test('same charter and field seeds reproduce rosters, terrain and initial battle stats',()=>{
 const a=newRun(),b=newRun(),ba=new ExpeditionBattle({run:a}),bb=new ExpeditionBattle({run:b});assert.deepEqual(ba.enemies.roster,bb.enemies.roster);assert.deepEqual(ba.levelData.heights,bb.levelData.heights);assert.equal(ba.badCastle.hp,5200);assert.equal(ba.goodCastle.hp,9600);assert.equal(ba.expeditionSeed,bb.expeditionSeed);assert.notEqual(encounterSeed(719,'skyglass'),encounterSeed(719,'sunken'));assert.equal(a.profile.level,1);assert.equal(a.profile.highestScene,1);
 for(let i=0;i<100;i++){ba.step();bb.step();}assert.deepEqual(ba.badTeam.map(u=>[u.type,u.x,u.y,u.hp]),bb.badTeam.map(u=>[u.type,u.x,u.y,u.hp]));
});
test('optional encounters preserve standard campaign construction and default roster bounds',()=>{
 const p1=new PlayerProfile(),p2=new PlayerProfile();const a=new CampaignBattle({profile:p1,random:seededRandom(888)}),b=new CampaignBattle({profile:p2,random:seededRandom(888),encounter:null});assert.equal(a.encounter,null);assert.deepEqual(a.enemies.roster,b.enemies.roster);assert.equal(a.enemies.roster.length,27);assert.equal(a.badCastle.hp,8266);assert.deepEqual(a.levelData,LEVELS[0]);for(let i=0;i<70;i++){a.step();b.step();}assert.deepEqual(a.badTeam.map(u=>[u.type,u.x,u.y]),b.badTeam.map(u=>[u.type,u.x,u.y]));
});
test('siege never wins from empty reserves or a returned enemy flag alone',()=>{
 const run=newRun(),b=arrive(run,'skyglass');b.enemies.index=b.enemies.roster.length;b.badTeam.length=0;b.checkOutcome();assert.equal(b.outcome,null);b.enemyFlag.status=FS.CAPTURED;b.ownFlag.status=FS.AT_BASE;b.checkOutcome();assert.equal(b.outcome,null);b.badCastle.takeDamage(b.badCastle.hp);assert.equal(b.outcome,'victory');assert.equal(b.summary,null);assert.equal(run.state.cleared,1);while(!b.summary)b.step();assert.equal(run.state.cleared,2);assert.equal(run.choosing,true);
});
test('siege independently loses its home flag even after returning the enemy flag',()=>{
 const run=newRun(),b=arrive(run,'skyglass');b.enemyFlag.status=FS.CAPTURED;b.ownFlag.status=FS.CAPTURED;b.checkOutcome();assert.equal(b.outcome,'defeat');while(!b.summary)b.step();assert.equal(run.state.cleared,1);assert.equal(run.choosing,false);assert.equal(run.profile.highestLevel,1);
});
test('siege loss takes precedence when hero and enemy keep fall together',()=>{
 const run=newRun(),b=arrive(run,'ember');b.hero.dead=true;b.badCastle.hp=0;b.checkOutcome();assert.equal(b.outcome,'defeat');
});
test('standard charter field still permits ordinary flag and complete elimination victory',()=>{
 for(const kind of ['flag','elimination']){const run=newRun(),b=new ExpeditionBattle({run});if(kind==='flag'){b.enemyFlag.status=FS.CAPTURED;b.ownFlag.status=FS.AT_BASE;}else{b.enemies.index=b.enemies.roster.length;b.badTeam.length=0;}b.checkOutcome();assert.equal(b.outcome,'victory');}
});
test('settlement records once after countdown and never advances generic Crownroad fields',()=>{
 const run=newRun(),b=new ExpeditionBattle({run}),start=serializeProfile(run.profile);assert.equal(run.choose('skyglass'),false);b.finishOutcome('victory');assert.equal(run.choosing,false);assert.equal(run.state.cleared,0);while(!b.summary)b.step();const saved=run.exportState(),gold=run.profile.gold,wins=run.profile.victories;assert.equal(run.state.cleared,1);assert.equal(run.choosing,true);for(let i=0;i<100;i++)b.step();assert.equal(run.record(b),false);assert.equal(run.profile.gold,gold);assert.equal(run.profile.victories,wins);assert.deepEqual(run.exportState(),saved);assert.equal(run.profile.level,JSON.parse(start).level);assert.equal(run.profile.highestLevel,1);
});
test('wrong route choices and result receipts cannot mutate an active run',()=>{
 const run=newRun(),before=run.exportState();assert.equal(run.choose('stormcrown'),false);assert.deepEqual(run.exportState(),before);assert.throws(()=>run.record({profile:run.profile,encounter:{id:'skyglass'},summary:{outcome:'victory'}}));winField(run);assert.equal(run.choose('ember'),false);assert.equal(run.choose('sunken'),true);assert.equal(run.choose('skyglass'),false);assert.equal(run.current.id,'sunken');
});
test('every branch path completes four actual settlements with a final normal bonus',()=>{
 for(const second of ['skyglass','sunken'])for(const third of ['ember','frost']){const run=newRun();winField(run);run.choose(second);winField(run);run.choose(third);winField(run);run.choose('stormcrown');const final=winField(run);assert.equal(run.complete,true);assert.equal(run.profile.victories,4);assert.equal(run.profile.highestLevel,1);assert.equal(final.summary.campaignComplete,true);assert.equal(final.summary.expeditionComplete,true);assert.equal(run.choices.length,0);assert.equal(run.retry(),false);assert.equal(run.choose('tollgate'),false);}
});
test('retry uses the same field seed, does not duplicate result or grant new starter resources',()=>{
 const run=newRun(),b=new ExpeditionBattle({run}),roster=[...b.enemies.roster];run.profile.gold=880;settle(b,'defeat');const defeats=run.profile.defeats,gold=run.profile.gold;assert.equal(run.retry(),true);const again=new ExpeditionBattle({run});assert.deepEqual(again.enemies.roster,roster);assert.equal(again.summary,null);assert.equal(run.profile.gold,gold);assert.equal(run.profile.defeats,defeats);assert.equal(run.state.cleared,0);
});
test('save envelope round-trips current field, exact route, profile and deterministic seed',()=>{
 const manager=new ExpeditionProfiles({seedFactory:()=>719}),run=manager.activeRun;winField(run);run.choose('sunken');run.profile.gold+=123;const b=new ExpeditionBattle({run});for(let i=0;i<35;i++)b.step();const text=manager.exportBundle(),loaded=restoreExpeditions(text),fresh=new ExpeditionBattle({run:loaded.activeRun});assert.equal(JSON.parse(text).schema,EXPEDITION_SAVE_SCHEMA);assert.deepEqual(loaded.activeRun.exportState(),run.exportState());assert.equal(serializeProfile(loaded.active),serializeProfile(run.profile));assert.equal(fresh.tick,0);assert.equal(fresh.summary,null);assert.deepEqual(fresh.enemies.roster,b.enemies.roster);
});
test('saved victory restores a read-only result and route choice without re-awarding',()=>{
 const manager=new ExpeditionProfiles({seedFactory:()=>719});winField(manager.activeRun);const text=manager.exportBundle(),loaded=restoreExpeditions(text),gold=loaded.active.gold,wins=loaded.active.victories,b=new ExpeditionBattle({run:loaded.activeRun});assert.equal(b.summary.outcome,'victory');assert.equal(loaded.activeRun.choosing,true);for(let i=0;i<200;i++)b.step();assert.equal(loaded.active.gold,gold);assert.equal(loaded.active.victories,wins);assert.equal(loaded.exportBundle(),text);
});
test('saved defeat restores retry and final result restores completed route',()=>{
 const manager=new ExpeditionProfiles({seedFactory:()=>22});settle(new ExpeditionBattle({run:manager.activeRun}),'defeat');let loaded=restoreExpeditions(manager.exportBundle());assert.equal(new ExpeditionBattle({run:loaded.activeRun}).summary.outcome,'defeat');assert.equal(loaded.activeRun.state.cleared,0);loaded.activeRun.retry();arrive(loaded.activeRun,'stormcrown');winField(loaded.activeRun);loaded=restoreExpeditions(loaded.exportBundle());const result=new ExpeditionBattle({run:loaded.activeRun});assert.equal(result.summary.campaignComplete,true);assert.equal(loaded.activeRun.complete,true);
});
test('normal and charter save codecs cannot silently cross-import',()=>{
 const normal=new CampaignProfiles(),charter=new ExpeditionProfiles({seedFactory:()=>1}),a=normal.exportBundle(),b=charter.exportBundle();assert.throws(()=>normal.importBundle(b));assert.throws(()=>charter.importBundle(a));assert.equal(normal.exportBundle(),a);assert.equal(charter.exportBundle(),b);
});
test('hostile or contradictory charter records are rejected transactionally',()=>{
 const manager=new ExpeditionProfiles({seedFactory:()=>7}),valid=manager.exportBundle();const mutate=fn=>{const data=JSON.parse(valid);fn(data);return JSON.stringify(data);};
 const bad=['not json',mutate(d=>d.extra=1),mutate(d=>d.schema='future'),mutate(d=>d.campaign='other'),mutate(d=>d.runs=[]),mutate(d=>d.runs[0].seed=0),mutate(d=>d.runs[0].seed=Infinity),mutate(d=>d.runs[0].path=['stormcrown']),mutate(d=>d.runs[0].path=['tollgate','ember']),mutate(d=>d.runs[0].cleared=1),mutate(d=>d.runs[0].lastResult={}),mutate(d=>d.profiles.profiles[0].profile.gold='1000')];
 for(const text of bad){assert.throws(()=>manager.importBundle(text));assert.equal(manager.exportBundle(),valid);}
});
test('multiple banners, restart, deletion and completed archive keep other runs intact',()=>{
 const m=new ExpeditionProfiles({seedFactory:()=>77}),original=m.active;winField(m.activeRun);m.create('Second',{shootingMode:'auto_aim'});const second=m.active,secondRun=m.activeRun;second.gold=650;m.select(0);const old=m.active,oldSeed=m.activeRun.state.seed;const fresh=m.restartCurrent();assert.notEqual(fresh,old);assert.equal(fresh.gold,1000);assert.equal(m.activeRun.state.seed,oldSeed);assert.equal(m.runs.get(second),secondRun);assert.equal(second.gold,650);assert.throws(()=>m.retireCurrent());const run=m.activeRun;arrive(run,'stormcrown');winField(run);m.retireCurrent();assert.equal(m.retired.length,1);assert.equal(m.active,second);assert.equal(m.active.gold,650);const restored=restoreExpeditions(m.exportBundle());assert.equal(restored.retired.length,1);assert.equal(restored.runs.get(restored.retired[0]).complete,true);assert.equal(original.gold,1000);assert.equal(original.victories,1);
});
test('deleting or archiving the final banner leaves a valid starting charter',()=>{
 const m=new ExpeditionProfiles({seedFactory:()=>88});assert.equal(m.deleteCurrent(),null);arrive(m.activeRun,'stormcrown');winField(m.activeRun);m.retireCurrent();assert.equal(m.active.gold,1000);assert.equal(m.active.rank,4);assert.equal(m.activeRun.current.id,'tollgate');assert.equal(m.activeRun.state.cleared,0);assert.equal(m.retired.length,1);
});
test('direct expedition entry is frozen, honest starter kit and separate from practice',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=expedition'}),b=ui.battle;assert.ok(b instanceof ExpeditionBattle);assert.equal(ui.visible('intro'),true);assert.equal(b.tick,0);assert.equal(b.profile.cheated,false);assert.equal(b.profile.gold,1000);assert.match(ui.get('start').textContent,/Start The Tollgate/);assert.equal(ui.visible('introAtlas'),false);assert.equal(ui.visible('introRoute'),true);ui.frames(25);assert.equal(b.tick,0);ui.click('introRoute');assert.equal(ui.visible('expeditionPanel'),true);assert.match(ui.get('expeditionRouteHost').textContent,/declared starting supplies/);assert.equal(ui.get('expeditionRouteHost').querySelectorAll('[data-charter-choice]').length,0);ui.click('charterReturn');ui.click('start');ui.frames(2);assert.ok(b.tick>0);assert.match(ui.get('combatBattleTitle').textContent,/Charter/);
});
test('won field exposes real branch selection, retains earnings and never auto-starts next field',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=expedition'});ui.click('start');finishUI(ui);const old=ui.battle,gold=old.profile.gold;assert.match(ui.get('replay').textContent,/Choose your next road/);chooseRoad(ui,'skyglass');const next=ui.battle;assert.notEqual(next,old);assert.equal(next.encounter.id,'skyglass');assert.equal(next.encounter.objective,'break-keep');assert.equal(next.profile.gold,gold);assert.equal(next.tick,0);assert.equal(ui.visible('intro'),true);ui.frames(10);assert.equal(next.tick,0);ui.click('start');ui.frames(2);assert.match(ui.get('combatEnemyState').textContent,/Break keep/);
});
test('live route inspection and cancel restart preserve exact active battle',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=expedition'});ui.click('start');ui.frames(25);ui.click('battlePause');ui.click('pauseRoute');const b=ui.battle,tick=b.tick,gold=b.profile.gold;ui.click('charterRestart');assert.equal(ui.visible('charterResetConfirm'),true);ui.key('keydown','Escape');assert.equal(ui.visible('charterResetConfirm'),false);assert.equal(ui.visible('expeditionPanel'),true);ui.frames(20);assert.equal(b.tick,tick);assert.equal(b.profile.gold,gold);ui.click('charterReturn');assert.equal(ui.visible('intro'),true);ui.click('start');assert.equal(ui.battle,b);ui.frames(2);assert.ok(b.tick>tick);
});
test('explicit charter restart resets only this banner and requires Start again',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=expedition'});ui.battle.profile.gold=321;ui.click('start');ui.frames(10);ui.click('battlePause');ui.click('pauseRoute');const old=ui.battle,seed=old.expeditionRun.state.seed;ui.click('charterRestart');ui.click('confirmCharterReset');assert.notEqual(ui.battle,old);assert.equal(ui.battle.profile.gold,1000);assert.equal(ui.battle.expeditionRun.state.seed,seed);assert.equal(ui.battle.tick,0);assert.equal(ui.visible('intro'),true);assert.equal(ui.battle.profile.victories,0);
});
test('same-tab expedition switching preserves exact campaign and charter sessions',async t=>{
 const ui=await loadGameUI(t),campaign=ui.battle;campaign.profile.gold=333;chooseDestination(ui,'expedition');const charter=ui.battle;assert.equal(charter.profile.gold,1000);ui.click('start');ui.frames(12);ui.click('battlePause');ui.click('pauseLobby');const tick=charter.tick;chooseDestination(ui,'campaign');assert.equal(ui.battle,campaign);assert.equal(campaign.profile.gold,333);chooseDestination(ui,'expedition');assert.equal(ui.battle,charter);assert.equal(charter.tick,tick);assert.equal(charter.paused,true);assert.match(ui.get('start').textContent,/Resume/);
});
test('UI save/load after victory restores route choice and rewards without replaying settlement',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=expedition'});ui.click('start');finishUI(ui);ui.click('endingSave');ui.click('showSaveCode');const code=ui.get('saveCode').value,gold=ui.battle.profile.gold,wins=ui.battle.profile.victories;assert.equal(JSON.parse(code).schema,EXPEDITION_SAVE_SCHEMA);ui.get('loadCode').value=code;ui.click('importCode');assert.equal(ui.battle.tick,0);assert.equal(ui.battle.profile.gold,gold);assert.equal(ui.battle.profile.victories,wins);assert.ok(ui.battle.summary);assert.equal(ui.visible('intro'),true);assert.match(ui.get('start').textContent,/Choose/);ui.frames(130);assert.equal(ui.battle.profile.gold,gold);ui.click('start');assert.equal(ui.visible('expeditionPanel'),true);assert.equal(ui.get('expeditionRouteHost').querySelectorAll('[data-charter-choice]').length,2);
});
test('UI rejects wrong-mode saves and stale file reads without altering current charter',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=expedition'}),b=ui.battle;ui.click('introLoad');ui.get('loadCode').value=new CampaignProfiles().exportBundle();ui.click('importCode');assert.equal(ui.battle,b);assert.match(ui.get('vaultStatus').textContent,/not a valid Wayfarer/);const pendingFile=deferredFile(),pending=ui.load(pendingFile.file);ui.click('closeSave');ui.click('start');pendingFile.resolve(new ExpeditionProfiles({seedFactory:()=>999}).exportBundle());await pending;assert.equal(ui.battle,b);
});
test('UI completes and archives a four-leg charter without a fake 30-battle message',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=expedition'});for(const next of ['sunken','frost','stormcrown']){ui.click('start');finishUI(ui);chooseRoad(ui,next);}ui.click('start');finishUI(ui);assert.equal(ui.battle.summary.expeditionComplete,true);assert.equal(ui.get('endingTitle').textContent,'Charter complete');assert.match(ui.get('endingText').textContent,/Four fields won/);assert.doesNotMatch(ui.get('endingText').textContent,/30 battles/);const finished=ui.battle;ui.click('replay');assert.notEqual(ui.battle,finished);assert.equal(ui.battle.profile.gold,1000);assert.equal(ui.battle.expeditionRun.state.cleared,0);assert.equal(ui.visible('intro'),true);assert.equal(ui.battle.tick,0);
});
test('importing a completed charter from a live field leaves a visible completion lobby',async t=>{
 const saved=new ExpeditionProfiles({seedFactory:()=>41});arrive(saved.activeRun,'stormcrown');winField(saved.activeRun);const code=saved.exportBundle();
 const ui=await loadGameUI(t,{search:'?mode=expedition'});ui.click('start');ui.frames(10);ui.click('battlePause');ui.click('loadGame');ui.get('loadCode').value=code;ui.click('importCode');assert.equal(ui.battle.summary.expeditionComplete,true);assert.equal(ui.visible('intro'),true);assert.match(ui.get('start').textContent,/Archive/);assert.equal(ui.visible('savePanel'),false);const gold=ui.battle.profile.gold;ui.frames(50);assert.equal(ui.battle.profile.gold,gold);
});
test('repeated stale choice clicks cannot select a second route or advance without victory',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=expedition'});ui.click('start');finishUI(ui);ui.click('replay');const first=ui.get('expeditionRouteHost').querySelector('[data-charter-choice="skyglass"]'),second=ui.get('expeditionRouteHost').querySelector('[data-charter-choice="sunken"]');first.click();second.click();first.click();assert.equal(ui.battle.encounter.id,'skyglass');assert.deepEqual(ui.battle.expeditionRun.state.path,['tollgate','skyglass']);assert.equal(ui.battle.expeditionRun.state.cleared,1);assert.equal(ui.battle.tick,0);
});
test('charter profile creation and selection retain distinct supplied kits and route state',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=expedition'});const first=ui.battle.profile;first.gold=700;ui.click('introProfiles');assert.equal(ui.get('profilesTitle').textContent,'Charter banners');ui.get('newProfileName').value='Other';ui.click('createProfile');assert.notEqual(ui.battle.profile,first);assert.equal(ui.battle.profile.gold,1000);assert.equal(ui.battle.profile.rank,4);assert.equal(ui.battle.encounter.id,'tollgate');ui.click('introProfiles');ui.get('profileSelect').value='0';ui.click('switchProfile');assert.equal(ui.battle.profile,first);assert.equal(first.gold,700);
});
test('charter loadout and armory continuation names the route instead of a fake next battle',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=expedition'});ui.click('introLoadout');assert.match(ui.get('loadoutContinue').textContent,/Tollgate/);ui.click('closeSkills');ui.click('start');finishUI(ui);ui.click('endingLoadout');assert.match(ui.get('loadoutContinue').textContent,/Choose your next road/);ui.click('closeSkills');ui.click('endingShop');assert.match(ui.get('shopContinue').textContent,/Choose your next road/);
});
test('standard charter objectives retain real enemy and reserve HUD counts',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=expedition'});ui.click('start');ui.frames(2);assert.match(ui.get('combatEnemyState').textContent,/enemies.*incoming/);ui.battle.enemies.index=ui.battle.enemies.roster.length;ui.battle.badTeam.push({hp:1,dead:false,destroyed:false});ui.click('battlePause');assert.match(ui.get('combatEnemyState').textContent,/enemies/);
});

test('restoring charter active and retired runs preserves fixed seeds without requesting randomness',t=>{
 const manager=new ExpeditionProfiles({seedFactory:()=>131});arrive(manager.activeRun,'stormcrown');winField(manager.activeRun);manager.retireCurrent();manager.create('Second');const text=manager.exportBundle(),originalRandom=Math.random;
 t.after(()=>Math.random=originalRandom);let calls=0;const forbidden=()=>{calls++;throw new Error('Restoration requested a new seed');};Math.random=forbidden;
 const restored=restoreExpeditions(text,{seedFactory:forbidden});assert.equal(restored.exportBundle(),text);restored.importBundle(text);assert.equal(restored.exportBundle(),text);const run=new ExpeditionRun({profile:restored.active,state:restored.activeRun.exportState()});assert.equal(run.state.seed,131);assert.equal(calls,0);
});
