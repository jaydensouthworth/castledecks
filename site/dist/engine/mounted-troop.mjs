/** Independently implemented mounted CTF troop behavior.
 * Numeric movement and state rules are modeled independently.
 */
import {FlagTroop,FLAG_ACTION as A} from './flag-troop.mjs';
import {troopStats,meleeImpact} from './combat.mjs';
export class MountedTroop extends FlagTroop {
  constructor(options){
    const supplied=options.services??{},world=options.world;
    super({...options,type:'grunt',stats:options.stats??troopStats('mount',options),services:{...supplied,updateRotation(unit){unit.rotation=world.rotationAt?.(unit.x)??0;supplied.updateRotation?.(unit)}}});
    this.type='mount';this.runner=1;this.immunities.add('daze');this.multipliers={slice:.8,blunt:1.2,pierce:1};this.rotation=0;
  }
  get immunity(){return [...this.immunities].join(',');}
  setAnimation(range,rate){const mounted={move:[24,45],attack:[1,23],die:[46,52],rot:[52,52]};if(!mounted[range])return super.setAnimation(range,rate);const [start,end]=mounted[range];this.animation={...this.animation,start,end,frame:start,rate};}
  transition(action){
    if([A.KNOCKBACK,A.FLINCH,A.DAZE].includes(action))return null;
    if(action===A.FEAR)return this.transition(A.RETREAT);
    if(action===A.ADVANCE||action===A.RETREAT){
      this.lastAction=action;const direction=action===A.ADVANCE?this.forward:-this.forward,cadence=4/this.speedFactor;
      this.facing=direction;this.vx=direction*this.speed*this.speedFactor;this.actionMode='move';this.engaged=false;this.actionDuration=Math.abs(21*cadence/this.vx);this.setAnimation('move',Math.abs(this.vx/cadence));this.services.actionChanged?.(this,action);return action;
    }
    const result=super.transition(action);
    if(action===A.ATTACK)this.animation.rate=22/this.actionDuration;
    if(action===A.DIE)this.actionDuration=24;
    return result;
  }
  attackEngagementTarget(){
    const target=this.attacking[this.randomInteger(this.attacking.length)];
    if(!target){this.services.missingAttackTarget?.(this);return;}
    if(this.distanceTo(target)>45||target.garrisoned()){this.unlinkTarget(target);this.transition(A.ADVANCE);return;}
    const amount=meleeImpact({damage:this.damage,multiplier:target.multipliers.slice,random:this.random});
    const request={source:this,target,amount,type:'armor',duration:10,frequency:9999};
    if(this.services.queueImpact)this.services.queueImpact(request);else this.pendingImpacts.push(request);
    this.facing=target.x>this.x?1:-1;
    if(this.skill&&target.isFighter&&target.team==='bad'&&this.randomInteger(2)===0)this.skill.addXP(Math.ceil(.1*amount));
  }
}
