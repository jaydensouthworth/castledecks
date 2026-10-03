/** Requested modern rule: allied flyers are transparent to the player's attacks.
 * Neutral debris and delayed spells retain their initiating side through source
 * ancestry. Unknown/environmental attacks keep their existing behavior.
 */
export function attackTeam(attack) {
  const pending=[attack],seen=new Set();
  while(pending.length){
    const current=pending.pop();
    if(current==null||typeof current!=='object'||seen.has(current))continue;
    seen.add(current);
    if(current.team==='good'||current.team==='bad')return current.team;
    // The source takes precedence over an impacted structure recorded as owner.
    pending.push(current.owner,current.source);
  }
  return null;
}
export function protectsAlliedFlyer(attack,target) {
  return target?.team==='good'&&
    (typeof target.isAirUnit==='function'?target.isAirUnit():target.airUnit===true)&&
    attackTeam(attack)==='good';
}
