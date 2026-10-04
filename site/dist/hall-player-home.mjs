import {createHallCampaignBrowser} from './hall-campaign-browser.mjs';
import {hallCampaignCatalog} from './hall-campaign-browser-model.mjs';
const family=id=>['campaign','expedition'].includes(id)?'campaigns':'practice';
/** Presentation only: transitions delegate to the existing destination and
 * workspace buttons, including their session and settlement guards. */
export function syncHallPlayerHome({document,state,activeDestination,selectedDestination,profile,battle,run,sessions,view,onInspectCampaign,onInspectCharter}){
 const $=id=>document.querySelector('#'+id),destinations=$('hubDestinations');
 if(!state.browser)state.browser=createHallCampaignBrowser({host:$('hallCampaignBrowser')});
 for(const [id,label] of [['hallCampaignDestinations','Campaigns'],['hallPracticeDestinations','Supplied practice']]){
  if(!$(id)){const group=document.createElement('div');group.id=id;group.setAttribute('id',id);group.classList.add('hall-destination-shelf');group.setAttribute('role','group');group.setAttribute('aria-label',label);destinations.appendChild(group);}
 }
 for(const button of destinations.querySelectorAll('[data-hub-destination]')){
  const id=button.getAttribute('data-hub-destination');
  if(['midgame','allies'].includes(id))continue;
  const target=$(family(id)==='campaigns'?'hallCampaignDestinations':'hallPracticeDestinations');if(button.parentNode!==target)target.appendChild(button);
 }
 const rehearsals=$('hallRehearsals');if(rehearsals.parentNode!==$('hallPracticeDestinations'))$('hallPracticeDestinations').appendChild(rehearsals);
 const viewChanged=!state.section||state.active!==activeDestination||state.returnHome||state.destination&&state.destination!==selectedDestination;
 if(!state.section||state.active!==activeDestination||state.returnHome){state.section='home';state.returnHome=false;}
 else if(state.destination&&state.destination!==selectedDestination)state.section=family(selectedDestination);
 if(viewChanged)$('intro').querySelector('.hall-orders-scroll').scrollTop=0;
 state.active=activeDestination;
 const apply=()=>{
  const home=state.section==='home';$('hallHome').classList.toggle('hidden',!home);$('hallBrowse').classList.toggle('hidden',home);
  $('hallCampaignDestinations').classList.toggle('hidden',state.section!=='campaigns');$('hallPracticeDestinations').classList.toggle('hidden',state.section!=='practice');
  $('hallDestinationBrief').classList.toggle('hidden',home||family(selectedDestination)!==state.section);
  $('hallBrowserTitle').textContent=state.section==='practice'?'Practice grounds':'Campaigns';
  for(const button of $('intro').querySelectorAll('[data-hall-view]'))button.setAttribute('aria-pressed',String(button.getAttribute('data-hall-view')===state.section));
  $('intro').setAttribute('data-hall-view',state.section);
 };
 for(const button of $('intro').querySelectorAll('[data-hall-view]'))button.onclick=()=>{
  state.section=button.getAttribute('data-hall-view');
  if(state.section==='home'&&selectedDestination!==activeDestination){state.returnHome=true;destinations.querySelector(`[data-hub-destination="${activeDestination}"]`)?.click();return;}
  apply();$('intro').querySelector('.hall-orders-scroll').scrollTop=0;
 };
 $('hallReturnCurrent').onclick=()=>{$('hallHomeTab').click();};
 $('hallOpenSaves').onclick=()=>$('shell-intro-vault').click();
 const region=view.progress?.regions.find(region=>battle.level>=region.first&&battle.level<=region.last)?.id;
 const painting=region??(activeDestination==='expedition'?'frostpine':activeDestination==='skirmish'?'cinderlands':'bannerfen');
 $('hallFieldPainting').style.backgroundImage=`linear-gradient(0deg,#20181af5 0%,#20181a8c 65%,#20181a22),url('./images/regions/${painting}.webp')`;
 const campaignProfile=activeDestination==='campaign'?profile:sessions.find(session=>session.id==='campaign')?.profile??null;
 const charter=activeDestination==='expedition'?run:sessions.find(session=>session.id==='expedition')?.run??null;
 if(family(selectedDestination)==='campaigns'){
  $('hallCampaignBrowser').classList.remove('hidden');
  state.browser.sync({catalog:hallCampaignCatalog({profile:campaignProfile,run:charter}),campaignId:selectedDestination,activeDestination,activeLevel:battle.level,onInspectCampaign,onInspectCharter});
 }else $('hallCampaignBrowser').classList.add('hidden');
 apply();
}
