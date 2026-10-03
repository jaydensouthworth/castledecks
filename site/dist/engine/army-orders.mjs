/** Optional modern frontline command. Advance is the original AI path.
 * Orders are transient battle state, with no economy, damage, or save mutations. */
const FRONTLINE=new Set(['grunt','tallGrunt','mount','fire_demon','ice_demon']);
export const ARMY_ORDER_MODES=Object.freeze(['advance','rally']);
export function respondsToRally(unit){return unit.team==='good'&&!unit.isCompanion&&!unit.airUnit&&FRONTLINE.has(unit.type);}
function exempt(unit){return !(unit.hp>0)||unit.dead||unit.destroyed||unit.garrisonBuilding||unit.holdingFriendFlag||unit.holdingEnemyFlag||unit.friendFlag?.status!==3;}
export class ArmyOrders {
 constructor(battle){this.battle=battle;this.mode='advance';this.anchorX=null;}
 set(mode){
  const b=this.battle;
  if(!ARMY_ORDER_MODES.includes(mode)||b.outcome||b.summary||mode==='rally'&&!(b.badCastle.hp>0))return false;
  if(mode===this.mode)return true;
  if(mode==='rally'&&!Number.isFinite(b.hero.x))return false;
  this.mode=mode;this.anchorX=mode==='rally'?Math.max(450,Math.min(b.width-350,b.hero.x+250)):null;
  // Interrupt only travel/waiting, never an attack, spell, stagger, or flag action.
  for(const u of b.goodTeam)if((respondsToRally(u)||u.type==='archer')&&!exempt(u)&&['move','block'].includes(u.actionMode))u.interruptAction();
  b.emit({type:'army-order',mode:this.mode,anchorX:this.anchorX});return true;
 }
 reset(){this.mode='advance';this.anchorX=null;}
 get snapshot(){return {mode:this.mode,anchorX:this.anchorX,affected:this.battle.goodTeam.filter(u=>respondsToRally(u)&&!exempt(u)).length};}
 activeFor(unit){return this.mode==='rally'&&!exempt(unit);}
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
