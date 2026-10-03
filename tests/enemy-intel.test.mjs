import test from 'node:test';
import assert from 'node:assert/strict';
import {enemyIntel,encounterEnemyIntel,ENEMY_INTEL_IDS} from '../site/dist/enemy-intel.mjs';
import {CampaignBattle} from '../site/dist/engine/first-battle.mjs';
import {PlayerProfile} from '../site/dist/engine/progression.mjs';
import {seededRandom} from '../site/dist/engine/combat.mjs';
import {getLevel,campaignRoster} from '../site/dist/engine/levels.mjs';

test('all13 enemy types match real constructed HP/resistances at every30 levels and4 difficulties',()=>{
 let checks=0;
 for(const difficulty of ['easy','medium','hard','insane'])for(let level=1;level<=30;level++){
  const profile=new PlayerProfile();profile.difficulty=difficulty;const b=new CampaignBattle({profile,level,random:seededRandom(33)});
  for(const id of ENEMY_INTEL_IDS){const u=b.createUnit(id),intel=enemyIntel(id,{level,difficulty});assert.equal(intel.maxHp,u.maxHp,`${id} B${level} ${difficulty} HP`);assert.equal(intel.air,!!u.airUnit);for(const [key,value] of Object.entries(intel.multipliers))assert.equal(value,u.multipliers[key]??1,`${id} ${key}`);checks++;}
 }
 assert.equal(checks,1560);
});

test('current-stage default intelligence contains authored possible types without rolling a roster',()=>{
 for(let level=1;level<=30;level++){
  const stage=getLevel(level),expected=ENEMY_INTEL_IDS.filter(id=>(stage.fixedCounts[id]??0)>0||(stage.randomCounts[id]?.draw&&stage.randomCounts[id].limit>1));assert.deepEqual(encounterEnemyIntel({level}).map(x=>x.id),expected);
  for(const seed of [1,42,131])for(const id of campaignRoster(level,seededRandom(seed)))assert.ok(expected.includes(id));
 }
 assert.ok(!encounterEnemyIntel({level:1}).some(x=>x.air));assert.ok(encounterEnemyIntel({level:30}).some(x=>x.id==='gorath'));
});

test('explicit actual roster types are deduplicated and normalized without adding possible types',()=>{
 const types=Object.freeze(['dragon_scout_fire','archer','fireDragon','grunt']);
 assert.deepEqual(encounterEnemyIntel({level:16,difficulty:'hard',types}).map(x=>x.id),['grunt','archer','fireDragon']);
 assert.deepEqual(encounterEnemyIntel({level:16,types:[]}),[]);
 assert.equal(enemyIntel('fire_demon',{level:17}).id,'fireDemon');
});

test('read-only model does not consume global randomness, mutate caller types, or expose mutable nested values',()=>{
 const original=Math.random;Math.random=()=>{throw new Error('Intel must not roll RNG');};try{
  const types=Object.freeze(['fireDragon','iceDragon']);const intel=encounterEnemyIntel({level:16,types});assert.deepEqual(types,['fireDragon','iceDragon']);
  assert.ok(Object.isFrozen(intel));for(const row of intel){assert.ok(Object.isFrozen(row));assert.ok(Object.isFrozen(row.multipliers));assert.ok(Object.isFrozen(row.notes));assert.ok(Object.isFrozen(row.weaknesses));assert.throws(()=>row.notes.push('changed'));assert.throws(()=>row.multipliers.pierce=99);}
 }finally{Math.random=original;}
});

test('counter notes correctly distinguish ordinary Air, elemental dragons, vehicle and final boss',()=>{
 assert.match(enemyIntel('air').counter,/Flak.*4×.*Activate/);assert.equal(enemyIntel('fireDragon').multipliers.flak,1);
 assert.match(enemyIntel('fireDragon').counter,/Ice Arrow.*4×.*Fire.*0\.01×/);assert.match(enemyIntel('iceDragon').counter,/Fire Arrow.*4×.*Ice.*0\.01×/);
 assert.match(enemyIntel('poisonDragon').notes.join(' '),/Poison status damage does not consult/);
 assert.match(enemyIntel('trebuchet').notes.join(' '),/Poison and healing do not affect/);
 assert.match(enemyIntel('gorath').notes.join(' '),/armor and feet can deflect.*safe flag return can still win/);
 assert.equal(enemyIntel('fireDemon').multipliers.fire,0);assert.equal(enemyIntel('iceDemon').multipliers.ice,0);
});

test('invalid levels, difficulty and types are rejected without guessing',()=>{
 for(const level of [0,31,1.5,NaN,'16'])assert.throws(()=>enemyIntel('grunt',{level}),RangeError);
 for(const difficulty of ['unknown','MEDIUM',null])assert.throws(()=>enemyIntel('grunt',{difficulty}),RangeError);
 for(const type of ['unknown',null,{},'__proto__','constructor'])assert.throws(()=>enemyIntel(type));
 assert.throws(()=>encounterEnemyIntel({types:'grunt'}),TypeError);assert.throws(()=>encounterEnemyIntel({types:['unknown']}),RangeError);
});
