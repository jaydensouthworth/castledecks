/** Browser-local input preferences. These are not campaign/save bindings. */
export const CONTROL_STORAGE_KEY='castledecks.controls';
export const CONTROL_ACTIONS=Object.freeze([
 ['left','Move left','Hold the left movement button'],
 ['right','Move right','Hold the right movement button'],
 ['up','Enter a building','Tap Enter near an available building'],
 ['down','Leave a building','Tap Leave while garrisoned'],
 ['pause','Pause / resume','Tap Pause, then Resume'],
 ['activate','Activate airborne ability','Tap the activation control when it appears'],
 ['companion','Companion / signature','Tap the separate companion control'],
 ['arc','Switch Auto aim arc','Tap High / Low arc in Auto aim'],
 ['armyOrder','Advance / Rally ground line','Tap the ground-line control beside your active card'],
 ['previousBar','Previous action bar','Use the bar-cycle control to reach any equipped bar'],
 ['nextBar','Next action bar','Tap the bar-cycle control'],
].map(([id,label,touch])=>Object.freeze({id,label,touch})));
export const DEFAULT_CONTROL_BINDINGS=Object.freeze({left:'a',right:'d',up:'w',down:'s',pause:'p',activate:' ',companion:'g',arc:'v',armyOrder:'r',previousBar:'[',nextBar:']'});
const names=Object.freeze({arrowleft:'Left Arrow',arrowright:'Right Arrow',arrowup:'Up Arrow',arrowdown:'Down Arrow',' ':'Space'});
const allowed=key=>typeof key==='string'&&(/^[a-z]$/.test(key)||['arrowleft','arrowright','arrowup','arrowdown',' ','[',']','-','=',';',"'",',','.','/','\\','`'].includes(key));
const compactNames=Object.freeze({arrowleft:'←',arrowright:'→',arrowup:'↑',arrowdown:'↓',' ':'Space'});
export const controlKeyLabel=(key,{compact=false}={})=>(compact?compactNames:names)[key]??String(key??'').toUpperCase();
export const defaultControlLabel=action=>controlKeyLabel(DEFAULT_CONTROL_BINDINGS[action]);
export const isFixedControlDigit=event=>typeof event?.code==='string'&&/^Digit[0-9]$/.test(event.code);
export function controlEventKey(event){const key=event?.key;return typeof key==='string'?(key==='Spacebar'?' ':key.toLowerCase()):'';}
export function isControlTextTarget(target){return ['INPUT','SELECT','TEXTAREA'].includes(target?.tagName)||!!target?.isContentEditable||!!target?.closest?.('[contenteditable]:not([contenteditable="false"])');}
export function isControlComposition(event){return !!event?.isComposing||event?.keyCode===229||['process','dead','unidentified'].includes(controlEventKey(event));}
export function hasControlModifier(event){return !!(event?.ctrlKey||event?.metaKey||event?.altKey||event?.shiftKey);}
export function controlBindingError(bindings,action,key){
 if(!CONTROL_ACTIONS.some(item=>item.id===action))return 'Unknown control.';
 if(!allowed(key))return 'Choose a letter, arrow key, Space, or punctuation key. Numbers, Escape, Tab, Enter, and browser keys are reserved.';
 const collision=CONTROL_ACTIONS.find(item=>item.id!==action&&bindings[item.id]===key);
 return collision?`${controlKeyLabel(key)} is already used by ${collision.label.toLowerCase()}. Change that control first, or choose another key.`:'';
}
export function validControlBindings(value){
 return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===CONTROL_ACTIONS.length&&CONTROL_ACTIONS.every(({id})=>Object.hasOwn(value,id)&&!controlBindingError(value,id,value[id]));
}
/** Preserve all ten legacy remaps. Pick an unused new key without stealing one. */
export function migrateControlBindings(value){
 if(validControlBindings(value))return {...value};
 const legacy=CONTROL_ACTIONS.filter(item=>item.id!=='armyOrder');
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==legacy.length||!legacy.every(({id})=>Object.hasOwn(value,id)&&!controlBindingError(value,id,value[id])))return null;
 const used=new Set(Object.values(value)),key=[...'rbtyuiofhjklzxc nmqe'.replace(/ /g,'')].find(key=>!used.has(key));
 const next={...value,armyOrder:key};return validControlBindings(next)?next:null;
}
export function createControlBindings({getStorage=()=>globalThis.window?.localStorage}={}){
 let bindings={...DEFAULT_CONTROL_BINDINGS},revision=0,storageMessage='',forward=false;
 try{
  const raw=getStorage()?.getItem(CONTROL_STORAGE_KEY);
  if(raw){
   if(typeof raw!=='string'||raw.length>4096)throw new Error('Invalid preference size');
   const value=JSON.parse(raw);
   if(Number.isInteger(value?.version)&&value.version>2){forward=true;storageMessage='A newer controls format is stored here. Changes will work for this tab only; the stored preferences are kept.';}
   else if([1,2].includes(value?.version)&&migrateControlBindings(value.bindings))bindings=migrateControlBindings(value.bindings);
   else throw new Error('Invalid controls');
  }
 }catch{storageMessage='Saved controls could not be read. Default keys are ready; you can apply new controls below.';}
 return {
  get bindings(){return {...bindings};},get revision(){return revision;},get message(){return storageMessage;},
  label:(action,options)=>controlKeyLabel(bindings[action],options),
  action(event){if(hasControlModifier(event)||isControlComposition(event)||isFixedControlDigit(event))return null;const key=controlEventKey(event);return CONTROL_ACTIONS.find(item=>bindings[item.id]===key)?.id??null;},
  apply(next){
   if(!validControlBindings(next))return {ok:false,message:'Controls were not applied. Each action needs a different supported key.'};
   bindings={...next};revision++;
   if(forward)return {ok:true,persisted:false,message:storageMessage};
   try{const storage=getStorage();if(!storage?.setItem)throw new Error('Storage unavailable');storage.setItem(CONTROL_STORAGE_KEY,JSON.stringify({version:2,bindings}));storageMessage='Controls saved on this browser. Campaign files and other devices keep their own controls.';return {ok:true,persisted:true,message:storageMessage};}
   catch{storageMessage='Controls applied for this tab. Browser storage is unavailable or full, so these changes may be lost when you reload.';return {ok:true,persisted:false,message:storageMessage};}
  }
 };
}
