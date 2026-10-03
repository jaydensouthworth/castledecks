import {ARMY_RALLY_POSITIONS,ARMY_ORDER_GROUPS} from './engine/army-orders.mjs';
const POSITION_LABELS=Object.freeze({rear:'Rear',center:'Center',forward:'Forward'});
const POSITION_HELP=Object.freeze({rear:'Protect home ground',center:'Contest midfield',forward:'Pressure the enemy keep'});
export const armyRallyPositionLabel=position=>POSITION_LABELS[position]??POSITION_LABELS.rear;
/** Compact, native-button ground-line command; no global keyboard interception. */
export const armyCompanyLabel=group=>({all:'All ground',frontline:'Frontline',support:'Support'})[group]??'All ground';
const companyStatus=(group,order)=>`${armyCompanyLabel(group)} ${order.mode==='rally'?armyRallyPositionLabel(order.position)+' hold':'advancing'} · ${order.affected}`;
export function armyOrderStatus(battle,group='all'){
 const order=battle.armyOrder,label=armyRallyPositionLabel(order.position);
 if(group!=='all')return `Orders for ${armyCompanyLabel(group)}. ${companyStatus('frontline',order.groups.frontline)}; ${companyStatus('support',order.groups.support)}. Live commands override all ground.`;
 if(order.mode==='split')return `Split orders: ${companyStatus('frontline',order.groups.frontline)}; ${companyStatus('support',order.groups.support)}. Live Advance releases both; live line choice rallies all ground.`;
 return order.mode==='rally'?`${label} line holding · ${order.affected} ground troops. Advance releases all ground.`:`Advancing · ${label.toLowerCase()} line ready for Rally. All ground.`;
}
function canChangeOrder(state,shownBattle){
 const b=state.battle;
 return !!b&&state.active&&!state.readOnly&&state.started&&b===shownBattle&&!b.outcome&&!b.summary;
}
function canRally(b){return b.badCastle.hp>0&&b.hero.hp>0&&!b.hero.dead;}
export function createArmyOrdersUI({root,getState,onChanged=()=>{}}){
 root.innerHTML='<label class="army-order-heading"><span>Orders for</span><select class="army-company-select" aria-label="Orders for company"><option value="all">All ground</option><option value="frontline">Frontline</option><option value="support">Support</option></select></label><div class="army-order-options" role="group" aria-label="Ground-line order"><button type="button" data-army-order="advance">Advance</button><button type="button" data-army-order="rally">Rally line</button></div><div class="army-rally-positions" role="group" aria-label="Choose a fixed rally line; selecting a position orders Rally">'+ARMY_RALLY_POSITIONS.map(position=>`<button type="button" data-rally-position="${position}" aria-label="Rally ${POSITION_LABELS[position]} line: ${POSITION_HELP[position].toLowerCase()}"><strong>${POSITION_LABELS[position]}</strong><span>${POSITION_HELP[position]}</span></button>`).join('')+'</div><p class="army-order-status" aria-live="polite"></p><details class="army-order-rules"><summary aria-label="How ground-line orders work">?</summary><p class="army-order-help">Choose All ground, Frontline or Support, then Advance or a fixed Rear, Center or Forward line. Choosing a line immediately holds that company there. Frontline fights nearby; Support stands behind its chosen line. Held archers shoot from there and priests heal or purge only within real range, without chasing. New troops follow their company. Active attacks and spells finish first. Flag carriers and home-flag recovery take priority; flyers, siege, garrisons and Gorath keep their own orders. The live shortcut advances all ground when any company holds; the live line selector rallies all ground. Both replace split orders. Advance releases the selected company; all lines release when the enemy keep falls.</p></details>';
 const buttons=[...root.querySelectorAll('[data-army-order]')],positions=[...root.querySelectorAll('[data-rally-position]')],status=root.querySelector('.army-order-status'),company=root.querySelector('.army-company-select');
 let shownBattle=null,selectedGroup='all';
 function render(){
  const state=getState(),b=state.battle;if(b!==shownBattle)selectedGroup='all';shownBattle=b;
  company.value=selectedGroup;company.disabled=!state.active||!!state.readOnly;
  const order=selectedGroup==='all'?b.armyOrder:b.armyOrder.groups[selectedGroup];
  const disabled=!canChangeOrder(state,shownBattle),position=order.position??'rear';
  for(const button of buttons){const mode=button.getAttribute('data-army-order');button.disabled=disabled||mode==='rally'&&!canRally(b);button.setAttribute('aria-pressed',String(mode===order.mode));button.setAttribute('aria-label',`${mode==='advance'?'Advance':'Rally'} ${armyCompanyLabel(selectedGroup).toLowerCase()}`);}
  for(const button of positions){button.disabled=disabled||!canRally(b);button.setAttribute('aria-pressed',String(order.mode!=='split'&&button.getAttribute('data-rally-position')===position));button.setAttribute('aria-label',`Rally ${armyCompanyLabel(selectedGroup).toLowerCase()} at the ${armyRallyPositionLabel(button.getAttribute('data-rally-position'))} line`);}
  status.textContent=state.readOnly?'Ground-line orders are unavailable during guided drills.':!state.started?'Begin the battle to issue a ground-line order.':b.outcome||b.summary?'Battle settled · ground-line order cleared.':!canRally(b)?'The line is released · troops finish the battle.':armyOrderStatus(b,selectedGroup)+(b.paused?' Movement resumes after you leave this panel.':'');
 }
 function issue(mode,position){const state=getState();if(!canChangeOrder(state,shownBattle))return;if(state.battle.setArmyOrder(mode,position,selectedGroup)){onChanged();render();}}
 company.addEventListener('change',()=>{const state=getState();if(state.battle!==shownBattle||!state.active||state.readOnly||!ARMY_ORDER_GROUPS.includes(company.value)){render();return;}selectedGroup=company.value;render();});
 for(const button of buttons)button.addEventListener('click',()=>issue(button.getAttribute('data-army-order')));
 for(const button of positions)button.addEventListener('click',()=>issue('rally',button.getAttribute('data-rally-position')));
 return {render};
}
/** Native 44px live selector: one extra control next to the quick R toggle.
 * The host owns live/pause guards; panel orders deliberately remain usable paused. */
export function createLiveRallyPositionUI({root,getState,onChanged=()=>{}}){
 root.innerHTML='<select class="live-rally-position-select" aria-label="All ground rally position. Choosing a line replaces both company orders." title="Choose a fixed line for all ground"><option value="split" disabled>Split orders</option>'+ARMY_RALLY_POSITIONS.map(position=>`<option value="${position}">${POSITION_LABELS[position]} line</option>`).join('')+'</select>';
 const select=root.querySelector('select');let shownBattle=null,shownPosition=null;
 function render(force=false){
  const state=getState(),b=state.battle,position=b.armyOrder.mode==='split'?'split':b.armyOrder.position??'rear';
  if(force||b!==shownBattle||position!==shownPosition)select.value=position;
  shownBattle=b;shownPosition=position;
  root.classList[state.visible===false?'add':'remove']('hidden');
  select.disabled=!canChangeOrder(state,shownBattle)||b.paused||!canRally(b);
  const label=armyRallyPositionLabel(b.armyOrder.position),holding=b.armyOrder.mode!=='advance',split=b.armyOrder.mode==='split';
  root.setAttribute('data-holding',String(holding));
  select.setAttribute('aria-label',`${split?'Split company orders':label+' rally line '+(holding?'holding':'ready')}. Choose Rear, Center or Forward to rally all ground and replace both company orders.`);
  select.setAttribute('title',`${split?'Split orders. ':''}All ground: choosing a line replaces both company orders. ${label}: ${POSITION_HELP[b.armyOrder.position??'rear']}.`);
 }
 select.addEventListener('change',()=>{
  const state=getState(),position=select.value;
  if(canChangeOrder(state,shownBattle)&&!state.battle.paused&&state.visible!==false&&canRally(state.battle)&&state.battle.setArmyOrder('rally',position,'all'))onChanged();
  render(true);
 });
 return {render};
}
/** Draw in world coordinates after terrain, before units; decorative only. */
export function drawArmyOrderMarker(ctx,battle,scale=1){
 const order=battle.armyOrder;
 if(order.mode==='advance')return false;
 const markers=order.mode==='rally'?[{...order,label:'RALLY'}]:['frontline','support'].filter(group=>order.groups[group].mode==='rally').map(group=>({...order.groups[group],anchorX:order.groups[group].anchorX-(group==='support'?100:0),label:armyCompanyLabel(group).toUpperCase()}));
 let drawn=false;
 for(const {anchorX:x,position,label}of markers){
  if(!Number.isFinite(x))continue;
  const y=battle.elevationAt(x);if(!Number.isFinite(y))continue;
  const k=1/Math.max(.25,Math.min(1,Number.isFinite(scale)?scale:1));
  ctx.save();ctx.translate(x,y);ctx.scale(k,k);ctx.strokeStyle='#a5dfd6';ctx.fillStyle='#142e36';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-76);ctx.stroke();
  ctx.beginPath();ctx.moveTo(0,-76);ctx.lineTo(76,-76);ctx.lineTo(67,-35);ctx.lineTo(0,-35);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle='#d1fff2';ctx.font=label==='RALLY'?'bold 13px sans-serif':'bold 10px sans-serif';ctx.textAlign='left';ctx.fillText(label,6,-59);ctx.font='10px sans-serif';ctx.fillText(armyRallyPositionLabel(position).toUpperCase(),6,-44);
  ctx.beginPath();ctx.moveTo(-24/k,-2);ctx.lineTo(24/k,-2);ctx.stroke();ctx.restore();drawn=true;
 }
 return drawn;
}
