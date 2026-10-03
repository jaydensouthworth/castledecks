import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
import {createPortraitView} from '../site/dist/portrait-view.mjs';
import {worldToScreen} from '../site/dist/world-camera.mjs';
import {frameTrainingCamera,trainingCoachHeight} from '../site/dist/training-camera.mjs';
for(const [width,height] of [[360,640],[412,780]])test(`${width}×${height}: normal pointer hit survives coach expansion during a live aim gesture`,async t=>{
 const ui=await loadGameUI(t,{search:'?mode=test&guide=1'}),canvas=ui.get('battlefield'),b=ui.battle,groundY=Math.max(...b.terrain.samples),floor=Math.min(height*.58,height-24-177-60-26);
 const rect=(x,y,w,h)=>({left:x,top:y,right:x+w,bottom:y+h,width:w,height:h});
 canvas.getBoundingClientRect=()=>rect(0,0,width,height);ui.document.querySelector('.live-movement').getBoundingClientRect=()=>rect(12,height-24-177-60,64,60);ui.document.querySelector('.live-topbar').getBoundingClientRect=()=>rect(12,24,width-24,55);
 let expanded=false;ui.get('trainingCoach').getBoundingClientRect=()=>rect(12,88,width-24,expanded?128:66);
 ui.click('start');ui.dispatch(ui.window,'resize');ui.frames();
 const geometry={hero:b.hero.launchPosition,target:b.guidedTraining.targetPoint(),targetBox:b.guidedTraining.target.hitbox,groundY},base=createPortraitView(width,height,{heroX:b.hero.x,groundY,groundBottom:floor}),coachHeight=trainingCoachHeight(base,{...geometry,top:88,bottom:floor}),camera=frameTrainingCamera(base,{...geometry,top:88+coachHeight+12,bottom:floor,left:12,right:12});
 const target=worldToScreen(camera,geometry.target);ui.pointer('pointerdown',93,target);ui.frames();expanded=true;ui.dispatch(ui.get('trainingCoach'),'toggle');ui.frames();ui.pointer('pointerup',93,target);ui.frames(200);
 assert.equal(b.guidedTraining.complete,true);assert.ok(b.guidedTraining.target.hp<5000);assert.equal(b.profile.victories,0);
});
