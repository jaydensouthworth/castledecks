/** Optional original ground-control objective. No profile, economy, spawn or
 * render writes occur here. The adapter calls afterTick only after the entire
 * ordinary simulation tick; reads never award occupation time. */
import {Hero} from './actors.mjs';
import {FlagTroop,FLAG_STATUS as FS} from './flag-troop.mjs';
import {TestBoss} from './later-enemies.mjs';
export const CAUSEWAY_OBJECTIVE='causeway-hold';
export const CAUSEWAY_RULES=Object.freeze({left:990,right:1110,requiredTicks:990,ticksPerSecond:33});
const controllers=new WeakMap();
const live=u=>u?.hp>0&&!u.dead&&!u.destroyed;
const groundActor=u=>u instanceof Hero||u instanceof FlagTroop||u instanceof TestBoss;
export function causewayOccupants(battle){
 const actual=new Set(battle.objects?.items??[]),seen=new Set(),friendly=[],hostile=[];
 for(const u of [...(battle.goodTeam??[]),...(battle.badTeam??[])]){
  if(seen.has(u))continue;seen.add(u);
  if(!actual.has(u)||!groundActor(u)||u.world!==battle||u.isFighter!==true||!live(u)||u.airUnit||u.lifeType==='vehicle'||u.garrisonBuilding||u.visible===false||!Number.isFinite(u.x)||!Number.isFinite(u.y)||u.x<CAUSEWAY_RULES.left||u.x>CAUSEWAY_RULES.right)continue;
  if(u.team==='good'){if(!u.holdingFriendFlag&&!u.holdingEnemyFlag)friendly.push(u);}else if(u.team==='bad')hostile.push(u);
 }
 return {friendly,hostile};
}
export function causewayMandatoryLosses(battle){
 const causes=[];if(battle.hero.dead||!(battle.hero.hp>0))causes.push('hero');if(battle.ownFlag.status===FS.CAPTURED)causes.push('flag');if(battle.goodCastle.destroyed||!(battle.goodCastle.hp>0))causes.push('keep');return causes;
}
/** This capability comes from the actual registered objective, not seed/UI
 * metadata or a forged property on a battle. Ordinary worlds return false. */
export function causewayNeedsOccupation(battle){return controllers.get(battle)?.needsOccupation===true;}
/** Null preserves the ordinary mode's historical HP-only keep gate. Only a
 * registered Causeway controller can extend Rally or apply its destroyed guard. */
export function causewayRallyAvailability(battle){
 const objective=controllers.get(battle);if(!objective)return null;
 return objective.needsOccupation||!battle.badCastle.destroyed&&battle.badCastle.hp>0;
}
export class CausewayObjective{
 #battle;#ticks=0;#lastTick=-1;#secured=false;
 constructor(battle){
  if(battle?.encounter?.objective!==CAUSEWAY_OBJECTIVE||!battle.hero||!battle.ownFlag||!battle.objects?.items||controllers.has(battle))throw new TypeError('Causeway requires one explicit objective per actual battle');
  this.#battle=battle;controllers.set(battle,this);
 }
 get needsOccupation(){const b=this.#battle;return !this.#secured&&!b.outcome&&!b.summary&&b.encounter?.objective===CAUSEWAY_OBJECTIVE&&causewayMandatoryLosses(b).length===0;}
 get snapshot(){
  const b=this.#battle,{friendly,hostile}=causewayOccupants(b),losses=causewayMandatoryLosses(b);
  const phase=b.outcome==='defeat'||losses.length?'defeat':b.outcome==='victory'?'victory':b.ownFlag.status!==FS.AT_BASE?'recover-flag':this.#secured?'cleanup':hostile.length?'contested':friendly.length?'holding':'empty';
  const liveEnemies=b.badTeam.filter(live).length;
  return Object.freeze({type:CAUSEWAY_OBJECTIVE,phase,ticks:this.#ticks,requiredTicks:CAUSEWAY_RULES.requiredTicks,seconds:this.#ticks/CAUSEWAY_RULES.ticksPerSecond,requiredSeconds:30,ratio:this.#ticks/CAUSEWAY_RULES.requiredTicks,secured:this.#secured,friendly:friendly.length,hostile:hostile.length,liveEnemies,clearingEnemies:b.badTeam.length-liveEnemies,reserves:b.enemies.remaining,bounds:CAUSEWAY_RULES});
 }
 afterTick(){
  const b=this.#battle;
  if(b.paused||b.outcome||b.summary||!Number.isSafeInteger(b.tick)||b.tick<=0||b.tick<=this.#lastTick)return false;
  this.#lastTick=b.tick;
  if(!this.needsOccupation||b.ownFlag.status!==FS.AT_BASE)return false;
  const {friendly,hostile}=causewayOccupants(b);if(!friendly.length||hostile.length)return false;
  this.#ticks++;
  if(this.#ticks===CAUSEWAY_RULES.requiredTicks){this.#secured=true;return true;}
  return false;
 }
 /** Pure terminal decision. Stranded-flag recovery proof is a separate adapter
  * gate; it must not be inferred from a displayed roster or current gold alone. */
 decision(){
  const b=this.#battle;if(b.outcome||b.summary)return null;
  const causes=causewayMandatoryLosses(b);if(causes.length)return Object.freeze({outcome:'defeat',causes:Object.freeze(causes)});
  return this.#secured&&b.enemies.remaining===0&&b.badTeam.length===0&&b.ownFlag.status===FS.AT_BASE?Object.freeze({outcome:'victory',causes:Object.freeze([])}):null;
 }
}
