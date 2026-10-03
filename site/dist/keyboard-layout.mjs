/** Modern physical-key presentation over unchanged zero-based saved bindings. */
export function slotToKey(slot){
 if(!Number.isInteger(slot)||slot<0||slot>=30)throw new RangeError('Expected action-bar slot0–29');
 return String((slot%10+1)%10);
}
export function keyToSlot(key){
 return typeof key==='string'&&/^[0-9]$/.test(key)?(Number(key)+9)%10:null;
}

/** Physical digit releases still clear after a modifier changes event.key. */
export function eventToSlot(event){
 const physical=typeof event?.code==='string'&&/^Digit[0-9]$/.test(event.code)?event.code.slice(-1):event?.key;
 return keyToSlot(physical);
}
