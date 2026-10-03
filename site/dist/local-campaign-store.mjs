/** Device-local safe checkpoints. No account, network, live battlefield, or schema migration. */
import {CampaignProfiles,MAX_PROFILE_BUNDLE_BYTES} from './engine/profile-manager.mjs';
import {validateProfileDecks} from './deck-presets-model.mjs';
export const LOCAL_CHECKPOINT_SCHEMA='castledecks-local-checkpoint-1';
export const LOCAL_DECK_CHECKPOINT_SCHEMA='castledecks-local-checkpoint-2';
export const LOCAL_SLOT_COUNT=3;
export const LOCAL_STORAGE_PREFIX='castledecks:campaign:checkpoint:v1:';
export const MAX_LOCAL_CHECKPOINT_BYTES=MAX_PROFILE_BUNDLE_BYTES*2+8192;
const reasons=new Set(['ready','battle-start','result','purchase','loadout','settings','profiles','import']);
const phases=new Set(['ready','opening','result']);
const utf8=text=>new TextEncoder().encode(text).byteLength;
const shape=(value,keys,label)=>{if(value===null||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))throw new TypeError(`Invalid ${label}`);};
const integer=(value,min,max,label)=>{if(!Number.isSafeInteger(value)||value<min||value>max)throw new TypeError(`Invalid ${label}`);};
export function checkpointSlotKey(slot,bank){integer(slot,1,LOCAL_SLOT_COUNT,'local slot');if(bank!=='a'&&bank!=='b')throw new TypeError('Invalid local bank');return `${LOCAL_STORAGE_PREFIX}${slot}:${bank}`;}
export function campaignProvenance(manager){const all=[...manager.profiles,...manager.retired],assisted=all.filter(p=>p.cheated===true).length;return assisted===0?'earned':assisted===all.length?'assisted':'mixed';}
export function validateLocalPayload(value){
 shape(value,Object.hasOwn(value??{},'deckPresets')?['bundle','activeIndex','resume','deckPresets']:['bundle','activeIndex','resume'],'checkpoint payload');
 if(typeof value.bundle!=='string')throw new TypeError('Invalid checkpoint bundle');
 const manager=CampaignProfiles.fromBundle(value.bundle,{defaultName:'Castledecks'});
 integer(value.activeIndex,0,manager.profiles.length-1,'checkpoint selection');manager.select(value.activeIndex);
 if(Object.hasOwn(value,'deckPresets'))validateProfileDecks(value.deckPresets,manager);
 shape(value.resume,['phase','level','outcome'],'checkpoint resume');
 if(!phases.has(value.resume.phase))throw new TypeError('Invalid checkpoint phase');integer(value.resume.level,1,30,'checkpoint battle');
 if(![null,'victory','defeat'].includes(value.resume.outcome)||(value.resume.phase==='result')!==(value.resume.outcome!==null))throw new TypeError('Invalid checkpoint result');
 if(value.resume.phase!=='result'&&value.resume.level!==Math.min(30,Math.max(1,manager.active.highestLevel)))throw new TypeError('Checkpoint is not a campaign frontier');
 if(value.resume.phase==='result'&&value.resume.level!==Math.min(30,Math.max(1,manager.active.highestLevel)))throw new TypeError('Invalid result frontier');
 return {manager,provenance:campaignProvenance(manager)};
}
export function parseLocalCheckpoint(text){
 if(typeof text!=='string'||text.length>MAX_LOCAL_CHECKPOINT_BYTES||utf8(text)>MAX_LOCAL_CHECKPOINT_BYTES)throw new TypeError('Checkpoint is too large');
 const value=JSON.parse(text);shape(value,['schema','revision','writtenAt','transaction','reason','payload'],'local checkpoint');
 if(![LOCAL_CHECKPOINT_SCHEMA,LOCAL_DECK_CHECKPOINT_SCHEMA].includes(value.schema))throw new TypeError('Unsupported local checkpoint');
 if((value.schema===LOCAL_DECK_CHECKPOINT_SCHEMA)!==Object.hasOwn(value.payload??{},'deckPresets'))throw new TypeError('Checkpoint deck metadata does not match its version');
 integer(value.revision,1,Number.MAX_SAFE_INTEGER,'checkpoint revision');integer(value.writtenAt,0,8640000000000000,'checkpoint date');
 if(typeof value.transaction!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(value.transaction)||!reasons.has(value.reason))throw new TypeError('Invalid checkpoint metadata');
 const {manager,provenance}=validateLocalPayload(value.payload);return {...value,manager,provenance};
}
export function snapshotCampaign({profiles,battle,started=false,destination='campaign',deckPresets},reason='ready'){
 if(destination!=='campaign')return null;
 if(!(profiles instanceof CampaignProfiles)||!battle||battle.profile!==profiles.active)throw new TypeError('Invalid checkpoint session');
 // An outcome is not settled until summary: its victory count may have changed
 // while its gold/XP reward is still pending. Never write that partial state.
 if((started||battle.outcome)&&!battle.summary)return null;
 if(!reasons.has(reason))throw new TypeError('Invalid checkpoint reason');
 const payload={bundle:profiles.exportBundle(),activeIndex:profiles.activeIndex,resume:{phase:battle.summary?'result':reason==='battle-start'?'opening':'ready',level:Math.min(30,Math.max(1,profiles.active.highestLevel)),outcome:battle.summary?.outcome??null}};
 if(deckPresets!==undefined)payload.deckPresets=validateProfileDecks(deckPresets,profiles);
 // Earned atlas replays preserve their frontier. Reload returns to that frontier,
 // matching the existing portable export; practice destinations never enter here.
 validateLocalPayload(payload);return payload;
}
// An older open tab must never mistake a newer envelope for corrupt data.
// Recognize its advertised family/version without interpreting future payloads.
const supportedCheckpointVersion=2;
const newerEnvelope=text=>{
 if(typeof text!=='string')return false;
 try{const version=/^castledecks-local-checkpoint-(\d+)$/.exec(JSON.parse(text)?.schema??'');return !!version&&Number(version[1])>supportedCheckpointVersion;}catch{return false;}
};
const newerCheckpoint=()=>({ok:false,code:'newer-version',message:'This local slot contains a checkpoint from a newer game version. Reload this tab before continuing. Both checkpoint copies are kept. Export your current session if needed.'});
const storageFailure=error=>({ok:false,code:error?.name==='QuotaExceededError'?'quota':'unavailable',message:error?.name==='QuotaExceededError'?'Local storage is full. Your last verified checkpoint is kept. Export a campaign file.':'Browser storage is unavailable. Keep a campaign file or code before closing.'});
// Transaction tokens identify writes, not users or secrets. The fallback must
// never consume the Math.random stream used by ordinary campaign generation.
let localTransactionNonce=0;
function localTransactionId(){
 const uuid=globalThis.crypto?.randomUUID?.();if(uuid)return uuid;
 if(localTransactionNonce>=Number.MAX_SAFE_INTEGER)throw new RangeError('Local transaction counter exhausted');
 return `${Date.now().toString(36)}-${(++localTransactionNonce).toString(36)}`;
}
export function createLocalCampaignStore({storage,locks,now=()=>Date.now(),id=localTransactionId}={}){
 const getStorage=()=>{const result=typeof storage==='function'?storage():storage;if(!result||typeof result.getItem!=='function'||typeof result.setItem!=='function')throw new Error('Storage unavailable');return result;};
 const read=slot=>{
  try{
   const source=getStorage(),raw=['a','b'].map(bank=>source.getItem(checkpointSlotKey(slot,bank))),valid=[],invalid=[],newer=[];
   raw.forEach((text,i)=>{if(text===null)return;if(newerEnvelope(text)){newer.push(i?'b':'a');return;}try{valid.push({...parseLocalCheckpoint(text),bank:i?'b':'a'});}catch{invalid.push(i?'b':'a');}});
   valid.sort((a,b)=>b.revision-a.revision||b.writtenAt-a.writtenAt);
   if(newer.length)return {ok:true,slot,raw,latest:null,previous:null,invalid,newer,status:'newer',message:newerCheckpoint().message};
   return {ok:true,slot,raw,latest:valid[0]??null,previous:valid[1]??null,invalid,status:invalid.length?(valid.length?'recovered':'corrupt'):valid.length?'ready':'empty'};
  }catch(error){return {...storageFailure(error),slot,status:'unavailable'};}
 };
 const list=()=>Array.from({length:LOCAL_SLOT_COUNT},(_,i)=>read(i+1));
 const lockService=()=>typeof locks==='function'?locks():locks;
 const canWrite=()=>{try{return typeof lockService()?.request==='function';}catch{return false;}};
 const lockFallback={ok:false,code:'locking-unavailable',message:'Safe autosave is unavailable in this browser. Your local saves are kept. Continue for this session and export a campaign file.'};
 const locked=async action=>{
  if(!canWrite())return {...lockFallback};
  try{return await lockService().request(LOCAL_STORAGE_PREFIX+'write',{mode:'exclusive',ifAvailable:true},lock=>lock?action():{ok:false,code:'busy',message:'Another tab is saving this campaign. Autosave paused. Keep playing, then export a file or save to a new slot.'});}
  catch(error){return storageFailure(error);}
 };
 const writeLocked=(slot,payload,{expected,reason='ready'}={})=>{
  try{
   validateLocalPayload(payload);if(!reasons.has(reason))throw new TypeError('Invalid checkpoint reason');
   const current=read(slot);if(!current.ok)return current;if(current.status==='newer')return newerCheckpoint();
   if(expected){if(!Array.isArray(expected)||expected.length!==2||expected.some((raw,i)=>raw!==current.raw[i]))return {ok:false,code:'conflict',message:'Another tab changed this local campaign. Autosave paused. Export your session or use a new slot.'};}
   else if(current.status!=='empty')return {ok:false,code:'occupied',message:'This local slot already has a campaign. Choose Continue, or use an empty slot.'};
   if(!current.latest&&current.status!=='empty')return {ok:false,code:'corrupt',message:'This slot contains unreadable data. It has been kept; choose another slot or export your session.'};
   const bank=current.latest?.bank==='a'?'b':'a',value={schema:Object.hasOwn(payload,'deckPresets')?LOCAL_DECK_CHECKPOINT_SCHEMA:LOCAL_CHECKPOINT_SCHEMA,revision:(current.latest?.revision??0)+1,writtenAt:now(),transaction:id(),reason,payload};
   const text=JSON.stringify(value);parseLocalCheckpoint(text);
   const source=getStorage();source.setItem(checkpointSlotKey(slot,bank),text);
   // setItem atomically replaces one bank. Read it back before claiming success;
   // the other valid bank remains untouched if quota or serialization fails.
   const result=read(slot);
   if(!result.ok||result.raw[bank==='a'?0:1]!==text)return {ok:false,code:'verification',message:'The local write could not be verified. Keep a campaign file before closing.'};
   return {ok:true,slot,record:result.latest,expected:result.raw};
  }catch(error){if(error instanceof TypeError||error instanceof RangeError)return {ok:false,code:'invalid',message:'This checkpoint could not be validated. Your previous local save is kept.'};return storageFailure(error);}
 };
 const removeLocked=(slot,{expected,confirmed=false}={})=>{
  if(!confirmed)return {ok:false,code:'confirmation',message:'Confirm deletion of this local slot first.'};
  const current=read(slot);if(!current.ok)return current;if(current.status==='newer')return newerCheckpoint();
  if(!Array.isArray(expected)||expected.length!==2||expected.some((raw,i)=>raw!==current.raw[i]))return {ok:false,code:'conflict',message:'This local slot changed. Review it before deleting.'};
  try{const source=getStorage();for(const bank of ['a','b'])source.removeItem(checkpointSlotKey(slot,bank));const result=read(slot);return result.status==='empty'?{ok:true}:{ok:false,code:'verification',message:'Deletion could not be verified. Refresh the slot list.'};}catch(error){return storageFailure(error);}
 };
 const write=(slot,payload,{expected,reason='ready'}={})=>{
  // Copy before requesting the asynchronous lock. Later profile edits cannot
  // mutate an already requested opening/purchase/result checkpoint.
  let captured;try{validateLocalPayload(payload);captured=JSON.parse(JSON.stringify(payload));}catch{return Promise.resolve({ok:false,code:'invalid',message:'This checkpoint could not be validated. Your previous local save is kept.'});}
  const options={expected:Array.isArray(expected)?[...expected]:expected,reason};
  return locked(()=>writeLocked(slot,captured,options));
 };
 const remove=(slot,options={})=>{const captured={...options,expected:Array.isArray(options.expected)?[...options.expected]:options.expected};return locked(()=>removeLocked(slot,captured));};
 return Object.freeze({read,list,write,remove,canWrite});
}
