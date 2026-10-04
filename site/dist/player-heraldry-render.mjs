/** Pure fixed allegiance mark, independent from heraldry hue and status colors. */
import {FRIENDLY_HERALDRY_CUE as CUE} from './player-palette.mjs';
export function drawFriendlyHeraldryCue(ctx,x,y,{size=8}={}){
 if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(size)||size<=0)return false;
 const factor=size/12,point=([px,py])=>[x+(px-6)*factor,y+(py-6)*factor];
 ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
 for(const [color,width] of [[CUE.outline,CUE.outerWidth],[CUE.ink,CUE.innerWidth]]){ctx.strokeStyle=color;ctx.lineWidth=width*factor;for(const points of CUE.strokes){ctx.beginPath();ctx.moveTo(...point(points[0]));for(const p of points.slice(1))ctx.lineTo(...point(p));ctx.stroke();}}
 ctx.restore();return true;
}
