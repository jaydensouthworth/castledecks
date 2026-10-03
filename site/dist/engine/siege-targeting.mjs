/** Modern allied siege role. Read live ownership at selection and release;
 * standalone/reference troop behavior and enemy siege remain unchanged. */
const active=value=>value?.hp>0&&!value.dead&&!value.destroyed;
const finite=value=>Number.isFinite(value?.x)&&Number.isFinite(value?.y);
const owner=building=>building?.permanentTeam==='good'||building?.occupiedBy==='good'?'good':building?.permanentTeam==='bad'?'bad':building?.occupiedBy;
const garrisoned=unit=>typeof unit?.garrisoned==='function'?unit.garrisoned():unit?.garrisonBuilding!=null;
const eligibleSource=unit=>unit?.team==='good'&&unit.recruited===true&&unit.type==='trebuchet'&&active(unit)&&finite(unit)&&!garrisoned(unit);
const distance=(unit,target)=>Math.hypot(unit.x-target.x,unit.y-target.y);
export function hostileSiegeStructure(unit,target,structures){
 if(!eligibleSource(unit)||!Array.isArray(structures)||!structures.includes(target)||!active(target)||!finite(target)||owner(target)!=='bad')return false;
 const range=distance(unit,target);return range>700&&range<=unit.shotRange;
}
export function selectSiegeStructureTarget(unit,structures){
 let selected=null,best=0;
 for(const target of structures??[])if(hostileSiegeStructure(unit,target,structures)){
  const range=distance(unit,target);if(range>best){selected=target;best=range;}
 }
 return selected;
}
export function canReleaseSiegeTarget(unit,target,structures){
 if(!eligibleSource(unit)||!active(target)||!finite(target))return false;
 if(structures?.includes(target))return hostileSiegeStructure(unit,target,structures);
 // Preserve the existing actor choice and aim range. Its death during a long
 // windup should consume the release cycle without launching at a stale corpse.
 return target.isFighter===true&&target.team==='bad';
}

/** A tower may still be in a historical enemy candidate array after changing
 * hands. Preserve neutral masonry and ground splash, but never directly strike
 * friendly stone with a recruited allied siege shell, even if its source died. */
export function protectsFriendlySiegeStructure(projectile,target,world){
 const source=projectile?.source;
 return projectile?.kind==='trebuchet_ammo'&&projectile.team==='good'&&source?.team==='good'&&source.recruited===true&&source.type==='trebuchet'&&world?.structures?.includes(target)&&owner(target)==='good';
}
