import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {CampaignBattle} from '../site/dist/engine/first-battle.mjs';
import {frameCombatCamera} from '../site/dist/combat-camera.mjs';
import {createWorldCamera,worldToScreen} from '../site/dist/world-camera.mjs';
import {fortificationGeometry} from '../site/dist/fortress-art.mjs';
const intersect=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const circleHit=(rect,circle)=>{const dx=circle.x-Math.max(rect.x,Math.min(circle.x,rect.x+rect.w)),dy=circle.y-Math.max(rect.y,Math.min(circle.y,rect.y+rect.h));return dx*dx+dy*dy<circle.r*circle.r;};
for(const [w,h,inset,bottomInset]of[[915,360,12,10],[915,360,44,24],[740,320,12,8],[740,320,44,24]])test(`edge utility clears all30 campaign keeps, towers, garrison rings and movement at ${w}×${h}, insets${inset}/${bottomInset}`,()=>{
 for(let level=1;level<=30;level++){
  const battle=new CampaignBattle({level,random:()=>.5});const origins=battle.structures.map(b=>b.y+b.shotOffset.y);origins.push(Math.min(...battle.terrain.samples)-30);
  const camera=frameCombatCamera(createWorldCamera(w,h),{groundY:Math.max(...battle.terrain.samples),structureTopY:Math.min(...battle.structures.map(b=>fortificationGeometry(b).body.y)),aimOriginTopY:Math.min(...origins),top:h<=330?6:10,bottom:h-bottomInset-(h<=330?52:56)-6});
  const boxes=battle.structures.map(b=>{const g=fortificationGeometry(b).body,p=worldToScreen(camera,g);return{x:p.x,y:p.y,w:g.width*camera.scale,h:g.height*camera.scale};});
  const hero={...worldToScreen(camera,battle.hero.launchPosition),r:Math.max(69.2*camera.scale,22)};
  const lower={x:inset,y:h-bottomInset-70-44,w:52,h:44},upper={...lower,y:lower.y-50};
  for(const button of[lower,upper]){assert.ok(button.w>=44&&button.h>=44);for(const box of boxes)assert.ok(!intersect(button,box),`battle${level} control intersects a structure`);assert.ok(!circleHit(button,hero),`battle${level} control intersects launch ring`);assert.ok(button.x>=inset&&button.x+button.w<=w-inset);}
  const movement={x:inset,y:h-bottomInset-56,w:118,h:56};assert.ok(!intersect(lower,movement));assert.ok(!intersect(upper,movement));
  battle.hero.leaveGarrison();battle.hero.step();const foot={...worldToScreen(camera,battle.hero.launchPosition),r:Math.max(69.2*camera.scale,22)};
  const enter={x:inset+(w<=800?18:27),y:h-bottomInset-(w<=800?59:66)-(w<=800?44:48),w:64,h:w<=800?44:48};
  const footLower={...lower,y:h-bottomInset-126-44},footUpper={...footLower,y:footLower.y-50};
  for(const button of[footLower,footUpper]){assert.ok(!intersect(button,enter),`battle${level} control intersects Enter`);assert.ok(!circleHit(button,foot),`battle${level} control intersects freshly dismounted hero ring`);for(const box of boxes)assert.ok(!intersect(button,box));assert.ok(button.y>=(h<=330?6:10));}
 
 }
});
test('source dock dimensions agree with the geometry contract; only buttons take pointer input',()=>{
 const css=readFileSync(new URL('../site/dist/live-action-bar.css',import.meta.url),'utf8'),mobile=css.slice(css.indexOf('/* Precision is an optional edge utility'));
 assert.match(mobile,/bottom:70px;left:0/);assert.match(mobile,/gap:6px;width:52px;pointer-events:none/);assert.match(mobile,/height:44px;min-height:44px/);assert.match(mobile,/pointer-events:auto/);
});
