/** Explicit synthetic staging for a disposable load lab. Never accepts a source
 * profile, save, account or storage service. Ordinary constructors, stats, AI,
 * actor steps, role orders and engine caps remain unchanged. */
import {SkirmishBattle,SkirmishProfiles} from './skirmish-battle.mjs';
import {createSkirmish,SKIRMISH_THREATS} from './skirmish-model.mjs';
import {battleFieldLimits} from './engine/battle-director.mjs';
import {LEVY_LIMITS} from './engine/auxiliary-controller.mjs';
import {TICK_HZ} from './engine/clock.mjs';
import {FLAG_STATUS} from './engine/flag-troop.mjs';
const freshBattles=new WeakSet();
export const STRESS_FIELD_SECONDS=120;
export const STRESS_FIELD_PRESETS=Object.freeze(['standard','veteran']);
export const isStressField=battle=>freshBattles.has(battle);
const alive=unit=>unit.hp>0&&!unit.dead&&!unit.destroyed;
const ordinaryTypes=Object.freeze(['grunt','grunt','grunt','grunt','archer','archer','archer','archer','priest','priest','mount','mount','trebuchet','trebuchet','tallGrunt','tallGrunt']);
const enemyTypes=Object.freeze(['grunt','grunt','grunt','grunt','grunt','grunt','archer','archer','archer','archer','priest','priest','mount','mount','mount','mount','tallGrunt','tallGrunt','trebuchet','trebuchet','grunt','grunt']);
export function stressFieldLimits(preset){
 if(!STRESS_FIELD_PRESETS.includes(preset))throw new RangeError('Choose Standard or Veteran synthetic field');
 const tier=SKIRMISH_THREATS[preset],caps=battleFieldLimits(tier.level);
 return Object.freeze({level:tier.level,difficulty:tier.difficulty,ordinary:caps.friendly,auxiliary:LEVY_LIMITS.cap,enemy:caps.enemy,total:caps.friendly+LEVY_LIMITS.cap+caps.enemy});
}
class StressProfiles extends SkirmishProfiles{
 exportBundle(){throw new Error('Synthetic field supplies cannot be exported. Return to the playground first.');}
 importBundle(){throw new Error('Synthetic fields cannot load campaign or account saves.');}
}
class StressBattle extends SkirmishBattle{
 constructor({preset,profiles,onEvent}){
  // Staging events are not elapsed gameplay or profiler samples. Install the
  // consumer only after a complete coherent initial field exists.
  const limits=stressFieldLimits(preset),descriptor={version:1,seed:660048,biome:'oaks',threat:preset,doctrine:'levy'};
  super({descriptor,profile:profiles.active,onEvent:()=>{}});
  this.testing=true;this.profile.name='Synthetic field';this.profile.gold=0;this.friendlyQueue.population=0;this.stats.populationGiven=0;
  for(const skill of this.profile.skills)skill.autocast=false;
  // Use the real controller API and private ownership. Advance only its staging
  // clock; world actors and effects have not stepped. Keep time monotonic.
  this.tick=1;
  for(let wave=1;wave<=LEVY_LIMITS.cap/LEVY_LIMITS.waveSize;wave++){
   this.paused=true;if(!this.auxiliaries.callWave(wave))throw new Error('Synthetic levy staging rejected');
   this.paused=false;
   for(let i=0;i<LEVY_LIMITS.waveSize;i++){this.tick+=LEVY_LIMITS.interval;this.auxiliaries.step();}
  }
  this.auxiliaries.close();
  // Close this attempt's director; no ordinary/natural encounter is changed.
  this.enemies.closeReserves();this.enemies.status=()=> 'Synthetic supplies · no reinforcements';
  const place=(unit,x)=>{unit.x=x;unit.y=this.elevationAt(x);unit.visible=true;unit.facing=unit.forward;this.updateGeometry(unit);return unit;};
  const ordinary=ordinaryTypes.slice(0,limits.ordinary).map((type,index)=>{
   const skill=this.profile.skills.find(s=>s.id===type)??this.profile.addSkill(type);skill.rank=LEVY_LIMITS.rank;skill.autocast=false;
   return place(this.createUnit(type,{team:'good',rank:LEVY_LIMITS.rank,skill}),type==='trebuchet'?560+(index%2)*65:650+(index%8)*37);
  });
  this.auxiliaries.snapshot.units.forEach((unit,index)=>place(unit,730+index*26));
  const enemies=enemyTypes.slice(0,limits.enemy).map((type,index)=>place(this.createUnit(type,{team:'bad',rank:LEVY_LIMITS.rank}),type==='trebuchet'?1630+(index%2)*65:1130+(index%10)*36));
  this.stressField={kind:'synthetic-stress-field',preset,limits,runStartTick:this.tick,durationTicks:STRESS_FIELD_SECONDS*TICK_HZ,stopped:false,stopReason:null};
  freshBattles.add(this);this.paused=true;this.onEvent=onEvent;
  if(ordinary.length!==limits.ordinary||enemies.length!==limits.enemy||this.auxiliaries.snapshot.occupied!==limits.auxiliary)throw new Error('Incomplete synthetic field');
 }
 checkOutcome(){} // This disposable adapter never enters campaign settlement.
 finishOutcome(){return false;}
 step(){
  const field=this.stressField;if(!field||field.stopped||this.paused)return;
  super.step();
  const reason=this.hero.hp<=0||this.hero.dead?'Hero fell':!(this.goodCastle.hp>0)?'Home keep fell':this.ownFlag.status===FLAG_STATUS.CAPTURED?'Home flag captured':this.badTeam.length===0?'Enemy field cleared':this.tick-field.runStartTick>=field.durationTicks?'120 simulation seconds reached':null;
  if(reason){field.stopped=true;field.stopReason=reason;this.paused=true;this.cancelPlayerShots();this.emit({type:'synthetic-field-stopped',reason});}
 }
 dispose(){if(this.stressField.stopped&&this.stressField.stopReason==='Disposed')return false;this.stressField.stopped=true;this.stressField.stopReason='Disposed';this.paused=true;this.cancelPlayerShots();this.auxiliaries.close();this.onEvent=()=>{};return true;}
}
export function createStressField({preset='standard',shootingMode='auto_aim',onEvent=()=>{}}={}){
 stressFieldLimits(preset);if(typeof onEvent!=='function')throw new TypeError('Expected event callback');
 const descriptor={version:1,seed:660048,biome:'oaks',threat:preset,doctrine:'levy'},scenario=createSkirmish(descriptor),profiles=new StressProfiles(scenario,{shootingMode});
 return Object.freeze({profiles,battle:new StressBattle({preset,profiles,onEvent})});
}
export function stressFieldSnapshot(battle){
 if(!isStressField(battle))return null;
 const world=new Set(battle.objects.items),roster=[...new Set([...battle.goodTeam,...battle.badTeam])].filter(u=>u!==battle.hero&&!u.isCompanion&&world.has(u)),aux=roster.filter(u=>battle.auxiliaries.owns(u)),ordinary=roster.filter(u=>u.team==='good'&&!battle.auxiliaries.owns(u)),enemy=roster.filter(u=>u.team==='bad'&&!battle.auxiliaries.owns(u));
 const count=units=>Object.freeze({occupied:units.length,alive:units.filter(alive).length});
 return Object.freeze({kind:'synthetic-stress-field',preset:battle.stressField.preset,limits:battle.stressField.limits,ordinary:count(ordinary),auxiliary:count(aux),enemy:count(enemy),troops:count(roster),elapsedSeconds:(battle.tick-battle.stressField.runStartTick)/TICK_HZ,stopped:battle.stressField.stopped,stopReason:battle.stressField.stopReason});
}
export function stressFieldCopy(battle,s=stressFieldSnapshot(battle)){
 if(!s)return null;
 return {title:'Synthetic stress field',detail:`Staged supplies · ${s.ordinary.occupied} ordinary + ${s.auxiliary.occupied} temporary + ${s.enemy.occupied} enemy bodies · ${s.troops.alive} troops alive. Hero and structures are separate.`,status:`${s.stopped?s.stopReason:battle.paused?'Paused':'Running'} · ${s.elapsedSeconds.toFixed(1)} / ${STRESS_FIELD_SECONDS} simulation seconds. Normal troop stats and AI; no replacements or campaign rewards.`,notice:'This artificially staged load is not a natural enemy wave or a performance result. Arm the 30-second report before Resume. Reset and Return discard all supplied state.'};
}
