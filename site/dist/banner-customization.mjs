import {PLAYER_PALETTES,PLAYER_PALETTE_IDS} from './player-palette.mjs';
import {BANNER_NAME_LIMIT,bannerIdentity,validateBannerDraft} from './banner-customization-model.mjs';
import {playerBannerSvg} from './player-banner-render.mjs';
import {castlePreviewSvg} from './castle-presentation.mjs';
import {selectedCastle} from './castle-loadout-model.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/** Hall owns navigation; this component owns one disposable preview. The host
 * alone commits validated identity to the existing profile/checkpoint path. */
export function createBannerCustomizationUI({document,getState,onApply,onApplied=()=>{}}){
 const $=id=>document.querySelector('#'+id),root=$('hallBannerEditor'),hall=$('intro'),scroller=hall.querySelector('.hall-orders-scroll');
 const covered=[$('hallHome'),$('hallBrowse'),$('trainingEntry'),hall.querySelector('.hall-launch')];
 let session=null,serial=0,cardSignature='';
 function leave({restoreFocus=false,message=''}={}){
  if(!session)return false;
  const scroll=session.scroll,coveredState=session.coveredState;session=null;serial++;root.classList.add('hidden');root.innerHTML='';hall.removeAttribute('data-banner-editing');
  for(const [node,inert] of coveredState){node.classList.remove('banner-obscured');node.inert=inert;}
  if(restoreFocus){scroller.scrollTop=scroll;$('hallCustomizeBanner').focus?.({preventScroll:true});}
  if(message)$('hallBannerStatus').textContent=message;
  return true;
 }
 function current(token){
  if(!session||session.token!==token)return false;
  const state=getState();
  if(!state.available||state.readOnly||state.profile!==session.profile||state.battle!==session.battle||state.destination!==session.destination||state.profile.name!==session.original.name||state.profile.paletteId!==session.original.paletteId){leave();return false;}
  return true;
 }
 function sync(){
  const state=getState(),p=state.profile;if(!p)return;
  if(session)current(session.token);
  const signature=JSON.stringify([p.name,p.paletteId,state.destination,state.scopeNote,state.readOnly]);
  if(signature===cardSignature)return;cardSignature=signature;
  $('hallBannerArt').innerHTML=playerBannerSvg(p.paletteId);$('hallBannerName').textContent=p.name||'Unnamed banner';$('hallBannerColors').textContent=`${PLAYER_PALETTES[p.paletteId].name} · Ally double-chevron`;
  $('hallBannerScope').textContent=state.readOnly?'This journey is complete. Prepare another field or banner to customize.':state.scopeNote;
  $('hallCustomizeBanner').disabled=!!state.readOnly;$('hallBannerStatus').textContent='';
 }
 function open(){
  const state=getState();if(!state.available||state.readOnly)return false;
  leave();
  const original=bannerIdentity(state.profile),token=++serial;
  session={token,profile:state.profile,battle:state.battle,destination:state.destination,original,draft:{...original},scroll:scroller.scrollTop||0,coveredState:covered.map(node=>[node,!!node.inert])};
  hall.setAttribute('data-banner-editing','true');for(const node of covered){node.classList.add('banner-obscured');node.inert=true;}root.classList.remove('hidden');
  root.innerHTML=`<header class="banner-editor-heading"><div><span class="eyebrow">YOUR COMPANY STANDARD · FREE</span><h2 id="bannerEditorTitle">Customize your banner</h2></div><button type="button" id="bannerBack">Back to Hall</button></header><p id="bannerScopeNote">${esc(state.scopeNote)} Changes remain a preview until you choose Apply.</p><div class="banner-editor-grid"><section class="banner-live-preview" aria-label="Live banner preview"><div id="bannerPreviewStandard" class="banner-preview-standard" aria-hidden="true"></div><div class="banner-preview-identity"><span class="eyebrow">PREVIEW · ALLY</span><h3 id="bannerPreviewName"></h3><p id="bannerPreviewColors"></p><span class="banner-fixed-cue">Double-chevron · your allied company</span></div><div class="banner-keep-preview"><div id="bannerPreviewKeep" aria-hidden="true"></div><p>Your selected keep</p></div></section><section class="banner-editor-controls" aria-label="Banner identity"><label for="bannerName">Banner name</label><input id="bannerName" type="text" value="${esc(original.name)}" maxlength="${BANNER_NAME_LIMIT}" autocomplete="off" spellcheck="false" aria-describedby="bannerNameHelp bannerNameError"><p id="bannerNameHelp">The name shown in Hall, Profiles and your saves. New names: 1–${BANNER_NAME_LIMIT} characters.</p><p id="bannerNameError" role="status" aria-live="polite"></p><fieldset><legend>Company colors</legend><div class="banner-palette-choices">${PLAYER_PALETTE_IDS.map(id=>`<button type="button" class="banner-palette-choice" data-banner-palette="${id}" aria-pressed="${original.paletteId===id}"><span class="banner-palette-art" aria-hidden="true">${playerBannerSvg(id)}</span><span><strong>${esc(PLAYER_PALETTES[id].name)}</strong><small>${esc(PLAYER_PALETTES[id].description)}</small><span class="banner-palette-selected" aria-hidden="true">${original.paletteId===id?'✓ Selected':'Preview colors'}</span></span></button>`).join('')}</div></fieldset></section></div><div class="banner-accessibility-note"><strong>Your allies keep their double-chevron.</strong><p>Colors reach your keep cloth, flag, hero and allied cloth. Enemy colors, elemental creatures and health/status cues stay distinct. Cosmetic only: no stat, rank or gold changes. Deck imports do not change your banner.</p></div><footer class="banner-editor-actions"><p id="bannerDraftStatus" role="status" aria-live="polite">Preview only. Your banner is unchanged.</p><button type="button" id="bannerCancel">Cancel</button><button type="button" id="bannerApply" class="primary" disabled>Apply banner</button></footer>`;
  const paint=()=>{
   if(!current(token))return;
   const {draft}=session;let valid=null,error='';try{valid=validateBannerDraft(draft,original);}catch(e){error=e.message;}
   $('bannerPreviewStandard').innerHTML=playerBannerSvg(draft.paletteId);$('bannerPreviewName').textContent=draft.name.trim()||'Your banner';$('bannerPreviewColors').textContent=PLAYER_PALETTES[draft.paletteId].name;
   $('bannerPreviewKeep').innerHTML=castlePreviewSvg(selectedCastle(state.profile),{baseHp:8000+state.profile.rank*400,paletteId:draft.paletteId});
   $('bannerNameError').textContent=error;$('bannerName').setAttribute('aria-invalid',String(!!error));
   $('bannerApply').disabled=!valid||valid.name===original.name&&valid.paletteId===original.paletteId;
   for(const button of root.querySelectorAll('[data-banner-palette]')){const selected=button.getAttribute('data-banner-palette')===draft.paletteId;button.setAttribute('aria-pressed',String(selected));button.querySelector('.banner-palette-selected').textContent=selected?'✓ Selected':'Preview colors';}
  };
  $('bannerName').oninput=()=>{if(!current(token))return;session.draft.name=$('bannerName').value;paint();};
  for(const button of root.querySelectorAll('[data-banner-palette]'))button.onclick=()=>{if(!current(token))return;session.draft.paletteId=button.getAttribute('data-banner-palette');paint();$('bannerDraftStatus').textContent=`${PLAYER_PALETTES[session.draft.paletteId].name} preview. Apply to keep these changes.`;};
  const cancel=()=>{if(current(token))leave({restoreFocus:true,message:'Preview cancelled. Your banner is unchanged.'});};
  $('bannerBack').onclick=cancel;$('bannerCancel').onclick=cancel;
  $('bannerApply').onclick=()=>{
   if(!current(token))return;
   let value;try{value=validateBannerDraft(session.draft,original);}catch{paint();return;}
   if(value.name===original.name&&value.paletteId===original.paletteId)return;
   const result=onApply(value,{profile:session.profile,battle:session.battle,destination:session.destination,original});
   if(!result?.ok){$('bannerDraftStatus').textContent=result?.message??'Your banner could not be applied. Cancel and reopen to try again.';return;}
   leave({restoreFocus:true});cardSignature='';onApplied();sync();$('hallBannerStatus').textContent=`${value.name||'Your banner'} · ${PLAYER_PALETTES[value.paletteId].name} applied to this profile. ${result.message??''}`;
  };
  paint();scroller.scrollTop=0;$('bannerName').focus?.({preventScroll:true});return true;
 }
 // Capture before Hall's underlying card-inspection Escape handler, including
 // when focus has moved to the shared navigation outside this editor.
 hall.addEventListener('keydown',event=>{if(event.key==='Escape'&&session){if(current(session.token))leave({restoreFocus:true,message:'Preview cancelled. Your banner is unchanged.'});event.stopImmediatePropagation?.();event.stopPropagation?.();event.preventDefault?.();}},true);
 $('hallCustomizeBanner').onclick=open;
 return {sync,open,leave,get isOpen(){return !!session;},cancel(){if(session&&current(session.token))return leave({restoreFocus:true,message:'Preview cancelled. Your banner is unchanged.'});return false;}};
}
