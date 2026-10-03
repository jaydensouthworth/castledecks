/** Independently implemented target-local effect queue and timer semantics.
 * World iteration order is the integrator's responsibility and still requires
 * AVM1 comparison. No Flash visual, sound, or navigation behavior is executed.
 */
import {protectsAlliedFlyer} from './attack-allegiance.mjs';
const alive=target=>target!=null&&(typeof target.hasHP==='function'?target.hasHP():target.hp>0);
const opposite={ice:'fire',fire:'ice',poison:'purge',purge:'poison'};
export class TimedEffect {
  constructor({kind,target,duration=10,interval=9999,perform=()=>{},cleanup=()=>{}}={}){Object.assign(this,{kind,target,duration,interval,perform,cleanup});this.cooldown=0;this.frames=0;this.deleted=false;this.indicator=null;}
  get dead(){return !(this.duration>0);}
  step(){
    const previousDuration=this.duration--;
    if(previousDuration>0){
      const previousCooldown=this.cooldown--;
      if(previousCooldown<=0){this.cooldown=this.interval;this.perform(this);if(!alive(this.target)){this.duration=0;this.deleted=true;}}
    }else this.deleted=true;
    this.frames++;
  }
}
export class EffectQueue {
  constructor(owner,{onAttach=()=>{},onDetach=()=>{}}={}){this.owner=owner;this.effects=[];this.occupied=[false,false,false,false];this.cursor=3;this.onAttach=onAttach;this.onDetach=onDetach;}
  allocate(){let probes=0;while(this.occupied[this.cursor]){if(probes++>=4)break;const prior=this.cursor--;if(prior<1)this.cursor=3;}if(probes>=4)return -1;this.occupied[this.cursor]=true;return this.cursor;}
  add(effect){
    const immunity=this.owner.immunity;
    if(typeof immunity==='string'&&immunity.indexOf(effect.kind)!==-1)return {status:'immune'};
    const canceled=opposite[effect.kind]===undefined?undefined:this.effects.find(e=>e.kind===opposite[effect.kind]);
    if(canceled){this.remove(canceled);return {status:'canceled'};}
    const slot=this.allocate();if(slot<0)return {status:'full'};
    effect.indicator={slot};effect.slot=slot;this.effects.push(effect);this.onAttach(effect,slot);return {status:'accepted',slot};
  }
  remove(effect){const index=this.effects.indexOf(effect);if(index<0)return false;if(effect.indicator?.slot!=null){this.occupied[effect.indicator.slot]=false;this.onDetach(effect);}effect.cleanup(effect);this.effects.splice(index,1);return true;}
  step(){const expired=[];for(let i=0;i<this.effects.length&&alive(this.owner);i++){const effect=this.effects[i];effect.step();if(effect.dead)expired.push(effect);}for(const effect of expired)this.remove(effect);}
}
export function impactReaction(damage,remainingHp,random=Math.random){
 const ratio=damage/remainingHp;
 if(ratio>.5){if(Math.floor(random()*2)===0)return 'knock_back';if(Math.floor(random()*2)===0)return 'flinch';return null;}
 if(ratio>.2)return Math.floor(random()*2)===0?'flinch':null;
 return Math.floor(random()*5)===0?'flinch':null;
}
export function impactEffect({source=null,target,amount,critical=false,impactType='blunt',duration=10,random=Math.random,onDamage=()=>{},onReaction=()=>{}}){
 if(typeof target?.takeDamage!=='function')throw new TypeError('Impact target needs a takeDamage behavior');
 const effect=new TimedEffect({kind:'impact',target,duration,interval:9999,perform:self=>{
   if(amount>=0&&protectsAlliedFlyer(source,target)){self.duration=0;return;}
   const damage=Math.floor(amount);target.takeDamage(damage,{playSound:true,impactType});onDamage({target,damage,critical,scale:critical?150:100});
   if(target.isFighter&&alive(target)&&!target.knockedDown){const reaction=impactReaction(damage,target.hp,random);if(reaction)onReaction(target,reaction);}
   self.duration=0;
 }});return effect;
}
