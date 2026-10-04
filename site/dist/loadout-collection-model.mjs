import {armyJobOptions,matchesArmyRole,cardTacticSearchText} from './card-tactics.mjs';
import {cardRuleSearchText} from './card-rule-search.mjs';
/** Owned collection indexing only. No profile writes, combat ticks or generated content. */
export const LOADOUT_PAGE_SIZE=12;
export const LOADOUT_TYPES=[['all','All abilities'],['arrows','Shots'],['waves','Waves'],['army','Units']];
export const LOADOUT_SORTS=[['equipped','Equipped first'],['name','Name: A–Z'],['rank','Rank: highest'],['reload','Reload: shortest']];
const normalized=value=>String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export class LoadoutCollection {
 constructor(records,{pageSize=LOADOUT_PAGE_SIZE}={}){
  this.records=records.filter(item=>item.kind==='skill').map((item,order)=>({...item,order,search:normalized([item.name,item.description,item.category,item.role,...item.traits??[]].join(' ')),ruleSearch:normalized(cardRuleSearchText(item)+' '+cardTacticSearchText(item))}));
  this.byId=new Map(this.records.map(item=>[item.id,item]));
  this.pageSize=Math.min(24,Math.max(1,Math.floor(pageSize)||LOADOUT_PAGE_SIZE));
  this.view={type:'all',query:'',role:'all',trait:'all',status:'all',sort:'equipped',page:0};
 }
 setView(patch){
  const next={...this.view,...patch};next.query=String(next.query).slice(0,200);
  if(!LOADOUT_TYPES.some(([id])=>id===next.type))next.type='all';
  if(!LOADOUT_SORTS.some(([id])=>id===next.sort))next.sort='equipped';
  if(!['all','equipped','reserve'].includes(next.status))next.status='all';
  if('type'in patch&&patch.type!==this.view.type){if(!('role'in patch))next.role='all';if(!('trait'in patch))next.trait='all';}
  const changed=['type','query','role','trait','status','sort'].some(key=>next[key]!==this.view[key]);
  next.page=changed?0:Math.max(0,Math.floor(Number(next.page)||0));this.view=next;
 }
 query(wrappers){
  const owned=new Map(wrappers.map(wrapper=>[wrapper.skill.id,wrapper]));
  const all=this.records.filter(item=>owned.has(item.id)),pool=all.filter(item=>this.view.type==='all'||item.category===this.view.type);
  const roles=[...new Set(pool.map(item=>item.role).filter(role=>role&&role!=='bow'))],traits=[...new Set(pool.flatMap(item=>item.traits??[]))],jobs=armyJobOptions(pool);
  if(!roles.includes(this.view.role)&&!jobs.some(([id])=>id===this.view.role))this.view.role='all';if(!traits.includes(this.view.trait))this.view.trait='all';
  const tokens=normalized(this.view.query).trim().split(/\s+/).filter(Boolean);
  const eligible=pool.filter(item=>{const wrapper=owned.get(item.id),v=this.view;return matchesArmyRole(item,v.role)&&(v.trait==='all'||item.traits.includes(v.trait))&&(v.status==='all'||(v.status==='equipped')===(wrapper.binding>=0));});
  let matches=eligible.filter(item=>tokens.every(token=>item.search.includes(token)));
  if(!matches.length)matches=eligible.filter(item=>tokens.every(token=>(item.search+' '+item.ruleSearch).includes(token)));
  const byName=(a,b)=>a.name.localeCompare(b.name)||a.order-b.order;
  matches.sort(this.view.sort==='name'?byName:this.view.sort==='reload'?(a,b)=>a.reloadSeconds-b.reloadSeconds||byName(a,b):this.view.sort==='rank'?(a,b)=>owned.get(b.id).skill.rank-owned.get(a.id).skill.rank||byName(a,b):(a,b)=>{const av=owned.get(a.id).binding,bv=owned.get(b.id).binding;return (av<0?Infinity:av)-(bv<0?Infinity:bv)||byName(a,b);});
  const total=matches.length,pageCount=Math.max(1,Math.ceil(total/this.pageSize));this.view.page=Math.min(this.view.page,pageCount-1);const start=this.view.page*this.pageSize;
  return {items:matches.slice(start,start+this.pageSize).map(item=>({item,wrapper:owned.get(item.id)})),total,page:this.view.page,pageCount,start,end:Math.min(total,start+this.pageSize),owned:all.length,equipped:wrappers.filter(w=>w.binding>=0).length,reserve:wrappers.filter(w=>w.binding<0).length,counts:new Map(LOADOUT_TYPES.map(([id])=>[id,all.filter(item=>id==='all'||item.category===id).length])),roles,traits,jobs,matches};
 }
 reveal(id,wrappers){let result=this.query(wrappers),index=result.matches.findIndex(item=>item.id===id);if(index<0){this.setView({type:'all',query:'',role:'all',trait:'all',status:'all'});result=this.query(wrappers);index=result.matches.findIndex(item=>item.id===id);}this.setView({page:Math.max(0,Math.floor(index/this.pageSize))});return this.query(wrappers);}
}
export function loadoutPlacementPreview(wrapper,slot,nameOf,bindingLabel){
 if(!wrapper)return 'Choose a card below, then tap any action-bar key.';
 if(!slot)return `${nameOf(wrapper.skill.id)} selected · choose a destination key.`;
 const target=slot.holding,name=nameOf(wrapper.skill.id);
 if(target===wrapper)return `${name} already occupies ${bindingLabel(slot.index)}.`;
 if(!target)return `${name} → ${bindingLabel(slot.index)}.`;
 return wrapper.binding<0?`${name} replaces ${nameOf(target.skill.id)} · that ability returns to reserve.`:`Swap ${name} with ${nameOf(target.skill.id)} · ${nameOf(target.skill.id)} moves to ${bindingLabel(wrapper.binding)}.`;
}
