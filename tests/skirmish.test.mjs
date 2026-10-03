import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadGameUI,deferredFile} from './helpers/game-ui-harness.mjs';
import {createSkirmish,DEFAULT_SKIRMISH,SKIRMISH_KIT,encodeSkirmishDescriptor,decodeSkirmishDescriptor} from '../site/dist/skirmish-model.mjs';
import {SkirmishBattle,SkirmishProfiles} from '../site/dist/skirmish-battle.mjs';
import {CampaignProfiles} from '../site/dist/engine/profile-manager.mjs';
import {PlayerProfile} from '../site/dist/engine/progression.mjs';
const select=(ui,id)=>ui.click('intro'+({campaign:'Campaign',skirmish:'Skirmish',training:'Training',midgame:'Demo'}[id]));
const switchTo=(ui,id)=>{select(ui,id);ui.click('start');if(ui.visible('switchSessionConfirm'))ui.click('confirmSessionSwitch');ui.frames();};
const snapshot=b=>JSON.stringify({tick:b.tick,profile:JSON.parse(new CampaignProfiles({profiles:[b.profile]}).exportBundle()),remaining:b.enemies.remaining,gold:b.profile.gold,own:b.ownFlag.status,enemy:b.enemyFlag.status});

test('Skirmish profile is supplied, unexportable and cannot accept a campaign',()=>{
 const s=createSkirmish(),manager=new SkirmishProfiles(s),p=manager.active;
 assert.equal(p.cheated,true);assert.equal(p.rank,SKIRMISH_KIT.rank);assert.equal(p.gold,SKIRMISH_KIT.gold);assert.equal(p.victories,0);assert.equal(p.highestLevel,1);assert.equal(manager.canCreate,false);assert.ok(p.skills.every(skill=>skill.autocast===false));
 assert.throws(()=>manager.exportBundle(),/seed code/);assert.throws(()=>manager.importBundle(new CampaignProfiles().exportBundle()),/cannot/);assert.equal(manager.create('no'),null);
 const ordinary=new PlayerProfile('Earned');ordinary.cheated=true;assert.throws(()=>new SkirmishBattle({descriptor:DEFAULT_SKIRMISH,profile:ordinary}),/own assisted/);
 const b=new SkirmishBattle({descriptor:DEFAULT_SKIRMISH,profile:p});assert.throws(()=>new SkirmishBattle({descriptor:DEFAULT_SKIRMISH,profile:p}),/own assisted/);assert.equal(b.friendlyQueue.population,70);
});
test('ordinary battle adapter keeps seeded setup, fresh supplies and fixed challenge on settings',()=>{
 const a=new SkirmishBattle({descriptor:DEFAULT_SKIRMISH}),b=new SkirmishBattle({descriptor:DEFAULT_SKIRMISH});
 assert.deepEqual(a.encounter,b.encounter);assert.notEqual(a.profile,b.profile);
 for(let n=0;n<1000;n++){a.step();b.step();}assert.equal(snapshot(a),snapshot(b));assert.deepEqual(a.badTeam.map(u=>[u.type,u.x,u.y,u.hp]),b.badTeam.map(u=>[u.type,u.x,u.y,u.hp]));
 a.applyOptions({difficulty:'insane',shootingMode:'auto_aim'});assert.equal(a.profile.difficulty,'medium');assert.equal(a.profile.shootingMode,'auto_aim');
});
test('direct Skirmish route opens a frozen workshop with exact preview and company',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=skirmish'}),b=ui.battle;
 assert.equal(ui.visible('skirmishPanel'),true);assert.equal(b.profile.cheated,true);assert.equal(ui.get('skirmishCode').value,b.skirmish.code);assert.match(ui.get('skirmishPreview').textContent,new RegExp(b.enemies.roster.length+' enemies'));
 ui.frames(20);assert.equal(b.tick,0);ui.click('skirmishPrepare');assert.equal(ui.visible('skirmishPanel'),false);assert.equal(ui.visible('intro'),true);assert.equal(ui.battle.tick,0);ui.frames(20);assert.equal(ui.battle.tick,0);ui.click('start');ui.frames(5);assert.ok(ui.battle.tick>0);
});
test('all seed edit paths reject invalid values without replacing current battle',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=skirmish'}),b=ui.battle;
 for(const value of ['','0','-1','1.2','1e3','4294967296','<img src=x>']){ui.get('skirmishSeed').value=value;ui.dispatch(ui.get('skirmishSeed'),'change');assert.equal(ui.get('skirmishPrepare').disabled,true);ui.click('skirmishPrepare');assert.equal(ui.battle,b);}
 ui.get('skirmishCode').value='SK9:1:oaks:standard:vanguard';ui.click('skirmishLoadCode');assert.match(ui.get('skirmishStatus').textContent,/different/);assert.equal(ui.battle,b);
 const d={...DEFAULT_SKIRMISH,seed:4294967295,biome:'pines',doctrine:'skywatch',threat:'veteran'};ui.get('skirmishCode').value=encodeSkirmishDescriptor(d);ui.click('skirmishLoadCode');assert.equal(ui.get('skirmishPrepare').disabled,false);ui.click('skirmishPrepare');assert.deepEqual(ui.battle.skirmish.descriptor,d);assert.equal(ui.battle.profile.difficulty,'hard');
});
test('paste code and preview preserve exact heights roster towers keep and seed',async t=>{
 const d={...DEFAULT_SKIRMISH,seed:91,biome:'wasteland',doctrine:'siege',threat:'scout'},expected=createSkirmish(d);
 const ui=await loadGameUI(t,{search:'?mode=skirmish&sk='+encodeURIComponent(expected.code)});assert.equal(ui.get('skirmishCode').value,expected.code);assert.deepEqual(ui.battle.encounter,expected.encounter);ui.click('skirmishPrepare');assert.deepEqual(ui.battle.encounter,expected.encounter);
});
test('invalid URL code is disclosed and does not import profile state',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=skirmish&sk=garbage'});assert.match(ui.get('skirmishStatus').textContent,/not a complete/);assert.equal(ui.get('skirmishCode').value,encodeSkirmishDescriptor(DEFAULT_SKIRMISH));assert.equal(ui.battle.profile.gold,1200);
});
test('draft seed edits and Cancel leave the current field and supplied kit intact',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=skirmish'}),b=ui.battle,before=snapshot(b);ui.get('skirmishSeed').value='200';ui.dispatch(ui.get('skirmishSeed'),'change');assert.notEqual(ui.get('skirmishCode').value,b.skirmish.code);ui.click('skirmishCancel');assert.equal(ui.battle,b);assert.equal(snapshot(b),before);ui.click('introWorkshop');assert.equal(ui.get('skirmishCode').value,b.skirmish.code);
});
test('live replacement asks explicitly, keeps freeze on cancel, and resets only practice',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=skirmish'});ui.click('skirmishPrepare');ui.click('start');ui.frames(80);ui.click('battlePause');ui.click('pauseWorkshop');const b=ui.battle,before=snapshot(b);ui.get('skirmishSeed').value='814';ui.dispatch(ui.get('skirmishSeed'),'change');ui.click('skirmishPrepare');assert.equal(ui.visible('skirmishReplaceConfirm'),true);assert.equal(ui.battle,b);ui.frames(50);assert.equal(snapshot(b),before);ui.click('skirmishKeepAttempt');assert.equal(ui.visible('skirmishReplaceConfirm'),false);assert.equal(ui.battle,b);
 ui.click('skirmishPrepare');ui.click('skirmishReplaceAttempt');assert.notEqual(ui.battle,b);assert.equal(ui.battle.skirmish.descriptor.seed,814);assert.equal(ui.battle.tick,0);assert.equal(ui.battle.profile.gold,1200);assert.equal(ui.visible('intro'),true);ui.frames(10);assert.equal(ui.battle.tick,0);ui.click('skirmishReplaceAttempt');assert.equal(ui.battle.skirmish.descriptor.seed,814);
});
test('restart returns exactly same seed and baseline kit with new profile',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=skirmish'});ui.click('skirmishPrepare');const initial=ui.battle,encounter=initial.encounter;ui.click('start');ui.click('quick-grunt');ui.frames(350);assert.ok(initial.profile.gold<1200);ui.click('battlePause');ui.click('battleRestart');ui.click('confirmRestart');const restarted=ui.battle;assert.notEqual(initial,restarted);assert.deepEqual(restarted.encounter,encounter);assert.equal(restarted.profile.gold,1200);assert.equal(restarted.profile.xp,0);assert.equal(restarted.friendlyQueue.population,70);assert.equal(restarted.tick,0);ui.frames(5);assert.ok(restarted.tick>0);
});
test('same-tab switching preserves exact campaign and practice objects independently',async t=>{
 const ui=await loadGameUI(t),campaign=ui.battle;campaign.profile.gold=321;ui.click('start');ui.frames(20);ui.click('battlePause');ui.click('pauseLobby');const before=snapshot(campaign);switchTo(ui,'skirmish');assert.equal(ui.visible('skirmishPanel'),true);ui.click('skirmishPrepare');const skirmish=ui.battle;ui.click('start');ui.frames(45);ui.click('battlePause');ui.click('pauseLobby');const practiceBefore=snapshot(skirmish);switchTo(ui,'campaign');assert.equal(ui.battle,campaign);assert.equal(snapshot(campaign),before);assert.equal(ui.get('difficulty').disabled,false);assert.equal(ui.visible('introProfiles'),true);switchTo(ui,'skirmish');assert.equal(ui.battle,skirmish);assert.equal(snapshot(skirmish),practiceBefore);assert.equal(ui.visible('introProfiles'),false);
});
test('vault and profile entry points cannot import or export a practice campaign',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=skirmish'});ui.click('skirmishPrepare');const b=ui.battle;
 for(const id of ['introSave','introLoad','introProfiles','saveGame','loadGame','openProfiles','endingSave','endingLoad','endingProfiles']){ui.click(id);assert.equal(ui.visible('skirmishPanel'),true,id);assert.equal(ui.visible('savePanel'),false);assert.equal(ui.visible('profilesPanel'),false);ui.click('closeWorkshop');assert.equal(ui.battle,b);}
 ui.get('loadCode').value=new CampaignProfiles().exportBundle();ui.click('importCode');assert.equal(ui.battle,b);await ui.load({size:40,text:async()=>new CampaignProfiles().exportBundle()});assert.equal(ui.battle,b);
});
test('difficulty changes are locked to descriptor while aiming stays configurable',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=skirmish'});ui.click('skirmishPrepare');ui.click('introSettings');assert.equal(ui.get('difficulty').disabled,true);ui.get('difficulty').value='insane';ui.get('aimMode').value='auto_aim';ui.click('applySettings');assert.equal(ui.battle.profile.difficulty,'medium');assert.equal(ui.battle.profile.shootingMode,'auto_aim');ui.click('introWorkshop');ui.click('skirmishPrepare');assert.equal(ui.battle.profile.shootingMode,'auto_aim');assert.equal(ui.battle.profile.difficulty,'medium');
});
test('stale campaign file cannot replace practice after destination switch',async t=>{
 const ui=await loadGameUI(t),file=deferredFile();const promise=ui.load(file.file);switchTo(ui,'skirmish');const b=ui.battle;file.resolve(new CampaignProfiles().exportBundle());await promise;assert.equal(ui.battle,b);assert.equal(b.profile.cheated,true);
});
test('copy fallback keeps a complete strict descriptor; repeated prepare stays frozen',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=skirmish'});await ui.click('skirmishCopy').completed;assert.deepEqual(decodeSkirmishDescriptor(ui.get('skirmishCode').value),ui.battle.skirmish.descriptor);assert.match(ui.get('skirmishStatus').textContent,/selected|copied/);ui.click('skirmishPrepare');const b=ui.battle;ui.click('skirmishPrepare');assert.equal(ui.battle,b);ui.frames(5);assert.equal(b.tick,0);
});
test('workshop uses 44px controls and single-panel responsive layouts',async()=>{const css=await readFile(new URL('../site/dist/skirmish.css',import.meta.url),'utf8');assert.match(css,/min-height:44px/);assert.match(css,/@media\(max-width:560px\)/);assert.match(css,/overflow:auto/);});
test('invalid pasted code disables preparation until valid input or code is supplied',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=skirmish'}),b=ui.battle;ui.get('skirmishCode').value='SK1:garbage';ui.click('skirmishLoadCode');assert.equal(ui.get('skirmishPrepare').disabled,true);ui.click('skirmishPrepare');assert.equal(ui.battle,b);ui.get('skirmishCode').value=encodeSkirmishDescriptor({...DEFAULT_SKIRMISH,seed:18});ui.click('skirmishLoadCode');assert.equal(ui.get('skirmishPrepare').disabled,false);ui.click('skirmishPrepare');assert.equal(ui.battle.skirmish.descriptor.seed,18);
});
test('Escape closes replacement preview; stale confirmation cannot reset practice',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=skirmish'});ui.click('skirmishPrepare');ui.click('start');ui.frames(8);ui.click('battlePause');ui.click('pauseWorkshop');const b=ui.battle,before=snapshot(b);ui.click('skirmishPrepare');assert.equal(ui.visible('skirmishReplaceConfirm'),true);assert.equal(ui.get('skirmishWorkshopHost').inert,true);ui.key('keydown','Escape');assert.equal(ui.visible('skirmishPanel'),false);ui.click('skirmishReplaceAttempt');assert.equal(ui.battle,b);assert.equal(snapshot(b),before);ui.click('introWorkshop');assert.equal(ui.get('skirmishWorkshopHost').inert,false);assert.equal(ui.visible('skirmishReplaceConfirm'),false);
});
test('unattended natural result uses practice receipt and retry cannot advance campaign or double restart',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=skirmish'});ui.click('skirmishPrepare');ui.click('start');const b=ui.battle;for(let n=0;n<15000&&!b.summary;n++)b.step();assert.equal(b.summary?.outcome,'defeat');assert.equal(b.profile.highestLevel,1);assert.equal(ui.get('endingTitle').textContent,'Practice defeat');assert.equal(ui.get('replay').textContent,'Prepare same seed');assert.match(ui.get('endingText').textContent,/stay here/);const code=b.skirmish.code;ui.click('replay');const fresh=ui.battle;ui.click('replay');assert.equal(ui.battle,fresh);assert.equal(fresh.skirmish.code,code);assert.equal(fresh.profile.gold,1200);assert.equal(fresh.profile.defeats,0);assert.equal(fresh.profile.highestLevel,1);ui.frames(5);assert.equal(fresh.tick,0);assert.equal(ui.get('start').textContent,'Start skirmish');ui.click('start');ui.frames(2);assert.ok(fresh.tick>0);
});
test('Skirmish-only endpoint fix remains finite on both endpoints without opening outside-world movement',()=>{
 const b=new SkirmishBattle({descriptor:DEFAULT_SKIRMISH});assert.equal(b.terrain.elevationAt(0),b.encounter.heights[0]);assert.equal(b.terrain.elevationAt(2000),b.encounter.heights[100]);assert.ok(Number.isNaN(b.terrain.elevationAt(2001)));b.hero.leaveGarrison();b.hero.x=2000;b.hero.y=b.elevationAt(2000);b.input.right=true;b.step();assert.equal(b.hero.x,2000);assert.ok(Number.isFinite(b.hero.y));b.input.right=false;b.input.left=true;b.step();assert.ok(b.hero.x<2000);
});
