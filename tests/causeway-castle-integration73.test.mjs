/** Combined frozen castle72 + corrected Causeway checkpoint3. Controlled engine
 * and DOM/canvas fixtures are integration evidence, not native/manual balance. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {createSkirmish,SKIRMISH_DOCTRINES,DEFAULT_SKIRMISH,decodeSkirmishDescriptor,encodeSkirmishDescriptor} from '../site/dist/skirmish-model.mjs';
import {SkirmishBattle} from '../site/dist/skirmish-battle.mjs';
import {prepareCastleSelection} from '../site/dist/engine/first-battle.mjs';
import {CAUSEWAY_RULES,causewayNeedsOccupation} from '../site/dist/engine/causeway-objective.mjs';
import {skirmishPreviewSVG} from '../site/dist/skirmish-ui.mjs';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
const descriptor=(doctrine='causeway',threat='scout',biome='oaks')=>({version:doctrine==='highwatch'?2:1,seed:42,biome,threat,doctrine});
const make=(doctrine='causeway')=>new SkirmishBattle({descriptor:descriptor(doctrine)});
const code=doctrine=>encodeSkirmishDescriptor(descriptor(doctrine));
const armFinalTick=b=>{b.hero.leaveGarrison();b.hero.x=1050;b.hero.y=b.elevationAt(1050);for(const u of b.badTeam){u.x=1600;u.y=b.elevationAt(1600);}for(let n=0;n<989;n++){b.tick++;b.causewayObjective.afterTick();}};

test('73 combined catalog has seven explicit doctrines, SK2 only Highwatch and unchanged default',()=>{
 assert.deepEqual(Object.keys(SKIRMISH_DOCTRINES).sort(),['battery','causeway','highwatch','levy','siege','skywatch','vanguard']);
 assert.deepEqual(DEFAULT_SKIRMISH,{version:1,seed:73421,biome:'oaks',threat:'standard',doctrine:'vanguard'});
 for(const doctrine of Object.keys(SKIRMISH_DOCTRINES)){
  assert.deepEqual(decodeSkirmishDescriptor(code(doctrine)),descriptor(doctrine));
  assert.throws(()=>decodeSkirmishDescriptor(code(doctrine).replace(doctrine==='highwatch'?'SK2':'SK1',doctrine==='highwatch'?'SK1':'SK2')));
 }
});

test('73 only three existing engine modules changed, with all other castle72 engine bytes still pinned',()=>{
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/castle72-engine-boundary.json',import.meta.url))),root=new URL('../site/dist/engine/',import.meta.url);
 assert.equal(fixture.baseline,'979a33fae2af52f348465175632364dd4f0de30f');
 for(const [name,hash]of Object.entries(fixture.unchanged))assert.equal(createHash('sha256').update(readFileSync(new URL(name,root))).digest('hex'),hash,name);
 assert.deepEqual(readdirSync(root).sort(),[...Object.keys(fixture.unchanged),...fixture.reviewed_changes,...fixture.reviewed_additions].sort());
});

test('73 Causeway defaults to Classic, finite 18/24/30 rosters and no free Highwatch card across all biomes',()=>{
 for(const biome of ['oaks','lowlands','pines','wasteland'])for(const [threat,size]of [['scout',18],['standard',24],['veteran',30]]){
  const b=new SkirmishBattle({descriptor:descriptor('causeway',threat,biome)});
  assert.equal(b.encounter.roster.length,size);assert.equal(b.enemies.spawned,5);assert.equal(b.enemies.remaining,size-5);assert.equal(b.enemies.withdrawn,0);
  assert.equal(b.profile.castleId,'classic');assert.deepEqual([...b.profile.castleLevels],[['classic',1]]);
  for(const c of [b.goodCastle,b.badCastle]){assert.equal(c.castleId,'classic');assert.equal(c.maxOccupants,4);assert.equal(c.shotOffset.y,-200);}
  assert.equal(b.goodCastle.hp,10400);assert.equal(b.badCastle.hp,b.encounter.enemyKeepHP);assert.equal(b.auxiliaries,undefined);assert.equal(b.skirmish.castlePractice,undefined);
 }
});

test('73 optional owned castle swap preserves the same prepared Causeway and objective identity',()=>{
 const b=make(),p=b.profile,castle=b.goodCastle,objective=b.causewayObjective,enemies=b.enemies,terrain=b.terrain;
 p.gold=1500;assert.equal(p.purchaseCastle('highwatch'),true);const gold=p.gold,skills=p.skills.map(s=>[s,s.binding,s.rank,s.cooldown]);
 for(const id of ['highwatch','classic']){
  const action=prepareCastleSelection(b,{id,level:1},{started:false,profile:p});action.apply();p.castleId=id;
  assert.equal(b.goodCastle,castle);assert.equal(b.causewayObjective,objective);assert.equal(b.enemies,enemies);assert.equal(b.terrain,terrain);assert.equal(b.profile,p);
  assert.equal(b.goodCastle.hp,id==='highwatch'?8320:10400);assert.equal(b.hero.garrisonBuilding,castle);assert.equal(b.hero.launchPosition.y,castle.y-(id==='highwatch'?250:200));
  assert.equal(b.objectiveProgress.ticks,0);assert.equal(b.tick,0);assert.equal(p.gold,gold);assert.deepEqual(p.skills.map(s=>[s,s.binding,s.rank,s.cooldown]),skills);
 }
 assert.deepEqual([...make().profile.castleLevels],[['classic',1]]);
});

test('73 Causeway alone retains split Rally after real keep damage, ordinary and Highwatch gates stay closed',()=>{
 for(const doctrine of ['causeway','highwatch','levy','vanguard','battery']){
  const b=make(doctrine);if(!b.badTeam.length)b.createUnit('grunt');b.setArmyOrder('rally','center','frontline');b.setArmyOrder('rally','rear','support');
  b.badCastle.takeDamage(b.badCastle.hp);
  assert.equal(causewayNeedsOccupation(b),doctrine==='causeway');assert.equal(b.armyOrder.mode,doctrine==='causeway'?'split':'advance');
  assert.equal(b.setArmyOrder('rally','center'),doctrine==='causeway');
 }
});

test('73 exact preparation interval is derived from rules and terrain, absent from other doctrines',()=>{
 for(const biome of ['oaks','lowlands','pines','wasteland']){
  const scenario=createSkirmish(descriptor('causeway','standard',biome)),svg=skirmishPreviewSVG(scenario);
  assert.match(svg,new RegExp(`data-left="${CAUSEWAY_RULES.left}" data-right="${CAUSEWAY_RULES.right}"`));
  assert.match(svg,/Occupation and contest strip: x990 through x1110, inclusive/);assert.match(svg,/pointer-events="none"/);
  const heights=scenario.encounter.heights,left=(heights[49]+heights[50])/2*.32-115,right=(heights[55]+heights[56])/2*.32-115;
  assert.ok(svg.includes(`M${CAUSEWAY_RULES.left*.32},${left.toFixed(1)}`));assert.ok(svg.includes(`L${CAUSEWAY_RULES.right*.32},${right.toFixed(1)}`));
 }
 for(const doctrine of ['highwatch','vanguard','battery','levy'])assert.doesNotMatch(skirmishPreviewSVG(createSkirmish(descriptor(doctrine))),/skirmish-causeway-strip|CAUSEWAY<\/text>/);
});

test('73 repeated Highwatch/Causeway/Battery workshop replacement clears stale objective identities and brief text',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=skirmish'});
 for(const doctrine of ['highwatch','causeway','battery','highwatch','causeway','vanguard']){
  ui.click('introWorkshop');ui.get('skirmishCode').value=code(doctrine);ui.click('skirmishLoadCode');ui.click('skirmishPrepare');ui.frames();
  assert.equal(ui.battle.skirmish.descriptor.doctrine,doctrine);assert.equal(ui.battle.tick,0);
  assert.equal(ui.visible('castlePracticeBrief'),doctrine==='highwatch');assert.equal(ui.visible('batteryObjectiveBrief'),['causeway','battery'].includes(doctrine));
  const title=ui.get('combatBattleTitle').textContent,brief=ui.get('batteryObjectiveBrief').textContent;
  if(doctrine==='causeway'){assert.match(title,/Causeway/);assert.match(brief,/30 cumulative seconds/);assert.doesNotMatch(brief,/marked engines/);}
  else{assert.doesNotMatch(title,/Causeway/);assert.doesNotMatch(brief,/30 cumulative seconds/);}
  assert.equal(ui.battle.goodCastle.castleId,doctrine==='highwatch'?'highwatch':'classic');
 }
});

for(const destroyed of [false,true])test(`73 real secured event reports actual withdrawal and cleanup without false keep or win, keep already gone=${destroyed}`,async t=>{
 const ui=await loadGameUI(t,{search:'?mode=skirmish&sk='+code('causeway')});ui.click('skirmishPrepare');ui.click('start');ui.frames();const b=ui.battle;
 if(destroyed)b.badCastle.takeDamage(b.badCastle.hp);
 armFinalTick(b);const reserve=b.enemies.remaining,events=[],emit=b.emit.bind(b);b.emit=e=>{events.push(e);emit(e);};ui.frames();
 assert.equal(b.objectiveProgress.secured,true);assert.equal(b.outcome,null);assert.ok(b.badTeam.length>0);
 const text=ui.get('battleStatus').textContent;assert.match(text,new RegExp(`Causeway secured\\. ${reserve} undeployed enemies withdrawn`));assert.match(text,/Clear deployed enemies and restore your home flag/);assert.doesNotMatch(text,/keep destroyed|victory|won/i);
 assert.equal(events.filter(e=>e.type==='causeway-secured').length,1);ui.frames(3);assert.equal(events.filter(e=>e.type==='causeway-secured').length,1);
});
