import {createAccountClient} from './cloud-account-client.mjs';
import {createGameSaveCodecs} from './cloud-save-codecs.mjs';
import {createUploadJournal} from './cloud-upload-journal.mjs';
import {createCloudGameBridge} from './cloud-game-bridge.mjs';
import {createCloudAccountModel} from './cloud-account-model.mjs';
import {mountCloudAccountPanel} from './cloud-account-panel.mjs';
import {snapshotCampaign,parseLocalCheckpoint,createLocalCheckpointEnvelope} from './local-campaign-store.mjs';
import {restoreExpeditions} from './expedition-model.mjs';
import {exportDeckCode,parseDeckCode} from './deck-presets-model.mjs';

/** Optional, same-origin host mount. The build defaults to off. Health discovery
 * occurs only when the opted-in player opens Saves; failures preserve guest play. */
export function createGameCloudAccounts({document,window,enabled=false,getState,getDecks,getProfileDecks,reviewCrownroad,replaceWayfarer,reviewDecks,crownroadRestorePlan,decksRestorePlan,beginRestore,openVault}){
 const root=document.querySelector('#cloudAccounts'),entry=document.querySelector('#openCloudAccounts');
 root.hidden=true;entry.hidden=true;
 if(enabled!==true)return Object.freeze({open(){},leave(){},sync(){},cancelReview(){}});
 entry.hidden=false;entry.textContent='Account & cloud saves';entry.onclick=()=>openVault();
 let model=null,panel=null,attempt=0,pending=false,open=false,notice=false,lastKinds='',cacheKey='',cacheDocument='';
 const codecs=createGameSaveCodecs({parseLocalCheckpoint,restoreExpeditions,parseDeckCode});
 const bridge=createCloudGameBridge({getState,validateDocument:codecs.validate,reviewCrownroad,replaceWayfarer,reviewDecks,beginRestore,restorePlan:(kind,text)=>kind==='crownroad'?crownroadRestorePlan?.():kind==='decks'?decksRestorePlan?.(text):null,captureDocument(kind){
  if(kind==='wayfarer')return getState().profiles.exportBundle();
  if(kind==='decks')return exportDeckCode(getDecks());
  const payload=snapshotCampaign({...getState(),deckPresets:getProfileDecks()},'ready');if(!payload)throw new Error('Finish this field before using cloud checkpoints');
  const key=JSON.stringify(payload);if(key!==cacheKey){cacheKey=key;cacheDocument=JSON.stringify(createLocalCheckpointEnvelope(payload,{revision:1,writtenAt:Date.now(),transaction:'cloud-capture',reason:'ready'}));}return cacheDocument;
 }});
 function sync(){entry.hidden=getState().temporarySession===true;entry.disabled=bridge.kinds().length===0;root.hidden=!open||(!model&&!notice)||getState().temporarySession===true;const signature=bridge.kinds().join('|');if(signature!==lastKinds){lastKinds=signature;model?.sync();}}
 function showNotice(message,loading=false){
  notice=true;root.replaceChildren();root.className='cloud-account-panel';root.setAttribute('aria-label','Cloud saves');
  const title=document.createElement('h3'),status=document.createElement('p'),retry=document.createElement('button');
  title.textContent='Cloud saves';status.id='cloud-status';status.className='cloud-account-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.textContent=message;
  retry.id='cloud-retry';retry.type='button';retry.textContent='Retry cloud saves';retry.disabled=loading;retry.hidden=loading;retry.onclick=()=>{if(open)return start();};root.append(title,status,retry);sync();
 }
 async function start(){open=true;sync();if(model)return panel.open();if(pending)return;const stamp=++attempt;pending=true;showNotice('Connecting to cloud saves…',true);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
  try{
   const response=await window.fetch('/api/health',{credentials:'same-origin',cache:'no-store',redirect:'error',signal:controller.signal});
   if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))throw new Error('Cloud service unavailable');
   const text=await response.text();if(text.length>4096)throw new Error('Cloud service unavailable');const health=JSON.parse(text);
   if(stamp!==attempt||!open)return;if(health.accountsEnabled!==true)throw new Error('Cloud service unavailable');
   const client=createAccountClient({fetch:window.fetch.bind(window),validateDocument:codecs.validate});
   const journal=createUploadJournal({storage:()=>window.sessionStorage,validateDocument:codecs.validate});
   notice=false;root.replaceChildren();
   model=createCloudAccountModel({client,bridge,journal,enabled:true});panel=mountCloudAccountPanel({root,document,window,model,enabled:true,describeDocument(kind,text){try{const parsed=codecs.validate(kind,text);if(kind==='decks')return `${parsed.length} saved decks: ${parsed.map(deck=>deck.name).join(', ')}. No cards are granted.`;const manager=kind==='crownroad'?parsed.manager:parsed;return `${manager.active.name||'Unnamed profile'}, ${manager.profiles.length} profiles${kind==='crownroad'?`, ${parsed.provenance==='earned'?'unassisted':'assisted or mixed'}, battle ${parsed.payload.resume.level}`:''}.`;}catch{return 'Preview unavailable';}}});sync();await panel.open();
  }catch{/* Static hosting and offline operation remain usable. */if(stamp===attempt&&open)showNotice('Cloud saves are unavailable right now. Your device saves and local play still work.');}finally{clearTimeout(timer);if(stamp===attempt)pending=false;}
 }
 sync();
 return Object.freeze({open:start,cancelReview(){model?.cancelReview();},leave(){open=false;attempt++;pending=false;panel?.leave();sync();},sync});
}
