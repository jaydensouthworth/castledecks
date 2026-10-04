/** Read-only, same-origin Crownroad preview. The game owns every restore choice. */
import {createLocalCampaignStore,LOCAL_STORAGE_PREFIX} from './local-campaign-store.mjs';
import {campaignProgress,encounterBrief} from './campaign-atlas-model.mjs';

export const LOCAL_CAMPAIGN_CHOOSER='./battle?open=local-saves';
const provenanceLabels={earned:'Unassisted',assisted:'Assisted',mixed:'Mixed profiles'};
// Artwork is selected only from the authored atlas, never from saved text.
const regionArt={hearthwood:'./images/regions/hearthwood.webp',bannerfen:'./images/regions/bannerfen.webp',frostpine:'./images/regions/frostpine.webp',cinderlands:'./images/regions/cinderlands.webp'};
const unavailableNote='Browser storage could not be read. Saved campaigns may still exist. Open the game to review them; nothing has been changed.';
// Historic imported names have no short input limit. Bound presentation only;
// the validated checkpoint and the name used by the game remain untouched.
export function campaignDisplayName(name){
 const text=name.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,'').trim();
 const points=Array.from(text);return points.length>64?points.slice(0,64).join('')+'…':text||'Unnamed campaign';
}
export function readFrontpageCampaign(store){
 let slots;try{slots=store.list();}catch{return {status:'unavailable',campaign:null,note:unavailableNote};}
 const available=slots.filter(slot=>slot.ok&&slot.latest).sort((a,b)=>b.latest.writtenAt-a.latest.writtenAt||a.slot-b.slot);
 const newer=slots.filter(slot=>slot.status==='newer'),unreadable=slots.filter(slot=>slot.status==='corrupt'),unavailable=slots.filter(slot=>!slot.ok||slot.status==='unavailable');
 const notes=[];
 if(newer.length)notes.push(`${newer.length===1?'A local slot was':'Some local slots were'} saved by a newer game version. Reload before continuing; both checkpoint copies are kept.`);
 if(unreadable.length)notes.push(`${unreadable.length===1?'A local slot contains':'Some local slots contain'} unreadable data. It is kept for recovery; review Local saves in the game.`);
 if(unavailable.length)notes.push(unavailableNote);
 const selected=available[0];
 if(!selected)return {status:newer.length?'newer':unreadable.length?'unreadable':unavailable.length?'unavailable':'empty',campaign:null,note:notes.join(' ')};
 const record=selected.latest,profile=record.manager.active,progress=campaignProgress(profile),field=encounterBrief(record.payload.resume.level,{profile});
 if(selected.status==='recovered')notes.unshift(`One checkpoint copy in local slot ${selected.slot} is unreadable. This preview uses the last valid copy; both copies are kept.`);
 const {phase,outcome}=record.payload.resume;
 const checkpoint=progress.complete?'Completed Crownroad record. Choose it to review or export.':phase==='opening'?'Battle-opening checkpoint. Choosing it restarts the field from the beginning.':phase==='result'?`Saved after ${outcome}. Choosing it opens the saved frontier in preparation.`:'Preparation checkpoint. Choose it, then begin when you are ready.';
 return {status:'ready',note:notes.join(' '),campaign:{slot:selected.slot,name:campaignDisplayName(profile.name),provenance:provenanceLabels[record.provenance],field:progress.complete?'The Crownroad is complete':`Battle ${field.level} · ${field.name}`,region:field.region.name,art:regionArt[field.region.id],checkpoint,writtenAt:record.writtenAt,readableSlots:available.length}};
}
export function createFrontpageCampaign({document,window,store=createLocalCampaignStore({storage:()=>window.localStorage})}){
 const $=id=>document.getElementById(id),hero=$('frontpageHero'),standard=$('returningCampaign'),notice=$('frontpageSaveNotice');
 if(!hero||!standard||!notice)return {refresh:()=>null,dispose:()=>{}};
 let disposed=false;
 const refresh=()=>{
  if(disposed)return null;
  const state=readFrontpageCampaign(store),campaign=state.campaign,returning=!!campaign;
  hero.classList.toggle('has-local-campaign',returning);standard.hidden=!returning;
  $('firstVisitTitle').hidden=returning;$('returningTitle').hidden=!returning;$('heroIntroduction').hidden=returning;
  $('heroEyebrow').textContent=returning?'Your Crownroad · Saved in this browser':'Archery. Armies. A kingdom to cross.';
  $('frontpagePlay').setAttribute('href',state.status==='empty'?'./battle':LOCAL_CAMPAIGN_CHOOSER);
  $('frontpagePlayLabel').textContent=returning?'Choose saved campaign':state.status==='empty'?'Play Castledecks':'Review local saves';
  $('frontpageLocalNote').hidden=state.status==='empty';
  notice.textContent=state.note;notice.hidden=!state.note;
  if(campaign){
   $('returningName').textContent=campaign.name;
   $('returningIdentity').textContent=`${campaign.provenance} · Local slot ${campaign.slot}`;
   $('returningField').textContent=campaign.field;$('returningRegion').textContent=campaign.region;
   $('returningCheckpoint').textContent=campaign.checkpoint;
   const art=$('returningArt');if(art.getAttribute('src')!==campaign.art)art.setAttribute('src',campaign.art);
   const time=$('returningTime');time.setAttribute('datetime',new Date(campaign.writtenAt).toISOString());
   time.textContent=`Checkpoint saved ${new Date(campaign.writtenAt).toLocaleString(undefined,{year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}`;
   $('returningChoices').textContent=campaign.readableSlots>1?`${campaign.readableSlots} readable local slots. Choose which campaign to open in the game.`:'Review this checkpoint in the game before continuing.';
  }else{
   // Do not retain stale profile text or artwork after another tab removes a save
   // or storage becomes inaccessible. Never rewrite or delete the source data.
   for(const id of ['returningName','returningIdentity','returningField','returningRegion','returningCheckpoint','returningTime','returningChoices'])$(id).textContent='';
   $('returningTime').removeAttribute('datetime');$('returningArt').removeAttribute('src');
  }
  return state;
 };
 const onStorage=event=>{if(event.key===null||event.key?.startsWith(LOCAL_STORAGE_PREFIX))refresh();};
 const onVisible=()=>{if(!document.hidden)refresh();};
 window.addEventListener('storage',onStorage);window.addEventListener('pageshow',refresh);window.addEventListener('focus',onVisible);document.addEventListener('visibilitychange',onVisible);
 refresh();
 return Object.freeze({refresh,dispose(){if(disposed)return;disposed=true;window.removeEventListener('storage',onStorage);window.removeEventListener('pageshow',refresh);window.removeEventListener('focus',onVisible);document.removeEventListener('visibilitychange',onVisible);}});
}
if(typeof document!=='undefined'&&typeof window!=='undefined')createFrontpageCampaign({document,window});
