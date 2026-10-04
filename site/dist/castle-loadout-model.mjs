/** Castle ownership is profile progress; selection is a dedicated deck slot.
 * Level records make future upgrades explicit, but this slice accepts level 1
 * only. No purchase or import can grant an unsupported level or live repair. */
import {CASTLE_CATALOG,DEFAULT_CASTLE_ID,validateCastleSelection} from './engine/castle-catalog.mjs';
const shape=(value,keys,label)=>{
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw new TypeError(`Invalid ${label}.`);
 const fields=Object.getOwnPropertyDescriptors(value);
 if(Reflect.ownKeys(fields).length!==keys.length||keys.some(key=>!Object.hasOwn(fields,key)||!Object.hasOwn(fields[key],'value')))throw new TypeError(`Invalid ${label}.`);
};
export function validateCastleCollection(value){
 shape(value,['owned','selected'],'castle collection');
 if(!Array.isArray(value.owned)||value.owned.length<1||value.owned.length>64)throw new TypeError('Invalid owned castles.');
 const entries=Object.getOwnPropertyDescriptors(value.owned);
 if(Reflect.ownKeys(entries).length!==value.owned.length+1||Array.from({length:value.owned.length},(_,index)=>entries[index]).some(field=>!field||!Object.hasOwn(field,'value')))throw new TypeError('Owned castles must be dense data records.');
 const owned=Array.from({length:value.owned.length},(_,index)=>validateCastleSelection(entries[index].value)),ids=new Set(owned.map(castle=>castle.id));
 if(ids.size!==owned.length||!ids.has(DEFAULT_CASTLE_ID)||typeof value.selected!=='string'||!ids.has(value.selected))throw new TypeError('Invalid selected or duplicate castle.');
 return {owned:owned.map(castle=>({...castle})),selected:value.selected};
}
export function defaultCastleCollection(){return {owned:[{id:DEFAULT_CASTLE_ID,level:1}],selected:DEFAULT_CASTLE_ID};}
export function captureCastleCollection(profile){
 const levels=Object.getOwnPropertyDescriptor(profile,'castleLevels'),selected=Object.getOwnPropertyDescriptor(profile,'castleId');
 if(!levels&&!selected)return defaultCastleCollection();
 if(!levels||!selected||!Object.hasOwn(levels,'value')||!Object.hasOwn(selected,'value')||!(levels.value instanceof Map))throw new TypeError('Castle progress requires plain data fields.');
 // Use the intrinsic iterator so a Map subclass or overridden iterator cannot
 // execute application callbacks while serializing a profile.
 return validateCastleCollection({owned:[...Map.prototype.entries.call(levels.value)].map(([id,level])=>({id,level})),selected:selected.value});
}
export function selectedCastle(profile){
 const collection=captureCastleCollection(profile);
 return validateCastleSelection(collection.owned.find(castle=>castle.id===collection.selected));
}
export function previewCastleEquip(selection,profile,{started=false,summary=false}={}){
 const castle=validateCastleSelection(selection),collection=captureCastleCollection(profile),current=selectedCastle(profile);
 const owned=collection.owned.find(value=>value.id===castle.id),missing=!owned||owned.level<castle.level;
 const changed=current.id!==castle.id||current.level!==castle.level,blockers=[];
 if(missing)blockers.push('Acquire this castle before equipping it.');
 if(changed&&started&&!summary)blockers.push('Change your castle before starting or after the battle.');
 return {castle,current,changed,missing,blockers,canEquip:blockers.length===0};
}
export function purchaseCastle(profile,id){
 if(typeof id!=='string'||!Object.hasOwn(CASTLE_CATALOG,id))return false;
 const item=CASTLE_CATALOG[id],collection=captureCastleCollection(profile);
 if(collection.owned.some(castle=>castle.id===id)||!Number.isSafeInteger(profile.gold)||profile.gold<item.price)return false;
 for(const key of ['gold','castleLevels']){const descriptor=Object.getOwnPropertyDescriptor(profile,key);if(!descriptor||!Object.hasOwn(descriptor,'value')||!descriptor.writable)return false;}
 const levels=new Map(collection.owned.map(castle=>[castle.id,castle.level]));levels.set(id,1);
 // No callbacks run between the validations and synchronous commit.
 Object.defineProperties(profile,{gold:{value:profile.gold-item.price},castleLevels:{value:levels}});
 return true;
}
export function equipCastle(profile,selection,context={}){
 const preview=previewCastleEquip(selection,profile,context);if(!preview.canEquip)return {ok:false,...preview};
 const descriptor=Object.getOwnPropertyDescriptor(profile,'castleId');
 if(!descriptor||!Object.hasOwn(descriptor,'value')||!descriptor.writable)throw new TypeError('Castle selection is not writable.');
 profile.castleId=preview.castle.id;
 return {ok:true,...preview};
}
