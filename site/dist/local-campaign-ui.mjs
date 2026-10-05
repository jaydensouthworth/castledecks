import {CampaignProfiles} from './engine/profile-manager.mjs';
import {createLocalCampaignStore,snapshotCampaign,campaignProvenance,validateLocalPayload,parseLocalCheckpoint} from './local-campaign-store.mjs';
const labels={earned:'Unassisted',assisted:'Assisted',mixed:'Mixed profiles'};
const html=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const when=value=>new Date(value).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
const storageNote='Saved only in this browser. Clearing site data removes local saves; exported files stay yours.';
const lockNote='Safe autosave is unavailable in this browser. Existing local saves are kept. Export a file before closing this session.';
/** Captures immutable safe snapshots synchronously, then serializes writes under
 * the store's same-origin Web Lock. Late completions belong to their original
 * manager, never whichever campaign happens to be active when a promise resolves. */
export function createLocalCampaignUI({document,window,getState,onRestore,openVault,notify=()=>{},chooseBeforeCreate=false,store=createLocalCampaignStore({storage:()=>window.localStorage,locks:()=>window.navigator?.locks})}){
 const $=id=>document.getElementById?.(id)??document.querySelector('#'+id);
 const sessions=new WeakMap(),reserved=new Map();let pending=null,suspended=false,queue=Promise.resolve(),intent=0;
 const state=()=>getState(),campaign=()=>state().destination==='campaign';
 const current=()=>sessions.get(state().profiles);
 const freeSlot=()=>store.canWrite()?store.list().find(slot=>slot.status==='empty'&&(!reserved.has(slot.slot)||(reserved.get(slot.slot).failed&&!reserved.get(slot.slot).pending))):null;
 function record(values={}){return {decision:'session',slot:null,expected:null,payload:null,last:null,error:'',failed:false,pending:0,epoch:0,scheduled:null,...values};}
 function initialize(){
  if(!campaign())return null;
  const {profiles}=state();let session=sessions.get(profiles);if(session)return session;
  const slots=store.list(),empty=slots.every(slot=>slot.ok&&slot.status==='empty'),unavailable=slots.every(slot=>!slot.ok),writable=store.canWrite();
  const needsChoice=chooseBeforeCreate&&empty;
  session=record({decision:needsChoice?'pending':empty&&writable?'local':unavailable||empty?'session':'pending',slot:!needsChoice&&empty&&writable?1:null,error:unavailable?slots[0].message:!writable?lockNote:''});
  sessions.set(profiles,session);if(session.slot)reserved.set(session.slot,session);return session;
 }
 function message(){
  if(state().destination==='skirmish')return 'Keep a seed code from the workshop to recreate this field. Practice attempts and their rewards are not saved.';
  if(state().destination==='expedition')return 'The Wayfarer Charter is independent, with its own supplied starting kit. Keep a charter file or code before closing; it has no local checkpoints.';
  if(!campaign())return 'Practice and showcase sessions stay separate. Export a file if you want to keep this assisted session.';
  const session=initialize();const newer=store.list().find(slot=>slot.status==='newer'&&(session.slot===slot.slot||session.decision==='pending'));if(newer)return newer.message;if(session.error)return session.error;
  if(session.decision==='pending'&&chooseBeforeCreate&&store.list().every(slot=>slot.ok&&slot.status==='empty'))return 'Choose a new local campaign or play for this session only. No campaign has been created.';
  if(session.decision==='pending')return 'A local campaign is available. Continue it, or start a new campaign without replacing it.';
  if(session.decision==='session')return 'Session only. Export a file or code before closing this tab.';
  if(session.pending)return `Local slot ${session.slot} · Saving checkpoint… Keep this tab open until saving is verified.`;
  const live=(state().started||state().battle?.outcome)&&!state().battle?.summary;
  return `Local slot ${session.slot}${session.last?` · saved ${when(session.last.writtenAt)}`:''}. ${live?'Reload restarts from your battle-opening checkpoint. Current battle actions are not saved.':'Progress autosaves between battles and after purchases.'}`;
 }
 function render(){
  const enabled=campaign(),session=enabled?initialize():null;
  const text=message();$('localHubStatus').textContent=text;$('localVaultStatus').textContent=text;
  const summary=$('hallSaveSummary');if(summary){const attention=enabled&&(session.error||store.list().some(slot=>slot.status==='newer'));summary.textContent=attention?'Save needs attention':enabled&&session.pending?'Saving checkpoint…':'Save status & backups';summary.setAttribute('data-attention',String(!!attention));}
  $('localHubChoices').classList[enabled&&session.decision==='pending'?'remove':'add']('hidden');
  $('localSaveManager').classList[enabled?'remove':'add']('hidden');$('localSessionOnlyVault').classList[enabled&&session.decision==='pending'?'remove':'add']('hidden');
  $('localBrowserNote').textContent=storageNote;if(!enabled)return;
  const slots=store.list(),recent=slots.filter(slot=>slot.latest).sort((a,b)=>b.latest.writtenAt-a.latest.writtenAt)[0];
  $('localContinue').disabled=!recent;$('localContinue').textContent=recent?`Continue ${recent.latest.manager.active.name||'campaign'}`:'No readable campaign';
  const free=!!freeSlot();$('localNew').disabled=!free;$('localNewVault').disabled=!free;$('localSaveCurrent').disabled=!free||session.decision==='pending'||!!session.pending;
  $('localSlots').innerHTML=slots.map(slot=>{
   const latest=slot.latest,p=latest?.manager.active,selected=session.slot===slot.slot&&session.decision==='local';
   const detail=latest?`${html(p.name||'Unnamed campaign')} · ${labels[latest.provenance]} · Battle ${latest.payload.resume.level} · ${when(latest.writtenAt)} · ${latest.manager.profiles.length} active profile${latest.manager.profiles.length===1?'':'s'}`:slot.status==='newer'?'Saved by a newer game version. Reload this tab before continuing; both checkpoint copies are kept.':reserved.has(slot.slot)?'Checkpoint write pending':slot.status==='empty'?'Empty slot':slot.status==='corrupt'?'Unreadable save. Kept for recovery; it will not be overwritten.':'Browser storage unavailable';
   return `<div class="local-slot"><div><strong>Local slot ${slot.slot}${selected?' · current':''}</strong><p>${detail}</p>${slot.status==='recovered'?'<p class="local-warning">One checkpoint copy is unreadable. The last valid copy is available.</p>':''}</div><div class="local-slot-actions"><button data-local-continue="${slot.slot}" ${latest?'':'disabled'}>Continue</button><button data-local-recover="${slot.slot}" ${slot.previous?'':'disabled'}>Previous checkpoint</button><button data-local-delete="${slot.slot}" class="danger-link" ${store.canWrite()&&slot.ok&&!['empty','newer'].includes(slot.status)?'':'disabled'}>Delete local slot</button></div></div>`;
  }).join('');
  for(const button of $('localSlots').querySelectorAll('[data-local-continue]'))button.onclick=()=>requestContinue(Number(button.getAttribute('data-local-continue')));
  for(const button of $('localSlots').querySelectorAll('[data-local-recover]'))button.onclick=()=>requestContinue(Number(button.getAttribute('data-local-recover')),true);
  for(const button of $('localSlots').querySelectorAll('[data-local-delete]'))button.onclick=()=>requestDelete(Number(button.getAttribute('data-local-delete')));
 }
 function enqueue(session,payload,reason){
  const slot=session.slot,epoch=session.epoch,fingerprint=JSON.stringify(payload);
  if(session.scheduled===fingerprint||!session.pending&&session.last&&JSON.stringify(session.last.payload)===fingerprint)return queue;
  session.scheduled=fingerprint;session.pending++;render();
  const task=queue.then(async()=>{
   if(session.epoch!==epoch||session.decision!=='local'||session.slot!==slot||session.failed)return {ok:false,skipped:true};
   const saved=await store.write(slot,payload,{expected:session.expected,reason});
   if(session.epoch!==epoch||session.slot!==slot)return saved;
   if(saved.ok){session.expected=saved.expected;session.last=saved.record;session.error='';}
   else{session.error=saved.message;session.failed=true;}
   return saved;
  }).catch(()=>{if(session.epoch===epoch){session.error='The checkpoint could not be saved. Keep your session open and export a campaign file.';session.failed=true;}return {ok:false};}).finally(()=>{session.pending--;if(session.scheduled===fingerprint)session.scheduled=null;render();});
  queue=task.then(()=>{});return task;
 }
 function checkpoint(reason='ready'){
  if(suspended||!campaign())return Promise.resolve({ok:true,skipped:true});
  const session=initialize();let payload;
  try{payload=snapshotCampaign(state(),reason);}catch{session.error='This session could not be checkpointed. Your previous local save is kept; try exporting a file.';render();return Promise.resolve({ok:false});}
  if(!payload){render();return Promise.resolve({ok:true,skipped:true});}
  session.payload=payload;
  if(session.decision!=='local'||session.failed){render();return Promise.resolve({ok:true,skipped:true});}
  return enqueue(session,payload,reason);
 }
 function beforeBegin(){
  if(!campaign())return true;
  const session=initialize();if(session.decision==='pending'){render();openVault();$('localSlots').querySelector('[data-local-continue]')?.focus?.();notify('Continue your saved campaign, start a new local campaign, or choose session only.');return false;}
  // Gameplay never waits for browser storage. The captured opening is immutable,
  // and the UI says Saving until the queued write has actually been verified.
  checkpoint('battle-start');return true;
 }
 function confirm(text,action,{importChoice=false}={}){
  intent++;pending=action;$('localConfirmText').textContent=text;$('localConfirm').classList.remove('hidden');$('localConfirmAccept').textContent=importChoice?'Import into new local slot':'Confirm';$('localConfirmAccept').disabled=importChoice&&!freeSlot();$('localImportSession').classList[importChoice?'remove':'add']('hidden');$('localConfirmAccept').focus?.();
 }
 function cancel(){intent++;pending=null;$('localConfirm').classList.add('hidden');$('localImportSession').classList.add('hidden');}
 function adopt(manager,{slot=null,expected=null,payload=null,last=null,error=''}={}){
  const local=slot&&store.canWrite(),session=record({decision:local?'local':'session',slot:local?slot:null,expected,payload,last,error:!store.canWrite()?lockNote:error});
  sessions.set(manager,session);if(local)reserved.set(slot,session);
  suspended=true;try{onRestore(manager,payload);}finally{suspended=false;}
  cancel();render();return session;
 }
 async function requestContinue(slot,previous=false){
  if(!campaign())return;openVault();const generation=++intent;await queue;
  if(generation!==intent||!campaign())return;
  const saved=store.read(slot),record=previous?saved.previous:saved.latest;
  if(!record){$('vaultStatus').textContent=saved.message??'No valid checkpoint is available in that slot.';render();return;}
  confirm(`${previous?'Recover the previous checkpoint for':'Continue'} “${record.manager.active.name||'Unnamed campaign'}” in local slot ${slot}? It opens at battle ${record.payload.resume.level}, with ${record.manager.active.gold.toLocaleString()} gold. Any current battlefield is replaced. Its last local checkpoint stays available.`,{kind:'continue',slot,previous,expected:saved.raw,record});
 }
 function newCampaign(){if(!campaign())return;openVault();confirm('Start a new campaign in an empty local slot? Existing local campaigns stay available. The current battlefield will close.',{kind:'new'});}
 function openNew(manager,reason='import',sessionOnly=false){
  const free=freeSlot();if(!sessionOnly&&!free){$('vaultStatus').textContent='No safely writable local slot is available. Export first, delete a local slot explicitly, or import for this session only.';return false;}
  const session=adopt(manager,{slot:sessionOnly?null:free.slot});checkpoint(reason);
  $('introNotice').textContent=sessionOnly?'Campaign imported for this session only. Begin to restart its saved battle. Export before closing.':`Campaign opened in local slot ${session.slot}. Begin when ready; check the local-save status before closing.`;
  $('saveStatus').textContent=$('introNotice').textContent;return true;
 }
 // Cloud loads expose their final destination choices in Saves. The selected
 // empty slot is captured in the choice, then checked again at commit time.
 function checkpointRestorePlan(){
  if(!campaign()||state().temporarySession)throw new Error('Return to your campaign before loading a checkpoint.');
  const free=freeSlot();
  return {choices:[{id:free?`local:${free.slot}`:'local',label:free?`Load into device slot ${free.slot}`:'No empty device slot',disabled:!free},{id:'session',label:'Load for this session only'}],effect:`This replaces your current campaign session and restarts the saved battle. Export any unsaved progress first. ${free?'A device-slot load creates a new local save.':'No safely writable empty device slot is available.'} Session-only progress needs an export before closing. Existing device saves and the cloud copy stay unchanged.`};
 }
 function openCheckpoint(payload,{sessionOnly=false,slot=null}={}){
  const free=freeSlot();
  if(!sessionOnly&&(!free||slot!==null&&free.slot!==slot))throw new Error('The empty device slot changed. Review the cloud checkpoint again or choose session only.');
  const {manager}=validateLocalPayload(payload),session=adopt(manager,{slot:sessionOnly?null:free.slot,payload});
  if(!sessionOnly)enqueue(session,payload,'import');
  $('introNotice').textContent=sessionOnly?'Cloud checkpoint opened for this session only. Export before closing.':`Cloud checkpoint opened in local slot ${session.slot}. Check saving has finished before closing.`;
  return {restored:true};
 }
 function restoreCheckpoint(text,choice){
  if(!campaign()||state().temporarySession)throw new Error('This session changed. Review the checkpoint again.');
  if(choice!=='session'&&!/^local:[1-3]$/.test(choice??''))throw new Error('Choose an empty device slot or session only.');
  const {payload}=parseLocalCheckpoint(text);
  return openCheckpoint(JSON.parse(JSON.stringify(payload)),{sessionOnly:choice==='session',slot:choice==='session'?null:Number(choice.slice(6))});
 }
 function requestCheckpoint(text){
  if(!campaign()||state().temporarySession)return {staged:false};
  const parsed=parseLocalCheckpoint(text),payload=JSON.parse(JSON.stringify(parsed.payload));
  openVault();const origin=state(),free=freeSlot();
  confirm(`Open cloud checkpoint “${parsed.manager.active.name||'Unnamed campaign'}” (${labels[parsed.provenance].toLowerCase()}, ${parsed.manager.profiles.length} profiles)? It preserves the selected profile and saved decks. ${free?'Use a new empty local slot or session only.':'No writable empty local slot is available; use session only.'} Existing local saves stay unchanged. Export your current unsaved session first.`,{kind:'checkpoint',payload,profiles:origin.profiles,battle:origin.battle},{importChoice:true});
  return {staged:true};
 }
 function requestImport(text){
  if(!campaign())return {handled:false};
  const manager=CampaignProfiles.fromBundle(text,{defaultName:'Castledecks'});
  openVault();const kind=labels[campaignProvenance(manager)],free=freeSlot();
  confirm(`Import “${manager.active.name||'Unnamed campaign'}” (${kind.toLowerCase()}, ${manager.profiles.length} active profiles)? ${free?'It opens in a new local slot; existing local campaigns stay unchanged.':'There is no safely writable empty local slot. You can open it for this session only.'} The current battlefield closes; export any unsaved session first.`,{kind:'import',manager},{importChoice:true});
  return {handled:true};
 }
 async function requestDelete(slot){
  if(!campaign())return;openVault();const generation=++intent;await queue;if(generation!==intent||!campaign())return;
  const saved=store.read(slot);if(!saved.ok||saved.status==='empty')return;
  confirm(`Delete local slot ${slot} and both recovery checkpoints? This cannot be undone. Export its campaign first if you want a copy. Your running session and downloaded files are kept.`,{kind:'delete',slot,expected:saved.raw,session:reserved.get(slot)});
 }
 function saveCurrent(){
  if(!campaign())return;cancel();const session=initialize();if(session.pending)return;
  try{const safe=snapshotCampaign(state(),'ready');if(safe)session.payload=safe;}catch{$('vaultStatus').textContent='A valid checkpoint could not be prepared. Export this session before leaving.';return;}
  if(!session.payload){$('vaultStatus').textContent='A safe checkpoint is not available yet. Finish this battle or export a campaign file.';return;}
  const free=freeSlot();if(!free){$('vaultStatus').textContent='No safely writable empty local slot is available.';return;}
  session.epoch++;session.slot=free.slot;session.expected=null;session.last=null;session.decision='local';session.failed=false;session.error='';session.scheduled=null;reserved.set(free.slot,session);
  enqueue(session,session.payload,'ready');
 }
 async function accept(sessionOnly=false){
  const action=pending;if(!action)return;
  if(action.kind==='checkpoint'&&(!campaign()||state().temporarySession||state().profiles!==action.profiles||state().battle!==action.battle)){cancel();$('vaultStatus').textContent='This session changed. Review the checkpoint again.';return;}
  if(action.kind==='continue'){
   const now=store.read(action.slot);if(!now.ok||action.expected.some((raw,i)=>raw!==now.raw[i])){cancel();$('vaultStatus').textContent='This local slot changed. Review its latest checkpoint before continuing.';render();return;}
   const {manager}=validateLocalPayload(action.record.payload);adopt(manager,{slot:action.slot,expected:now.raw,payload:action.record.payload,last:action.previous?null:action.record});
   const recovered=action.previous||now.status==='recovered';$('introNotice').textContent=`${recovered?'Recovered checkpoint':'Campaign continued'}. Battle ${action.record.payload.resume.level} is ready from its saved opening; live battlefield actions are not resumed.`;
   if(action.previous)checkpoint('ready');notify(recovered?'Checkpoint recovered':'Local campaign continued');
  }else if(action.kind==='new')openNew(new CampaignProfiles({defaultName:'Castledecks'}),'ready');
  else if(action.kind==='import')openNew(action.manager,'import',sessionOnly);
  else if(action.kind==='checkpoint'){
   const free=freeSlot();if(!sessionOnly&&!free){$('vaultStatus').textContent='No empty slot is available. Choose session only or cancel.';return;}
   openCheckpoint(action.payload,{sessionOnly});
  }
  else if(action.kind==='delete'){
   const session=action.session;if(session?.slot===action.slot){session.epoch++;session.slot=null;session.decision='session';session.expected=null;session.last=null;session.error='';session.failed=false;}
   reserved.delete(action.slot);cancel();const generation=intent;const result=await store.remove(action.slot,{expected:action.expected,confirmed:true});
   if(generation===intent&&campaign())$('vaultStatus').textContent=result.ok?'Local slot deleted. The current in-memory session is still available.':result.message;
   render();
  }
 }
 $('localContinue').onclick=()=>{const recent=store.list().filter(slot=>slot.latest).sort((a,b)=>b.latest.writtenAt-a.latest.writtenAt)[0];if(recent)return requestContinue(recent.slot);};
 $('localNew').onclick=newCampaign;$('localNewVault').onclick=newCampaign;
 $('localSessionOnly').onclick=()=>{const session=initialize();if(!session||session.decision!=='pending')return;session.epoch++;session.decision='session';session.slot=null;session.error=store.canWrite()?'':lockNote;cancel();render();notify('Session only. Export before closing.');};
 $('localSessionOnlyVault').onclick=$('localSessionOnly').onclick;
 $('localManage').onclick=()=>{openVault();render();};$('localSaveCurrent').onclick=saveCurrent;
 $('localConfirmAccept').onclick=()=>accept();$('localImportSession').onclick=()=>accept(true);$('localConfirmCancel').onclick=cancel;
 window.addEventListener?.('storage',event=>{if(event.key?.startsWith('castledecks:campaign:checkpoint:v1:'))render();});
 return Object.freeze({checkpoint,beforeBegin,render,cancel,requestImport,requestCheckpoint,checkpointRestorePlan,restoreCheckpoint,reviewIntent:()=>intent,store,message,whenIdle:()=>queue});
}
