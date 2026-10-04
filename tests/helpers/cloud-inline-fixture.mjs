import {loadGameUI} from './game-ui-harness.mjs';
import {MemoryStorage} from './local-storage.mjs';
import {CampaignProfiles} from '../../site/dist/engine/profile-manager.mjs';
import {PlayerProfile} from '../../site/dist/engine/progression.mjs';
import {CampaignBattle} from '../../site/dist/engine/first-battle.mjs';
import {snapshotCampaign,createLocalCheckpointEnvelope} from '../../site/dist/local-campaign-store.mjs';
import {createProfileDecks,captureDeck} from '../../site/dist/deck-presets-model.mjs';
export function cloudCheckpoint(name='Cloud second'){
 const a=new PlayerProfile('Cloud first'),b=new PlayerProfile(name);b.gold=4321;b.highestLevel=4;b.cheated=true;
 const profiles=new CampaignProfiles({profiles:[a,b]});profiles.select(1);const decks=createProfileDecks();decks.set(b,[captureDeck(b,'Cloud bow')]);
 return JSON.stringify(createLocalCheckpointEnvelope(snapshotCampaign({profiles,battle:new CampaignBattle({profile:b,level:4}),deckPresets:decks.snapshot(profiles)}),{revision:1,writtenAt:123,transaction:'inline-synthetic',reason:'ready'}));
}
const response=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
export function cloudServer(document=cloudCheckpoint()){
 let identity='synthetic-inline-A',revision=1,held=null;const requests=[];
 return {requests,setIdentity(value){identity=value;},setRemote(value,nextRevision=revision+1){document=value;revision=nextRevision;},holdDownload(){let resolve;const promise=new Promise(r=>resolve=r);held={promise,resolve};return held;},async fetch(path,options={}){
  requests.push({path,options});
  if(path==='/api/health')return response({accountsEnabled:true});
  if(path==='/api/account')return identity?response({id:identity,csrfToken:'x'.repeat(43),expiresAt:Date.now()+100000}):response({},401);
  if(path==='/api/saves')return response({saves:[]});
  if(path.startsWith('/api/saves/')){if(options.method==='PUT')throw new Error('These restore fixtures must never upload');if(held){const pending=held;held=null;await pending.promise;}const [kind,slot]=path.split('/').slice(-2);return document===null?response({},404):response({kind,slot:Number(slot),revision,updatedAt:123,trust:'client-reported',document});}
  throw new Error('Unexpected synthetic request: '+path);
 }};
}
export async function inlineGame(t,{document,storage=new MemoryStorage(),backend=cloudServer(document),...options}={}){
 const ui=await loadGameUI(t,{storage,accounts:true,fetch:backend.fetch.bind(backend),...options});ui.click('introSave');await ui.settle();return {ui,storage,backend};
}
export async function inlinePreview(ui,kind='crownroad'){
 ui.get('cloud-kind').value=kind;ui.click('cloud-restore');await ui.settle();
}
