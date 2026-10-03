import test from 'node:test';import assert from 'node:assert/strict';
import {frameCombatCamera} from '../site/dist/combat-camera.mjs';
import {createWorldCamera,worldToScreen,screenToWorld} from '../site/dist/world-camera.mjs';
import {CampaignBattle} from '../site/dist/engine/first-battle.mjs';
import {fortificationGeometry} from '../site/dist/fortress-art.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
for(const [w,h,bottomInset,top]of[[915,360,10,70],[915,360,24,70],[740,320,8,61],[740,320,24,61]])test(`all campaign targets and marching ground fit ${w}x${h} with bottom inset ${bottomInset}`,()=>{
 for(let level=1;level<=30;level++){
  const battle=new CampaignBattle({level,random:()=>.5}),before=battle.terrain.samples.slice(),base=createWorldCamera(w,h),groundY=Math.max(...before),structureTopY=Math.min(...battle.structures.map(b=>fortificationGeometry(b).body.y)),aimOriginTopY=Math.min(Math.min(...before)-30,...battle.structures.map(b=>b.y+b.shotOffset.y)),bottom=h-bottomInset-(h<=330?52:56)-6;
  const camera=frameCombatCamera(base,{groundY,structureTopY,aimOriginTopY,top,bottom});
  assert.ok(camera.scale<=base.scale);assert.ok(worldToScreen(camera,{x:0,y:groundY}).y<=bottom+1e-7);assert.ok(worldToScreen(camera,{x:0,y:structureTopY}).y>=top-1e-7);
  assert.ok(worldToScreen(camera,{x:0,y:aimOriginTopY}).y-Math.max(22,69.2*camera.scale)>=top-1e-7);
  for(const p of [battle.hero.launchPosition,{x:0,y:0},{x:2000,y:1000}]){const back=screenToWorld(camera,worldToScreen(camera,p));near(back.x,p.x);near(back.y,p.y);}
  assert.deepEqual(battle.terrain.samples,before);
 }
});
test('ordinary roomy layout retains the original world transform',()=>{const c=createWorldCamera(915,360),f=frameCombatCamera(c,{groundY:730,structureTopY:490,aimOriginTopY:500,top:60,bottom:300});near(f.scale,c.scale);near(f.offsetX,c.offsetX);near(f.offsetY,c.offsetY);});
test('invalid or hidden HUD measurements retain the prior renderable camera',()=>{const c=createWorldCamera(915,360);for(const bad of [{},{top:2,bottom:2},{groundY:NaN,structureTopY:1,aimOriginTopY:2,top:0,bottom:300}])assert.equal(frameCombatCamera(c,bad),c);});
test('framing has no dependence on hero movement or garrison transition',()=>{const b=new CampaignBattle({level:5,random:()=>.5}),c=createWorldCamera(740,320),options={groundY:Math.max(...b.terrain.samples),structureTopY:Math.min(...b.structures.map(s=>fortificationGeometry(s).body.y)),aimOriginTopY:Math.min(...b.structures.map(s=>s.y+s.shotOffset.y)),top:61,bottom:238};const f=frameCombatCamera(c,options);b.hero.leaveGarrison();b.input={right:true};b.hero.step();assert.deepEqual(frameCombatCamera(c,options),f);});
