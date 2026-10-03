import {CONTROL_ACTIONS,DEFAULT_CONTROL_BINDINGS,controlKeyLabel,controlEventKey,controlBindingError,isControlTextTarget,isControlComposition,hasControlModifier,isFixedControlDigit} from './control-bindings.mjs';
const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
/** Transactional editor. Its caller owns modal visibility and gameplay gates. */
export function createControlSettings({root,controls,onApply=()=>{},onCancel=()=>{}}){
 const $=id=>root.querySelector('#'+id);let draft=null,capture=null,message='';
 $('controlBindingRows').innerHTML=CONTROL_ACTIONS.map(item=>`<div class="control-row"><div><strong>${esc(item.label)}</strong><small>${esc(item.touch)}</small></div><button id="control-${item.id}" data-control-bind="${item.id}" type="button" aria-describedby="controlCaptureHelp"><kbd></kbd><span>Change</span></button></div>`).join('');
 function render(){
  for(const item of CONTROL_ACTIONS){const button=$('control-'+item.id),waiting=capture===item.id;button.querySelector('kbd').textContent=waiting?'Press a key…':controlKeyLabel((draft??controls.bindings)[item.id]);button.querySelector('span').textContent=waiting?'Listening':'Change';button.setAttribute('aria-pressed',String(waiting));button.setAttribute('aria-label',`${item.label}: ${controlKeyLabel((draft??controls.bindings)[item.id])}. ${waiting?'Press a new key or Escape to cancel.':'Change keyboard binding.'}`);}
  $('controlCaptureCancel').classList[capture?'remove':'add']('hidden');$('applyControls').disabled=!!capture;$('controlStatus').textContent=message;
 }
 function cancelCapture(){if(!capture)return false;const id=capture;capture=null;message='Key capture cancelled. Your draft is unchanged.';render();$('control-'+id).focus?.();return true;}
 for(const item of CONTROL_ACTIONS)$('control-'+item.id).onclick=()=>{if(!draft)return;capture=item.id;message=`Choose a key for ${item.label.toLowerCase()}. Escape cancels; Tab returns to navigation.`;render();$('control-'+item.id).focus?.();};
 $('controlCaptureCancel').onclick=cancelCapture;
 $('resetControls').onclick=()=>{if(!draft)return;draft={...DEFAULT_CONTROL_BINDINGS};capture=null;message='Default keys restored in this draft. Apply controls to keep them, or Cancel to discard.';render();};
 $('applyControls').onclick=()=>{if(!draft||capture)return;const result=controls.apply(draft);message=result.message;render();if(result.ok){draft=null;onApply(result);}};
 for(const id of ['cancelControls','closeControls'])$(id).onclick=onCancel;
 return {
  begin(){draft=controls.bindings;capture=null;message=controls.message||'Change a key, then apply your controls. These preferences are only for this browser.';render();},
  discard(){draft=null;capture=null;},
  cancelCapture,
  handleKey(event){
   if(!draft||!capture||isControlTextTarget(event.target)||isControlComposition(event))return false;
   const key=controlEventKey(event);
   if(event.repeat){if(!hasControlModifier(event))event.preventDefault();return true;}
   if(key==='escape'){event.preventDefault();cancelCapture();return true;}
   if(key==='tab'){cancelCapture();return false;}
   if(hasControlModifier(event)){message='Use a single key without Shift, Ctrl, Alt, or Command. Browser shortcuts stay available.';render();return true;}
   const error=isFixedControlDigit(event)?'The top-row number keys are reserved for ability slots 1–9, then 0, on every keyboard layout.':controlBindingError(draft,capture,key);
   if(error){message=error;render();return true;}
   event.preventDefault();const id=capture;draft[id]=key;capture=null;message=`${CONTROL_ACTIONS.find(item=>item.id===id).label} is set to ${controlKeyLabel(key)} in this draft. Apply controls to keep it.`;render();$('control-'+id).focus?.();return true;
  }
 };
}
