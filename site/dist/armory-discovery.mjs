import {armoryCardState} from './armory-catalog-model.mjs';
/** Editorial collections use existing cards at their full individual prices.
 * They are shopping plans, not discounted bundles or gameplay bonuses.
 */
export const ARMORY_PLANS=Object.freeze([
 {id:'hold-the-line',name:'Hold the line',eyebrow:'FRONTLINE + SUPPORT',tone:'healing',ids:['tallGrunt','priest','healWave'],summary:'Keep a durable ground force supported as it advances.',synergy:'Heavy infantry provide a front line. Priests and Healing Wave restore living allies near them.',tradeoff:'You still pay gold and reserve to deploy squads. Healers do not repair siege engines, and this plan has no airborne attacker.'},
 {id:'frost-and-fire',name:'Frost & fire',eyebrow:'CONTROL + PRESSURE',tone:'ice',ids:['iceArrow','fireArrow','fireWave'],summary:'Choose when to slow a target or pressure the ground with fire.',synergy:'Ice slows affected targets; Fire Arrow leaves a burn. Fire Wave adds repeated hits along the terrain.',tradeoff:'Overlapping fire and ice remnants or statuses can cancel each other. Choose your timing or separate targets. There is no combo bonus; enemy resistance changes results, and ground waves are not a dedicated aerial answer.'},
 {id:'take-the-skies',name:'Take the skies',eyebrow:'AIRBORNE ARMY',tone:'poison',ids:['air','poisonDragon','iceDragon'],summary:'Build a flying wing with patrol shots, poison and slowing frost.',synergy:'The Air Fighter and both dragons are airborne and protected from allied attacks. Each contract adds a different attack effect.',tradeoff:'Enemy attacks can still hurt flyers. Each deployment spends gold and reserve, and flying units do not carry flags.'},
 {id:'siege-and-escort',name:'Siege & escort',eyebrow:'ARMY + COMPANION',tone:'companion',ids:['trebuchet','grunt','gorath'],summary:'Pair a siege engine with ground bodies and a separate companion.',synergy:'Foot soldiers advance on the ground while the Trebuchet launches siege shots. Gorath has his own slot and a ground-area signature.',tradeoff:'Gorath costs gold each time you summon. Trebuchets cannot be healed. These purchases do not automatically deploy an army.'}
]);
export function discoveryPlans(records,snapshot){
 const byId=new Map(records.map(item=>[item.id,item]));
 return ARMORY_PLANS.map(plan=>{const items=plan.ids.map(id=>byId.get(id)).filter(Boolean);const missing=items.filter(item=>!armoryCardState(item,snapshot).owned);return {...plan,items,missing,total:missing.reduce((sum,item)=>sum+item.price,0),owned:items.length-missing.length};}).filter(plan=>plan.items.length===plan.ids.length);
}
export function budgetPicks(records,snapshot,budget,limit=4){
 const ceiling=Math.max(0,Number(budget)||0);
 return records.filter(item=>item.storefront!==false&&armoryCardState(item,snapshot).eligible&&item.price<=ceiling).sort((a,b)=>a.price-b.price||a.order-b.order).slice(0,Math.min(12,Math.max(0,limit)));
}

/** A small, stable window into the actual catalog, one card per department.
 * Editorial order only: never implies popularity, stock, rarity or a discount.
 * Missing/hidden representatives fall back to the department's catalog order.
 */
export function shopfrontCards(records,departments,limit=4){
 const preferred={bow:'fireArrow',army:'tallGrunt',companions:'gorath',castles:'highwatch'};
 const visible=records.filter(item=>item.storefront!==false),chosen=[];
 for(const department of departments){
  const items=visible.filter(item=>item.department===department.id);
  const item=items.find(item=>item.id===preferred[department.id])??items.find(item=>item.price>0)??items[0];
  if(item&&!chosen.some(value=>value.id===item.id))chosen.push(item);
 }
 return chosen.slice(0,Math.min(4,Math.max(0,Math.floor(Number(limit)||0))));
}
