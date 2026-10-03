/** Separate companion slot; no normal skill binding, autocast, or Space action. */
import {COMPANIONS} from './engine/recruitment.mjs';
import {RECRUIT_ICONS} from './recruit-icons.mjs';
export function createCompanionUI({document,getBattle,canAct,onChange=()=>{},notify=()=>{}}){
 const $=selector=>document.querySelector(selector);let renderedIcon=null;
 const change=message=>{notify(message);onChange();renderLive();};
 const facts=item=>`Hire ${item.price.toLocaleString()} gold · Summon ${item.summonCost} gold · No reserve`;
 function renderLive(){
  // Reuse existing painted HUD space. Reparent only when orientation changes;
  // container-query rails establish fixed-position containing blocks.
  const dock=$('#companionDock'),portrait=globalThis.innerHeight>globalThis.innerWidth;
  const home=$(portrait?'.live-utility-column':'.live-vitals');
  if(home&&dock.parentElement!==home)home.appendChild(dock);
  const battle=getBattle();if(!battle?.companions)return;const state=battle.companions.status(),item=COMPANIONS[state.id];
  $('#companionDock').classList[item&&state.owned?'remove':'add']('hidden');
  if(!item)return;
  const active=state.active,label=active?item.signatureName:`Summon ${item.name}`,detail=active?(state.signatureCooldownSeconds?`${state.signatureCooldownSeconds}s · ${Math.ceil(state.hp)} HP`:`Ready · ${Math.ceil(state.hp)} HP`):state.cooldownSeconds?`Recovery ${state.cooldownSeconds}s`:`${state.cost} gold`;
  if(renderedIcon!==state.id){$('#companionActionIcon').innerHTML=RECRUIT_ICONS[state.id];renderedIcon=state.id;}$('#companionActionName').textContent=item.name;$('#companionActionState').textContent=active?(state.signatureCooldownSeconds?`Quake ${state.signatureCooldownSeconds}s`:'Quake'):state.cooldownSeconds?`Rest ${state.cooldownSeconds}s`:`${state.cost}g`;
  $('#companionAction').disabled=!canAct()||!(active?state.canUseSignature:state.canSummon);
  $('#companionAction').setAttribute('aria-label',`${label}. ${detail}. Separate companion slot. Shortcut G.`);
  $('#companionAction').setAttribute('title',(active?`${item.name} · ${Math.ceil(state.hp)} / ${state.maxHp} HP. ${item.signatureName}: ${state.signatureCooldownSeconds?state.signatureCooldownSeconds+'s':'ready'}.`:state.reason)+' · G');
  $('#companionRecall').classList[active?'remove':'add']('hidden');$('#companionRecall').disabled=!state.canRecall;
 }
 function renderArmory(){
  const battle=getBattle(),p=battle.profile,item=COMPANIONS.gorath,owned=p.companionOwned.has(item.id);
  $('#companionArmory').innerHTML=`<div class="companion-heading"><span class="skill-icon" aria-hidden="true">${RECRUIT_ICONS.gorath}</span><div><span class="eyebrow">COMPANION · SEPARATE SLOT</span><h3>${item.name} <small>${item.title}</small></h3></div></div><p>${item.description}</p><p class="companion-facts">${facts(item)}</p><p>Earthshatter: 15s cooldown. Recovery after recall: 60s. After defeat: 90s.</p><button id="hireCompanion" ${owned||p.gold<item.price?'disabled':''}>${owned?'Companion hired':`Hire ${item.name} · ${item.price.toLocaleString()} gold`}</button><p class="footnote">New recreation feature. Costs and recovery times are provisional balance choices. Hiring persists in this campaign; summoning is paid each battle.</p>`;
  $('#hireCompanion').onclick=()=>{if(!battle.summary||battle.summary.campaignComplete)return;if(p.recruitCompanion(item.id)){change(`${item.name} hired and equipped in the companion slot`);renderArmory();}};
 }
 function renderLoadout(){
  const battle=getBattle(),p=battle.profile,item=COMPANIONS.gorath,owned=p.companionOwned.has(item.id),equipped=p.companionId===item.id;
  $('#companionLoadout').innerHTML=`<div class="companion-heading"><span class="skill-icon" aria-hidden="true">${RECRUIT_ICONS.gorath}</span><div><span class="eyebrow">YOUR COMPANION SLOT</span><h3>${equipped?item.name:'No companion equipped'}</h3></div></div><p>${owned?`${item.title} · ${item.summonCost} gold to summon · No reserve or army slot.`:'Hire Gorath from the armory. Boss companions use their own summon control.'}</p>${owned?`<button id="equipCompanion" ${battle.companions.unit?'disabled':''}>${equipped?'Unequip companion':'Equip Gorath'}</button>`:''}<p class="footnote">${battle.companions.unit?'Use Recall Gorath in Pause before changing this slot.':'Gorath remains until recalled, defeated, or the battle ends. Earthshatter reloads in 15s.'}</p>`;
  if(owned)$('#equipCompanion').onclick=()=>{if(battle.companions.unit)return;p.equipCompanion(equipped?null:item.id);change(equipped?'Companion slot cleared':'Gorath equipped');renderLoadout();};
 }
 function act(){if(!canAct())return false;const b=getBattle(),before=b.companions.status();if(b.companions.act()){change(before.active?'Gorath prepares Earthshatter':'Gorath joins the battlefield');return true;}notify(b.companions.status().reason);return false;}
 $('#companionAction').onclick=act;
 $('#companionRecall').onclick=()=>{const battle=getBattle();if(!battle.paused||battle.outcome||battle.summary)return;if(battle.companions.recall())change('Gorath recalled · 60s recovery');};
 return {renderLive,renderArmory,renderLoadout,act};
}
