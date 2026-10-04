import {defaultControlLabel} from './control-bindings.mjs';
import {LoadoutCollection,LOADOUT_TYPES,LOADOUT_SORTS,loadoutPlacementPreview} from './loadout-collection-model.mjs';
import {cardIdentity} from './armory-presentation.mjs';
import {cardPortrait,bindCardPortraits} from './card-portraits.mjs';
import {getCardInsights} from './armory-insights.mjs';
import {slotToKey} from './keyboard-layout.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const formatMetric=metric=>`${Number(metric.value).toLocaleString(undefined,{maximumFractionDigits:2})} ${metric.unit}`;
const labels={frontline:'Frontline',ranged:'Ranged',support:'Support',siege:'Siege',fire:'Fire',ice:'Ice',poison:'Poison',lightning:'Lightning',explosive:'Explosive',healing:'Healing',airborne:'Airborne',ground:'Ground'};
export function createLoadoutCollectionUI({root,controlLabel=defaultControlLabel,records,getState,icon,bindingLabel,onSelect,onMove,onBar}){
 const releasePortraits=bindCardPortraits(root);
 const $=selector=>root.querySelector(selector),doc=root.ownerDocument,model=new LoadoutCollection(records);
 let lastLayout=null,inspectedId=null,inspectReturn=null,gridSignature='',profileIdentity=null,selectedDestination=null;
 const name=id=>model.byId.get(id)?.name??id;
 const options=(items,active)=>items.map(([id,label])=>`<option value="${esc(id)}" ${id===active?'selected':''}>${esc(label)}</option>`).join('');
 function view(patch,focusId){
  model.setView(patch);gridSignature='';render();const list=$('#ownedSkillList'),inventory=$('.loadout-inventory'),workspace=$('#loadoutWorkspace');list.scrollTop=0;inventory.scrollTop=0;
  if('page'in patch){
   const portrait=globalThis.matchMedia?.('(max-width:700px) and (orientation:portrait)').matches;
   if(portrait){const top=list.getBoundingClientRect().top-workspace.getBoundingClientRect().top+workspace.scrollTop,planner=$('.loadout-placement').getBoundingClientRect().height;workspace.scrollTop=Math.max(0,top-planner-8);}
   focusId=model.query(getState().layout.dragIcons).items[0]?.item.id;focusId=focusId?'owned-'+focusId:'loadoutSearch';
  }
  if(focusId)$('#'+focusId)?.focus?.({preventScroll:true});
 }
 function restoreFocus(id){if(id)$('#'+id)?.focus?.({preventScroll:true});}
 function inspectionInert(active){for(const child of root.children)if(child!==$('#loadoutInspector'))child.inert=active;}
 function closeInspect(){if(!inspectedId)return false;inspectedId=null;$('#loadoutInspector').classList.add('hidden');inspectionInert(false);restoreFocus(inspectReturn);return true;}
 function inspect(id,returnId){inspectedId=id;inspectReturn=returnId;renderInspector();inspectionInert(true);$('#loadoutCloseInspector').focus?.();}
 function renderInspector(){
  if(!inspectedId)return;
  const {layout,profile}=getState(),wrapper=layout.dragIcons.find(w=>w.skill.id===inspectedId),item=model.byId.get(inspectedId);if(!wrapper||!item){closeInspect();return;}
  const identity=cardIdentity(item),insights=getCardInsights(item,{rank:wrapper.skill.rank,heroRank:profile.rank,difficulty:profile.difficulty});
  $('#loadoutInspector').classList.remove('hidden');$('#loadoutInspector').setAttribute('data-card-tone',identity.tone);
  $('#selectedSkillIcon').innerHTML=cardPortrait(item.id,icon(item.id));$('#selectedSkillName').textContent=item.name;$('#selectedSkillDescription').textContent=item.description;
  $('#selectedSkillDetails').textContent=`${identity.tactics?identity.headline:identity.label} · Rank ${wrapper.skill.rank} · ${bindingLabel(wrapper.binding)}`;
  $('#loadoutInspectorFacts').innerHTML=insights.metrics.map(metric=>`<div><dt>${esc(metric.label)}</dt><dd>${esc(formatMetric(metric))}</dd><small>${esc(metric.scope)}</small></div>`).join('');
  $('#loadoutInspectorNotes').innerHTML=[...(identity.tactics?[identity.tactics.strength,'Know the tradeoff: '+identity.tactics.caution]:[]),...insights.notes,...insights.tactics].map(text=>`<p>${esc(text)}</p>`).join('');
  $('#loadoutInspectorSelect').textContent=`Select ${item.name} for placement`;
  $('#loadoutInspectorSelect').onclick=()=>{closeInspect();onSelect(wrapper,'assign-'+getState().bar*10);};
 }
 function render(){
  const {layout,selected,armed,bar,message,profile}=getState();if(!layout||layout.closed)return;
  if(lastLayout!==layout){lastLayout=layout;gridSignature='';}
  if(profileIdentity!==profile){profileIdentity=profile;model.setView({type:'all',query:'',role:'all',trait:'all',status:'all',sort:'equipped'});gridSignature='';selectedDestination=null;closeInspect();}
  $('#loadoutCompanionSummary').textContent=`${profile.companionId?records.find(item=>item.id===profile.companionId)?.name??'Companion':'Companion'} · separate slot · ${controlLabel('companion')} · ${profile.castleId==='highwatch'?'Highwatch':'Classic'} castle · Heraldry`;
  const result=model.query(layout.dragIcons),active=doc.activeElement?.id,list=$('#ownedSkillList'),scrollTop=list.scrollTop;
  $('#skillsResources').textContent=`${Math.floor(profile.gold).toLocaleString()} gold · ${result.owned} owned abilities · ${result.equipped}/30 equipped · ${result.reserve} in reserve`;
  $('#loadoutFilters').innerHTML=LOADOUT_TYPES.map(([id,label])=>`<button data-loadout-type="${id}" aria-pressed="${model.view.type===id}">${esc(label)}<span>${result.counts.get(id)}</span></button>`).join('');
  for(const button of $('#loadoutFilters').querySelectorAll('button'))button.onclick=()=>{view({type:button.getAttribute('data-loadout-type')});$('#loadoutFilters').querySelector(`[data-loadout-type="${model.view.type}"]`)?.focus?.();};
  $('#loadoutSearch').value=model.view.query;
  $('#loadoutRole').innerHTML=options([['all','All roles'],...result.roles.map(id=>[id,labels[id]??id])],model.view.role)+(result.jobs.length?`<optgroup label="Battlefield jobs">${options(result.jobs,model.view.role)}</optgroup>`:'');$('#loadoutRole').value=model.view.role;$('#loadoutRoleField').classList[model.view.type==='army'?'remove':'add']('hidden');
  $('#loadoutTrait').innerHTML=options([['all','All effects'],...result.traits.map(id=>[id,labels[id]??id])],model.view.trait);
  $('#loadoutState').value=model.view.status;$('#loadoutSort').value=model.view.sort;
  $('#inventoryCount').textContent=`${result.total?result.start+1:0}–${result.end} of ${result.total}`;
  $('#loadoutPageLabel').textContent=`Page ${result.page+1} of ${result.pageCount}`;$('#loadoutPrevious').disabled=result.page===0;$('#loadoutNext').disabled=result.page>=result.pageCount-1;
  $('#loadoutClearFilters').disabled=model.view.type==='all'&&!model.view.query&&model.view.role==='all'&&model.view.trait==='all'&&model.view.status==='all';
  const signature=JSON.stringify([model.view,result.items.map(({item,wrapper})=>[item.id,wrapper.binding,wrapper.skill.rank]),selected?.skill.id,armed]);
  if(signature!==gridSignature){
   gridSignature=signature;
   list.innerHTML=result.items.length?result.items.map(({item,wrapper})=>{const identity=cardIdentity(item),chosen=armed&&wrapper===selected;return `<article class="loadout-collection-card" data-card-tone="${identity.tone}" data-selected="${chosen}"><button id="owned-${item.id}" class="loadout-card-select" data-drag-ability="${item.id}" data-card-binding="${wrapper.binding}" aria-pressed="${chosen}" aria-label="${esc(item.name)}, ${identity.tactics?esc(identity.headline)+', ':''}rank ${wrapper.skill.rank}, ${esc(bindingLabel(wrapper.binding))}.${item.squad?' Deploy '+esc(identity.facts[1].value)+'.':''} Select for placement."><span class="loadout-card-topline"><span>${esc(identity.label)}</span><b>R${wrapper.skill.rank}</b></span><span class="loadout-card-art">${cardPortrait(item.id,icon(item.id))}<span class="loadout-card-sigil" aria-hidden="true">${item.squad?'UNIT':item.category==='waves'?'WAVE':'SHOT'}</span></span><strong>${esc(item.name)}</strong>${identity.tactics?`<span class="loadout-card-purpose">${esc(identity.headline)}</span>`:''}<span class="loadout-card-facts${item.squad?' loadout-unit-deployment':''}">${identity.facts.map(fact=>`<span><small>${esc(fact.label)}</small>${esc(fact.value)}</span>`).join('')}</span><span class="loadout-card-binding" data-equipped="${wrapper.binding>=0}">${chosen?'Selected · choose a key':esc(bindingLabel(wrapper.binding))}</span></button><div class="loadout-card-tools"><button id="loadout-inspect-${item.id}" aria-label="Inspect ${esc(item.name)} without changing your selection">Inspect</button><span class="ability-drag-handle" data-drag-ability="${item.id}" data-card-binding="${wrapper.binding}" data-drag-handle="true" aria-hidden="true">⠿</span></div></article>`;}).join(''):'<div class="loadout-empty"><h4>No matching abilities</h4><p>Try another name, effect or role. Your equipped bar stays unchanged.</p><button id="loadoutEmptyReset">Clear collection filters</button></div>';
   for(const {item,wrapper}of result.items){$('#owned-'+item.id).onclick=event=>onSelect(wrapper,event.detail===0?'assign-'+getState().bar*10:'owned-'+item.id);$('#loadout-inspect-'+item.id).onclick=()=>inspect(item.id,'loadout-inspect-'+item.id);}
   if($('#loadoutEmptyReset'))$('#loadoutEmptyReset').onclick=()=>view({type:'all',query:'',role:'all',trait:'all',status:'all'},'loadoutSearch');list.scrollTop=scrollTop;
  }
  $('#bindingGrid').setAttribute('aria-label',`Bar ${bar+1}, keys 1 through 9, then 0. Any ability can use any key. Companions use their own slot.`);
  $('#bindingGrid').innerHTML=layout.slots.slice(bar*10,bar*10+10).map(slot=>{const w=slot.holding,id=w?.skill.id,item=id?model.byId.get(id):null,identity=item?cardIdentity(item):null;return `<button id="assign-${slot.index}" class="loadout-slot" data-drop-slot="${slot.index}" ${id?`data-drag-ability="${id}" data-drag-handle="true"`:''} data-current="${w===selected&&armed}" data-destination="${selectedDestination===slot.index}" data-empty="${!w}" ${identity?`data-card-tone="${identity.tone}"`:''} aria-label="Bar ${bar+1}, key ${slotToKey(slot.index%10)}, ${esc(id?`${name(id)}, ${identity?.label??'ability'}, rank ${w.skill.rank}`:'empty')}. ${esc(loadoutPlacementPreview(armed?selected:null,slot,name,bindingLabel))}"><span class="loadout-slot-key">${slotToKey(slot.index%10)}</span><span class="loadout-slot-art" aria-hidden="true">${id?cardPortrait(id,icon(id)):'<span class="skill-icon">+</span>'}</span>${identity?`<span class="loadout-slot-identity">${esc(identity.label)} · R${w.skill.rank}</span>`:''}<span class="loadout-slot-label">${esc(id?name(id):'Empty')}</span></button>`;}).join('');
  for(const slot of layout.slots.slice(bar*10,bar*10+10)){const button=$('#assign-'+slot.index);button.onclick=()=>{selectedDestination=slot.index;if(armed)onMove(slot.index);else if(slot.holding)onSelect(slot.holding,'assign-'+slot.index);else{$('#bindingStatus').textContent='Choose a card, then tap this empty key to place it.';}};button.onfocus=button.onpointerenter=()=>{if(armed)$('#slotInstruction').textContent=loadoutPlacementPreview(selected,slot,name,bindingLabel);};button.onpointerleave=()=>{$('#slotInstruction').textContent=loadoutPlacementPreview(armed?selected:null,null,name,bindingLabel);};}
  for(const button of root.querySelectorAll('[data-loadout-bar]')){const page=Number(button.getAttribute('data-loadout-bar')),occupied=layout.slots.slice(page*10,page*10+10).filter(slot=>slot.holding).length;button.setAttribute('aria-pressed',String(page===bar));button.innerHTML=`Bar ${page+1}<span>${occupied}/10</span>`;button.onclick=()=>onBar(page);}
  $('#loadoutSelectionName').textContent=armed&&selected?name(selected.skill.id):'Choose an ability';$('#loadoutSelectionFrom').textContent=armed&&selected?`${bindingLabel(selected.binding)} → tap a destination key`:'Select a card or drag it onto a key';
  $('#loadoutSelectionIcon').innerHTML=armed&&selected?icon(selected.skill.id):'';
  $('#loadoutInspectSelected').disabled=!armed||!selected;$('#loadoutInspectSelected').onclick=()=>{if(selected)inspect(selected.skill.id,'loadoutInspectSelected');};
  $('#loadoutRevealSelected').disabled=!armed||!selected;$('#loadoutRevealSelected').onclick=()=>{if(selected){model.reveal(selected.skill.id,layout.dragIcons);gridSignature='';render();$('#owned-'+selected.skill.id)?.focus?.();}};
  $('#slotInstruction').textContent=loadoutPlacementPreview(armed?selected:null,null,name,bindingLabel);
  $('#unbindSkill').disabled=!armed||!selected||selected.binding<0;$('#cancelBinding').disabled=!armed;$('#cancelBinding').classList.remove('hidden');
  $('#bindingStatus').textContent=message||'All ability types fit any key. Occupied keys swap; replaced reserve cards stay owned.';
  if(active&&root.querySelector('#'+active)!==doc.activeElement)restoreFocus(active);renderInspector();
 }
 $('#loadoutSort').innerHTML=options(LOADOUT_SORTS,'equipped');
 $('#loadoutSearchForm').onsubmit=event=>{event.preventDefault();view({query:$('#loadoutSearch').value},'loadoutSearch');};
 $('#loadoutSearch').oninput=()=>view({query:$('#loadoutSearch').value},'loadoutSearch');
 for(const [id,key]of [['loadoutRole','role'],['loadoutTrait','trait'],['loadoutState','status'],['loadoutSort','sort']])$('#'+id).onchange=()=>view({[key]:$('#'+id).value},id);
 $('#loadoutPrevious').onclick=()=>view({page:model.view.page-1},'loadoutPrevious');$('#loadoutNext').onclick=()=>view({page:model.view.page+1},'loadoutNext');
 $('#loadoutClearFilters').onclick=()=>view({type:'all',query:'',role:'all',trait:'all',status:'all'},'loadoutSearch');$('#loadoutCloseInspector').onclick=closeInspect;
 root.addEventListener('keydown',event=>{if(!inspectedId||event.key!=='Tab')return;const items=[...$('#loadoutInspector').querySelectorAll('button:not(:disabled),input,select,a[href]')].filter(node=>node.getClientRects().length);if(!items.length)return;const index=items.indexOf(doc.activeElement);if(event.shiftKey&&index<=0){items.at(-1).focus();event.preventDefault();}else if(!event.shiftKey&&(index<0||index===items.length-1)){items[0].focus();event.preventDefault();}event.stopPropagation();});
 return {render,back:closeInspect,dispose:releasePortraits,reset(){closeInspect();profileIdentity=null;selectedDestination=null;gridSignature='';},get model(){return model;}};
}
