import {cardTactics} from './card-tactics.mjs';
/** Shared, data-only card identity for the market and collection editor.
 * A tone is a visual effect family, never a rarity or power rating.
 */
const labels={fire:'Fire',ice:'Ice',poison:'Poison',lightning:'Lightning',explosive:'Explosive',healing:'Healing',steel:'Steel',companion:'Companion'};
const roleLabels={frontline:'Frontline',ranged:'Ranged',support:'Support',siege:'Siege',bow:'Bow ability',companion:'Companion'};
const special={arrow:'A reliable opening shot',fireArrow:'Hit, then burn',iceArrow:'Strike and slow',pierceArrow:'Heavy piercing impact',bombArrow:'Impact and splash',flakArrow:'Detonate in flight',thunderArrow:'Call a lightning cloud',meteorArrow:'Fire from above',cometArrow:'Ice from above',bombWave:'Ground explosions',fireWave:'A rolling wall of fire',iceWave:'Frost along the ground',healWave:'Restore living allies',air:'Airborne patrol',poisonDragon:'Poison from the skies',fireDragon:'Flying fire support',iceDragon:'Flying frost support',fireDemon:'Fire at the front line',iceDemon:'Frost at the front line',gorath:'A companion of your own'};
const n=value=>Number.isFinite(Number(value))?Number(value).toLocaleString(undefined,{maximumFractionDigits:2}):'—';
export function cardIdentity(item){
 const tactics=cardTactics(item),traits=item.traits??[],tone=item.kind==='companion'?'companion':['fire','ice','poison','lightning','explosive','healing'].find(value=>traits.includes(value))??'steel';
 const label=item.kind==='companion'?'Companion':item.department==='army'?`${traits.includes('airborne')?'Airborne · ':''}${roleLabels[item.role]??'Army'}`:item.category==='waves'?`${labels[tone]} wave`:`${labels[tone]} shot`;
 const facts=item.kind==='companion'?[{label:'Summon',value:`${n(item.summonCost)} gold`},{label:'Command',value:'Separate slot'}]:item.squad?[{label:'Squad',value:`${n(item.squad.size)} units`},{label:'Deploy',value:`${n(item.squad.gold)} gold · ${n(item.squad.reserve)} reserve`}]:[{label:'Reload',value:`${n(item.reloadSeconds)}s`},{label:'Delivery',value:item.category==='waves'?'Ground wave':'Bow cast'}];
 return {tone,label,headline:tactics?.subtitle??special[item.id]??roleLabels[item.role]??'Explore this card',facts,tactics};
}
/** These are open-ended catalog fields, not invented availability rules.
 * Unknown editions can be supplied with an honest label/source in future data.
 */
export const STANDARD_EDITION=Object.freeze({id:'standard',label:'Standard collection',availability:'Always in the catalog',limited:false});
