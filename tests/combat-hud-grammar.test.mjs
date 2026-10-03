import test from 'node:test';
import assert from 'node:assert/strict';
import {enemyHudProgress} from '../site/dist/combat-hud.mjs';
test('ordinary enemy HUD uses singular only for one living enemy without changing count semantics',()=>{
 for(const living of [0,1,2]){
  const actors=[...Array.from({length:living},()=>Object.freeze({hp:1,dead:false,destroyed:false})),Object.freeze({hp:0}),Object.freeze({hp:1,dead:true}),Object.freeze({hp:1,destroyed:true})];
  const battle=Object.freeze({badTeam:Object.freeze(actors),enemies:Object.freeze({finalStand:false,remaining:4})});
  assert.equal(enemyHudProgress(battle),`${living} ${living===1?'enemy':'enemies'} · 4 incoming`);
 }
});
