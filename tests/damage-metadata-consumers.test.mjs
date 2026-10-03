import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
import {elementalNotice} from '../site/dist/elemental-feedback.mjs';
import {combatNotice} from '../site/dist/combat-feedback.mjs';
test('real impact metadata cannot recolor ordinary floating nominal damage',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=test'});ui.click('introTesting');ui.get('testProtection').checked=true;ui.dispatch(ui.get('testProtection'),'change');ui.click('closeTesting');ui.click('start');
 const b=ui.battle,canvas=ui.get('battlefield'),events=[],onEvent=b.onEvent;b.onEvent=event=>{if(event.type==='damage')events.push(event);onEvent(event);};canvas.captureDraws=true;canvas.drawCalls=[];
 // Real effect-queue callbacks, with explicit supplied test protection. No
 // damage event is fabricated; applied HP loss is zero while nominal text stays.
 b.queueImpact({target:b.hero,amount:17});
 b.queueImpact({source:{kind:'fire_arrow',team:'bad',x:0,y:0},target:b.hero,amount:19});
 ui.frames(2);assert.deepEqual(events.map(e=>[e.damage,e.actualDamage]),[[17,0],[19,0]]);assert.equal(events[0].source,null);assert.equal(events[1].source.kind,'fire_arrow');
 let fill=null;const colors=new Map();
 for(const call of canvas.drawCalls){if(call.name==='set:fillStyle')fill=call.args[0];if(call.name==='fillText'&&['17','19'].includes(String(call.args[0])))colors.set(String(call.args[0]),fill);}
 assert.equal(colors.get('17'),'#e7c29b');assert.equal(colors.get('19'),'#e7c29b');
 for(const event of events){assert.equal(elementalNotice(event),null);assert.equal(combatNotice(event),null);}
});
