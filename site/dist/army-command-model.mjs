/** Army presentation and guarded UI commands. No simulation/rank/rule changes. */
import {SKILLS,summonSquad} from './engine/progression.mjs';
export const ARMY_PAGE_SIZE=12;
export const ARMY_ROLES=Object.freeze([['all','All roles'],['frontline','Frontline'],['ranged','Ranged'],['support','Support'],['siege','Siege']]);
const actorTypes={dragon_scout_poison:'poisonDragon',dragon_scout_fire:'fireDragon',dragon_scout_ice:'iceDragon',fire_demon:'fireDemon',ice_demon:'iceDemon'};
export const armyContractId=unit=>unit.skill?.id??actorTypes[unit.type]??unit.type;
export function armyPosition(unit){
 if(!(unit.hp>0))return 'clearing';
 if(unit.garrisonBuilding)return 'garrison';
 if(unit.x<0)return 'arriving';
 return 'field';
}
export function armySnapshot(battle){
 const queue=battle.friendlyQueue,counts={field:0,garrison:0,arriving:0,clearing:0},groups=new Map();
 for(const unit of battle.goodTeam){if(unit===battle.hero||unit.isCompanion)continue;const position=armyPosition(unit),id=armyContractId(unit);counts[position]++;if(!groups.has(id))groups.set(id,{id,total:0,field:0,garrison:0,arriving:0,clearing:0});const group=groups.get(id);group.total++;group[position]++;}
 return {counts,groups:[...groups.values()],occupied:battle.regularArmyCount,cap:queue.cap,reserve:queue.population,waiting:queue.queue.length,queueGate:queue.capacity,spent:battle.stats.goldSpent??0,gold:battle.profile.gold,living:counts.field+counts.garrison+counts.arriving,free:Math.max(0,queue.cap-battle.regularArmyCount),nextEntrySeconds:Math.max(0,Math.floor(queue.timer/2)+1)/33};
}
export function armyBinding(skill){return Number.isInteger(skill?.binding)&&skill.binding>=0&&skill.binding<30?`Bar ${Math.floor(skill.binding/10)+1} · key ${skill.binding%10===9?'0':skill.binding%10+1}`:'Not on an action bar';}
export function armyRecruitState(skill,{profile,battle,started}){
 const config=SKILLS[skill?.id]?.summon,queue=battle.friendlyQueue,equipped=!!skill&&Number.isInteger(skill.binding)&&skill.binding>=0&&skill.binding<30&&battle.hotbar.bars[Math.floor(skill.binding/10)]?.[skill.binding%10]===skill;
 if(!config||battle.profile!==profile||!profile.skills.includes(skill)||!profile.owned.has(skill.id))return {canRecruit:false,code:'unowned',label:'Not owned',detail:'Unlock this army contract in the Armory first.',equipped:false};
 const state=(code,label,detail)=>({canRecruit:false,code,label,detail,equipped});
 if(battle.outcome||battle.summary)return state('finished','Battle settled','Recruitment reopens after you prepare and start the next battle.');
 if(!started)return state('preparation','Before battle','Set your Auto orders now. Recruitment and reloads start when you begin the battle.');
 if(!equipped)return state('unassigned','Not equipped','Place this contract on any action bar to recruit. Unassigned contracts do not reload or auto-recruit.');
 if(skill.cooldown>0)return state('cooldown',`Reload ${Math.ceil(skill.cooldown/66)}s`,'Reload time advances only while the battle is running. This command tent pauses the battle.');
 if(profile.gold<config.cost)return state('gold',`Need ${config.cost} gold`,`You have ${Math.floor(profile.gold)} gold. Each squad costs ${config.cost} gold.`);
 if(queue.queue.length>=queue.capacity)return state('queue','Queue full',`New squads wait until fewer than ${queue.capacity} units are queued. Cancel a waiting unit or resume the battle.`);
 if(queue.population<config.amount*config.population)return state('reserve',`Need ${config.amount*config.population} reserve`,`You have ${queue.population} reserve recruits. This squad needs ${config.amount*config.population}; field slots are a separate limit.`);
 return {canRecruit:true,code:'ready',label:'Ready to recruit',detail:battle.regularArmyCount>=queue.cap?'The field is full. Your paid squad will wait for a field slot, then enter when the battle resumes.':'Your paid squad enters one unit at a time after you resume the battle.',equipped};
}
/** The only recruit mutation delegates to the ordinary engine primitive. */
export function recruitFromArmy(skill,state){if(state.active!==true||!state.battle.paused||!armyRecruitState(skill,state).canRecruit)return false;return summonSquad(skill,state.profile,state.battle.friendlyQueue,state.battle.stats);}
export class ArmyRoster {
 constructor(records){this.records=records.filter(item=>item.department==='army'&&item.squad);this.byId=new Map(this.records.map(item=>[item.id,item]));this.view={query:'',role:'all',state:'all',page:0};}
 setView(patch){const next={...this.view,...patch};next.query=String(next.query??'').slice(0,200);if(!ARMY_ROLES.some(([id])=>id===next.role))next.role='all';if(!['all','equipped','unassigned','auto','manual','ready'].includes(next.state))next.state='all';next.page='page'in patch?Math.max(0,Math.floor(Number(patch.page)||0)):0;this.view=next;}
 query(state){
  const owned=state.profile.skills.map(skill=>({skill,item:this.byId.get(skill.id)})).filter(row=>row.item),words=this.view.query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const rows=owned.map(row=>({...row,recruit:armyRecruitState(row.skill,state)})).filter(({item,skill,recruit})=>words.every(word=>[item.name,item.description,item.role,...(item.traits??[])].join(' ').toLocaleLowerCase().includes(word))&&(this.view.role==='all'||item.role===this.view.role)&&(this.view.state==='all'||this.view.state==='equipped'&&recruit.equipped||this.view.state==='unassigned'&&!recruit.equipped||this.view.state==='auto'&&skill.autocast||this.view.state==='manual'&&!skill.autocast||this.view.state==='ready'&&recruit.canRecruit)).sort((a,b)=>Number(b.recruit.equipped)-Number(a.recruit.equipped)||a.item.name.localeCompare(b.item.name));
  const pageCount=Math.max(1,Math.ceil(rows.length/ARMY_PAGE_SIZE)),page=Math.min(this.view.page,pageCount-1);this.view.page=page;const start=page*ARMY_PAGE_SIZE;
  return {items:rows.slice(start,start+ARMY_PAGE_SIZE),total:rows.length,owned:owned.length,equipped:owned.filter(row=>state.battle.hotbar.bars.some(bar=>bar.includes(row.skill))).length,automatic:owned.filter(row=>row.skill.autocast&&state.battle.hotbar.bars.some(bar=>bar.includes(row.skill))).length,page,pageCount,start,end:Math.min(rows.length,start+ARMY_PAGE_SIZE)};
 }
}
