import test from 'node:test';import assert from 'node:assert/strict';
import {CampaignBattle} from '../site/dist/engine/first-battle.mjs';
import {createControlBindings} from '../site/dist/control-bindings.mjs';
import {createTrainingRun,createTrainingBattleOptions,prepareTrainingBattle,trainingCopy} from '../site/dist/guided-training.mjs';
function fixture(index){const run=createTrainingRun();run.index=index;const battle=new CampaignBattle(createTrainingBattleOptions(run));return prepareTrainingBattle(battle,run);}
test('training arc and companion references follow remapped controls and retain default fallback',()=>{
 const controls=createControlBindings({getStorage:()=>null});controls.apply({...controls.bindings,arc:'j',companion:'h'});
 const arc=fixture(1);assert.match(trainingCopy(arc).instruction,/V on keyboard/);assert.match(trainingCopy(arc,controls.label).instruction,/J on keyboard/);
 const companion=fixture(4);assert.equal(companion.battle.companions.act(),true);assert.match(trainingCopy(companion).instruction,/press G again/);assert.match(trainingCopy(companion,controls.label).instruction,/press H again/);
});
