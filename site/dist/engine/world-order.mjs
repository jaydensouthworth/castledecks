/** Independent ascending live-index contract from recovered static LevelManager.step.
 * Callers may capture count before loader insertion; splice-skips are intentional.
 */
export function stepObjectArray(readArray,count=readArray().length){
 for(let index=0;index<count;index++){
  const object=readArray()[index];
  if(object!=null&&typeof object.step==='function')object.step();
 }
}
export class WorldObjects {
 constructor(){this.items=[];}
 add(object){this.items.push(object);return object;}
 remove(object){const index=this.items.indexOf(object);if(index<0)return false;this.items.splice(index,1);return true;}
 step(count=this.items.length){stepObjectArray(()=>this.items,count);}
}
