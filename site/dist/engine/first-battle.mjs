/** First CTF battle integration. Independent code and new presentation only.
 * Game-object scheduling is emulator-source-grounded, not a recorded Flash run.
 * Geometry retains explicit static-measurement/twip-edge uncertainty.
 */
import {validateBattleEncounter} from './battle-encounter.mjs';
import {HeightField} from './terrain.mjs';
import {FRIENDLY_RECRUIT_GEOMETRY,RECRUIT_SKILLS} from './recruitment.mjs';
import {CompanionController,GorathCompanion} from './companions.mjs';
import {Arrow,containsPoint,sampleStandardHit} from './ballistics.mjs';
import {createShooter} from './alternate-shooter.mjs';
import {assistedAutoAim} from './assisted-auto-aim.mjs';
import {damageVariation,heroArrowBaseDamage,seededRandom,DIFFICULTY} from './combat.mjs';
import {EffectQueue,impactEffect} from './effects.mjs';
import {FlagTroop,FlagState,FLAG_STATUS as FS} from './flag-troop.mjs';
import {MountedTroop} from './mounted-troop.mjs';
import {FlagArcher,FlagPriest,FlagTrebuchet,createSupportEffect} from './ranged-troop.mjs';
import {Hero,Castle} from './actors.mjs';
import {levelTerrain,getLevel,campaignRoster} from './levels.mjs';
import {Tower,towerPlacements} from './tower.mjs';
import {hitBossRegion} from './boss-geometry.mjs';
import {createSpecialProjectile as buildSpecialProjectile,createSpecialSpell} from './special-projectiles.mjs';
import {AirFighter,DragonScoutPoison,DragonScoutFire,DragonScoutIce,FlagFireDemon,FlagIceDemon,TestBoss} from './later-enemies.mjs';
import {Hotbar} from './hotbar.mjs';
import {unitRegions,COLLISION_REGIONS} from './collision.mjs';
import {ProjectileTargetCache} from './projectile-targets.mjs';
import {WorldObjects} from './world-order.mjs';
import {protectsAlliedFlyer} from './attack-allegiance.mjs';
import {BattleDirector,battleFieldLimits,observeBattlefield} from './battle-director.mjs';
import {WaveBudget,FriendlyReinforcements,ctfOutcome} from './campaign.mjs';
import {PlayerProfile,SKILLS,basicHitGold,travelXp,summaryBonuses,summonSquad} from './progression.mjs';

const remove=(array,item)=>{const index=array.indexOf(item);if(index>=0)array.splice(index,1);};
const typeSuffix={grunt:'Grunt',tallGrunt:'TallGrunt',archer:'Archer',priest:'Priest',mount:'Mount',trebuchet:'Trebuchet',air:'Air',poisonDragon:'PoisonDragon',fireDragon:'FireDragon',iceDragon:'IceDragon',fireDemon:'FireDemon',iceDemon:'IceDemon',gorath:'Gorath'};
const classFor={grunt:FlagTroop,tallGrunt:FlagTroop,archer:FlagArcher,priest:FlagPriest,mount:MountedTroop,trebuchet:FlagTrebuchet,air:AirFighter,poisonDragon:DragonScoutPoison,fireDragon:DragonScoutFire,iceDragon:DragonScoutIce,fireDemon:FlagFireDemon,iceDemon:FlagIceDemon,gorath:TestBoss};

class BattleArrow extends Arrow {
  constructor(request,battle){
    super(request);this.battle=battle;this.owner=request.source;this.team=request.team??'good';
    this.heroShot=request.kind==='hero_arrow';this.skill=request.skill;this.skillRank=request.rank??request.skill?.rank??0;
    this.impactDamage=request.impactDamage??heroArrowBaseDamage(this.skillRank);
    this.addGoodTargets=this.heroShot||this.team!=='good';this.addBadTargets=this.heroShot||this.team!=='bad';
    this.cache=new ProjectileTargetCache();this.trail=[];this.kind=request.kind;this.deflections=0;this.critical=false;
  }
  step(){
    if(!this.active)return;
    super.step(()=>{
      const targets=this.cache.update(this,this.battle).filter(target=>!protectsAlliedFlyer(this,target));
      for(const target of targets)this.battle.updateGeometry(target);
      const hit=sampleStandardHit(this,this.battle.elevationAt(this.x),targets);
      if(hit){if(hit.kind==='target')this.hit(hit.target);else this.destroy('ground');}
    });
    if(!this.active)this.battle.removeObject(this);
    else {this.trail.push({x:this.x,y:this.y});if(this.trail.length>25)this.trail.shift();}
  }
  hit(target){
    if(protectsAlliedFlyer(this,target))return;
    const reaction=typeof target.getReaction==='function'?target.getReaction(this):
      (!!target.headbox&&(containsPoint(target.headbox,this)||containsPoint(target.headbox,this.midpoint))?'critical':'destroy');
    if(reaction==='no_reaction')return;
    if(reaction==='deflect'){
      const old=this.deflections++;
      if(old>=3){this.destroy('fourth-deflection');return;}
      this.flightUnits=-20;const angle=Math.floor(this.battle.random()*360)*Math.PI/180,speed=Math.hypot(this.vx,this.vy)*.5;
      this.vx=Math.cos(angle)*speed;this.vy=Math.sin(angle)*speed;return;
    }
    if(reaction!=='critical'&&reaction!=='destroy')return;
    const critical=reaction==='critical';
    if(critical){this.critical=true;this.impactDamage*=2;const rotation=Math.floor(this.battle.random()*360);this.battle.emit({type:'critical',x:this.x,y:this.y,rotation});}
    const multiplier=target.multipliers?.pierce??1;
    const damage=Math.floor(multiplier*this.impactDamage*(this.heroShot?damageVariation(this.battle.random):1));
    this.battle.queueImpact({source:this,target,amount:damage,critical,type:'blunt',duration:10});
    if(this.heroShot){
      const gold=basicHitGold(this.battle.profile.difficulty);this.battle.profile.gold+=gold;this.battle.stats.goldEarned+=gold;
      if(target.isFighter&&target.team==='bad')this.battle.profile.addXP(travelXp(this.flightUnits,target));
      this.skill?.addXP(Math.ceil(damage*.007));
      this.battle.stats[critical?'headShots':'bodyShots']++;
    }else if(this.skill&&Math.floor(this.battle.random()*3)===0)this.skill.addXP(Math.ceil(damage*.1));
    this.battle.emit({type:'hit',target,damage,critical,projectile:this});this.destroy('target');
  }
  destroy(reason){if(!this.active)return;this.active=false;this.reason=reason;this.battle.removeObject(this);}
}

export class FirstBattle {
  constructor({profile=new PlayerProfile(),level=1,random=seededRandom(1234),createSpecialProjectile=buildSpecialProjectile,unitFactories={},geometryKinds={},onEvent=()=>{},testing=false,encounter=null}={}){
    this.encounter=validateBattleEncounter(encounter);
    this.testing=testing===true;this.protectedTesting=false;if(this.testing)profile.cheated=true;this.profile=profile;this.random=random;this.createSpecialProjectile=createSpecialProjectile;this.onEvent=onEvent;
    this.tick=0;this.width=2000;this.gravity=.3;this.level=level;this.scene=level+1;this.levelData=this.encounter?{...getLevel(level),scenery:this.encounter.scenery,timeOfDay:this.encounter.timeOfDay,heights:this.encounter.heights}:getLevel(level);this.unitFactories={...classFor,...unitFactories};this.geometryKinds=geometryKinds;this.paused=false;this.outcome=null;this.summary=null;
    this.terrain=this.encounter?new HeightField(this.encounter.heights):levelTerrain(level);this.objects=new WorldObjects();this.goodTeam=[];this.badTeam=[];this.airUnits=[];this.structures=[];this.goodStructures=[];this.badStructures=[];this.neutralStructures=[];this.garrisons=[];this.projectiles=[];this.spells=[];this.reactiveElements=[];this.activationObjects=[];this.input={left:false,right:false,up:false,down:false,mouseDown:false};
    this.goodHomeBoundary=325;this.badHomeBoundary=1725;
    this.friendlyQueue=new FriendlyReinforcements({population:10+Math.floor(profile.rank*10)});
    this.stats={shotsFired:0,bodyShots:0,headShots:0,goldEarned:0,goldSpent:0,populationGiven:this.friendlyQueue.population};
    this.wave=new WaveBudget({level,random});this.enemies=new BattleDirector({roster:this.encounter?.roster??campaignRoster(level,random),level,difficulty:profile.difficulty,wave:this.wave});this.friendlyQueue.cap=battleFieldLimits(level).friendly;
    this.hero=this.objects.add(new Hero({x:100,y:this.elevationAt(100),rank:profile.rank,world:this,structures:()=>this.garrisons,input:()=>({...this.input,shooterX:this.shooter?.shootingX}),services:{stateChange:()=>this.checkOutcome()}}));
    this.hero.regionKind='hero';this.assignGeometry(this.hero);this.goodTeam.push(this.hero);
    this.goodCastle=this.createCastle('good',350,8000+profile.rank*400);
    this.hero.x=this.goodCastle.x;this.hero.y=this.goodCastle.y;this.hero.garrisonInto(this.goodCastle);
    for(const x of (this.encounter?.towers??towerPlacements(level,random)))this.createTower(x);
    this.badCastle=this.createCastle('bad',1800,this.encounter?.enemyKeepHP??Math.floor(8000*(1+level/30)));
    this.ownFlag=this.objects.add(new FlagState({x:325,y:this.elevationAt(325)}));
    this.enemyFlag=this.objects.add(new FlagState({x:1725,y:this.elevationAt(1725)}));
    this.shooter=createShooter({origin:this.hero.launchPosition,mode:profile.shootingMode,aimSolver:assistedAutoAim,onFailure:()=>this.emit({type:'aim-unreachable'})});
    this.hotbar=new Hotbar(profile.skills,{activate:s=>summonSquad(s,this.profile,this.friendlyQueue,this.stats)});this.activeSkill=this.hotbar.active;this.queuedAim=null;this.playerShots=[];this.queuedSelection=null;
    this.companions=new CompanionController(this);
    this.profile.scene=this.scene;this.profile.level=this.level;this.profile.highestScene=Math.max(this.profile.highestScene,this.scene);
  }
  elevationAt(x){return this.terrain.elevationAt(x);}
  maxElevationAt(x){return this.terrain.maxElevationAt(x);}
  rotationAt(x){return this.terrain.rotationAt(x);}
  emit(event){this.onEvent({...event,tick:this.tick});}
  onSound(event){this.emit({type:'sound',...event});}
  onHeal(event){this.emit({type:'heal',...event});}
  assignGeometry(entity){const local=COLLISION_REGIONS[entity.regionKind].hitbox;entity.height=local[3]-local[2];entity.width=local[1]-local[0];this.updateGeometry(entity);return entity;}
  updateGeometry(entity){if(entity.clipPresent===false){entity.hitbox=null;entity.headbox=null;return;}if(!entity.regionKind)return;Object.assign(entity,unitRegions(entity.regionKind,{x:entity.x,y:entity.y,scaleX:entity.facing??1,rotation:entity.collisionRotation??entity.rotation??0}));}
  createCastle(team,x,hp){
    const castle=new Castle({x,y:this.elevationAt(x),hp,team,services:{ownershipChanged:b=>{remove(this.neutralStructures,b);if(b.occupiedBy==='good')this.goodStructures.push(b);else if(b.occupiedBy==='bad')this.badStructures.push(b);},destroyed:b=>{remove(b.occupiedBy==='good'?this.goodStructures:b.occupiedBy==='bad'?this.badStructures:this.neutralStructures,b);remove(this.garrisons,b);this.objects.remove(b);if(b.team==='bad'){const retreat=this.enemies.closeReserves();if(retreat)this.emit({type:'enemy-reserves-withdrawn',...retreat});}this.emit({type:'castle-destroyed',castle:b});},stateChange:()=>this.checkOutcome()}});
    castle.regionKind=team==='good'?'friendlyCastle':'enemyCastle';this.assignGeometry(castle);
    this.objects.add(castle);this.structures.push(castle);this.garrisons.push(castle);(team==='good'?this.goodStructures:this.badStructures).push(castle);return castle;
  }
  createTower(x){
    const tower=new Tower({x,y:this.elevationAt(x),level:this.level,services:{
      ownershipChanged:t=>{remove(this.neutralStructures,t);(t.occupiedBy==='good'?this.goodStructures:this.badStructures).push(t)},
      disowned:t=>this.neutralStructures.push(t),
      destroyed:t=>{remove(t.occupiedBy==='good'?this.goodStructures:t.occupiedBy==='bad'?this.badStructures:this.neutralStructures,t);remove(this.garrisons,t);this.objects.remove(t);this.emit({type:'tower-destroyed',tower:t})}
    }});tower.regionKind='tower';this.assignGeometry(tower);this.objects.add(tower);this.structures.push(tower);this.garrisons.push(tower);this.neutralStructures.push(tower);return tower;
  }
  get regularArmyCount(){return this.goodTeam.filter(unit=>unit!==this.hero&&!unit.isCompanion).length;}
  createUnit(type,{team='bad',rank=null,skill=null,companion=false,fieldEntry=false}={}){
    if(type==='gorath'&&team==='good'&&!companion)throw new RangeError('Bosses use the companion summon slot');
    const isGood=team==='good',kind=this.geometryKinds[type]?.[team]??(isGood&&FRIENDLY_RECRUIT_GEOMETRY[type]?FRIENDLY_RECRUIT_GEOMETRY[type]:((isGood?'friendly':'enemy')+typeSuffix[type]));
    if(!this.unitFactories[type])throw new RangeError(`Enemy behavior is not integrated: ${type}`);
    if(!COLLISION_REGIONS[kind])throw new RangeError(`Enemy geometry is not integrated: ${kind}`);
    const body=COLLISION_REGIONS[kind].hitbox,services={
      hitTestRegion:hitBossRegion,stepEffects:unit=>unit.effects.step(),queueImpact:request=>this.queueImpact(request),
      queueProjectile:request=>this.queueProjectile(request),queueSpell:request=>this.queueSpell(request),queueEffect:request=>request.target.effects.add(createSupportEffect(request,{random:this.random,onHeal:event=>this.emit({type:'heal',...event})})),
      // Disposal also releases a ranged troop's garrison slot after status-effect death.
      removeUnit:unit=>{unit.leaveGarrison?.();remove(unit.team==='good'?this.goodTeam:this.badTeam,unit);remove(this.airUnits,unit);this.objects.remove(unit);},
      stateChange:()=>this.checkOutcome(),updateClip:unit=>{unit.collisionRotation=unit.rotation??0;this.updateGeometry(unit)}
    };
    // A newly deployed final-stand boss enters visibly inside the finite terrain.
    // Existing bosses retain their position and ordinary entrance/AI untouched.
    const visibleBossEntry=fieldEntry&&!isGood&&type==='gorath';
    const spawnX=visibleBossEntry?Math.max(0,this.width-Math.max(Math.abs(body[0]),Math.abs(body[1]))-1):isGood?-50:type==='gorath'?2200:2050;
    const spawnY=visibleBossEntry?this.elevationAt(spawnX):this.terrain.spawnElevation(isGood?'left':'right');
    if(!Number.isFinite(spawnX)||!Number.isFinite(spawnY))throw new RangeError('A fighter needs finite entry terrain');
    const Factory=companion&&type==='gorath'?GorathCompanion:this.unitFactories[type];
    const unit=new Factory({type,level:this.level,rank,difficulty:this.profile.difficulty,x:spawnX,y:spawnY,forward:isGood?1:-1,team,
      friendFlag:isGood?this.ownFlag:this.enemyFlag,enemyFlag:isGood?this.enemyFlag:this.ownFlag,
      enemies:()=>isGood?(RECRUIT_SKILLS[type]||companion?this.badTeam.filter(unit=>unit.hp>0&&!unit.destroyed):this.badTeam):this.goodTeam,friends:()=>isGood?this.goodTeam:this.badTeam,structures:()=>this.structures,
      world:this,services,skill,random:this.random,height:body[3]-body[2],width:body[1]-body[0]});
    if(unit instanceof FlagTroop){unit.vx=unit.speed;unit.facing=1;}
    unit.recruited=isGood;unit.regionKind=kind;unit.height=body[3]-body[2];unit.lifeType=type==='trebuchet'?'vehicle':'living';
    if(!('immunity'in unit))Object.defineProperty(unit,'immunity',{get:()=>[...unit.immunities].join(' ')});
    unit.effects=new EffectQueue(unit);this.assignGeometry(unit);this.objects.add(unit);(isGood?this.goodTeam:this.badTeam).push(unit);if(unit.airUnit)this.airUnits.push(unit);
    this.emit({type:'spawn',unit});return unit;
  }
  queueImpact(request){if(request.amount>=0&&protectsAlliedFlyer(request.source,request.target))return {status:'protected'};return request.target.effects.add(impactEffect({source:request.source,target:request.target,amount:request.amount,critical:request.critical??false,impactType:request.impactType??request.type??'blunt',duration:request.duration??10,random:this.random,onDamage:event=>this.emit({type:'damage',...event}),onReaction:(target,action)=>target.transition?.(action)}));}
  queueProjectile(request){
    let projectile;
    if(request.kind!=='hero_arrow'&&request.kind!=='standard_arrow'){
      if(!this.createSpecialProjectile)throw new Error('Trebuchet projectile integration is required for this battle');
      projectile=this.createSpecialProjectile({...request,world:this,random:this.random,services:{hitTest:(target,point,region)=>{this.updateGeometry(target);return !!target[region]&&containsPoint(target[region],point)},queueImpact:r=>this.queueImpact(r),addSpell:s=>this.addSpell(s),removeObject:p=>this.removeObject(p),onProjectileHit:e=>this.emit({type:'projectile-hit',...e}),onVisual:e=>this.emit({type:'visual',...e})}});
    }else projectile=new BattleArrow(request,this);
    this.objects.add(projectile);this.projectiles.push(projectile);return projectile;
  }
  addObject(object){return this.objects.add(object);}
  addReactiveElement(object){this.reactiveElements.push(object);}
  removeReactiveElement(object){remove(this.reactiveElements,object);}
  addActivationObject(object){this.activationObjects.push(object);}
  removeActivationObject(object){remove(this.activationObjects,object);}
  activateObjects(){const count=this.activationObjects.length;for(let i=0;i<count;i++)this.activationObjects[i]?.activate?.();this.activationObjects=[];}
  addSpell(spell){this.spells.push(spell);return spell;}
  removeSpell(spell){remove(this.spells,spell);}
  removeObject(object){this.objects.remove(object);remove(this.projectiles,object);}
  queueSpell(request){const spell=createSpecialSpell(request,{world:this,services:{queueImpact:r=>this.queueImpact(r),onVisual:e=>this.emit({type:'visual',...e})},random:this.random});return this.addSpell(spell);}
  selectSkill(slot){this.queuedSelection=slot;}
  refreshHotbar(){this.hotbar.rebuild();this.activeSkill=this.hotbar.active;}
  applyOptions({difficulty=this.profile.difficulty,shootingMode=this.profile.shootingMode}={}){
    if(!DIFFICULTY[difficulty])throw new RangeError('Unknown difficulty');
    this.profile.difficulty=difficulty;this.profile.shootingMode=shootingMode;
    // Existing units keep their constructor stats; future loaders use the new
    // factors. Retain the currently running reinforcement timer and cooldowns.
    this.enemies.setDifficulty(difficulty);
    this.shooter.cancel();this.shooter=createShooter({origin:this.hero.launchPosition,mode:shootingMode,aimSolver:assistedAutoAim,onFailure:()=>this.emit({type:'aim-unreachable'})});
  }

  // Modern UI intent buffer: at most three frames, never a delayed burst.
  queuePlayerShot(aim,skill=this.activeSkill){
    if(!aim?.canFire||!skill||this.playerShots.length>=3)return false;
    this.playerShots.push({aim:Object.freeze({...aim}),skill});return true;
  }
  cancelPlayerShots(){this.playerShots.length=0;this.queuedAim=null;delete this.shooter.intentSkill;}
  shoot(aim,intendedSkill){
    const captured=arguments.length>1,skill=captured?intendedSkill:this.activeSkill;
    if(!aim?.canFire||!skill)return false;
    if(captured&&(this.hero.hp<=0||this.hero.dead||this.outcome||this.summary||this.paused||!this.profile.skills.includes(skill)||!this.hotbar.bars.some(bar=>bar.includes(skill))))return false;
    if(SKILLS[skill.id]?.summon)return summonSquad(skill,this.profile,this.friendlyQueue,this.stats);
    const origin=this.hero.launchPosition;
    // Modern player-input boundary: never spend a cooldown or retain an invisible
    // NaN projectile. The standalone source-matched aiming algebra is unchanged.
    if(![origin.x,origin.y,aim.vx,aim.vy].every(Number.isFinite))return false;
    if(!skill.use())return false;
    const kinds={arrow:'hero_arrow',fireArrow:'fire_arrow',iceArrow:'ice_arrow',pierceArrow:'pierce_arrow',bombArrow:'bomb_arrow',flakArrow:'flak_arrow',bombWave:'bomb_wave_arrow',iceWave:'ice_wave_arrow',fireWave:'fire_wave_arrow',healWave:'heal_wave_arrow',thunderArrow:'thunder_arrow',meteorArrow:'meteor_arrow',cometArrow:'comet_arrow'};
    const request={kind:kinds[skill.id],source:this.hero,owner:this.hero,team:'good',...origin,vx:aim.vx,vy:aim.vy,skill};
    if(this.profile.shootingMode==='auto_aim'&&aim.rangeAssisted===true&&Number.isFinite(aim.gravity)&&aim.gravity>=this.gravity/3&&aim.gravity<=this.gravity)request.gravity=aim.gravity;
    if(skill.id!=='thunderArrow')request.rank=skill.rank;
    if(['fireArrow','pierceArrow','bombWave','cometArrow','fireWave','thunderArrow','flakArrow'].includes(skill.id))request.owningStructure=this.hero.garrisonBuilding;
    const projectile=this.queueProjectile(request);
    if(skill.id==='flakArrow'||skill.id==='thunderArrow')this.addActivationObject(projectile);
    if(skill.id==='arrow')this.stats.shotsFired++;
    this.emit({type:'shot',skill:skill.id});return true;
  }
  checkOutcome(){
    if(this.outcome||!this.ownFlag||!this.enemyFlag)return;
    const outcome=ctfOutcome({heroDead:this.hero.dead,ownFlagCaptured:this.ownFlag.status===FS.CAPTURED,enemyFlagAtBase:this.enemyFlag.status===FS.AT_BASE,enemyFlagCaptured:this.enemyFlag.status===FS.CAPTURED,ownFlagAtBase:this.ownFlag.status===FS.AT_BASE,reinforcementsLeft:this.enemies.remaining,enemiesAlive:this.badTeam.length});
    if(!outcome||(outcome==='defeat'&&this.testing&&this.protectedTesting))return;this.finishOutcome(outcome);
  }
  // Shared settlement keeps assisted QA on the same progression/summary path.
  finishOutcome(outcome){
    if(this.outcome||!['victory','defeat'].includes(outcome))return false;
    this.activateObjects();this.outcome=outcome;this.cancelPlayerShots();this.companions.end();this.endCountdown=200;
    if(outcome==='victory'){this.profile.victories++;this.profile.level=this.level+1;this.profile.scene=this.scene+1;this.profile.highestLevel=Math.max(this.profile.highestLevel,this.level+1);this.profile.highestScene=Math.max(this.profile.highestScene,this.scene+1);}else this.profile.defeats++;
    this.emit({type:'outcome',outcome});return true;
  }
  step(){
    if(this.paused||this.summary)return;this.tick++;
    // Source outcome mode stops simulation on the next frame; the triggering
    // active frame completes normally without decrementing its new countdown.
    if(this.outcome){
      if(this.endCountdown>0)this.endCountdown-=2;
      else {
        const campaignComplete=this.outcome==='victory'&&this.level===30;
        const bonus=this.outcome==='victory'&&!campaignComplete?summaryBonuses({level:this.level,...this.stats,populationLeft:this.friendlyQueue.population}):{gold:0,xp:0};
        if(this.outcome==='victory'&&!campaignComplete){this.profile.gold+=bonus.gold;this.profile.addXP(bonus.xp);}
        this.summary={outcome:this.outcome,...bonus,campaignComplete};this.emit({type:'summary',summary:this.summary});
      }
      return;
    }
    this.companions.step();
    const objectCountAtTickStart=this.objects.items.length;
    const ticket=this.friendlyQueue.step(this.regularArmyCount);if(ticket)this.createUnit(ticket.type,{team:'good',rank:ticket.rank,skill:ticket.skill});
    this.objects.step(objectCountAtTickStart);
    if(!this.outcome){const enemy=this.enemies.step(observeBattlefield(this));if(enemy)this.createUnit(enemy,{fieldEntry:this.enemies.finalStand&&enemy==='gorath'});this.checkOutcome();}
    this.shooter.origin=this.hero.launchPosition;const aim=this.shooter.step()??this.queuedAim;this.queuedAim=null;
    if(aim){this.queuePlayerShot(aim,this.shooter.intentSkill??this.activeSkill);delete this.shooter.intentSkill;}
    const shot=this.playerShots.shift();if(shot)this.shoot(shot.aim,shot.skill);
    if(this.queuedSelection!=null){this.hotbar.select(this.queuedSelection);this.queuedSelection=null;}
    this.hotbar.poll({mouseDown:this.input.mouseDown,pointerY:this.input.pointerY??0,hitSlot:this.input.hitSlot??null,autoSlot:this.input.autoSlot??null,digits:this.input.digits??[]});this.activeSkill=this.hotbar.active;
    for(const skill of this.hotbar.bars.flat().filter(Boolean))skill.step(s=>{if(SKILLS[s.id]?.summon)summonSquad(s,this.profile,this.friendlyQueue,this.stats);else this.hotbar.active=s;});
    this.hotbar.consumeWheel();this.activeSkill=this.hotbar.active;
    for(let i=0;i<this.spells.length;i++)this.spells[i].step();
    if(this.input.space&&this.activationObjects.length)this.activateObjects();

  }
}

export {FirstBattle as CampaignBattle};
