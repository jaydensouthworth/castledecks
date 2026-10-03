/** Bounded, ID-based cart with live engine validation and synchronous checkout.
 * The host owns the purchase window: canPurchase must freshly check the active
 * profile and purchase-window eligibility. This module never ticks, equips, saves or renders.
 */
import {PlayerProfile,SKILLS} from './engine/progression.mjs';
import {COMPANIONS} from './engine/recruitment.mjs';

export const ARMORY_CART_CAPACITY=50;
const safeId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(id);
const safePrice=price=>Number.isSafeInteger(price)&&price>=0;
const kinds=new Set(['skill','companion']);
const pending=new WeakSet();
const fields=['gold','skills','owned','companionOwned'];
const fail=(code,message,extra={})=>({...extra,ok:false,code,message});
const validLine=line=>line&&typeof line==='object'&&safeId(line.id)&&kinds.has(line.kind)&&safePrice(line.quotedPrice);
const sourceFor=line=>line.kind==='companion'?COMPANIONS:SKILLS;
const liveItem=line=>Object.hasOwn(sourceFor(line),line.id)?sourceFor(line)[line.id]:null;
const copyLine=line=>Object.freeze({id:line.id,kind:line.kind,quotedPrice:line.quotedPrice});
const validProfile=profile=>profile&&Number.isFinite(profile.gold)&&profile.gold>=0&&profile.gold<=Number.MAX_SAFE_INTEGER&&profile.owned instanceof Set&&profile.companionOwned instanceof Set&&(Array.isArray(profile.skills)||profile.skills instanceof Map);
const skillList=profile=>profile.skills instanceof Map?[...profile.skills.values()]:profile.skills;

/** add captures the shown price once. Re-adding never silently refreshes it.
 * Read-only line snapshots prevent callers changing a quote behind the UI.
 */
export class ArmoryCart {
 #lines=new Map();
 constructor({capacity=ARMORY_CART_CAPACITY}={}){
  if(!Number.isInteger(capacity)||capacity<1||capacity>ARMORY_CART_CAPACITY)throw new RangeError(`Cart capacity must be 1–${ARMORY_CART_CAPACITY}.`);
  Object.defineProperty(this,'capacity',{value:capacity,enumerable:true});
 }
 get size(){return this.#lines.size;}
 get lines(){return Object.freeze([...this.#lines.values()]);}
 has(id){return this.#lines.has(id);}
 add(item){
  if(!item||!safeId(item.id)||!kinds.has(item.kind)||!safePrice(item.price))return fail('invalid_item','This card cannot be added to the cart.');
  const existing=this.#lines.get(item.id);
  if(existing)return existing.kind===item.kind?{ok:true,changed:false,line:existing}:fail('duplicate_line','A different card already uses this ID.');
  if(this.size>=this.capacity)return fail('cart_full',`Your cart holds up to ${this.capacity} cards.`);
  const line=copyLine({id:item.id,kind:item.kind,quotedPrice:item.price});this.#lines.set(line.id,line);
  return {ok:true,changed:true,line};
 }
 remove(id){return this.#lines.delete(id);}
 clear(){const changed=this.size>0;this.#lines.clear();return changed;}
 quote(profile){return quoteArmoryCart(this.lines,profile);}
 checkout(profile,options){const result=checkoutArmoryCart(profile,this.lines,options);if(result.ok)this.clear();return result;}
}

/** Pure quote: the supplied lines and profile/snapshot are never changed.
 * Intentional modern rule: every cart may spend exactly its displayed total,
 * matching single skill and companion purchases. No extra wallet reserve.
 */
export function quoteArmoryCart(lines,profile){
 const empty={lines:[],errors:[],total:0,gold:profile?.gold??0,remainingGold:profile?.gold??0,requiredGold:0,shortfall:0};
 if(!Array.isArray(lines))return fail('invalid_cart','The cart could not be read.',empty);
 if(lines.length>ARMORY_CART_CAPACITY)return fail('cart_full',`Your cart holds up to ${ARMORY_CART_CAPACITY} cards.`,empty);
 if(!validProfile(profile))return fail('invalid_profile','The campaign balance or collection could not be read.',empty);
 if(!lines.length)return fail('empty_cart','Add a card before checking out.',empty);
 const seen=new Set(),errors=[],quoted=[],ownedSkills=new Set(skillList(profile).map(skill=>skill?.id));let total=0;
 for(const line of lines){
  let error=null,item=null,owned=false;
  if(!validLine(line)){error=fail('invalid_line','A cart card is invalid. Remove it and add it again.');}
  else {
   item=liveItem(line);owned=(line.kind==='companion'?profile.companionOwned:profile.owned).has(line.id)||(line.kind==='skill'&&ownedSkills.has(line.id));
   if(seen.has(line.id))error=fail('duplicate_line','A card appears more than once. Remove the duplicate.');
   else if(!item||!safePrice(item.price))error=fail('missing_item','A cart card is no longer available.');
   else if(item.price!==line.quotedPrice)error=fail('price_changed',`${item.name??line.id} changed price. Remove it and add it again to review the new price.`);
   else if(owned)error=fail('already_owned',`${item.name??line.id} is already in your collection. Remove it from the cart.`);
   seen.add(line.id);total+=line.quotedPrice;
  }
  if(error)errors.push({id:line?.id??null,code:error.code,message:error.message});
  quoted.push(Object.freeze({id:line?.id??null,kind:line?.kind??null,quotedPrice:line?.quotedPrice??null,currentPrice:item?.price??null,name:item?.name??line?.id??'Unavailable card',owned,ok:!error,code:error?.code??'ready',message:error?.message??''}));
 }
 if(!Number.isSafeInteger(total))errors.push({id:null,code:'invalid_total',message:'The cart total is too large.'});
 const requiredGold=total,affordable=profile.gold>=total;
 const quote={lines:Object.freeze(quoted),errors:Object.freeze(errors),total,gold:profile.gold,remainingGold:profile.gold-total,requiredGold,shortfall:affordable?0:Math.max(0,requiredGold-Math.floor(profile.gold))};
 if(errors.length)return fail(errors[0].code,errors[0].message,quote);
 if(!affordable)return fail('insufficient_gold',`Need ${quote.shortfall.toLocaleString()} more in-game gold to check out.`,quote);
 return {ok:true,code:'ready',message:'Ready to check out.',...quote};
}

const writableFields=profile=>fields.every(key=>{const descriptor=Object.getOwnPropertyDescriptor(profile,key);return descriptor&&Object.hasOwn(descriptor,'value')&&descriptor.writable;});
const equalSet=(a,b)=>a instanceof Set&&a.size===b.size&&[...b].every(id=>a.has(id));
function captureProfile(profile){
 return {gold:profile.gold,skills:profile.skills,owned:profile.owned,companionOwned:profile.companionOwned,companionId:profile.companionId,
  skillEntries:profile.skills.map(skill=>({skill,values:Object.getOwnPropertyDescriptors(skill)})),ownedIds:new Set(profile.owned),companionIds:new Set(profile.companionOwned)};
}
function matchesProfile(profile,before){
 if(fields.some(key=>profile[key]!==before[key])||profile.companionId!==before.companionId||profile.skills.length!==before.skillEntries.length||!equalSet(profile.owned,before.ownedIds)||!equalSet(profile.companionOwned,before.companionIds))return false;
 return before.skillEntries.every(({skill,values},index)=>{
  if(profile.skills[index]!==skill)return false;
  const current=Object.getOwnPropertyDescriptors(skill),keys=Object.keys(values);
  return Object.keys(current).length===keys.length&&keys.every(key=>{
   const a=current[key],b=values[key];return a&&a.value===b.value&&a.get===b.get&&a.set===b.set&&a.writable===b.writable&&a.configurable===b.configurable&&a.enumerable===b.enumerable;
  });
 });
}
function contextAllowed(canPurchase,profile){
 try{return typeof canPurchase==='function'&&canPurchase(profile)===true;}catch{return false;}
}

/** Atomic in the game event loop: stage source-engine calls on detached profile
 * collections, recheck the host window + live state, then publish four own data
 * fields in one synchronous operation. Existing SkillProgress identities are
 * retained because battle/hotbar objects hold references to them. Newly bought
 * skills enter reserve; companionId is never committed. No callbacks run during
 * commit. A denied, stale, repeated or failed purchase leaves live state intact.
 */
export function checkoutArmoryCart(profile,lines,{canPurchase}={}){
 if(!profile||typeof profile!=='object')return fail('invalid_profile','The campaign could not be read.');
 if(pending.has(profile))return fail('checkout_busy','This checkout is already being processed.');
 pending.add(profile);
 try {
  if(!contextAllowed(canPurchase,profile))return fail('context_blocked','Purchases are unavailable here. Return to a permitted purchase window in the active campaign.');
  const quote=quoteArmoryCart(lines,profile);if(!quote.ok)return quote;
  if(!Array.isArray(profile.skills)||profile.skills.some(skill=>!skill||typeof skill!=='object')||!writableFields(profile))return fail('invalid_profile','This campaign cannot be updated safely.',quote);
  const before=captureProfile(profile),captured=lines.map(copyLine);
  const staged=Object.assign(Object.create(PlayerProfile.prototype),{gold:before.gold,skills:before.skillEntries.map(({skill,values})=>Object.create(Object.getPrototypeOf(skill),values)),owned:new Set(before.ownedIds),companionOwned:new Set(before.companionIds),companionId:before.companionId});
  const ordered=[...captured.filter(line=>line.kind==='skill'),...captured.filter(line=>line.kind==='companion')];
  try {
   for(const line of ordered){
    const purchased=line.kind==='companion'?PlayerProfile.prototype.recruitCompanion.call(staged,line.id):PlayerProfile.prototype.purchase.call(staged,line.id);
    if(!purchased)return fail('purchase_failed','The checkout was cancelled. No cards were purchased.',quote);
    if(line.kind==='skill')staged.skills.at(-1).binding=-1;
   }
  }catch{return fail('purchase_failed','The checkout was cancelled. No cards were purchased.',quote);}
  if(!contextAllowed(canPurchase,profile))return fail('context_blocked','The purchase window changed. Your cart has been kept.',quote);
  if(!writableFields(profile)||!matchesProfile(profile,before))return fail('profile_changed','Your campaign changed during checkout. Review your cart and try again.',quote);
  if(lines.length!==captured.length||captured.some((line,index)=>{const current=lines[index];return !current||line.id!==current.id||line.kind!==current.kind||line.quotedPrice!==current.quotedPrice;}))return fail('cart_changed','Your cart changed during checkout. Review it and try again.',quote);
  const liveQuote=quoteArmoryCart(captured,profile);if(!liveQuote.ok)return liveQuote;
  if(staged.gold!==before.gold-quote.total)return fail('purchase_failed','The checkout total changed. Your cart has been kept.',quote);
  const additions=staged.skills.slice(before.skillEntries.length);
  const values={gold:staged.gold,skills:[...before.skills,...additions],owned:staged.owned,companionOwned:staged.companionOwned};
  Object.defineProperties(profile,Object.fromEntries(fields.map(key=>[key,{value:values[key]}])));
  const receipt=Object.freeze({lines:Object.freeze(captured.map(line=>Object.freeze({...line,price:line.quotedPrice}))),count:captured.length,total:quote.total,goldBefore:before.gold,goldAfter:profile.gold,skillIds:Object.freeze(captured.filter(line=>line.kind==='skill').map(line=>line.id)),companionIds:Object.freeze(captured.filter(line=>line.kind==='companion').map(line=>line.id))});
  return {...quote,ok:true,code:'purchased',message:`${receipt.count} ${receipt.count===1?'card':'cards'} added to your collection. Equip them when you are ready.`,receipt};
 }finally{pending.delete(profile);}
}
