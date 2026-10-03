import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
import {sampledDragAim} from '../site/dist/engine/drag-shooter.mjs';
for(const mode of ['classic','anywhere'])for(const heldSamples of [0,1])test(`${mode} fast release uses its final drag even with ${heldSamples} held samples`,async t=>{
 const ui=await loadGameUI(t);ui.get('aimMode').value=mode;ui.click('applySettings');ui.click('start');ui.frames(31);
 const start=mode==='classic'?{...ui.battle.hero.launchPosition}:{x:900,y:500},end={x:start.x-130,y:start.y+65},aims=[],shoot=ui.battle.shoot.bind(ui.battle);ui.battle.shoot=aim=>{aims.push({...aim});return shoot(aim);};
 ui.pointer('pointerdown',1,start);if(heldSamples)ui.frames(heldSamples);ui.pointer('pointermove',1,end);ui.pointer('pointerup',1,end);ui.frames();
 assert.equal(ui.battle.stats.shotsFired,1);const expected=sampledDragAim(start,end),actual=aims.at(-1);assert.ok(Math.abs(actual.vx-expected.vx)<1e-9);assert.ok(Math.abs(actual.vy-expected.vy)<1e-9);ui.frames(5);assert.equal(ui.battle.stats.shotsFired,1);
});
for(const mode of ['classic','anywhere'])test(`${mode} zero-length click cannot reuse prior power, and resize cancels a flick with feedback`,async t=>{
 const ui=await loadGameUI(t);ui.get('aimMode').value=mode;ui.click('applySettings');ui.click('start');ui.frames(31);ui.battle.shooter.lastPower=1;const o={...ui.battle.hero.launchPosition};ui.pointer('pointerdown',1,o);ui.frames();ui.pointer('pointerup',1,o);ui.frames();assert.equal(ui.battle.stats.shotsFired,0);ui.pointer('pointerdown',2,o);ui.pointer('pointermove',2,{x:o.x-140,y:o.y+40});ui.dispatch(ui.window,'resize');ui.pointer('pointerup',2,{x:o.x-140,y:o.y+40});ui.frames();assert.equal(ui.battle.stats.shotsFired,0);assert.match(ui.get('hudToast').textContent,/View changed/);
});
