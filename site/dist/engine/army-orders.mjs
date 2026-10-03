/** Optional modern frontline command. Advance is the original AI path.
 * Orders are transient battle state, with no economy, damage, or save mutations. */
const FRONTLINE=new Set(['grunt','tallGrunt','mount','fire_demon','ice_demon']);
export const ARMY_ORDER_MODES=Object.freeze(['advance','rally']);
export const ARMY_RALLY_POSITIONS=Object.freeze(['rear','center','forward']);
export function respondsToRally(unit){return unit.team==='good'&&!unit.isCompanion&&!unit.airUnit&&FRONTLINE.has(unit.type);}
function exempt(unit){return !(unit.hp>0)||unit.dead||unit.destroyed||unit.garrisonBuilding||unit.holdingFriendFlag||unit.holdingEnemyFlag||unit.friendFlag?.status!==3;}
/** Named lines are world-space landmarks, independent of the hero or camera.
 * Rear keeps the legacy opening line; Center contests midfield; Forward stages
 * below the enemy keep. Bounds retain room for the archers behind each line. */
export function armyRallyAnchor(battle,position='rear'){
 if(!ARMY_RALLY_POSITIONS.includes(position)||!Number.isFinite(battle.width)||battle.width<=0)return null;
 const low=Math.min(450,battle.width/2),high=Math.max(low,battle.width-350),clamp=x=>Math.max(low,Math.min(high,x));
 const rear=clamp(Number.isFinite(battle.goodCastle?.x)?battle.goodCastle.x+250:low);
 const forward=Math.max(rear,clamp(Number.isFinite(battle.badCastle?.x)?battle.badCastle.x-300:high));
 const x=position==='rear'?rear:position==='forward'?forward:(rear+forward)/2;
 return Number.isFinite(battle.elevationAt(x))?x:null;
}
export class ArmyOrders {
 constructor(battle){this.battle=battle;this.reset();}
 set(mode,position=this.position){
  const b=this.battle;
  if(!ARMY_ORDER_MODES.includes(mode)||!ARMY_RALLY_POSITIONS.includes(position)||b.outcome||b.summary)return false;
  if(mode==='rally'&&(!(b.badCastle.hp>0)||!(b.hero.hp>0)||b.hero.dead||!Number.isFinite(b.hero.x)))return false;
  if(mode===this.mode&&(mode==='advance'||position===this.position))return true;
  const anchor=mode==='rally'?armyRallyAnchor(b,position):null;
  if(mode==='rally'&&anchor===null)return false;
  this.mode=mode;this.anchorX=anchor;if(mode==='rally')this.position=position;
  // Interrupt only travel/waiting, never an attack, spell, stagger, or flag action.
  for(const u of b.goodTeam)if((respondsToRally(u)||u.type==='archer')&&!exempt(u)&&['move','block'].includes(u.actionMode))u.interruptAction();
  b.emit({type:'army-order',mode:this.mode,position:this.position,anchorX:this.anchorX});return true;
 }
 reset(){this.mode='advance';this.position='rear';this.anchorX=null;}
 get snapshot(){return {mode:this.mode,position:this.position,anchorX:this.anchorX,affected:this.battle.goodTeam.filter(u=>respondsToRally(u)&&!exempt(u)).length};}
 activeFor(unit){return this.mode==='rally'&&!this.battle.outcome&&!this.battle.summary&&this.battle.badCastle.hp>0&&!exempt(unit);}
 frontlineAction(unit){
  if(!respondsToRally(unit)||!this.activeFor(unit))return null;
  if(unit.x<this.anchorX-24)return 'advance';
  if(unit.x>this.anchorX+24)return 'retreat';
  return 'block';
 }
 archerAction(unit,target){
  if(unit.team!=='good'||unit.isCompanion||!this.activeFor(unit))return null;
  // Only replace a pursuit move when no ordinary ranged shot is available.
  const line=this.anchorX-100;
  if(unit.x>line+12)return 'retreat';
  if(target.x>line&&unit.x>=line-12)return 'block';
  return null;
 }
}
