/** Opt-in developer fixture. Only this page owns these synthetic identities.
 * No production client, save codec, live game, or browser storage is connected.
 * The real renderer, protocol model, bridge, and journal run against memory.
 */
import {mountCloudAccountPanel} from './cloud-account-panel.mjs';
import {createCloudAccountModel} from './cloud-account-model.mjs';
import {createCloudGameBridge} from './cloud-game-bridge.mjs';
import {createUploadJournal} from './cloud-upload-journal.mjs';

const MODES=Object.freeze({crownroad:'Crownroad',wayfarer:'Wayfarer',decks:'Saved decks'});
const ACCOUNT='synthetic-cloud-review-lab-account';
const STAMP=1791072000000;
const SCHEMA='castledecks-synthetic-review-lab-1';
function fixtureDocument(kind,source,slot=1){
 return JSON.stringify({schema:SCHEMA,kind,source:`synthetic-${source}-${kind}-${slot}`,description:kind==='decks'?'Synthetic Bow, Synthetic Bow (2). Missing cards: synthetic Grunt.':kind==='wayfarer'?'Synthetic Wayfarer charter · 1 profile · field 1.':'Synthetic Crownroad campaign · 2 profiles · field 4.'});
}
function validateDocument(kind,text){
 const data=JSON.parse(text);
 if(data?.schema!==SCHEMA||data.kind!==kind||!Object.hasOwn(MODES,kind)||!data.source?.startsWith('synthetic-')||typeof data.description!=='string')throw new Error('Only synthetic review-lab documents are accepted.');
 return data;
}

export function mountCloudReviewLab({root,document}){
 if(!root||!document)throw new TypeError('An explicit lab root and document are required.');
 const el=(tag,text,id)=>{const node=document.createElement(tag);if(text)node.textContent=text;if(id)node.id=id;return node;};
 const button=(text,id)=>{const node=el('button',text,id);node.type='button';return node;};
 const heading=el('h1','Synthetic cloud review lab'),intro=el('p','All accounts, slots, sources, data, and actions on this page are synthetic. No sign-in, network transfer, persistent saves, card grants, or cloud writes can occur. Nothing is saved to browser storage.','lab-safety');
 intro.className='lab-safety';
 const controls=el('div',null,'lab-controls'),modeLabel=el('label','Synthetic scenario '),modeSelect=el('select',null,'lab-mode'),openButton=button('Open synthetic Saves','lab-open'),holdButton=button('Hold next synthetic read','lab-hold'),releaseButton=button('Release synthetic read','lab-release');
 modeSelect.setAttribute('aria-label','Synthetic scenario');
 for(const [value,label] of Object.entries(MODES)){const option=el('option',label);option.value=value;modeSelect.append(option);}modeSelect.value='crownroad';
 const fullLabel=el('label','Synthetic device slots full '),fullInput=el('input',null,'lab-full');fullInput.type='checkbox';fullInput.checked=false;fullLabel.className='lab-checkbox';fullLabel.append(fullInput);
 modeLabel.append(modeSelect);controls.append(modeLabel,fullLabel,openButton,holdButton,releaseButton);
 const guidance=el('p','To test an interrupted final check: open a review, hold the next synthetic read, choose a load destination, then Cancel or Back before releasing the read.','lab-guidance');
 const workspace=el('section',null,'lab-workspace'),backButton=button('Back to lab overview','lab-back'),panelRoot=el('section',null,'lab-cloud-panel');
 panelRoot.setAttribute('data-synthetic','true');const workspaceHeading=el('div',null,'lab-workspace-heading');workspaceHeading.append(el('h2','Saves · synthetic rehearsal'),backButton);workspace.append(workspaceHeading,panelRoot);workspace.hidden=true;
 const result=el('p','Synthetic fixture ready. No simulated load has run.','lab-result'),readState=el('p',null,'lab-read-state');result.setAttribute('role','status');readState.setAttribute('aria-live','polite');
 root.replaceChildren(heading,intro,controls,guidance,workspace,result,readState);
 let mode='crownroad',opened=false,disposed=false,holdNext=false,held=null,simulations=0,reads=0,generation=0,fullSlots=false;
 const journalBytes=new Map(),events=[];
 const log=message=>{events.push(message);if(events.length>12)events.shift();};
 const memoryStorage=Object.freeze({getItem:key=>journalBytes.get(key)??null,setItem:(key,value)=>journalBytes.set(key,String(value)),removeItem:key=>journalBytes.delete(key)});
 let host=makeHost();
 function makeHost(){return {profiles:{active:{name:`Synthetic ${MODES[mode]} source ${generation}`}},battle:{summary:null},destination:mode==='wayfarer'?'expedition':'campaign',temporarySession:false,loadGeneration:generation,localReviewIntent:generation,started:false};}
 function updateReadState(){
  holdButton.disabled=disposed||holdNext||!!held;holdButton.setAttribute('aria-pressed',String(holdNext));releaseButton.disabled=disposed||!held;
  readState.textContent=`Synthetic reads: ${reads}. ${held?'One read is held in memory. Release it to test stale completion.':holdNext?'The next read will wait in memory.':'No read is held.'} Simulated loads: ${simulations}. Real writes: 0.`;
 }
 function simulatedLoad(kind,choice){
  // Deliberately only a receipt: no parsed object, storage, game, or save callback
  // is ever adopted. Even an accepted choice cannot mutate a real destination.
  simulations++;const message=`Synthetic only: ${MODES[kind]} ${choice||'session'} choice checked. No device save, cloud copy, profile, or card was changed.`;
  log(message);result.textContent=message;updateReadState();return {restored:true};
 }
 const bridge=createCloudGameBridge({getState:()=>host,captureDocument:kind=>fixtureDocument(kind,`source-${generation}`),validateDocument,
  reviewCrownroad:(_text,_parsed,choice)=>simulatedLoad('crownroad',choice),replaceWayfarer:()=>simulatedLoad('wayfarer','session'),reviewDecks:(_text,_parsed,choice)=>simulatedLoad('decks',choice),
  restorePlan(kind){
   const effect=kind==='crownroad'?`This replaces your current campaign session and restarts the saved battle. Export any unsaved progress first. ${fullSlots?'No safely writable empty device slot is available.':'A device-slot load creates a new local save.'} Session-only progress needs an export before closing. Existing device saves and the cloud copy stay unchanged.`:kind==='wayfarer'?'This replaces your current Wayfarer charter session and restarts its field. Export the current charter first if you want to keep it.':'Add to Synthetic source: Synthetic Bow, Synthetic Bow (2). Existing decks stay; matching names receive a number. Missing cards: Grunt. These decks cannot be applied until every card is owned. No cards are unlocked or equipped. The cloud copy stays unchanged.';
   return {effect,choices:kind==='crownroad'?[{id:fullSlots?'local':'local:2',label:fullSlots?'No empty device slot':'Load into device slot 2',disabled:fullSlots},{id:'session',label:'Load for this session only'}]:kind==='wayfarer'?[{id:'session',label:'Replace this charter session'}]:[{id:'add',label:'Add 2 saved decks'}]};
  }
 });
 const unsupported=async()=>{throw new Error('Synthetic review lab: authentication and uploads are unavailable.');};
 const client=Object.freeze({
  async account(){return {id:ACCOUNT,expiresAt:STAMP+86400000};},
  async list(){return Object.keys(MODES).flatMap(kind=>[1,2,3].map(slot=>({kind,slot,revision:1,updatedAt:STAMP,trust:'synthetic'})));},
  async download(kind,slot){
   if(!Object.hasOwn(MODES,kind)||![1,2,3].includes(slot))throw new Error('Unknown synthetic slot.');
   reads++;const record={kind,slot,revision:1,updatedAt:STAMP,trust:'synthetic',document:fixtureDocument(kind,'cloud-slot',slot)};
   if(holdNext){holdNext=false;await new Promise(resolve=>{held=resolve;updateReadState();});}
   updateReadState();return record;
  },login:unsupported,logout:unsupported,upload:unsupported
 });
 const journal=createUploadJournal({storage:memoryStorage,validateDocument});
 const model=createCloudAccountModel({client,bridge,journal,enabled:true,now:()=>STAMP});
 // The renderer never receives the real window: it cannot open auth popups or
 // discover browser capabilities. Its only live host object is the explicit DOM.
 const panel=mountCloudAccountPanel({root:panelRoot,document,window:Object.freeze({open:()=>null}),model,enabled:true,describeDocument:(kind,text)=>{const data=validateDocument(kind,text);return `${data.description} Source: ${data.source}.`;}});
 const get=id=>panelRoot.querySelector('#cloud-'+id);
 // Keep production structure and review handlers; annotate only this lab mount.
 // Also remove unsupported handlers, rather than relying solely on CSS hiding.
 const stopUnsupported=()=>{};
 const unsubscribe=model.subscribe(state=>{
  get('heading').textContent='Cloud saves · synthetic preview';get('identity').textContent=`Synthetic account: ${ACCOUNT} · no sign-in`;
  get('status').textContent='Synthetic fixture: '+state.message;
  for(const name of ['login','logout','link','upload','reconcile']){const node=get(name);node.hidden=true;node.disabled=true;node.onclick=stopUnsupported;node.removeAttribute('href');}

  for(let slot=1;slot<=3;slot++){const node=get('slot-'+slot),name=node.querySelector('strong');name.textContent='Synthetic '+name.textContent;node.setAttribute('aria-label',`Synthetic ${MODES[get('kind').value]||'cloud'} slot ${slot}, sample copy`);}

 });
 function back(){
  if(disposed)return;opened=false;panel.leave();workspace.hidden=true;openButton.hidden=false;result.textContent='Synthetic review dismissed. No real data changed.';openButton.focus?.();
 }
 function setMode(value){
  if(disposed||!Object.hasOwn(MODES,value))return false;
  panel.leave();mode=value;generation++;host=makeHost();modeSelect.value=mode;get('kind').value=mode;model.sync();
  result.textContent=`Synthetic ${MODES[mode]} source selected. Earlier review choices are discarded.`;
  if(opened){get('kind').value=mode;void panel.open();}return true;
 }
 async function open(){
  if(disposed||opened)return;opened=true;workspace.hidden=false;openButton.hidden=true;get('kind').value=mode;await panel.open();
  if(opened&&!disposed){get('kind').value=mode;model.sync();get('restore').focus?.();}
 }
 function setFullSlots(value){if(disposed)return;fullSlots=value===true;fullInput.checked=fullSlots;setMode(mode);}
 function holdNextRead(){if(disposed||holdNext||held)return false;holdNext=true;updateReadState();return true;}
 function releaseRead(){if(!held)return false;const resolve=held;held=null;resolve();updateReadState();return true;}
 const escape=event=>{if(event.key!=='Escape'||!opened||disposed)return;event.preventDefault();back();};
 document.addEventListener('keydown',escape);
 openButton.onclick=open;backButton.onclick=back;modeSelect.onchange=()=>setMode(modeSelect.value);fullInput.onchange=()=>setFullSlots(fullInput.checked);holdButton.onclick=holdNextRead;releaseButton.onclick=releaseRead;updateReadState();
 return Object.freeze({open,back,setMode,setFullSlots,holdNextRead,releaseRead,snapshot:()=>({mode,opened,fullSlots,simulations,reads,held:!!held,holdNext,events:[...events],journal:[...journalBytes],state:model.snapshot()}),
  dispose(){if(disposed)return;back();disposed=true;holdNext=false;releaseRead();unsubscribe();panel.dispose();document.removeEventListener('keydown',escape);for(const control of [modeSelect,fullInput,openButton,backButton,holdButton,releaseButton]){control.disabled=true;control.onclick=null;control.onchange=null;}}
 });
}

const pageRoot=globalThis.document?.querySelector('[data-cloud-review-lab]');
if(pageRoot){
 const lab=mountCloudReviewLab({root:pageRoot,document:globalThis.document});
 // Native browser Back/Forward leaves a closed lab even when bfcache retains it.
 globalThis.addEventListener('pagehide',()=>lab.back());
}
