import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
import {createDeckPresetsUI} from '../site/dist/deck-presets.mjs';
import {captureDeck} from '../site/dist/deck-presets-model.mjs';

test('navigation preserves Skirmish readOnly, closeLabel and exactly-once user close callback',async t=>{
 const ui=await loadGameUI(t);ui.click('introLoadout');const b=ui.battle,profile=b.profile;profile.skills[0].binding=-1;let decks=[captureDeck(profile,'Result deck')],closed=0,applied=0,recovered=0;
 const view=createDeckPresetsUI({root:ui.get('skillsPanel'),getState:()=>({profile,battle:b,started:true,readOnly:true,closeLabel:'Back to Skirmish results'}),getDecks:()=>structuredClone(decks),setDecks:value=>{decks=value;},onApply:()=>{applied++;return {ok:false};},onRecoverArrow:()=>{recovered++;return {ok:false};},onClose:()=>closed++});
 view.open();const body=ui.get('deckPresetsBody');body.scrollTop=128;body.getBoundingClientRect=()=>({top:100});ui.get('deckDetail').getBoundingClientRect=()=>({top:600});ui.get('deckList').querySelector('[data-deck-index="0"]').click();assert.equal(ui.document.activeElement,ui.get('deckTitle'));assert.equal(ui.get('deckApply').disabled,true);assert.equal(ui.get('deckRecoverArrow').disabled,true);assert.match(ui.get('deckBlockers').textContent,/attempt is over/);assert.equal(ui.get('closeDeckPresets').textContent,'Back to Skirmish results');ui.click('deckApply');ui.click('deckRecoverArrow');assert.equal(applied,0);assert.equal(recovered,0);ui.click('deckBackToList');assert.equal(body.scrollTop,128);assert.equal(closed,0);ui.click('deckShowExport');assert.match(ui.get('deckExportCode').value,/Result deck/);ui.click('closeDeckPresets');assert.equal(closed,1);view.close();assert.equal(closed,1);view.open();view.close();assert.equal(closed,1,'internal cleanup never notifies');view.open();view.back();assert.equal(closed,2);
});
