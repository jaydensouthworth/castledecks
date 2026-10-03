import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
import {assistedAutoAim} from '../site/dist/engine/assisted-auto-aim.mjs';

async function ready(t,{auto=false,allies=false}={}){
 const ui=await loadGameUI(t,{search:'?mode=test'});
 ui.click('introTesting');ui.click('testGoldLarge');if(allies)ui.click('testUnlock');ui.click('closeTesting');
 if(auto){ui.click('introSettings');ui.get('aimMode').value='auto_aim';ui.click('applySettings');}
 ui.click('start');ui.frames(31);return ui;
}
test('G shares companion summon/signature gates and ignores held repeats',async t=>{
 const ui=await ready(t,{allies:true}),b=ui.battle,gold=b.profile.gold;
 assert.match(ui.get('companionAction').getAttribute('aria-label'),/Shortcut G/);
 ui.key('keydown','g');assert.equal(b.profile.gold,gold-150);const unit=b.companions.unit;assert.ok(unit);assert.equal(unit.signatureCooldown,0);
 ui.key('keydown','g',{repeat:true});assert.equal(unit.signatureCooldown,0);
 ui.key('keyup','g');ui.key('keydown','g');assert.ok(unit.signatureCooldown>0);
 const cooldown=unit.signatureCooldown;ui.key('keydown','g');assert.equal(unit.signatureCooldown,cooldown);assert.equal(b.profile.gold,gold-150);
 ui.click('battlePause');ui.click('companionRecall');ui.click('resumeGame');ui.key('keydown','g');assert.equal(b.companions.unit,null);assert.equal(b.profile.gold,gold-150);
});
test('G cannot summon unowned or unaffordable companions',async t=>{
 const ui=await ready(t);ui.key('keydown','g');assert.equal(ui.battle.companions.unit,null);
 ui.battle.profile.companionOwned.add('gorath');ui.battle.profile.companionId='gorath';ui.battle.profile.gold=149;ui.key('keydown','g');assert.equal(ui.battle.companions.unit,null);assert.equal(ui.battle.profile.gold,149);
});
test('G and V ignore modifiers, text editing, repeated keys, paused screens and management panels',async t=>{
 const ui=await ready(t,{auto:true,allies:true}),b=ui.battle;
 for(const key of ['g','v']){
  for(const field of ['ctrlKey','metaKey','altKey','shiftKey','repeat'])ui.key('keydown',key,{[field]:true});
  for(const id of ['battlePower','trajectory'])ui.key('keydown',key,{target:ui.get(id)});
  ui.key('keydown',key,{target:{tagName:'DIV',isContentEditable:true}});
 }
 assert.equal(b.companions.unit,null);assert.equal(b.shooter.angleMode,1);
 ui.click('battlePause');for(const key of ['g','v'])ui.key('keydown',key);assert.equal(b.companions.unit,null);assert.equal(b.shooter.angleMode,1);
 ui.click('openSettings');for(const key of ['g','v'])ui.key('keydown',key);assert.equal(b.companions.unit,null);assert.equal(b.shooter.angleMode,1);
});
test('Auto arc changes instantly without stepping time, and queued/flying shots retain their captured vector and gravity',async t=>{
 const ui=await ready(t,{auto:true}),b=ui.battle,target={x:1200,y:430};
 assert.equal(ui.visible('liveArc'),true);assert.equal(ui.get('liveArcLabel').textContent,'Low arc');
 ui.pointer('pointerdown',1,target);ui.pointer('pointerup',1,target);assert.equal(b.playerShots.length,1);const queued={...b.playerShots[0].aim},tick=b.tick;
 ui.key('keydown','v');assert.equal(b.tick,tick);assert.equal(b.shooter.angleMode,0);assert.equal(ui.get('trajectory').value,'0');assert.equal(ui.get('liveArcLabel').textContent,'High arc');assert.deepEqual(b.playerShots[0].aim,queued);
 const high=assistedAutoAim(b.hero.launchPosition,target,{angleMode:0});assert.notEqual(high.vy,queued.vy);
 ui.frames();const arrow=b.projectiles.find(p=>p.owner===b.hero);assert.ok(arrow);const captured={vx:arrow.vx,vy:arrow.vy,gravity:arrow.gravity};
 ui.click('liveArc');assert.equal(b.shooter.angleMode,1);assert.deepEqual({vx:arrow.vx,vy:arrow.vy,gravity:arrow.gravity},captured);assert.equal(ui.get('trajectory').value,'1');
 ui.key('keydown','v');ui.frames(35);ui.pointer('pointerdown',2,target);ui.pointer('pointerup',2,target);assert.equal(b.playerShots[0].aim.angleMode,0);
});
test('arc switch is unavailable outside Auto aim and before battle starts',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=test'});assert.equal(ui.visible('liveArc'),false);ui.key('keydown','v');assert.equal(ui.battle.shooter.angleMode,1);
 ui.click('introSettings');ui.get('aimMode').value='auto_aim';ui.click('applySettings');assert.equal(ui.get('liveArc').disabled,true);ui.key('keydown','v');assert.equal(ui.battle.shooter.angleMode,1);
 ui.click('start');ui.key('keydown','v');assert.equal(ui.battle.shooter.angleMode,0);
});

test('live arc preview follows captured flight vectors and local gravity at a bounded sample count',async()=>{
 const {autoTrajectoryPoints}=await import('../site/dist/alternate-aim-guides.mjs');
 const origin={x:350,y:571.728515625},target={x:1800,y:100};
 const low=assistedAutoAim(origin,target,{angleMode:1}),high=assistedAutoAim(origin,target,{angleMode:0});
 const points=autoTrajectoryPoints(low,target),highPoints=autoTrajectoryPoints(high,target);
 assert.equal(points.length,49);assert.deepEqual(points[0],origin);assert.notEqual(points[12].y,highPoints[12].y);
 const t=(target.x-origin.x)/low.vx;assert.equal(points.at(-1).x,target.x);assert.equal(points.at(-1).y,origin.y+low.vy*t+low.gravity*t*(t-1)/2);
 assert.ok(points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
 assert.equal(autoTrajectoryPoints(low,target,{segments:100000}).length,65);
 assert.deepEqual(autoTrajectoryPoints({...low,vx:NaN},target),[]);assert.deepEqual(autoTrajectoryPoints({...low,vx:0},target),[]);
});

test('arc preview samples match the real Arrow constructor advance and every subsequent gravity-first step',async()=>{
 const {Arrow}=await import('../site/dist/engine/ballistics.mjs');const {autoTrajectoryPoints}=await import('../site/dist/alternate-aim-guides.mjs');
 const aim={canFire:true,origin:{x:350,y:570},vx:8,vy:-10,gravity:.2};
 const points=autoTrajectoryPoints(aim,{x:350+8*48},{segments:48}),arrow=new Arrow({...aim.origin,vx:aim.vx,vy:aim.vy,gravity:aim.gravity});
 for(let n=1;n<points.length;n++){if(n>1)arrow.step();assert.ok(Math.abs(points[n].x-arrow.x)<1e-9);assert.ok(Math.abs(points[n].y-arrow.y)<1e-9);}
});
