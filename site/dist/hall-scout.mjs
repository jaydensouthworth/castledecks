/** Read-only bridge from the prepared starting roster to existing card inspectors.
 * Counter text is shared with the atlas. A suggested card is an inspection lead,
 * never a sufficiency score, prediction, purchase, placement or combat action. */
import {enemyIntel} from './enemy-intel.mjs';
import {SKILLS} from './engine/progression.mjs';
const suggestions={grunt:'arrow',tallGrunt:'arrow',archer:'fireArrow',priest:'fireArrow',trebuchet:'fireArrow',air:'flakArrow',poisonDragon:'fireArrow',fireDragon:'iceArrow',iceDragon:'fireArrow',fireDemon:'iceArrow',iceDemon:'fireArrow',gorath:'arrow'};
export function scoutCard(profile,id){
 const cardId=suggestions[id],definition=SKILLS[cardId];if(!definition)return null;
 const skill=profile.skills?.find(s=>s.id===cardId),equipped=Number.isInteger(skill?.binding)&&skill.binding>=0&&skill.binding<30;
 return {id:cardId,name:definition.name,owned:!!skill,status:equipped?`Equipped · bar ${Math.floor(skill.binding/10)+1}, key ${skill.binding%10===9?'0':skill.binding%10+1}`:skill?'Owned · in reserve':'Not owned · inspect in Armory'};
}
export function scoutThreat(profile,battle,id){
 try{const intel=enemyIntel(id,{level:battle.level,difficulty:profile.difficulty});return {intel,card:scoutCard(profile,intel.id)};}catch{return {intel:null,card:null};}
}
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const states=new WeakMap();
export function syncHallScout({document,profile,battle,threats,onReview,readOnly=false}){
 const $=id=>document.querySelector('#'+id),host=$('hallScout');if(!host)return;
 let session=states.get(document);if(!session){session={byBattle:new WeakMap(),current:null};states.set(document,session);}
 let state=session.byBattle.get(battle);
 if(!state||state.profile!==profile){state={battle,profile,id:null,open:false};session.byBattle.set(battle,state);}
 if(session.current!==state){if(session.current)session.current.open=host.getAttribute('open')!==null;session.current=state;if(state.open)host.setAttribute('open','');else host.removeAttribute('open');}
 if(!threats.some(t=>t.id===state.id))state.id=threats[0]?.id??null;
 const summary=$('hallScoutSummary'),scroll=document.querySelector('.hall-orders-scroll');
 const label=()=>{summary.textContent=host.getAttribute('open')!==null?'Close scout report · Back to preparation':`Scout company · ${threats.length} ${threats.length===1?'type':'types'}`;};
 summary.onclick=()=>{if(host.getAttribute('open')===null)state.returnScroll=scroll?.scrollTop??0;};
 host.ontoggle=()=>{
  if(session.current!==state)return;
  const expanded=host.getAttribute('open')!==null;label();if(state.expanded===expanded)return;state.expanded=expanded;
  if(expanded){if(scroll){const a=summary.getBoundingClientRect(),b=scroll.getBoundingClientRect();scroll.scrollTop+=a.top-b.top;}}
  else{if(scroll)scroll.scrollTop=state.returnScroll??0;summary.focus?.({preventScroll:true});}
 };
 label();
 const render=()=>{
  $('hallScoutRoster').innerHTML=threats.map(t=>`<button type="button" data-scout-threat="${esc(t.id)}" aria-pressed="${t.id===state.id}">${esc(t.name)} <b>${t.count??'?'}</b></button>`).join('');
  const selected=threats.find(t=>t.id===state.id),{intel,card}=scoutThreat(profile,battle,state.id);
  $('hallScoutName').textContent=intel?.name??selected?.name??'No company intelligence';
  $('hallScoutCounter').textContent=intel?.counter??'No verified counter advice is available for this enemy. Inspect the actual field before committing.';
  $('hallScoutNotes').textContent=intel?.notes.join(' ')??'';
  $('hallScoutCard').textContent=card?`${card.name} · ${card.status}`:'No single bow card is suggested for this threat.';
  $('hallScoutReview').classList.toggle('hidden',!card);$('hallScoutReview').textContent=card?`Inspect ${card.name} in ${card.owned?'Build':'Armory'}`:'Inspect card';
  $('hallScoutReview').disabled=readOnly;if(readOnly)$('hallScoutCard').textContent+=' · Open a new field to review your kit.';
  $('hallScoutReview').onclick=()=>{if(card&&!readOnly)onReview?.(card);};
  for(const button of $('hallScoutRoster').querySelectorAll('[data-scout-threat]'))button.onclick=()=>{state.id=button.getAttribute('data-scout-threat');render();$('hallScoutRoster').querySelector(`[data-scout-threat="${state.id}"]`)?.focus?.({preventScroll:true});};
 };
 render();
}
