/** Strict, isolated charter state. The normal profile serializer stays unchanged.
 * Saved live play restarts a field; settled results are receipts, not new grants.
 */
import {PlayerProfile} from './engine/progression.mjs';
import {CampaignProfiles,restoreProfiles,MAX_PROFILE_BUNDLE_BYTES} from './engine/profile-manager.mjs';
import {EXPEDITION_ID,EXPEDITION_STARTER,EXPEDITION_LENGTH,expeditionField} from './expedition-data.mjs';
export const EXPEDITION_SAVE_SCHEMA='castledecks-expeditions-1';
const safeInteger=(value,min,max,label)=>{if(!Number.isSafeInteger(value)||value<min||value>max)throw new TypeError(`Invalid ${label}`);};
const shape=(value,keys,label)=>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))throw new TypeError(`Invalid ${label} fields`);};
const seedValue=()=>1+Math.floor(Math.random()*0xfffffffe);
const statKeys=['shotsFired','bodyShots','headShots','goldEarned','goldSpent','populationGiven'];
export function prepareExpeditionProfile(profile){
 if(!(profile instanceof PlayerProfile))throw new TypeError('Expected a live charter profile');
 const starter=EXPEDITION_STARTER;
 Object.assign(profile,{rank:starter.rank,xp:0,gold:starter.gold,level:1,highestLevel:1,scene:1,highestScene:1,victories:0,defeats:0,cheated:false});
 for(const id of starter.skills){const skill=profile.skills.find(skill=>skill.id===id)??profile.addSkill(id);skill.rank=id==='arrow'?starter.basicRank:starter.skillRank;skill.threshold=(skill.rank+1)*100;skill.autocast=['grunt','archer'].includes(id);}
 return profile;
}
export function freshExpeditionProfile(name='Wayfarer',options={}){
 const profile=prepareExpeditionProfile(new PlayerProfile(name));
 if(options.shootingMode!==undefined){if(!['classic','anywhere','point_aim','auto_aim'].includes(options.shootingMode))throw new RangeError('Unknown aiming mode');profile.shootingMode=options.shootingMode;}
 return profile;
}
function validateReceipt(receipt,path,cleared){
 if(receipt===null)return null;
 shape(receipt,['id','outcome','gold','xp','stats','rankBefore'],'charter result');
 if(receipt.id!==path.at(-1)||!['victory','defeat'].includes(receipt.outcome))throw new TypeError('Invalid charter result identity');
 for(const key of ['gold','xp'])safeInteger(receipt[key],0,Number.MAX_SAFE_INTEGER,`charter result ${key}`);
 safeInteger(receipt.rankBefore,1,26,'charter opening rank');
 shape(receipt.stats,statKeys,'charter result statistics');for(const key of statKeys)safeInteger(receipt.stats[key],0,Number.MAX_SAFE_INTEGER,`charter statistic ${key}`);
 if(receipt.outcome==='victory'&&cleared!==path.length||receipt.outcome==='defeat'&&cleared!==path.length-1)throw new TypeError('Charter result does not match route');
 if(receipt.outcome==='defeat'&&(receipt.gold!==0||receipt.xp!==0))throw new TypeError('Defeat cannot have victory bonuses');
 return {...receipt,stats:{...receipt.stats}};
}
export function validateExpeditionState(value){
 shape(value,['seed','path','cleared','lastResult'],'charter progress');
 safeInteger(value.seed,1,0xffffffff,'charter seed');
 if(!Array.isArray(value.path)||value.path.length<1||value.path.length>EXPEDITION_LENGTH||value.path[0]!=='tollgate')throw new TypeError('Invalid charter route');
 for(let i=0;i<value.path.length;i++){const field=expeditionField(value.path[i]);if(field.leg!==i+1||i>0&&!expeditionField(value.path[i-1]).next.includes(field.id))throw new TypeError('Invalid charter route choice');}
 safeInteger(value.cleared,Math.max(0,value.path.length-1),value.path.length,'charter cleared count');
 const lastResult=validateReceipt(value.lastResult,value.path,value.cleared);
 if(value.cleared===value.path.length&&lastResult?.outcome!=='victory')throw new TypeError('Cleared charter field needs its settled result');
 return {seed:value.seed,path:[...value.path],cleared:value.cleared,lastResult};
}
export class ExpeditionRun{
 constructor({profile=freshExpeditionProfile(),seed=null,state=null}={}){
  if(!(profile instanceof PlayerProfile))throw new TypeError('Expected a live charter profile');
  this.profile=profile;this.state=validateExpeditionState(state??{seed:seed??seedValue(),path:['tollgate'],cleared:0,lastResult:null});this.settledBattles=new WeakSet();
 }
 get current(){return expeditionField(this.state.path.at(-1));}
 get complete(){return this.state.cleared===EXPEDITION_LENGTH;}
 get choosing(){return !this.complete&&this.state.cleared===this.state.path.length;}
 get choices(){return this.choosing?this.current.next.map(expeditionField):[];}
 choose(id){
  if(!this.choosing||!this.current.next.includes(id))return false;
  this.state={...this.state,path:[...this.state.path,id],lastResult:null};return true;
 }
 /** Called for an actual settled battle exactly once. Opening/inspection never
  * advances the route. A defeat keeps the same field and seed for a retry. */
 record(battle){
  if(this.settledBattles.has(battle))return false;
  if(battle?.profile!==this.profile||battle.encounter?.id!==this.current.id||!battle.summary||this.choosing||this.complete)throw new Error('Charter result does not belong to the current field');
  const receipt={id:this.current.id,outcome:battle.summary.outcome,gold:battle.summary.gold??0,xp:battle.summary.xp??0,stats:Object.fromEntries(statKeys.map(key=>[key,battle.stats[key]??0])),rankBefore:battle.expeditionOpeningRank};
  const cleared=this.state.cleared+(receipt.outcome==='victory'?1:0);
  this.state=validateExpeditionState({...this.state,cleared,lastResult:receipt});this.settledBattles.add(battle);return true;
 }
 retry(){if(this.choosing||this.complete)return false;this.state={...this.state,lastResult:null};return true;}
 exportState(){return validateExpeditionState(this.state);}
}
/** Same management surface as CampaignProfiles, but an isolated save codec.
 * A Crownroad bundle is never silently imported as a charter, or vice versa. */
export class ExpeditionProfiles{
 constructor({seedFactory=seedValue,manager=null,states=null,retiredStates=null}={}){
  this.seedFactory=seedFactory;this.runs=new Map();
  this.manager=manager??new CampaignProfiles({profiles:[freshExpeditionProfile()],defaultName:'Wayfarer'});
  if(states&&states.length!==this.manager.profiles.length||retiredStates&&retiredStates.length!==this.manager.retired.length)throw new TypeError('Charter progress records do not match profiles');
  this.manager.profiles.forEach((profile,index)=>this.runs.set(profile,new ExpeditionRun({profile,seed:states?.[index]?.seed??this.seedFactory(),state:states?.[index]??null})));
  this.manager.retired.forEach((profile,index)=>this.runs.set(profile,new ExpeditionRun({profile,seed:retiredStates?.[index]?.seed??this.seedFactory(),state:retiredStates?.[index]??null})));
 }
 get profiles(){return this.manager.profiles;}
 get retired(){return this.manager.retired;}
 get active(){return this.manager.active;}
 get activeIndex(){return this.manager.activeIndex;}
 get canCreate(){return this.manager.canCreate;}
 get canDelete(){return this.manager.canDelete;}
 get activeRun(){return this.runs.get(this.active);}
 select(index){return this.manager.select(index);}
 create(name,options={}){
  const profile=this.manager.create(name,options);if(!profile)return null;
  prepareExpeditionProfile(profile);this.runs.set(profile,new ExpeditionRun({profile,seed:this.seedFactory()}));return profile;
 }
 deleteCurrent(){const removed=this.manager.deleteCurrent();if(removed)this.runs.delete(removed);return removed;}
 retireCurrent(){
  if(!this.activeRun.complete)throw new Error('Only a completed charter can be archived');
  const retired=this.manager.retireCurrent();if(!this.runs.has(this.manager.active)){const profile=prepareExpeditionProfile(this.manager.active);this.runs.set(profile,new ExpeditionRun({profile,seed:this.seedFactory()}));}return retired;
 }
 restartCurrent(){
  const prior=this.active,seed=this.activeRun.state.seed,profile=freshExpeditionProfile(prior.name,{shootingMode:prior.shootingMode});profile.difficulty=prior.difficulty;
  const profiles=this.profiles;profiles[this.activeIndex]=profile;
  this.manager=new CampaignProfiles({profiles,retired:this.retired,activeIndex:this.activeIndex,defaultName:'Wayfarer'});this.runs.delete(prior);this.runs.set(profile,new ExpeditionRun({profile,seed}));return profile;
 }
 highScores(){return this.manager.highScores();}
 exportBundle(){
  const payload={schema:EXPEDITION_SAVE_SCHEMA,campaign:EXPEDITION_ID,profiles:JSON.parse(this.manager.exportBundle()),runs:this.profiles.map(profile=>this.runs.get(profile).exportState()),retiredRuns:this.retired.map(profile=>this.runs.get(profile).exportState())};
  const text=JSON.stringify(payload);if(new TextEncoder().encode(text).byteLength>MAX_PROFILE_BUNDLE_BYTES)throw new RangeError('Charter save exceeds 1 MiB');return text;
 }
 importBundle(text){
  const next=restoreExpeditions(text,{seedFactory:this.seedFactory});this.manager=next.manager;this.runs=next.runs;return this.active;
 }
}
export function restoreExpeditions(text,{seedFactory=seedValue}={}){
 if(typeof text!=='string'||text.length>MAX_PROFILE_BUNDLE_BYTES||new TextEncoder().encode(text).byteLength>MAX_PROFILE_BUNDLE_BYTES)throw new RangeError('Charter save must be JSON text under 1 MiB');
 const value=JSON.parse(text);shape(value,['schema','campaign','profiles','runs','retiredRuns'],'charter save');
 if(value.schema!==EXPEDITION_SAVE_SCHEMA||value.campaign!==EXPEDITION_ID)throw new TypeError('Unsupported charter save');
 if(!Array.isArray(value.runs)||!Array.isArray(value.retiredRuns))throw new TypeError('Invalid charter profile lists');
 const states=value.runs.map(validateExpeditionState),retiredStates=value.retiredRuns.map(validateExpeditionState),manager=restoreProfiles(JSON.stringify(value.profiles),{defaultName:'Wayfarer'});
 if(states.length!==manager.profiles.length||retiredStates.length!==manager.retired.length||retiredStates.some(state=>state.cleared!==EXPEDITION_LENGTH))throw new TypeError('Invalid charter profile progress');
 return new ExpeditionProfiles({manager,states,retiredStates,seedFactory});
}
