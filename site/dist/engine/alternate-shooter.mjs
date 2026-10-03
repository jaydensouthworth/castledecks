/** Independently authored point/auto input state models.
 * No Flash implementation code,
 * visual asset, or audio is reused. UI hit testing and event order are external.
 * press() means the shooter button accepted a press, not any document click.
 */
import {DragShooter} from './drag-shooter.mjs';
import {rangedAngles} from './ranged-troop.mjs';

export const AUTO_ANGLE=Object.freeze({HIGH:0,LOW:1});
export const ALTERNATE_POWER=Object.freeze({point:25,auto:22.8});
const DEGREES_PER_RADIAN=180/Math.PI;

/** Original slider mapping after a held-frame position clamp. A custom positive
 * outOf is allowed by the source; the normal100 value maps to50..100 inclusive.
 * NaN isn't silently replaced: the source's comparisons also fail to clamp it.
 */
export function sliderPowerPercent(ballX,outOf=100) {
  if(!(outOf>0))outOf=100;
  let x=ballX;
  if(x<0)x=0;
  if(x>210)x=210;
  return 50+Math.floor(x/210*outOf*.5);
}

/** Slider events update state; only a held step moves the ball. releaseOutside
 * has the same behavior as release. This does not invent track-click dragging.
 */
export class PowerSlider {
  constructor({outOf=100}={}) {
    this.outOf=outOf>0?outOf:100;this.ballX=210;this.pointerX=210;
    this.holding=false;this.value=50+Math.floor(this.ballX/210*this.outOf*.5);
  }
  get powerPercent(){return this.value;}
  move(localX){this.pointerX=localX;}
  press(localX=this.pointerX){this.move(localX);this.holding=true;}
  release(localX=this.pointerX){this.move(localX);this.holding=false;}
  cancel(){this.holding=false;}
  step() {
    if(this.holding) {
      this.ballX=this.pointerX;
      if(this.ballX<0)this.ballX=0;
      if(this.ballX>210)this.ballX=210;
      this.value=50+Math.floor(this.ballX/210*this.outOf*.5);
    }
    return this.value;
  }
}

/** Point mode intentionally uses atan(dy/dx), not atan2. The zero-vector NaN,
 * vertical-axis convention, and0-value subtraction are retained from behavior.
 */
export function pointAim(origin,pointer,powerPercent=100) {
  const dx=origin.x-pointer.x,dy=origin.y-pointer.y;
  const initialRadians=Math.atan(dy/dx);
  let radians=initialRadians,degrees=initialRadians*DEGREES_PER_RADIAN;
  if(dx<0&&dx!==0){radians+=Math.PI;degrees+=180;}
  const speed=ALTERNATE_POWER.point*powerPercent/100;
  return {vx:0-Math.cos(radians)*speed,vy:0-Math.sin(radians)*speed,
    speed,power:powerPercent/100,powerPercent,radians,degrees,origin:{...origin},canFire:true};
}

/** Auto mode only treats777 as unreachable. NaN angles are passed through to
 * the skill attempt. Loose comparisons reflect AVM1 Equals2 for the mode and
 * sentinel, including numeric-string values in externally modified state.
 */
export function autoAim(origin,pointer,{powerPercent=100,angleMode=AUTO_ANGLE.LOW,
  gravity=.3,solveAngles=rangedAngles}={}) {
  const speed=ALTERNATE_POWER.auto*powerPercent/100;
  const roots=solveAngles({x:origin.x,y:origin.y,targetX:pointer.x,targetY:pointer.y,power:speed,gravity});
  const common={speed,power:powerPercent/100,powerPercent,angleMode,roots,origin:{...origin},degrees:0};
  if(roots[0]==777)return {...common,canFire:false,reason:'unreachable'};
  const dx=pointer.x-origin.x,low=angleMode==AUTO_ANGLE.LOW,radians=roots[low?0:1];
  let vx=Math.cos(radians)*speed,vy=Math.sin(radians)*speed;
  if(low) {
    if(dx<0){vx=0-vx;vy=0-vy;}
  }else if(dx>0)vy=0-vy;
  else {vx=0-vx;vy=0-vy;}
  return {...common,vx,vy,radians,canFire:true};
}

class AlternateShooter {
  constructor({origin,powerPercent=100,angleMode=AUTO_ANGLE.LOW,gravity=.3,onFailure=()=>{},maxPointerY=865}={}) {
    this.origin=origin;this.powerPercent=powerPercent;this.angleMode=angleMode;this.gravity=gravity;
    this.onFailure=onFailure;this.maxPointerY=maxPointerY;
    // An origin callback is optional. The usual DragShooter-compatible adapter
    // assigns hero.launchPosition to origin immediately before every step.
    this.pointer=typeof origin==='function'?{x:0,y:0}:{...origin};
    this.holding=false;this.fired=false;this.active=null;this.lastPower=powerPercent/100;
    this.rotation=undefined;this.buttonPosition={...this.pointer};this.guide=null;
    // Shooter and both alternate constructors leave these fields unset. Hero
    // reads the retained previous shooter-phase value before the next sample.
    this.shootingX=undefined;this.shootingY=undefined;
    this.sampledOrigin=null;this.lastAttempt=null;
  }
  move(pointer){this.pointer={...pointer};}
  press(pointer=this.pointer){this.move(pointer);this.holding=true;}
  release(pointer=this.pointer){this.move(pointer);this.holding=false;}
  // Cancellation clears the held event state. As with release, a simulation
  // sample observes that state and rearms. A rapid release/press between ticks
  // deliberately does not create a second attempt after an already fired click.
  cancel(){this.holding=false;this.active=null;}
  setPowerFromSlider(localX,outOf=100){this.powerPercent=sliderPowerPercent(localX,outOf);return this.powerPercent;}
  step() {
    this.sampledOrigin={...(typeof this.origin==='function'?this.origin():this.origin)};
    // These are the sampled mouse coordinates, distinct from launch origin.
    this.shootingX=this.pointer.x;this.shootingY=this.pointer.y;
    this.updateGuide();
    this.buttonPosition={...this.pointer};
    if(this.holding&&!this.fired&&this.pointer.y<this.maxPointerY) {
      this.fired=true;
      const attempt=this.shootAtSpot();
      this.lastAttempt=attempt;this.lastPower=attempt.power;
      if(!attempt.canFire){this.onFailure(attempt,this);return null;}
      return attempt;
    }
    if(!this.holding)this.fired=false;
    return null;
  }
}

export class PointShooter extends AlternateShooter {
  constructor(options={}){super(options);this.mode='point_aim';}
  updateGuide() {
    // Only angle/guide is updated before a shot. Power is read at the actual
    // attempt, as in the source; no cooldown or availability gate lives here.
    const dx=this.sampledOrigin.x-this.pointer.x,dy=this.sampledOrigin.y-this.pointer.y;
    this.radians=Math.atan(dy/dx);this.rotation=this.radians*DEGREES_PER_RADIAN;
    if(dx<0&&dx!==0){this.radians+=Math.PI;this.rotation+=180;}
    this.guide={...this.sampledOrigin,rotation:this.rotation};
  }
  shootAtSpot() {
    const speed=ALTERNATE_POWER.point*this.powerPercent/100;
    return {vx:0-Math.cos(this.radians)*speed,vy:0-Math.sin(this.radians)*speed,
      speed,power:this.powerPercent/100,powerPercent:this.powerPercent,radians:this.radians,
      degrees:this.rotation,origin:{...this.sampledOrigin},canFire:true};
  }
}

export class AutoShooter extends AlternateShooter {
  constructor({solveAngles=rangedAngles,aimSolver=autoAim,...options}={}){super(options);this.mode='auto_aim';this.solveAngles=solveAngles;this.aimSolver=aimSolver;this.rotation=0;}
  updateGuide(){this.guide={...this.pointer,rotation:0};}
  shootAtSpot() {
    return this.aimSolver(this.sampledOrigin,this.pointer,{powerPercent:this.powerPercent,angleMode:this.angleMode,
      gravity:this.gravity,solveAngles:this.solveAngles});
  }
}

/** Source profiles select the exact alternate names; classic is this independent
 * application's existing alias for drag_circle. All remaining source mode
 * strings take the original nonclassic drag fallback (LevelManager.initShooter).
 * Recreate the controller for a mode change; mutating mode isn't dispatch.
 */
export function createShooter({mode='classic',...options}={}) {
  if(mode==='point_aim')return new PointShooter(options);
  if(mode==='auto_aim')return new AutoShooter(options);
  return new DragShooter({...options,mode:mode==='drag_circle'||mode==='classic'?'classic':'anywhere'});
}
