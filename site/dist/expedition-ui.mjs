import {EXPEDITION_NAME,EXPEDITION_LENGTH,EXPEDITION_STARTER,expeditionField} from './expedition-data.mjs';
import {terrainProfilePoints} from './campaign-atlas-model.mjs';
import {CHARTER_MAP_POINTS,CHARTER_ROADS,charterRoadState,charterRoadPath,charterFieldBrief,canChooseCharterField} from './expedition-map-layout.mjs';
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const number=value=>Number(value).toLocaleString();
export function expeditionLaunchLabel(run,{started=false,summary=null}={}){
 if(run.complete)return 'Archive and start new charter';
 if(run.choosing)return run.choices.length===1?'Prepare the final march':'Choose your next road';
 if(summary?.outcome==='defeat')return `Retry ${run.current.name}`;
 return `${started?'Resume':'Start'} ${run.current.name}`;
}
export function expeditionResultCopy(run,battle){
 const won=battle.summary?.outcome==='victory';
 return {title:run.complete?'Charter complete':won?'Road secured':'The march was stopped',
  description:run.complete?`Four fields won. Your route through ${run.state.path.map(id=>expeditionField(id).name).join(', ')} is recorded in this charter.`:won?`${run.current.name} is won. Choose your next road, then prepare your army.`:'Keep your combat earnings. You can adjust the loadout and retry the same field.',
  action:expeditionLaunchLabel(run,{summary:battle.summary})};
}
export function renderExpeditionReceipt(host,run){
 const result=run?.state.lastResult;
 if(!result){host.innerHTML='';return;}
 host.innerHTML=`<div class="campaign-reward-heading"><span class="eyebrow">${EXPEDITION_NAME.toUpperCase()} · LEG ${run.current.leg} / ${EXPEDITION_LENGTH}</span><strong>${escape(run.current.name)}</strong><p>${run.complete?'Every leg is complete. Export this charter to keep the route and record.':run.choosing?(run.choices.length===1?'The final march to Storm Crown is open.':'Two roads, different threats. Your next choice becomes part of this run.'):'The same company and terrain await your retry.'}</p></div><div class="campaign-reward-ledger"><span>Combat gold<b>+${number(result.stats.goldEarned)}</b></span><span>Victory bonus<b>+${number(result.gold)}</b></span><span>Army spending<b>−${number(result.stats.goldSpent)}</b></span><span>Bonus XP<b>+${number(result.xp)}</b></span></div>`;
}
/** A six-field route board. Inspecting standards never writes to a run. */
export function createExpeditionRoute({host,getRun,getState,onChoose,onReturn,onRestart}){
 let confirmingReset=false,inspectorOpen=false,selectedId=null,renderVersion=0;
 const focus=selector=>host.querySelector(selector)?.focus?.({preventScroll:true});
 const render=()=>{
  const version=++renderVersion,run=getRun(),state=getState();
  if(!selectedId||!CHARTER_MAP_POINTS[selectedId])selectedId=run.current.id;
  const brief=charterFieldBrief(run,state,selectedId),{field}=brief;
  const choices=run.choices.filter(choice=>canChooseCharterField(run,state,choice.id));
  const boardNote=run.complete?'Four legs won · Charter complete':choices.length?`Leg ${run.current.leg+1} · ${choices.length===1?'Final march open':'Choose the next road'}`:`Leg ${run.current.leg} · ${run.current.name}`;
  const resetMarkup=`<div id="charterResetConfirm" class="charter-reset confirmation-inline ${confirmingReset?'':'hidden'}" role="alertdialog" aria-modal="true" aria-labelledby="charterResetTitle"><h3 id="charterResetTitle">Restart this charter?</h3><p>Replace this banner’s charter with a fresh run? Its gold, cards and chosen route will be discarded. Export first to keep it. Other banners and play sessions are preserved.</p><div class="overlay-actions"><button id="cancelCharterReset" class="primary">Keep this charter</button><button id="confirmCharterReset" class="danger-link">Restart with starting supplies</button></div></div>`;
  const roadSVG=portrait=>`<svg class="charter-roads charter-roads-${portrait?'portrait':'landscape'}" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${CHARTER_ROADS.map(road=>`<path class="charter-road-bed" d="${charterRoadPath(road,portrait)}"/><path data-charter-road="${road.from}:${road.to}" data-state="${charterRoadState(run,state,road)}" d="${charterRoadPath(road,portrait)}"/>`).join('')}</svg>`;
  host.innerHTML=`<div class="charter-board-view ${inspectorOpen?'hidden':''}">
   <div class="charter-map-heading"><strong id="charterBoardStatus" role="status">${escape(boardNote)}</strong><span>4 legs · 6 fields · 4 routes</span></div>
   <ol class="charter-progress sr-only" aria-label="Chosen expedition route">${run.state.path.map((id,index)=>`<li data-state="${index<run.state.cleared?'complete':'current'}">Leg ${index+1}: ${expeditionField(id).name}, ${index<run.state.cleared?'won':'current field'}</li>`).join('')}</ol>
   <section class="charter-map" aria-label="Wayfarer branching route map">
    <div class="charter-map-art" aria-hidden="true">${Object.entries(CHARTER_MAP_POINTS).map(([id,point])=>`<i style="--node-x:${point.x}%;--node-y:${point.y}%;--portrait-x:${point.portraitX}%;--portrait-y:${point.portraitY}%;background-image:url('${charterFieldBrief(run,state,id).art}')"></i>`).join('')}</div>
    <div class="charter-map-vignette" aria-hidden="true"></div>
    ${roadSVG(false)}${roadSVG(true)}
    <div class="charter-map-nodes" role="group" aria-label="Inspect all six charter fields">${Object.entries(CHARTER_MAP_POINTS).map(([id,point])=>{const node=charterFieldBrief(run,state,id),current=id===run.current.id;return `<button class="charter-node" data-charter-node="${id}" data-state="${node.status}" aria-pressed="${id===selectedId}" ${current?'aria-current="step"':''} aria-label="Leg ${node.field.leg}: ${node.field.name}. ${node.statusLabel}. ${node.total} enemies. ${node.objective}. Select to inspect." style="--node-x:${point.x}%;--node-y:${point.y}%;--portrait-x:${point.portraitX}%;--portrait-y:${point.portraitY}%"><span class="charter-node-seal" aria-hidden="true">${node.status==='complete'?'✓':node.status==='bypassed'?'×':node.status==='locked'?'◇':node.field.leg}</span><strong>${node.field.name}</strong><small>${node.statusLabel}</small></button>`;}).join('')}</div>
    <span class="charter-map-compass" aria-hidden="true">N<br>✦</span>
   </section>
   <div class="charter-road-key" aria-label="Road key"><span data-state="complete">Won</span><span data-state="chosen">Chosen</span><span data-state="available">Open</span><span data-state="locked">Locked</span><span data-state="bypassed">Not taken</span></div>
   <footer class="charter-command">
    <div class="charter-selection" role="status"><strong>${escape(field.name)}</strong><span>${brief.total} enemies · ${escape(brief.objective)} · ${number(field.enemyKeepHP)} keep HP</span></div>
    <button id="charterInspect" aria-controls="charterInspector" aria-expanded="${inspectorOpen}">Inspect</button>
    <div class="charter-choice-actions" aria-label="Choose an open road">${choices.map(choice=>`<button data-charter-choice="${choice.id}" class="primary" aria-label="Take the road to ${choice.name}">Take ${choice.name.replace(/^The /,'')}</button>`).join('')}</div>
    <button id="charterReturn">Lobby</button><button id="charterRestart" class="charter-reset-link" aria-controls="charterResetConfirm" aria-expanded="${confirmingReset}">Restart</button>
   </footer>
  </div>
  <section id="charterInspector" class="charter-inspector ${inspectorOpen?'':'hidden'}" aria-labelledby="charterFieldTitle">
   <header class="charter-inspect-head"><div><span class="eyebrow">LEG ${field.leg} · ${brief.statusLabel.toUpperCase()} · ${field.timeOfDay.toUpperCase()}</span><h3 id="charterFieldTitle">${field.name}</h3></div><button id="charterCloseInspector">Back to map</button></header>
   <div class="charter-inspect-scroll"><div class="charter-inspect-scene" style="background-image:linear-gradient(0deg,#151d20ef,#151d2066),url('${brief.art}')"><p>${field.description}</p><div class="charter-field-facts"><span><b>${brief.total}</b> enemies</span><span><b>${number(field.enemyKeepHP)}</b> keep HP</span><span><b>${field.towers.length}</b> towers</span><span><b>${brief.aerial}</b> flyers</span></div></div>
    <div class="charter-intel-grid"><section class="charter-orders"><h4>${brief.objective}</h4><p>${field.objectiveText}</p><small>You lose if your hero falls or the enemy returns your home flag.</small><p class="charter-tradeoff">${field.tradeoff}</p><div class="atlas-terrain charter-terrain"><svg viewBox="0 0 600 145" preserveAspectRatio="none" role="img" aria-label="Authored expedition terrain profile, from your keep on the left to the enemy keep on the right"><polyline points="${terrainProfilePoints(field.heights)}"/><path d="M105 5v130M540 5v130"/></svg><div><span>Your keep</span><span>Actual field terrain</span><span>Enemy keep</span></div></div><p id="charterFieldNote" class="charter-field-note">${escape(brief.note)}</p></section>
    <section class="charter-enemy-company"><h4>Known enemy company</h4><p class="charter-stat-note">Fixed composition · Spawn HP at ${escape(run.profile.difficulty)} difficulty. Existing enemies retain their spawn stats.</p><div class="atlas-threats">${brief.enemies.map(enemy=>`<span><b>${enemy.name} ×${field.counts[enemy.id]}</b><small>${number(Math.round(enemy.maxHp))} HP</small></span>`).join('')}</div><details class="charter-counters"><summary>Enemy counters</summary>${brief.enemies.map(enemy=>`<p><strong>${enemy.name}:</strong> ${enemy.counter}</p>`).join('')}</details></section></div>
    <details class="charter-rewards"><summary>Combat earnings and rewards</summary><p>Combat gold comes from this field’s fights. Victory gold depends on army-spending efficiency and head-shot share; bonus XP depends on accuracy and surviving reserve. These normal combat rewards are calculated at settlement, so the map promises no fixed payout.</p>${run.state.lastResult?.id===field.id?`<p>Last settled result: ${escape(run.state.lastResult.outcome)} · +${number(run.state.lastResult.stats.goldEarned)} combat gold · −${number(run.state.lastResult.stats.goldSpent)} army spending · +${number(run.state.lastResult.gold)} victory gold · +${number(run.state.lastResult.xp)} bonus XP.</p>`:''}</details>
    <details class="charter-starter"><summary>Charter rules and starting kit · Seed ${run.state.seed}</summary><p>Each new banner starts at hero rank ${EXPEDITION_STARTER.rank} with ${number(EXPEDITION_STARTER.gold)} gold, Basic Arrow rank ${EXPEDITION_STARTER.basicRank}, and six rank ${EXPEDITION_STARTER.skillRank} cards: Grunt, Archer, Fire Arrow, Ice Arrow, Bomb Arrow and Flak Bomb Arrow. These are the expedition’s declared starting supplies.</p><p>Army costs, damage, skill progression and victory bonuses use normal combat rules. This charter has its own gold, cards and records. Nothing transfers to the Crownroad or practice sessions.</p><p>Save a charter code or file before closing. Live fields restart on load; settled results and choices are preserved without paying rewards again. Retrying keeps combat earnings and uses the same encounter seed.</p></details>
   </div>
   <footer class="charter-inspect-actions"><p role="status">${escape(brief.note)}</p><button id="charterInspectChoose" class="primary" ${brief.canChoose?'':'disabled'} aria-describedby="charterFieldNote">${brief.canChoose?'Take this road':brief.status==='bypassed'?'Road not taken':brief.status==='complete'?'Field won':brief.status==='current'?'Current field':'Road locked'}</button></footer>
  </section>${resetMarkup}`;
  const currentView=()=>version===renderVersion&&getRun()===run;
  const choose=id=>{if(currentView()&&!confirmingReset&&canChooseCharterField(getRun(),getState(),id))onChoose(id);};
  for(const button of host.querySelectorAll('[data-charter-node]'))button.onclick=()=>{
   if(!currentView()||confirmingReset)return;selectedId=button.getAttribute('data-charter-node');render();focus(`[data-charter-node="${selectedId}"]`);
  };
  for(const button of host.querySelectorAll('[data-charter-choice]'))button.onclick=()=>choose(button.getAttribute('data-charter-choice'));
  host.querySelector('#charterInspectChoose').onclick=()=>choose(selectedId);
  host.querySelector('#charterInspect').onclick=()=>{if(!currentView()||confirmingReset)return;inspectorOpen=true;render();focus('#charterCloseInspector');};
  host.querySelector('#charterCloseInspector').onclick=()=>{if(!currentView())return;inspectorOpen=false;render();focus('#charterInspect');};
  host.querySelector('#charterReturn').onclick=()=>{if(currentView()&&!confirmingReset)onReturn();};
  host.querySelector('#charterRestart').onclick=()=>{if(!currentView())return;confirmingReset=true;render();focus('#cancelCharterReset');};
  host.querySelector('#cancelCharterReset').onclick=()=>{if(!currentView())return;confirmingReset=false;render();focus('#charterRestart');};
  host.querySelector('#confirmCharterReset').onclick=()=>{if(!currentView()||!confirmingReset)return;confirmingReset=false;renderVersion++;releaseReset();onRestart();};
  host.querySelector('.charter-board-view').inert=confirmingReset;
  host.querySelector('#charterInspector').inert=confirmingReset;
  for(const node of host.parentElement?.querySelectorAll('.panel-head,.game-shell-nav')??[])node.inert=confirmingReset;
 };
 const releaseReset=()=>{for(const node of host.parentElement?.querySelectorAll('.panel-head,.game-shell-nav')??[])node.inert=false;};
 const back=()=>{if(confirmingReset){confirmingReset=false;render();focus('#charterRestart');return true;}if(inspectorOpen){inspectorOpen=false;render();focus('#charterInspect');return true;}return false;};
 return {open(){releaseReset();confirmingReset=false;inspectorOpen=false;selectedId=getRun().current.id;render();},refresh:render,back,
  // The legacy Escape hook consumes the innermost route view too; callers can
  // migrate to back() without changing reset or inspector keyboard behavior.
  cancelReset:back};
}
