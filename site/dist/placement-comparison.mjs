import {ARMY_JOBS,cardTactics} from './card-tactics.mjs';
import {getCardInsights} from './armory-insights.mjs';

/** Read-only hypothetical placement. Slots and visible wrappers, not a cached
 * profile binding map, define the current editor. Never calls drop or ticks.
 * Unknown cards retain their identity but gain no inferred jobs or statistics. */
const validSlot=value=>Number.isInteger(value)&&value>=0&&value<30;
const validBinding=value=>value===-1||validSlot(value);
const visible=(layout,profile,wrapper)=>!!wrapper&&layout.dragIcons?.includes(wrapper)&&profile.skills?.includes(wrapper.skill)&&profile.owned?.has(wrapper.skill.id)&&validBinding(wrapper.binding)&&wrapper.skill.binding===wrapper.binding;
function placementState(layout,profile,id,destination){
 if(!layout||layout.closed||!profile||!validSlot(destination))return null;
 const source=layout.dragIcons?.find(w=>w.skill.id===id),target=layout.slots?.[destination]?.holding??null;
 if(!visible(layout,profile,source)||source.binding>=0&&layout.slots[source.binding]?.holding!==source)return null;
 const equipped=[],seen=new Set();
 for(let index=0;index<30;index++){
  const wrapper=layout.slots?.[index]?.holding;if(!wrapper)continue;
  if(!visible(layout,profile,wrapper)||wrapper.binding!==index||seen.has(wrapper.skill.id))return null;
  seen.add(wrapper.skill.id);equipped.push(wrapper);
 }
 if(target&&!visible(layout,profile,target))return null;
 return {source,target,equipped};
}
export function capturePlacementComparison({layout,profile},id,destination){
 const state=placementState(layout,profile,id,destination);if(!state)return null;
 return {layout,profile,id,destination,source:state.source,sourceBinding:state.source.binding,target:state.target};
}
export function isPlacementComparisonCurrent(plan,{layout,profile}){
 if(!plan||plan.layout!==layout||plan.profile!==profile)return false;
 const state=placementState(layout,profile,plan.id,plan.destination);
 return !!state&&state.source===plan.source&&state.source.binding===plan.sourceBinding&&state.target===plan.target;
}
/** Numeric deltas only compare the exact same measure, unit and scope. A dash
 * means this card has no verified value for that measure, never a zero. */
export function compareInsightMetrics(source,target){
 const left=new Map(source.metrics.map(metric=>[metric.key,metric])),right=new Map(target.metrics.map(metric=>[metric.key,metric]));
 return [...new Set([...left.keys(),...right.keys()])].map(key=>{
  const a=left.get(key)??null,b=right.get(key)??null,comparable=!!a&&!!b&&a.unit===b.unit&&a.scope===b.scope&&Number.isFinite(a.value)&&Number.isFinite(b.value);
  return {key,label:(a??b).label,source:a,target:b,comparable,delta:comparable?a.value-b.value:null};
 });
}
export function placementComparison(records,{layout,profile},id,destination){
 const state=placementState(layout,profile,id,destination);if(!state)return null;
 const byId=new Map(records.map(item=>[item.id,item])),{source,target,equipped}=state;
 const kind=target===source?'unchanged':target?(source.binding<0?'replace':'swap'):'move';
 const before=equipped.map(wrapper=>wrapper.skill.id),after=kind==='replace'?before.filter(value=>value!==target.skill.id).concat(id):source.binding<0?before.concat(id):[...before];
 const added=after.filter(value=>!before.includes(value)),removed=before.filter(value=>!after.includes(value));
 const jobs=ARMY_JOBS.map(([job,label])=>{
  const providers=ids=>ids.filter(value=>cardTactics(byId.get(value))?.jobs.includes(job));
  return {id:job,label,before:providers(before),after:providers(after)};
 });
 const describe=wrapper=>{
  if(!wrapper)return null;
  const item=byId.get(wrapper.skill.id)??{id:wrapper.skill.id,name:wrapper.skill.id};
  // Only genuine skill records may use ability insights; copied artwork,
  // category labels, companion records or unknown IDs do not confer mechanics.
  const insights=item.kind==='skill'?getCardInsights(item,{rank:wrapper.skill.rank,heroRank:profile.rank,difficulty:profile.difficulty}):{metrics:[],notes:['No verified ability statistics are available.'],tactics:[]};
  const metric=key=>insights.metrics.find(value=>value.key===key)?.value;
  const deployment=['summonGold','squadUnits','reserveCost'].every(key=>Number.isFinite(metric(key)))?{gold:metric('summonGold'),units:metric('squadUnits'),reserve:metric('reserveCost'),automatic:!!wrapper.skill.autocast}:null;
  return {id:item.id,name:item.name,rank:wrapper.skill.rank,binding:wrapper.binding,tactics:cardTactics(item),insights,deployment};
 };
 const left=describe(source),right=describe(target);
 return {kind,destination,source:left,target:right,before,after,added,removed,jobs,gained:jobs.filter(job=>!job.before.length&&job.after.length),lost:jobs.filter(job=>job.before.length&&!job.after.length),retained:jobs.filter(job=>job.before.length&&job.after.length&&job.before.length!==job.after.length),metrics:right?compareInsightMetrics(left.insights,right.insights):[],unverified:[...new Set([...before,...after])].filter(value=>!cardTactics(byId.get(value))&&byId.get(value)?.category==='army')};
}
