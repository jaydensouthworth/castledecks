/** Original optional objective. The two ordinary engines are real finite-roster
 * units, bound once at preparation. This controller changes no combat stats or AI.
 * It owns two references only: no listeners, timers, replacement spawns or saves.
 */
import {FLAG_STATUS as FS} from './flag-troop.mjs';
export const BATTERY_OBJECTIVE='intercept-battery';
export const BATTERY_TARGETS=Object.freeze([
 Object.freeze({id:'battery-1',label:'Battery I',x:1280}),
 Object.freeze({id:'battery-2',label:'Battery II',x:1580}),
]);
export const BATTERY_ESCORT=Object.freeze([
 Object.freeze({type:'grunt',x:860}),Object.freeze({type:'tallGrunt',x:1040}),
 Object.freeze({type:'mount',x:980}),Object.freeze({type:'priest',x:1170}),
]);
const hostile=unit=>unit?.type==='trebuchet'&&unit?.team==='bad'&&(unit.permanentTeam===undefined||unit.permanentTeam==='bad')&&unit.recruited!==true;
const isSecured=unit=>unit?.type==='trebuchet'&&unit.team==='good'&&[undefined,'good','bad'].includes(unit.permanentTeam);
export class BatteryObjective{
 #battle;#targets;
 constructor(battle){
  if(battle?.encounter?.objective!==BATTERY_OBJECTIVE)throw new TypeError('Battery objective requires its own encounter');
  this.#battle=battle;this.#targets=BATTERY_TARGETS.map(spec=>({spec,unit:null,neutralized:false}));
 }
 bind(id,unit){
  const target=this.#targets.find(item=>item.spec.id===id),battle=this.#battle;
  if(!target||target.unit||this.#targets.some(item=>item.unit===unit))throw new TypeError('Each battery target must be bound exactly once');
  if(unit?.type!=='trebuchet'||unit.world!==battle||!hostile(unit)||!(unit.hp>0)||!Number.isFinite(unit.hp)||!Number.isFinite(unit.maxHp)||!Number.isFinite(unit.x)||!Number.isFinite(unit.y)||unit.dead||unit.destroyed||!battle.badTeam.includes(unit)||!battle.objects.items.includes(unit))throw new TypeError('Battery targets must be living original enemy siege units in this battle');
  target.unit=unit;return unit;
 }
 update(){
  for(const target of this.#targets){const unit=target.unit;if(!target.neutralized&&unit&&hostile(unit)&&Number.isFinite(unit.hp)&&unit.hp<=0)target.neutralized=true;}
  return this.snapshot;
 }
 get snapshot(){
  const targets=this.#targets.map(({spec,unit,neutralized})=>Object.freeze({id:spec.id,label:spec.label,state:neutralized?'neutralized':isSecured(unit)?'secured':unit?'active':'pending',
   allegiance:unit?.team??null,eligible:!!unit&&hostile(unit),x:unit?.x??spec.x,y:unit?.y??this.#battle.elevationAt(spec.x),markerY:unit?unit.y-unit.height-20:this.#battle.elevationAt(spec.x)-170,
   hp:unit&&Number.isFinite(unit.hp)?Math.max(0,unit.hp):null,maxHp:unit?.maxHp??null}));
  const neutralized=targets.filter(target=>target.state==='neutralized').length,secured=targets.filter(target=>target.state==='secured').length,resolved=neutralized+secured,flagSafe=this.#battle.ownFlag.status===FS.AT_BASE;
  return Object.freeze({type:BATTERY_OBJECTIVE,title:'Silence both marked engines',total:targets.length,neutralized,secured,resolved,remaining:targets.length-resolved,
   flagSafe,state:resolved===targets.length?(flagSafe?'completed':'recover-flag'):targets.some(target=>target.state==='pending')?'pending':'active',targets:Object.freeze(targets)});
 }
 outcome(){
  const battle=this.#battle;
  // Defeat is absolute here, even if the opposing flag is already captured or
  // both engines fall on this tick. The adapter calls this after all tick phases.
  if(battle.hero.dead||battle.hero.hp<=0||battle.ownFlag.status===FS.CAPTURED)return 'defeat';
  return this.snapshot.state==='completed'?'victory':null;
 }
}
