/** Independent 33Hz input-state reconstruction. Input events update state;
 * they never directly emit a projectile. Clip hit-region fidelity is separate.
 */
import {PHYSICS} from './ballistics.mjs';
export function sampledDragAim(anchor,pointer) {
  const dx=pointer.x-anchor.x,dy=pointer.y-anchor.y;
  const distance=Math.sqrt(dx*dx+dy*dy);
  const power=Math.min(distance,PHYSICS.dragLimit)/PHYSICS.dragLimit;
  let degrees=Math.atan(dy/dx)*180/Math.PI;
  if(dx<0)degrees+=180;
  const radians=degrees*Math.PI/180;
  const speed=power*PHYSICS.heroPower*PHYSICS.launchScale;
  const vx=-Math.cos(radians)*speed,vy=-Math.sin(radians)*speed;
  return {vx,vy,power,speed,degrees,canFire:!Number.isNaN(vx)&&Math.sqrt(vx*vx+vy*vy)>PHYSICS.minimumSpeedExclusive};
}
export class DragShooter {
  constructor({origin,mode='classic',maxPointerY=865}={}) {
    this.origin=origin;this.mode=mode;this.maxPointerY=maxPointerY;this.pointer={...origin};this.holding=false;this.active=null;this.lastPower=0;
  }
  move(pointer){this.pointer={...pointer};}
  press(pointer){this.move(pointer);this.holding=true;}
  release(pointer){this.move(pointer);this.holding=false;}
  cancel(){this.holding=false;this.active=null;}
  step() {
    if(this.holding&&this.pointer.y<this.maxPointerY) {
      if(!this.active) {
        const initialSpeed=this.lastPower*PHYSICS.heroPower*PHYSICS.launchScale;
        this.shootingX=(this.mode==='classic'?this.origin:this.pointer).x;
        this.active={anchor:{...(this.mode==='classic'?this.origin:this.pointer)},aim:{vx:-initialSpeed,vy:-0,power:this.lastPower,speed:initialSpeed,degrees:0,canFire:initialSpeed>5}};
      } else {
        this.active.aim=sampledDragAim(this.active.anchor,this.pointer);
        this.lastPower=this.active.aim.power;
      }
      return null;
    }
    if(this.active){const aim=this.active.aim;this.active=null;return aim;}
    return null;
  }
}
