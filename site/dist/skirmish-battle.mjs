import {flagRecoveryOptions} from './engine/flag-recovery-options.mjs';
/** Disposable practice adapter. Every attempt gets its own profile and RNG.
 * Ordinary combat/economy remain active; no supplied kit can become a campaign.
 */
import {CausewayObjective,CAUSEWAY_OBJECTIVE} from './engine/causeway-objective.mjs';
import {AuxiliaryController} from './engine/auxiliary-controller.mjs';
import {LevyEncounterDirector} from './engine/levy-encounter.mjs';
import {FLAG_STATUS as FS} from './engine/flag-troop.mjs';
import {CampaignBattle} from './engine/first-battle.mjs';
import {BatteryObjective,BATTERY_OBJECTIVE,BATTERY_TARGETS,BATTERY_ESCORT} from './engine/battery-objective.mjs';
import {PlayerProfile} from './engine/progression.mjs';
import {HeightField} from './engine/terrain.mjs';
import {CampaignProfiles} from './engine/profile-manager.mjs';
import {createSkirmish,SKIRMISH_KIT,skirmishCombatRandom} from './skirmish-model.mjs';
class SkirmishHeightField extends HeightField{elevationAt(x){return x===this.interval*(this.samples.length-1)?this.samples.at(-1):super.elevationAt(x);}}
const suppliedProfiles=new WeakMap(),usedProfiles=new WeakSet();
const progressionKeys=['level','scene','highestLevel','highestScene'];
export function createSkirmishProfile(scenario,{shootingMode='classic'}={}){
 scenario=createSkirmish(scenario?.descriptor);
 if(!['classic','anywhere','point_aim','auto_aim'].includes(shootingMode))throw new RangeError('Unknown aiming mode');
 const profile=new PlayerProfile('Skirmish Practice'),kit=SKIRMISH_KIT;
 Object.assign(profile,{rank:kit.rank,gold:kit.gold,difficulty:scenario.difficulty,shootingMode,cheated:true});
 for(const id of kit.skills){const skill=profile.skills.find(item=>item.id===id)??profile.addSkill(id);skill.rank=id==='arrow'?kit.basicRank:kit.skillRank;skill.threshold=(skill.rank+1)*100;skill.cooldown=0;skill.autocast=kit.autoRecruit.includes(id);}
 if(scenario.castlePractice){profile.castleLevels=new Map(scenario.castlePractice.supplied.map(({id,level})=>[id,level]));profile.castleId=scenario.castlePractice.selected.id;}
 suppliedProfiles.set(profile,scenario.code);return profile;
}
export class SkirmishProfiles extends CampaignProfiles{
 constructor(scenario,options={}){super({profiles:[createSkirmishProfile(scenario,options)],defaultName:'Skirmish Practice'});}
 get canCreate(){return false;}
 get canDelete(){return false;}
 exportBundle(){throw new Error('Skirmish has no campaign save. Copy the seed code from the workshop.');}
 importBundle(){throw new Error('Campaign saves cannot be loaded into Skirmish practice.');}
 create(){return null;}
 deleteCurrent(){return null;}
 retireCurrent(){throw new Error('Skirmish attempts are not campaign records.');}
}
export class SkirmishBattle extends CampaignBattle{
 constructor({descriptor,profile=null,shootingMode='classic',onEvent=()=>{}}={}){
  const scenario=createSkirmish(descriptor),liveProfile=profile??createSkirmishProfile(scenario,{shootingMode});
  if(!(liveProfile instanceof PlayerProfile)||!liveProfile.cheated||suppliedProfiles.get(liveProfile)!==scenario.code||usedProfiles.has(liveProfile))throw new TypeError('Skirmish requires its own assisted practice profile.');
  liveProfile.difficulty=scenario.difficulty;
  const progress=Object.fromEntries(progressionKeys.map(key=>[key,liveProfile[key]]));
  super({profile:liveProfile,level:scenario.level,random:skirmishCombatRandom(scenario.descriptor),encounter:scenario.encounter,onEvent});
  this.terrain=new SkirmishHeightField(this.encounter.heights);
  usedProfiles.add(liveProfile);this.skirmish=scenario;Object.assign(liveProfile,progress);
  if(scenario.castlePractice){
   // These are actual tickets from the advertised finite roster. They start
   // sheltered using the normal capacity API; their normal AI may leave when
   // it cannot reach a target. No hold order, timer or stat is overridden.
   for(let i=0;i<scenario.castlePractice.predeployedArchers;i++){
    if(this.enemies.take('archer')!=='archer')throw new Error('Required home archer missing from finite company');
    const unit=this.createUnit('archer');unit.x=this.badCastle.x;unit.y=this.elevationAt(unit.x);unit.facing=unit.forward;unit.vx=0;this.updateGeometry(unit);
    if(!unit.attemptGarrison(this.badCastle))throw new Error('Required home archer could not enter the keep');
   }
  }
  if(scenario.descriptor.doctrine==='levy'){this.enemies=new LevyEncounterDirector({stages:scenario.levyStages,wave:this.wave,level:this.level});this.auxiliaries=new AuxiliaryController(this);}
  if(this.encounter.objective===CAUSEWAY_OBJECTIVE){
   this.causewayObjective=new CausewayObjective(this);
   for(const [type,x] of [['grunt',1040],['grunt',1160],['tallGrunt',1100],['archer',1280],['priest',1340]]){
    if(this.enemies.take(type)!==type)throw new Error('Required Causeway guard missing from finite company');
    const unit=this.createUnit(type);unit.x=x;unit.y=this.elevationAt(x);unit.facing=unit.forward;unit.vx=0;this.updateGeometry(unit);
   }
  }
  if(this.encounter.objective===BATTERY_OBJECTIVE){
   this.batteryObjective=new BatteryObjective(this);
   for(const target of BATTERY_TARGETS){
    if(this.enemies.take('trebuchet')!=='trebuchet')throw new Error('Required siege engine missing from finite company');
    const unit=this.createUnit('trebuchet');
    unit.x=target.x;unit.y=this.elevationAt(unit.x);unit.facing=unit.forward;unit.vx=0;this.updateGeometry(unit);
    this.batteryObjective.bind(target.id,unit);
   }
   for(const entry of BATTERY_ESCORT){
    if(this.enemies.take(entry.type)!==entry.type)throw new Error('Required escort missing from finite company');
    const unit=this.createUnit(entry.type);unit.x=entry.x;unit.y=this.elevationAt(unit.x);unit.facing=unit.forward;unit.vx=0;this.updateGeometry(unit);
   }
  }
  if(this.hotbar.bar!==0)this.hotbar.change(1);this.activeSkill=this.hotbar.active;
 }
 emit(event){if(event.type==='spawn')this.auxiliaries?.claimSpawn(event.unit);super.emit(event);}
 get regularArmyCount(){return this.auxiliaries?this.goodTeam.filter(unit=>unit!==this.hero&&!unit.isCompanion&&!this.auxiliaries.owns(unit)).length:super.regularArmyCount;}
 get objectiveProgress(){return this.causewayObjective?.snapshot??this.batteryObjective?.snapshot??null;}
 get objectiveMarkers(){return this.objectiveProgress?.targets??Object.freeze([]);}
 checkOutcome(){
  if(this.encounter?.objective===CAUSEWAY_OBJECTIVE){
   if(this.outcome||!this.causewayObjective||this.causewayFrame)return;
   let decision=this.causewayObjective.decision();
   if(!decision&&this.causewayPostTick&&flagRecoveryOptions(this).state==='impossible')decision={outcome:'defeat',causes:Object.freeze(['unrecoverable-home-flag'])};
   if(!decision)return;
   if(decision.causes.length&&!Object.hasOwn(this,'causewayDefeatCauses'))Object.defineProperty(this,'causewayDefeatCauses',{value:decision.causes,enumerable:true});
   this.finishOutcome(decision.outcome);return;
  }
  if(this.skirmish?.descriptor.doctrine==='levy'||this.skirmish?.castlePractice){
   if(this.outcome||this.levyFrame)return;
   // Capture the actual terminal conditions at the authoritative whole-tick
   // check. Multiple simultaneous losses remain multiple causes; presentation
   // must not infer a first cause from HP or flags changed after settlement.
   const causes=[];
   if(this.hero.dead||this.hero.hp<=0)causes.push('hero');
   if(this.ownFlag.status===FS.CAPTURED)causes.push('flag');
   if(!(this.goodCastle.hp>0))causes.push('keep');
   if(causes.length){const key=this.skirmish.castlePractice?'castlePracticeDefeatCauses':'levyDefeatCauses';if(!Object.hasOwn(this,key))Object.defineProperty(this,key,{value:Object.freeze(causes),enumerable:true});this.finishOutcome('defeat');return;}
   if(!(this.badCastle.hp>0)&&this.enemies.remaining===0&&this.badTeam.length===0&&this.ownFlag.status===FS.AT_BASE)this.finishOutcome('victory');return;
  }
  if(this.encounter?.objective!==BATTERY_OBJECTIVE){super.checkOutcome();return;}
  if(this.outcome||!this.batteryObjective||this.batteryFrame)return;
  this.batteryObjective.update();const outcome=this.batteryObjective.outcome();
  if(outcome)this.finishOutcome(outcome);
 }
 step(){
  if(this.causewayObjective){
   if(this.paused||this.outcome||this.summary){super.step();return;}
   this.causewayFrame=true;try{super.step();}finally{this.causewayFrame=false;}
   this.causewayPostTick=true;try{this.checkOutcome();}finally{this.causewayPostTick=false;}
   if(!this.outcome&&this.causewayObjective.afterTick()){
    const retreat=this.enemies.closeReserves();
    this.armyOrders.set('advance',undefined,'all');
    this.emit({type:'causeway-secured',withdrawn:retreat?.withdrawn??0});
   }
   this.checkOutcome();return;
  }
  if(this.auxiliaries||this.skirmish?.castlePractice){
   if(this.paused||this.outcome||this.summary){super.step();return;}
   this.levyFrame=true;try{super.step();}finally{this.levyFrame=false;}
   this.checkOutcome();this.auxiliaries?.step();return;
  }
  if(!this.batteryObjective||this.paused||this.outcome||this.summary){super.step();return;}
  this.batteryFrame=true;try{super.step();}finally{this.batteryFrame=false;}
  this.checkOutcome();
 }
 finishOutcome(outcome){const progress=Object.fromEntries(progressionKeys.map(key=>[key,this.profile[key]])),accepted=super.finishOutcome(outcome);if(accepted)this.auxiliaries?.close();Object.assign(this.profile,progress);return accepted;}
 applyOptions({shootingMode=this.profile.shootingMode}={}){super.applyOptions({difficulty:this.skirmish.difficulty,shootingMode});}
}
