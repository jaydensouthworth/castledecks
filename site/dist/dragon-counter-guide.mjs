/** Read-only coaching for a real resisted player Basic Arrow hit. The displayed
 * counter comes from the target's actual elemental multipliers. UI-local weak
 * state cannot retain dead actors or alter damage, RNG, AI, skills or progression.
 */
const dragons=new Set(['dragon_scout_fire','dragon_scout_ice','dragon_scout_poison']);
const counters=[{element:'fire',label:'Fire Arrow'},{element:'ice',label:'Ice Arrow'}];
export const DRAGON_COUNTER_TIMING=Object.freeze({perTarget:12*33,global:3*33,life:70});
export function createDragonCounterGuide(){
 const shown=new WeakMap();let lastShown=-Infinity;
 return event=>{
  const target=event?.target,projectile=event?.projectile,tick=event?.tick;
  if(event?.type!=='hit'||projectile?.kind!=='hero_arrow'||projectile.heroShot!==true||projectile.team!=='good'||
   !dragons.has(target?.type)||target.team!=='bad'||!(target.hp>0)||target.dead||target.destroyed||
   ![target.x,target.y,tick].every(Number.isFinite)||tick<0||!(target.multipliers?.pierce>=0&&target.multipliers.pierce<1))return null;
  const best=counters.filter(c=>Number.isFinite(target.multipliers?.[c.element])&&target.multipliers[c.element]>target.multipliers.pierce)
   .sort((a,b)=>target.multipliers[b.element]-target.multipliers[a.element])[0];
  if(!best||tick-(shown.get(target)??-Infinity)<DRAGON_COUNTER_TIMING.perTarget||tick-lastShown<DRAGON_COUNTER_TIMING.global)return null;
  shown.set(target,tick);lastShown=tick;
  return {kind:'resistance',element:best.element,x:target.x,y:target.y-(Number.isFinite(target.height)?target.height:40),
   text:'ARROW RESISTANCE',advice:`Try ${best.label}`,tick,life:DRAGON_COUNTER_TIMING.life};
 };
}
