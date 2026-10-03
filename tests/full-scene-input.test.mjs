import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
import {createWorldCamera,worldToScreen} from '../site/dist/world-camera.mjs';
import {sampledDragAim,DragShooter} from '../site/dist/engine/drag-shooter.mjs';
import {createPortraitView} from '../site/dist/portrait-view.mjs';
import {createShooter} from '../site/dist/engine/alternate-shooter.mjs';

for(const [name,width,height,dpr] of [['landscape',917,404,1],['portrait',390,844,3],['wide',2400,850,1.25]])test(`actual ${name} pointer handlers preserve the same world drag and launch vector`,async t=>{
 const ui=await loadGameUI(t),canvas=ui.get('battlefield'),rect={left:17,top:23,width,height};canvas.getBoundingClientRect=()=>rect;ui.window.devicePixelRatio=dpr;ui.click('start');ui.frames(31);const origin={...ui.battle.hero.launchPosition},end={x:origin.x-150,y:origin.y+65},camera=width<height?createPortraitView(width,height,{heroX:ui.battle.hero.x,groundY:Math.max(...ui.battle.terrain.samples),groundBottom:-rect.top-26}):createWorldCamera(width,height);const client=p=>{const q=worldToScreen(camera,p);return{x:q.x+rect.left,y:q.y+rect.top};};const attempts=[],shoot=ui.battle.shoot.bind(ui.battle);ui.battle.shoot=aim=>{attempts.push({...aim});return shoot(aim);};
 ui.pointer('pointerdown',1,client(origin));ui.frames();ui.pointer('pointermove',1,client(end));ui.frames();ui.pointer('pointerup',1,client(end));ui.frames();
 assert.equal(ui.battle.stats.shotsFired,1);const expected=sampledDragAim(origin,end),actual=attempts.at(-1);assert.ok(Math.abs(actual.vx-expected.vx)<1e-9);assert.ok(Math.abs(actual.vy-expected.vy)<1e-9);assert.ok(canvas.width<=4096&&canvas.height<=4096);assert.ok(canvas.width>=width*Math.min(1,dpr));
});
test('resizing cancels a captured draw and hidden zero-size canvases reject input safely',async t=>{
 const ui=await loadGameUI(t);ui.click('start');ui.frames(31);const o={...ui.battle.hero.launchPosition};ui.pointer('pointerdown',1,o);ui.frames();assert.equal(ui.battle.shooter.holding,true);ui.dispatch(ui.window,'resize');assert.equal(ui.battle.shooter.holding,false);assert.equal(ui.get('battlefield').hasPointerCapture(1),false);ui.pointer('pointerup',1,{x:o.x-150,y:o.y+60});ui.frames();assert.equal(ui.battle.stats.shotsFired,0);
 ui.get('battlefield').getBoundingClientRect=()=>({left:0,top:0,width:0,height:0});ui.pointer('pointerdown',2,o);ui.frames();assert.equal(ui.battle.input.mouseDown,false);assert.equal(ui.battle.stats.shotsFired,0);
});
test('full-scene drawing accepts exposed canvas below the former HUD cutoff while reference controllers retain their default',async t=>{
 const ui=await loadGameUI(t);ui.get('aimMode').value='anywhere';ui.click('applySettings');ui.click('start');ui.frames(31);ui.pointer('pointerdown',1,{x:900,y:900});ui.frames();ui.pointer('pointermove',1,{x:750,y:950});ui.frames();ui.pointer('pointerup',1,{x:750,y:950});ui.frames();assert.equal(ui.battle.stats.shotsFired,1);
 for(const mode of ['classic','point_aim','auto_aim']){const shooter=createShooter({origin:{x:350,y:476},mode});assert.equal(shooter.maxPointerY,865);shooter.press({x:900,y:900});assert.equal(shooter.step(),null);}
 assert.equal(new DragShooter({origin:{x:350,y:476}}).maxPointerY,865);
});

test('portrait classic ring keeps a44px visible target while the shot remains anchored to the hero',async t=>{
 const ui=await loadGameUI(t),canvas=ui.get('battlefield'),width=390,height=844;canvas.getBoundingClientRect=()=>({left:0,top:0,width,height});canvas.captureDraws=true;ui.click('start');ui.frames(31);const origin={...ui.battle.hero.launchPosition},camera=createPortraitView(width,height,{heroX:ui.battle.hero.x,groundY:Math.max(...ui.battle.terrain.samples),groundBottom:-26}),screen=worldToScreen(camera,origin),radius=Math.max(22,69.2*camera.scale);
 ui.pointer('pointerdown',1,{x:screen.x+radius+2,y:screen.y});ui.frames();assert.equal(ui.battle.shooter.holding,false,'outside the visible minimum ring remains rejected');
 canvas.drawCalls=[];ui.pointer('pointerdown',2,{x:screen.x+radius-2,y:screen.y});ui.frames();assert.equal(ui.battle.shooter.holding,true);assert.deepEqual(ui.battle.shooter.active.anchor,origin);
 assert.ok(canvas.drawCalls.some(c=>c.name==='arc'&&Math.abs(c.args[2]*camera.scale-radius)<1e-9),'rendered ring matches the44px input target');
 const end={x:origin.x-150,y:origin.y+65},endScreen=worldToScreen(camera,end),attempts=[],shoot=ui.battle.shoot.bind(ui.battle);ui.battle.shoot=aim=>{attempts.push({...aim});return shoot(aim);};ui.pointer('pointermove',2,endScreen);ui.frames();ui.pointer('pointerup',2,endScreen);ui.frames();
 const expected=sampledDragAim(origin,end);assert.equal(ui.battle.stats.shotsFired,1);assert.ok(Math.abs(attempts.at(-1).vx-expected.vx)<1e-9);assert.ok(Math.abs(attempts.at(-1).vy-expected.vy)<1e-9);
});

test('actual auto-aim guide follows canvas input and clears across menu, pause, mouse leave and resize',async t=>{
 const ui=await loadGameUI(t),canvas=ui.get('battlefield');canvas.captureDraws=true;ui.get('aimMode').value='auto_aim';ui.click('applySettings');ui.click('start');
 const target={x:777,y:333},rendered=()=>canvas.drawCalls.some(c=>c.name==='translate'&&c.args[0]===target.x&&c.args[1]===target.y),paint=()=>{canvas.drawCalls=[];ui.frames();};
 paint();assert.equal(rendered(),false,'no synthetic target before a real pointer');ui.pointer('pointermove',1,target);paint();assert.equal(rendered(),true);assert.equal(ui.battle.stats.shotsFired,0,'hover guide does not fire');
 ui.dispatch(canvas,'pointerleave',{pointerType:'mouse'});paint();assert.equal(rendered(),false);
 ui.pointer('pointermove',1,target);ui.frames();ui.click('battlePause');paint();assert.equal(rendered(),false);ui.click('resumeGame');paint();assert.equal(rendered(),false,'resume does not display a stale target');
 ui.pointer('pointermove',1,target);paint();assert.equal(rendered(),true);ui.dispatch(ui.window,'resize');paint();assert.equal(rendered(),false);
 ui.pointer('pointermove',1,target);ui.frames();ui.click('openQueue');paint();assert.equal(rendered(),false);ui.click('closeQueue');paint();assert.equal(rendered(),false);
});
