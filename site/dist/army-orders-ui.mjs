/** Compact, native-button ground-line command; no global keyboard interception. */
export function armyOrderStatus(battle){
 const order=battle.armyOrder;
 return order.mode==='rally'?`Ground line holding · ${order.affected} frontline troops. Advance releases the line.`:'Advancing · troops follow their own battle roles.';
}
export function createArmyOrdersUI({root,getState,onChanged=()=>{}}){
 root.innerHTML='<div class="army-order-heading"><strong>Ground line</strong><span>One order for your frontline</span></div><div class="army-order-options" role="group" aria-label="Ground-line order"><button type="button" data-army-order="advance">Advance</button><button type="button" data-army-order="rally">Rally line</button></div><p class="army-order-status" aria-live="polite"></p><details class="army-order-rules"><summary aria-label="How ground-line orders work">?</summary><p class="army-order-help">Rally holds a fixed line ahead of your hero. Troops fight nearby, archers shoot and priests heal. Flag carriers keep moving. Flyers, siege and Gorath keep their own orders. Advance resumes the push; the line releases when the enemy keep falls.</p></details>';
 const buttons=[...root.querySelectorAll('[data-army-order]')],status=root.querySelector('.army-order-status');
 let shownBattle=null;
 function render(){
  const state=getState(),b=state.battle;shownBattle=b;
  const disabled=!state.active||state.readOnly||!state.started||!!b.outcome||!!b.summary;
  for(const button of buttons){const mode=button.getAttribute('data-army-order');button.disabled=disabled||mode==='rally'&&!(b.badCastle.hp>0);button.setAttribute('aria-pressed',String(mode===b.armyOrder.mode));}
  status.textContent=state.readOnly?'Ground-line orders are unavailable during guided drills.':!state.started?'Begin the battle to issue a ground-line order.':b.outcome||b.summary?'Battle settled · ground-line order cleared.':armyOrderStatus(b)+(b.paused?' Movement resumes after you leave this panel.':'');
 }
 for(const button of buttons)button.addEventListener('click',()=>{const state=getState();if(!state.active||state.readOnly||!state.started||state.battle!==shownBattle||state.battle.outcome||state.battle.summary)return;if(state.battle.setArmyOrder(button.getAttribute('data-army-order'))){onChanged();render();}});
 return {render};
}
/** Draw in world coordinates after terrain, before units; decorative only. */
export function drawArmyOrderMarker(ctx,battle,scale=1){
 const {mode,anchorX:x}=battle.armyOrder;if(mode!=='rally'||!Number.isFinite(x))return false;
 const y=battle.elevationAt(x);if(!Number.isFinite(y))return false;
 const k=1/Math.max(.25,Math.min(1,Number.isFinite(scale)?scale:1));
 ctx.save();ctx.translate(x,y);ctx.scale(k,k);ctx.strokeStyle='#a5dfd6';ctx.fillStyle='#142e36';ctx.lineWidth=2;
 ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-68);ctx.stroke();
 ctx.beginPath();ctx.moveTo(0,-68);ctx.lineTo(62,-68);ctx.lineTo(53,-43);ctx.lineTo(0,-43);ctx.closePath();ctx.fill();ctx.stroke();
 ctx.fillStyle='#d1fff2';ctx.font='bold 13px sans-serif';ctx.textAlign='left';ctx.fillText('RALLY',6,-51);
 ctx.beginPath();ctx.moveTo(-24/k,-2);ctx.lineTo(24/k,-2);ctx.stroke();ctx.restore();return true;
}
