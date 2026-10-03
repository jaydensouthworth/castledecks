/** Transient ground-company orders. Advance keeps the original AI path exactly.
 * No actor roster, economy, statistics, skill, or save state lives here. */
const FRONTLINE=new Set(['grunt','tallGrunt','mount','fire_demon','ice_demon']);
const SUPPORT=new Set(['archer','priest']);
export const ARMY_ORDER_MODES=Object.freeze(['advance','rally']);
export const ARMY_ORDER_GROUPS=Object.freeze(['all','frontline','support']);
export const ARMY_RALLY_POSITIONS=Object.freeze(['rear','center','forward']);
export function armyCompany(unit){
 if(unit.team!=='good'||unit.isCompanion||unit.airUnit)return null;
 return FRONTLINE.has(unit.type)?'frontline':SUPPORT.has(unit.type)?'support':null;
}
export function respondsToRally(unit){return armyCompany(unit)==='frontline';}
function exempt(unit){return !(unit.hp>0)||unit.dead||unit.destroyed||unit.garrisonBuilding||unit.holdingFriendFlag||unit.holdingEnemyFlag||unit.friendFlag?.status!==3;}
/** Fixed world landmarks, independent of the hero and camera. Support stands
 * 100 world units behind its chosen landmark, on the same real terrain. */
export function armyRallyAnchor(battle,position='rear'){
 if(!ARMY_RALLY_POSITIONS.includes(position)||!Number.isFinite(battle.width)||battle.width<=0)return null;
 const low=Math.min(450,battle.width/2),high=Math.max(low,battle.width-350),clamp=x=>Math.max(low,Math.min(high,x));
 const rear=clamp(Number.isFinite(battle.goodCastle?.x)?battle.goodCastle.x+250:low);
 const forward=Math.max(rear,clamp(Number.isFinite(battle.badCastle?.x)?battle.badCastle.x-300:high));
 const x=position==='rear'?rear:position==='forward'?forward:(rear+forward)/2;
 return Number.isFinite(battle.elevationAt(x))?x:null;
}
const freshOrder=()=>({mode:'advance',position:'rear',anchorX:null});
export class ArmyOrders {
 constructor(battle){this.battle=battle;this.reset();}
 get mode(){const a=this.groups.frontline,b=this.groups.support;return a.mode===b.mode&&(a.mode==='advance'||a.position===b.position)?a.mode:'split';}
 get anchorX(){return this.mode==='rally'?this.groups.frontline.anchorX:null;}
 set(mode,position,group='all'){
  const b=this.battle;
  if(!ARMY_ORDER_MODES.includes(mode)||!ARMY_ORDER_GROUPS.includes(group)||b.outcome||b.summary)return false;
  if(position===undefined)position=group==='all'?this.position:this.groups[group].position;
  if(!ARMY_RALLY_POSITIONS.includes(position))return false;
  if(mode==='rally'&&(!(b.badCastle.hp>0)||!(b.hero.hp>0)||b.hero.dead||!Number.isFinite(b.hero.x)))return false;
  const anchor=mode==='rally'?armyRallyAnchor(b,position):null;
  if(mode==='rally'&&(anchor===null||!Number.isFinite(b.elevationAt(anchor-100))))return false;
  const targets=group==='all'?['frontline','support']:[group];
  const changed=targets.filter(key=>{const order=this.groups[key];return order.mode!==mode||mode==='rally'&&order.position!==position;});
  if(!changed.length)return true;
  for(const key of targets){const order=this.groups[key];order.mode=mode;order.anchorX=anchor;if(mode==='rally')order.position=position;}
  if(mode==='rally'&&(group==='all'||this.mode==='rally'))this.position=position;
  // Travel/wait only. A committed attack, spell, stagger, death or flag action
  // finishes normally and observes its company order at the next AI boundary.
  for(const u of b.goodTeam)if(changed.includes(armyCompany(u))&&!exempt(u)&&['move','block'].includes(u.actionMode))u.interruptAction();
  b.emit({type:'army-order',mode:this.mode,position:this.position,anchorX:this.anchorX,group,issuedMode:mode,issuedPosition:position});return true;
 }
 reset(){this.groups={frontline:freshOrder(),support:freshOrder()};this.position='rear';}
 get snapshot(){
  const counts={frontline:0,support:0};
  for(const u of this.battle.goodTeam){const group=armyCompany(u);if(group&&!exempt(u))counts[group]++;}
  return {mode:this.mode,position:this.position,anchorX:this.anchorX,affected:counts.frontline+counts.support,
   groups:Object.fromEntries(['frontline','support'].map(group=>[group,{...this.groups[group],affected:counts[group]}]))};
 }
 activeFor(unit){
  const group=armyCompany(unit);
  return !!group&&this.groups[group].mode==='rally'&&!this.battle.outcome&&!this.battle.summary&&this.battle.badCastle.hp>0&&!exempt(unit);
 }
 frontlineAction(unit){
  if(!respondsToRally(unit)||!this.activeFor(unit))return null;
  const x=this.groups.frontline.anchorX;
  if(unit.x<x-24)return 'advance';
  if(unit.x>x+24)return 'retreat';
  return 'block';
 }
 supportAction(unit){
  if(armyCompany(unit)!=='support'||!this.activeFor(unit))return null;
  const x=this.groups.support.anchorX-100;
  // A complete ordinary walk segment is 40 units. A 48-unit band avoids
  // toggling forever across a narrower line while preserving walk animation.
  if(unit.x<x-24)return 'advance';
  if(unit.x>x+24)return 'retreat';
  return 'block';
 }
 archerAction(unit){return unit.type==='archer'?this.supportAction(unit):null;}
}
