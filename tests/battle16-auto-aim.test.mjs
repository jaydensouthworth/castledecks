import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
import {CampaignBattle} from '../site/dist/engine/first-battle.mjs';
import {autoAim} from '../site/dist/engine/alternate-shooter.mjs';
import {assistedAutoAim} from '../site/dist/engine/assisted-auto-aim.mjs';
import {createWorldCamera,worldToScreen} from '../site/dist/world-camera.mjs';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} should equal ${b}`);
async function ready(t,{width=1920,height=1080}={}){
 const ui=await loadGameUI(t,{search:'?mode=test'});
 ui.click('introTesting');ui.get('testProtection').checked=true;ui.dispatch(ui.get('testProtection'),'change');
 ui.get('testLevel').value='16';ui.click('testLevelApply');
 ui.click('introSettings');ui.get('aimMode').value='auto_aim';ui.click('applySettings');
 const rect={left:17,top:23,width,height};ui.get('battlefield').getBoundingClientRect=()=>rect;
 const camera=createWorldCamera(width,height);const client=p=>{const s=worldToScreen(camera,p);return{x:s.x+rect.left,y:s.y+rect.top};};
 ui.click('start');ui.frames(31);
 // Keep a naturally dispatched living survivor on the field before tests
 // destroy the keep. Empty-field collapse correctly wins under the director.
 const alive=()=>ui.battle.badTeam.some(unit=>unit.hp>0&&!unit.dead&&!unit.destroyed);
 for(let frames=0;frames<132&&!alive();frames++)ui.frames();
 assert.ok(alive(),'the ordinary opening must dispatch a living enemy before collapse');
 assert.ok(ui.battle.enemies.index>0,'the survivor was consumed from the actual reserve');
 assert.equal(ui.battle.outcome,null);
 return{ui,client,camera};
}
for(const [width,height] of [[1280,720],[1920,1080],[2400,850]])test(`Battle16 ${width}x${height} post-keep auto input stays aligned and upper-right range assist fires`,async t=>{
 const {ui,client}=await ready(t,{width,height}),b=ui.battle;
 const nearTarget={x:1500,y:270},farTarget={x:1800,y:100},origin={...b.hero.launchPosition};
 near(origin.x,350);near(origin.y,571.728515625);
 assert.equal(autoAim(origin,nearTarget).canFire,true);assert.equal(autoAim(origin,farTarget).canFire,false);
 for(const collapsed of [false,true]){
  if(collapsed)b.badCastle.takeDamage(b.badCastle.hp);
  assert.deepEqual(b.hero.launchPosition,origin);
  ui.pointer('pointermove',1,client(farTarget));ui.frames();
  near(b.shooter.pointer.x,farTarget.x);near(b.shooter.pointer.y,farTarget.y);
  const shots=b.stats.shotsFired,cooldown=b.activeSkill.cooldown;
  ui.pointer('pointerdown',1,client(farTarget));ui.pointer('pointerup',1,client(farTarget));ui.frames();
  assert.equal(b.stats.shotsFired,shots+1);assert.ok(b.activeSkill.cooldown>cooldown);assert.match(ui.get('combatAimHint').textContent,/Range assist/);
  const assisted=assistedAutoAim(origin,farTarget);near(b.projectiles.at(-1).gravity,assisted.gravity);near(b.projectiles.at(-1).vx,assisted.vx);near(b.projectiles.at(-1).vy,assisted.vy);ui.frames(31);
  ui.pointer('pointerdown',2,client(nearTarget));ui.pointer('pointerup',2,client(nearTarget));ui.frames();
  assert.equal(b.stats.shotsFired,shots+2);ui.frames(31);
 }
});
test('ordinary D key movement reaches a usable Battle16 firing position after enemy keep collapse',async t=>{
 const {ui,client}=await ready(t),b=ui.battle,target={x:1800,y:100};b.badCastle.takeDamage(b.badCastle.hp);
 assert.equal(autoAim(b.hero.launchPosition,target).canFire,false);
 ui.key('keydown','d');ui.frames(400);ui.key('keyup','d');ui.frames();
 assert.equal(b.hero.garrisoned(),false);assert.ok(b.hero.x>900&&Number.isFinite(b.hero.y));
 const expected=autoAim(b.hero.launchPosition,target);assert.equal(expected.canFire,true);
 const shots=b.stats.shotsFired;ui.pointer('pointerdown',1,client(target));ui.pointer('pointerup',1,client(target));ui.frames();
 assert.equal(b.stats.shotsFired,shots+1);const shot=b.projectiles.at(-1);
 near(shot.vx,expected.vx);near(shot.vy,expected.vy);
});
test('Battle16 current power and both trajectory choices preserve the same reachability envelope',()=>{
 const b=new CampaignBattle({level:16}),origin=b.hero.launchPosition;
 for(const angleMode of [0,1]){
  assert.equal(autoAim(origin,{x:1500,y:270},{powerPercent:100,angleMode}).canFire,true);
  assert.equal(autoAim(origin,{x:1500,y:270},{powerPercent:50,angleMode}).canFire,false);
  assert.equal(autoAim(origin,{x:1800,y:100},{powerPercent:100,angleMode}).canFire,false);
 }
});

test('actual UI marks unreachable auto target before a click and clears it on reachability/input boundaries',async t=>{
 const {ui,client}=await ready(t),canvas=ui.get('battlefield');canvas.captureDraws=true;
 const blocked={x:1800,y:100},reachable={x:650,y:550};
 ui.get('battlePower').value='50';ui.dispatch(ui.get('battlePower'),'input');
 ui.battle.badCastle.takeDamage(ui.battle.badCastle.hp);
 ui.pointer('pointermove',1,client(blocked));canvas.drawCalls=[];ui.frames();
 assert.match(ui.get('combatAimHint').textContent,/Out of range.*Increase power/);
 assert.ok(canvas.drawCalls.some(c=>c.name==='set:strokeStyle'&&c.args[0]==='#ffab9b'),'blocked reticle has distinct warning ink');
 ui.pointer('pointerdown',1,client(blocked));ui.pointer('pointerup',1,client(blocked));ui.frames();
 assert.match(ui.get('hudToast').textContent,/50%.*Increase power/);
 ui.pointer('pointermove',1,client(reachable));canvas.drawCalls=[];ui.frames();
 assert.match(ui.get('combatAimHint').textContent,/Lead moving targets/);
 assert.ok(!canvas.drawCalls.some(c=>c.name==='set:strokeStyle'&&c.args[0]==='#ffab9b'),'reachable reticle is normal');
 for(const boundary of ['leave','pause','resize']){
  ui.pointer('pointermove',1,client(blocked));ui.frames();assert.match(ui.get('combatAimHint').textContent,/Out of range/);
  if(boundary==='leave')ui.dispatch(canvas,'pointerleave',{pointerType:'mouse'});
  if(boundary==='pause')ui.click('battlePause');
  if(boundary==='resize')ui.dispatch(ui.window,'resize');
  ui.frames();assert.match(ui.get('combatAimHint').textContent,/Lead moving targets/);
  if(boundary==='pause')ui.click('resumeGame');
 }
});

test('actual Auto power control explains when increasing power solves the selected target',async t=>{
 const {ui,client}=await ready(t),target={x:1500,y:270};
 ui.get('battlePower').value='50';ui.dispatch(ui.get('battlePower'),'input');
 assert.equal(ui.battle.shooter.powerPercent,50);ui.pointer('pointermove',1,client(target));ui.frames();
 assert.match(ui.get('combatAimHint').textContent,/50%.*Increase power/);
 ui.pointer('pointerdown',1,client(target));ui.pointer('pointerup',1,client(target));ui.frames();
 assert.match(ui.get('hudToast').textContent,/50% power.*Increase power/);
 ui.get('battlePower').value='100';ui.dispatch(ui.get('battlePower'),'input');ui.frames();
 assert.equal(ui.battle.shooter.powerPercent,100);assert.match(ui.get('combatAimHint').textContent,/Lead moving targets/);
 const shots=ui.battle.stats.shotsFired;ui.pointer('pointerdown',2,client(target));ui.pointer('pointerup',2,client(target));ui.frames();assert.equal(ui.battle.stats.shotsFired,shots+1);
});
