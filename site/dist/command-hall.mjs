import {hallPreparation,hallRealm,HALL_REALMS} from './command-hall-model.mjs';
import {SKILLS} from './engine/progression.mjs';
import {skillIcon} from './skill-icons.mjs';
import {cardPortrait,bindCardPortraits} from './card-portraits.mjs';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stateByDocument=new WeakMap();
/** All commands delegate to battle.mjs. This module owns only inspection state. */
export function syncCommandHall({document,selected,activeDestination,selectedDestination,started,summary,profile,battle,run=null,decks=[],onInspectCampaign,sessionIds=[],sessions=[]}) {
 const hall=document.querySelector('#intro');if(!hall||!selected)return;
 const $=s=>document.querySelector(s);let state=stateByDocument.get(document);if(!state){state={card:null};stateByDocument.set(document,state);}
 hall.setAttribute('data-selected-destination',hallRealm(selectedDestination));hall.setAttribute('data-active-destination',activeDestination);hall.setAttribute('data-session-phase',summary?'settled':started?'paused':'ready');
 const selectedRealm=hallRealm(selectedDestination),isCurrent=selectedDestination===activeDestination;
 $('#hallSelectedName').textContent=selected.name;$('#hallSelectedKind').textContent=isCurrent?'ACTIVE ORDERS':'DESTINATION BRIEF';
 const destinations=$('#hubDestinations');
 if(destinations&&!$('#hallRehearsals')){const group=document.createElement('div');group.id='hallRehearsals';group.setAttribute('id','hallRehearsals');group.classList.add('hall-rehearsals');group.setAttribute('role','group');group.setAttribute('aria-label','Additional supplied rehearsals');destinations.appendChild(group);}
 for(const button of destinations?.querySelectorAll('[data-hub-destination]')??[]){const id=button.getAttribute('data-hub-destination');button.classList.add('hall-realm');button.setAttribute('data-realm',hallRealm(id));if(HALL_REALMS[id]){const meta=HALL_REALMS[id];button.querySelector('small').textContent=meta.subtitle;button.querySelector('strong').textContent=meta.label;const saved=sessions.find(s=>s.id===id),current=id===activeDestination;button.querySelector('span').textContent=current?(activeDestination==='expedition'?`${run?.state.cleared??0}/4 fields won · active`:`Battle ${battle?.level??1} · ${summary?'settled':started?'paused':'ready'}`):saved?`${saved.cleared!==undefined?`${saved.cleared}/4 won`:`Battle ${saved.level}`} · ${saved.outcome?'settled':saved.started?'paused':'ready'}`:sessionIds.includes(id)?'Return to kept session':'Inspect destination';}if(['midgame','allies'].includes(id)){const target=$('#hallRehearsals');if(target&&button.parentNode!==target)target.appendChild(button);}}
 // Existing renderHub owns the same destination buttons, including nested practice choices.
 const rehearsals=$('#hallRehearsals');if(rehearsals)rehearsals.classList.toggle('hidden',selectedRealm!=='training');
 const current=$('#hallCurrentBanner');if(current)current.textContent=`Preparing ${profile?.name??'your banner'} · ${HALL_REALMS[hallRealm(activeDestination)]?.label??'Practice'}`;
 const view=hallPreparation({profile,battle,destination:activeDestination,run,decks});if(!view)return;
 $('#hallBoardCaption').textContent=isCurrent?'Choose a destination, or inspect the active route.':'Browsing only · your active company is unchanged';
 $('#hallOrderTitle').textContent=view.title;$('#hallOrderRegion').textContent=`${view.region} · ${summary?'Result settled':started?'Battle paused':'Ready to prepare'}`;$('#hallOrderObjective').textContent=view.objective;$('#hallOrderAdvice').textContent=view.advice;
 $('#hallThreats').innerHTML=view.threats.slice(0,4).map(t=>`<span>${escape(t.name)}${t.count!==null?` <b>${t.count}</b>`:''}</span>`).join('')||'<span>Inspect the field for enemy intelligence</span>';
 $('#hallProgress').innerHTML=view.progress?view.progress.regions.map(r=>`<button type="button" data-hall-region="${r.first}" class="${r.state}" aria-label="Inspect ${escape(r.name)}, ${r.cleared} of ${r.total} fields ${view.progress.assisted?'reached':'cleared'}"><i aria-hidden="true"></i><span>${escape(r.name)}</span><b>${r.cleared}/${r.total}</b></button>`).join(''):run?Array.from({length:4},(_,i)=>`<span class="hall-leg ${i<run.state.cleared?'complete':''}"><i>${i+1}</i>${i<run.state.cleared?'Won':i===run.state.cleared?'Current':'Ahead'}</span>`).join(''):'<span class="hall-practice-seal">Practice session · campaign rewards stay separate</span>';
 for(const button of $('#hallProgress').querySelectorAll('[data-hall-region]'))button.onclick=()=>onInspectCampaign?.(Number(button.getAttribute('data-hall-region')));
 $('#hallDeckName').textContent=view.deckName;$('#hallDeckCount').textContent=`${view.equipped.length}/30 equipped · ${view.savedDecks} saved ${view.savedDecks===1?'deck':'decks'} · ${summary?'Next: ':''}${view.castle}`;
 let cardMarkup=view.equipped.slice(0,8).map((s,i)=>`<button type="button" class="hall-playing-card${state.card===s.id?' inspected':''}" data-hall-card="${escape(s.id)}" style="--card-angle:${(i-(Math.min(view.equipped.length,8)-1)/2)*2}deg" aria-label="Inspect ${escape(SKILLS[s.id]?.name??s.id)}, action bar ${Math.floor(s.binding/10)+1}, key ${s.binding%10===9?'0':s.binding%10+1}">${cardPortrait(s.id,skillIcon(s.id))}<span>${escape(SKILLS[s.id]?.name??s.id)}</span><b>${Math.floor(s.binding/10)+1} · ${s.binding%10===9?'0':s.binding%10+1}</b></button>`).join('')||'<button class="hall-empty-deck" data-hall-open-loadout>No cards equipped · open Loadout to recover Basic Arrow</button>';
 if(view.equipped.length>8)cardMarkup+=`<button class="hall-more-cards" data-hall-open-loadout>+${view.equipped.length-8}<span>View all</span></button>`;
 $('#hallDeckCards').innerHTML=cardMarkup;bindCardPortraits($('#hallDeckCards'));
 const inspect=id=>{state.card=id;const s=view.equipped.find(s=>s.id===id),node=$('#hallCardInspect');if(!s){node.classList.add('hidden');return;}node.classList.remove('hidden');$('#hallCardInspectTitle').textContent=SKILLS[id]?.name??id;$('#hallCardInspectInfo').textContent=`Rank ${s.rank??1} · Action bar ${Math.floor(s.binding/10)+1}, key ${s.binding%10===9?'0':s.binding%10+1} · ${SKILLS[id]?.summon?(s.autocast?'Auto recruitment on':'Manual recruitment'):'Bow ability'}`;for(const b of $('#hallDeckCards').querySelectorAll('[data-hall-card]')){b.classList.toggle('inspected',b.getAttribute('data-hall-card')===id);b.setAttribute('aria-expanded',String(b.getAttribute('data-hall-card')===id));}};
 for(const b of $('#hallDeckCards').querySelectorAll('[data-hall-card]'))b.onclick=()=>inspect(state.card===b.getAttribute('data-hall-card')?null:b.getAttribute('data-hall-card'));
 for(const b of hall.querySelectorAll('[data-hall-open-loadout]'))b.onclick=()=>$('#introLoadout').click();
 $('#hallCloseCard').onclick=()=>{const previous=state.card;inspect(null);$('#hallDeckCards').querySelector(`[data-hall-card="${previous}"]`)?.focus();};inspect(state.card);
 $('#hallArmyTokens').innerHTML=view.contracts.slice(0,6).map(s=>`<span title="${escape(SKILLS[s.id]?.name??s.id)} · ${s.autocast?'Auto':'Manual'}">${skillIcon(s.id)}<i class="${s.autocast?'auto':''}" aria-hidden="true"></i></span>`).join('')||'<span class="hall-no-contracts">No army contracts equipped</span>';
 $('#hallArmyMuster').onclick=()=>$('#introArmy').click();
 $('#hallArmyStatus').textContent=`${view.contracts.length} contracts · ${view.automatic} Auto · ${view.reserve} reserve`;
 $('#hallArmyField').textContent=started?`${view.fieldCount}/${view.fieldCap} field slots · ${view.waiting} waiting`:`${view.fieldCap} field slots · recruitment begins in battle`;
 $('#hallCompanion').textContent=view.companion?`Companion: ${view.companion}`:'Companion: none selected';
 $('#hallReadiness').textContent=!view.hasAttack?'No bow ability equipped. Open Loadout before departing.':started&&!summary?'Your field is paused. Review orders, then resume.':`${view.arrows.length} bow ${view.arrows.length===1?'ability':'abilities'} ready · ${view.contracts.length} army contracts`;
 $('#hallPrepTest').onclick=()=>{const button=destinations.querySelector('[data-hub-destination="training"]');button?.click();$('#start').focus();};
 hall.onkeydown=event=>{if(event.key==='Escape'&&state.card){$('#hallCloseCard').click();event.stopPropagation?.();event.preventDefault?.();}};
 if(state.destination&&state.destination!==selectedDestination)$('#start').focus?.();state.destination=selectedDestination;
 $('#hallReturnCurrent').classList.toggle('hidden',isCurrent);$('#hallReturnCurrent').onclick=()=>destinations.querySelector(`[data-hub-destination="${activeDestination}"]`)?.click();
}
