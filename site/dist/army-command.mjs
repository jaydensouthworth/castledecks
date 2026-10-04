import {levyArmyState,callLeviesFromArmy} from './levy-presentation.mjs';
import {modalFocusCandidates} from './modal-focus.mjs';
import {ArmyRoster,ARMY_ROLES,armySnapshot,armyBinding,armyRecruitState,recruitFromArmy} from './army-command-model.mjs';
import {cardIdentity} from './armory-presentation.mjs';
import {cardPortrait,bindCardPortraits} from './card-portraits.mjs';
import {getCardInsights} from './armory-insights.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=value=>Number(value).toLocaleString(undefined,{maximumFractionDigits:2});
const positions=[['field','In the field'],['garrison','Garrisoned'],['arriving','Arriving'],['clearing','Fallen · clearing']];
export function createArmyCommandUI({root,records,getState,icon,onChanged=()=>{},onLoadout=()=>{},onArmory=()=>{}}){
 const $=selector=>root.querySelector(selector),doc=root.ownerDocument,roster=new ArmyRoster(records);bindCardPortraits(root);
 let identity=null,selected=null,returnId=null,tab='contracts',signature='',message='',renderedTick=null;
 const options=(entries,value)=>entries.map(([id,label])=>`<option value="${esc(id)}" ${id===value?'selected':''}>${esc(label)}</option>`).join('');
 const current=(origin,id)=>{const state=getState();if(!state.active||state.battle!==origin.battle||state.profile!==origin.profile)return null;const skill=state.profile.skills.find(s=>s.id===id);return skill&&state.profile.owned.has(id)?{state,skill}:null;};
 function inert(active){for(const child of root.children)if(child!==$('#armyInspector'))child.inert=active;}
 function closeInspect(){if(!selected)return false;selected=null;$('#armyInspector').classList.add('hidden');inert(false);if(returnId)$('#'+returnId)?.focus?.({preventScroll:true});return true;}
 function inspect(id,from){selected=id;returnId=from;renderInspector();if(selected){inert(true);$('#armyCloseInspector').focus?.();}}
 function view(patch,focus){roster.setView(patch);signature='';render();$('#armyRoster').scrollTop=0;if(focus)$('#'+focus)?.focus?.({preventScroll:true});}
 function toggleAuto(id,origin){const ref=current(origin,id);if(!ref||ref.state.readOnly)return;ref.skill.autocast=!ref.skill.autocast;message=`${roster.byId.get(id)?.name??id}: Auto ${ref.skill.autocast?'on':'off'}.${ref.skill.autocast?' Equipped squads repeat while the battle runs and resources allow.':''}`;onChanged();render();}
 function renderInspector(){
  if(!selected)return;const state=getState(),skill=state.profile.skills.find(s=>s.id===selected),item=roster.byId.get(selected);if(!skill||!item){closeInspect();return;}
  const recruit=armyRecruitState(skill,state),identity=cardIdentity(item),facts=getCardInsights(item,{rank:skill.rank,heroRank:state.profile.rank,difficulty:state.profile.difficulty}),snapshot=armySnapshot(state.battle),group=snapshot.groups.find(row=>row.id===item.id),queued=state.battle.friendlyQueue.queue.filter(ticket=>ticket.type===item.id).length;
  $('#armyInspector').classList.remove('hidden');$('#armyInspector').setAttribute('data-card-tone',identity.tone);$('#armyInspectArt').innerHTML=cardPortrait(item.id,icon(item.id));$('#armyInspectName').textContent=item.name;$('#armyInspectRole').textContent=`${identity.label} · Rank ${skill.rank}`;$('#armyInspectDescription').textContent=item.description;
  $('#armyInspectBinding').textContent=armyBinding(skill);$('#armyInspectPresence').textContent=`${group?.total??0} field slots · ${queued} waiting`;
  $('#armyInspectCosts').innerHTML=[['Squad',`${item.squad.size} ${item.squad.size===1?'unit':'units'}`],['Gold',n(item.squad.gold)],['Reserve',n(item.squad.reserve)],['Reload',`${n(item.reloadSeconds)}s`]].map(([label,value])=>`<div><dt>${label}</dt><dd>${value}</dd></div>`).join('');
  $('#armyRecruitStatus').textContent=recruit.label;$('#armyRecruitReason').textContent=recruit.detail;$('#armyRecruit').disabled=!recruit.canRecruit;$('#armyRecruit').textContent=`Queue squad · ${item.squad.gold} gold`;
  $('#armyRecruit').onclick=()=>{const ref=current(state,item.id);if(!ref)return;if(recruitFromArmy(ref.skill,ref.state)){message=`${item.name}: ${item.squad.size} queued. Paid ${item.squad.gold} gold and ${item.squad.reserve} reserve. Deploys after Resume.`;onChanged();}else message=armyRecruitState(ref.skill,ref.state).detail;render();};
  $('#armyInspectAuto').disabled=!!state.readOnly;$('#armyInspectAuto').setAttribute('aria-pressed',String(skill.autocast));$('#armyInspectAuto').textContent=`Auto-recruit ${skill.autocast?'on':'off'}`;$('#armyInspectAuto').onclick=()=>toggleAuto(item.id,state);
  $('#armyAutoHelp').textContent=!recruit.equipped?'Auto is saved, but this contract must be equipped to reload or recruit.':skill.autocast?`Repeats while the battle runs. Each squad spends ${item.squad.gold} gold and ${item.squad.reserve} reserve.`:'Manual orders only. Queue here or use the equipped battle key when ready.';
  $('#armyInspectFacts').innerHTML=facts.metrics.filter(metric=>!['summonGold','squadUnits','reserveCost','reloadSeconds'].includes(metric.key)).map(metric=>`<div><dt>${esc(metric.label)}</dt><dd>${n(metric.value)} ${esc(metric.unit)}</dd><small>${esc(metric.scope)}</small></div>`).join('');
  $('#armyInspectNotes').innerHTML=[...facts.tactics,...facts.notes,facts.progression.description].map(text=>`<p>${esc(text)}</p>`).join('');
 }
 function renderLevies(state,snapshot){
  const host=$('#armyLevies');if(!host)return;const levy=levyArmyState(state);host.classList.toggle('hidden',!levy);if(!levy)return;
  $('#armyLevyCounts').textContent=`Your army ${snapshot.occupied}/${snapshot.cap} · Levies ${levy.occupied}/${levy.cap} · ${levy.pending} arriving · ${levy.wavesLeft} waves left`;
  $('#armyLevyStage').textContent=levy.stage;$('#armyLevyDetail').textContent=levy.detail;
  $('#armyCallLevies').textContent=`Call 5 levies · ${levy.wavesLeft} waves left`;$('#armyCallLevies').disabled=!levy.canCall;
  $('#armyCallLevies').onclick=()=>{const now=getState();if(callLeviesFromArmy(state,now,levy.nextWave)){message='Five temporary levies committed. Resume to deploy; no gold or reserve spent.';onChanged();}if(now.battle===state.battle&&now.profile===state.profile)render();};
  $('#armyLevyRoster').innerHTML=snapshot.levies.groups.map(group=>`<article class="army-field-tile" data-card-tone="steel"><span class="army-field-icon skill-icon" aria-hidden="true">${icon(group.type)}</span><div><strong>L · Wave ${group.wave} ${esc(roster.byId.get(group.type)?.name??group.type)}</strong><span>Temporary rank ${group.rank} · ${positions.filter(([id])=>group[id]).map(([id,label])=>`${group[id]} ${label.toLowerCase()}`).join(' · ')}</span></div><b>${group.total}</b></article>`).join('');
 }
 function renderMuster(state,snapshot){
  renderLevies(state,snapshot);
  $('#armyPositionCounts').innerHTML=positions.map(([id,label])=>`<span><b>${snapshot.counts[id]}</b>${label}</span>`).join('');
  $('#armyFieldRoster').innerHTML=snapshot.groups.length?snapshot.groups.map(group=>{const item=roster.byId.get(group.id),identity=item?cardIdentity(item):{tone:'steel',label:'Keep guard'};return `<article class="army-field-tile" data-card-tone="${identity.tone}"><span class="army-field-icon skill-icon" aria-hidden="true">${icon(group.id)}</span><div><strong>${esc(item?.name??group.id)}</strong><span>${positions.filter(([id])=>group[id]).map(([id,label])=>`${group[id]} ${label.toLowerCase()}`).join(' · ')}</span></div><b>${group.total}</b></article>`;}).join(''):'<p class="army-empty-note">No regular troops hold field slots yet. Keep guards, arriving recruits and fallen bodies appear here.</p>';
  const queue=state.battle.friendlyQueue,tickets=[...queue.queue];
  $('#armyQueueHeading').textContent=`Waiting to enter · ${snapshot.waiting}`;
  $('#armyQueueFlow').textContent=!snapshot.waiting?'Queue a squad when a contract is ready.':snapshot.free===0?`All ${snapshot.cap} field slots are occupied. Waiting units enter as slots clear after Resume.`:`${snapshot.free} field ${snapshot.free===1?'slot is':'slots are'} free. Units enter in order after Resume.`;
  $('#queueList').innerHTML=tickets.length?tickets.map((ticket,index)=>`<article class="army-ticket"><span class="army-ticket-order">${index+1}</span><span class="skill-icon" aria-hidden="true">${icon(ticket.type)}</span><div><strong>${esc(roster.byId.get(ticket.type)?.name??ticket.type)}</strong><span>Rank ${ticket.rank??0} · 1 unit</span></div><button id="cancelQueue${index}" aria-label="Cancel waiting ${esc(roster.byId.get(ticket.type)?.name??ticket.type)} ${index+1}; refund ${ticket.cost} reserve, no gold">Cancel · +${ticket.cost} reserve</button></article>`).join(''):'<p class="army-empty-note">The reinforcement queue is clear.</p>';
  tickets.forEach((ticket,index)=>{$('#cancelQueue'+index).disabled=!!state.readOnly;$('#cancelQueue'+index).onclick=()=>{const now=getState();if(!now.active||now.readOnly||now.battle!==state.battle||now.profile!==state.profile||now.battle.friendlyQueue!==queue||queue.queue.length!==tickets.length||tickets.some((value,i)=>queue.queue[i]!==value))return;queue.cancel(index);message=`Cancelled one ${roster.byId.get(ticket.type)?.name??ticket.type}. Returned ${ticket.cost} reserve; no gold refunded.`;onChanged();render();};});
  $('#armyQueueRule').textContent=`New squads can join while fewer than ${snapshot.queueGate} units are waiting; a whole squad may cross that threshold. Cancellation returns only the waiting unit’s reserve cost. Squad gold and reload time are not refunded.`;
 }
 function render(){
  const state=getState();if(identity!==state.battle){closeInspect();identity=state.battle;roster.setView({query:'',role:'all',state:'all'});signature='';tab='contracts';message='';}
  if(renderedTick!==state.battle.tick){message='';renderedTick=state.battle.tick;}
  $('#armyMore').open=false;
  const snapshot=armySnapshot(state.battle),result=roster.query(state),active=doc.activeElement?.id,scroll=$('#armyRoster').scrollTop;
  $('#armyPhase').textContent=state.battle.outcome||state.battle.summary?'BATTLE SETTLED':state.started?'BATTLE PAUSED':'PREPARE YOUR ORDERS';
  $('#armySlotsValue').textContent=`${snapshot.occupied}/${snapshot.cap}`;$('#armyReserveValue').textContent=n(snapshot.reserve);$('#armyWaitingValue').textContent=n(snapshot.waiting);$('#armyGoldValue').textContent=n(Math.floor(snapshot.gold));
  $('#queueStatus').textContent=state.readOnly?'Practice result is read-only. Prepare the seed again for a fresh kit.':message||(state.battle.outcome||state.battle.summary?'Contracts and ranks are kept. Reserve refills next battle.':state.started?'Time is stopped. Contracts and ranks survive defeat.':'Contracts and ranks survive defeat. Start to recruit.');
  $('#armyContractCount').textContent=`${result.owned} owned · ${result.automatic} Auto equipped`;$('#armyRosterCount').textContent=`${result.total?result.start+1:0}–${result.end} of ${result.total}`;
  $('#armyRole').innerHTML=options(ARMY_ROLES,roster.view.role);$('#armyState').value=roster.view.state;$('#armySearch').value=roster.view.query;
  $('#armyPageLabel').textContent=`${result.page+1} / ${result.pageCount}`;$('#armyPrevious').disabled=result.page===0;$('#armyNext').disabled=result.page===result.pageCount-1;$('#armyPagination').classList.toggle('hidden',result.pageCount===1);
  const sig=JSON.stringify([state.readOnly,roster.view,result.items.map(row=>[row.item.id,row.skill.rank,row.skill.autocast,row.skill.binding,row.recruit.code,row.recruit.label])]);
  if(signature!==sig){signature=sig;$('#armyRoster').innerHTML=result.items.length?result.items.map(({item,skill,recruit})=>{const ident=cardIdentity(item);return `<article class="army-contract" data-card-tone="${ident.tone}"><button id="army-card-${item.id}" class="army-card-inspect" aria-label="Inspect ${esc(item.name)}, ${esc(ident.label)}, rank ${skill.rank}"><span class="army-card-role">${esc(ident.label)}<b>R${skill.rank}</b></span><span class="army-card-art">${cardPortrait(item.id,icon(item.id))}</span><strong>${esc(item.name)}</strong><span class="army-card-cost">${item.squad.size} ${item.squad.size===1?'unit':'units'} <span>·</span> ${item.squad.gold} gold</span><span class="army-card-ready" data-ready="${recruit.canRecruit}">${esc(recruit.label)}</span></button><button id="armyAuto-${item.id}" class="army-card-auto" aria-pressed="${skill.autocast}" aria-label="${esc(item.name)} Auto-recruit ${skill.autocast?'on':'off'}"><span class="army-auto-light" aria-hidden="true"></span>Auto ${skill.autocast?'on':'off'}<span>${recruit.equipped?'Equipped':'Unassigned'}</span></button></article>`;}).join(''):`<div class="army-empty"><span class="army-empty-seal skill-icon" aria-hidden="true">${icon('grunt')}</span><h3>${result.owned?'No matching contracts':'Your army starts here'}</h3><p>${result.owned?'Try another name, effect or role.':'Unlock troop contracts in the Armory, then equip them on any action bar.'}</p><button id="armyEmptyAction">${result.owned?'Clear filters':'Visit Armory'}</button></div>`;
   for(const {item}of result.items){$('#army-card-'+item.id).onclick=()=>{if(current(state,item.id))inspect(item.id,'army-card-'+item.id);};$('#armyAuto-'+item.id).disabled=!!state.readOnly;$('#armyAuto-'+item.id).onclick=()=>toggleAuto(item.id,state);}
   if($('#armyEmptyAction'))$('#armyEmptyAction').onclick=()=>result.owned?view({query:'',role:'all',state:'all'},'armySearch'):onArmory();$('#armyRoster').scrollTop=scroll;
  }
  for(const id of ['#armyLoadout','#armyInspectLoadout','#armyArmory'])$(id).disabled=!!state.readOnly;
  $('#armyContractsView').classList.toggle('hidden',tab!=='contracts');$('#armyMusterView').classList.toggle('hidden',tab!=='muster');$('#armyContractsTab').setAttribute('aria-pressed',String(tab==='contracts'));$('#armyMusterTab').setAttribute('aria-pressed',String(tab==='muster'));$('#armyMusterTab').textContent=`Muster · ${snapshot.occupied+snapshot.waiting+(snapshot.levies?.occupied??0)+(snapshot.levies?.pending??0)}`;
  renderMuster(state,snapshot);if(active&&$('#'+active)!==doc.activeElement)$('#'+active)?.focus?.({preventScroll:true});renderInspector();
 }
 $('#armySearchForm').onsubmit=event=>{event.preventDefault();view({query:$('#armySearch').value},'armySearch');};$('#armySearch').oninput=()=>view({query:$('#armySearch').value},'armySearch');
 $('#armyRole').onchange=()=>view({role:$('#armyRole').value},'armyRole');$('#armyState').onchange=()=>view({state:$('#armyState').value},'armyState');$('#armyResetFilters').onclick=()=>view({query:'',role:'all',state:'all'},'armySearch');
 $('#armyPrevious').onclick=()=>view({page:roster.view.page-1},'armyPrevious');$('#armyNext').onclick=()=>view({page:roster.view.page+1},'armyNext');
 $('#armyContractsTab').onclick=()=>{tab='contracts';render();};$('#armyMusterTab').onclick=()=>{tab='muster';render();};$('#armyCloseInspector').onclick=closeInspect;
 $('#armyLoadout').onclick=$('#armyInspectLoadout').onclick=()=>{if(getState().readOnly)return;closeInspect();onLoadout();};$('#armyArmory').onclick=()=>{if(getState().readOnly)return;closeInspect();onArmory();};
 root.addEventListener('keydown',event=>{if(!selected||event.key!=='Tab')return;const items=modalFocusCandidates($('#armyInspector')),i=items.indexOf(doc.activeElement);if(event.shiftKey&&i<=0){items.at(-1)?.focus();event.preventDefault();}else if(!event.shiftKey&&(i<0||i===items.length-1)){items[0]?.focus();event.preventDefault();}event.stopPropagation();});
 return {render,showMuster(){render();closeInspect();tab='muster';render();$('#armyMusterTab').focus?.({preventScroll:true});},back:closeInspect,reset(){closeInspect();identity=null;signature='';},get model(){return roster;}};
}
