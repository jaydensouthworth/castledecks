/** Original fortifications, drawn around the simulation's current collision bounds.
 * No art transform or decorative shape is sent back to the simulation.
 */
import {unitRegions} from './engine/collision.mjs';

const TAU = Math.PI * 2;
const ink = {edge:'#24343a',shadow:'#45585b',stone:'#899a98',light:'#bdc7b4',warm:'#d4bd88',mortar:'#627675',wood:'#534435',door:'#283838'};
const validBox = box => box && ['x','y','width','height'].every(k=>Number.isFinite(box[k])) && box.width>0 && box.height>0;
const validPosition = b => b && Number.isFinite(b.x) && Number.isFinite(b.y);
const kindFor = b => b.regionKind ?? (b.type==='tower'?'tower':b.team==='good'?'friendlyCastle':'enemyCastle');
function rect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(x,y,w,h);}
function line(c,x1,y1,x2,y2,color,width=1){c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.strokeStyle=color;c.lineWidth=width;c.stroke();}
function poly(c,points,color){c.beginPath();c.moveTo(...points[0]);for(const p of points.slice(1))c.lineTo(...p);c.closePath();c.fillStyle=color;c.fill();}
function arch(c,x,bottom,width,height,color){const radius=width/2;c.beginPath();c.moveTo(x-radius,bottom);c.lineTo(x-radius,bottom-height+radius);c.quadraticCurveTo(x,bottom-height-radius*.3,x+radius,bottom-height+radius);c.lineTo(x+radius,bottom);c.closePath();c.fillStyle=color;c.fill();}
function banner(c,x,y,w,h,color){poly(c,[[x-w/2,y],[x+w/2,y],[x+w/2,y+h],[x,y+h-5],[x-w/2,y+h]],color);line(c,x-w/2,y,x+w/2,y,ink.warm,2);poly(c,[[x,y+8],[x+3,y+13],[x,y+18],[x-3,y+13]],ink.warm);}

/** World-coordinate boxes; exposed stone ends at ground, even for underground tower bounds.
 * The fallback is only for standalone illustration fixtures. In battle we use the live box.
 */
export function fortificationGeometry(building){
 if(!validPosition(building))return null;
 const measured = validBox(building.hitbox)?building.hitbox:unitRegions(kindFor(building),{x:building.x,y:building.y}).hitbox;
 const hitbox = {...measured};
 const bottom = Math.min(hitbox.y+hitbox.height,building.y);
 const body = {x:hitbox.x,y:hitbox.y,width:hitbox.width,height:Math.max(0,bottom-hitbox.y)};
 return {hitbox,body,foundation:{x:hitbox.x,y:bottom,width:hitbox.width,height:Math.max(0,building.y-bottom)},centerX:hitbox.x+hitbox.width/2,groundY:building.y};
}

/** Terrain-contact bedrock below the damageable wall. The top joins the wall
 * without a gap; every lower sample follows the real terrain, not its center.
 * Its irregular outline/rock planes intentionally differ from castle masonry. */
export function fortificationFooting(building,{elevationAt=x=>building.y}={}){
 const g=fortificationGeometry(building);if(!g)return null;
 const left=g.body.x-7,right=g.body.x+g.body.width+7,top=g.body.y+g.body.height;
 const sample=x=>{const value=elevationAt(x);return Number.isFinite(value)?value:building.y;};
 const xs=[left,g.body.x];
 for(let x=Math.ceil(left/10)*10;x<right;x+=10)if(x>g.body.x)xs.push(x);
 xs.push(g.body.x+g.body.width,right);
 const ground=[...new Set(xs)].sort((a,b)=>a-b).map(x=>[x,sample(x)]);
 return {top,left,right,ground,polygon:[[g.body.x-1,top-2],[g.body.x+g.body.width+1,top-2],
  ...ground.slice().reverse().map(([x,y])=>[x,Math.max(top-2,y+2)])]};
}

/** The decorative gallery supports the unchanged garrison hero drawing. It
 * never changes Hero.launchPosition, hitboxes or garrison placement. */
export function garrisonStation(building){
 const g=fortificationGeometry(building),offset=building?.shotOffset;
 if(!g||!Number.isFinite(offset?.x)||!Number.isFinite(offset?.y))return null;
 const launch={x:building.x+offset.x,y:building.y+offset.y};
 const left=Math.max(g.body.x+2,launch.x-23),right=Math.min(g.body.x+g.body.width-2,launch.x+23);
 return {launch,hero:{x:launch.x,y:launch.y+28},floor:{x:left,y:launch.y+26,width:right-left},
  opening:{x:(left+right)/2,y:Math.max(g.body.y+3,launch.y-28),width:Math.max(1,right-left-6)}};
}

/** Debug aid: exact live engine box, no inferred or illustration fallback geometry.
 * Call inside the SAME camera transform as actors, after drawing projectiles.
 */
export function drawFortificationCollision(ctx,building,{scale=1,labels=true,color='#68fff4'}={}){
 if(!validPosition(building)||building.destroyed||building.clipPresent===false||!validBox(building.hitbox))return false;
 const box=building.hitbox,s=Number.isFinite(scale)&&scale>0?scale:1;
 ctx.save();ctx.strokeStyle=color;ctx.fillStyle='#28f0db12';ctx.lineWidth=1.5/s;
 ctx.setLineDash([]);ctx.fillRect(box.x,box.y,box.width,box.height);ctx.strokeRect(box.x,box.y,box.width,box.height);
 if(box.y+box.height>building.y){ctx.setLineDash([4/s,3/s]);line(ctx,box.x,building.y,box.x+box.width,building.y,'#ffd38a',1.5/s);ctx.setLineDash([]);}
 if(labels){const label=building.type==='tower'?'Tower collision':building.team==='good'?'Allied keep collision':'Enemy keep collision';ctx.font=`${11/s}px system-ui`;ctx.textAlign='center';ctx.textBaseline='bottom';ctx.lineWidth=3/s;ctx.strokeStyle='#102728';ctx.fillStyle=color;ctx.strokeText(label,box.x+box.width/2,box.y-6/s);ctx.fillText(label,box.x+box.width/2,box.y-6/s);}
 ctx.restore();return true;
}

function foundation(ctx,g,footing){
 if(!footing)return;
 const {x,y,width:w}=g.foundation,{top,ground}=footing;
 ctx.save();ctx.beginPath();ctx.moveTo(...footing.polygon[0]);for(const p of footing.polygon.slice(1))ctx.lineTo(...p);ctx.closePath();ctx.clip();
 // Continuous uncut bedrock, with diagonal fractures rather than brick courses.
 poly(ctx,footing.polygon,'#718071');
 const low=Math.max(...ground.map(p=>p[1]))+3;
 poly(ctx,[[x-7,top-2],[x+w*.32,top-2],[x+w*.2,top+12],[x+w*.3,low],[x-9,low]],'#596b60');
 poly(ctx,[[x+w*.32,top-2],[x+w*.8,top-2],[x+w*.58,top+13],[x+w*.46,low],[x+w*.3,low],[x+w*.2,top+12]],'#819080');
 poly(ctx,[[x+w*.8,top-2],[x+w+4,top-2],[x+w+9,low],[x+w*.69,low],[x+w*.58,top+13]],'#63776a');
 line(ctx,x,top+2,x+w,top+2,'#4d6059',3);
 ctx.restore();
 // The contact seam follows the same sampled ground as the terrain renderer.
 for(let i=1;i<ground.length;i++)line(ctx,...ground[i-1],...ground[i],'#9aa581',2);
}

function gallery(ctx,building){
 const s=garrisonStation(building);if(!s||s.floor.width<=0)return;
 const {floor,opening}=s,height=Math.max(12,floor.y-opening.y);
 arch(ctx,opening.x,floor.y,opening.width,height,ink.edge);
 line(ctx,floor.x,floor.y,floor.x+floor.width,floor.y,ink.warm,3);
 rect(ctx,floor.x,floor.y+1,floor.width,4,ink.wood);
 for(const x of [floor.x+3,floor.x+floor.width-3])poly(ctx,[[x-3,floor.y+5],[x+3,floor.y+5],[x,floor.y+12]],ink.shadow);
}

function masonry(ctx,g,tower,cloth){
 const {x,y,width:w,height:h}=g.body,cx=x+w/2,bottom=y+h;
 // All structural stone is clipped to the visible collision rectangle. Decoration
 // is laid out in world units rather than squeezing a shared illustration.
 ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
 rect(ctx,x,y,w,h,ink.stone);rect(ctx,x,y,w*.2,h,ink.shadow);rect(ctx,x+w-5,y,5,h,ink.light);
 for(let row=0;row<Math.ceil(h/22);row++){const sy=y+row*22+14;line(ctx,x+2,sy,x+w-2,sy,ink.mortar,.8);for(let col=0;col<Math.ceil(w/25);col++){const sx=x+col*25+(row%2?12:0);line(ctx,sx,sy,sx,Math.min(sy+22,bottom),ink.mortar,.8);}}
 // A solid parapet face supports the engine's rectangular top. Dark recesses
 // suggest battlements without painting transparent notches inside a hitbox.
 rect(ctx,x,y,w,17,ink.light);rect(ctx,x,y+16,w,5,ink.shadow);
 const bays=Math.max(3,Math.round(w/19)),step=w/bays;
 for(let i=0;i<bays;i++)rect(ctx,x+i*step+step*.32,y+4,step*.38,9,ink.shadow);
 line(ctx,x+1,y+1,x+w-1,y+1,ink.warm,2);
 const doorWidth=Math.min(tower?20:38,w*.48),doorHeight=tower?33:54;
 arch(ctx,cx,bottom-1,doorWidth+6,doorHeight+5,ink.light);arch(ctx,cx,bottom-1,doorWidth,doorHeight,ink.door);arch(ctx,cx,bottom-1,doorWidth-7,doorHeight-7,ink.wood);
 for(let i=-1;i<=1;i++)line(ctx,cx+i*doorWidth*.2,bottom-5,cx+i*doorWidth*.2,bottom-doorHeight*.62,'#313832',1.5);
 line(ctx,cx-doorWidth*.3,bottom-16,cx+doorWidth*.3,bottom-16,ink.warm,2);
 const slots=w>90?[-w*.3,w*.3]:[0];
 for(const dx of slots){arch(ctx,cx+dx,y+65,11,25,ink.edge);line(ctx,cx+dx+6,y+46,cx+dx+6,y+65,ink.light,1.3);}
 if(w>90){for(const dx of [-w*.24,w*.24])banner(ctx,cx+dx,y+79,16,42,cloth);}
 else banner(ctx,cx,y+76,15,tower?24:39,cloth);
 rect(ctx,x,y+h-5,w,5,ink.shadow);line(ctx,x+1,y+1,x+1,bottom-1,ink.edge,2);line(ctx,x+w-1,y+1,x+w-1,bottom-1,ink.edge,2);
 ctx.restore();
}

function flag(ctx,g,cloth){const x=g.centerX,y=g.body.y;line(ctx,x,y+2,x,y-34,ink.warm,2);poly(ctx,[[x+1,y-34],[x+27,y-27],[x+1,y-17]],cloth);}
function flame(ctx,x,y,strength,tick){const h=(22+Math.sin(tick*.13+x)*4)*strength;poly(ctx,[[x-7,y],[x-8,y-h*.5],[x-3,y-h*.3],[x,y-h],[x+5,y-h*.4],[x+8,y-h*.6],[x+6,y]],'#c9673bcc');poly(ctx,[[x-3,y],[x-1,y-h*.55],[x+4,y-h*.2],[x+4,y]],'#f1cf78dd');}

export function drawFortification(ctx,building,{scale=1,tick=0,elevationAt}={}){
 const g=fortificationGeometry(building);if(!g)return false;
 ctx.save();ctx.lineJoin='round';
 if(building.destroyed||building.clipPresent===false){const x=g.centerX,w=g.body.width,y=building.y;poly(ctx,[[x-w*.58,y],[x-w*.5,y-9],[x-w*.25,y-6],[x-w*.2,y-20],[x,y-10],[x+w*.18,y-25],[x+w*.35,y-10],[x+w*.52,y-13],[x+w*.58,y]],ink.shadow);line(ctx,x-w*.18,y-12,x+w*.15,y-18,ink.stone,4);ctx.restore();return true;}
 const tower=building.type==='tower',team=tower?building.occupiedBy:building.team,cloth=team==='good'?'#427f90':team==='bad'?'#914654':'#aa9161';
 const footing=fortificationFooting(building,{elevationAt});
 foundation(ctx,g,footing);
 // Ground in front masks below-slope wall pixels, including tower colliders
 // whose mechanical bounds extend below the surface.
 ctx.save();ctx.beginPath();ctx.moveTo(footing.left,g.body.y-100);ctx.lineTo(footing.right,g.body.y-100);for(const p of footing.ground.slice().reverse())ctx.lineTo(...p);ctx.closePath();ctx.clip();
 masonry(ctx,g,tower,cloth);flag(ctx,g,cloth);
 gallery(ctx,building);
 ctx.restore();
 const fraction=building.maxHp>0?building.hp/building.maxHp:1;
 if(fraction<.5){const strength=Math.min(1.4,(.5-fraction)*2+.3);flame(ctx,g.centerX-g.body.width*.23,g.body.y+50,strength,tick);flame(ctx,g.centerX+g.body.width*.25,g.body.y+20,strength*.8,tick+9);}
 if(fraction<1){const width=g.body.width,y=building.y+11;rect(ctx,g.body.x,y,width,5,'#1b2a28');rect(ctx,g.body.x+1,y+1,(width-2)*Math.max(0,fraction),3,team==='bad'?'#d7a07d':'#a3c4b9');}
 ctx.restore();return true;
}
