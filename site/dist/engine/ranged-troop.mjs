/** Independent static-behavior models; original-runtime parity is unverified.
 * Projectile and effect requests are deferred, never immediate damage/healing.
 */
import {FlagTroop,FLAG_ACTION as A,FLAG_GAME_SPEED} from './flag-troop.mjs';
import {TROOPS,meleeImpact} from './combat.mjs';
import {TimedEffect} from './effects.mjs';

export const RANGED_ACTION=Object.freeze({LOAD_ARROW:'load_arrow',AIM:'aim',RELEASE_ARROW:'release_arrow',
  HEAL:'heal',PURGE:'purge',LOAD_AMMO:'load_ammo',RELEASE_AMMO:'release_ammo',HOLD_FIRE:'hold_fire'});
const R=RANGED_ACTION;
const DEAD_IMMUNITIES=['fire','ice','poison','fear','daze','regen','impact','heal','purge','convert'];
const liveList=value=>typeof value==='function'?value():value;
const alive=obj=>typeof obj?.hasHP==='function'?obj.hasHP():obj?.hp>0;
const garrisoned=obj=>typeof obj?.garrisoned==='function'?obj.garrisoned():obj?.garrisonBuilding!=null;
const holdingFlag=obj=>typeof obj?.holdingFlag==='function'?obj.holdingFlag():!!(obj?.holdingFriendFlag||obj?.holdingEnemyFlag);
const priest=obj=>typeof obj?.isPriest==='function'?obj.isPriest():obj?.type==='priest';
const living=obj=>typeof obj?.getType==='function'?obj.getType()==='living':
  (obj?.lifeType??(obj?.type==='trebuchet'?'vehicle':
    Object.hasOwn(TROOPS,obj?.type??'')||obj?.isFighter?'living':undefined))==='living';
const injured=obj=>typeof obj?.injured==='function'?obj.injured():obj?.hp>0&&obj.hp<obj.maxHp;
const occupiedBy=obj=>typeof obj?.getOccupiedBy==='function'?obj.getOccupiedBy():obj?.occupiedBy??obj?.team;
const unoccupied=obj=>typeof obj?.occupiedByNobody==='function'?obj.occupiedByNobody():
  occupiedBy(obj)==null||occupiedBy(obj)==='neutral'||occupiedBy(obj)==='nobody';
const room=obj=>typeof obj?.hasRoom==='function'?obj.hasRoom():
  Array.isArray(obj?.occupants)&&obj.occupants.length<obj.maxOccupants;
const poisoned=obj=>typeof obj?.isPoisoned==='function'?obj.isPoisoned():
  (obj?.effects?.effects??obj?.effects??[]).some(effect=>effect.kind==='poison');
const remove=(list,item)=>{const index=list?.indexOf(item);if(index>=0)list.splice(index,1);};
const ARCHER_FRAMES=Object.freeze({move:[5,15],attack:[16,47],block:[16,16],die:[48,58],rot:[58,58],
  flinch:[60,70],knock_back:[70,90],daze:[90,90],get_up_daze:[90,110],
  load_arrow:[16,37],aim:[37,37],release_arrow:[37,48]});
const TREBUCHET_FRAMES=Object.freeze({move:[1,14],attack:[15,169],block:[15,15],die:[223,245],rot:[245,245],
  load_ammo:[222,222],aim:[222,222],release_ammo:[15,222],hold_fire:[222,222]});

/** Independently simplified Util.getTheta geometry. Preserves its root-sign
 * residual check and 777 sentinel. Colocated x gives NaN (source singularity).
 * Real-valued algebra equivalence is tested; AVM1 floating-point parity isn't.
 */
export function rangedAngles({x,y,targetX,targetY,power,gravity=.3}) {
  const dx=targetX-x,dy=targetY-y,v2=power*power;
  const discriminant=v2*v2-gravity*gravity*dx*dx+2*gravity*v2*dy;
  const determinant=v2*v2*dx**4*discriminant;
  if(determinant<0)return [777,777];
  const numerator=v2*dx*dx*(v2+gravity*dy),root=Math.sqrt(determinant);
  const denominator=gravity*gravity*dx**4;
  const low=Math.acos(1/Math.sqrt(2*(numerator-root)/denominator));
  const high=Math.acos(1/Math.sqrt(2*(numerator+root)/denominator));
  const time=dx/(power*Math.cos(low));
  const predicted=y+power*Math.sin(low)*time+.5*gravity*time*time;
  return [!(Math.abs((targetY-predicted)/targetY)>.001)?low:-low,high];
}

/** Convert an already-created request to the target-local effects model. The
 * target queue must perform immunity, cancellation, capacity and step ordering.
 */
export function createSupportEffect(request,{random=request.source?.random??Math.random,onHeal=()=>{}}={}) {
  const {kind,target,amount,duration,interval}=request;
  if(kind!==R.HEAL&&kind!==R.PURGE)throw new RangeError('Only heal and purge are support effects');
  return new TimedEffect({kind,target,duration,interval,perform:effect=>{
    if(kind===R.HEAL) {
      // AVM1 RandomNumber truncates its argument to an integer.
      const limit=Math.trunc(amount/2),roll=random();
      if(!(roll>=0&&roll<1))throw new RangeError('RNG must return a value in [0,1)');
      let healed=Math.floor(amount+Math.floor(roll*limit));
      const missing=target.maxHp-target.hp;
      if(healed>missing)healed=missing;
      target.takeDamage(-healed,{playSound:false});
      onHeal({target,amount:healed});
    }
    effect.duration=5;
  }});
}

class SpecialistTroop extends FlagTroop {
  constructor(options) {
    super(options);
    this.friends=options.friends??[];
    this.structures=options.structures??this.world.structures??[];
    this.height=options.height;
    this.rank=options.rank??Math.floor((options.level??1)/5);
    this.lifeType=this.type==='trebuchet'?'vehicle':'living';
    this.pendingProjectiles=[];this.pendingEffects=[];
    this.multipliers={lightning:1,fire:1,ice:1,blunt:1,slice:1,pierce:1,flak:1,poison:1,
      ...Object.fromEntries(['lightning','fire','ice','blunt','slice','pierce','flak','poison']
        .filter(key=>TROOPS[this.type][key]!==undefined).map(key=>[key,TROOPS[this.type][key]]))};
  }
  get immunity(){return [...this.immunities].join(' ');}
  hasHP(){return this.hp>0;}
  getType(){return this.lifeType;}
  isPriest(){return this.type==='priest';}
  injured(){return this.hp>0&&this.hp<this.maxHp;}
  isPoisoned(){return (this.effects?.effects??[]).some(effect=>effect.kind==='poison');}
  percentVariation(buckets){return 1+(this.randomInteger(buckets)-Math.ceil(buckets/2))/100;}
  inFront(target){return this.forward>0?target.x>this.x:target.x<this.x;}
  inRange(target,range){return Math.abs(this.x-target.x)<range;}
  moveToward(target){return this.transition(this.inFront(target)?A.ADVANCE:A.RETREAT);}
  face(target){this.facing=target?.x>this.x?1:-1;}
  nearest(collection,predicate=()=>true) {
    let selected=null,best=9999;
    for(const candidate of liveList(collection)) {
      const distance=Math.abs(this.x-candidate.x);
      if(predicate(candidate)&&distance<best){best=distance;selected=candidate;}
    }
    return selected;
  }
  getOwningStructure(){return this.garrisonBuilding??(this.team==='good'?this.world.goodCastle:this.world.badCastle)??null;}
  requestProjectile(payload) {
    const request={source:this,team:this.team,skill:this.skill,owningStructure:this.getOwningStructure(),...payload};
    this.services.projectileSound?.(this,payload.kind);
    if(this.services.queueProjectile)this.services.queueProjectile(request);
    else this.pendingProjectiles.push(request);
    return request;
  }
  requestEffect(payload) {
    const request={source:this,...payload};
    if(this.services.queueEffect)this.services.queueEffect(request);
    else this.pendingEffects.push(request);
    return request;
  }
  attackEngagementTarget() {
    const target=this.attacking[this.randomInteger(this.attacking.length)];
    if(!target){this.services.missingAttackTarget?.(this);return;}
    if(this.distanceTo(target)>45||garrisoned(target)) {
      this.unlinkTarget(target);this.transition(A.ADVANCE);return;
    }
    const isPriest=this.type==='priest';
    const amount=isPriest?meleeImpact({damage:this.damage,multiplier:target.multipliers?.blunt??1,random:this.random}):this.meleeDamage;
    const request={source:this,target,amount,type:'armor',duration:isPriest?10:20,frequency:9999};
    if(this.services.queueImpact)this.services.queueImpact(request);else this.pendingImpacts.push(request);
    this.face(target);
    if(this.skill&&target.isFighter&&target.team==='bad')this.skill.addXP(isPriest?Math.ceil(.1*amount):1);
  }
  setSpecialAnimation(range,rate) {
    const [start,end]=range;
    this.animation={...this.animation,start,end,frame:start,rate};
  }
  stationary(action,duration,frames,rate) {
    this.lastAction=action;this.vx=0;this.actionMode=action;this.actionDuration=duration;
    this.setSpecialAnimation(frames,rate);
    this.services.actionChanged?.(this,action);
    return action;
  }
  deathTransition(duration,frames) {
    this.lastAction=A.DIE;this.vx=0;this.immunities=new Set(DEAD_IMMUNITIES);
    this.actionMode='die';this.actionDuration=duration;this.setSpecialAnimation(frames,.25);
    this.unlinkEngagements();this.services.actionChanged?.(this,A.DIE);return A.DIE;
  }
  animateUnlooped() {
    this.animation.displayFrame=Math.floor(this.animation.frame);
    this.services.drawFrame?.(this,this.animation.displayFrame);
    if(this.animation.frame<this.animation.end)this.animation.frame+=this.animation.rate*FLAG_GAME_SPEED;
  }
}

export class FlagArcher extends SpecialistTroop {
  constructor(options={}) {
    super({...options,type:'archer'});
    if(!Number.isFinite(this.height)||this.height<0)throw new TypeError('Archer requires its measured hitbox height');
    this.unusedRangeRoll=this.randomInteger(200);
    this.fired=false;this.rangedTarget=null;
    this.meleeDamage=1;this.shotDamage=this.damage;
    const byRank=options.rank!=null,n=byRank?options.rank:options.level??1;
    this.shotLoadTime=60;this.shotAimTime=500-n*(byRank?20:4);this.releaseTime=33;
    this.bowPower=(14+n*(byRank?.25:.05))*this.percentVariation(20);
    this.garrisonDistance=20;
  }
  setAnimation(range,rate){this.setSpecialAnimation(ARCHER_FRAMES[range],rate);}
  animate(){this.animateUnlooped();}
  transition(action) {
    if(action===A.FEAR)return this.transition(A.RETREAT);
    if(action===R.LOAD_ARROW)return this.stationary(action,this.shotLoadTime,ARCHER_FRAMES[action],21/this.shotLoadTime);
    if(action===R.AIM)return this.stationary(action,this.shotAimTime,ARCHER_FRAMES[action],0);
    if(action===R.RELEASE_ARROW)return this.stationary(action,this.releaseTime,ARCHER_FRAMES[action],11/this.releaseTime);
    if(action===A.ATTACK) {
      this.face(this.rangedTarget);
      return this.stationary(action,124/this.speedFactor,ARCHER_FRAMES.attack,this.speedFactor/4);
    }
    if(action===A.ADVANCE||action===A.RETREAT) {
      const advancing=action===A.ADVANCE,cadence=4/this.speedFactor;
      this.lastAction=action;this.facing=advancing?this.forward:-this.forward;
      this.vx=this.facing*this.speed*this.speedFactor;this.actionMode='move';
      this.actionDuration=Math.abs((advancing?10*cadence:40)/this.vx);
      this.setAnimation('move',Math.abs(this.vx/(advancing?cadence:4)));
      this.services.actionChanged?.(this,action);return action;
    }
    if(action===A.DIE)return this.deathTransition(24,ARCHER_FRAMES.die);
    return super.transition(action);
  }
  closestFlagCarrier() {
    let selected=null,best=9999,count=0;
    for(const target of liveList(this.enemies)) {
      if(holdingFlag(target)) {
        const distance=Math.abs(target.x-this.x);
        if(distance<best){selected=target;best=distance;}
        if(++count>=2)break;
      }
    }
    return selected;
  }
  closestEnemyStructure(){return this.nearest(this.structures,b=>occupiedBy(b)!==this.team&&!unoccupied(b));}
  forwardGarrison() {
    let selected=null,best=this.team==='bad'?9999:0;
    const half=(this.world.width??2000)/2;
    for(const building of liveList(this.structures)) {
      if(!alive(building)||!room(building)||(occupiedBy(building)!==this.team&&!unoccupied(building)))continue;
      if(this.team==='bad'?building.x<best&&building.x>half:building.x>best&&building.x<half) {
        selected=building;best=building.x;
      }
    }
    return selected;
  }
  attemptGarrison(building) {
    if(!room(building)||(occupiedBy(building)!==this.team&&!unoccupied(building)))return false;
    this.garrisonBuilding=building;this.visible=false;this.canGetHit=false;
    if(building.addToOccupants)building.addToOccupants(this);
    else if(building.addOccupant)building.addOccupant(this);
    else {building.occupants.push(this);if(unoccupied(building))building.occupiedBy=this.team;}
    this.services.enteredGarrison?.(this,building);return true;
  }
  leaveGarrison() {
    const building=this.garrisonBuilding;
    if(building==null)return;
    this.visible=true;
    if(building.removeFromOccupants)building.removeFromOccupants(this);
    else if(building.removeOccupant)building.removeOccupant(this);
    else {remove(building.occupants,this);if(building.occupants.length===0)building.occupiedBy='neutral';}
    this.garrisonBuilding=null;this.canGetHit=true;
    this.services.leftGarrison?.(this,building);
  }
  checkGarrison(){if(this.garrisonBuilding!=null&&!alive(this.garrisonBuilding))this.leaveGarrison();}
  shotOrigin() {
    const building=this.garrisonBuilding;
    if(building==null)return this.shotSpot={x:this.x,y:this.y-this.height};
    const dx=building.shotOffset?.x??building.xShotOffset,dy=building.shotOffset?.y??building.yShotOffset;
    if(!Number.isFinite(dx)||!Number.isFinite(dy))throw new TypeError('Garrison needs measured shotOffset x/y');
    return this.shotSpot={x:building.x+dx,y:building.y+dy};
  }
  shotAngles(target,power,heightFactor) {
    if(!Number.isFinite(target?.height))throw new TypeError('Ranged target requires its measured hitbox height');
    const origin=this.shotOrigin();
    const solve=this.services.rangedAngles??rangedAngles;
    return solve({...origin,targetX:target.x,targetY:target.y-target.height*heightFactor,
      power,gravity:this.world.gravity??.3});
  }
  inShotRange(target){return this.shotAngles(target,this.bowPower*.95,1)[0]!==777;}
  chooseNextAction() {
    this.fired=false;
    if(this.x<50||this.x>(this.world.width??2000)-50)return this.transition(A.ADVANCE);
    const enemy=this.closestFlagCarrier()??this.nearest(this.enemies,alive),structure=this.closestEnemyStructure();
    const target=enemy==null?structure:structure==null?enemy:
      Math.abs(enemy.x-this.x)<Math.abs(structure.x-this.x)?enemy:structure;
    let building;
    if(!this.garrisoned()) {
      building=this.forwardGarrison();
      if(building!=null&&Math.abs(building.x-this.x)<this.garrisonDistance&&target!=null&&this.inShotRange(target))
        this.attemptGarrison(building);
    }
    if(target==null)return !this.garrisoned()&&building!=null?this.moveToward(building):this.transition(A.BLOCK);
    if(this.inShotRange(target)){this.rangedTarget=target;return this.transition(R.LOAD_ARROW);}
    if(!this.garrisoned())return this.moveToward(target);
    this.leaveGarrison();return null;
  }
  shootAtTarget(target) {
    const angles=this.shotAngles(target,this.bowPower,.5),origin={...this.shotSpot};
    let vx,vy;
    if(angles[0]===777) {
      vx=Math.sqrt(this.bowPower*this.bowPower*.5);vy=-vx;
      if(this.x>target.x)vx=-vx;
    }else {
      vx=Math.cos(angles[0])*this.bowPower*this.percentVariation(20);
      vy=Math.sin(angles[0])*this.bowPower*this.percentVariation(20);
      if(target.x-origin.x<0){vx=-vx;vy=-vy;}
    }
    return this.requestProjectile({kind:'standard_arrow',target,...origin,vx,vy,
      impactDamage:Math.floor(this.shotDamage*this.percentVariation(50))});
  }
  doAction() {
    if(this.actionMode===R.LOAD_ARROW){if(!(this.actionDuration>0))this.transition(R.AIM);return;}
    if(this.actionMode===R.AIM) {
      if(!(this.actionDuration>0))this.transition(R.RELEASE_ARROW);
      this.face(this.rangedTarget);return;
    }
    if(this.actionMode===R.RELEASE_ARROW) {
      if(this.rangedTarget!=null&&!this.fired){this.fired=true;this.shootAtTarget(this.rangedTarget);}
      return;
    }
    super.doAction();
  }
}

export class FlagPriest extends SpecialistTroop {
  constructor(options={}) {
    super({...options,type:'priest'});
    this.immunities.add('fear');
    this.midScreen=1000+this.randomInteger(100)-this.randomInteger(100);this.healTarget=null;
    const byRank=options.rank!=null,n=byRank?options.rank:options.level??1;
    this.healPower=50+Math.floor(n*(byRank?2:.4));
    this.healCooldown=this.healCooldownMax=400-Math.floor(n*(byRank?15:3));
    this.healRange=200+n*(byRank?33:6.6)+this.randomInteger(50);
    this.minRange=.45*this.healRange+this.randomInteger(Math.floor(.45*this.healRange));
  }
  healReady(){return this.healCooldown<0;}
  transition(action) {
    if(action===R.HEAL||action===R.PURGE)return this.stationary(action,34,[96,131],1);
    return super.transition(action);
  }
  frontLineFriend() {
    let selected=null,best=this.team==='bad'?9999:0;
    for(const candidate of liveList(this.friends)) {
      if(priest(candidate))continue;
      if(this.team==='bad'?candidate.x<best:candidate.x>best){selected=candidate;best=candidate.x;}
    }
    return selected;
  }
  supportTarget(target,action) {
    this.healTarget=target;
    if(this.inRange(target,this.healRange))return this.transition(this.healReady()?action:A.BLOCK);
    return this.moveToward(target);
  }
  chooseNextAction() {
    if(this.hp>0)this.engageRetaliation();
    if(!(this.hp>0))return this.transition(A.DIE);
    if(this.attacking.length>0)return this.transition(A.ATTACK);
    const poisonedFriend=this.nearest(this.friends,poisoned);
    if(poisonedFriend!=null)return this.supportTarget(poisonedFriend,R.PURGE);
    const injuredFriend=this.nearest(this.friends,target=>injured(target)&&living(target));
    if(injuredFriend!=null)return this.supportTarget(injuredFriend,R.HEAL);
    const front=this.frontLineFriend();
    if(front!=null) {
      if(!this.inFront(front))return this.transition(A.RETREAT);
      if(!this.inRange(front,this.healRange))return this.transition(A.ADVANCE);
      return this.transition(this.inRange(front,this.minRange)?A.RETREAT:A.BLOCK);
    }
    const enemy=this.nearest(this.enemies,target=>!garrisoned(target));
    if(enemy!=null) {const action=this.moveToward(enemy);this.engageNearby();return action;}
    return this.transition((this.forward>0&&this.x<this.midScreen)||(this.forward<0&&this.x>this.midScreen)?A.ADVANCE:A.BLOCK);
  }
  doAction() {
    this.healCooldown--;
    if(this.actionMode===R.HEAL||this.actionMode===R.PURGE) {
      if(this.actionDuration<0) {
        this.healCooldown=this.healCooldownMax;
        const heal=this.actionMode===R.HEAL;
        const amount=heal?this.healPower*this.percentVariation(20):undefined;
        const request={kind:this.actionMode,target:this.healTarget,duration:heal?10:3000,interval:heal?9999:20};
        if(heal)request.amount=amount;
        this.requestEffect(request);
        this.skill?.addXP(heal?Math.ceil(.1*amount):5);
      }
      return;
    }
    super.doAction();
  }
}

export class FlagTrebuchet extends SpecialistTroop {
  constructor(options={}) {
    super({...options,type:'trebuchet'});
    this.immunities=new Set(['fear','convert','heal','poison','regen','daze']);
    this.fired=false;this.rangedTarget=null;this.meleeDamage=1;this.shotDamage=this.damage;
    const byRank=options.rank!=null,n=byRank?options.rank:options.level??1;
    this.shotLoadTime=200;this.shotAimTime=500-n*(byRank?20:4);this.releaseTime=160;
    this.shotVariation=400-Math.floor(n*(byRank?50:10));
    this.shotRange=1500+this.randomInteger(200);
  }
  setAnimation(range,rate){this.setSpecialAnimation(TREBUCHET_FRAMES[range],rate);}
  animate(){this.animateUnlooped();}
  transition(action) {
    if(action===A.FLINCH||action===A.KNOCKBACK||action===A.DAZE)return null;
    if(action===R.LOAD_AMMO)return this.stationary(action,this.shotLoadTime,TREBUCHET_FRAMES[action],0);
    if(action===R.AIM)return this.stationary(action,this.shotAimTime,TREBUCHET_FRAMES[action],0);
    if(action===R.RELEASE_AMMO)return this.stationary(action,this.releaseTime,TREBUCHET_FRAMES[action],207/this.releaseTime);
    if(action===R.HOLD_FIRE)return this.stationary(action,30,TREBUCHET_FRAMES[action],0);
    if(action===A.ATTACK)return this.stationary(action,208,TREBUCHET_FRAMES.attack,1);
    if(action===A.ADVANCE||action===A.RETREAT) {
      this.lastAction=action;this.facing=action===A.ADVANCE?this.forward:-this.forward;
      this.vx=this.facing*this.speed;this.actionMode='move';this.engaged=false;
      this.actionDuration=Math.abs(40/this.vx);this.setAnimation('move',Math.abs(this.vx*.25));
      this.services.actionChanged?.(this,action);return action;
    }
    if(action===A.DIE)return this.deathTransition(76,TREBUCHET_FRAMES.die);
    return super.transition(action);
  }
  selectTarget() {
    let selected=null,best=0;
    for(const target of liveList(this.enemies)) {
      if(!alive(target))continue;
      const distance=this.distanceTo(target);
      if(Number.isFinite(distance)&&distance>best&&distance>700){selected=target;best=distance;}
    }
    this.rangedTarget=selected;return selected;
  }
  chooseNextAction() {
    this.fired=false;
    if(!(this.hp>0))return this.transition(A.DIE);
    if(this.attacking.length>0)return this.transition(A.ATTACK);
    if((this.forward>0&&this.x<(this.world.width??2000)-this.shotRange)||
      (this.forward<0&&this.x>this.shotRange))return this.transition(A.ADVANCE);
    return this.transition(this.selectTarget()!=null?R.LOAD_AMMO:R.HOLD_FIRE);
  }
  shootAtTarget() {
    const target=this.rangedTarget,dx=target.x-this.x,dy=target.y-25-(this.y-150);
    let vx=dx<0?-5*FLAG_GAME_SPEED:5*FLAG_GAME_SPEED;
    const time=dx/(vx-target.vx);
    let vy=(dy-.5*(this.world.gravity??.3)*time*time)/time;
    vy+=(this.randomInteger(400)-200)/100;
    vx+=(this.randomInteger(200)-100)/100;
    return this.requestProjectile({kind:'trebuchet_ammo',target,x:this.x,y:this.y-150,vx,vy,
      impactDamage:this.shotDamage,rank:this.rank});
  }
  doAction() {
    if(this.actionMode===R.LOAD_AMMO){if(!(this.actionDuration>0))this.transition(R.AIM);return;}
    if(this.actionMode===R.AIM){if(!(this.actionDuration>0))this.transition(R.RELEASE_AMMO);return;}
    if(this.actionMode===R.RELEASE_AMMO) {
      if(this.rangedTarget!=null&&!this.fired&&this.rangedTarget.x>0&&this.rangedTarget.x<2000&&this.actionDuration<132) {
        this.fired=true;this.shootAtTarget();
      }
      return;
    }
    super.doAction();
  }
}
