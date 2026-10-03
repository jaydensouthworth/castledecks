/** Independently authored campaign specialists. Static behavioral contract and
 * renderer/runtime parity remains unverified.
 * No original code, artwork, animation or audio is required by these models.
 */
import {FlagTroop,FLAG_ACTION as A,FLAG_GAME_SPEED} from './flag-troop.mjs';
import {DIFFICULTY,meleeImpact} from './combat.mjs';
import {rangedAngles} from './ranged-troop.mjs';
import {recoverGroundPosition,advanceGroundPosition} from './ground-position.mjs';

const DEFAULT_MULTIPLIERS=Object.freeze({lightning:1,fire:1,ice:1,blunt:1,slice:1,pierce:1,flak:1,poison:1});
const DEAD_IMMUNITIES=['fire','ice','poison','fear','daze','regen','impact','heal','purge','convert'];
const live=value=>typeof value==='function'?value():value;
const garrisoned=target=>typeof target?.garrisoned==='function'?target.garrisoned():target?.garrisonBuilding!=null;
const isAir=target=>typeof target?.isAirUnit==='function'?target.isAirUnit():!!target?.airUnit;
const resistance=(target,element)=>target?.[`getMult${element[0].toUpperCase()}${element.slice(1)}`]?.()??target?.multipliers?.[element]??1;
const BASE_STATS=Object.freeze({air:{hp:100,speed:1,damage:35},dragon_scout_poison:{hp:100,speed:1,damage:35},
  dragon_scout_fire:{hp:100,speed:1,damage:35},dragon_scout_ice:{hp:100,speed:1,damage:35},
  fire_demon:{hp:300,speed:.25,damage:20},ice_demon:{hp:300,speed:.25,damage:20},gorath:{hp:10000,speed:3,damage:175}});

/** speed is the ordinary gameSpeed-scaled speed; Gorath's custom setVx stores
 * half this value in bossSpeed and starts with vx=0. Air starts with vx=speed.
 */
export function laterEnemyStats(type,{level=1,rank=null,difficulty='medium'}={}) {
  const base=BASE_STATS[type],factor=DIFFICULTY[difficulty];
  if(!base||!factor)throw new RangeError('Unknown later enemy or difficulty');
  const n=rank??level,growth=rank==null?.067:.335,speedGrowth=rank==null?.004:.02;
  return {maxHp:Math.ceil(base.hp*(1+growth*n)*factor.hp),
    speed:2*base.speed*(1+speedGrowth*n)*factor.speed,
    damage:base.damage*(1+growth*n)*factor.damage,rank:rank??Math.floor(level/5)};
}

/** Non-flag fighter state uses the already-tested common fighter primitives,
 * without pretending that aerial units or the boss have CTF objectives.
 */
class FreeFighter {
  constructor(options,type) {
    const {world,services={},random=Math.random,x=0,y=0,forward=-1,team=forward>0?'good':'bad',
      enemies=[],friends=[],skill=null}=options;
    if(typeof world?.elevationAt!=='function')throw new TypeError('Fighter requires terrain elevationAt');
    if(forward!==1&&forward!==-1)throw new RangeError('forward must be 1 or -1');
    const stats=options.stats??laterEnemyStats(type,options);
    for(const name of ['maxHp','speed','damage'])if(!Number.isFinite(stats[name])||stats[name]<0)
      throw new RangeError(`Invalid troop statistic: ${name}`);
    Object.assign(this,{type,world,services,random,x,y,forward,team,enemies,friends,skill,
      maxHp:stats.maxHp,hp:stats.maxHp,speed:stats.speed,originalSpeed:stats.speed,damage:stats.damage,
      rank:options.rank??stats.rank??Math.floor((options.level??1)/5),height:options.height,width:options.width,
      vx:0,vy:0,facing:1,rotation:0,speedFactor:1,runner:0,actionMode:'advance',actionDuration:0,
      lastAction:null,engaged:false,knockedDown:false,dead:false,destroyed:false,airUnit:false,
      isFighter:true,lifeType:'living',statType:'fighter',garrisonBuilding:null,visible:true,canGetHit:true,attackLimit:3,attackedByLimit:5});
    this.animation={start:1,end:1,frame:1,rate:0,displayFrame:1};
    this.attacking=[];this.attackedBy=[];this.immunities=new Set();
    this.multipliers={...DEFAULT_MULTIPLIERS};this.pendingImpacts=[];
  }
  get immunity(){return [...this.immunities].join(' ');}
  hasHP(){return this.hp>0;}
  getType(){return this.lifeType;}
  isPriest(){return false;}
  isAirUnit(){return this.airUnit;}
  injured(){return this.hp>0&&this.hp<this.maxHp;}
  holdingFlag(){return false;}
  garrisoned(){return this.garrisonBuilding!=null;}
  randomInteger(limit){return FlagTroop.prototype.randomInteger.call(this,limit);}
  distanceTo(target){return FlagTroop.prototype.distanceTo.call(this,target);}
  interruptAction(){this.actionDuration=0;}
  unlinkEngagements(){return FlagTroop.prototype.unlinkEngagements.call(this);}
  unlinkTarget(target){return FlagTroop.prototype.unlinkTarget.call(this,target);}
  takeDamage(amount,options){return FlagTroop.prototype.takeDamage.call(this,amount,options);}
  setAnimation(range,rate){return FlagTroop.prototype.setAnimation.call(this,range,rate);}
  animate(){return FlagTroop.prototype.animate.call(this);}
  inFront(target){return this.forward>0?target?.x>this.x:target?.x<this.x;}
  inRange(target,range){return Math.abs(this.x-target?.x)<range;}
  nearest(predicate=()=>true) {
    let chosen=null,best=9999;const list=live(this.enemies),count=list.length;
    for(let i=0;i<count;i++){const candidate=list[i],distance=Math.abs(this.x-candidate.x);
      if(distance<best&&predicate(candidate)){best=distance;chosen=candidate;}}
    return chosen;
  }
  getOwningStructure(){return this.garrisonBuilding??(this.team==='good'?this.world.goodCastle:this.world.badCastle)??null;}
  queueImpact(target,amount,duration=20) {
    const request={source:this,target,amount,type:'armor',duration,frequency:9999};
    if(this.services.queueImpact)this.services.queueImpact(request);else this.pendingImpacts.push(request);
    return request;
  }
  attackEngagementTarget() {
    const target=this.attacking[this.randomInteger(this.attacking.length)];
    if(!target){this.services.missingAttackTarget?.(this);return;}
    if(this.distanceTo(target)>45||garrisoned(target)){this.unlinkTarget(target);this.transition(A.ADVANCE);return;}
    this.queueImpact(target,this.damage);this.facing=target.x>this.x?1:-1;
    if(this.skill&&target.isFighter&&target.team==='bad')this.skill.addXP(1);
  }
  destroy() {
    if(this.destroyed)return;
    this.unlinkEngagements();this.services.removeUnit?.(this);
    if(this.airUnit)this.services.removeAirUnit?.(this);
    this.services.removeClip?.(this);this.services.stateChange?.(this);
    this.services.cleanup?.(this);this.destroyed=true;
  }
}

export class AirFighter extends FreeFighter {
  constructor(options={}) {
    super(options,'air');
    // CastleFighter consumes a runner roll before AirFighter discards its value.
    this.unusedRunnerRoll=this.randomInteger(2);this.actionMode='move';
    this.pickPatrolPoint();this.airUnit=true;this.healthTimer=0;
    this.multipliers.flak=4;this.statType='air_fighter';this.vx=this.speed;
    this.pendingProjectiles=[];
  }
  pickPatrolPoint(){this.targetX=100+this.randomInteger(1800);this.targetY=this.world.elevationAt(this.targetX)-350+this.randomInteger(100);}
  percentVariation(buckets){return 1+(this.randomInteger(buckets)-Math.ceil(buckets/2))/100;}
  transition(action) {
    if(action===A.BLOCK||action===A.DIE||action===A.ROT) {
      this.lastAction=action;this.actionMode=action;
      if(action===A.BLOCK){this.runner=0;this.engaged=false;this.actionDuration=30;this.setAnimation('block',0);}
      if(action===A.DIE){this.immunities=new Set(DEAD_IMMUNITIES);this.actionDuration=36;this.setAnimation('die',.25);this.unlinkEngagements();}
      if(action===A.ROT){this.dead=true;this.actionDuration=100;this.setAnimation('rot',0);}
      this.services.actionChanged?.(this,action);return action;
    }
    if(action===A.ATTACK){this.lastAction=action;this.vx=0;this.actionMode=action;this.actionDuration=36/this.speedFactor;
      this.setAnimation('attack',this.speedFactor/4);this.services.actionChanged?.(this,action);return action;}
    return FlagTroop.prototype.transition.call(this,action);
  }
  checkCrash() {
    const elevation=this.world.elevationAt(this.x);
    if(this.y>elevation){this.vy=0;this.hp=0;this.y=elevation;this.vx*=.95;return true;}
    return false;
  }
  updateVelocities() {
    if(this.hp/this.maxHp>.2){
      if(this.targetX>this.x&&this.vx<2)this.vx+=.05;
      else if(this.targetX<this.x&&this.vx> -2)this.vx-=.05;
      if(this.targetY>this.y&&this.vy<2)this.vy+=.02;
      else if(this.targetY<this.y&&this.vy> -2)this.vy-=.02;
      this.facing=this.vx>0?-1:1;
    }else{this.vy+=.1;this.checkCrash();}
  }
  chooseNextAction() {
    if(!(this.hp>0))return this.transition(A.DIE);
    if(Math.abs(this.targetX-this.x)<60){this.pickPatrolPoint();const target=this.nearest();if(target!=null)this.shootAtTarget(target);}
    return this.transition(A.BLOCK);
  }
  projectileAttributes(){return {kind:'standard_arrow',impactDamage:30};}
  shootAtTarget(target) {
    if(!Number.isFinite(target?.height))throw new TypeError('Aerial target requires measured hitbox height');
    const origin={x:this.x,y:this.y},power=20;
    const [angle]=(this.services.rangedAngles??rangedAngles)({...origin,targetX:target.x,targetY:target.y-target.height*.5,power,gravity:this.world.gravity??.3});
    let vx,vy;
    if(angle===777){vx=Math.sqrt(power*power*.5);vy=-vx;if(this.x>target.x)vx=-vx;}
    else{vx=Math.cos(angle)*power*this.percentVariation(20);vy=Math.sin(angle)*power*this.percentVariation(20);
      if(target.x-origin.x<0){vx=-vx;vy=-vy;}}
    const request={source:this,team:this.team,skill:this.skill,owningStructure:this.getOwningStructure(),target,...origin,vx,vy,
      ...this.projectileAttributes(),visual:this.team==='bad'?'enemy-arrow':'friendly-arrow',stickyVisual:this.team==='bad'?'enemy-sticky-arrow':'friendly-sticky-arrow'};
    if(this.services.queueProjectile)this.services.queueProjectile(request);else this.pendingProjectiles.push(request);
    return request;
  }
  doAction(){return FlagTroop.prototype.doAction.call(this);}
  step() {
    if(this.destroyed)return;
    if(this.hp>0)this.services.stepEffects?.(this);
    this.actionDuration--;this.updateVelocities();this.doAction();
    if(this.destroyed)return;
    this.animate();this.x+=this.vx;this.y+=this.vy;
    this.services.updateClip?.(this);this.services.updateRotation?.(this);
    if(this.actionDuration<0){if(this.dead)this.destroy();else this.chooseNextAction();}
  }
}

export class DragonScoutPoison extends AirFighter {
  constructor(options={}){super(options);this.type='dragon_scout_poison';this.multipliers={lightning:1,fire:1,ice:.1,blunt:.2,slice:.2,pierce:.2,flak:1,poison:.01};}
  // PoisonArrow.setRank runs after its impact setter and may overwrite 30.
  projectileAttributes(){return {kind:'poison_arrow',impactDamage:30,rank:this.rank};}
}
export class DragonScoutFire extends AirFighter {
  constructor(options={}){super(options);this.type='dragon_scout_fire';this.multipliers={lightning:.1,fire:.01,ice:4,blunt:.1,slice:.1,pierce:.1,flak:1,poison:.01};}
  projectileAttributes(){return {kind:'fire_arrow',rank:this.rank};}
}
export class DragonScoutIce extends AirFighter {
  constructor(options={}){super(options);this.type='dragon_scout_ice';this.multipliers={lightning:.1,fire:4,ice:.01,blunt:.1,slice:.1,pierce:.1,flak:1,poison:.01};}
  projectileAttributes(){return {kind:'ice_arrow',rank:this.rank};}
}

class FlagDemon extends FlagTroop {
  constructor(options,element) {
    const type=`${element}_demon`;
    super({...options,type:'grunt',stats:options.stats??laterEnemyStats(type,options)});
    this.type=type;this.element=element;this.statType='fighter';this.lifeType='living';this.vx=this.speed;this.facing=1;
    this.rank=options.rank??Math.floor((options.level??1)/5);this.height=options.height;this.width=options.width;
    this.multipliers={...DEFAULT_MULTIPLIERS,lightning:0,fire:element==='fire'?0:4,ice:element==='ice'?0:4,blunt:.1,slice:.1,pierce:.1,poison:0};
  }
  get immunity(){return [...this.immunities].join(' ');}
  getType(){return this.lifeType;}
  hasHP(){return this.hp>0;}
  injured(){return this.hp>0&&this.hp<this.maxHp;}
  isAirUnit(){return false;}
  isPriest(){return false;}
  attackEngagementTarget() {
    const target=this.attacking[this.randomInteger(this.attacking.length)];
    if(!target){this.services.missingAttackTarget?.(this);return;}
    if(this.distanceTo(target)>45||garrisoned(target)){this.unlinkTarget(target);this.transition(A.ADVANCE);return;}
    // Verified source quirk: BOTH demon variants consult fire resistance.
    const amount=meleeImpact({damage:this.damage,multiplier:resistance(target,'fire'),random:this.random});
    const request={source:this,target,amount,type:'armor',duration:10,frequency:9999};
    if(this.services.queueImpact)this.services.queueImpact(request);else this.pendingImpacts.push(request);
    this.facing=target.x>this.x?1:-1;
  }
  damageVisual(projectile,critical=false){this.services.damageVisual?.({source:this,projectile,element:this.element,x:projectile.x,y:projectile.y,amountMultiplier:critical?2:1});}
}
export class FlagFireDemon extends FlagDemon {constructor(options={}){super(options,'fire');}}
export class FlagIceDemon extends FlagDemon {constructor(options={}){super(options,'ice');}}

export const GORATH_ACTION=Object.freeze({LEFT_STEP:'left_step',HOLD_LEFT_STEP:'hold_left_step',RIGHT_STEP:'right_step',HOLD_RIGHT_STEP:'hold_right_step',
  PREP_ATTACK:'prep_attack',HOLD_UP_AXE:'hold_up_axe',AXE_ATTACK:'axe_attack',STUCK_DOWN:'stuck_down',WIGGLE:'wiggle',REST:'rest',
  WIPE_SWEAT:'wipe_sweat',FLING_SWEAT:'fling_sweat',HELM_ON_BEND_OVER:'helm_on_bend_over',RELOAD:'reload',KNOCK_BACK:'knock_back',
  RUB_HEAD:'rub_head',HEAD_TO_BELLY:'head_to_belly',REACH_OUT:'reach_out',REACH_BACK:'reach_back',GETUP:'getup',
  STOMP_IN_PLACE:'stomp_in_place',LOAD_SMASH:'load_smash',HOLD_LOADED_SMASH:'hold_loaded_smash',SMASH_DOWN:'smash_down',KILLED:'killed'});
const G=GORATH_ACTION;
// Each entry is [start,end,rate,optional explicit duration]. Frames are numeric
// timing identifiers for an independent renderer, not recovered animation art.
const GORATH_PHASES={left_step:[5,35,.6],hold_left_step:[35,35,0,300],right_step:[35,60,.6],hold_right_step:[5,5,0,300],
  prep_attack:[61,85,.5],hold_up_axe:[85,85,0,300],axe_attack:[85,96,.5],stuck_down:[96,108,.2],wiggle:[108,117,.2],
  reload:[117,132,.2],rest:[133,180,.2],wipe_sweat:[180,190,.2],fling_sweat:[190,215,.2],helm_on_bend_over:[215,245,.5],
  knock_back:[246,295,.5],rub_head:[295,305,.5],head_to_belly:[305,310,.5],reach_out:[310,315,.5],reach_back:[315,320,.5],
  getup:[321,390,.5],stomp_in_place:[421,433,1],load_smash:[434,450,.3],hold_loaded_smash:[450,450,0,200],smash_down:[450,470,1]};
const GORATH_NEXT={left_step:G.HOLD_LEFT_STEP,hold_left_step:G.RIGHT_STEP,right_step:G.HOLD_RIGHT_STEP,
  prep_attack:G.HOLD_UP_AXE,hold_up_axe:G.AXE_ATTACK,axe_attack:G.STUCK_DOWN,stuck_down:G.WIGGLE,wiggle:G.REST,
  rest:G.WIPE_SWEAT,wipe_sweat:G.FLING_SWEAT,fling_sweat:G.HELM_ON_BEND_OVER,helm_on_bend_over:G.RELOAD,reload:G.HOLD_RIGHT_STEP,
  knock_back:G.RUB_HEAD,rub_head:G.HEAD_TO_BELLY,head_to_belly:G.GETUP,getup:G.HELM_ON_BEND_OVER,
  load_smash:G.HOLD_LOADED_SMASH,hold_loaded_smash:G.SMASH_DOWN,smash_down:G.HOLD_RIGHT_STEP,stomp_in_place:G.HOLD_RIGHT_STEP};

export class TestBoss extends FreeFighter {
  constructor(options={}) {
    super(options,'gorath');this.actionMode=G.LEFT_STEP;this.attackTimer=300*FLAG_GAME_SPEED;
    this.axeLanded=false;this.stompedRight=false;this.stompedLeft=false;this.smashedDown=false;this.stompedInPlace=false;
    this.standing=true;this.bossSpeed=this.speed/2;this.pendingSpells=[];
    this.multipliers={...DEFAULT_MULTIPLIERS,fire:.5,ice:.5,lightning:.5,pierce:3.5,blunt:.1,slice:.5};
  }
  setVx(speed){this.bossSpeed=speed;}
  requestSpell(kind,x,y,extra={}) {
    const request={source:this,kind,x,y,...extra};
    if(this.services.queueSpell)this.services.queueSpell(request);else this.pendingSpells.push(request);
    return request;
  }
  transition(action) {
    if(action===A.DIE||action===G.KILLED){
      this.dead=true;this.vx=0;this.lastAction=A.DIE;this.actionMode=G.KILLED;
      const start=this.standing?391:410,end=420,rate=.5;
      this.animation={...this.animation,start,end,frame:start,rate};this.actionDuration=(end-start)/rate;
      this.services.actionChanged?.(this,A.DIE);return A.DIE;
    }
    if(action===G.KNOCK_BACK){
      if(!this.standing)return this.transition(G.RUB_HEAD);
      this.standing=false;
    }
    const phase=GORATH_PHASES[action];
    if(!phase){if([A.FLINCH,A.DAZE,A.FEAR].includes(action))return null;throw new RangeError(`Unimplemented Gorath action: ${action}`);}
    if(action===G.HOLD_LEFT_STEP&&!this.stompedLeft){this.stompedLeft=true;this.requestSpell('gorath_stomp',this.x-50,this.y);}
    if(action===G.HOLD_RIGHT_STEP&&!this.stompedRight){this.stompedRight=true;this.requestSpell('gorath_stomp',this.x-50,this.y);}
    if(action===G.LEFT_STEP)this.stompedLeft=false;
    if(action===G.RIGHT_STEP)this.stompedRight=false;
    if(action===G.STOMP_IN_PLACE)this.stompedInPlace=false;
    if(action===G.LOAD_SMASH)this.smashedDown=false;
    if(action===G.RELOAD)this.axeLanded=false;
    if(action===G.HELM_ON_BEND_OVER)this.standing=true;
    const [start,end,rate,duration]=(phase);
    this.lastAction=action;this.actionMode=action;this.vx=action===G.LEFT_STEP?-this.bossSpeed:action===G.RIGHT_STEP?-1.5*this.bossSpeed:0;
    this.animation={...this.animation,start,end,frame:start,rate};this.actionDuration=duration??(end-start)/rate;
    if(action===G.KNOCK_BACK)this.services.bossKnockdown?.(this);
    this.services.actionChanged?.(this,action);return action;
  }
  chooseNextAction() {
    const ground=this.nearest(target=>!isAir(target)),front=this.nearest(target=>!isAir(target)&&this.inFront(target));
    if(this.actionMode===G.HOLD_RIGHT_STEP){
      if(this.inRange(ground,50))return this.transition(G.LOAD_SMASH);
      if(this.inRange(front,100))return this.transition(G.STOMP_IN_PLACE);
      if(this.inRange(front,600)||this.x<600||(this.x<1500&&this.randomInteger(5)===0))return this.transition(G.PREP_ATTACK);
      return this.transition(G.LEFT_STEP);
    }
    const next=GORATH_NEXT[this.actionMode];return next?this.transition(next):null;
  }
  doAction() {
    if(this.actionMode===G.AXE_ATTACK&&this.actionDuration<10&&!this.axeLanded){this.axeLanded=true;this.requestSpell('gorath_shock_wave',this.x-190,this.y,{vx:-40});}
    else if(this.actionMode===G.STOMP_IN_PLACE&&this.actionDuration<1&&!this.stompedInPlace){this.stompedInPlace=true;this.requestSpell('gorath_stomp',this.x-50,this.y);}
    else if(this.actionMode===G.SMASH_DOWN&&this.actionDuration<10&&!this.smashedDown){this.smashedDown=true;this.requestSpell('gorath_stomp',this.x,this.y);}
  }
  animate() {
    this.animation.displayFrame=Math.floor(this.animation.frame);this.services.drawFrame?.(this,this.animation.displayFrame);
    if(this.animation.frame<this.animation.end)this.animation.frame+=this.animation.rate*FLAG_GAME_SPEED;
  }
  step() {
    if(this.destroyed)return;
    recoverGroundPosition(this);
    if(this.hp>0)this.services.stepEffects?.(this);
    this.actionDuration-=FLAG_GAME_SPEED;this.attackTimer-=FLAG_GAME_SPEED;
    this.doAction();this.animate();advanceGroundPosition(this);this.services.updateClip?.(this);
    if(this.actionDuration<0){if(this.dead)this.destroy();else this.chooseNextAction();}
  }
  /** hitTestRegion must test the CURRENT animation child's region at the
   * projectile tip. Root headbox and projectile midpoint are not consulted.
   */
  getReaction(projectile) {
    const hit=this.services.hitTestRegion;
    if(typeof hit!=='function')throw new TypeError('Gorath requires current animation-region hitTestRegion');
    const test=region=>hit(this,projectile,region,this.animation.displayFrame);
    const isBomb=()=>this.services.isBombArrow?.(projectile)??projectile.kind==='bomb_arrow';
    if(test('headbox')){if(isBomb()&&this.standing)this.transition(G.KNOCK_BACK);return 'destroy';}
    if(test('bellybox'))return 'destroy';
    if(test('feetbox')||test('armorbox')){
      if(isBomb()||['meteor','comet','fire_ball'].includes(projectile.kind))return 'destroy';
      this.services.armorRicochet?.(this,projectile);return 'deflect';
    }
    return 'no_reaction';
  }
  destroy() {
    if(this.destroyed)return;
    this.unlinkEngagements();this.services.removeUnit?.(this);this.services.removeClip?.(this);this.services.stateChange?.(this);
    this.services.bossCorpse?.({source:this,x:this.x,y:this.y,vx:0,vy:0,gx:0,gy:0,rotation:0,lifeSpan:160,animationDuration:160,animationRate:1,animationEnd:160});
    this.services.cleanup?.(this);this.destroyed=true;
  }
}
export {TestBoss as Gorath};
