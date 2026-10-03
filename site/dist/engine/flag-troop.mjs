/** Independently written common grunt/tall-grunt state model.
 * World integration and original-runtime equivalence remain provisional.
 * Run step once per 33 Hz simulation frame. No Flash code or assets are used.
 */
import {TROOPS, troopStats, meleeImpact} from './combat.mjs';
import {recoverGroundPosition,advanceGroundPosition} from './ground-position.mjs';

export const FLAG_GAME_SPEED = 2;
export const FLAG_STATUS = Object.freeze({GROUNDED:0, HELD_BY_ENEMY:1, HELD_BY_FRIEND:2, AT_BASE:3, CAPTURED:4});
export const FLAG_ACTION = Object.freeze({
  ADVANCE:'advance', RETREAT:'retreat', ATTACK:'attack', BLOCK:'block',
  PICKUP_FRIEND:'pickup_friend_flag', PICKUP_ENEMY:'pickup_enemy_flag',
  CAPTURE:'capture_flag', RETURN:'return_flag', DIE:'die', ROT:'rot',
  KNOCKBACK:'knock_back', DAZE:'daze', GET_UP:'get_up_daze', FLINCH:'flinch', FEAR:'fear'
});
const S = FLAG_STATUS;
const A = FLAG_ACTION;
const FRAMES = Object.freeze({move:[5,14], attack:[15,24], block:[15,15], die:[25,34],
  rot:[34,34], knock_back:[36,47], daze:[47,73], get_up_daze:[72,85], flinch:[85,95]});
const DEAD_IMMUNITIES = ['fire','ice','poison','fear','daze','regen','impact','heal','purge','convert'];
const isHeld = flag => flag.status === S.HELD_BY_ENEMY || flag.status === S.HELD_BY_FRIEND;
const inFlagRange = (unit, flag) => Math.abs(unit.x-flag.x) < 60;
const inFront = (unit, flag) => unit.forward > 0 ? flag.x > unit.x : flag.x < unit.x;
const moveToward = (unit, flag) => inFront(unit, flag) ? A.ADVANCE : A.RETREAT;
const removeFirst = (list, value) => {const i=list.indexOf(value); if(i>=0) list.splice(i,1);};
const euclidean = (a,b) => Math.sqrt((a.x-b.x)**2+(a.y-b.y)**2);

export class FlagState {
  constructor({x,y,status=S.AT_BASE,holder=null}) {this.x=x;this.y=y;this.status=status;this.holder=holder;}
  step(services={}) {
    if(this.holder != null) {
      this.x=this.holder.x;
      this.y=this.holder.y-50;
      services.updateFlag?.(this);
    }
  }
}

/** The original nine-way nearest-object relevance test, independently expressed
 * as an owner-relative state table. Held meanings are relative to flag ownership.
 */
export function nearestFlagIsRelevant(flag, friendFlag, enemyFlag) {
  if(flag.status===S.GROUNDED) return true;
  if(flag===friendFlag) {
    if(flag.status===S.CAPTURED || flag.status===S.HELD_BY_ENEMY) return true;
    return flag.status===S.HELD_BY_FRIEND &&
      (enemyFlag.status===S.CAPTURED || enemyFlag.status===S.HELD_BY_ENEMY);
  }
  if(flag===enemyFlag) {
    if(flag.status===S.AT_BASE || flag.status===S.HELD_BY_FRIEND) return true;
    return flag.status===S.HELD_BY_ENEMY &&
      (friendFlag.status===S.AT_BASE || friendFlag.status===S.HELD_BY_FRIEND);
  }
  return false;
}

/** Pure flag-only decision; engagements/death are deliberately handled earlier.
 * Returns the target and runner change to make decision provenance inspectable.
 */
export function decideFlagObjective(unit, world) {
  const {friendFlag,enemyFlag}=unit;
  if(unit.holdingEnemyFlag || unit.holdingFriendFlag) {
    const home=unit.forward>0 ? unit.x<world.goodHomeBoundary : unit.x>world.badHomeBoundary;
    return {action:home ? (unit.holdingEnemyFlag ? A.CAPTURE : A.RETURN) : A.RETREAT,
      target:unit.holdingEnemyFlag ? enemyFlag : friendFlag, clearRunner:false};
  }
  const nearerEnemy=Math.abs(unit.x-friendFlag.x)>Math.abs(unit.x-enemyFlag.x);
  const nearest=nearerEnemy ? enemyFlag : friendFlag;
  const farther=nearerEnemy ? friendFlag : enemyFlag;
  if(!nearestFlagIsRelevant(nearest,friendFlag,enemyFlag)) {
    return {action:moveToward(unit,farther),target:farther,clearRunner:false};
  }
  if(!isHeld(nearest) && inFlagRange(unit,nearest)) {
    return {action:nearest===friendFlag ? A.PICKUP_FRIEND : A.PICKUP_ENEMY,target:nearest,clearRunner:false};
  }
  const opposingCarrier=(nearest===friendFlag && nearest.status===S.HELD_BY_ENEMY) ||
    (nearest===enemyFlag && nearest.status===S.HELD_BY_FRIEND);
  if(inFlagRange(unit,nearest) && !opposingCarrier) {
    return {action:A.BLOCK,target:nearest,clearRunner:true};
  }
  return {action:moveToward(unit,nearest),target:nearest,clearRunner:isHeld(nearest)||isHeld(farther)};
}

/** Required world: elevationAt(x), goodHomeBoundary, badHomeBoundary.
 * Effects are intentionally not simulated here: queueImpact is a request, never
 * an automatic immediate takeDamage. Without a handler inspect pendingImpacts.
 * Enemies may be a live array or () => array. List order affects engagements.
 */
export class FlagTroop {
  constructor({type='grunt',stats=null,level=1,rank=null,difficulty='medium',x=0,y=0,
    forward=1,team=forward>0?'good':'bad',friendFlag,enemyFlag,enemies=[],runner,
    random=Math.random,world,services={},skill=null}={}) {
    if(type!=='grunt' && type!=='tallGrunt' &&
      !(new.target!==FlagTroop && ['archer','priest','trebuchet','mount'].includes(type)))
      throw new RangeError('Only common melee flag troops are implemented by the base class');
    if(!world || typeof world.elevationAt!=='function' || !Number.isFinite(world.goodHomeBoundary) ||
      !Number.isFinite(world.badHomeBoundary)) throw new TypeError('Flag troops require terrain and both home boundaries');
    if(!friendFlag || !enemyFlag || friendFlag===enemyFlag) throw new TypeError('Two distinct flag objects are required');
    if(forward!==1 && forward!==-1) throw new RangeError('forward must be 1 or -1');
    this.type=type;this.world=world;this.services=services;this.random=random;this.skill=skill;
    this.friendFlag=friendFlag;this.enemyFlag=enemyFlag;this.enemies=enemies;
    this.x=x;this.y=y;this.forward=forward;this.team=team;this.facing=forward;
    const calculated=stats ?? troopStats(type,{level,rank,difficulty});
    for(const name of ['maxHp','speed','damage']) if(!Number.isFinite(calculated[name]) || calculated[name]<0)
      throw new RangeError(`Invalid troop statistic: ${name}`);
    this.rank=calculated.rank;this.maxHp=calculated.maxHp;this.hp=this.maxHp;this.damage=calculated.damage;
    this.speed=calculated.speed;this.originalSpeed=this.speed;this.speedFactor=1;
    this.runner=runner ?? this.randomInteger(2);
    this.vx=0;this.actionMode='move';this.actionDuration=0;this.lastAction=null;
    this.animation={start:1,end:1,frame:1,rate:0,displayFrame:1};
    this.engaged=false;this.knockedDown=false;this.dead=false;this.destroyed=false;
    this.holdingFriendFlag=false;this.holdingEnemyFlag=false;this.immunities=new Set();
    this.airUnit=false;this.isFighter=true;this.garrisonBuilding=null;this.visible=true;this.canGetHit=true;
    this.attacking=[];this.attackedBy=[];
    this.attackLimit=TROOPS[type].attacks;this.attackedByLimit=TROOPS[type].attackedBy;
    this.multipliers={slice:TROOPS[type].slice,blunt:TROOPS[type].blunt,pierce:TROOPS[type].pierce};
    this.pendingImpacts=[];
  }

  randomInteger(limit) {
    const value=this.random();
    if(!(value>=0 && value<1)) throw new RangeError('RNG must return a value in [0,1)');
    return Math.floor(value*limit);
  }
  distanceTo(target) {const distance=this.world.distanceBetween ? this.world.distanceBetween(this,target) : euclidean(this,target);return Number.isFinite(distance)?distance:Infinity;}
  holdingFlag() {return this.holdingFriendFlag || this.holdingEnemyFlag;}
  interruptAction() {this.actionDuration=0;}
  garrisoned() {return this.garrisonBuilding!=null;}

  linkTarget(target) {
    // The source's low-level add helpers do not enforce limits or deduplicate.
    // Decisions check existing outgoing links before calling this primitive.
    this.attacking.push(target);
    target.attackedBy.push(this);
  }
  unlinkTarget(target) {
    removeFirst(this.attacking,target);
    removeFirst(target.attackedBy,this);
  }
  unlinkEngagements() {
    for(const attacker of this.attackedBy) {
      removeFirst(attacker.attacking,this);
      attacker.interruptAction();
    }
    for(const target of this.attacking) removeFirst(target.attackedBy,this);
    this.attacking=[];this.attackedBy=[];
  }
  engageRetaliation() {
    const count=this.attackedBy.length;
    for(let i=0;i<count && this.attacking.length<this.attackLimit;i++) {
      const attacker=this.attackedBy[i];
      if(!this.attacking.includes(attacker)) this.linkTarget(attacker);
    }
  }
  engageNearby() {
    const enemies=typeof this.enemies==='function' ? this.enemies() : this.enemies;
    const count=enemies.length;
    for(let i=0;i<count && this.attacking.length<this.attackLimit;i++) {
      const candidate=enemies[i];
      if(candidate.hp>0 && !candidate.airUnit && candidate.attackedBy.length<candidate.attackedByLimit &&
        this.distanceTo(candidate)<22.5 && !this.attacking.includes(candidate) && !candidate.garrisoned()) {
        this.linkTarget(candidate);
      }
    }
  }
  chooseNextAction() {
    if(this.hp>0) {
      this.engageRetaliation();
      if(this.runner===0||this.world.armyOrders?.activeFor(this)&&this.world.armyOrders.frontlineAction(this)) this.engageNearby();
    }
    if(!(this.hp>0)) return this.transition(A.DIE);
    if(this.attacking.length>0) return this.transition(A.ATTACK);
    const order=this.world.armyOrders?.frontlineAction(this);
    if(order){const runner=this.runner,result=this.transition(order);this.runner=runner;return result;}
    const decision=decideFlagObjective(this,this.world);
    this.lastFlagDecision=decision;
    if(decision.clearRunner) this.runner=0;
    return this.transition(decision.action);
  }

  setAnimation(range,rate) {
    const [start,end]=FRAMES[range];
    this.animation={...this.animation,start,end,frame:start,rate};
  }
  setFlag(flag,status,holder,{ground=false}={}) {
    flag.status=status;
    if(ground) {flag.y=this.y;this.services.updateFlag?.(flag);}
    flag.holder=holder;
  }
  transition(action) {
    if(action===A.FEAR) return this.transition(A.RETREAT);
    this.lastAction=action;
    switch(action) {
      case A.ADVANCE:
      case A.RETREAT: {
        const direction=action===A.ADVANCE ? this.forward : -this.forward;
        const cadence=4/this.speedFactor;
        this.facing=direction;this.vx=direction*this.speed*this.speedFactor;
        this.actionMode='move';this.engaged=false;
        this.actionDuration=Math.abs(10*cadence/this.vx);
        this.setAnimation('move',Math.abs(this.vx/cadence));
        break;
      }
      case A.ATTACK:
        this.vx=0;this.actionMode='attack';this.actionDuration=48/this.speedFactor;
        this.setAnimation('attack',this.speedFactor/4);break;
      case A.BLOCK:
        this.vx=0;this.runner=0;this.engaged=false;this.actionMode='block';this.actionDuration=30;
        this.setAnimation('block',0);break;
      case A.PICKUP_FRIEND:
      case A.PICKUP_ENEMY: {
        const own=action===A.PICKUP_FRIEND;
        const fraction=own ? .4 : .5;
        this.speed=this.originalSpeed*fraction;this.actionMode=action;this.actionDuration=36;
        this.setAnimation('attack',fraction);
        this.setFlag(own?this.friendFlag:this.enemyFlag,own?S.HELD_BY_FRIEND:S.HELD_BY_ENEMY,this);
        if(own) {this.holdingFriendFlag=true;this.immunities.add('convert');}
        else this.holdingEnemyFlag=true;
        break;
      }
      case A.CAPTURE:
      case A.RETURN: {
        const own=action===A.RETURN;
        if(own) this.speed=this.originalSpeed;
        this.actionMode='capture_flag';this.actionDuration=36;this.setAnimation('attack',.25);
        if(own) this.holdingFriendFlag=false;
        else this.holdingEnemyFlag=false;
        this.setFlag(own?this.friendFlag:this.enemyFlag,own?S.AT_BASE:S.CAPTURED,null,{ground:true});
        this.services.stateChange?.(this);
        break;
      }
      case A.DIE:
        this.vx=0;this.immunities=new Set(DEAD_IMMUNITIES);this.actionMode='die';this.actionDuration=36;
        this.setAnimation('die',.25);this.unlinkEngagements();break;
      case A.ROT:
        this.vx=0;this.actionMode='rot';this.dead=true;this.actionDuration=100;
        this.setAnimation('rot',0);break;
      case A.KNOCKBACK:
        this.vx=0;this.actionMode='knock_back';this.actionDuration=11;
        this.setAnimation('knock_back',1);break;
      case A.DAZE:
        this.knockedDown=true;this.vx=0;this.actionMode='daze';this.actionDuration=240;
        this.setAnimation('daze',.1);break;
      case A.GET_UP:
        this.knockedDown=false;this.vx=0;this.actionMode='get_up_daze';this.actionDuration=96;
        this.setAnimation('get_up_daze',.125);break;
      case A.FLINCH:
        this.vx=0;this.actionMode='flinch';this.actionDuration=9;
        this.setAnimation('flinch',1);break;
      default: throw new RangeError(`Unimplemented flag troop action: ${action}`);
    }
    this.services.actionChanged?.(this,action);
    return action;
  }

  attackEngagementTarget() {
    const target=this.attacking[this.randomInteger(this.attacking.length)];
    // A world removal can empty the list while an interrupted attack is pending.
    // Do not fabricate a target or hit. Normal end-of-tick selection still runs.
    if(!target) {this.services.missingAttackTarget?.(this);return;}
    if(this.distanceTo(target)>45 || target.garrisoned()) {
      this.unlinkTarget(target);
      this.transition(A.ADVANCE);
      return;
    }
    const damageType=this.type==='grunt' ? 'slice' : 'blunt';
    const amount=meleeImpact({damage:this.damage,multiplier:target.multipliers[damageType],random:this.random});
    const request={source:this,target,amount,type:'armor',duration:10,frequency:9999};
    if(this.services.queueImpact) this.services.queueImpact(request);
    else this.pendingImpacts.push(request);
    this.facing=target.x>this.x ? 1 : -1;
    if(this.skill && target.isFighter && target.team==='bad') {
      const award=this.type==='grunt' ? this.randomInteger(3)>0 : this.randomInteger(2)===0;
      if(award) this.skill.addXP(Math.ceil(.1*amount));
    }
  }

  takeDamage(amount,{playSound=true,impactType='armor'}={}) {
    if(this.hp>0) {
      this.hp-=amount;
      if(!(this.hp>0)) {
        this.transition(A.DIE);this.hp=0;
        this.services.hitSound?.(this,impactType);
        this.services.deathSound?.(this,impactType);
        this.services.unitDeath?.(this);
      } else if(amount>0 && playSound) this.services.hitSound?.(this,impactType);
    }
    this.services.updateHealth?.(this,100*this.hp/this.maxHp);
  }
  checkGarrison() {
    if(this.garrisonBuilding!=null && !(this.garrisonBuilding.hp>0)) {
      const building=this.garrisonBuilding;
      this.visible=true;
      building.removeOccupant?.(this);
      this.garrisonBuilding=null;this.canGetHit=true;
      this.services.leftGarrison?.(this,building);
    }
  }
  doAction() {
    if(this.actionMode==='remove') {this.destroy();return;}
    if(!(this.actionDuration<0)) return;
    switch(this.actionMode) {
      case 'attack': this.attackEngagementTarget();break;
      case 'die': this.transition(A.ROT);break;
      case 'knock_back': this.transition(A.DAZE);break;
      case 'daze': this.transition(A.GET_UP);break;
      case 'rot': this.dead=true;break;
    }
  }
  animate() {
    this.animation.displayFrame=Math.floor(this.animation.frame);
    this.services.drawFrame?.(this,this.animation.displayFrame);
    this.animation.frame+=this.animation.rate*FLAG_GAME_SPEED;
    if(this.animation.frame>this.animation.end) this.animation.frame=this.animation.start;
  }
  step() {
    if(this.destroyed) return;
    recoverGroundPosition(this);
    if(this.hp>0) this.services.stepEffects?.(this);
    this.actionDuration-=FLAG_GAME_SPEED;
    this.checkGarrison();
    this.doAction();
    if(this.destroyed) return;
    this.animate();
    advanceGroundPosition(this);
    this.services.updateClip?.(this);
    this.services.updateRotation?.(this);
    if(this.actionDuration<0) {
      if(this.dead) this.destroy();
      else this.chooseNextAction();
    }
  }
  destroy() {
    if(this.destroyed) return;
    this.unlinkEngagements();
    this.services.removeUnit?.(this);
    this.services.removeClip?.(this);
    if(this.holdingFriendFlag) this.setFlag(this.friendFlag,S.GROUNDED,null,{ground:true});
    else if(this.holdingEnemyFlag) this.setFlag(this.enemyFlag,S.GROUNDED,null,{ground:true});
    this.services.stateChange?.(this);
    this.services.cleanup?.(this);
    this.destroyed=true;
  }
}
