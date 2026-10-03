import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
import {sampledDragAim} from '../site/dist/engine/drag-shooter.mjs';
import {pointAim} from '../site/dist/engine/alternate-shooter.mjs';
const near=(a,b,label='')=>assert.ok(Math.abs(a-b)<1e-8,`${label}: ${a} ≈ ${b}`);
test('Anywhere retains the accepted press when the pointer moves before its first held sample',async t=>{
 const ui=await loadGameUI(t);ui.get('aimMode').value='anywhere';ui.click('applySettings');ui.click('start');ui.frames(31);
 const start={x:900,y:500},middle={x:850,y:480},end={x:760,y:560},attempts=[],shoot=ui.battle.shoot.bind(ui.battle);
 ui.battle.shoot=aim=>{attempts.push({...aim});return shoot(aim);};
 ui.pointer('pointerdown',1,start);ui.pointer('pointermove',1,middle);ui.frames();
 assert.deepEqual(ui.battle.shooter.active.anchor,start,'the modern UI anchors the gesture at pointerdown');
 ui.pointer('pointermove',1,end);ui.pointer('pointerup',1,end);ui.frames();
 const expected=sampledDragAim(start,end);near(attempts.at(-1).vx,expected.vx);near(attempts.at(-1).vy,expected.vy);
});
test('Point quick tap uses its actual release coordinate when no intermediate move event arrives',async t=>{
 const ui=await loadGameUI(t);ui.get('aimMode').value='point_aim';ui.click('applySettings');ui.click('start');ui.frames(31);
 const origin={...ui.battle.hero.launchPosition},start={x:800,y:400},end={x:850,y:550},attempts=[],shoot=ui.battle.shoot.bind(ui.battle);
 ui.battle.shoot=aim=>{attempts.push({...aim});return shoot(aim);};
 ui.pointer('pointerdown',1,start);ui.pointer('pointerup',1,end);ui.frames();
 const expected=pointAim(origin,end);near(attempts.at(-1).vx,expected.vx);near(attempts.at(-1).vy,expected.vy);
});

import {createWorldCamera,worldToScreen} from '../site/dist/world-camera.mjs';
import {createPortraitView} from '../site/dist/portrait-view.mjs';
import {frameCombatCamera} from '../site/dist/combat-camera.mjs';
import {fortificationGeometry} from '../site/dist/fortress-art.mjs';
import {sampleManualAim,drawManualAimGuide} from '../site/dist/manual-aim-guide.mjs';

// Replay the actual Canvas calls emitted by battle.mjs; no replacement renderer.
function manualStroke(calls,ratioX=1,ratioY=1){
 let matrix=[1,0,0,1,0,0],state={},path=[],stack=[],found;
 const project=(x,y)=>({x:(matrix[0]*x+matrix[2]*y+matrix[4])/ratioX,y:(matrix[1]*x+matrix[3]*y+matrix[5])/ratioY});
 for(const {name,args} of calls){
  const [a,b,c,d,e,f]=matrix;
  if(name==='save')stack.push({matrix:[...matrix],state:{...state}});
  else if(name==='restore'){const previous=stack.pop();if(previous){matrix=previous.matrix;state=previous.state;}}
  else if(name==='setTransform')matrix=[...args];
  else if(name==='translate'){const[x,y]=args;matrix=[a,b,c,d,a*x+c*y+e,b*x+d*y+f];}
  else if(name==='scale'){const[x,y]=args;matrix=[a*x,b*x,c*y,d*y,e,f];}
  else if(name==='rotate'){const cos=Math.cos(args[0]),sin=Math.sin(args[0]);matrix=[a*cos+c*sin,b*cos+d*sin,c*cos-a*sin,d*cos-b*sin,e,f];}
  else if(name.startsWith('set:'))state[name.slice(4)]=args[0];
  else if(name==='beginPath')path=[];
  else if(name==='moveTo'||name==='lineTo')path.push({kind:name,...project(...args)});
  else if(name==='stroke'&&state.strokeStyle==='#f9e5b6'&&state.lineWidth===2&&path.length===5)found={path:[...path],state:{...state}};
 }
 return found;
}

async function layoutFixture(t,mode,layout){
 const ui=await loadGameUI(t),canvas=ui.get('battlefield');
 ui.get('aimMode').value=mode;ui.click('applySettings');
 const rect={left:17,top:23,width:layout.width,height:layout.height};
 canvas.getBoundingClientRect=()=>({...rect});ui.window.devicePixelRatio=layout.dpr;
 ui.document.querySelector('.live-action-bar').getBoundingClientRect=()=>({top:rect.top+rect.height-70,bottom:rect.top+rect.height-8});
 ui.document.querySelector('.live-vitals').getBoundingClientRect=()=>({top:rect.top+6,bottom:rect.top+55});
 ui.document.querySelector('.live-battle-standard').getBoundingClientRect=()=>({top:rect.top+6,bottom:rect.top+54});
 ui.document.querySelector('.live-movement').getBoundingClientRect=()=>({top:rect.top+rect.height-155});
 ui.click('start');ui.frames(31);
 if(layout.pan!=null){ui.get('viewCenter').value=String(layout.pan);ui.dispatch(ui.get('viewCenter'),'input');}
 if(layout.overview)ui.click('viewOverview');
 const b=ui.battle;let camera=createWorldCamera(rect.width,rect.height);
 if(rect.width<rect.height)camera=createPortraitView(rect.width,rect.height,{heroX:b.hero.x,center:layout.pan??null,overview:!!layout.overview,groundY:Math.max(...b.terrain.samples),groundBottom:Math.min(rect.height*.58,rect.height-181)});
 else if(rect.height<=500)camera=frameCombatCamera(camera,{groundY:Math.max(...b.terrain.samples),structureTopY:Math.min(...b.structures.map(s=>fortificationGeometry(s).body.y)),aimOriginTopY:Math.min(Math.min(...b.terrain.samples)-30,...b.structures.map(s=>s.y+s.shotOffset.y)),top:rect.width>=700?6:61,bottom:rect.height-76});
 const client=p=>{const q=worldToScreen(camera,p);return{x:q.x+rect.left,y:q.y+rect.top};};
 canvas.captureDraws=true;
 return{ui,canvas,rect,camera,client};
}

const layouts=[
 {name:'desktop',width:1280,height:720,dpr:1.25},
 {name:'landscape',width:915,height:360,dpr:2.75},
 {name:'short landscape',width:740,height:320,dpr:2},
 {name:'portrait close-up',width:412,height:780,dpr:3},
 {name:'portrait panned',width:412,height:780,dpr:1.5,pan:700},
 {name:'portrait overview',width:412,height:780,dpr:2,overview:true},
];
for(const mode of ['classic','anywhere','point_aim'])for(const layout of layouts)test(`${mode}: actual ${layout.name} guide starts at hero and matches actual launch velocity/power`,async t=>{
 const {ui,canvas,rect,camera,client}=await layoutFixture(t,mode,layout),origin={...ui.battle.hero.launchPosition};
 const start=mode==='anywhere'?{x:700,y:460}:origin;
 const pointer=mode==='point_aim'?{x:origin.x+330,y:origin.y-90}:{x:start.x-126,y:start.y+65};
 const expected=mode==='point_aim'?pointAim(origin,pointer):sampledDragAim(start,pointer);
 const launches=[],queue=ui.battle.queueProjectile.bind(ui.battle);
 ui.battle.queueProjectile=request=>{if(request.owner===ui.battle.hero)launches.push({...request});return queue(request);};
 if(mode!=='point_aim')ui.pointer('pointerdown',1,client(start));
 ui.pointer('pointermove',1,client(pointer));canvas.drawCalls=[];ui.frames();
 const stroke=manualStroke(canvas.drawCalls,canvas.width/rect.width,canvas.height/rect.height);
 assert.ok(stroke,'actual battle renderer emitted the hero direction arrow');
 const [from,to]=stroke.path,originScreen=worldToScreen(camera,origin);
 near(from.x,originScreen.x,'guide origin x');near(from.y,originScreen.y,'guide origin y');
 const length=Math.hypot(to.x-from.x,to.y-from.y);near(length,42+72*expected.power,'power length');
 near((to.x-from.x)/length,expected.vx/expected.speed,'guide direction x');near((to.y-from.y)/length,expected.vy/expected.speed,'guide direction y');
 assert.ok(canvas.drawCalls.some(c=>c.name==='fillText'&&c.args[0]===`${Math.round(expected.power*100)}%`),'displayed power matches release power');
 assert.equal(canvas.drawCalls.some(c=>c.name==='setLineDash'&&c.args[0]?.length===2&&c.args[0][0]===6),false,'no competing thumb-origin flight line');
 if(mode==='point_aim')ui.pointer('pointerdown',1,client(pointer));
 ui.pointer('pointerup',1,client(pointer));ui.frames();
 assert.equal(launches.length,1);near(launches[0].x,origin.x,'actual launch origin x');near(launches[0].y,origin.y,'actual launch origin y');
 near(launches[0].vx,expected.vx,'actual velocity x');near(launches[0].vy,expected.vy,'actual velocity y');
 assert.equal(ui.battle.stats.shotsFired,1);
});

test('preview uses current pointer rather than a stale held sample and never mutates controllers',async t=>{
 const {ui,canvas,rect,camera,client}=await layoutFixture(t,'anywhere',layouts[1]);
 const origin={...ui.battle.hero.launchPosition},anchor={x:900,y:500};
 ui.pointer('pointerdown',1,client(anchor));ui.pointer('pointermove',1,client({x:810,y:450}));ui.frames();
 const previous={...ui.battle.shooter.active.aim},latest={x:755,y:570};ui.pointer('pointermove',1,client(latest));
 const aim=sampleManualAim({mode:'anywhere',origin,anchor:ui.battle.shooter.active.anchor,pointer:ui.battle.shooter.pointer});
 assert.deepEqual(ui.battle.shooter.active.aim,previous);
 const expected=sampledDragAim(anchor,latest);near(aim.vx,expected.vx);near(aim.vy,expected.vy);
 // Draw the pure helper using the actual UI canvas recorder under its camera.
 canvas.drawCalls=[];const ctx=canvas.getContext('2d');ctx.setTransform(camera.scale,0,0,camera.scale,camera.offsetX,camera.offsetY);
 drawManualAimGuide(ctx,{origin,aim,scale:camera.scale,visible:true});
 const stroke=manualStroke(canvas.drawCalls),[from,to]=stroke.path,length=Math.hypot(to.x-from.x,to.y-from.y);
 near((to.x-from.x)/length,expected.vx/expected.speed);near((to.y-from.y)/length,expected.vy/expected.speed);
 assert.deepEqual(ui.battle.shooter.active.aim,previous);
});

test('release stays captured when a second gesture starts before the firing tick',async t=>{
 const ui=await loadGameUI(t);ui.get('aimMode').value='anywhere';ui.click('applySettings');ui.click('start');ui.frames(31);
 const anchor={x:900,y:500},end={x:760,y:560};ui.pointer('pointerdown',1,anchor);ui.pointer('pointerup',1,end);
 const expected=sampledDragAim(anchor,end);ui.pointer('pointerdown',2,{x:600,y:500});ui.frames();
 assert.equal(ui.battle.stats.shotsFired,1);assert.deepEqual(ui.battle.shooter.active.anchor,{x:600,y:500});
 const shot=ui.battle.projectiles.find(p=>p.kind==='hero_arrow');near(shot.vx,expected.vx);near(shot.vy,expected.vy);
 ui.pointer('pointercancel',2,{x:500,y:450});ui.frames();assert.equal(ui.battle.stats.shotsFired,1);
});

test('manual preview preserves exact source quadrants, vertical cases, drag threshold, saturation and Point power',()=>{
 const origin={x:350,y:560},anchor={x:900,y:500};
 const offsets=[[0,0],[0,-180],[0,180],[-180,0],[180,0],[-100,-90],[-100,90],[100,-90],[100,90],[-20,0],[-40,0],[-400,0]];
 for(const mode of ['classic','anywhere','point_aim'])for(const powerPercent of [50,73,100])for(const [dx,dy] of offsets){
  const from=mode==='anywhere'?anchor:origin,pointer={x:from.x+dx,y:from.y+dy};
  const actual=sampleManualAim({mode,origin,anchor:from,pointer,powerPercent});
  const expected=mode==='point_aim'?pointAim(origin,pointer,powerPercent):sampledDragAim(from,pointer);
  assert.deepEqual(actual,expected);
 }
});

test('zero/weak drag gives power feedback without a false flight arrow; invalid Point cannot draw',async t=>{
 const ui=await loadGameUI(t),canvas=ui.get('battlefield');canvas.captureDraws=true;const ctx=canvas.getContext('2d'),origin={x:350,y:560};
 for(const distance of [0,20]){
  const aim=sampleManualAim({mode:'classic',origin,anchor:origin,pointer:{x:origin.x-distance,y:origin.y}});
  canvas.drawCalls=[];assert.equal(drawManualAimGuide(ctx,{origin,aim,scale:.4,visible:true}),true);
  assert.equal(manualStroke(canvas.drawCalls),undefined);
  assert.ok(canvas.drawCalls.some(c=>c.name==='fillText'&&c.args[0].includes('pull farther')));
 }
 canvas.drawCalls=[];assert.equal(drawManualAimGuide(ctx,{origin,aim:pointAim(origin,origin),scale:.4,visible:true}),false);
 assert.deepEqual(canvas.drawCalls,[]);
 const aim=sampleManualAim({mode:'classic',origin,anchor:origin,pointer:{x:100,y:700}});
 for(const options of [{visible:false},{scale:0},{scale:NaN},{scale:Infinity},{origin:{x:Infinity,y:0}},{origin:{x:Number.MAX_VALUE,y:0},scale:2}]){
  canvas.drawCalls=[];assert.equal(drawManualAimGuide(ctx,{origin,aim,scale:.4,visible:true,...options}),false);assert.deepEqual(canvas.drawCalls,[]);
 }
});

for(const interruption of ['cancel','pause','resize','pan'])test(`manual hero cue and pending gesture clear on ${interruption}`,async t=>{
 const {ui,canvas,client}=await layoutFixture(t,'anywhere',layouts[3]);
 ui.pointer('pointerdown',1,client({x:700,y:500}));ui.pointer('pointermove',1,client({x:560,y:550}));ui.frames();
 if(interruption==='cancel')ui.pointer('pointercancel',1,client({x:560,y:550}));
 if(interruption==='pause')ui.click('battlePause');
 if(interruption==='resize')ui.dispatch(ui.window,'resize');
 if(interruption==='pan'){ui.get('viewCenter').value='1000';ui.dispatch(ui.get('viewCenter'),'input');}
 canvas.drawCalls=[];ui.frames();assert.equal(manualStroke(canvas.drawCalls),undefined);assert.equal(ui.battle.stats.shotsFired,0);
 assert.equal(ui.battle.shooter.holding,false);assert.equal(ui.battle.queuedAim,null);
});

test('a hero movement requested after release preserves velocity while using actual dispatch origin',async t=>{
 const ui=await loadGameUI(t);ui.get('aimMode').value='anywhere';ui.click('applySettings');ui.click('start');ui.frames(31);
 const origin={...ui.battle.hero.launchPosition},start={x:900,y:500},end={x:760,y:550},expected=sampledDragAim(start,end),requests=[],queue=ui.battle.queueProjectile.bind(ui.battle);
 ui.battle.queueProjectile=request=>{if(request.owner===ui.battle.hero)requests.push({...request});return queue(request);};
 ui.pointer('pointerdown',1,start);ui.pointer('pointermove',1,end);ui.frames();ui.pointer('pointerup',1,end);ui.key('keydown','d');ui.frames();
 assert.equal(requests.length,1);assert.notEqual(ui.battle.hero.x,origin.x,'ordinary post-release movement is retained');
 assert.deepEqual({x:requests[0].x,y:requests[0].y},ui.battle.hero.launchPosition);
 near(requests[0].vx,expected.vx);near(requests[0].vy,expected.vy);
});

test('an animation frame between simulation ticks repaints the latest manual guide without advancing world',async t=>{
 const {ui,canvas,rect,client}=await layoutFixture(t,'anywhere',layouts[1]);
 const anchor={x:900,y:500};ui.pointer('pointerdown',1,client(anchor));ui.pointer('pointermove',1,client({x:820,y:450}));
 // Capture the actual module's scheduled RAF callback. Its real fixed-step
 // clock receives a 1 ms render frame, not a substituted renderer/controller.
 const original=globalThis.requestAnimationFrame;let nextFrame;
 globalThis.requestAnimationFrame=callback=>{nextFrame=callback;return 1;};
 t.after(()=>{globalThis.requestAnimationFrame=original;});
 ui.frames();const tick=ui.battle.tick,previous={...ui.battle.shooter.active.aim},latest={x:750,y:575};
 ui.pointer('pointermove',1,client(latest));canvas.drawCalls=[];nextFrame(performance.now()+1);
 assert.equal(ui.battle.tick,tick);assert.deepEqual(ui.battle.shooter.active.aim,previous);
 const stroke=manualStroke(canvas.drawCalls,canvas.width/rect.width,canvas.height/rect.height);
 assert.ok(stroke,'pointer input dirtied the actual frame renderer before the next 33 Hz sample');
 const[from,to]=stroke.path,length=Math.hypot(to.x-from.x,to.y-from.y),expected=sampledDragAim(anchor,latest);
 near((to.x-from.x)/length,expected.vx/expected.speed);near((to.y-from.y)/length,expected.vy/expected.speed);
});
