import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createSkirmish,DEFAULT_SKIRMISH,DEFAULT_CASTLE_PRACTICE,SKIRMISH_KIT,encodeSkirmishDescriptor,decodeSkirmishDescriptor,validateSkirmishDescriptor,skirmishCombatRandom} from '../site/dist/skirmish-model.mjs';
import {SkirmishBattle,SkirmishProfiles} from '../site/dist/skirmish-battle.mjs';
import {resolveCastleConfig} from '../site/dist/engine/castle-catalog.mjs';
import {prepareCastleSelection} from '../site/dist/engine/first-battle.mjs';
import {FLAG_STATUS as FS} from '../site/dist/engine/flag-troop.mjs';
import {skirmishBriefHTML,skirmishPreviewSVG} from '../site/dist/skirmish-ui.mjs';
import {castlePracticeFeedbackState,updateCastlePracticeFeedback} from '../site/dist/castle-practice-feedback.mjs';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
const make=(more={})=>new SkirmishBattle({descriptor:{...DEFAULT_CASTLE_PRACTICE,...more}});
const account=b=>assert.equal(b.enemies.spawned+b.enemies.remaining+b.enemies.withdrawn,b.encounter.roster.length);
const equip=(b,id)=>{prepareCastleSelection(b,{id,level:1},{started:false,profile:b.profile}).apply();b.profile.castleId=id;};

test('70 SK2 is bounded to explicit optional Highwatch; default and all 144 frozen SK1 fields are byte-identical',()=>{
 assert.deepEqual(DEFAULT_SKIRMISH,{version:1,seed:73421,biome:'oaks',threat:'standard',doctrine:'vanguard'});
 assert.equal(encodeSkirmishDescriptor(DEFAULT_CASTLE_PRACTICE),'SK2:1KNH:oaks:standard:highwatch');
 assert.deepEqual(decodeSkirmishDescriptor('sk2:1knh:oaks:standard:highwatch'),DEFAULT_CASTLE_PRACTICE);
 for(const value of [{...DEFAULT_CASTLE_PRACTICE,version:1},{...DEFAULT_CASTLE_PRACTICE,version:3},{...DEFAULT_CASTLE_PRACTICE,doctrine:'vanguard'},{...DEFAULT_CASTLE_PRACTICE,castle:'classic'},{...DEFAULT_CASTLE_PRACTICE,level:2}])assert.throws(()=>validateSkirmishDescriptor(value));
 for(const code of ['SK2:01:oaks:standard:highwatch','SK2:1:oaks:standard:highwatch-extra','SK2:1:oaks:standard:levy','SK1:1:oaks:standard:highwatch'])assert.throws(()=>decodeSkirmishDescriptor(code));
 for(const {descriptor,sha256} of JSON.parse(readFileSync(new URL('./fixtures/skirmish-legacy58.json',import.meta.url)))){const scenario=createSkirmish(descriptor),r=skirmishCombatRandom(descriptor),combat=Array.from({length:12},r);assert.equal(createHash('sha256').update(JSON.stringify({scenario,combat})).digest('hex'),sha256);}
});
test('70 every SK2 landscape/tier uses shared symmetric level1 traits and exact finite predeployment',()=>{
 for(const biome of ['oaks','lowlands','pines','wasteland'])for(const threat of ['scout','standard','veteran'])for(const seed of [1,73421,4294967295]){
  const b=make({biome,threat,seed}),s=b.skirmish;
  for(const [team,castle,baseHp] of [['good',b.goodCastle,10400],['bad',b.badCastle,b.encounter.enemyKeepHP]]){const c=resolveCastleConfig({id:'highwatch',level:1},{team,baseHp});assert.equal(castle.hp,c.hp);assert.equal(castle.maxHp,c.hp);assert.deepEqual(castle.shotOffset,c.shotOffset);assert.equal(castle.maxOccupants,c.maxOccupants);assert.equal(castle.regionKind,c.regionKind);}
  assert.equal(b.badCastle.occupants.length,2);assert.ok(b.badCastle.occupants.every(u=>b.badTeam.includes(u)&&u.type==='archer'&&u.garrisonBuilding===b.badCastle));
  assert.equal(b.badTeam.length,2);assert.equal(b.enemies.spawned,2);account(b);assert.equal(s.kit,SKIRMISH_KIT);assert.equal(b.auxiliaries,undefined);assert.equal(b.tick,0);
  for(const u of b.badTeam)assert.deepEqual(u.shotOrigin(),{x:1800,y:b.badCastle.y-250});
 }
});
test('70 supplied ownership costs nothing, permits reversible tick-zero comparison, and resets only on fresh attempts',()=>{
 const b=make(),p=b.profile,ids=p.skills.map(s=>[s,s.id,s.rank,s.key,s.cooldown]);
 assert.deepEqual([...p.castleLevels],[['classic',1],['highwatch',1]]);assert.equal(p.castleId,'highwatch');assert.equal(p.gold,1200);assert.equal(b.stats.goldSpent,0);assert.equal(b.friendlyQueue.population,70);
 const castle=b.goodCastle;for(const id of ['classic','highwatch','classic']){equip(b,id);assert.equal(b.goodCastle,castle);assert.equal(p.gold,1200);assert.equal(b.stats.goldSpent,0);assert.deepEqual(p.skills.map(s=>[s,s.id,s.rank,s.key,s.cooldown]),ids);assert.equal(b.tick,0);}
 assert.equal(b.goodCastle.hp,10400);const fresh=make();assert.notEqual(fresh.profile,p);assert.equal(fresh.profile.castleId,'highwatch');assert.equal(fresh.goodCastle.hp,8320);
 const old=new SkirmishBattle({descriptor:DEFAULT_SKIRMISH});assert.deepEqual([...old.profile.castleLevels],[['classic',1]]);assert.equal(old.profile.castleId,'classic');assert.equal(old.goodCastle.hp,10400);
 const manager=new SkirmishProfiles(b.skirmish);assert.throws(()=>manager.exportBundle(),/no campaign save/);assert.throws(()=>manager.importBundle('{}'),/cannot/);
});
test('70 predeployed archers use unchanged AI and may leave shelter immediately when targets are unreachable',()=>{
 const b=make();assert.equal(b.badCastle.occupants.length,2);b.step();assert.equal(b.badCastle.occupants.length,0);assert.ok(b.badTeam.every(u=>!u.garrisonBuilding));account(b);
});
test('70 break-keep/cleanup preserves ordinary defeat and does not substitute enemy flag capture or time',()=>{
 const b=make();b.enemyFlag.status=FS.CAPTURED;b.checkOutcome();assert.equal(b.outcome,null);
 b.badCastle.takeDamage(b.badCastle.hp);assert.equal(b.enemies.remaining,0);assert.equal(b.outcome,null);account(b);
 for(const unit of [...b.badTeam])unit.takeDamage(unit.hp);for(let n=0;n<300&&!b.outcome;n++)b.step();assert.equal(b.outcome,'victory');assert.equal(b.profile.highestLevel,1);
 for(const cause of ['hero','flag','keep']){const lost=make();if(cause==='hero')lost.hero.takeDamage(lost.hero.hp);if(cause==='flag')lost.ownFlag.status=FS.CAPTURED;if(cause==='keep')lost.goodCastle.takeDamage(lost.goodCastle.hp);lost.checkOutcome();assert.equal(lost.outcome,'defeat');assert.ok(lost.castlePracticeDefeatCauses.includes(cause));assert.match(castlePracticeFeedbackState(lost).reason,new RegExp(cause==='hero'?'hero':cause==='flag'?'flag':'keep'));}
});
test('70 preview and read-only status disclose actual final health, height, berths, ordinary AI and temporary ownership',()=>{
 const b=make(),brief=skirmishBriefHTML(b.skirmish),svg=skirmishPreviewSVG(b.skirmish);
 for(const text of ['8,320','4,800','6,000','10,400','250 world units','2 total shelter berths','4 berths','Your hero uses one berth','2 enemy archers','not extra enemies','ordinary AI may leave','No castle upgrades','cannot be exported as campaign ownership','losing your hero'])assert.ok(brief.toLowerCase().includes(text.toLowerCase()),text);
 assert.match(svg,/actual taller collision body/);assert.equal(castlePracticeFeedbackState(new SkirmishBattle()),null);
 assert.equal(castlePracticeFeedbackState(b).status,'Break Highwatch keep');b.badCastle.takeDamage(b.badCastle.hp);assert.match(castlePracticeFeedbackState(b).status,/Clear 2/);b.ownFlag.status=FS.DROPPED;assert.equal(castlePracticeFeedbackState(b).status,'Recover home flag');
});
test('70 workshop loads, previews, copies, prepares, cancels and retries the exact optional seed',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=skirmish'}),old=ui.battle;
 assert.equal(ui.get('skirmishDoctrine').value,'vanguard');ui.get('skirmishDoctrine').value='highwatch';ui.dispatch(ui.get('skirmishDoctrine'),'change');assert.match(ui.get('skirmishCode').value,/^SK2:/);assert.match(ui.get('skirmishPreview').textContent,/4,800 HP/);assert.equal(ui.battle,old);
 await ui.click('skirmishCopy').completed;const code=ui.get('skirmishCode').value;assert.deepEqual(decodeSkirmishDescriptor(code),DEFAULT_CASTLE_PRACTICE);
 ui.click('skirmishCancel');assert.equal(ui.battle,old);ui.click('introWorkshop');assert.equal(ui.get('skirmishDoctrine').value,'vanguard');ui.get('skirmishCode').value=code;ui.click('skirmishLoadCode');ui.click('skirmishPrepare');const b=ui.battle;assert.equal(b.skirmish.code,code);assert.equal(b.profile.castleId,'highwatch');assert.equal(b.tick,0);
 ui.click('start');ui.frames(10);ui.click('battlePause');ui.click('battleRestart');ui.click('confirmRestart');assert.notEqual(ui.battle,b);assert.equal(ui.battle.skirmish.code,code);assert.equal(ui.battle.profile.castleId,'highwatch');assert.equal(ui.battle.profile.gold,1200);assert.equal(ui.battle.badCastle.occupants.length,2);
});
test('70 feedback mount is read-only, labels real defeat causes and clears only its own metadata',()=>{
 const b=make(),nodes=new Map(),node=()=>({textContent:'',dataset:{},classList:{add(){this.hidden=true;},remove(){this.hidden=false;}},setAttribute(key,value){this[key]=value;}});
 for(const selector of ['.live-battle-standard','#castlePracticeBrief','#combatBattleTitle','#combatEnemyState','#viewStatus'])nodes.set(selector,node());const root={querySelector:selector=>nodes.get(selector)??null};
 const before=JSON.stringify([b.tick,b.profile.gold,b.goodCastle.hp,b.badCastle.hp,b.enemies.remaining,b.badTeam.map(u=>[u.x,u.y,u.hp,u.garrisonBuilding===b.badCastle])]);
 assert.equal(updateCastlePracticeFeedback(b,root).phase,'break-keep');assert.equal(nodes.get('.live-battle-standard').dataset.objective,'highwatch');assert.match(nodes.get('#combatEnemyState').textContent,/Break Highwatch/);assert.equal(nodes.get('#castlePracticeBrief').classList.hidden,false);
 assert.equal(JSON.stringify([b.tick,b.profile.gold,b.goodCastle.hp,b.badCastle.hp,b.enemies.remaining,b.badTeam.map(u=>[u.x,u.y,u.hp,u.garrisonBuilding===b.badCastle])]),before);
 b.goodCastle.takeDamage(b.goodCastle.hp);assert.equal(updateCastlePracticeFeedback(b,root).reason,'Your home keep fell.');
 assert.equal(updateCastlePracticeFeedback(new SkirmishBattle(),root),null);assert.equal(nodes.get('.live-battle-standard').dataset.objective,undefined);assert.equal(nodes.get('#castlePracticeBrief').classList.hidden,true);assert.equal(nodes.get('#castlePracticeBrief').textContent,'');
 nodes.get('.live-battle-standard').dataset.objective='intercept-battery';updateCastlePracticeFeedback(new SkirmishBattle(),root);assert.equal(nodes.get('.live-battle-standard').dataset.objective,'intercept-battery');
});
