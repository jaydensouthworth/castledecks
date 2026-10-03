/** Independently drawn iron giant. This module is presentation-only.
 * The caller owns translation/rotation/facing; canonical art faces local -X.
 * Named reaction regions are read verbatim. Cloth, rear boot, arms and the axe
 * are decorative silhouettes, never new target regions or damage surfaces.
 */
import {BOSS_REACTION_REGIONS} from './engine/boss-geometry.mjs';

const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const finite=(n,fallback=0)=>Number.isFinite(n)?n:fallback;
const mix=(a,b,p)=>a+(b-a)*p;
const smooth=n=>{const p=clamp(n);return p*p*(3-2*p);};
const point=(x,y)=>({x,y});
const rotate=(p,a)=>point(p.x*Math.cos(a)-p.y*Math.sin(a),p.x*Math.sin(a)+p.y*Math.cos(a));
const bounds=a=>({left:a[0],right:a[1],top:a[2],bottom:a[3],x:(a[0]+a[1])/2,y:(a[2]+a[3])/2,w:a[1]-a[0],h:a[3]-a[2]});
const IDLE_ARMOR=[-37.915370178223,39.7537606397,-201.006394958496,-67.383443432301];
const IDLE_FEET=[-73.709857177734,-25.637248822216,-67.396699523926,19.993539209571];
const DOWN_MODES=new Set(['stuck_down','wiggle','rest','wipe_sweat','fling_sweat','helm_on_bend_over','knock_back','rub_head','head_to_belly','reach_out','reach_back','getup']);
export const GORATH_COLORS=Object.freeze({
 good:Object.freeze({cloth:'#377283',clothLight:'#65909a',clothDark:'#1b3c47',trim:'#d2b775',metal:'#737c78',light:'#acb4a1',dark:'#303d3d',skin:'#a69775',crest:'#e9dfbb',eye:'#dce8cc'}),
 bad:Object.freeze({cloth:'#713c37',clothLight:'#98584a',clothDark:'#3e2727',trim:'#a98457',metal:'#6e7167',light:'#a4a68e',dark:'#353a34',skin:'#9f916b',crest:'#d4af76',eye:'#d8bd81'})
});

function terrain(options,x,fallback){return typeof options.elevationAt==='function'?finite(options.elevationAt(x),fallback):fallback;}
/** Solve a sole point on the actual terrain in the caller's rotated/mirrored
 * local space. A short fixed-point solve also works on ordinary sloping ground.
 */
export function gorathGroundY(unit,x,options={}){
 const a=finite(unit.collisionRotation??unit.rotation)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),f=unit.facing===-1?-1:1;
 if(Math.abs(c)<.2)return 0;
 let y=0;
 for(let i=0;i<5;i++)y=(terrain(options,finite(unit.x)+c*f*x-s*y,finite(unit.y))-finite(unit.y)-s*f*x)/c;
 return finite(y);
}
export function gorathWorldToLocal(unit,world){
 const a=finite(unit.collisionRotation??unit.rotation)*Math.PI/180,p=rotate(point(world.x-finite(unit.x),world.y-finite(unit.y)),-a);
 return point(p.x*(unit.facing===-1?-1:1),p.y);
}

/** Axe progress is deliberately independent of displayFrame: that frame can
 * be stale at transitions and stays 85 for the entire long raised hold.
 * record.impactAge is optional, read-only state supplied by the shared observer.
 */
export function gorathAxePose(unit,options={}){
 const mode=unit.actionMode??'',d=finite(unit.actionDuration),ally=!!unit.isCompanion;
 const impactAge=options.record?.impactAge??options.impactAge;
 const direction=unit.forward===-1?-1:1;
 const strikeX=finite(unit.x)+(ally?direction*80:-190);
 const contact=gorathWorldToLocal(unit,point(strikeX,terrain(options,strikeX,finite(unit.y))));
 const raised=point(-55,-252),rest=point(-90,-146);
 let aim=rest,angle=-.24,landed=false,drop=0;
 if(ally&&mode==='axe_attack'){
  const remaining=Math.max(0,finite(unit.signatureWindup));
  if(remaining>9){const t=smooth((18-remaining)/9);aim=point(mix(rest.x,raised.x,t),mix(rest.y,raised.y,t));angle=mix(-.24,.12,t);}
  else {drop=remaining>0?Math.min(.96,smooth((9-remaining)/9)):1;aim=point(mix(raised.x,contact.x,drop),mix(raised.y,contact.y,drop));angle=mix(.12,-2,drop);landed=remaining===0;}
 }else if(ally&&Number.isFinite(impactAge)&&impactAge>=0&&impactAge<10){aim=contact;angle=-2;drop=1;landed=true;}
 else if(mode==='prep_attack'){
  const p=smooth((48-d)/48);aim=point(mix(rest.x,raised.x,p),mix(rest.y,raised.y,p));angle=mix(-.24,.12,p);
 }else if(mode==='hold_up_axe'){aim=raised;angle=.12;}
 else if(mode==='axe_attack'){
  landed=unit.axeLanded===true;drop=landed?1:Math.min(.96,smooth((22-d)/14));
  aim=point(mix(raised.x,contact.x,drop),mix(raised.y,contact.y,drop));angle=mix(.12,-2,drop);
 }else if(mode==='reload'){
  const p=smooth((75-d)/75);aim=point(mix(contact.x,rest.x,p),mix(contact.y,rest.y,p));angle=mix(-2,-.24,p);
 }else if(!ally&&DOWN_MODES.has(mode)){aim=contact;angle=-2;drop=1;landed=unit.axeLanded===true;}
 // The highlighted blade vertex is the exact point of impact. No synthetic
 // shockwave, contact flash, projectile or event is emitted by this renderer.
 const edge=rotate(point(-46,-23),angle),head=point(aim.x-edge.x,aim.y-edge.y);
 const gripOffset=rotate(point(0,96),angle),tailOffset=rotate(point(0,133),angle);
 return {head,angle,grip:point(head.x+gripOffset.x,head.y+gripOffset.y),tail:point(head.x+tailOffset.x,head.y+tailOffset.y),edge:aim,contact,landed,drop};
}

/** Read-only finite rig. Main metal/skin panels stay in their named regions.
 * One visible boot tracks feetbox. Its rear support boot is dark/decorative.
 * The target boot may lift; at least one sole stays planted on terrain.
 */
export function gorathPose(unit,options={}){
 const frame=clamp(Math.floor(finite(unit.animation?.displayFrame,60)),1,470);
 const regions=BOSS_REACTION_REGIONS[frame-1]??{};
 const dead=unit.hp<=0||unit.dead||unit.actionMode==='killed';
 const death=dead?smooth((finite(unit.animation?.frame,420)-finite(unit.animation?.start,391))/Math.max(1,420-finite(unit.animation?.start,391))):0;
 let armor=bounds(regions.armorbox??(regions.bellybox?[regions.bellybox[0],regions.bellybox[1],regions.bellybox[2],regions.bellybox[3]]:IDLE_ARMOR));
 if(dead){armor=bounds(IDLE_ARMOR);armor={...armor,top:mix(armor.top,-112,death),bottom:mix(armor.bottom,-40,death),left:mix(armor.left,-55,death),right:mix(armor.right,38,death)};armor.x=(armor.left+armor.right)/2;armor.y=(armor.top+armor.bottom)/2;armor.w=armor.right-armor.left;armor.h=armor.bottom-armor.top;}
 const feet=bounds(regions.feetbox??IDLE_FEET),targetX=clamp(feet.x,-95,25),rearX=clamp(armor.x+24,-12,35);
 const targetGround=gorathGroundY(unit,targetX,options),rearGround=gorathGroundY(unit,rearX,options);
 const walking=!dead&&['left_step','right_step'].includes(unit.actionMode)&&Math.abs(finite(unit.vx))>0;
 const stepProgress=unit.actionMode==='right_step'?clamp((frame-35)/25):clamp((frame-5)/30);
 const stepLift=walking?Math.sin(stepProgress*Math.PI)**2*11:0;
 const targetLift=dead?0:Math.max(clamp(-feet.bottom,0,30),stepLift);
 const head=dead?null:regions.headbox?bounds(regions.headbox):null;
 const belly=dead?null:regions.bellybox?bounds(regions.bellybox):null;
 const legTop=clamp(belly?.bottom??armor.bottom,-80,-30);
 const front={x:targetX,y:targetGround-targetLift,ground:targetGround,planted:targetLift===0};
 const rear={x:rearX,y:rearGround,ground:rearGround,planted:true};
 return {frame,regions,hasArmor:!!regions.armorbox||frame<5||dead,armor,head,belly,dead,death,front,rear,legTop,axe:gorathAxePose(unit,options),colors:GORATH_COLORS[unit.team==='good'?'good':'bad']};
}

function path(ctx,commands,fill,stroke='#273331',width=1.5){
 ctx.beginPath();for(const [kind,...args] of commands)ctx[kind](...args);ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
}
const poly=(ctx,p,fill,stroke,width)=>path(ctx,p.map(([x,y],i)=>[i?'lineTo':'moveTo',x,y]),fill,stroke,width);
function line(ctx,a,b,color,width){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
function oval(ctx,x,y,rx,ry,color,stroke=null){ctx.beginPath();ctx.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.5;ctx.stroke();}}
function rivet(ctx,x,y,p){oval(ctx,x,y,1.8,1.8,p.trim);}
function plate(ctx,x,y,w,h,p,color=p.metal){
 path(ctx,[['moveTo',x,y+h*.18],['quadraticCurveTo',x+w*.08,y,x+w*.45,y],['quadraticCurveTo',x+w*.9,y,x+w,y+h*.17],['lineTo',x+w*.91,y+h*.8],['quadraticCurveTo',x+w*.64,y+h*1.03,x+w*.47,y+h],['quadraticCurveTo',x+w*.19,y+h*.97,x+w*.03,y+h*.79]],color,p.dark,2);
 path(ctx,[['moveTo',x+w*.12,y+h*.19],['quadraticCurveTo',x+w*.33,y+h*.07,x+w*.49,y+h*.1],['lineTo',x+w*.43,y+h*.78],['quadraticCurveTo',x+w*.17,y+h*.7,x+w*.12,y+h*.19]],p.light,null);
 line(ctx,point(x+w*.17,y+h*.81),point(x+w*.77,y+h*.88),p.trim,2);
}
function boot(ctx,foot,hip,p,back=false){
 const knee=point(mix(hip.x,foot.x,.58)+7,mix(hip.y,foot.y-18,.54));
 line(ctx,hip,knee,p.clothDark,back?18:23);line(ctx,knee,point(foot.x,foot.y-15),p.dark,back?17:21);
 plate(ctx,knee.x-11,knee.y-8,22,Math.max(17,foot.y-knee.y-8),p,back?p.dark:p.metal);
 // Thick curved sole has its lowest edge exactly at foot.y, not below it.
 path(ctx,[['moveTo',foot.x-13,foot.y-19],['quadraticCurveTo',foot.x-20,foot.y-16,foot.x-24,foot.y-7],['lineTo',foot.x-24,foot.y-2],['quadraticCurveTo',foot.x-8,foot.y,foot.x+12,foot.y-1],['lineTo',foot.x+13,foot.y-13],['lineTo',foot.x+6,foot.y-20]],back?p.dark:p.metal,p.dark,2);
 line(ctx,point(foot.x-23,foot.y-2),point(foot.x+12,foot.y-2),back?'#202c2b':p.trim,2);
 if(!back)line(ctx,point(foot.x-16,foot.y-10),point(foot.x+5,foot.y-12),p.light,2);
}
function crest(ctx,x,y,p,good,size=12){
 if(good){poly(ctx,[[x-size,y-5],[x,y+size*.65],[x+size,y-5],[x+size*.7,y-8],[x,y+size*.13],[x-size*.7,y-8]],p.crest,null);oval(ctx,x,y-10,2.2,2.2,p.trim);}
 else for(const d of [-5,4])poly(ctx,[[x+d-3,y-10],[x+d+3,y-10],[x+d+2,y+9],[x+d-3,y+5]],p.crest,null);
}
function helmet(ctx,b,p,exposed=false){
 const cx=b.x,top=b.top+2,w=b.w*.82,h=Math.min(b.h-4,exposed?58:43),left=cx-w*.5;
 if(exposed){
  path(ctx,[['moveTo',left+7,top+8],['quadraticCurveTo',cx,top-1,left+w-5,top+9],['lineTo',left+w,top+h*.52],['lineTo',left+w-12,top+h*.89],['quadraticCurveTo',cx,top+h,left+8,top+h*.76],['lineTo',left+2,top+h*.35]],p.skin,p.dark,2);
  path(ctx,[['moveTo',left+4,top+h*.28],['quadraticCurveTo',cx-2,top+h*.43,left+10,top+h*.48],['lineTo',left-2,top+h*.5],['lineTo',left+5,top+h*.58]],p.skin,p.dark,1.4);
  line(ctx,point(left+8,top+h*.31),point(cx-1,top+h*.33),p.dark,3);
  path(ctx,[['moveTo',left+8,top+h*.64],['quadraticCurveTo',cx,top+h*.54,left+w-9,top+h*.65],['lineTo',cx+5,top+h],['lineTo',left+9,top+h*.85]],p.dark,null);
 }else{
  path(ctx,[['moveTo',left,top+h*.73],['quadraticCurveTo',left-2,top+1,cx-3,top],['quadraticCurveTo',left+w,top-1,left+w,top+h*.66],['lineTo',left+w-8,top+h],['lineTo',left+10,top+h]],p.metal,p.dark,2);
  path(ctx,[['moveTo',cx-9,top+5],['quadraticCurveTo',left+9,top+7,left+7,top+h*.5],['lineTo',cx-10,top+h*.43]],p.light,null);
  line(ctx,point(left+3,top+h*.56),point(cx+7,top+h*.52),p.dark,6);
  line(ctx,point(left+5,top+h*.56),point(cx-4,top+h*.55),p.eye,1.4);
  poly(ctx,[[cx-1,top+h*.48],[cx+8,top+h*.48],[cx+4,top+h*.92],[cx-6,top+h*.8]],p.trim,p.dark,1);
  line(ctx,point(cx-2,top+3),point(cx-4,top+h*.43),p.trim,2.5);
 }
}
function axe(ctx,a,p){
 ctx.save();ctx.translate(a.head.x,a.head.y);ctx.rotate(a.angle);
 line(ctx,point(0,-23),point(0,135),'#272c29',9);line(ctx,point(-1,-20),point(-1,132),'#947348',5);line(ctx,point(-2,-12),point(-2,81),'#c3a473',1.3);
 for(let y=82;y<113;y+=6)line(ctx,point(-4,y),point(4,y+3),p.clothDark,4);
 poly(ctx,[[-7,-25],[-29,-34],[-46,-23],[-52,-4],[-45,20],[-19,26],[-7,15]],p.metal,p.dark,2.5);
 poly(ctx,[[-29,-34],[-46,-23],[-52,-4],[-45,20],[-34,19],[-41,-3],[-37,-19]],'#c1c4b0',null);
 poly(ctx,[[-8,-24],[13,-14],[17,7],[8,15],[-7,13]],p.dark,p.dark,1.5);
 line(ctx,point(-7,-18),point(-7,12),p.trim,3);oval(ctx,-18,-4,4,4,p.trim);oval(ctx,-18,-4,1.6,1.6,p.dark);
 ctx.restore();
}

/** Draw in the caller's current unit-local transform. No game state writes. */
export function drawGorath(ctx,unit,options={}){
 if(unit?.type!=='gorath'||unit.visible===false||!Number.isFinite(unit.x)||!Number.isFinite(unit.y))return false;
 const pose=gorathPose(unit,options),p=pose.colors,a=pose.armor,good=unit.team==='good';
 ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
 if(pose.dead)ctx.globalAlpha*=mix(1,.72,pose.death);
 // Small local contact shadows attach the giant to the same terrain as boots.
 for(const foot of [pose.rear,pose.front]){ctx.save();ctx.globalAlpha*=foot.planted?.24:.11;oval(ctx,foot.x-5,foot.ground+1,25,3,'#172a26');ctx.restore();}
 const hip=point(clamp(pose.belly?.x??a.x,-35,65),pose.legTop);
 boot(ctx,pose.rear,point(hip.x+12,hip.y),p,true);
 // Heavy split cloth remains visibly distinct from the metal target panels.
 path(ctx,[['moveTo',a.right-9,a.top+28],['quadraticCurveTo',a.right+5,a.y,a.right+9,Math.max(a.bottom,pose.legTop)+9],['lineTo',a.x+4,Math.max(a.bottom,pose.legTop)+6],['lineTo',a.x-4,a.y]],p.clothDark,p.dark,1.5);
 boot(ctx,pose.front,point(hip.x-13,hip.y-1),p);
 if(pose.belly){const b=pose.belly;path(ctx,[['moveTo',b.left+4,b.top+4],['quadraticCurveTo',b.x,b.top+3,b.right-13,b.top+8],['quadraticCurveTo',b.right-2,b.y,b.right-15,b.bottom-3],['quadraticCurveTo',b.x,b.bottom,b.left+14,b.bottom-4],['quadraticCurveTo',b.left+2,b.y,b.left+4,b.top+4]],p.skin,p.dark,2);line(ctx,point(b.left+13,b.bottom-7),point(b.right-14,b.bottom-7),p.clothDark,7);line(ctx,point(b.x-10,b.y+5),point(b.x+7,b.y+7),'#786e53',1.5);}
 const exposed=!!pose.head,helmHeight=exposed?0:Math.min(43,Math.max(29,a.h*.3)),chestTop=a.top+helmHeight*.8,chestHeight=Math.max(20,a.bottom-chestTop);
 // Rounded cuirass, a narrow leather waist and individual overlapping faulds
 // replace the old single rectangular torso. Each stays inside armorbox.
 if(pose.hasArmor){
 const chestH=Math.min(70,chestHeight),waistY=chestTop+chestH*.8;
 if(chestHeight>chestH+8){
  path(ctx,[['moveTo',a.left+12,waistY],['quadraticCurveTo',a.x,waistY-5,a.right-11,waistY],['lineTo',a.right-13,a.bottom-2],['quadraticCurveTo',a.x,a.bottom-8,a.left+10,a.bottom-2]],p.clothDark,p.dark,1.5);
  for(let y=waistY+9;y<a.bottom-8;y+=13){
   path(ctx,[['moveTo',a.left+11,y],['quadraticCurveTo',a.x,y+7,a.right-11,y],['lineTo',a.right-12,Math.min(y+10,a.bottom)],['quadraticCurveTo',a.x,Math.min(y+18,a.bottom),a.left+12,Math.min(y+10,a.bottom)]],p.metal,p.dark,1.5);
   line(ctx,point(a.left+14,y+3),point(a.x-9,y+7),p.light,1.5);
  }
 }
 path(ctx,[['moveTo',a.left+3,chestTop+15],['quadraticCurveTo',a.left+7,chestTop,a.x,chestTop+5],['quadraticCurveTo',a.right-7,chestTop,a.right-3,chestTop+16],['quadraticCurveTo',a.right-1,chestTop+chestH*.65,a.right-16,chestTop+chestH*.83],['quadraticCurveTo',a.x,chestTop+chestH,a.left+15,chestTop+chestH*.83],['quadraticCurveTo',a.left+1,chestTop+chestH*.57,a.left+3,chestTop+15]],p.metal,p.dark,2);
 path(ctx,[['moveTo',a.left+10,chestTop+20],['quadraticCurveTo',a.left+18,chestTop+11,a.x-3,chestTop+14],['quadraticCurveTo',a.x-11,chestTop+chestH*.55,a.x-7,chestTop+chestH*.78],['quadraticCurveTo',a.left+9,chestTop+chestH*.7,a.left+10,chestTop+20]],p.light,null);
 path(ctx,[['moveTo',a.x+3,chestTop+13],['quadraticCurveTo',a.right-4,chestTop+18,a.right-11,chestTop+chestH*.52],['lineTo',a.right-17,chestTop+chestH*.76],['lineTo',a.x+9,chestTop+chestH*.87]],p.dark,null);
 line(ctx,point(a.left+16,chestTop+chestH*.85),point(a.x,chestTop+chestH*.96),p.trim,2);
 line(ctx,point(a.x,chestTop+chestH*.96),point(a.right-16,chestTop+chestH*.85),p.trim,2);
 // Sculpted shoulders and overlapping collar stay within armorbox.
 const shoulderW=Math.min(30,a.w*.36),shoulderH=Math.min(28,chestHeight*.36);
 plate(ctx,a.right-shoulderW-2,chestTop+4,shoulderW,shoulderH,p,p.dark);
 plate(ctx,a.left+1,chestTop+5,shoulderW,shoulderH,p);
 const clothW=Math.min(22,a.w*.3),clothX=a.x-clothW/2,clothY=chestTop+Math.min(24,chestHeight*.31),clothH=Math.max(10,chestHeight-Math.min(28,chestHeight*.4));
 path(ctx,[['moveTo',clothX,clothY],['quadraticCurveTo',a.x,clothY+4,clothX+clothW,clothY],['lineTo',clothX+clothW-2,clothY+clothH],['lineTo',a.x,clothY+clothH-5],['lineTo',clothX+2,clothY+clothH]],p.cloth,p.dark,1);
 line(ctx,point(clothX+3,clothY+2),point(clothX+4,clothY+clothH-5),p.trim,1.5);
 if(clothH>23)crest(ctx,a.x,clothY+14,p,good,Math.min(10,clothW*.4));
 for(const x of [a.left+9,a.right-9])rivet(ctx,x,chestTop+13,p);
 }
 const headBox=pose.head??{...a,top:a.top,bottom:a.top+helmHeight,w:Math.min(a.w*.73,58),h:helmHeight,x:a.x-3};
 if(exposed)line(ctx,point(headBox.x,headBox.bottom-9),point(a.x,chestTop+12),p.clothDark,14);
 if(exposed||pose.hasArmor)helmet(ctx,headBox,p,exposed);
 if(!pose.dead){
  axe(ctx,pose.axe,p);
  // One articulated forearm connects the shoulder to the prop. It is darker
  // than the central armor to avoid implying a new reaction-region target.
  const shoulder=point(a.left+10,chestTop+Math.min(30,chestHeight*.45)),grip=pose.axe.grip;
  const elbow=point(mix(shoulder.x,grip.x,.5)+6,mix(shoulder.y,grip.y,.5)+14);
  line(ctx,shoulder,elbow,p.dark,16);line(ctx,elbow,grip,p.dark,13);
  line(ctx,shoulder,elbow,p.metal,10);line(ctx,elbow,grip,p.metal,8);
  oval(ctx,elbow.x,elbow.y,9,10,p.metal,p.dark);rivet(ctx,elbow.x-1,elbow.y-2,p);
  oval(ctx,grip.x,grip.y,8,10,p.dark,p.trim);
 }else{
  // A recognizable folded/kneeling giant survives the existing killed frames;
  // engine-owned lifetime/removal stays unchanged. The weapon lies quietly.
  const y=gorathGroundY(unit,-100,options);line(ctx,point(-115,y-4),point(14,y-7),'#806542',5);
  poly(ctx,[[-122,y-9],[-133,y-18],[-145,y-6],[-132,y-1],[-117,y-2]],p.metal,p.dark,2);
 }
 ctx.restore();return true;
}
