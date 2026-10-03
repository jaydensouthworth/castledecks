/** Independently authored special-projectile mechanics. Numerical rules are
 * statically sourced; original art, sounds, bytecode and source are not used.
 * Original-runtime edge cases remain unverified.
 */
import {protectsFriendlySiegeStructure} from './siege-targeting.mjs';
import {Arrow,containsPoint,PHYSICS} from './ballistics.mjs';
import {ProjectileTargetCache} from './projectile-targets.mjs';
import {impactEffect,TimedEffect} from './effects.mjs';
import {createSupportEffect} from './ranged-troop.mjs';
import {protectsAlliedFlyer} from './attack-allegiance.mjs';

const alive=o=>typeof o?.hasHP==='function'?o.hasHP():o?.hp>0;
const hittable=o=>typeof o?.canGetHit==='function'?o.canGetHit():o?.canGetHit!==false;
const badFighter=o=>o?.isFighter&&(typeof o.isBad==='function'?o.isBad():o.team==='bad');
const multiplier=(target,type)=>target?.[`getMult${type[0].toUpperCase()}${type.slice(1)}`]?.()??target?.multipliers?.[type]??1;
const rngInt=(random,limit)=>{const value=random();if(!(value>=0&&value<1))throw new RangeError('RNG must return a value in [0,1)');return Math.floor(value*Math.trunc(limit));};
const emit=(object,name,...args)=>{
  if(typeof object.services?.[name]==='function')return object.services[name](...args);
  if(typeof object.world?.[name]==='function')return object.world[name](...args);
};
const hasService=(o,name)=>typeof o.services?.[name]==='function'||typeof o.world?.[name]==='function';
const ground=(world,x)=>world.elevationAt?.(x)??world.terrain?.elevationAt(x);
const maximum=(world,x)=>world.maxElevationAt?.(x)??world.terrain?.maxElevationAt(x);
const slopeAt=(world,x,context='Ground spell')=>{
  // An existing sampler may return undefined beyond its sampled range. Preserve
  // that value (and later NaN arithmetic), rather than clamping or trying again.
  if(typeof world.rotationAt==='function')return world.rotationAt(x);
  if(typeof world.terrain?.rotationAt==='function')return world.terrain.rotationAt(x);
  throw new TypeError(`${context} requires terrain rotationAt`);
};
const isStructure=(target,world)=>target?.isStructure===true||(world.structures??[]).includes(target);
function pointHit(object,target,point,region='hitbox') {
  if(protectsAlliedFlyer(object,target)||protectsFriendlySiegeStructure(object,target,object.world))return false;
  if(hasService(object,'hitTest'))return !!emit(object,'hitTest',target,point,region,object);
  const rect=typeof target?.[region]==='function'?target[region]():target?.[region];
  return !!rect&&containsPoint(rect,point);
}
function candidateWorld(world) {
  // Access live lists; these are intentionally not cached with the projectile.
  return {...world,maxElevationAt:x=>maximum(world,x),
    goodStructures:world.goodStructures??world.structures?.filter(o=>(o.occupiedBy??o.team)==='good'),
    badStructures:world.badStructures??world.structures?.filter(o=>(o.occupiedBy??o.team)==='bad'),
    neutralStructures:world.neutralStructures??world.structures?.filter(o=>['neutral','nobody'].includes(o.occupiedBy??o.team))};
}
function queueImpact(object,target,amount,{critical=false,type='blunt'}={}) {
  if(amount>=0&&protectsAlliedFlyer(object,target))return {status:'protected'};
  const request={source:object,target,amount,type,impactType:type,critical,duration:10,interval:9999,frequency:9999};
  object.impacts.push(request);
  if(hasService(object,'queueImpact'))return emit(object,'queueImpact',request);
  if(target.effects?.add)return target.effects.add(impactEffect({...request,random:object.random,
    onDamage:event=>emit(object,'onDamage',event),onReaction:(unit,reaction)=>{
      if(hasService(object,'onReaction'))emit(object,'onReaction',unit,reaction);
      else unit.transition?.(reaction);
    }}));
  return {status:'pending'};
}
function addSpell(object,spell) {
  if(hasService(object,'addSpell'))emit(object,'addSpell',spell);
  else if(object.world.spells?.add)object.world.spells.add(spell);
  else object.pendingSpells.push(spell);
  return spell;
}

/** SpellManager uses a forward, live-length loop. A spell removing itself makes
 * its immediate successor miss that manager update. Do not replace with filter.
 */
export class SpellList {
  constructor(){this.spells=[];}
  add(spell){this.spells.push(spell);spell.spellList=this;return spell;}
  remove(spell){const index=this.spells.indexOf(spell);if(index<0)return false;this.spells.splice(index,1);return true;}
  step(){for(let index=0;index<this.spells.length;index++)this.spells[index].step();}
}

/** A bomb is an independently scheduled spell, not an immediate radial hit. */
export class BombSpell {
  constructor({x,y,radius=100,maxDamage=100,charges=1,rank=0,skill=null,source=null,world={},services={},random=world.random??Math.random}={}) {
    Object.assign(this,{x,y,radius,maxDamage,charges,rank,skill,source,world,services,random});
    this.kind='bomb';this.timeToStrike=0;this.active=true;this.dead=false;this.impacts=[];this.strikes=0;
  }
  step(){
    if(this.dead)return;
    if(!(this.charges>0)){this.destroy();return;}
    this.timeToStrike-=PHYSICS.gameSpeed;
    if(!(this.timeToStrike>0))this.strike();
  }
  strike(){
    this.charges--;this.timeToStrike=20;this.strikes++;
    emit(this,'onVisual',{kind:'bomb-blast',source:this,x:this.x,y:this.y,width:this.radius*2,duration:52,animationRate:.5,animationEnd:26});
    this.testHitObjects(this.x,this.y);
    emit(this,'onSound',{kind:'bomb-impact',source:this});
  }
  testHitObjects(x,y){
    for(const key of ['airUnits','goodTeam','badTeam']) {
      // Re-read length and values to retain mutations and duplicates.
      for(let i=0;i<(this.world[key]?.length??0);i++) {
        const target=this.world[key][i];
        if(!hittable(target))continue;
        const dx=target.x-x,dy=target.y-y,distance=Math.sqrt(dx*dx+dy*dy);
        if(distance<this.radius)this.damage(target,distance);
      }
    }
  }
  damage(target,distance){
    if(protectsAlliedFlyer(this,target))return 0;
    const amount=(1-distance/this.radius)*this.maxDamage*multiplier(target,'blunt');
    queueImpact(this,target,amount);
    // Rewards use computed damage, even when the effect queue rejects the hit.
    if(this.skill!=null&&badFighter(target)){
      this.skill.addXP(Math.ceil(.1*amount));emit(this,'checkGreatestDamageDealt',amount);
    }
    return amount;
  }
  destroy(){
    if(this.dead)return;
    if(this.spellList)this.spellList.remove(this);else emit(this,'removeSpell',this);
    this.dead=true;this.active=false;
  }
}

class SpecialProjectile extends Arrow {
  constructor({world={},services={},random=world.random??Math.random,team,source=null,owner,
    skill=null,owningStructure=null,rank=0,impactDamage,addGoodTargets,addBadTargets,advanceOnSpawn=true,...motion}) {
    const teamAssigned=team!==undefined;team??='neutral';
    super({...motion,vx:advanceOnSpawn?motion.vx:0,vy:advanceOnSpawn?motion.vy:0,gravity:motion.gravity??world.gravity??PHYSICS.gravityPerTick});
    if(!advanceOnSpawn){this.vx=motion.vx??0;this.vy=motion.vy??0;}
    Object.assign(this,{world,services,random,team,source,owner,skill,owningStructure,rank,impactDamage,
      addGoodTargets:addGoodTargets??(teamAssigned?team!=='good':false),addBadTargets:addBadTargets??(teamAssigned?team!=='bad':false)});
    this.hostileOnly=source?.recruited===true;
    this.alpha=motion.alpha??100;
    this.targetCache=new ProjectileTargetCache();this.critical=false;this.deflections=0;this.smokeTimer=1;
    this.impacts=[];this.pendingSpells=[];this.pendingProjectiles=[];
  }
  setTeam(team){this.team=team;this.addGoodTargets=team!=='good';this.addBadTargets=team!=='bad';}
  step(){
    if(!this.active)return;
    this.tick++;this.flightUnits+=PHYSICS.gameSpeed;this.vy+=this.gravity;this.move();
    this.updateRotation();this.updateSmoke();this.draw={x:this.x,y:this.y,angle:this.angle};
    const targets=this.targetCache.update(this,candidateWorld(this.world));
    const hit=this.testHit(ground(this.world,this.x),targets);
    if(hit){emit(this,'onProjectileHit',{projectile:this,...hit});this.handleHit(hit);}
    if(this.active&&(this.x>2050||this.x< -50||this.y< -1000))this.destroy('out-of-bounds');
  }
  updateRotation(){this.angle=Math.atan2(this.vy,this.vx);}
  updateSmoke(){}
  testHit(elevation,targets){
    if(this.y>elevation)return {kind:'ground'};
    for(const target of targets)if(alive(target)&&(pointHit(this,target,this)||pointHit(this,target,this.midpoint)))return {kind:'target',target};
    return null;
  }
  handleHit(hit){this.react(hit.target??null);}
  reactionFor(target){
    if(target==null)return 'destroy';
    if(hasService(this,'getReaction'))return emit(this,'getReaction',this,target);
    if(typeof target.getReaction==='function')return target.getReaction(this);
    if(target.isFighter&&(pointHit(this,target,this,'headbox')||pointHit(this,target,this.midpoint,'headbox')))return 'critical';
    return 'destroy';
  }
  react(target){
    if(protectsAlliedFlyer(this,target))return;
    const reaction=this.reactionFor(target);
    if(reaction==='critical'){
      this.critical=true;this.impactDamage*=2;
      emit(this,'onVisual',{kind:'critical-marker',source:this,x:this.x,y:this.y,rotation:rngInt(this.random,360)});this.impact(target);
    }else if(reaction==='destroy')this.impact(target);
    else if(reaction==='deflect')this.deflect();
  }
  deflect(){
    if(!(this.deflections++<3)){this.destroy('fourth-deflection');return;}
    this.flightUnits=-20;const angle=rngInt(this.random,360)*Math.PI/180,speed=Math.sqrt(this.vx*this.vx+this.vy*this.vy)*.5;
    this.vx=Math.cos(angle)*speed;this.vy=Math.sin(angle)*speed;
    emit(this,'onVisual',{kind:'projectile-deflection',source:this,x:this.x,y:this.y});
  }
  destroy(reason='impact'){
    if(!this.active)return;this.active=false;this.reason=reason;emit(this,'removeObject',this);emit(this,'onProjectileDestroyed',this);
  }
}

export class TrebuchetAmmo extends SpecialProjectile {
  constructor(options={}){super(options);this.kind='trebuchet_ammo';this.flareLife=10;this.setRank(options.rank??0);}
  setRank(rank){const life=[10,12,14,16,18,22,26][rank];if(life!==undefined)this.flareLife=life;this.rank=rank;}
  updateRotation(){this.angle=0;}
  updateSmoke(){
    if(this.y> -10&&(this.smokeTimer-=PHYSICS.gameSpeed)<0){
      this.smokeTimer=0;
      // AVM1 evaluates the Y argument before X. Keep these draws even without art.
      const y=this.y+rngInt(this.random,4)-2,x=this.x+rngInt(this.random,4)-2;
      emit(this,'onVisual',{kind:'trebuchet-trail',source:this,x,y,duration:this.flareLife,animationRate:50/this.flareLife,animationEnd:50});
    }
  }
  testHit(elevation,targets){
    if(this.y>elevation+10)return {kind:'ground'};
    for(const target of targets)if(alive(target)&&pointHit(this,target,this))return {kind:'target',target};
    return null;
  }
  impact(target){
    if(protectsFriendlySiegeStructure(this,target,this.world))return;
    if(target!=null){
      const amount=multiplier(target,'blunt')*this.impactDamage;
      // Deliberately does not copy the projectile's critical flag to this effect.
      queueImpact(this,target,amount);
      if(this.skill!=null&&rngInt(this.random,3)===0)this.skill.addXP(Math.ceil(.1*amount));
      if(isStructure(target,this.world))this.bounceDebris(target,3,60);
    }
    addSpell(this,new BombSpell({x:this.x,y:this.y,radius:30+2*this.rank,maxDamage:30+2*this.rank,
      rank:this.rank,skill:this.skill,source:this,world:this.world,services:this.services,random:this.random}));
    this.destroy();
  }
  bounceDebris(target,count,spread){
    const request={target,projectile:this,count,spread};
    if(hasService(this,'bounceProjectileExplosion'))return emit(this,'bounceProjectileExplosion',request);
    if(typeof target.bounceProjectileExplosion==='function')return target.bounceProjectileExplosion(this,count,spread);
    return spawnStructureShrapnel(this,target,count,spread);
  }
}

export function createSpecialProjectile(request,options={}){
  const opts={...request,...options};
  if(request.kind==='trebuchet_ammo')return new TrebuchetAmmo(opts);
  if(request.kind==='bounce_arrow')return new BounceArrow(opts);
  if(request.kind==='bomb_arrow')return new BombArrow(opts);
  if(request.kind==='flak_arrow')return new FlakBombArrow(opts);
  if(request.kind==='fire_arrow')return new FireArrow(opts);
  if(request.kind==='ice_arrow')return new IceArrow(opts);
  if(request.kind==='pierce_arrow')return new PierceArrow(opts);
  if(request.kind==='poison_arrow')return new PoisonArrow(opts);
  if(request.kind==='fire_wave_arrow')return new FireWaveArrow(opts);
  if(request.kind==='ice_wave_arrow')return new IceWaveArrow(opts);
  if(request.kind==='bomb_wave_arrow')return new BombWaveArrow(opts);
  if(request.kind==='heal_wave_arrow')return new HealWaveArrow(opts);
  if(request.kind==='meteor_arrow')return new MeteorArrow(opts);
  if(request.kind==='comet_arrow')return new CometArrow(opts);
  if(request.kind==='meteor')return new Meteor(opts);
  if(request.kind==='comet')return new Comet(opts);
  if(request.kind==='fire_ball')return new FireBall(opts);
  if(request.kind==='ice_ball')return new IceBall(opts);
  if(request.kind==='sky_marker')return new SkyMarkerArrow(opts);
  if(request.kind==='thunder_arrow')return new ThunderArrow(opts);
  throw new RangeError(`Unsupported special projectile: ${request.kind}`);
}


/** Equivalent geometric construction preserving legacy unclamped acos and
 * coordinate-subtraction precision. The result is in unnormalized degrees.
 */
export function reflectionAngle(terrainDegrees,vx,vy) {
  const degrees=180/Math.PI,radians=Math.PI/180;
  const tangentX=Math.cos(terrainDegrees*radians)*100,tangentY=Math.sin(terrainDegrees*radians)*100;
  const center={x:tangentX+(-tangentX)/2,y:tangentY+(-tangentY)/2};
  const incoming={x:center.x-vx,y:center.y-vy};
  const angle= (-tangentX<0?0:180)+degrees*Math.atan((-tangentY)/(-tangentX));
  const normal={x:center.x+Math.cos((angle-90)*radians)*10,y:center.y+Math.sin((angle-90)*radians)*10};
  const between=(a,b)=>{
    const ax=a.x-center.x,ay=a.y-center.y,bx=b.x-center.x,by=b.y-center.y;
    return degrees*Math.acos((ax*bx+ay*by)/(Math.sqrt(ax*ax+ay*ay)*Math.sqrt(bx*bx+by*by)));
  };
  const incident=between({x:0,y:0},incoming),side=between(incoming,normal);
  return side>90?angle+incident:angle-incident;
}

/** Structure debris remains a damaging projectile, not a decorative particle. */
export class BounceArrow extends SpecialProjectile {
  constructor(options={}){
    super({...options,team:'neutral',addGoodTargets:true,addBadTargets:true});
    this.kind='bounce_arrow';this.bounceCount=0;this.bounceMax=options.bounceMax??5;
    this.xBounceFactor=options.xBounceFactor??.6;this.yBounceFactor=options.yBounceFactor??.6;
    this.styleVariant=options.styleVariant;
    this.impactDamage=options.impactDamage??(2+Math.ceil(this.rank*2));
  }
  updateRotation(){this.angle=0;}
  updateSmoke(){
    if(this.y> -10&&(this.smokeTimer-=PHYSICS.gameSpeed)<0){
      this.smokeTimer=2;const y=this.y+rngInt(this.random,12)-6,x=this.x+rngInt(this.random,12)-6;
      emit(this,'onVisual',{kind:'bounce-trail',source:this,x,y,duration:50,animationRate:1,animationEnd:50});
    }
  }
  handleHit(hit){
    if(hit.kind!=='ground'){this.react(hit.target);return;}
    if(this.bounceCount++<this.bounceMax)this.bounce();else this.react(null);
  }
  bounce(){
    const slope=slopeAt(this.world,this.x,'Bounce projectile');
    const direction=reflectionAngle(slope,this.vx,this.vy)*Math.PI/180,speed=Math.sqrt(this.vx*this.vx+this.vy*this.vy);
    this.vx=Math.cos(direction)*speed*this.xBounceFactor;
    this.vy=Math.sin(direction)*speed*this.yBounceFactor;
    this.y=ground(this.world,this.x);
    emit(this,'onVisual',{kind:'projectile-bounce',source:this,x:this.x,y:this.y});
  }
  impact(target){
    if(target!=null){
      this.impactDamage=30; // Even a preceding critical multiplication is replaced.
      const amount=Math.floor(multiplier(target,'blunt')*this.impactDamage);
      queueImpact(this,target,amount,{critical:this.critical});
      if(this.skill!=null)this.skill.addXP(1);
      if(this.owner!=null&&this.owner===this.world.hero)emit(this,'checkGreatestDamageDealt',amount);
    }
    this.destroy();
  }
}

export function spawnStructureShrapnel(projectile,target,count=3,spread=60) {
  const result=[];
  for(let i=0;i<count;i++){
    const styleVariant=rngInt(projectile.random,4);
    const vx=(rngInt(projectile.random,spread)-spread/2)*.05,vy=-rngInt(projectile.random,spread)*.1;
    const request={kind:'bounce_arrow',x:projectile.x,y:projectile.y,vx,vy,styleVariant,
      source:projectile,owner:target,team:'neutral',skill:projectile.skill,
      rank:projectile.skill?.getRank?.()??projectile.skill?.rank,bounceMax:3,xBounceFactor:.1,yBounceFactor:.1};
    result.push(request);
    if(hasService(projectile,'queueProjectile'))emit(projectile,'queueProjectile',request);
    else if(hasService(projectile,'addObject'))emit(projectile,'addObject',new BounceArrow({...request,
      world:projectile.world,services:projectile.services,random:projectile.random}));
    else projectile.pendingProjectiles.push(request);
  }
  return result;
}


/** Player bomb arrow rolls damage once when ranked, rather than per victim. */
export class BombArrow extends SpecialProjectile {
  constructor(options={}){super({...options,owner:options.owner??options.source});this.kind='bomb_arrow';this.setRank(options.rank??0);}
  setRank(rank){this.rank=rank;this.bombDamage=Math.floor((100+rngInt(this.random,50))*(1+rank/10));this.bombRadius=Math.floor(50*(1+rank/10));}
  updateSmoke(){
    if(this.y> -10&&(this.smokeTimer-=PHYSICS.gameSpeed)<0){
      this.smokeTimer=0;
      for(let i=0;i<2;i++){
        const styleVariant=rngInt(this.random,6)===5?1:0;
        const y=this.y+rngInt(this.random,8)-4,x=this.x+rngInt(this.random,8)-4;
        emit(this,'onVisual',{kind:'bomb-arrow-trail',source:this,x,y,styleVariant,duration:50,animationRate:1,animationEnd:50});
      }
    }
  }
  impact(target){
    if(target!=null){
      awardFlightBonus(this,target);
      const amount=multiplier(target,'blunt')*this.bombDamage;
      // Bomb damage is a separate field, unaffected by inherited critical state.
      emit(this,'onVisual',{kind:'direct-damage-message',source:this,x:this.x,y:this.y,amount});
      queueImpact(this,target,amount);
      if(this.skill!=null)this.skill.addXP(Math.ceil(.1*amount));
      if(isStructure(target,this.world))TrebuchetAmmo.prototype.bounceDebris.call(this,target,3,Math.min(140,Math.floor(100+.5*this.bombDamage)));
      if(this.owner!=null&&this.owner===this.world.hero)emit(this,'checkGreatestDamageDealt',amount);
    }
    addSpell(this,new BombSpell({x:this.x,y:this.y,radius:this.bombRadius,maxDamage:this.bombDamage,
      skill:this.skill,rank:this.rank,source:this,world:this.world,services:this.services,random:this.random}));
    this.destroy();
  }
}

export function awardFlightBonus(projectile,target) {
  if(!badFighter(target))return null;
  emit(projectile,'checkLongShot',projectile.flightUnits*.01515);
  if(projectile.flightUnits>300)projectile.flightUnits=300;
  const amount=Math.floor(projectile.flightUnits/300*30);
  if(hasService(projectile,'addProfileXP'))emit(projectile,'addProfileXP',amount);
  else projectile.world.profile?.addXP(amount);
  emit(projectile,'onVisual',{kind:'flight-xp-message',source:projectile,target,amount});
  return amount;
}

export class FlakBombSpell extends BombSpell {
  constructor(options={}){super(options);this.kind='flak_bomb';this.setRank(options.rank??0);}
  setRank(rank){this.rank=rank;this.maxDamage=Math.floor(40*(1+rank/10));this.radius=50;this.charges=3+Math.floor(rank*.3);}
  strike(){
    this.charges--;this.timeToStrike=15;this.strikes++;
    const x=this.x+rngInt(this.random,100)-50,y=this.y+rngInt(this.random,100)-50,rotation=rngInt(this.random,360);
    this.lastStrike={x,y};
    emit(this,'onVisual',{kind:'flak-blast',source:this,x,y,rotation,sizePercent:this.radius*.8,duration:100,animationRate:1,animationEnd:100});
    this.testHitObjects(x,y);emit(this,'onSound',{kind:'flak-impact',source:this});
  }
  testHitObjects(x,y){
    for(const key of ['airUnits','goodTeam','badTeam'])for(let i=0;i<(this.world[key]?.length??0);i++){
      const target=this.world[key][i];if(!hittable(target))continue;
      const dx=target.x-x,dy=target.y-y,distance=Math.sqrt(dx*dx+dy*dy);
      if(distance<this.radius)this.damage(target,distance);
      else if(pointHit(this,target,{x,y}))this.damage(target,0);
    }
  }
  damage(target,distance){
    if(protectsAlliedFlyer(this,target))return 0;
    const amount=(1-distance/this.radius)*this.maxDamage*multiplier(target,'flak');
    queueImpact(this,target,amount); // Source uses ImpactEffect's default blunt sound.
    if(this.skill!=null&&badFighter(target)){
      this.skill.addXP(Math.ceil(.1*amount));emit(this,'checkGreatestDamageDealt',amount);
    }
    return amount;
  }
}

/** Manual activation only. Contact with a unit does not detonate a flak arrow. */
export class FlakBombArrow extends SpecialProjectile {
  constructor(options={}){super({...options,owner:options.owner??options.source});this.kind='flak_arrow';this.impactDamage=options.impactDamage??(2+Math.ceil(this.rank*2));}
  testHit(elevation){return this.y>elevation+10?{kind:'ground'}:null;}
  handleHit(){emit(this,'removeActivationObject',this);this.destroy('ground');}
  // Source has no alive guard: a stale out-of-bounds activation entry can fire.
  activate(){this.react(null);}
  impact(){
    addSpell(this,new FlakBombSpell({x:this.x,y:this.y,rank:this.rank,skill:this.skill,source:this,
      world:this.world,services:this.services,random:this.random}));
    this.destroy('activated');
  }
}

const variation=(random,buckets)=>1+(rngInt(random,buckets)-Math.ceil(buckets/2))/100;
const setSpeed=(target,amount)=>typeof target.setSpeedFactor==='function'?target.setSpeedFactor(amount):target.speedFactor=amount;
const goodFighter=target=>target?.isFighter&&(typeof target.isGood==='function'?target.isGood():target.team==='good');

/** Status effects use target-local timers. Ice cleanup intentionally resets the
 * shared scalar, rather than composing active slow factors. */
export function createStatusEffect({kind,target,duration,interval=20,slowFactor=.5,damage=5,sickness=10},
  {random=Math.random,onHeal=()=>{}}={}) {
  if(kind==='heal')return createSupportEffect({kind,target,duration,interval,amount:damage},{random,onHeal});
  if(kind==='ice')return new TimedEffect({kind,target,duration,interval,
    perform:()=>setSpeed(target,slowFactor),cleanup:()=>setSpeed(target,1)});
  if(kind==='fire')return new TimedEffect({kind,target,duration,interval,
    perform:()=>target.takeDamage(Math.floor(multiplier(target,'fire')*damage),{playSound:false,impactType:'no_sound'})});
  if(kind==='fear'||kind==='daze')return new TimedEffect({kind,target,duration,interval,perform:()=>{
    if(!target.isFighter)return;const method=kind==='fear'?'setActionFear':'setActionDaze';
    if(typeof target[method]==='function')target[method]();else target.transition?.(kind);
  }});
  if(kind==='poison'){
    const effect=new TimedEffect({kind,target,duration,interval,perform:self=>{
      target.takeDamage(rngInt(random,self.sickness),{playSound:false});self.sickness=Math.floor(self.sickness*1.5);
    }});effect.sickness=sickness;return effect;
  }
  throw new RangeError(`Unsupported projectile status effect: ${kind}`);
}
function queueStatus(source,request) {
  if(request.kind!=='heal'&&protectsAlliedFlyer(source,request.target))return {status:'protected'};
  const full={source,...request};(source.statusEffects??=[]).push(full);
  const effect=createStatusEffect(full,{random:source.random,onHeal:e=>emit(source,'onHeal',e)});
  if(hasService(source,'queueStatusEffect'))return emit(source,'queueStatusEffect',{...full,effect});
  if(full.target.effects?.add)return full.target.effects.add(effect);
  return {status:'pending',effect};
}
function registerReactive(source,element) {
  (source.reactiveObjects??=[]).push(element);
  if(hasService(source,'addObject'))emit(source,'addObject',element);
  else if(source.world.objects?.add)source.world.objects.add(element);
  else (source.pendingObjects??=[]).push(element);
  if(hasService(source,'addReactiveElement'))emit(source,'addReactiveElement',element);
  else (source.world.reactiveElements??=[]).push(element);
  emit(source,'onVisual',{kind:'reactive-created',element:element.element,source:element,x:element.x,y:element.y});
  return element;
}
const REACTIVE_LOCAL=Object.freeze({
  fire:Object.freeze([-13.3,13.544488050556,-24.1,4.828314208984]),
  ice:Object.freeze([-14.85,16.107278311718,-29.3,4.059558105469])
});
const rectOverlap=(a,b)=>a.x<=b.x+b.width&&a.x+a.width>=b.x&&a.y<=b.y+b.height&&a.y+a.height>=b.y;

export class ReactiveElement {
  constructor({element,x,y,source=null,world={},services={},random=world.random??Math.random,damage=1,damageTeam=null}){
    if(!REACTIVE_LOCAL[element])throw new RangeError('Reactive element must be fire or ice');
    Object.assign(this,{element,x,y,source,world,services,random,damageTeam});this.kind=`reactive_${element}`;this.damage=Math.floor(damage);
    this.active=true;this.dying=false;this.waitTime=33;this.actionDuration=0;this.pulseCount=0;this.maxPulses=10;
    this.stuckTo=null;this.wasAttached=false;this.offset={x:0,y:0};this.draw={x,y,angle:0};this.impacts=[];
    this.animation={start:1,end:11,frame:1,rate:1,displayFrame:1};this.targets=[];
    // A snapshot at construction; no refresh when units enter or leave range.
    for(const key of ['goodTeam','badTeam','structures'])for(const target of this.world[key]??[])
      if(hittable(target)&&!protectsAlliedFlyer(this,target)&&(!damageTeam||(target.occupiedBy??target.team)!==damageTeam)&&Math.abs(target.x-this.x)<300)this.targets.push(target);
  }
  get hitbox(){const [left,right,top,bottom]=REACTIVE_LOCAL[this.element];return {x:this.draw.x+left,y:this.draw.y+top,width:right-left,height:bottom-top};}
  setDamage(amount){this.damage=Math.floor(amount);}
  attach(target){this.stuckTo=target;this.wasAttached=true;this.offset={x:this.x-target.x,y:this.y-target.y};}
  animate(){const a=this.animation;a.displayFrame=Math.floor(a.frame);a.frame+=a.rate*PHYSICS.gameSpeed;if(a.frame>a.end)a.frame=a.start;}
  step(){
    if(!this.active)return;
    this.animate();
    if(!this.dying){
      if(this.stuckTo!=null){this.x=this.stuckTo.x+this.offset.x;this.y=this.stuckTo.y+this.offset.y;}
      this.actionDuration-=PHYSICS.gameSpeed;
      if(!(this.actionDuration>0)){this.actionDuration=this.waitTime;this.pulse();}
    }else{
      this.actionDuration-=PHYSICS.gameSpeed;if(!(this.actionDuration>0))this.destroy();
    }
    // Reaction overlap used the previous drawn poses earlier in this update.
    this.draw={x:this.x,y:this.y,angle:0};emit(this,'onReactiveUpdated',this);
  }
  pulse(){
    const attachedDead=this.wasAttached&&(typeof this.stuckTo?.isDead==='function'?this.stuckTo.isDead():!alive(this.stuckTo));
    if(attachedDead||!(this.pulseCount++<this.maxPulses)){this.kill();return;}
    for(const target of this.targets)if(target!==this.stuckTo&&pointHit(this,target,this))this.damageTarget(target);
    if(this.stuckTo!=null)this.damageTarget(this.stuckTo);
    this.reactToElements();
  }
  damageTarget(target){if(protectsAlliedFlyer(this,target)||(this.damageTeam&&(target.occupiedBy??target.team)===this.damageTeam))return;return queueImpact(this,target,this.damage*multiplier(target,this.element)*variation(this.random,50));}
  reactToElements(){
    for(const other of this.world.reactiveElements??[]){
      if(other===this||other.dying)continue;
      const overlapping=hasService(this,'overlapReactiveElements')?emit(this,'overlapReactiveElements',this,other):rectOverlap(this.hitbox,other.hitbox);
      if(overlapping&&other.element!==this.element&&(other.element==='fire'||other.element==='ice')){
        other.kill();this.kill();return true;
      }
    }
    return false;
  }
  kill(){this.dying=true;this.actionDuration=this.waitTime;this.animation={start:12,end:20,frame:12,rate:8/this.waitTime,displayFrame:this.animation.displayFrame};emit(this,'onVisual',{kind:'reactive-dying',source:this,x:this.x,y:this.y});}
  destroy(){
    if(!this.active)return;this.active=false;
    if(hasService(this,'removeObject'))emit(this,'removeObject',this);else this.world.objects?.remove?.(this);
    if(hasService(this,'removeReactiveElement'))emit(this,'removeReactiveElement',this);
    else {const list=this.world.reactiveElements??[],i=list.indexOf(this);if(i>=0)list.splice(i,1);}
    emit(this,'onReactiveDestroyed',this);
  }
}

class TracerArrow extends SpecialProjectile {
  constructor(options){super({...options,owner:options.owner??(options.source===options.world?.hero?options.source:undefined)});}
  updateSmoke(){
    const dx=this.x-this.previous.x,dy=this.y-this.previous.y;
    emit(this,'onVisual',{kind:`${this.kind}-tracer`,source:this,x:this.x,y:this.y,angle:this.angle,width:Math.sqrt(dx*dx+dy*dy),duration:25,animationRate:2,animationEnd:50});
  }
  handleHit(hit){
    if(hit.kind==='ground')emit(this,'onVisual',{kind:'ground-sticky-arrow',source:this,x:this.x,y:this.y,angle:this.angle,duration:200});
    super.handleHit(hit);
  }
}
export class FireArrow extends TracerArrow {
  constructor(options={}){super(options);this.kind='fire_arrow';this.setRank(options.rank??0);}
  setRank(rank){this.rank=rank;this.impactDamage=Math.floor(75*(1+rank/10));}
  impact(target){
    const fire=registerReactive(this,new ReactiveElement({element:'fire',source:this,x:this.x,y:this.y,world:this.world,services:this.services,random:this.random,damageTeam:this.hostileOnly?this.team:null}));
    fire.setDamage(this.impactDamage/10);emit(this,'onSound',{kind:'fire-impact',source:this});
    if(target!=null){
      awardFlightBonus(this,target);const amount=this.impactDamage*multiplier(target,'fire')*variation(this.random,20);
      queueImpact(this,target,amount);if(this.skill!=null)this.skill.addXP(Math.ceil(.1*amount));fire.attach(target);
      if(this.owner!=null&&this.owner===this.world.hero)emit(this,'checkGreatestDamageDealt',amount);
    }
    this.destroy();
  }
}
export class IceArrow extends TracerArrow {
  constructor(options={}){super(options);this.kind='ice_arrow';this.setRank(options.rank??0);}
  setRank(rank){this.rank=rank;this.impactDamage=Math.floor(75*(1+rank/10));this.frostDuration=500+rank*200;this.slowFactor=1/(1.7+.4*rank);}
  impact(target){
    const ice=registerReactive(this,new ReactiveElement({element:'ice',source:this,x:this.x,y:this.y,world:this.world,services:this.services,random:this.random,damageTeam:this.hostileOnly?this.team:null}));
    emit(this,'onSound',{kind:'ice-impact',source:this});
    if(target!=null){
      const amount=multiplier(target,'ice')*this.impactDamage;queueImpact(this,target,amount);
      queueStatus(this,{kind:'ice',target,duration:this.frostDuration,interval:20,slowFactor:this.slowFactor});
      if(this.skill!=null)this.skill.addXP(Math.ceil(.1*amount));ice.attach(target);ice.setDamage(this.impactDamage/10);
      if(this.owner!=null&&this.owner===this.world.hero)emit(this,'checkGreatestDamageDealt',amount);
    }
    this.destroy();
  }
}
export class PierceArrow extends TracerArrow {
  constructor(options={}){super(options);this.kind='pierce_arrow';this.setRank(options.rank??0);}
  setRank(rank){this.rank=rank;this.impactDamage=50+rank*5;this.momentum=99;}
  handleHit(hit){
    if(hit.kind==='ground'){
      emit(this,'onVisual',{kind:'ground-sticky-arrow',source:this,x:this.x,y:this.y,angle:this.angle,duration:700});
      this.momentum=0;this.react(null);
    }else this.react(hit.target);
  }
  impact(target){
    if(target!=null){
      if(isStructure(target,this.world))this.momentum=0;
      else{
        const amount=Math.floor(multiplier(target,'pierce')*this.impactDamage*variation(this.random,50));
        queueImpact(this,target,amount);this.momentum--;
        if(this.skill!=null){this.skill.addXP(Math.ceil(.1*amount));emit(this,'checkGreatestDamageDealt',amount);}
      }
    }
    if(!(this.momentum>0)){
      if(target!=null)emit(this,'onVisual',{kind:'target-sticky-arrow',source:this,target,x:this.x,y:this.y,angle:this.angle});
      this.destroy();
    }
  }
}

export class GroundWaveSpell extends BombSpell {
  constructor({element,vx=0,team,...options}={}){
    if(!['fire','ice','bomb','heal'].includes(element))throw new RangeError('Unknown wave element');
    super(options);Object.assign(this,{element,vx,team});this.kind=`${element}_wave`;
    this.maxCharges=element==='fire'?7:5;this.waitTime=5;this.radius=25;this.setRank(options.rank??0);
  }
  setRank(rank){
    this.rank=rank;this.charges=this.maxCharges;
    if(this.element==='fire')this.impactDamage=Math.floor(55*(1+rank/10));
    else if(this.element==='ice'){
      this.impactDamage=Math.floor(55*(1+rank/6));this.frostDuration=500+200*rank;this.slowFactor=1/(1.5+.3*rank);
    }else if(this.element==='bomb')this.maxDamage=Math.floor(55*(1+rank/6));
    else this.maxHeal=Math.floor(75*(1+rank/10));
  }
  step(){
    if(this.dead)return;
    if(this.charges<0){this.destroy();return;}
    this.timeToStrike-=PHYSICS.gameSpeed;
    if(this.timeToStrike<0)this.strike();
  }
  strike(){
    this.timeToStrike=this.waitTime;this.charges--;this.strikes++;
    if(this.element==='fire')emit(this,'onSound',{kind:'fire-wave',source:this});
    this.y=ground(this.world,this.x);
    emit(this,'onVisual',{kind:`${this.element}-wave`,source:this,x:this.x,y:this.y,duration:40,animationRate:1,animationEnd:40});
    this.testHitObjects(this.x,this.y);this.x+=this.vx;
    if(this.element==='bomb')emit(this,'onSound',{kind:'bomb-wave',source:this});
  }
  testHitObjects(x,y){
    if(this.element==='fire'||this.element==='ice'){
      const selected=[],keys=this.element==='fire'?['airUnits','goodTeam','badTeam']:['goodTeam','badTeam'];
      for(const key of keys)for(let i=0;i<(this.world[key]?.length??0);i++){
        const target=this.world[key][i];
        if(hittable(target)&&!protectsAlliedFlyer(this,target)&&target.x<x+25&&target.x>x-25&&target.y>y-75)selected.push(target);
      }
      for(const target of selected){
        // Ice rechecks eligibility after collecting; Fire does not.
        if(this.element==='ice'&&!hittable(target))continue;
        const amount=Math.floor(this.impactDamage*multiplier(target,this.element));queueImpact(this,target,amount);
        if(this.element==='ice')queueStatus(this,{kind:'ice',target,duration:this.frostDuration,interval:20,slowFactor:this.slowFactor});
        this.reward(target,amount);
      }
    }else{
      const keys=this.element==='heal'?(this.team==='good'?['goodTeam']:this.team==='bad'?['badTeam']:[]):['airUnits','goodTeam','badTeam'];
      // Heal's source routine reads its own coordinates rather than its args.
      if(this.element==='heal'){x=this.x;y=this.y;}
      for(const key of keys)for(let i=0;i<(this.world[key]?.length??0);i++){
        const target=this.world[key][i];if(!hittable(target)||(this.element!=='heal'&&protectsAlliedFlyer(this,target)))continue;
        const dx=target.x-x,dy=target.y-y,distance=Math.sqrt(dx*dx+dy*dy);
        if(distance<25){
          if(this.element==='heal'){
            const amount=(1-distance/25)*this.maxHeal;
            queueStatus(this,{kind:'heal',target,duration:10,interval:9999,damage:amount});
            if(this.skill!=null&&goodFighter(target))this.skill.addXP(Math.ceil(.1*amount));
          }else{
            const amount=(1-distance/25)*this.maxDamage*multiplier(target,'blunt');queueImpact(this,target,amount);this.reward(target,amount);
          }
        }
      }
    }
  }
  reward(target,amount){if(this.skill!=null&&badFighter(target)){this.skill.addXP(Math.ceil(.1*amount));emit(this,'checkGreatestDamageDealt',amount);}}
}
export class FireWaveSpell extends GroundWaveSpell {constructor(options={}){super({...options,element:'fire'});}}
export class IceWaveSpell extends GroundWaveSpell {constructor(options={}){super({...options,element:'ice'});}}
export class BombWaveSpell extends GroundWaveSpell {constructor(options={}){super({...options,element:'bomb'});}}
export class HealWaveSpell extends GroundWaveSpell {constructor(options={}){super({...options,element:'heal'});}}

export class WaveArrow extends SpecialProjectile {
  constructor({element,...options}={}){
    super({...options,owner:options.owner??(options.source===options.world?.hero?options.source:undefined)});
    if(!['fire','ice','bomb','heal'].includes(element))throw new RangeError('Unknown wave arrow element');
    this.element=element;this.kind=`${element}_wave_arrow`;this.impactDamage=options.impactDamage??(2+Math.ceil(this.rank*2));
  }
  updateSmoke(){
    if(this.y> -10&&(this.smokeTimer-=PHYSICS.gameSpeed)<0){
      this.smokeTimer=0;
      const angle=this.element==='heal'?rngInt(this.random,360)*Math.PI/180:this.angle;
      emit(this,'onVisual',{kind:`${this.element}-wave-trail`,source:this,x:this.x,y:this.y,angle,duration:20,animationDuration:100,animationRate:5});
    }
  }
  testHit(elevation,targets){return TrebuchetAmmo.prototype.testHit.call(this,elevation,targets);}
  handleHit(hit){if(hit.kind==='ground')this.impact(null);else this.react(hit.target);}
  impact(){
    if(this.element==='ice')emit(this,'onSound',{kind:'ice-impact',source:this});
    addSpell(this,new GroundWaveSpell({element:this.element,x:this.x,y:this.y,vx:this.vx*1.5,
      team:this.element==='heal'?this.team:undefined,skill:this.skill,rank:this.rank,source:this,
      world:this.world,services:this.services,random:this.random}));this.destroy();
  }
}
export class FireWaveArrow extends WaveArrow {constructor(options={}){super({...options,element:'fire'});}}
export class IceWaveArrow extends WaveArrow {constructor(options={}){super({...options,element:'ice'});}}
export class BombWaveArrow extends WaveArrow {constructor(options={}){super({...options,element:'bomb'});}}
export class HealWaveArrow extends WaveArrow {constructor(options={}){super({...options,element:'heal'});}}

export class PoisonArrow extends SpecialProjectile {
  constructor(options={}){super(options);this.kind='poison_arrow';this.setRank(options.rank??0);}
  setRank(rank){this.rank=rank;this.impactDamage=Math.floor(30*(1+rank/10));this.poisonDuration=165+Math.floor(33*rank);}
  updateSmoke(){
    if(this.y> -10&&(this.smokeTimer-=PHYSICS.gameSpeed)<0){this.smokeTimer=1;
      emit(this,'onVisual',{kind:'poison-trail',source:this,x:this.x,y:this.y,angle:0,duration:25,animationRate:2,animationEnd:50});}
  }
  handleHit(hit){
    if(hit.kind==='ground')emit(this,'onVisual',{kind:'ground-sticky-arrow',source:this,x:this.x,y:this.y,angle:this.angle,duration:200});
    super.handleHit(hit);
  }
  impact(target){
    if(target!=null){
      const amount=Math.floor(multiplier(target,'pierce')*this.impactDamage);queueImpact(this,target,amount,{critical:this.critical});
      queueStatus(this,{kind:'poison',target,duration:this.poisonDuration,interval:15,sickness:Math.floor(this.impactDamage*.5)});
      emit(this,'onVisual',{kind:'target-sticky-arrow',source:this,target,x:this.x,y:this.y,angle:this.angle});
      if(this.skill!=null&&rngInt(this.random,3)>0)this.skill.addXP(Math.ceil(.1*amount));
      if(this.owner!=null&&this.owner===this.world.hero)emit(this,'checkGreatestDamageDealt',amount);
    }
    this.destroy();
  }
}

function queueChildProjectile(source,request){
  (source.projectileRequests??=[]).push(request);
  if(hasService(source,'queueProjectile'))return emit(source,'queueProjectile',request);
  if(hasService(source,'addObject')||source.world.objects?.add){
    const child=createSpecialProjectile(request,{world:source.world,services:source.services,random:source.random});
    if(hasService(source,'addObject'))emit(source,'addObject',child);else source.world.objects.add(child);
    return child;
  }
  (source.pendingProjectiles??=[]).push(request);return null;
}
function visitBlastTargets(source,radius,perform){
  for(const key of ['airUnits','goodTeam','badTeam'])for(let i=0;i<(source.world[key]?.length??0);i++){
    const target=source.world[key][i];if(!hittable(target)||protectsAlliedFlyer(source,target))continue;
    const dx=target.x-source.x,dy=target.y-source.y,distance=Math.sqrt(dx*dx+dy*dy);
    if(distance<radius)perform(target,distance,radius);
  }
}
const neutralUntouched=options=>({addGoodTargets:false,addBadTargets:false,...options});

/** The upward meteor marker is a real StandardArrow with default-neutral
 * target flags. It can collide with structures and upper-region air units. */
export class SkyMarkerArrow extends SpecialProjectile {
  constructor(options={}){super(neutralUntouched(options));this.kind='sky_marker';this.impactDamage=2+Math.ceil(this.rank*2);}
  handleHit(hit){
    if(hit.kind==='ground')emit(this,'onVisual',{kind:'ground-sticky-arrow',source:this,x:this.x,y:this.y,angle:this.angle,duration:200});
    super.handleHit(hit);
  }
  impact(target){
    if(target!=null){
      const amount=Math.floor(multiplier(target,'pierce')*this.impactDamage);queueImpact(this,target,amount,{critical:this.critical});
      emit(this,'onVisual',{kind:'target-sticky-arrow',source:this,target,x:this.x,y:this.y,angle:this.angle});
      if(this.skill!=null&&rngInt(this.random,3)===0)this.skill.addXP(Math.ceil(.1*amount));
    }
    this.destroy();
  }
}

export class SkyCarrierArrow extends SpecialProjectile {
  constructor({element,...options}={}){
    super({...options,owner:options.owner??(options.source===options.world?.hero?options.source:undefined)});
    if(element!=='meteor'&&element!=='comet')throw new RangeError('Unknown sky carrier');
    this.element=element;this.kind=`${element}_arrow`;this.impactDamage=2+Math.ceil(this.rank*2);
  }
  updateSmoke(){
    if((this.element==='meteor'||this.y> -10)&&(this.smokeTimer-=2)<0){
      this.smokeTimer=0;const angle=this.element==='meteor'?rngInt(this.random,360)*Math.PI/180:this.angle;
      emit(this,'onVisual',{kind:`${this.element}-carrier-trail`,source:this,x:this.x,y:this.y,angle,duration:20,animationDuration:100,animationRate:5});
    }
  }
  testHit(elevation){return this.y>elevation?{kind:'ground'}:null;}
  handleHit(){if(this.element==='meteor')this.impact();else this.react(null);}
  impact(){
    const elevation=ground(this.world,this.x);
    addSpell(this,new SkyFallSpell({element:this.element,x:this.x,y:this.y,rank:this.rank,skill:this.skill,source:this,world:this.world,services:this.services,random:this.random}));
    if(this.element==='comet')emit(this,'onSound',{kind:'ice-impact',source:this});
    emit(this,'onVisual',{kind:`${this.element}-signal`,source:this,x:this.x,y:elevation,duration:20,animationRate:1,animationEnd:20});
    queueChildProjectile(this,{kind:this.element==='meteor'?'sky_marker':'ice_arrow',x:this.x,y:elevation-10,vx:.1,vy:-50,
      skill:this.skill,rank:this.rank,source:this,alpha:20,addGoodTargets:false,addBadTargets:false});
    this.destroy();
  }
}
export class MeteorArrow extends SkyCarrierArrow {constructor(options={}){super({...options,element:'meteor'});}}
export class CometArrow extends SkyCarrierArrow {constructor(options={}){super({...options,element:'comet'});}}

/** The carrier point is a target for a delayed independent falling object. */
export class SkyFallSpell extends BombSpell {
  constructor({element,...options}={}){
    super(options);if(element!=='meteor'&&element!=='comet')throw new RangeError('Unknown falling spell');
    this.element=element;this.kind=`${element}_fall`;this.timeToStrike=50;this.duration=0;this.setRank(options.rank??0);
  }
  setRank(rank){this.rank=rank;this.charges=1;if(this.element==='meteor'){this.maxDamage=Math.floor(100*(1+rank/10));this.radius=150*(1+.05*rank);}}
  step(){
    if(this.dead)return;
    if(!(this.charges>0))this.destroy();
    else{
      this.timeToStrike-=2;
      if(this.timeToStrike<0){
        this.charges--;this.timeToStrike=this.element==='meteor'?50+rngInt(this.random,50):50;this.strikes++;
        this.launch();
      }
    }
    if(this.element==='meteor')this.duration-=2;
  }
  launch(){
    const dx=this.x-50,dy=this.y+500,g=this.world.gravity??PHYSICS.gravityPerTick;
    const vx=dx/Math.sqrt(Math.abs(2*dy/g))+(rngInt(this.random,100)-50)/150;
    const request={kind:this.element,x:50,y:-500,vx,vy:0,source:this,skill:this.skill,addGoodTargets:false,addBadTargets:false};
    if(this.element==='meteor'){request.maxDamage=this.maxDamage;request.blastRadius=this.radius;}
    else request.rank=this.rank;
    return queueChildProjectile(this,request);
  }
}
export class MeteorSpell extends SkyFallSpell {constructor(options={}){super({...options,element:'meteor'});}}
export class CometSpell extends SkyFallSpell {constructor(options={}){super({...options,element:'comet'});}}

export class Meteor extends SpecialProjectile {
  constructor(options={}){
    super(neutralUntouched({...options,rank:0}));this.kind='meteor';this.maxDamage=options.maxDamage??100;
    this.blastRadius=options.blastRadius??150;this.debrisCount=options.debrisCount??3;this.scale=100;
    // Normal SpMeteors never invokes this alternate rank setter.
    if(options.applyRank)Meteor.prototype.setRank.call(this,options.rank??0);
  }
  setRank(rank){this.rank=rank;this.scale=50+10*rank;this.maxDamage=250+45*rank;this.blastRadius=150+5*rank;this.debrisCount=Math.floor(1.5*rank);}
  updateRotation(){this.angle=0;}
  updateSmoke(){
    if(this.y> -10&&(this.smokeTimer-=2)<0){
      this.smokeTimer=0;
      for(const [layer,jitter,baseSize,sizeRange] of [[0,30,200,50],[1,20,125,25]]){
        const styleVariant=rngInt(this.random,2),y=this.y+rngInt(this.random,jitter)-jitter/2,x=this.x+rngInt(this.random,jitter)-jitter/2,size=baseSize+rngInt(this.random,sizeRange);
        emit(this,'onVisual',{kind:'meteor-trail',source:this,layer,styleVariant,x,y,sizePercent:size,duration:100,animationRate:.5,animationEnd:100});
      }
    }
  }
  impact(target){
    emit(this,'onSound',{kind:'meteor-impact',source:this});
    // AVM1 null-target property/method calls do not abort the ground explosion.
    if(target!=null){
      queueStatus(this,{kind:'fire',target,duration:300,interval:20,damage:5});
      const amount=this.maxDamage*multiplier(target,'blunt');queueImpact(this,target,amount);
      if(this.owner!=null&&this.owner===this.world.hero)emit(this,'checkGreatestDamageDealt',amount);
    }
    visitBlastTargets(this,this.blastRadius,(target,distance,radius)=>this.collateral(target,distance,radius));
    emit(this,'onVisual',{kind:'meteor-blast',source:this,x:this.x,y:this.y,width:this.blastRadius*2,duration:52,animationRate:.5,animationEnd:26});
    this.spawnDebris();this.destroy();
  }
  collateral(target,distance,radius){
    const amount=(1-distance/radius)*this.maxDamage*(multiplier(target,'blunt')+multiplier(target,'fire'))*.5;queueImpact(this,target,amount);
    if(this.skill!=null){this.skill.addXP(Math.ceil(.1*amount));emit(this,'checkGreatestDamageDealt',amount);}
  }
  spawnDebris(){
    const elevation=ground(this.world,this.x),y=this.y>elevation?elevation:this.y;
    for(let i=0;i<this.debrisCount;i++){
      let vx,vy,advanceOnSpawn;
      if(this.y<elevation){vy=-(rngInt(this.random,100)/20+10);vx=(rngInt(this.random,100)-50)/10;advanceOnSpawn=true;}
      else{
        const slope=slopeAt(this.world,this.x,'Meteor debris');
        const direction=reflectionAngle(slope-10+i*10,this.vx,this.vy)*Math.PI/180,speed=Math.sqrt(this.vx*this.vx+this.vy*this.vy)*.3;
        vx=Math.cos(direction)*speed;vy=Math.sin(direction)*speed;advanceOnSpawn=false;
      }
      queueChildProjectile(this,{kind:'fire_ball',x:this.x,y,vx,vy,advanceOnSpawn,source:this,skill:this.skill,rank:this.rank,
        impactDamage:Math.ceil(this.maxDamage/this.debrisCount),maxDamage:300,blastRadius:50,addGoodTargets:false,addBadTargets:false});
    }
  }
}
export class FireBall extends Meteor {
  constructor(options={}){super({...options,applyRank:false});this.kind='fire_ball';this.setRank(options.rank??0);}
  setRank(rank){this.rank=rank;this.impactDamage=5+2*rank;this.fireDuration=300+2*rank;this.fireDamage=5+rank;}
  updateRotation(){this.angle=Math.atan(this.vy/this.vx)+(this.vx>0?0:Math.PI);}
  updateSmoke(){
    if(this.y> -10&&(this.smokeTimer-=2)<0){this.smokeTimer=4;emit(this,'onVisual',{kind:'fireball-trail',source:this,x:this.x,y:this.y,angle:this.angle,duration:10,animationDuration:100,animationRate:10,animationEnd:100});}
  }
  collateral(target){
    emit(this,'onSound',{kind:'fireball-collateral',source:this});const amount=this.impactDamage*multiplier(target,'blunt');queueImpact(this,target,amount);
    queueStatus(this,{kind:'fire',target,duration:this.fireDuration,interval:20,damage:this.fireDamage});
    if(this.skill!=null)this.skill.addXP(Math.ceil(.1*amount));
  }
  spawnDebris(){}
}

export class Comet extends SpecialProjectile {
  constructor(options={}){super(neutralUntouched(options));this.kind='comet';this.setRank(options.rank??0);}
  setRank(rank){this.rank=rank;this.maxDamage=250+41*rank;this.blastRadius=100+5*rank;this.debrisCount=4+Math.floor(.5*rank);this.slowFactor=1/(1.7+.4*rank);this.frostDuration=500+200*rank;this.scale=50+10*rank;}
  updateSmoke(){
    if(this.y> -10&&(this.smokeTimer-=2)<0){
      this.smokeTimer=0;
      for(let i=0;i<2;i++){
        const rotation=rngInt(this.random,360),y=this.y+rngInt(this.random,50)-25,x=this.x+rngInt(this.random,50)-25;
        emit(this,'onVisual',{kind:'comet-trail',source:this,x,y,rotation,duration:100,animationRate:.5,animationEnd:100});
      }
    }
  }
  impact(target){
    emit(this,'onSound',{kind:'comet-ice-impact',source:this});emit(this,'onSound',{kind:'comet-impact',source:this});
    if(target!=null){queueStatus(this,{kind:'ice',target,duration:99999,interval:20,slowFactor:.5});queueImpact(this,target,this.maxDamage);}
    visitBlastTargets(this,this.blastRadius,(target,distance,radius)=>this.collateral(target,distance,radius));
    emit(this,'onVisual',{kind:'comet-blast',source:this,x:this.x,y:this.y,width:this.blastRadius*2,duration:20,animationRate:1,animationEnd:20});
    this.spawnDebris();this.destroy();
  }
  collateral(target,distance,radius){
    const falloff=1-distance/radius,amount=falloff*this.maxDamage*(multiplier(target,'ice')+multiplier(target,'blunt'))*.5;
    queueImpact(this,target,amount);queueStatus(this,{kind:'ice',target,duration:Math.floor(this.frostDuration*falloff),interval:20,slowFactor:this.slowFactor});
    if(this.skill!=null)this.skill.addXP(Math.ceil(.1*amount));
    if(this.owner!=null&&this.owner===this.world.hero)emit(this,'checkGreatestDamageDealt',amount);
  }
  spawnDebris(){
    for(let i=0;i<this.debrisCount;i++){
      const vy=-(rngInt(this.random,100)/10+10),vx=(rngInt(this.random,100)-50)/10;
      queueChildProjectile(this,{kind:'ice_ball',x:this.x,y:this.y,vx,vy,source:this,skill:this.skill,
        impactDamage:Math.ceil(this.maxDamage/this.debrisCount),addGoodTargets:false,addBadTargets:false});
    }
  }
}
export class IceBall extends IceArrow {
  constructor(options={}){super(neutralUntouched(options));this.kind='ice_ball';this.rank=0;this.impactDamage=options.impactDamage??1;this.frostDuration=1000;this.slowFactor=.5;}
  updateRotation(){this.angle=0;}
  updateSmoke(){
    if(this.y> -10&&(this.smokeTimer-=2)<0){this.smokeTimer=3;
      for(let i=0;i<2;i++){
        const rotation=rngInt(this.random,360),y=this.y+rngInt(this.random,20)-10,x=this.x+rngInt(this.random,20)-10;
        emit(this,'onVisual',{kind:'iceball-trail',source:this,x,y,rotation,duration:100,animationRate:.5,animationEnd:100});
      }
    }
  }
}

/** Numerical bolt-height calibration only. These values preserve the original
 * segment RNG count while all rendered lightning artwork remains independent. */
export const LIGHTNING_BOLT_HEIGHTS=Object.freeze([325.75,321,321.15,319.55,321.6]);
function registerWorldObject(source,object){
  if(hasService(source,'addObject'))emit(source,'addObject',object);
  else if(source.world.objects?.add)source.world.objects.add(object);
  else (source.pendingObjects??=[]).push(object);
  return object;
}

export class ThunderCloudSpell extends BombSpell {
  constructor(options={}){super(options);this.kind='thunder_cloud';this.timeToStrike=25;this.cloud=null;this.setRank(options.rank??0);}
  setRank(rank){this.rank=rank;this.strikeWait=Math.floor(50/(2+.5*rank));this.maxDuration=500+300*rank;this.duration=this.maxDuration;this.lightningDamage=Math.floor(70*(1+rank/6));}
  step(){
    if(this.dead)return;
    if(this.duration===this.maxDuration)this.loadCloud();
    else if(this.duration<0)this.destroy();
    else {this.timeToStrike-=2;if(this.timeToStrike<0)this.strike();}
    this.duration-=2;
  }
  loadCloud(){
    const owner=this;
    this.cloud=registerWorldObject(this,{kind:'thunder_cloud_visual',x:this.x,y:this.y,draw:{x:this.x,y:this.y,angle:0},active:true,
      step(){},destroy(){if(!this.active)return;this.active=false;if(hasService(owner,'removeObject'))emit(owner,'removeObject',this);else owner.world.objects?.remove?.(this);}});
    emit(this,'onVisual',{kind:'thunder-cloud-created',source:this,cloud:this.cloud,x:this.x,y:this.y});
  }
  strike(){
    this.strikes++;emit(this,'onSound',{kind:'lightning-strike',source:this});
    this.timeToStrike=this.strikeWait+rngInt(this.random,this.strikeWait);
    const variant=rngInt(this.random,5),x=this.x+rngInt(this.random,100)-50,flipped=rngInt(this.random,2)===0;
    const elevation=ground(this.world,x),height=LIGHTNING_BOLT_HEIGHTS[variant],segments=Math.ceil((elevation-this.y)/(height*.95));
    if(segments===Infinity)throw new RangeError('Unbounded lightning segment count');
    const segmentVariants=[];for(let i=0;i<segments;i++)segmentVariants.push(rngInt(this.random,5));
    emit(this,'onVisual',{kind:'lightning-bolt',source:this,x,y:this.y,variant,flipped,segmentVariants,duration:10,initialHeight:height});
    const rotation=rngInt(this.random,360);
    emit(this,'onVisual',{kind:'critical-marker',source:this,x,y:elevation,rotation});
    this.lastStrike={x,y:elevation,variant,flipped,segments:segmentVariants.length,rotation};this.testHitObjects(x);
  }
  testHitObjects(x){
    const selected=[];
    for(const key of ['airUnits','goodTeam','badTeam'])for(let i=0;i<(this.world[key]?.length??0);i++){
      const target=this.world[key][i];if(!hittable(target))continue;
      const width=hasService(this,'getHitboxWidth')?emit(this,'getHitboxWidth',target):target.hitboxWidth??target.width??target.hitbox?.width;
      const halfStrip=width*.75;
      if(x<target.x+halfStrip&&x>target.x-halfStrip&&target.y>this.y)selected.push(target);
    }
    for(const target of selected){
      const resistance=target.getMultLighting?.()??multiplier(target,'lightning');
      const amount=resistance*this.lightningDamage+rngInt(this.random,Math.floor(this.lightningDamage/4));queueImpact(this,target,amount);
      if(this.skill!=null&&badFighter(target)){this.skill.addXP(Math.ceil(.1*amount));emit(this,'checkGreatestDamageDealt',amount);}
    }
  }
  destroy(){
    if(this.dead)return;
    emit(this,'onVisual',{kind:'thunder-cloud-fade',source:this,x:this.x,y:this.y,duration:30,animationRate:1,animationEnd:30});
    this.cloud?.destroy();super.destroy();
  }
}

/** Thunder has a custom Projectile step: no target cache, flight-time advance,
 * or upper-Y cull. Its skill never copies the skill's rank onto the projectile. */
export class ThunderArrow {
  constructor({x,y,vx=0,vy=0,world={},services={},random=world.random??Math.random,source=null,owner,team='neutral',skill=null,owningStructure=null,gravity=world.gravity??PHYSICS.gravityPerTick}={}){
    Object.assign(this,{x,y,vx:vx??0,vy:vy??0,world,services,random,source,owner:owner??(source===world.hero?source:undefined),team,skill,owningStructure,gravity});
    this.kind='thunder_arrow';this.rank=0;this.choice=rngInt(random,7);this.active=true;this.tick=0;this.flightUnits=0;this.smokeTimer=1;
    this.draw={x,y,angle:0};this.pendingSpells=[];this.move();
  }
  setRank(rank){this.rank=rank;}
  move(){
    this.x+=this.vx;this.y+=this.vy;this.angle=Math.atan(this.vy/this.vx)+(this.vx>0?0:Math.PI);
    this.smokeTimer-=2;if(this.smokeTimer<0){this.smokeTimer=0;emit(this,'onVisual',{kind:'thunder-arrow-trail',source:this,x:this.x,y:this.y,angle:this.angle,duration:20,animationDuration:100,animationRate:5});}
  }
  step(){
    if(!this.active)return;this.tick++;this.vy+=this.gravity;this.move();this.draw={x:this.x,y:this.y,angle:this.angle};
    if(this.y>ground(this.world,this.x)+10){emit(this,'removeActivationObject',this);this.destroy('ground');}
    if(this.x>2050||this.x< -50){emit(this,'removeActivationObject',this);this.destroy('out-of-bounds');}
  }
  activate(){
    addSpell(this,new ThunderCloudSpell({x:this.x,y:this.y,rank:this.rank,skill:this.skill,source:this,world:this.world,services:this.services,random:this.random}));
    this.destroy('activated');
  }
  destroy(reason='destroyed'){SpecialProjectile.prototype.destroy.call(this,reason);}
}

const occupiedByBad=target=>typeof target.occupiedByBad==='function'?target.occupiedByBad():(target.occupiedBy??target.team)==='bad';
const permanentBad=target=>typeof target.permanentBadTeam==='function'?target.permanentBadTeam():(target.permanentTeam??target.team)==='bad';

export class GorathShockWave extends BombSpell {
  constructor({vx=-40,...options}={}){super(options);this.kind='gorath_shock_wave';this.vx=vx;this.maxCharges=10;this.charges=10;this.timeToStrike=0;}
  step(){if(this.dead)return;if(this.charges<0){this.destroy();return;}this.timeToStrike-=2;if(this.timeToStrike<0)this.strike();}
  strike(){
    this.strikes++;emit(this,'onSound',{kind:'gorath-rumble',source:this});this.timeToStrike=2;this.charges--;
    const styleVariant=rngInt(this.random,3);this.y=ground(this.world,this.x);const rotation=slopeAt(this.world,this.x)+rngInt(this.random,60)-30;
    emit(this,'onVisual',{kind:'earth-shard',source:this,x:this.x,y:this.y,styleVariant,rotation,duration:110,animationRate:1,animationEnd:110});
    this.testHitObjects(this.x,this.y);this.x+=this.vx;
  }
  testHitObjects(x,y){
    const selected=[];
    for(const key of ['structures','goodTeam'])for(let i=0;i<(this.world[key]?.length??0);i++){
      const target=this.world[key][i];
      if(hittable(target)&&(key!=='structures'||!occupiedByBad(target))&&target.x<x+25&&target.x>x-25&&target.y>y-75)selected.push(target);
    }
    for(const target of selected){
      const amount=multiplier(target,'blunt')*(50+rngInt(this.random,300));queueImpact(this,target,amount);
      if(rngInt(this.random,3)===0)queueStatus(this,{kind:'fear',target,duration:300,interval:15});
      else if(rngInt(this.random,3)===0)queueStatus(this,{kind:'daze',target,duration:300,interval:50});
    }
  }
}
export class GorathStomp extends BombSpell {
  constructor(options={}){super({...options,radius:100,maxDamage:2000});this.kind='gorath_stomp';}
  strike(){this.charges--;this.timeToStrike=20;this.strikes++;this.testHitObjects(this.x,this.y);emit(this,'onSound',{kind:'gorath-stomp',source:this});}
  testHitObjects(x,y){
    emit(this,'onVisual',{kind:'ground-crack',source:this,x:this.x,y:this.y,rotation:slopeAt(this.world,this.x),duration:340,animationRate:1,animationEnd:340});
    for(const key of ['structures','goodTeam'])for(let i=0;i<(this.world[key]?.length??0);i++){
      const target=this.world[key][i];
      if(!hittable(target)||(key==='structures'&&(occupiedByBad(target)||permanentBad(target))))continue;
      const dx=target.x-x,dy=target.y-y,distance=Math.sqrt(dx*dx+dy*dy);if(distance<this.radius)this.damage(target,distance);
    }
  }
}

export function createSpecialSpell(request,options={}){
  const config={...request,...options};
  const classes={bomb:BombSpell,flak_bomb:FlakBombSpell,fire_wave:FireWaveSpell,ice_wave:IceWaveSpell,
    bomb_wave:BombWaveSpell,heal_wave:HealWaveSpell,meteor_fall:MeteorSpell,comet_fall:CometSpell,
    thunder_cloud:ThunderCloudSpell,gorath_shock_wave:GorathShockWave,gorath_stomp:GorathStomp};
  const Type=classes[request.kind];if(!Type)throw new RangeError(`Unsupported special spell: ${request.kind}`);
  return new Type(config);
}
