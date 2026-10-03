/** Pointer-only view adapter: pointer capture and hit testing, no gameplay state.
 * Cards use a dedicated touch handle so the gallery can still scroll normally.
 * Occupied slots drag anywhere; all operations have native-button tap fallback.
 */
export function createLoadoutDrag({root,getAbility,onDrop,onHint=()=>{},onStart=()=>{},onCancel=()=>{},onBar=()=>{}}){
 const doc=root.ownerDocument;
 let held=null,ghost=null,target=null,frame=null,barHover=null,suppressClickUntil=0;
 const inside=node=>{for(let n=node;n;n=n.parentNode)if(n===root)return true;return false;};
 const closest=(node,attribute)=>{for(let n=node;n&&n!==root;n=n.parentNode)if(n.getAttribute?.(attribute)!==null&&n.getAttribute?.(attribute)!==undefined)return n;return null;};
 const slotAt=(x,y)=>{const slot=closest(doc.elementFromPoint?.(x,y),'data-drop-slot'),index=Number(slot?.getAttribute('data-drop-slot'));return slot&&inside(slot)&&!slot.disabled&&Number.isInteger(index)&&index>=0&&index<30?slot:null;};
 const resetTarget=()=>{target?.classList.remove('is-drop-target');target?.removeAttribute?.('data-drop-action');target=null;};
 const hit=()=>{
  if(!held?.active)return;
  const next=slotAt(held.x,held.y);
  if(next!==target){resetTarget();target=next;target?.classList.add('is-drop-target');if(target){const occupant=target.getAttribute('data-drag-ability');target.setAttribute('data-drop-action',occupant===held.id?'Return':!occupant?'Place':held.sourceSlot===null?'Replace':'Swap');}onHint(held.id,target?Number(target.getAttribute('data-drop-slot')):null);}
  const candidate=closest(doc.elementFromPoint?.(held.x,held.y),'data-loadout-bar'),tab=candidate&&inside(candidate)?candidate:null;
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
  root.classList.remove('is-dragging');old?.source.classList.remove('is-drag-source');old?.visual.classList.remove('is-card-lifted');
  if(old&&old.captureOwner.hasPointerCapture?.(old.pointerId))old.captureOwner.releasePointerCapture(old.pointerId);
  return old;
 }
 function cancel(){const old=cleanup();if(old?.active){suppressClickUntil=performance.now()+400;onCancel(old.id);}return !!old?.active;}
 root.addEventListener('pointerdown',event=>{
  if(held||event.button!==0||event.isPrimary===false)return;
  const source=closest(event.target,'data-drag-ability');if(!source)return;
  if(event.pointerType==='touch'&&source.getAttribute('data-drag-handle')!=='true'&&!closest(event.target,'data-drag-handle'))return;
  const id=source.getAttribute('data-drag-ability');if(!getAbility(id))return;
  let visual=source;for(let node=source;node&&node!==root;node=node.parentNode)if(node.classList?.contains('loadout-collection-card')){visual=node;break;}
  const rect=visual.getBoundingClientRect(),slot=closest(source,'data-drop-slot');
  held={id,source,visual,sourceSlot:slot?.getAttribute('data-drop-slot')??(Number(source.getAttribute('data-card-binding'))>=0?source.getAttribute('data-card-binding'):null),rect,offsetX:event.clientX-rect.left,offsetY:event.clientY-rect.top,captureOwner:source,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,active:false};
  source.setPointerCapture?.(event.pointerId);
 });
 root.addEventListener('pointermove',event=>{
  if(!held||event.pointerId!==held.pointerId)return;
  held.x=event.clientX;held.y=event.clientY;
  if(!held.active&&Math.hypot(held.x-held.startX,held.y-held.startY)<7)return;
  if(!held.active){
   held.active=true;held.captureOwner=root;root.setPointerCapture?.(held.pointerId);
   ghost=createCardLift(held.visual,getAbility(held.id),doc);ghost.classList.add('loadout-drag-ghost');ghost.setAttribute('aria-hidden','true');ghost.inert=true;
   Object.assign(ghost.style,{width:`${held.rect.width}px`,height:`${held.rect.height}px`,transformOrigin:`${held.offsetX}px ${held.offsetY}px`});
   root.classList.add('is-dragging');held.source.classList.add('is-drag-source');held.visual.classList.add('is-card-lifted');
   (doc.body??doc.querySelector('body')).appendChild(ghost);onStart(held.id);frame=requestAnimationFrame(scrollFrame);
  }
  ghost.style.left=`${held.x-held.offsetX}px`;ghost.style.top=`${held.y-held.offsetY}px`;
  hit();event.preventDefault();
 });
 root.addEventListener('pointerup',event=>{
  if(!held||event.pointerId!==held.pointerId)return;
  const destination=held.active?slotAt(event.clientX,event.clientY):null,old=cleanup();
  if(!old.active)return;
  suppressClickUntil=performance.now()+400;
  if(destination){const index=Number(destination.getAttribute('data-drop-slot'));onDrop(old.id,index);const placed=root.querySelector?.(`[data-drop-slot="${index}"]`);placed?.classList.add('is-card-settled');}else onCancel(old.id);
  event.preventDefault();
 });
 for(const type of ['pointercancel','lostpointercapture'])root.addEventListener(type,event=>{if(event.pointerId===held?.pointerId&&(type==='pointercancel'||event.target===held.captureOwner))cancel();});
 root.addEventListener('click',event=>{if(performance.now()<suppressClickUntil){event.preventDefault();event.stopImmediatePropagation();}},true);
 root.addEventListener('keydown',event=>{if(event.key==='Escape'&&cancel()){event.preventDefault();event.stopPropagation();}});
 globalThis.window?.addEventListener('blur',cancel);
 globalThis.window?.addEventListener('resize',cancel);
 globalThis.window?.addEventListener('orientationchange',cancel);
 doc.addEventListener?.('visibilitychange',()=>{if(doc.hidden)cancel();});
 root.addEventListener('dragstart',event=>{if(closest(event.target,'data-drag-ability'))event.preventDefault();});
 return {cancel,get active(){return !!held?.active;}};
}

/** Clone the card the player actually picked up, including its loaded artwork.
 * Freeze computed styles because the lifted card leaves its scoped panel.
 * This runs once per gesture, never per frame; catalog rendering stays bounded. */
export function createCardLift(source,info,doc=source.ownerDocument){
 const clone=source.cloneNode?.(true)??doc.createElement('div');
 if(source.cloneNode){
  const originals=[source,...source.querySelectorAll('*')],copies=[clone,...clone.querySelectorAll('*')];
  originals.forEach((node,index)=>{const copy=copies[index],style=globalThis.getComputedStyle?.(node);
   if(style&&copy.style?.setProperty)for(const key of style)copy.style.setProperty(key,style.getPropertyValue(key));
   for(const name of ['id','name','aria-labelledby','aria-describedby','data-drag-ability','data-drop-slot'])copy.removeAttribute?.(name);
   copy.setAttribute('tabindex','-1');
  });
 }else{const art=doc.createElement('span'),title=doc.createElement('strong');art.innerHTML=info?.icon??'';title.textContent=info?.name??'';clone.appendChild(art);clone.appendChild(title);}
 // Outer geometry is driven by the pointer, not the source grid or sticky pane.
 Object.assign(clone.style,{position:'fixed',margin:'0',minWidth:'0',minHeight:'0',maxWidth:'none',maxHeight:'none',pointerEvents:'none',zIndex:'9999',transition:'none',animation:'none',opacity:'1',transform:'scale(1.035) rotate(-1.5deg)',boxShadow:'0 22px 38px #0009, 0 0 0 2px #efd092',overflow:'hidden'});
 if(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)clone.style.transform='none';
 return clone;
}
