/** Independent implementation of narrowly recovered ballistic behavior.
 * Original-runtime equivalence remains unverified.
 * Screen-space coordinates: +x right; +y down. Units are authored stage pixels.
 */
import {protectsAlliedFlyer} from './attack-allegiance.mjs';
export const PHYSICS=Object.freeze({tickHz:33,gameSpeed:2,gravityPerTick:.3,heroPower:285,dragLimit:180,launchScale:.08,minimumSpeedExclusive:5});
export function aimVector(anchor,pointer) {
  const dx=pointer.x-anchor.x,dy=pointer.y-anchor.y;
  const distance=Math.hypot(dx,dy);
  const power=Math.min(distance/PHYSICS.dragLimit,1);
  const speed=power*PHYSICS.heroPower*PHYSICS.launchScale;
  return {vx:distance ? -dx/distance*speed : 0,vy:distance ? -dy/distance*speed : 0,power,speed,canFire:speed>PHYSICS.minimumSpeedExclusive};
}
export class Arrow {
  constructor({x,y,vx,vy,gravity=PHYSICS.gravityPerTick}) {
    vx=vx??0;vy=vy??0;
    this.x=x;this.y=y;this.vx=vx;this.vy=vy;this.gravity=gravity;this.tick=0;this.flightUnits=0;this.active=true;
    // Original velocity assignment moves one full velocity vector immediately.
    this.move();this.angle=0;this.draw={x,y,angle:0};
  }
  move() {
    this.previous={x:this.x,y:this.y};
    this.x+=this.vx;this.y+=this.vy;
    this.midpoint={x:(this.previous.x+this.x)/2,y:(this.previous.y+this.y)/2};
  }
  step(onCollision=()=>{}) {
    if(!this.active)return;
    this.tick++;this.flightUnits+=PHYSICS.gameSpeed;
    this.vy+=this.gravity;this.move();this.angle=Math.atan2(this.vy,this.vx);this.draw={x:this.x,y:this.y,angle:this.angle};
    onCollision(this);
    if(this.active&&(this.x>2050||this.x< -50||this.y< -1000)){this.active=false;this.reason='out-of-bounds';}
  }
}
export function containsPoint(rect,p) {
  return p.x>=rect.x&&p.x<=rect.x+rect.width&&p.y>=rect.y&&p.y<=rect.y+rect.height;
}
export function sampleStandardHit(arrow,groundY,targets) {
  if(arrow.y>groundY)return {kind:'ground'};
  for(const target of targets) {
    if(protectsAlliedFlyer(arrow,target))continue;
    if(target.hp>0&&(containsPoint(target.hitbox,arrow)||containsPoint(target.hitbox,arrow.midpoint)))return {kind:'target',target};
  }
  return null;
}
export function analyticPosition({x,y,vx,vy,gravity=PHYSICS.gravityPerTick},completedTicks) {
  return {x:x+vx*(completedTicks+1),y:y+vy*(completedTicks+1)+gravity*completedTicks*(completedTicks+1)/2};
}
export class BasicShotCooldown {
  constructor(){this.maximum=60;this.remaining=60;}
  step(){this.remaining=Math.max(0,this.remaining-PHYSICS.gameSpeed);}
  get ready(){return this.remaining<=0;}
  use(){if(!this.ready)return false;this.remaining=this.maximum;return true;}
}
