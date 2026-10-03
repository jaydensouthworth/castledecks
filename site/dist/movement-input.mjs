/** Movement input ownership. The caller keeps its existing live/modal gates.
 * Keyboard bindings and click/tap pulses are presentation-layer concerns.
 * getInput must return the current battle.input object after clear/restart.
 */
const directions=['left','right','up','down'];
export function createMovementOwners(getInput) {
 const keyboard=new Map(),pointers=new Map();
 function sync(){const input=getInput();for(const direction of directions)input[direction]=[...keyboard.values()].includes(direction)||[...pointers.values()].some(owner=>owner.direction===direction);}
 return {
  keyDown(key,direction){if(!directions.includes(direction))return false;keyboard.set(key,direction);sync();return true;},
  keyUp(key){const removed=keyboard.delete(key);sync();return removed;},
  pointerDown(id,direction,control){if(!directions.includes(direction)||pointers.has(id))return false;pointers.set(id,{direction,control});sync();return true;},
  pointerEnd(id,control){const owner=pointers.get(id);if(!owner||owner.control!==control)return false;pointers.delete(id);sync();return true;},
  clear(){const owned=[...pointers];keyboard.clear();pointers.clear();sync();for(const [id,{control}] of owned)if(control?.hasPointerCapture?.(id))control.releasePointerCapture(id);},
  sync,
  get pointerCount(){return pointers.size;},
  get keyCount(){return keyboard.size;}
 };
}
