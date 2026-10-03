/** UI input adapter. The engine source and methods stay unchanged.
 * Integrate beforeTick()/afterTick() immediately around the existing battle.step.
 * clear() belongs in the UI's existing interruption/transition clearInput path.
 * Use choose() for HTML controls and keyboard edges; keep held-digit polling unchanged.
 */
import {SKILLS} from './engine/progression.mjs';
export function createLiveSkillAdapter(battle,{canAct=()=>!battle.paused&&!battle.outcome&&!battle.summary,onSummonResult=()=>{}}={}) {
 const hotbar=battle.hotbar,queue=[];
 let inFlight=null;
 const resolved=skill=>{
  for(let bar=0;bar<hotbar.bars.length;bar++)for(let slot=0;slot<hotbar.bars[bar].length;slot++)
   if(hotbar.bars[bar][slot]===skill)return {bar,slot,skill};
  return null;
 };
 const priorChanged=hotbar.changed,priorActivate=hotbar.activate;
 // Hotbar already exposes these per-instance callbacks. Do not replace any
 // method or alter engine files, phase order, reinforcement timers or cooldowns.
 hotbar.changed=function(bar) {
  if(inFlight && !inFlight.consumed && bar===hotbar && bar.bar===inFlight.ref.bar && bar.glow===inFlight.ref.slot) {
   bar.bar=inFlight.visibleBar;bar.glow=inFlight.visibleGlow;inFlight.consumed=true;
  }
  return priorChanged.call(this,bar);
 };
 hotbar.activate=function(skill) {
  const accepted=priorActivate.call(this,skill);
  if(inFlight&&!inFlight.consumed&&inFlight.ref.skill===skill)inFlight.accepted=accepted;
  return accepted;
 };
 const restore=()=>{if(inFlight){hotbar.bar=inFlight.visibleBar;hotbar.glow=inFlight.visibleGlow;}};
 return {
  get pending(){return queue.length+(inFlight?1:0);},
  choose(skill) {
   if(!canAct())return false;
   const ref=resolved(skill);if(!ref)return false;
   if(SKILLS[skill.id]?.summon){queue.push(skill);return true;}
   hotbar.bar=ref.bar;hotbar.select(ref.slot);battle.activeSkill=hotbar.active;battle.queuedSelection=null;return true;
  },
  beforeTick() {
   if(inFlight||!canAct()||!queue.length)return;
   const skill=queue.shift(),ref=resolved(skill);
   if(!ref){onSummonResult({skill,accepted:false,cancelled:true,reason:'unbound'});return;}
   inFlight={ref,visibleBar:hotbar.bar,visibleGlow:hotbar.glow,consumed:false};
   hotbar.bar=ref.bar;battle.selectSkill(ref.slot);
  },
  afterTick() {
   if(!inFlight)return;
   const result=inFlight;
   if(!result.consumed){restore();battle.queuedSelection=null;}
   inFlight=null;
   onSummonResult({skill:result.ref.skill,accepted:result.accepted===true,cancelled:!result.consumed});
  },
  clear() {queue.length=0;restore();inFlight=null;battle.queuedSelection=null;},
  dispose() {this.clear();hotbar.changed=priorChanged;hotbar.activate=priorActivate;}
 };
}
