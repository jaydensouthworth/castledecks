/** Passive presentation clocks. Engine timers, frames, RNG and requests are unchanged. */
const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
const clamp=value=>Math.max(0,Math.min(1,value));
const ease=value=>{const t=clamp(value);return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;

export function airMotion(unit,record={}){
 const powered=unit.hp>0&&!unit.dead&&unit.hp/unit.maxHp>.2;
 return {powered,wingLift:powered?Math.sin(finite(record.age)*.32+finite(record.phase))*14:-22};
}

/** Cup reaches (0,-150), the unchanged actual projectile origin, on release.
 * A delayed valid target records its actual fired transition, never a fake shot. */
export function siegeMotion(unit,record={}){
 const cocked=-Math.PI+.35,release=-Math.PI/2,follow=-.6;
 const duration=Math.max(1,finite(unit.releaseTime,160)),remaining=finite(unit.actionDuration);
 let angle=cocked,loaded=['load_ammo','aim','release_ammo'].includes(unit.actionMode);
 if(unit.actionMode==='release_ammo'){
  if(!unit.fired)angle=mix(cocked,release,ease((duration-remaining)/Math.max(1,duration-130)));
  else{
   const anchor=finite(record.firedRemaining,130),elapsed=Math.max(0,anchor-remaining),followTime=Math.min(14,Math.max(1,anchor));
   angle=elapsed<=followTime?mix(release,follow,ease(elapsed/followTime)):
    mix(follow,cocked,ease((elapsed-followTime)/Math.max(1,anchor-followTime)));
   loaded=false;
  }
 }
 const pivot={x:0,y:-68};
 return {angle,loaded,pivot,tip:{x:82*Math.cos(angle),y:pivot.y+82*Math.sin(angle)},weight:{x:-26*Math.cos(angle),y:pivot.y-26*Math.sin(angle)}};
}

export function createSpecialMotionController(){
 let records=new WeakMap(),battle=null,lastTick=0,ordinal=0;
 const track=unit=>{
  if(!unit||!(unit.airUnit||unit.type==='trebuchet'||unit.type==='gorath'))return null;
  if(!records.has(unit))records.set(unit,{age:0,phase:ordinal++*2.399963229728653,
   mode:unit.actionMode,fired:!!unit.fired,firedRemaining:unit.fired?finite(unit.actionDuration,130):null,
   axeLanded:!!unit.axeLanded,impactAge:null});
  return records.get(unit);
 };
 return {
  attach(next){records=new WeakMap();ordinal=0;battle=next;lastTick=battle.tick;for(const u of [...battle.goodTeam,...battle.badTeam])track(u);},
  event(event){if(event.type==='spawn')track(event.unit);if(event.type==='companion-signature'){const r=track(event.unit);if(r)r.impactAge=0;}},
  observeTick({actorsAdvanced=true}={}){
   if(!battle)return;const elapsed=Math.max(0,battle.tick-lastTick);lastTick=battle.tick;
   if(!actorsAdvanced||elapsed===0)return;
   for(const unit of [...battle.goodTeam,...battle.badTeam]){
    const r=track(unit);if(!r)continue;r.age+=elapsed;if(r.impactAge!==null)r.impactAge+=elapsed;
    if(unit.type==='trebuchet'){
     if(r.mode!==unit.actionMode){r.fired=false;r.firedRemaining=null;}
     if(unit.actionMode==='release_ammo'&&unit.fired&&!r.fired)r.firedRemaining=finite(unit.actionDuration,130);
     r.fired=!!unit.fired;r.mode=unit.actionMode;
    }
    if(unit.type==='gorath'){if(unit.axeLanded&&!r.axeLanded)r.impactAge=0;r.axeLanded=!!unit.axeLanded;}
   }
  },
  air(unit){return airMotion(unit,records.get(unit));},
  siege(unit){return siegeMotion(unit,records.get(unit));},
  record(unit){return records.get(unit)??{};},
 };
}
