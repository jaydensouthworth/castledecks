/** Modern Auto-aim range assistance. Manual and source-matched controllers keep
 * their original formulas. This bounded adapter changes only the gravity of a
 * previously unreachable player Auto shot; launch speed and damage stay fixed.
 */
import {autoAim,ALTERNATE_POWER,AUTO_ANGLE} from './alternate-shooter.mjs';
export const AUTO_ASSIST=Object.freeze({minimumGravityFactor:1/3,rangeMargin:.98,minX:0,maxX:2000,minY:-350,maxY:1000,flightCeiling:-950});
const validPoint=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y);
const finiteAim=a=>a?.canFire&&Number.isFinite(a.vx)&&Number.isFinite(a.vy);
const inside=(p,b)=>p.x>=b.minX&&p.x<=b.maxX&&p.y>=b.minY&&p.y<=b.maxY;
const apex=(origin,aim)=>origin.y-(aim.vy<0?aim.vy*aim.vy/(2*aim.gravity):0);

function stableAim(origin,pointer,{powerPercent,angleMode,gravity}){
 const speed=ALTERNATE_POWER.auto*powerPercent/100,dx=pointer.x-origin.x,dy=pointer.y-origin.y;
 if(dx===0){if(dy===0)return {canFire:false,reason:'invalid'};const up=dy<0||angleMode==AUTO_ANGLE.HIGH;return {canFire:true,vx:0,vy:up?-speed:speed,speed,power:powerPercent/100,powerPercent,origin:{...origin},gravity};}
 const v2=speed*speed,d=v2*v2-gravity*gravity*dx*dx+2*gravity*v2*dy;
 if(d< -1e-8)return {canFire:false,reason:'unreachable'};
 const root=Math.sqrt(Math.max(0,d)),radians=Math.atan2(-(v2+(angleMode==AUTO_ANGLE.LOW?-root:root)),gravity*Math.abs(dx));
 return {canFire:true,vx:Math.sign(dx)*Math.cos(radians)*speed,vy:Math.sin(radians)*speed,speed,power:powerPercent/100,powerPercent,radians,origin:{...origin},gravity};
}

export function assistedAutoAim(origin,pointer,{powerPercent=100,angleMode=AUTO_ANGLE.LOW,gravity=.3,bounds=AUTO_ASSIST}={}){
 const failure=reason=>({canFire:false,reason,rangeAssisted:false,power:powerPercent/100,powerPercent,gravity});
 if(!validPoint(origin)||!validPoint(pointer)||!Number.isFinite(powerPercent)||powerPercent<50||powerPercent>100||!Number.isFinite(gravity)||gravity<=0)return failure('invalid');
 const options={powerPercent,angleMode,gravity},normal=autoAim(origin,pointer,options);
 if(finiteAim(normal))return {...normal,gravity,rangeAssisted:false};
 if(!inside(pointer,bounds))return failure('outside-assist-area');
 const dx=pointer.x-origin.x,dy=pointer.y-origin.y,distance=Math.hypot(dx,dy);
 if(!distance)return failure('invalid');
 const speed=ALTERNATE_POWER.auto*powerPercent/100,denominator=distance-dy;
 const limit=denominator>0?speed*speed/denominator:Infinity;
 const minimumGravity=gravity*AUTO_ASSIST.minimumGravityFactor;
 if(limit<minimumGravity)return failure('unreachable');
 const assistedGravity=Math.max(minimumGravity,Math.min(gravity,limit*AUTO_ASSIST.rangeMargin));
 let result=stableAim(origin,pointer,{...options,gravity:assistedGravity});
 if(!finiteAim(result))return failure('unreachable');
 let usedLowArc=false;
 if(apex(origin,result)<AUTO_ASSIST.flightCeiling&&angleMode==AUTO_ANGLE.HIGH){result=stableAim(origin,pointer,{...options,angleMode:AUTO_ANGLE.LOW,gravity:assistedGravity});usedLowArc=true;}
 if(!finiteAim(result)||apex(origin,result)<AUTO_ASSIST.flightCeiling)return failure('flight-ceiling');
 return {...result,angleMode,rangeAssisted:assistedGravity<gravity,usedLowArc,baseGravity:gravity};
}

/** Sample the actual discrete arrow path up to the selected point's horizontal
 * crossing. Optional terrain checking is conservative and separate from actors;
 * a clear result never promises a hit on a moving target. */
export function traceAutoAim(origin,target,aim,{elevationAt=null,maxTicks=600}={}){
 if(!validPoint(origin)||!validPoint(target)||!finiteAim(aim)||!Number.isFinite(aim.gravity)||aim.gravity<=0)return {ok:false,reason:'invalid-trajectory'};
 let time;
 if(Math.abs(aim.vx)>1e-7)time=(target.x-origin.x)/aim.vx;
 else {
  const b=aim.vy-aim.gravity/2,d=b*b+2*aim.gravity*(target.y-origin.y);
  if(d<0)return {ok:false,reason:'unreachable-height'};
  const roots=[(-b-Math.sqrt(d))/aim.gravity,(-b+Math.sqrt(d))/aim.gravity].filter(t=>t>0);
  time=aim.angleMode==AUTO_ANGLE.HIGH?Math.max(...roots):Math.min(...roots);
 }
 if(!Number.isFinite(time)||time<=0||time>maxTicks)return {ok:false,reason:'flight-limit'};
 let minimumTerrainClearance=Infinity;
 const samples=Math.ceil(time*2);
 for(let index=0;index<=samples;index++){
  const t=index/samples*time,point={x:origin.x+aim.vx*t,y:origin.y+aim.vy*t+aim.gravity*t*(t-1)/2};
  if(point.y< -1000||point.x< -50||point.x>2050)return {ok:false,reason:'projectile-bounds',point};
  if(elevationAt){const ground=elevationAt(point.x);if(!Number.isFinite(ground))return {ok:false,reason:'invalid-terrain',point};minimumTerrainClearance=Math.min(minimumTerrainClearance,ground-point.y);if(point.y>ground)return {ok:false,reason:'terrain-blocked',point};}
 }
 return {ok:true,flightTicks:time,minimumTerrainClearance};
}

/** Explicit required-zone validator for future stage authoring. Supply every
 * allowed firing origin and each required target zone. Each zone must have at
 * least one origin that can reach all nine corner/edge/center samples. This is
 * a sampled ballistic check, not proof of navigability, obstacle clearance, or
 * reachable moving targets in a generated stage.
 */
export function validateAutoAimZones({origins=[],zones=[],powerPercent=100,angleMode=AUTO_ANGLE.LOW,gravity=.3,bounds=AUTO_ASSIST,elevationAt=null}={}){
 const issues=[];if(!origins.length||!origins.every(validPoint))issues.push({reason:'invalid-or-missing-origins'});
 for(let index=0;index<zones.length;index++){
  const zone=zones[index],name=zone?.name??String(index);
  if(![zone?.x,zone?.y,zone?.width,zone?.height].every(Number.isFinite)||zone.width<0||zone.height<0){issues.push({zone:name,reason:'invalid-zone'});continue;}
  const points=[0,.5,1].flatMap(u=>[0,.5,1].map(v=>({x:zone.x+zone.width*u,y:zone.y+zone.height*v})));
  if(!points.every(point=>inside(point,bounds))){issues.push({zone:name,reason:'outside-stage-assist-bounds'});continue;}
  if(!origins.some(origin=>validPoint(origin)&&points.every(point=>{const aim=assistedAutoAim(origin,point,{powerPercent,angleMode,gravity,bounds});return finiteAim(aim)&&traceAutoAim(origin,point,aim,{elevationAt}).ok;}))){issues.push({zone:name,reason:elevationAt?'blocked-or-unreachable-required-zone':'unreachable-required-zone'});}
 }
 if(!zones.length)issues.push({reason:'missing-required-zones'});
 return {ok:issues.length===0,checkedZones:zones.length,checkedOrigins:origins.length,issues};
}
