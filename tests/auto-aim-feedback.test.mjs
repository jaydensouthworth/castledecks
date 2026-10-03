import test from 'node:test';import assert from 'node:assert/strict';
import {autoAimFeedback} from '../site/dist/auto-aim-feedback.mjs';
import {assistedAutoAim} from '../site/dist/engine/assisted-auto-aim.mjs';
import {CampaignBattle} from '../site/dist/engine/first-battle.mjs';
const origin=Object.freeze({x:350,y:571.728515625});
test('feedback is read-only and agrees with actual assisted launch solver across arcs/powers/map quadrants',()=>{
 for(const angleMode of [0,1])for(const powerPercent of [50,70,100])for(const x of [0,349,350,351,700,1400,1800,1990])for(const y of [-100,0,100,350,700]){
  const target=Object.freeze({x,y}),options=Object.freeze({angleMode,powerPercent}),state=autoAimFeedback(origin,target,options),aim=assistedAutoAim(origin,target,options);
  assert.equal(['reachable','assisted'].includes(state.state),aim.canFire===true);
  if(aim.rangeAssisted)assert.equal(state.state,'assisted');
 }
});
test('range help distinguishes supported assisted arcs from insufficient power and the hard limit',()=>{
 assert.match(autoAimFeedback(origin,{x:1500,y:270},{powerPercent:50}).message,/Increase power/);
 assert.equal(autoAimFeedback(origin,{x:1800,y:100},{powerPercent:100}).state,'assisted');
 assert.match(autoAimFeedback(origin,{x:1800,y:100},{powerPercent:50}).message,/Increase power/);
 assert.match(autoAimFeedback({x:0,y:10000},{x:2000,y:-350}).message,/assist limit/);
 assert.equal(autoAimFeedback(origin,{x:1500,y:270}).state,'reachable');
});
test('vertical targets are supported; invalid/coincident samples are not presented as reachable',()=>{
 assert.equal(autoAimFeedback(origin,{x:350,y:100}).state,'reachable');
 assert.equal(autoAimFeedback(origin,origin).state,'invalid');
 for(const bad of [NaN,Infinity,undefined])assert.equal(autoAimFeedback(origin,{x:bad,y:100}).state,'invalid');
});
test('destroying Battle16 keep retains assisted reach of every sampled upper-right point',()=>{
 const b=new CampaignBattle({level:16});const targets=[{x:1800,y:100},{x:1850,y:339.87},{x:1800,y:380},{x:1500,y:270}];
 const before=targets.map(p=>autoAimFeedback(b.hero.launchPosition,p));b.badCastle.takeDamage(b.badCastle.hp);
 assert.deepEqual(targets.map(p=>autoAimFeedback(b.hero.launchPosition,p)),before);assert.ok(before.every(a=>['reachable','assisted'].includes(a.state)));
});
