/** Dedicated castle slot and draft-only heraldry inside the existing Build
 * disclosure. The host owns every commit; no key binding, purchase or tick here. */
import {CASTLE_CATALOG} from './engine/castle-catalog.mjs';
import {selectedCastle,previewCastleEquip} from './castle-loadout-model.mjs';
import {castleCardIdentity,castlePreviewSvg} from './castle-presentation.mjs';
import {PLAYER_PALETTE_IDS,PLAYER_PALETTES,validatePlayerPaletteId} from './player-palette.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createCastleLoadoutUI({root,getState,onEquip,onPaletteApply,onFindCastles=()=>{}}){
 let identity=null,draft=null,signature='';
 const $=id=>root.querySelector('#'+id);
 const message=text=>{const node=$('castleLoadoutStatus');if(node)node.textContent=text;};
 function leave(){identity=null;draft=null;signature='';}
 function render(){
  const {profile,started,summary,readOnly=false}=getState();
  if(identity!==profile){identity=profile;draft=profile.paletteId;signature='';}
  const selection=selectedCastle(profile),baseHp=8000+profile.rank*400;
  const next=JSON.stringify([selection,[...profile.castleLevels],profile.paletteId,draft,started,summary,readOnly,profile.rank]);
  if(signature===next)return;signature=next;
  const cards=Object.values(CASTLE_CATALOG).map(item=>{
   const choice={id:item.id,level:1},state=previewCastleEquip(choice,profile,{started,summary}),facts=castleCardIdentity(choice,{baseHp});
   const current=selection.id===item.id,disabled=readOnly||started&&!summary||!state.canEquip;
   return `<article class="castle-slot-card" data-castle="${item.id}"><div class="castle-slot-preview" aria-hidden="true">${castlePreviewSvg(choice,{baseHp,paletteId:profile.paletteId})}</div><div><h4>${esc(item.name)}</h4><p>${esc(facts.summary)}</p><p class="footnote">${esc(facts.facts[1].detail)} ${esc(facts.facts[2].value)}</p><button id="castleEquip-${item.id}" aria-label="${state.missing?'Not owned: ':'Equip '}${esc(item.name)}" aria-pressed="${current}" title="${current?(summary?'Next castle':'Equipped castle'):''}" ${disabled?'disabled':''}>${state.missing?'Not owned':`Equip ${esc(item.name)}`}${current?' <span aria-hidden="true">✓</span>':''}</button></div></article>`;
  }).join('');
  root.innerHTML=`<section class="castle-slot" aria-labelledby="castleSlotTitle"><h3 id="castleSlotTitle">${summary?'Next castle':'Your castle slot'}</h3><p class="footnote">Separate from all 30 ability keys. Changes apply before Start or after settlement.</p><div class="castle-slot-cards">${cards}</div><p class="footnote">Height changes firing angles and terrain clearance, not guaranteed bow range. Archers enter available shelters naturally. Keep resistance and army costs stay unchanged.</p><button id="castleFindCatalog">Find castles in catalog</button><p id="castleLoadoutStatus" role="status" aria-live="polite">${readOnly?'This attempt is complete. Prepare another field to edit.':started&&!summary?'Castle changes are locked for this field. Your ability keys can still be edited.':''}</p></section><section class="player-heraldry" aria-labelledby="playerHeraldryTitle"><h3 id="playerHeraldryTitle">Heraldry · free</h3><label for="playerPalette">Player colors</label><select id="playerPalette" ${readOnly?'disabled':''}>${PLAYER_PALETTE_IDS.map(id=>`<option value="${id}" ${draft===id?'selected':''}>${esc(PLAYER_PALETTES[id].name)}</option>`).join('')}</select><div id="playerPalettePreview" class="player-palette-preview" aria-label="Heraldry preview"></div><p class="footnote">Cosmetic only. Ally chevrons, enemy colors and elemental/status cues stay distinct. Saved with this profile; importing a deck does not change it.</p><div class="player-palette-actions"><button id="applyPlayerPalette" ${readOnly||draft===profile.paletteId?'disabled':''}>Apply colors</button><button id="cancelPlayerPalette" ${draft===profile.paletteId?'disabled':''}>Cancel preview</button></div><p id="playerPaletteStatus" role="status" aria-live="polite"></p></section>`;
  const paintPreview=()=>{$('playerPalettePreview').innerHTML=castlePreviewSvg(selection,{baseHp,paletteId:draft});$('playerPalettePreview').setAttribute('aria-label',`${PLAYER_PALETTES[draft].name} preview. Ally double-chevron. No stat changes.`);};
  paintPreview();
  for(const item of Object.values(CASTLE_CATALOG))$('castleEquip-'+item.id).onclick=()=>{
   const latest=getState();if(latest.profile!==profile||latest.readOnly||latest.started&&!latest.summary)return;
   const choice=previewCastleEquip({id:item.id,level:1},profile,latest);if(!choice.canEquip||!choice.changed)return;
   const result=onEquip({id:item.id,level:1},{profile});signature='';render();message(result?.ok?`${item.name} ${latest.summary?'selected for the next field':'equipped'}. Ability keys are unchanged.`:result?.message??result?.blockers?.join(' ')??'This castle could not be changed.');
   // The selected choice stays focusable. Preserve this card's focus and the
   // independently scrolled panes; choosing it again is a strict no-op above.
   $('castleEquip-'+item.id)?.focus?.({preventScroll:true});
  };
  $('castleFindCatalog').onclick=()=>{if(getState().profile===profile)onFindCastles();};
  $('playerPalette').onchange=()=>{if(getState().profile!==profile||getState().readOnly)return;try{draft=validatePlayerPaletteId($('playerPalette').value);paintPreview();$('applyPlayerPalette').disabled=draft===profile.paletteId;$('cancelPlayerPalette').disabled=draft===profile.paletteId;$('playerPaletteStatus').textContent='Preview only. Apply to keep these colors.';}catch{draft=profile.paletteId;signature='';render();}};
  $('cancelPlayerPalette').onclick=()=>{if(getState().profile!==profile)return;draft=profile.paletteId;signature='';render();$('playerPaletteStatus').textContent='Preview cancelled. Colors are unchanged.';$('playerPalette').focus?.();};
  $('applyPlayerPalette').onclick=()=>{const latest=getState();if(latest.profile!==profile||latest.readOnly)return;const value=validatePlayerPaletteId(draft),result=onPaletteApply(value,{profile});signature='';render();$('playerPaletteStatus').textContent=result?.ok?`${PLAYER_PALETTES[value].name} applied. No stat changes.`:'Colors could not be applied here.';$('playerPalette').focus?.();};
 }
 return {render,leave};
}
