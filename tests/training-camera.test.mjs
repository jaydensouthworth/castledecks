import test from 'node:test';
import assert from 'node:assert/strict';
import {CampaignBattle} from '../site/dist/engine/first-battle.mjs';
import {createTrainingRun,createTrainingBattleOptions,prepareTrainingBattle} from '../site/dist/guided-training.mjs';
import {createPortraitView} from '../site/dist/portrait-view.mjs';
import {worldToScreen,screenToWorld} from '../site/dist/world-camera.mjs';
import {frameTrainingCamera,trainingCoachHeight,trainingViewBounds} from '../site/dist/training-camera.mjs';
for(const [w,h,safeTop,safeBottom,left,right] of [[360,640,0,0,0,0],[360,640,24,24,0,0],[360,640,44,34,0,0],[412,780,24,24,0,0],[412,780,44,34,20,20]])for(const index of [0,3,4])test(`${w}×${h} safe ${safeTop}/${safeBottom} drill ${index}: close scale, visible launch/fixture and exact inverse`,()=>{
 const run=createTrainingRun();run.index=index;const b=new CampaignBattle(createTrainingBattleOptions(run)),c=prepareTrainingBattle(b,run),groundY=Math.max(...b.terrain.samples),floor=Math.min(h*.58,h-Math.max(10,safeBottom)-177-60-26),top=Math.max(12,safeTop)+64;
 const base=createPortraitView(w,h,{heroX:b.hero.x,overview:false,groundY,groundBottom:floor}),geometry={hero:b.hero.launchPosition,target:c.targetPoint(),targetBox:c.target?.hitbox,groundY};
 const height=trainingCoachHeight(base,{...geometry,top,bottom:floor});assert.ok(height>=44&&height<=128);
 const camera=frameTrainingCamera(base,{...geometry,top:top+height+12,bottom:floor,left:Math.max(12,left),right:Math.max(12,right)}),bounds=trainingViewBounds(camera,geometry);
 assert.equal(camera.scale,w/1000);assert.ok(bounds.minY+camera.offsetY>=top+height+12-1e-8);assert.ok(bounds.maxY+camera.offsetY<=floor+1e-8);
 assert.ok(bounds.minX+camera.offsetX>=Math.max(12,left)-1e-8);assert.ok(bounds.maxX+camera.offsetX<=w-Math.max(12,right)+1e-8);
 for(const point of [geometry.hero,geometry.target].filter(Boolean)){const back=screenToWorld(camera,worldToScreen(camera,point));assert.ok(Math.abs(back.x-point.x)<1e-8&&Math.abs(back.y-point.y)<1e-8);}
 const collapsed=frameTrainingCamera(base,{...geometry,top:top+height+12,bottom:floor,left:Math.max(12,left),right:Math.max(12,right)});assert.deepEqual(collapsed,camera);
});
