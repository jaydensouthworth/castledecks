/** Modern editor semantics layered on the recovered ActionBarLayout.
 * Never leaves the displaced skill's live binding stale. No engine changes.
 */
export function placeLoadoutAbility(layout,wrapper,destination){
 if(!layout||layout.closed||!wrapper)return null;
 const from=wrapper.binding;
 if(destination===from)return {kind:'unchanged',wrapper,from,to:destination,displaced:null};
 const displaced=destination>=0?layout.slots[destination]?.holding:null;
 if(destination>=0&&!layout.slots[destination])return null;
 layout.drop(wrapper,destination);
 if(displaced&&displaced!==wrapper)layout.drop(displaced,from);
 return {kind:destination<0?'reserve':displaced?(from<0?'replace':'swap'):'move',wrapper,from,to:destination,displaced};
}
export function abilityCategory(id,catalog){return catalog[id]?.summon?'army':id.endsWith('Wave')?'waves':'arrows';}
export const ABILITY_CATEGORIES=[['all','All abilities'],['arrows','Arrows'],['waves','Waves'],['army','Army']];
export function armoryEligibility(profile,id,catalog){
 const item=catalog[id],skill=profile.skills.find(skill=>skill.id===id),owned=profile.owned.has(id);
 // Preserve the recovered purchase rule: balance must be strictly above price.
 const shortfall=Math.max(0,item.price+1-Math.floor(profile.gold));
 return {owned,skill,price:item.price,eligible:!owned&&profile.gold>item.price,shortfall,category:abilityCategory(id,catalog),cooldownSeconds:item.cooldown/66};
}

export function recoverDuplicateBindings(skills){
 const incumbent=new Map(),restored=[];
 for(const skill of skills)if(skill.binding>=0)incumbent.set(skill.binding,skill);
 for(const skill of skills)if(skill.binding>=0&&incumbent.get(skill.binding)!==skill){skill.binding=-1;restored.push(skill);}
 return restored;
}
