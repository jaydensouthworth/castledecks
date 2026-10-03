/** Presentation/input adaptation only. Preview and release use the unchanged
 * source-audited aiming functions; drawing never steps a controller or world. */
import {sampledDragAim} from './engine/drag-shooter.mjs';
import {pointAim} from './engine/alternate-shooter.mjs';
const finitePoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);

export function sampleManualAim({mode,origin,anchor,pointer,powerPercent=100}={}) {
 if(!finitePoint(origin)||!finitePoint(pointer))return null;
 if(mode==='point_aim')return pointAim(origin,pointer,powerPercent);
 if((mode==='classic'||mode==='anywhere')&&finitePoint(anchor))return sampledDragAim(anchor,pointer);
 return null;
}

/** A single flight-direction cue starts at the actual hero/garrison launch
 * position. Its length and percentage show power, not predicted impact/range.
 * The caller owns the camera transform. All ornaments are CSS-pixel sized. */
export function drawManualAimGuide(ctx,{origin,aim,scale,visible=false}={}) {
 if(!visible||!finitePoint(origin)||!aim||!Number.isFinite(aim.power)
   ||!Number.isFinite(scale)||scale<=0||!Number.isFinite(1/scale)
   ||!Number.isFinite(origin.x*scale)||!Number.isFinite(origin.y*scale))return false;
 const power=Math.max(0,Math.min(1,aim.power));
 const speed=Math.hypot(aim.vx,aim.vy);
 if(aim.canFire&&!Number.isFinite(speed))return false;
 const directed=aim.canFire&&Number.isFinite(speed)&&speed>0;
 ctx.save();
 try{
  ctx.translate(origin.x,origin.y);ctx.scale(1/scale,1/scale);
  ctx.globalAlpha=1;ctx.setLineDash([]);ctx.lineCap='round';ctx.lineJoin='round';
  if(directed){
   // Use velocity itself, including the source's vertical-axis convention.
   ctx.save();ctx.rotate(Math.atan2(aim.vy,aim.vx));
   const tip=42+72*power;
   ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(tip,0);
   ctx.moveTo(tip-9,-6);ctx.lineTo(tip,0);ctx.lineTo(tip-9,6);
   ctx.strokeStyle='#17211df2';ctx.lineWidth=5;ctx.stroke();
   ctx.strokeStyle='#f9e5b6';ctx.lineWidth=2;ctx.stroke();ctx.restore();
  }
  ctx.beginPath();ctx.arc(0,0,4,0,Math.PI*2);
  ctx.fillStyle='#17211df2';ctx.fill();ctx.strokeStyle='#f9e5b6';ctx.lineWidth=1.75;ctx.stroke();
  ctx.font='600 12px system-ui';ctx.textAlign='center';ctx.textBaseline='top';
  const label=`${Math.round(power*100)}%${directed?'':' · pull farther'}`;
  ctx.strokeStyle='#17211df2';ctx.lineWidth=4;ctx.strokeText(label,0,12);
  ctx.fillStyle='#f9e5b6';ctx.fillText(label,0,12);
 }finally{ctx.restore();}
 return true;
}
