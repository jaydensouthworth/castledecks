/** Playability guard for sampled ground actors. The shared terrain sampler and
 * airborne physics remain unchanged. New units retain off-screen ingress; once
 * on the field they cannot walk beyond its finite terrain. Existing invalid
 * positions recover at the nearest edge without killing or healing the actor.
 */
const finite=Number.isFinite;
function terrainBounds(world){
 const terrain=world.terrain,interval=terrain?.interval;
 const end=finite(interval)&&terrain?.samples?.length>1?(terrain.samples.length-1)*interval:world.width;
 return finite(end)&&end>0?{left:0,right:Math.max(0,end-1e-6)}:null;
}
function place(unit,nextX,recover=false){
 const world=unit.world,currentY=world.elevationAt(unit.x);
 if(finite(unit.x)&&finite(currentY))unit.enteredGroundField=true;
 const nextY=world.elevationAt(nextX);
 if(!recover&&finite(nextX)&&finite(nextY)){
  unit.x=nextX;unit.y=nextY;unit.enteredGroundField=true;return;
 }
 const bounds=terrainBounds(world);
 if(bounds){
  const fallback=unit.team==='good'?bounds.left:bounds.right;
  const edgeX=Math.max(bounds.left,Math.min(bounds.right,finite(nextX)?nextX:fallback));
  const edgeY=world.elevationAt(edgeX);
  if(finite(edgeY)){
   if(recover||unit.enteredGroundField){unit.x=edgeX;unit.y=edgeY;unit.vx=0;unit.enteredGroundField=true;}
   else {unit.x=nextX;unit.y=edgeY;}
   return;
  }
 }
 // A custom world with no known finite edge keeps its last valid position.
 unit.vx=0;
}
export function recoverGroundPosition(unit){
 if(!finite(unit.x)||!finite(unit.y)||!finite(unit.vx))place(unit,unit.x,true);
}
export function advanceGroundPosition(unit){place(unit,unit.x+unit.vx);}
