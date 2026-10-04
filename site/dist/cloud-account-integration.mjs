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
export function createGameCloudAccounts({document,window,enabled=false,getState,getDecks,getProfileDecks,reviewCrownroad,replaceWayfarer,reviewDecks,openVault}){
 const root=document.querySelector('#cloudAccounts'),entry=document.querySelector('#openCloudAccounts');
 root.hidden=true;entry.hidden=true;
 if(enabled!==true)return Object.freeze({open(){},leave(){},sync(){}});
 entry.hidden=false;entry.onclick=()=>openVault();
 let model=null,attempt=0,pending=false,open=false,lastKinds='',cacheKey='',cacheDocument='';
 const codecs=createGameSaveCodecs({parseLocalCheckpoint,restoreExpeditions,parseDeckCode});
 const bridge=createCloudGameBridge({getState,validateDocument:codecs.validate,reviewCrownroad,replaceWayfarer,reviewDecks,captureDocument(kind){
  if(kind==='wayfarer')return getState().profiles.exportBundle();
  if(kind==='decks')return exportDeckCode(getDecks());
  const payload=snapshotCampaign({...getState(),deckPresets:getProfileDecks()},'ready');if(!payload)throw new Error('Finish this field before using cloud checkpoints');
  const key=JSON.stringify(payload);if(key!==cacheKey){cacheKey=key;cacheDocument=JSON.stringify(createLocalCheckpointEnvelope(payload,{revision:1,writtenAt:Date.now(),transaction:'cloud-capture',reason:'ready'}));}return cacheDocument;
 }});
 function sync(){entry.hidden=getState().temporarySession===true;entry.disabled=bridge.kinds().length===0;root.hidden=!open||!model||getState().temporarySession===true;const signature=bridge.kinds().join('|');if(signature!==lastKinds){lastKinds=signature;model?.sync();}}
 async function start(){open=true;sync();if(model||pending)return;const stamp=++attempt;pending=true;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
  try{
   const response=await window.fetch('/api/health',{credentials:'same-origin',cache:'no-store',redirect:'error',signal:controller.signal});
   if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))return;
   const text=await response.text();if(text.length>4096)return;const health=JSON.parse(text);
   if(stamp!==attempt||!open||health.accountsEnabled!==true)return;
   const client=createAccountClient({fetch:window.fetch.bind(window),validateDocument:codecs.validate});
   const journal=createUploadJournal({storage:()=>window.sessionStorage,validateDocument:codecs.validate});
   model=createCloudAccountModel({client,bridge,journal,enabled:true});mountCloudAccountPanel({root,document,model,enabled:true,describeDocument(kind,text){try{const parsed=codecs.validate(kind,text);if(kind==='decks')return `${parsed.length} saved decks: ${parsed.map(deck=>deck.name).join(', ')}. No cards are granted.`;const manager=kind==='crownroad'?parsed.manager:parsed;return `${manager.active.name||'Unnamed profile'}, ${manager.profiles.length} profiles${kind==='crownroad'?`, ${parsed.provenance==='earned'?'unassisted':'assisted or mixed'}, battle ${parsed.payload.resume.level}`:''}.`;}catch{return 'Preview unavailable';}}});sync();
  }catch{/* Static hosting and offline operation remain usable. */}finally{clearTimeout(timer);if(stamp===attempt)pending=false;}
 }
 sync();
 return Object.freeze({open:start,leave(){open=false;attempt++;pending=false;model?.leave();sync();},sync});
}
