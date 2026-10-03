import {ARMY_RALLY_POSITIONS} from './engine/army-orders.mjs';
const POSITION_LABELS=Object.freeze({rear:'Rear',center:'Center',forward:'Forward'});
const POSITION_HELP=Object.freeze({rear:'Protect home ground',center:'Contest midfield',forward:'Pressure the enemy keep'});
export const armyRallyPositionLabel=position=>POSITION_LABELS[position]??POSITION_LABELS.rear;
/** Compact, native-button ground-line command; no global keyboard interception. */
export function armyOrderStatus(battle){
 const order=battle.armyOrder,label=armyRallyPositionLabel(order.position);
 return order.mode==='rally'?`${label} line holding · ${order.affected} frontline troops. Advance releases the line.`:`Advancing · ${label.toLowerCase()} line ready for Rally.`;
}
function canChangeOrder(state,shownBattle){
 const b=state.battle;
 return !!b&&state.active&&!state.readOnly&&state.started&&b===shownBattle&&!b.outcome&&!b.summary;
}
function canRally(b){return b.badCastle.hp>0&&b.hero.hp>0&&!b.hero.dead;}
export function createArmyOrdersUI({root,getState,onChanged=()=>{}}){
 root.innerHTML='<div class="army-order-heading"><strong>Ground line</strong><span>One order for your frontline</span></div><div class="army-order-options" role="group" aria-label="Ground-line order"><button type="button" data-army-order="advance">Advance</button><button type="button" data-army-order="rally">Rally line</button></div><div class="army-rally-positions" role="group" aria-label="Choose a fixed rally line; selecting a position orders Rally">'+ARMY_RALLY_POSITIONS.map(position=>`<button type="button" data-rally-position="${position}" aria-label="Rally ${POSITION_LABELS[position]} line: ${POSITION_HELP[position].toLowerCase()}"><strong>${POSITION_LABELS[position]}</strong><span>${POSITION_HELP[position]}</span></button>`).join('')+'</div><p class="army-order-status" aria-live="polite"></p><details class="army-order-rules"><summary aria-label="How ground-line orders work">?</summary><p class="army-order-help">Choose Rear to regroup near home, Center to contest midfield, or Forward to stage below the enemy keep. Choosing a position immediately orders Rally. Each line stays fixed when your hero moves. Troops fight nearby, archers shoot and priests heal. Flag carriers keep moving. Flyers, siege and Gorath keep their own orders. Advance resumes the push and remembers your chosen line; the line releases when the enemy keep falls.</p></details>';
 const buttons=[...root.querySelectorAll('[data-army-order]')],positions=[...root.querySelectorAll('[data-rally-position]')],status=root.querySelector('.army-order-status');
 let shownBattle=null;
 function render(){
  const state=getState(),b=state.battle;shownBattle=b;
  const disabled=!canChangeOrder(state,shownBattle),position=b.armyOrder.position??'rear';
  for(const button of buttons){const mode=button.getAttribute('data-army-order');button.disabled=disabled||mode==='rally'&&!canRally(b);button.setAttribute('aria-pressed',String(mode===b.armyOrder.mode));}
  for(const button of positions){button.disabled=disabled||!canRally(b);button.setAttribute('aria-pressed',String(button.getAttribute('data-rally-position')===position));}
  status.textContent=state.readOnly?'Ground-line orders are unavailable during guided drills.':!state.started?'Begin the battle to issue a ground-line order.':b.outcome||b.summary?'Battle settled · ground-line order cleared.':!canRally(b)?'The line is released · troops finish the battle.':armyOrderStatus(b)+(b.paused?' Movement resumes after you leave this panel.':'');
 }
 function issue(mode,position){const state=getState();if(!canChangeOrder(state,shownBattle))return;if(state.battle.setArmyOrder(mode,position)){onChanged();render();}}
 for(const button of buttons)button.addEventListener('click',()=>issue(button.getAttribute('data-army-order')));
 for(const button of positions)button.addEventListener('click',()=>issue('rally',button.getAttribute('data-rally-position')));
 return {render};
}
/** Native 44px live selector: one extra control next to the quick R toggle.
 * The host owns live/pause guards; panel orders deliberately remain usable paused. */
export function createLiveRallyPositionUI({root,getState,onChanged=()=>{}}){
 root.innerHTML='<select class="live-rally-position-select" aria-label="Rally position. Choosing Rear, Center or Forward immediately orders Rally." title="Choose a fixed rally line">'+ARMY_RALLY_POSITIONS.map(position=>`<option value="${position}">${POSITION_LABELS[position]} line</option>`).join('')+'</select>';
 const select=root.querySelector('select');let shownBattle=null,shownPosition=null;
 function render(force=false){
  const state=getState(),b=state.battle,position=b.armyOrder.position??'rear';
  if(force||b!==shownBattle||position!==shownPosition)select.value=position;
  shownBattle=b;shownPosition=position;
  root.classList[state.visible===false?'add':'remove']('hidden');
  select.disabled=!canChangeOrder(state,shownBattle)||b.paused||!canRally(b);
  const label=armyRallyPositionLabel(b.armyOrder.position),holding=b.armyOrder.mode==='rally';
  root.setAttribute('data-holding',String(holding));
  select.setAttribute('aria-label',`${label} rally line ${holding?'holding':'ready'}. Choose Rear, Center or Forward to rally there.`);
  select.setAttribute('title',`${label} line: ${POSITION_HELP[b.armyOrder.position??'rear']}. Choosing a line orders Rally.`);
 }
 select.addEventListener('change',()=>{
  const state=getState(),position=select.value;
  if(canChangeOrder(state,shownBattle)&&!state.battle.paused&&state.visible!==false&&canRally(state.battle)&&state.battle.setArmyOrder('rally',position))onChanged();
  render(true);
 });
 return {render};
}
/** Draw in world coordinates after terrain, before units; decorative only. */
export function drawArmyOrderMarker(ctx,battle,scale=1){
 const {mode,anchorX:x,position}=battle.armyOrder;if(mode!=='rally'||!Number.isFinite(x))return false;
 const y=battle.elevationAt(x);if(!Number.isFinite(y))return false;
 const k=1/Math.max(.25,Math.min(1,Number.isFinite(scale)?scale:1));
 ctx.save();ctx.translate(x,y);ctx.scale(k,k);ctx.strokeStyle='#a5dfd6';ctx.fillStyle='#142e36';ctx.lineWidth=2;
 ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-76);ctx.stroke();
 ctx.beginPath();ctx.moveTo(0,-76);ctx.lineTo(76,-76);ctx.lineTo(67,-35);ctx.lineTo(0,-35);ctx.closePath();ctx.fill();ctx.stroke();
 ctx.fillStyle='#d1fff2';ctx.font='bold 13px sans-serif';ctx.textAlign='left';ctx.fillText('RALLY',6,-59);ctx.font='10px sans-serif';ctx.fillText(armyRallyPositionLabel(position).toUpperCase(),6,-44);
 ctx.beginPath();ctx.moveTo(-24/k,-2);ctx.lineTo(24/k,-2);ctx.stroke();ctx.restore();return true;
}
