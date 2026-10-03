/** Independent candidate collection inferred from Projectile.getTargets.
 * Structures precede unit candidates; ordinary arrays retain their list order.
 */
import {protectsAlliedFlyer} from './attack-allegiance.mjs';
const hittable=o=>typeof o.canGetHit==='function'?o.canGetHit():o.canGetHit!==false;
export function collectProjectileTargets(projectile,world){
 const result=[],append=items=>{for(const o of items??[])if(hittable(o)&&o!==projectile.owner)result.push(o)};
 if(projectile.team==='bad'){append(world.goodStructures);append(world.neutralStructures)}
 else if(projectile.team==='good'){append(world.badStructures);append(world.neutralStructures)}
 else append(world.structures);
 const nearby=o=>hittable(o)&&o!==projectile.owner&&!protectsAlliedFlyer(projectile,o)&&Math.hypot(projectile.x-o.x,projectile.y-o.y)<500;
 if(projectile.y<world.maxElevationAt(projectile.x)){
  for(const o of world.airUnits??[])if(o.team!==projectile.team&&nearby(o)&&((projectile.vx>0&&projectile.x<o.x)||(projectile.vx<0&&projectile.x>o.x)))result.push(o);
 }else{
  if(projectile.addGoodTargets)for(const o of world.goodTeam??[])if(nearby(o))result.push(o);
  if(projectile.addBadTargets)for(const o of world.badTeam??[])if(nearby(o))result.push(o);
 }
 return result;
}
export class ProjectileTargetCache {
 constructor(){this.timer=0;this.above=false;this.targets=[];this.refreshCount=0;}
 update(projectile,world){const previousAbove=this.above;this.above=projectile.y<world.maxElevationAt(projectile.x);this.timer-=2;if(this.timer<0||previousAbove!==this.above){this.timer=30;this.targets=collectProjectileTargets(projectile,world);this.refreshCount++;}return this.targets;}
}
