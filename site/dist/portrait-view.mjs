/** Portrait presentation: a readable close-up with an explicit map pan.
 * No actor, launch, collision, clock or campaign state is modified. */
import {createWorldCamera,WORLD_WIDTH} from './world-camera.mjs';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function createPortraitView(width,height,{heroX=350,center=null,overview=false,groundY=760,groundBottom=height*.57}={}){
 const base=createWorldCamera(width,height);
 if(!base.renderable||width>=height||overview)return base;
 const span=1000,scale=width/span;
 const focus=Number.isFinite(center)?center:heroX+span*.25;
 const cameraCenter=clamp(focus,span/2,WORLD_WIDTH-span/2);
 return Object.freeze({...base,scale,offsetX:width/2-cameraCenter*scale,
  offsetY:clamp(groundBottom,Math.min(220,height*.4),height*.66)-groundY*scale});
}
export function portraitViewBounds(camera){return {left:-camera.offsetX/camera.scale,right:(camera.width-camera.offsetX)/camera.scale};}

export function drawBattleOverview(ctx,battle,camera,width,height){
 if(!ctx||!battle||!(width>0&&height>0))return;
 const project=x=>clamp(x/2000,0,1)*width,y=height*.57;
 ctx.clearRect(0,0,width,height);ctx.fillStyle='#17232bec';ctx.fillRect(0,0,width,height);
 ctx.strokeStyle='#738d7a';ctx.lineWidth=1;ctx.beginPath();
 const samples=battle.terrain.samples,min=Math.min(...samples),max=Math.max(...samples);
 samples.forEach((value,i)=>{const px=i/(samples.length-1)*width,py=height*.28+(value-min)/Math.max(1,max-min)*height*.38;i?ctx.lineTo(px,py):ctx.moveTo(px,py);});ctx.stroke();
 for(const building of battle.structures){if(building.destroyed)continue;ctx.fillStyle=building.team==='good'?'#8dc7d4':building.team==='bad'?'#d89582':'#c6b786';ctx.fillRect(project(building.x)-3,y-8,6,12);}
 for(const unit of [...battle.goodTeam,...battle.badTeam]){if(unit.hp<=0||unit===battle.hero)continue;ctx.fillStyle=unit.team==='good'?'#75baca':'#d78178';ctx.fillRect(project(unit.x)-1.5,unit.airUnit?y-13:y+5,3,3);}
 const bounds=portraitViewBounds(camera);ctx.fillStyle='#f5d39218';ctx.fillRect(project(bounds.left),2,project(bounds.right)-project(bounds.left),height-4);ctx.strokeStyle='#e8c580';ctx.lineWidth=1.5;ctx.strokeRect(project(bounds.left)+.75,2.75,Math.max(1,project(bounds.right)-project(bounds.left)-1.5),height-5.5);
 ctx.fillStyle='#ffe8a8';ctx.beginPath();ctx.arc(project(battle.hero.x),y,3,0,Math.PI*2);ctx.fill();
}

export function portraitOffscreenStatus(battle,camera){
 const {left,right}=portraitViewBounds(camera),parts=[];
 const before=battle.badTeam.filter(u=>u.hp>0&&u.x<left).length,after=battle.badTeam.filter(u=>u.hp>0&&u.x>right).length;
 if(before)parts.push(`← ${before} enemies`);if(after)parts.push(`${after} enemies →`);
 const flag=battle.enemyFlag;if(flag){const x=flag.holder?.x??flag.x;if(x<left)parts.push('← enemy flag');else if(x>right)parts.push('enemy flag →');}
 return parts.join(' · ');
}
