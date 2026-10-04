import {CASTLE_CATALOG} from './engine/castle-catalog.mjs';
import {captureCastleCollection} from './castle-loadout-model.mjs';
import {armyJobOptions,matchesArmyRole,cardTacticSearchText} from './card-tactics.mjs';
import {cardRuleSearchText} from './card-rule-search.mjs';
/** Catalog-only state. No game ticks, purchases, profile mutation, or DOM.
 * Records have stable IDs, kind (skill/companion/castle), category, traits, price,
 * description and explicit gameplay facts. Adding content never requires a
 * new renderer. Synthetic benchmark records live only in the private tests.
 */
export const ARMORY_PAGE_SIZE=12;
export const ARMORY_CATEGORIES=Object.freeze([['all','All cards'],['arrows','Arrows'],['waves','Waves'],['army','Army'],['companions','Companions'],['castles','Castles']]);
export const ARMORY_TRAITS=Object.freeze([['all','All effects & roles'],['fire','Fire'],['ice','Ice'],['poison','Poison'],['lightning','Lightning'],['explosive','Explosive'],['healing','Healing'],['airborne','Airborne'],['ground','Ground troops'],['siege','Siege']]);
export const ARMORY_STATUSES=Object.freeze([['all','All ownership'],['available','Available to buy'],['owned','Owned'],['unowned','Not owned'],['unaffordable','Need more gold'],['equipped','Equipped'],['reserve','In reserve']]);
export const ARMORY_SORTS=Object.freeze([['catalog','Catalog order'],['price','Price: low to high'],['price-desc','Price: high to low'],['name','Name: A–Z'],['reload','Reload: shortest']]);
const normalize=value=>String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const hasOption=(options,key)=>options.some(([id])=>id===key);
export function createArmorySnapshot(profile){
 const castles=captureCastleCollection(profile);
 return {castleLevels:new Map(castles.owned.map(({id,level})=>[id,level])),castleId:castles.selected,paletteId:profile.paletteId??'azure',gold:Number(profile.gold)||0,heroRank:profile.rank??1,difficulty:profile.difficulty??'medium',skills:new Map(profile.skills.map(skill=>[skill.id,skill])),bindings:new Map(profile.skills.filter(skill=>skill.binding>=0).map(skill=>[skill.binding,skill])),owned:profile.owned,companionOwned:profile.companionOwned??new Set(),companionId:profile.companionId};
}
export function armoryCardState(item,snapshot){
 const companion=item.kind==='companion',castle=item.kind==='castle',skill=item.kind==='skill'?snapshot.skills.get(item.id):null;
 let castleValid=true,castleOwned=false;
 if(castle){try{const collection=captureCastleCollection(snapshot);castleValid=Object.hasOwn(CASTLE_CATALOG,item.id);castleOwned=collection.owned.some(entry=>entry.id===item.id&&entry.level===1);}catch{castleValid=false;}}
 const owned=castle?castleOwned:(companion?snapshot.companionOwned:snapshot.owned).has(item.id);
 // Every supported card uses its displayed price. Castle levels are not sold.
 const purchaseBlockedReason=castle&&!castleValid?'This castle is unavailable.':snapshot.purchaseBlockedReason??null;
 const eligible=!owned&&!purchaseBlockedReason&&snapshot.gold>=item.price&&(!castle||Number.isSafeInteger(snapshot.gold));
 return {owned,eligible,purchaseBlockedReason,skill,equipped:castle?castleValid&&snapshot.castleId===item.id:companion?snapshot.companionId===item.id:(skill?.binding??-1)>=0,shortfall:Math.max(0,item.price-Math.floor(snapshot.gold))};
}
export class ArmoryCatalog {
 constructor(records,{pageSize=ARMORY_PAGE_SIZE,selectedId='fireArrow'}={}){
  this.pageSize=Math.min(48,Math.max(1,Math.floor(Number(pageSize)||ARMORY_PAGE_SIZE)));
  const ids=new Set();
  this.records=records.map((record,index)=>{
   if(!/^[a-zA-Z0-9_-]{1,100}$/.test(record.id)||ids.has(record.id))throw new TypeError('Catalog IDs must be unique and DOM-safe.');
   if(!['skill','companion','castle'].includes(record.kind)||!Number.isFinite(record.price)||record.price<0)throw new TypeError('Invalid catalog kind or price.');
   if(record.kind==='castle'&&!Object.hasOwn(CASTLE_CATALOG,record.id))throw new TypeError('Unknown castle catalog ID.');
   ids.add(record.id);const traits=[...new Set(record.traits??[])];
   return Object.freeze({...record,traits:Object.freeze(traits),order:index,search:normalize([record.name,record.description,record.department,record.role,record.category,...traits].join(' ')),ruleSearch:normalize(cardRuleSearchText(record)+' '+cardTacticSearchText(record))});
  });
  this.departments=new Set(this.records.map(item=>item.department).filter(Boolean));
  this.roles=new Set([...this.records.map(item=>item.role).filter(Boolean),...armyJobOptions(this.records).map(([id])=>id)]);
  this.byId=new Map(this.records.map(item=>[item.id,item]));
  const tie=(a,b)=>a.order-b.order,byName=(a,b)=>a.name.localeCompare(b.name)||tie(a,b);
  this.orders={catalog:this.records,price:[...this.records].sort((a,b)=>a.price-b.price||tie(a,b)),'price-desc':[...this.records].sort((a,b)=>b.price-a.price||tie(a,b)),name:[...this.records].sort(byName),reload:[...this.records].sort((a,b)=>(a.reloadSeconds??Infinity)-(b.reloadSeconds??Infinity)||tie(a,b))};
  this.counts=new Map(ARMORY_CATEGORIES.map(([key])=>[key,key==='all'?this.records.length:this.records.filter(item=>item.category===key).length]));
  this.view={query:'',department:'all',role:'all',collection:false,wishlist:false,category:'all',trait:'all',status:'all',sort:'catalog',page:0};
  this.selectedId=this.byId.has(selectedId)?selectedId:this.records[0]?.id??null;
 }
 setView(patch){
  const old=this.view,next={...old};
  if('query' in patch)next.query=String(patch.query).slice(0,200);
  if('department' in patch)next.department=(patch.department==='all'||this.departments.has(patch.department))?patch.department:'all';
  if('role' in patch)next.role=(patch.role==='all'||this.roles.has(patch.role))?patch.role:'all';
  if('collection' in patch)next.collection=!!patch.collection;
  if('wishlist' in patch)next.wishlist=!!patch.wishlist;
  for(const [key,options]of [['category',ARMORY_CATEGORIES],['trait',ARMORY_TRAITS],['status',ARMORY_STATUSES],['sort',ARMORY_SORTS]])if(key in patch)next[key]=hasOption(options,patch[key])?patch[key]:'all';
  if(!this.orders[next.sort])next.sort='catalog';
  const changed=['query','department','role','collection','wishlist','category','trait','status','sort'].some(key=>old[key]!==next[key]);
  next.page=changed?0:('page'in patch?Math.max(0,Math.floor(Number(patch.page)||0)):old.page);
  this.view=next;return changed;
 }
 select(id){if(this.byId.has(id))this.selectedId=id;}
 query(snapshot){
  const {query,department,role,collection,wishlist,category,trait,status,sort}=this.view,tokens=normalize(query).trim().split(/\s+/).filter(Boolean),matches=[],ruleMatches=[];
  for(const item of this.orders[sort]){
   if(wishlist&&!snapshot.wishlist?.has(item.id))continue;
   if(!collection&&!wishlist&&item.storefront===false||department!=='all'&&item.department!==department||!matchesArmyRole(item,role))continue;
   if(category!=='all'&&item.category!==category||trait!=='all'&&!item.traits.includes(trait)||!tokens.every(token=>(item.search+' '+item.ruleSearch).includes(token)))continue;
   const state=armoryCardState(item,snapshot);
   if(collection&&!state.owned||status==='equipped'&&(!state.owned||!state.equipped)||status==='reserve'&&(!state.owned||state.equipped))continue;
   if(status==='owned'&&!state.owned||status==='unowned'&&state.owned||status==='available'&&!state.eligible||status==='unaffordable'&&(state.owned||state.eligible))continue;
   (tokens.every(token=>item.search.includes(token))?matches:ruleMatches).push(item);
  }
  if(!matches.length)matches.push(...ruleMatches);
  const total=matches.length,pageCount=Math.max(1,Math.ceil(total/this.pageSize));this.view.page=Math.min(this.view.page,pageCount-1);
  const start=this.view.page*this.pageSize,selectedIndex=matches.findIndex(item=>item.id===this.selectedId);
  return {total,page:this.view.page,pageCount,start,end:Math.min(start+this.pageSize,total),items:matches.slice(start,start+this.pageSize),selectedIndex,selectedOnPage:selectedIndex>=start&&selectedIndex<start+this.pageSize};
 }
 revealSelected(snapshot){
  let result=this.query(snapshot);
  if(result.selectedIndex<0){this.setView({query:'',department:'all',role:'all',category:'all',trait:'all',status:'all',wishlist:false});result=this.query(snapshot);}
  this.view.page=Math.max(0,Math.floor(result.selectedIndex/this.pageSize));return this.query(snapshot);
 }
}
