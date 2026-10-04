import {armyJobOptions,cardTactics} from './card-tactics.mjs';
import {cardIdentity} from './armory-presentation.mjs';
import {cardPortrait,bindCardPortraits} from './card-portraits.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/** Read-only, bounded overview of actual equipped cards. No profile writes. */
export function deckComposition(records,snapshot){
 const byId=new Map(records.map(item=>[item.id,item]));
 const equipped=[...(snapshot.bindings??new Map())].filter(([index])=>Number.isInteger(index)&&index>=0&&index<30).sort((a,b)=>a[0]-b[0]).map(([index,skill])=>({index,skill,item:byId.get(skill.id)}));
 const counts={arrows:0,waves:0,army:0};for(const {item}of equipped)if(item&&item.category in counts)counts[item.category]++;
 const reserve=[...(snapshot.skills?.values()??[])].filter(skill=>skill.binding<0).length;
 const castle=byId.get(snapshot.castleId??'classic');
 const companion=snapshot.companionId?byId.get(snapshot.companionId):null;
 const jobs=armyJobOptions(records).map(([id,label])=>({id,label,count:equipped.filter(({item})=>cardTactics(item)?.jobs.includes(id)).length}));
 return {equipped,reserve,counts,companion,castle,jobs};
}
export function createDeckComposition({root,records,getSnapshot,icon=()=>'',onArrange=()=>{},onFindRole=null}){
 const releasePortraits=bindCardPortraits(root),compact=globalThis.matchMedia?.('(max-width:1099px), (max-height:620px)');let bar=0,signature='',opened=!(compact?.matches??false);
 const resizeDisclosure=event=>{if(event.matches){opened=false;root.querySelector('details')?.removeAttribute('open');}};compact?.addEventListener?.('change',resizeDisclosure);
 const escapeDisclosure=event=>{if(event.key==='Escape'){const disclosure=root.querySelector('details');if(disclosure?.getAttribute('open')!==null){disclosure?.removeAttribute('open');opened=false;root.querySelector('summary')?.focus?.();event.preventDefault();event.stopPropagation();}}};root.addEventListener('keydown',escapeDisclosure);
 root.classList.add('deck-composition');root.setAttribute('aria-label','Current deck composition');
 function render(){
  const snapshot=getSnapshot(),state=deckComposition(records,snapshot),old=root.querySelector('details'),focus=root.ownerDocument.activeElement?.id;
  if(old)opened=old.getAttribute('open')!==null;
  const next=JSON.stringify([bar,state.equipped.map(x=>[x.index,x.skill.id,x.skill.rank]),state.reserve,state.companion?.id,state.castle?.id]);if(signature===next)return;signature=next;
  const rows=state.equipped.filter(x=>Math.floor(x.index/10)===bar);
  root.innerHTML=`<details ${opened?'open':''}><summary><span><strong>Current deck</strong><small>${state.equipped.length}/30 equipped · ${state.reserve} reserve</small></span><span class="deck-composition-chevron" aria-hidden="true">⌄</span></summary><div class="deck-composition-body"><p class="deck-composition-counts">${state.counts.arrows} shots · ${state.counts.waves} waves · ${state.counts.army} unit contracts</p>${onFindRole?`<div class="deck-composition-jobs" aria-label="Jobs available from equipped contracts">${state.jobs.map(job=>`<button data-deck-job="${job.id}" aria-label="${esc(job.label)}: ${job.count} equipped contracts. Find matching cards."><span>${esc(job.label)}</span><b>${job.count}</b></button>`).join('')}</div><p class="deck-composition-job-note">Equipped contracts, not troops on the field. A contract may fill more than one job.</p>`:''}<nav aria-label="Preview equipped action bar">${[0,1,2].map(n=>`<button id="deck-preview-bar-${n}" data-deck-preview-bar="${n}" aria-pressed="${bar===n}">Bar ${n+1}<small>${state.equipped.filter(x=>Math.floor(x.index/10)===n).length}/10</small></button>`).join('')}</nav><div class="deck-composition-cards">${rows.length?rows.map(({index,skill,item})=>{const identity=item?cardIdentity(item):null;return `<button id="deck-preview-${index}" data-deck-preview-slot="${index}" ${item?'':'disabled'} ${identity?`data-card-tone="${identity.tone}"`:''} aria-label="Edit ${esc(item?.name??skill.id)}, bar ${bar+1}, key ${(index%10+1)%10}, rank ${skill.rank}"><b class="deck-composition-key">${(index%10+1)%10}</b><span class="deck-composition-art">${cardPortrait(skill.id,icon(skill.id))}</span><span class="deck-composition-card-copy"><strong>${esc(item?.name??skill.id)}</strong><small>${esc(identity?.label??'Ability')} · R${skill.rank}</small></span></button>`;}).join(''):'<p class="deck-composition-empty">This bar is empty. Open Build to place owned cards.</p>'}</div><p class="deck-composition-companion">Castle: ${esc(state.castle?.name??'Classic Keep')}<small>Dedicated slot · no ability key</small></p><p class="deck-composition-companion">Companion: ${esc(state.companion?.name??'None equipped')}<small>Separate from the 30 ability keys</small></p><p class="deck-composition-hint">Choose an equipped card to edit it in Build.</p></div></details>`;
  for(const button of root.querySelectorAll('[data-deck-preview-bar]'))button.onclick=()=>{bar=Number(button.getAttribute('data-deck-preview-bar'));render();root.querySelector('#deck-preview-bar-'+bar)?.focus?.({preventScroll:true});};
  for(const button of root.querySelectorAll('[data-deck-job]'))button.onclick=()=>{opened=false;root.querySelector('details')?.removeAttribute('open');onFindRole?.(button.getAttribute('data-deck-job'));};
  for(const row of rows){const button=root.querySelector('#deck-preview-'+row.index);if(row.item)button.onclick=()=>onArrange(row.item);}
  if(focus)root.querySelector('#'+focus)?.focus?.({preventScroll:true});
 }
 return {render,dispose(){releasePortraits();root.removeEventListener('keydown',escapeDisclosure);compact?.removeEventListener?.('change',resizeDisclosure);}};
}
