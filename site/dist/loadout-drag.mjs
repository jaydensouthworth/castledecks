/** Pointer-only view adapter: pointer capture and hit testing, no gameplay state.
 * Cards use a dedicated touch handle so the gallery can still scroll normally.
 * Occupied slots drag anywhere; all operations have native-button tap fallback.
 */
export function createLoadoutDrag({root,getAbility,onDrop,onHint=()=>{},onStart=()=>{},onCancel=()=>{},onBar=()=>{}}){
 const doc=root.ownerDocument;
 let held=null,ghost=null,target=null,frame=null,barHover=null,suppressClickUntil=0;
 const closest=(node,attribute)=>{for(let n=node;n&&n!==root;n=n.parentNode)if(n.getAttribute?.(attribute)!==null&&n.getAttribute?.(attribute)!==undefined)return n;return null;};
 const slotAt=(x,y)=>closest(doc.elementFromPoint?.(x,y),'data-drop-slot');
 const resetTarget=()=>{target?.classList.remove('is-drop-target');target=null;};
 const hit=()=>{
  if(!held?.active)return;
  const next=slotAt(held.x,held.y);
  if(next!==target){resetTarget();target=next;target?.classList.add('is-drop-target');onHint(held.id,target?Number(target.getAttribute('data-drop-slot')):null);}
  const tab=closest(doc.elementFromPoint?.(held.x,held.y),'data-loadout-bar');
  const bar=tab?Number(tab.getAttribute('data-loadout-bar')):null;
  if(bar!==barHover?.bar)barHover=bar===null?null:{bar,since:performance.now()};
  else if(barHover&&!barHover.done&&performance.now()-barHover.since>600){barHover.done=true;onBar(bar);resetTarget();}
 };
 const scrollFrame=()=>{
  if(!held?.active)return;
  const element=doc.elementFromPoint?.(held.x,held.y);
  let scrolled=false;
  for(let node=element;node&&node!==root;node=node.parentNode){
   if(node.scrollHeight>node.clientHeight+1&&node.getAttribute?.('data-loadout-scroll')!==null){
    const r=node.getBoundingClientRect(),edge=Math.min(40,r.height/4);
    const speed=held.y<r.top+edge?-Math.ceil((r.top+edge-held.y)/5):held.y>r.bottom-edge?Math.ceil((held.y-r.bottom+edge)/5):0;
    const before=node.scrollTop;if(speed)node.scrollTop+=Math.max(-14,Math.min(14,speed));
    if(node.scrollTop!==before){scrolled=true;break;}
   }
  }
  if(scrolled||barHover)hit();
  frame=requestAnimationFrame(scrollFrame);
 };
 function cleanup(){
  const old=held;held=null;
  if(frame!==null){globalThis.cancelAnimationFrame?.(frame);frame=null;}
  resetTarget();barHover=null;ghost?.remove?.();ghost=null;
  root.classList.remove('is-dragging');old?.source.classList.remove('is-drag-source');
  if(old&&old.captureOwner.hasPointerCapture?.(old.pointerId))old.captureOwner.releasePointerCapture(old.pointerId);
  return old;
 }
 function cancel(){const old=cleanup();if(old?.active){suppressClickUntil=performance.now()+400;onCancel(old.id);}return !!old?.active;}
 root.addEventListener('pointerdown',event=>{
  if(held||event.button!==0||event.isPrimary===false)return;
  const source=closest(event.target,'data-drag-ability');if(!source)return;
  if(event.pointerType==='touch'&&source.getAttribute('data-drag-handle')!=='true'&&!closest(event.target,'data-drag-handle'))return;
  const id=source.getAttribute('data-drag-ability');if(!getAbility(id))return;
  held={id,source,captureOwner:source,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,active:false};
  source.setPointerCapture?.(event.pointerId);
 });
 root.addEventListener('pointermove',event=>{
  if(!held||event.pointerId!==held.pointerId)return;
  held.x=event.clientX;held.y=event.clientY;
  if(!held.active&&Math.hypot(held.x-held.startX,held.y-held.startY)<7)return;
  if(!held.active){
   held.active=true;held.captureOwner=root;root.setPointerCapture?.(held.pointerId);root.classList.add('is-dragging');held.source.classList.add('is-drag-source');
   const info=getAbility(held.id);ghost=doc.createElement('div');ghost.className='loadout-drag-ghost';ghost.setAttribute('aria-hidden','true');ghost.innerHTML=`<span class="skill-icon">${info.icon}</span><span>${info.name}</span>`;
   (doc.body??doc.querySelector('body')).appendChild(ghost);onStart(held.id);frame=requestAnimationFrame(scrollFrame);
  }
  ghost.style.left=`${held.x+14}px`;ghost.style.top=`${held.y-28}px`;
  hit();event.preventDefault();
 });
 root.addEventListener('pointerup',event=>{
  if(!held||event.pointerId!==held.pointerId)return;
  const destination=held.active?slotAt(event.clientX,event.clientY):null,old=cleanup();
  if(!old.active)return;
  suppressClickUntil=performance.now()+400;
  if(destination)onDrop(old.id,Number(destination.getAttribute('data-drop-slot')));else onCancel(old.id);
  event.preventDefault();
 });
 for(const type of ['pointercancel','lostpointercapture'])root.addEventListener(type,event=>{if(event.pointerId===held?.pointerId&&(type==='pointercancel'||event.target===held.captureOwner))cancel();});
 root.addEventListener('click',event=>{if(performance.now()<suppressClickUntil){event.preventDefault();event.stopImmediatePropagation();}},true);
 root.addEventListener('keydown',event=>{if(event.key==='Escape'&&cancel()){event.preventDefault();event.stopPropagation();}});
 globalThis.window?.addEventListener('blur',cancel);
 globalThis.window?.addEventListener('resize',cancel);
 return {cancel,get active(){return !!held?.active;}};
}
