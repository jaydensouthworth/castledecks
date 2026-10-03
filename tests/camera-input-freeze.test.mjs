import test from 'node:test';import assert from 'node:assert/strict';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
import {sampledDragAim} from '../site/dist/engine/drag-shooter.mjs';
import {createWorldCamera,worldToScreen} from '../site/dist/world-camera.mjs';
import {frameCombatCamera} from '../site/dist/combat-camera.mjs';
import {fortificationGeometry} from '../site/dist/fortress-art.mjs';
async function fixture(t){
 const ui=await loadGameUI(t);ui.click('start');ui.frames(31);let dockTop=260;const rect={left:0,top:0,width:740,height:320};
 ui.get('battlefield').getBoundingClientRect=()=>({...rect});ui.document.querySelector('.live-action-bar').getBoundingClientRect=()=>({top:dockTop,bottom:312});ui.document.querySelector('.live-vitals').getBoundingClientRect=()=>({top:6,bottom:55});ui.document.querySelector('.live-battle-standard').getBoundingClientRect=()=>({top:6,bottom:54});
 const b=ui.battle,base=createWorldCamera(740,320),camera=frameCombatCamera(base,{groundY:Math.max(...b.terrain.samples),structureTopY:Math.min(...b.structures.map(s=>fortificationGeometry(s).body.y)),aimOriginTopY:Math.min(Math.min(...b.terrain.samples)-30,...b.structures.map(s=>s.y+s.shotOffset.y)),top:61,bottom:254});
 return {ui,rect,camera,inset:()=>{dockTop=236;}};
}
test('a changing HUD inset cannot change the world mapping of an active draw',async t=>{
 const {ui,camera,inset}=await fixture(t),start={...ui.battle.hero.launchPosition},end={x:start.x-130,y:start.y+65},aims=[],shoot=ui.battle.shoot.bind(ui.battle);ui.battle.shoot=aim=>{aims.push({...aim});return shoot(aim);};
 ui.pointer('pointerdown',7,worldToScreen(camera,start));inset();ui.frames(3);ui.pointer('pointermove',7,worldToScreen(camera,end));ui.pointer('pointerup',7,worldToScreen(camera,end));ui.frames();
 assert.equal(ui.battle.stats.shotsFired,1);const actual=aims.at(-1),expected=sampledDragAim(start,end);assert.ok(Math.abs(actual.vx-expected.vx)<1e-8);assert.ok(Math.abs(actual.vy-expected.vy)<1e-8);
});
test('actual viewport resize cancels an active draw instead of reinterpreting its release',async t=>{
 const {ui,camera,rect}=await fixture(t),start={...ui.battle.hero.launchPosition};ui.pointer('pointerdown',9,worldToScreen(camera,start));ui.frames();rect.width=700;ui.pointer('pointerup',9,{x:100,y:200});ui.frames();assert.equal(ui.battle.stats.shotsFired,0);assert.equal(ui.battle.input.mouseDown,false);assert.equal(ui.battle.shooter.holding,false);assert.match(ui.get('hudToast').textContent,/View changed/);
});
