import test from 'node:test';
import assert from 'node:assert/strict';
import {CAMPAIGN_REGIONS,regionForBattle,campaignProgress,encounterBrief,canPrepareEncounter,campaignBattleSnapshot,campaignSettlement,terrainProfilePoints} from '../site/dist/campaign-atlas-model.mjs';
import {PlayerProfile,serializeProfile,restoreProfile} from '../site/dist/engine/progression.mjs';
import {CampaignProfiles} from '../site/dist/engine/profile-manager.mjs';
import {CampaignBattle} from '../site/dist/engine/first-battle.mjs';
import {LEVELS} from '../site/dist/engine/levels.mjs';
import {seededRandom} from '../site/dist/engine/combat.mjs';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
const profileAt=level=>{const p=new PlayerProfile('Roadkeeper');p.level=p.highestLevel=level;p.scene=p.highestScene=level+1;p.victories=level-1;return p;};
const importAt=(ui,level)=>{ui.click('introLoad');ui.get('loadCode').value=new CampaignProfiles({profiles:[profileAt(level)]}).exportBundle();ui.click('importCode');ui.click('localImportSession');};
const chooseLevel=(ui,level)=>{const region=regionForBattle(level);ui.get('campaignAtlasHost').querySelector(`[data-atlas-region="${region.id}"]`).click();ui.get('campaignAtlasHost').querySelector(`[data-atlas-level="${level}"]`).click();};
const settle=(ui,outcome='victory')=>{ui.battle.finishOutcome(outcome);ui.frames(105);assert.ok(ui.battle.summary);};

test('every encounter belongs to its actual scenery region exactly once',()=>{
 assert.equal(CAMPAIGN_REGIONS.length,4);const covered=[];
 for(const region of CAMPAIGN_REGIONS)for(let level=region.first;level<=region.last;level++){assert.equal(LEVELS[level-1].scenery,region.scenery);assert.equal(regionForBattle(level),region);covered.push(level);}
 assert.deepEqual(covered,Array.from({length:30},(_,i)=>i+1));assert.throws(()=>regionForBattle(31),RangeError);
});
test('threat ranges exactly match every underlying finite roster definition',()=>{
 const names=new Set();for(let level=1;level<=30;level++){const brief=encounterBrief(level),data=LEVELS[level-1];names.add(brief.name);assert.equal(brief.threats.reduce((n,t)=>n+t.minimum,0),data.enemyBounds[0]);assert.equal(brief.threats.reduce((n,t)=>n+t.maximum,0),data.enemyBounds[1]);assert.deepEqual(brief.heights,data.heights);assert.match(brief.objective,/flag/);assert.equal(brief.threats.some(t=>t.id==='gorath'),level===30);}
 assert.equal(names.size,30);
});
test('actual prepared company is exact and inspecting does not consume random or mutate battle',()=>{
 const p=profileAt(17),b=new CampaignBattle({profile:p,level:17,random:seededRandom(701)});const before=serializeProfile(p),roster=[...b.enemies.roster],index=b.enemies.index;
 const brief=encounterBrief(17,{profile:p,battle:b});assert.equal(brief.armySize,roster.length);for(const t of brief.threats)assert.equal(t.count,roster.filter(id=>id===t.id).length);assert.equal(serializeProfile(p),before);assert.deepEqual(b.enemies.roster,roster);assert.equal(b.enemies.index,index);
 assert.equal(encounterBrief(18,{profile:p,battle:b}).armySize,null);
});
test('every possible frontier has correct region and unlock accounting without new save fields',()=>{
 for(let frontier=1;frontier<=31;frontier++){const p=profileAt(frontier),before=serializeProfile(p),progress=campaignProgress(p);assert.equal(progress.cleared,frontier-1);assert.equal(progress.regions.reduce((n,r)=>n+r.cleared,0),frontier-1);assert.equal(progress.complete,frontier===31);for(let level=1;level<=30;level++){const brief=encounterBrief(level,{profile:p});assert.equal(brief.unlocked,level<=frontier);assert.equal(brief.replay,level<frontier);}assert.equal(serializeProfile(p),before);assert.equal(restoreProfile(before).highestLevel,frontier);}
});
test('prepare guard rejects locked, invalid, completed, practice and live encounters',()=>{
 const profile=profileAt(7);for(const level of [0,-1,8,31,1.1,NaN])assert.equal(canPrepareEncounter({profile,level}),false);assert.equal(canPrepareEncounter({profile,level:1}),true);assert.equal(canPrepareEncounter({profile,level:7}),true);assert.equal(canPrepareEncounter({profile,level:1,started:true}),false);assert.equal(canPrepareEncounter({profile,level:1,started:true,summary:{outcome:'defeat'}}),true);assert.equal(canPrepareEncounter({profile,level:1,destination:'training'}),false);assert.equal(canPrepareEncounter({profile:profileAt(31),level:1}),false);
});
test('terrain preview remains finite and clones do not modify collision samples',()=>{
 for(const data of LEVELS){const brief=encounterBrief(data.level),points=terrainProfilePoints(brief.heights);assert.equal(points.split(' ').length,data.heights.length);assert.doesNotMatch(points,/NaN|Infinity/);brief.heights[0]=-10;assert.notEqual(data.heights[0],-10);}
});
test('feedback waits for settlement, conserves existing rewards and detects actual region unlock',()=>{
 const p=profileAt(6),before=campaignBattleSnapshot(p),b=new CampaignBattle({profile:p,level:6,random:seededRandom(1)});b.stats.goldEarned=200;b.stats.goldSpent=30;assert.equal(campaignSettlement(b,before),null);b.finishOutcome('victory');assert.equal(campaignSettlement(b,before),null);while(!b.summary)b.step();const gold=p.gold,wins=p.victories,report=campaignSettlement(b,before);assert.equal(report.nextRegion.id,'bannerfen');assert.equal(report.frontier,7);assert.equal(report.netGold,200+b.summary.gold-30);assert.equal(report.bonusGold,b.summary.gold);assert.equal(report.advanced,true);for(let i=0;i<20;i++)campaignSettlement(b,before);assert.equal(p.gold,gold);assert.equal(p.victories,wins);
});
test('replay settlement preserves highest frontier without fake region unlocks',()=>{
 const p=profileAt(17),before=campaignBattleSnapshot(p),b=new CampaignBattle({profile:p,level:6,random:seededRandom(2)});b.finishOutcome('victory');while(!b.summary)b.step();const r=campaignSettlement(b,before);assert.equal(p.highestLevel,17);assert.equal(r.nextRegion,null);assert.equal(r.advanced,false);assert.match(r.nextLabel,/frontier.*17/);assert.equal(restoreProfile(serializeProfile(p)).highestLevel,17);
});
test('defeat and final victory feedback respect unchanged bonus contracts',()=>{
 const p=profileAt(1),b=new CampaignBattle({profile:p,level:1});const before=campaignBattleSnapshot(p);b.finishOutcome('defeat');while(!b.summary)b.step();const r=campaignSettlement(b,before);assert.equal(r.bonusGold,0);assert.equal(r.bonusXP,0);assert.equal(r.frontier,1);assert.equal(r.advanced,false);
 const last=profileAt(30),lastBefore=campaignBattleSnapshot(last),final=new CampaignBattle({profile:last,level:30});final.finishOutcome('victory');while(!final.summary)final.step();const end=campaignSettlement(final,lastBefore);assert.match(end.headline,/complete/);assert.equal(end.bonusGold,0);assert.equal(end.bonusXP,0);assert.equal(end.frontier,31);
});
test('atlas opens before combat, inspects locked fields and returns without changing game state',async t=>{
 const ui=await loadGameUI(t),b=ui.battle,profile=serializeProfile(b.profile);ui.click('introAtlas');assert.equal(ui.visible('campaignPanel'),true);assert.equal(ui.get('intro').inert,true);chooseLevel(ui,30);assert.match(ui.get('atlasEncounterTitle').textContent,/Ashen Throne/);assert.equal(ui.get('atlasPrepare').disabled,true);ui.click('atlasPrepare');ui.frames(50);assert.equal(ui.battle,b);assert.equal(b.tick,0);assert.equal(serializeProfile(b.profile),profile);ui.click('atlasReturn');assert.equal(ui.visible('campaignPanel'),false);assert.equal(ui.visible('intro'),true);assert.equal(ui.get('intro').inert,false);
});
test('earned unlocked replay is prepared, explicitly labeled and requires Start',async t=>{
 const ui=await loadGameUI(t);importAt(ui,7);ui.click('introAtlas');chooseLevel(ui,2);assert.equal(ui.get('atlasPrepare').disabled,false);ui.click('atlasPrepare');const b=ui.battle;assert.equal(b.level,2);assert.equal(b.profile.highestLevel,7);assert.equal(b.campaignReplay,true);assert.match(ui.get('introNotice').textContent,/Replay/);assert.match(ui.get('battleTitle').textContent,/Replay/);assert.equal(b.tick,0);ui.frames(15);assert.equal(b.tick,0);ui.click('start');ui.frames(2);assert.ok(b.tick>0);settle(ui);assert.match(ui.get('replay').textContent,/frontier.*7/);assert.equal(b.profile.highestLevel,7);ui.click('replay');assert.equal(ui.battle.level,7);assert.equal(ui.battle.campaignReplay,false);
});
test('live campaign map pauses exact field and cannot replace it, including Escape',async t=>{
 const ui=await loadGameUI(t);importAt(ui,7);ui.click('start');ui.frames(20);ui.click('battlePause');ui.click('pauseAtlas');const b=ui.battle,tick=b.tick;chooseLevel(ui,1);assert.equal(ui.get('atlasPrepare').disabled,true);ui.click('atlasPrepare');ui.frames(20);assert.equal(ui.battle,b);assert.equal(b.tick,tick);assert.equal(b.paused,true);assert.match(ui.get('atlasActionNote').textContent,/Finish it/);ui.key('keydown','Escape');assert.equal(ui.visible('campaignPanel'),false);assert.equal(ui.visible('intro'),true);assert.equal(b.paused,true);ui.click('start');ui.frames(2);assert.ok(b.tick>tick);
});
test('campaign atlas stays absent in practice and returns after same-tab switch',async t=>{
 const ui=await loadGameUI(t);ui.get('hubDestinations').querySelector('[data-hub-destination="midgame"]').click();ui.click('start');assert.equal(ui.visible('introAtlas'),false);const demo=ui.battle;ui.click('introAtlas');assert.equal(ui.visible('campaignPanel'),false);assert.equal(ui.battle,demo);ui.get('hubDestinations').querySelector('[data-hub-destination="campaign"]').click();ui.click('start');assert.equal(ui.visible('introAtlas'),true);ui.click('introAtlas');assert.equal(ui.visible('campaignPanel'),true);
});
test('settled result can choose a different unlocked field but rewards never repeat',async t=>{
 const ui=await loadGameUI(t);importAt(ui,6);ui.click('start');settle(ui);const gold=ui.battle.profile.gold,wins=ui.battle.profile.victories;assert.match(ui.get('campaignRewards').textContent,/Bannerfen opens/);ui.click('endingAtlas');chooseLevel(ui,1);ui.click('atlasPrepare');assert.equal(ui.battle.level,1);assert.equal(ui.battle.profile.highestLevel,7);assert.equal(ui.battle.profile.gold,gold);assert.equal(ui.battle.profile.victories,wins);assert.equal(ui.get('campaignRewards').textContent,'');
});
test('atlas repeatedly renders a bounded node tree and honors region focus',async t=>{
 const ui=await loadGameUI(t);ui.click('introAtlas');let max=0;for(let i=0;i<60;i++){chooseLevel(ui,(i%30)+1);max=Math.max(max,ui.get('campaignAtlasHost').querySelectorAll('button').length);assert.equal(ui.document.activeElement.getAttribute('data-atlas-level'),String((i%30)+1));}assert.equal(max,40);/* 37 existing controls + Inspect, drawer Back and drawer Prepare. */assert.equal(ui.get('campaignAtlasHost').querySelectorAll('[data-atlas-level]').length,30);ui.click('closeAtlas');assert.equal(ui.visible('campaignPanel'),false);
});
test('roster-linked bestiary starts collapsed and uses current difficulty without mutating the company',async t=>{
 const ui=await loadGameUI(t);importAt(ui,17);const b=ui.battle,roster=[...b.enemies.roster],gold=b.profile.gold;ui.click('introAtlas');const bestiary=ui.get('campaignAtlasHost').querySelector('.atlas-bestiary');assert.ok(bestiary);assert.equal(bestiary.getAttribute('open'),null);assert.match(bestiary.textContent,/Spawn HP at medium/);assert.equal(bestiary.querySelectorAll('.atlas-enemy').length,new Set(roster).size);assert.deepEqual(b.enemies.roster,roster);assert.equal(b.profile.gold,gold);assert.equal(b.tick,0);
});
