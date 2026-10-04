import {defaultControlLabel} from './control-bindings.mjs';
import {modalFocusCandidates} from './modal-focus.mjs';
import {MAX_DECK_PRESETS,captureDeck,previewDeck,exportDeckCode,parseDeckCode,uniqueDeckName,mergeDeckLibraries,validateDeckLibrary} from './deck-presets-model.mjs';
import {SKILLS} from './engine/progression.mjs';
import {COMPANIONS} from './engine/recruitment.mjs';
import {CASTLE_CATALOG} from './engine/castle-catalog.mjs';
import {slotToKey} from './keyboard-layout.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const name=id=>id===null?'Empty':SKILLS[id]?.name??COMPANIONS[id]?.name??CASTLE_CATALOG[id]?.name??id;
const place=slot=>`Bar ${Math.floor(slot/10)+1}, key ${slotToKey(slot%10)}`;
export function createDeckPresetsUI({controlLabel=defaultControlLabel,root,getState,getDecks,setDecks,onApply,onRecoverArrow=()=>({ok:false}),onChange=()=>{},onClose=()=>{},storageMessage=()=>''}){
 const $=id=>root.querySelector('#'+id);let opened=false,identity=null,selected=-1,pending=null,listReturn=null;
 const status=text=>{$('deckStatus').textContent=text;};
 const inert=active=>{for(const child of root.children)if(child!==$('deckPresets'))child.inert=active;};
 function cancelPending(restoreFocus=false){const returnId=pending?.kind==='delete'?'deckDelete':'deckImportPrepare';pending=null;$('deckConfirm').classList.add('hidden');if(restoreFocus)$(returnId).focus?.();}
 function reset(){cancelPending();selected=-1;listReturn=null;$('deckPresetsBody').scrollTop=0;$('deckNewName').value='';$('deckImportCode').value='';$('deckExportCode').value='';$('deckExportArea').classList.add('hidden');status('');}
 function close(notify=false){if(!opened)return false;opened=false;cancelPending();$('deckPresets').classList.add('hidden');inert(false);$('openDeckPresets').focus?.({preventScroll:true});if(notify)onClose();return true;}
 function open(){if(!root.classList.contains('hidden')){opened=true;$('deckPresets').classList.remove('hidden');render();inert(true);$('closeDeckPresets').focus?.();}}
 function selectedDeck(){return getDecks()[selected];}
 function choose(index){
  listReturn={index,scrollTop:$('deckPresetsBody').scrollTop||0};selected=index;cancelPending();render();$('deckRename').value=selectedDeck()?.name??'';
  // Focus the heading, never the name input: a row tap must not open a keyboard.
  const body=$('deckPresetsBody'),detail=$('deckDetail');$('deckTitle').focus?.({preventScroll:true});
  body.scrollTop=Math.max(0,(body.scrollTop||0)+detail.getBoundingClientRect().top-body.getBoundingClientRect().top-8);
 }
 function returnToList(){
  const body=$('deckPresetsBody'),row=$('deckList').querySelector(`[data-deck-index="${listReturn?.index??selected}"]`);
  const scrollTop=listReturn?.scrollTop??Math.max(0,(body.scrollTop||0)+(row?.getBoundingClientRect().top??body.getBoundingClientRect().top)-body.getBoundingClientRect().top-8);
  cancelPending();row?.focus?.({preventScroll:true});body.scrollTop=scrollTop;
 }
 function context(){const state=getState();return {started:state.started,paused:state.battle.paused,summary:!!state.battle.summary,activeCompanion:!!state.battle.companions.unit};}
 function change(decks,message){setDecks(decks);cancelPending();onChange();render();status(message);}
 function safe(action){if(getState().blocked){cancelPending();status('Return from the synthetic field before using saved decks.');return;}try{action();}catch(error){status(error instanceof SyntaxError?'Deck code is not valid JSON. No decks were changed.':error.message||'This deck could not be changed.');}}
 function render(){
  if(!opened)return;
  const {profile,readOnly=false,closeLabel}=getState();$('closeDeckPresets').textContent=closeLabel||'Back to collection';if(identity!==profile){identity=profile;reset();}
  const focusedIndex=root.ownerDocument.activeElement?.getAttribute?.('data-deck-index');
  const decks=getDecks();if(selected>=decks.length)selected=decks.length-1;
  $('deckCount').textContent=`${decks.length} / ${MAX_DECK_PRESETS} saved decks · ${profile.name||'Current profile'}`;
  $('deckStorageNote').textContent=`Decks belong to this profile. ${storageMessage()} Campaign files do not include saved decks; keep a separate deck code.`;
  $('deckSaveCurrent').disabled=decks.length>=MAX_DECK_PRESETS;$('deckRecoverArrow').disabled=readOnly;
  $('deckBowRecovery').classList[profile.skills.some(skill=>skill.binding>=0&&!SKILLS[skill.id]?.summon)?'add':'remove']('hidden');
  $('deckList').innerHTML=decks.length?decks.map((deck,i)=>{const p=previewDeck(deck,profile,context());return `<button data-deck-index="${i}" aria-pressed="${i===selected}"><strong>${esc(deck.name)}</strong><span>${deck.slots.filter(Boolean).length}/30 keys · ${esc(name(deck.castle.id))} · ${deck.companion?esc(name(deck.companion)):'No companion'}${p.missing.length?` · ${p.missing.length} missing`:''}</span></button>`;}).join(''):'<p>No saved decks yet. Arrange your cards, then name and save the full loadout.</p>';
  for(const button of $('deckList').querySelectorAll('[data-deck-index]'))button.onclick=()=>choose(Number(button.getAttribute('data-deck-index')));
  if(focusedIndex!==null&&focusedIndex!==undefined)$('deckList').querySelector(`[data-deck-index="${focusedIndex}"]`)?.focus?.({preventScroll:true});
  if(!$('deckExportArea').classList.contains('hidden'))$('deckExportCode').value=exportDeckCode(decks);
  const deck=selectedDeck();$('deckDetail').classList[deck?'remove':'add']('hidden');$('deckShowExport').disabled=!decks.length;
  if(!deck)return;
  const p=previewDeck(deck,profile,context());$('deckTitle').textContent=deck.name;$('deckApply').disabled=readOnly||!p.canApply||(!p.changes.length&&!p.companionChanged&&!p.castleChanged);$('deckDuplicate').disabled=decks.length>=MAX_DECK_PRESETS;
  $('deckSummary').textContent=`${p.changes.length} key change${p.changes.length===1?'':'s'} · ${p.companionChanged?'Companion changes':'Companion unchanged'} · ${p.castleChanged?'Castle changes':'Castle unchanged'}. Applying replaces all three bars. Cards omitted from this deck remain owned in reserve.`;
  $('deckMissing').textContent=p.missing.length?`Missing: ${p.missing.map(name).join(', ')}. Nothing is bought or partially applied.`:'All referenced cards are owned.';
  $('deckBlockers').textContent=readOnly?'This attempt is over. Inspect or export decks here; prepare a fresh kit before applying or recovering cards.':p.blockers.join(' ');
  $('deckBowWarning').textContent=p.hasBow?'':'This deck has no bow. Battlefield aiming will not fire. Squad keys and the separate companion still work. Basic Arrow stays owned and can be equipped for free.';
  $('deckReturns').textContent=p.returns.length?`Returns to reserve: ${p.returns.map(name).join(', ')}.`:'No equipped ability returns to reserve.';
  $('deckChanges').innerHTML=(p.changes.length?p.changes.map(change=>`<li><strong>${esc(place(change.slot))}</strong><span>${esc(name(change.from))} → ${esc(name(change.to))}</span></li>`).join(''):'<li>No key changes.</li>')+(p.castleChanged?`<li><strong>Castle · dedicated slot</strong><span>${esc(name(p.current.castle.id))} → ${esc(name(deck.castle.id))}</span></li>`:'')+(p.companionChanged?`<li><strong>Companion · separate ${esc(controlLabel('companion'))} slot</strong><span>${esc(name(p.current.companion))} → ${esc(name(deck.companion))}</span></li>`:'');
 }
 $('deckRecoverArrow').onclick=()=>safe(()=>{const result=onRecoverArrow();if(result.ok){render();$('closeDeckPresets').focus?.();status(`Basic Arrow equipped for free on ${place(result.slot)}. Your saved decks are unchanged.`);}else status('Open a paused Loadout and leave an empty key to equip Basic Arrow.');});
 $('deckBackToList').onclick=returnToList;
 $('openDeckPresets').onclick=open;$('closeDeckPresets').onclick=()=>close(true);
 $('deckSaveForm').onsubmit=event=>{event.preventDefault();safe(()=>{const decks=getDecks(),deck=captureDeck(getState().profile,$('deckNewName').value);const next=validateDeckLibrary([...decks,deck]);selected=decks.length;change(next,`“${deck.name}” saved. It contains all 30 keys, the companion and the dedicated castle slot.`);$('deckNewName').value='';$('deckRename').value=deck.name;});};
 $('deckRenameForm').onsubmit=event=>{event.preventDefault();safe(()=>{if(!selectedDeck())return;const decks=getDecks();decks[selected]={...decks[selected],name:$('deckRename').value};change(validateDeckLibrary(decks),'Deck renamed. Its arrangement is unchanged.');});};
 $('deckDuplicate').onclick=()=>safe(()=>{const deck=selectedDeck();if(!deck)return;const decks=getDecks(),copy={...deck,name:uniqueDeckName(deck.name,decks),slots:[...deck.slots]};selected=decks.length;change(validateDeckLibrary([...decks,copy]),`“${copy.name}” duplicated.`);$('deckRename').value=copy.name;});
 $('deckDelete').onclick=()=>{const deck=selectedDeck();if(!deck)return;pending={kind:'delete',profile:getState().profile,index:selected,snapshot:JSON.stringify(getDecks()),name:deck.name};$('deckConfirmText').textContent=`Delete saved deck “${deck.name}”? Its saved arrangement will be removed. Your equipped cards and ownership stay unchanged.`;$('deckConfirmAccept').textContent='Delete saved deck';$('deckConfirm').classList.remove('hidden');$('deckConfirmCancel').focus?.();};
 $('deckApply').onclick=()=>safe(()=>{const deck=selectedDeck();if(!deck)return;const result=onApply(deck);if(result.ok){render();status(`“${deck.name}” applied to all three bars, companion and castle slots. Ranks, cooldowns, gold and ownership are unchanged.`);}else{render();status(result.blockers?.join(' ')||'Pause the battle and review this deck before applying.');}});
 $('deckShowExport').onclick=()=>safe(()=>{$('deckExportCode').value=exportDeckCode(getDecks());$('deckExportArea').classList.remove('hidden');$('deckExportCode').focus?.();$('deckExportCode').select?.();status('Copy and keep this deck code. It contains arrangements only, not campaign progress.');});
 $('deckSelectExport').onclick=()=>{$('deckExportCode').focus?.();$('deckExportCode').select?.();};
 // The cloud review stays in Saves and uses the same validated merge rules.
 // No deck is applied, bought or equipped by this explicit add operation.
 function cloudImport(text){
  if(getState().blocked)throw new Error('Return from the synthetic field before using saved decks.');
  const incoming=parseDeckCode(text),current=getDecks(),merged=mergeDeckLibraries(current,incoming);
  if(!incoming.length)throw new Error('This cloud copy contains no saved decks. Nothing changed.');
  const added=merged.slice(current.length),missing=[...new Set(added.flatMap(deck=>previewDeck(deck,getState().profile,context()).missing))];
  return {merged,added,missing};
 }
 function cloudRestorePlan(text){
  const {added,missing}=cloudImport(text);
  return {choices:[{id:'add',label:`Add ${added.length} saved deck${added.length===1?'':'s'}`}],effect:`Add to ${getState().profile.name||'the current profile'}: ${added.map(deck=>deck.name).join(', ')}. Existing decks stay; matching names receive a number. ${missing.length?`Missing cards: ${missing.map(name).join(', ')}. These decks cannot be applied until every card is owned.`:'All referenced cards are owned.'} No cards are unlocked or equipped. The cloud copy stays unchanged.`};
 }
 function restoreCloud(text,choice){
  if(choice!=='add')throw new Error('Choose Add saved decks before importing.');
  const {merged}=cloudImport(text);
  change(merged,'Cloud decks added. Choose a deck in the workshop to compare and apply it.');
  return {restored:true};
 }
 $('deckImportPrepare').onclick=()=>safe(()=>{cancelPending();const incoming=parseDeckCode($('deckImportCode').value),current=getDecks(),merged=mergeDeckLibraries(current,incoming);if(!incoming.length){status('This code contains no decks. Nothing changed.');return;}const added=merged.slice(current.length),missing=[...new Set(added.flatMap(deck=>previewDeck(deck,getState().profile,context()).missing))];pending={kind:'import',profile:getState().profile,snapshot:JSON.stringify(current),source:$('deckImportCode').value,merged};$('deckConfirmText').textContent=`Add ${added.length} deck${added.length===1?'':'s'}: ${added.map(deck=>deck.name).join(', ')}? Existing decks are kept and matching names receive a number. ${missing.length?`Missing cards: ${missing.map(name).join(', ')}. These decks cannot be applied until every card is owned.`:'All referenced cards are owned.'} Importing changes no equipped keys.`;$('deckConfirmAccept').textContent='Add imported decks';$('deckConfirm').classList.remove('hidden');$('deckConfirmCancel').focus?.();});
 $('deckImportCode').oninput=()=>{if(pending?.kind==='import')cancelPending();};
 $('deckConfirmCancel').onclick=()=>{cancelPending(true);status('Cancelled. Saved decks and equipped cards are unchanged.');};
 $('deckConfirmAccept').onclick=()=>safe(()=>{const action=pending;if(!action)return;if(action.profile!==getState().profile||action.snapshot!==JSON.stringify(getDecks())||action.kind==='import'&&action.source!==$('deckImportCode').value){cancelPending();status('This profile’s saved decks changed. Review the action again.');return;}if(action.kind==='delete'){const decks=getDecks();decks.splice(action.index,1);selected=-1;change(decks,`“${action.name}” deleted. Equipped cards are unchanged.`);$('deckNewName').focus?.();}else{const index=getDecks().length;selected=index;change(action.merged,'Imported decks added. Choose a deck to compare and apply it.');$('deckImportCode').value='';$('deckRename').value=selectedDeck()?.name??'';$('deckList').querySelector(`[data-deck-index="${selected}"]`)?.focus?.();}});
 root.addEventListener('keydown',event=>{if(!opened||event.key!=='Tab')return;const items=modalFocusCandidates($('deckPresets'));if(!items.length)return;const i=items.indexOf(root.ownerDocument.activeElement);if(event.shiftKey&&i<=0){items.at(-1).focus();event.preventDefault();}else if(!event.shiftKey&&(i<0||i===items.length-1)){items[0].focus();event.preventDefault();}event.stopPropagation();});
 return {render,open,cloudRestorePlan,restoreCloud,back(){if(!opened)return false;if(pending){cancelPending(true);status('Cancelled. Nothing changed.');return true;}return close(true);},close};
}
