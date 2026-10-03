/** Independent co-hero extension. Balance and lifecycle are new game design.
 * Hostile Gorath behavior and original spell implementations remain unchanged.
 */
import {TestBoss,GORATH_ACTION as G} from './later-enemies.mjs';
import {COMPANIONS} from './recruitment.mjs';
import {createStatusEffect} from './special-projectiles.mjs';

const alive=unit=>unit?.hp>0&&!unit.dead&&!unit.destroyed;
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const hostile=(unit,team)=>alive(unit)&&(unit.occupiedBy??unit.team)!==team&&['good','bad'].includes(unit.occupiedBy??unit.team);

/** A terrain-following wave: at most one hit per opposing unit/structure.
 * Team is retained after recall/death; an already-cast wave finishes normally.
 */
export class CompanionShockWave {
 constructor({source,world,damage=180}){this.source=source;this.world=world;this.team=source.team;this.kind='gorath_shock_wave';this.x=source.x+source.forward*80;this.y=world.elevationAt(this.x);this.vx=source.forward*40;this.damage=damage;this.charges=16;this.timeToStrike=0;this.active=true;this.dead=false;this.seen=new Set();}
 step(){if(this.dead)return;if(this.charges<=0||this.x<0||this.x>this.world.width){this.destroy();return;}if(this.timeToStrike-->0)return;this.timeToStrike=1;this.charges--;this.y=this.world.elevationAt(this.x);this.world.emit({type:'visual',kind:'earth-shard',source:this,x:this.x,y:this.y,styleVariant:1,rotation:0,duration:55});
  for(const target of [...(this.team==='good'?this.world.badTeam:this.world.goodTeam),...this.world.structures]){
   if(this.seen.has(target)||!hostile(target,this.team)||target.airUnit||Math.abs(target.x-this.x)>45||Math.abs(target.y-this.y)>100)continue;
   this.seen.add(target);this.world.queueImpact({source:this,target,amount:this.damage*(target.multipliers?.blunt??1),type:'blunt',duration:10});
   if(target.isFighter)target.effects.add(createStatusEffect({kind:'daze',target,duration:90,interval:30},{random:this.world.random}));
  }
  this.x+=this.vx;
 }
 destroy(){if(this.dead)return;this.dead=true;this.active=false;this.world.removeSpell(this);}
}

/** Uses the boss's existing shape/reaction regions with independent ally AI.
 * Flags remain an infantry objective; companions neither carry nor steal them.
 */
export class GorathCompanion extends TestBoss {
 constructor(options={}){
  const rank=options.rank??1;
  super({...options,stats:{maxHp:1800+rank*80,speed:1.8,damage:120+rank*6,rank}});
  this.isCompanion=true;this.companionId='gorath';this.recruited=true;this.forward=1;this.facing=-1;this.actionMode='companion_guard';this.actionDuration=0;this.autoAttackTicks=0;this.signatureWindup=0;this.signatureCooldown=0;this.disabledTicks=0;
  this.animation={start:5,end:35,frame:5,rate:.35,displayFrame:5};
 }
 transition(action){if(action==='die'||action===G.KILLED)return super.transition(action);if(action==='knock_back'||action===G.KNOCK_BACK){this.disabledTicks=33;this.standing=false;this.vx=0;return G.KNOCK_BACK;}if(action==='flinch'){this.disabledTicks=Math.max(this.disabledTicks,8);return action;}if(action==='daze'||action==='fear')return null;return super.transition(action);}
 // Enemy Gorath's art faces left at scale1; ally faces right at scale-1.
 beginSignature(){if(!alive(this)||this.signatureCooldown>0||this.disabledTicks>0)return false;this.signatureCooldown=COMPANIONS.gorath.signatureCooldownTicks;this.signatureWindup=18;this.vx=0;this.actionMode=G.AXE_ATTACK;this.animation={start:61,end:96,frame:61,rate:1,displayFrame:61};return true;}
 stomp(){const x=this.x+this.forward*65;this.world.emit({type:'visual',kind:'ground-crack',source:this,x,y:this.y,rotation:0,duration:70});this.world.emit({type:'sound',kind:'gorath-stomp',source:this});for(const target of this.enemies())if(hostile(target,this.team)&&!target.airUnit&&Math.hypot(target.x-x,target.y-this.y)<110)this.world.queueImpact({source:this,target,amount:this.damage*(target.multipliers?.blunt??1),type:'blunt',duration:10});}
 step(){
  if(this.destroyed)return;
  if(!alive(this)){this.destroy();return;}
  this.services.stepEffects?.(this);if(!alive(this)){this.destroy();return;}
  this.signatureCooldown=Math.max(0,this.signatureCooldown-1);this.autoAttackTicks=Math.max(0,this.autoAttackTicks-1);
  if(this.disabledTicks>0){this.disabledTicks--;this.vx=0;if(this.disabledTicks===0)this.standing=true;}
  else if(this.signatureWindup>0){this.signatureWindup--;this.vx=0;if(this.signatureWindup===0){this.world.addSpell(new CompanionShockWave({source:this,world:this.world,damage:this.damage*1.5}));this.world.emit({type:'companion-signature',unit:this,name:'Earthshatter'});}}
  else {
   const targets=this.enemies().filter(target=>hostile(target,this.team)&&!target.airUnit&&!target.garrisoned?.());
   const target=targets.sort((a,b)=>Math.abs(a.x-this.x)-Math.abs(b.x-this.x))[0];
   const destination=target?.x??clamp(this.world.hero.x+170,450,1550),distance=destination-this.x;
   this.forward=distance>=0?1:-1;this.facing=-this.forward;
   if(target&&Math.abs(distance)<145){this.vx=0;this.actionMode=G.STOMP_IN_PLACE;if(this.autoAttackTicks===0){this.stomp();this.autoAttackTicks=4*33;this.animation={start:421,end:433,frame:421,rate:.5,displayFrame:421};}}
   else {this.vx=Math.abs(distance)>65?Math.sign(distance)*this.speed*this.speedFactor:0;this.actionMode=this.vx?G.LEFT_STEP:'companion_guard';if(this.animation.frame>=this.animation.end)this.animation={start:5,end:35,frame:5,rate:.35,displayFrame:5};}
  }
  this.animate();this.x=clamp(this.x+this.vx,100,1900);this.y=this.world.elevationAt(this.x);this.services.updateClip?.(this);
 }
}

export class CompanionController {
 constructor(battle){this.battle=battle;this.unit=null;this.recoveryTicks=0;this.recoveryReason=null;}
 status(){const profile=this.battle.profile,id=profile.companionId??null,item=COMPANIONS[id],active=alive(this.unit),owned=!!item&&profile.companionOwned?.has(id),blocked=this.battle.paused||!!this.battle.outcome||!!this.battle.summary;
  const reason=!item?'Choose a companion in the armory':!owned?'Hire this companion first':blocked?'Battle is paused or finished':active?'Companion is on the field':this.recoveryTicks>0?`${Math.ceil(this.recoveryTicks/33)}s recovery`:profile.gold<(item?.summonCost??0)?`Need ${item.summonCost} gold to summon`:'Ready to summon';
  return {id,name:item?.name??null,owned,active,hp:active?this.unit.hp:0,maxHp:active?this.unit.maxHp:0,cooldownSeconds:Math.ceil(this.recoveryTicks/33),signatureCooldownSeconds:active?Math.ceil(this.unit.signatureCooldown/33):0,cost:item?.summonCost??0,canSummon:!!owned&&!blocked&&!active&&!this.unit&&this.recoveryTicks===0&&profile.gold>=item.summonCost,canUseSignature:!!active&&!blocked&&this.unit.signatureCooldown===0&&this.unit.disabledTicks===0,canRecall:!!active&&!this.battle.outcome&&!this.battle.summary,reason,recoveryReason:this.recoveryReason};
 }
 summon(){if(!this.status().canSummon)return false;const item=COMPANIONS[this.battle.profile.companionId];const unit=this.battle.createUnit(item.id,{team:'good',rank:this.battle.profile.rank,companion:true});unit.x=clamp(this.battle.hero.x+120,450,1200);unit.y=this.battle.elevationAt(unit.x);this.battle.updateGeometry(unit);this.unit=unit;this.battle.profile.gold-=item.summonCost;this.battle.stats.goldSpent+=item.summonCost;this.recoveryReason=null;this.battle.emit({type:'companion-summoned',unit});return true;}
 useSignature(){if(!this.status().canUseSignature)return false;return this.unit.beginSignature();}
 act(){return this.status().active?this.useSignature():this.summon();}
 recall(){if(!this.status().canRecall)return false;this.release('recalled');return true;}
 release(reason){if(!this.unit)return false;const unit=this.unit,item=COMPANIONS[unit.companionId];this.unit=null;this.recoveryTicks=reason==='defeated'?item.defeatRecoveryTicks:reason==='recalled'?item.recoveryTicks:0;this.recoveryReason=reason;unit.destroy();this.battle.emit({type:'companion-departed',unit,reason});return true;}
 step(){if(this.battle.paused||this.battle.outcome||this.battle.summary)return;if(this.unit&&!alive(this.unit)){this.release('defeated');return;}if(this.recoveryTicks>0)this.recoveryTicks--;}
 end(){this.release('battle-ended');}
}
