/** Presentation metadata grounded in the existing abilities and recruit data.
 * Prices/reload/squad sizes remain sourced from the engine. No rarity, packs,
 * collectible odds, invented progression, or duplicate placeholder content.
 */
export const ARMORY_DEPARTMENTS=Object.freeze([
 {id:'bow',name:'Bow abilities',description:'Shots, waves and battlefield magic.',categories:['arrows','waves'],facets:['fire','ice','lightning','explosive','healing'],action:'Unlock and assign to an action bar'},
 {id:'army',name:'Army contracts',description:'Recruit squads for your battle line.',categories:['army'],facets:['ground','airborne','healing','siege','fire','ice','poison'],action:'Unlock, equip, then pay per squad'},
 {id:'companions',name:'Companions',description:'Persistent allies with their own command slot.',categories:['companions'],facets:[],action:'Hire and equip in the companion slot'}
]);
const ROLES=Object.freeze({grunt:'frontline',tallGrunt:'frontline',mount:'frontline',fireDemon:'frontline',iceDemon:'frontline',archer:'ranged',air:'ranged',poisonDragon:'ranged',fireDragon:'ranged',iceDragon:'ranged',priest:'support',trebuchet:'siege'});
const TRAITS=Object.freeze({fireArrow:['fire'],iceArrow:['ice'],bombArrow:['explosive'],flakArrow:['explosive'],bombWave:['explosive'],fireWave:['fire'],iceWave:['ice'],healWave:['healing'],thunderArrow:['lightning'],meteorArrow:['fire'],cometArrow:['ice'],grunt:['ground'],archer:['ground'],tallGrunt:['ground'],mount:['ground'],trebuchet:['ground','siege'],priest:['ground','healing'],air:['airborne'],poisonDragon:['airborne','poison'],fireDragon:['airborne','fire'],iceDragon:['airborne','ice'],fireDemon:['ground','fire'],iceDemon:['ground','ice']});
export function buildArmoryRecords(skills,companions,descriptions){
 return [
  ...Object.entries(skills).map(([id,item])=>({id,kind:'skill',storefront:id!=='arrow',department:item.summon?'army':'bow',role:ROLES[id]??'bow',category:item.summon?'army':id.endsWith('Wave')?'waves':'arrows',name:item.name,description:descriptions[id]??item.description??'',price:item.price,reloadSeconds:item.cooldown/66,squad:item.summon?{gold:item.summon.cost,size:item.summon.amount,reserve:item.summon.amount*item.summon.population}:null,traits:TRAITS[id]??[],alliedProtection:['air','poisonDragon','fireDragon','iceDragon'].includes(id)})),
  ...Object.values(companions).map(item=>({id:item.id,kind:'companion',storefront:true,department:'companions',role:'companion',category:'companions',name:item.name,title:item.title,description:item.description,price:item.price,traits:['ground'],summonCost:item.summonCost,signatureName:item.signatureName,signatureSeconds:item.signatureCooldownTicks/33,recallSeconds:item.recoveryTicks/33,defeatSeconds:item.defeatRecoveryTicks/33}))
 ];
}
