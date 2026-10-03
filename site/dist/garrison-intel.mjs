/** Current hostile tower occupants only. Read-only presentation of real actors;
 * not reserves, future spawns, destroyed shelters or stale occupant references. */
export function isHostileTowerOccupant(unit,tower){
 return tower?.type==='tower'&&tower.occupiedBy==='bad'&&tower.hp>0&&!tower.destroyed&&tower.clipPresent!==false&&
  unit?.team==='bad'&&unit.hp>0&&!unit.dead&&!unit.destroyed&&unit.garrisonBuilding===tower&&
  Array.isArray(tower.occupants)&&tower.occupants.includes(unit);
}
export function hostileTowerOccupantCount(tower){
 return new Set((Array.isArray(tower?.occupants)?tower.occupants:[]).filter(unit=>isHostileTowerOccupant(unit,tower))).size;
}
export function shelteredEnemyCount(battle){
 return new Set((Array.isArray(battle?.badTeam)?battle.badTeam:[]).filter(unit=>isHostileTowerOccupant(unit,unit?.garrisonBuilding))).size;
}
