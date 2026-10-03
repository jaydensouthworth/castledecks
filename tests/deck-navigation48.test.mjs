import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
import {MemoryStorage,TestLocks,settle} from './helpers/local-storage.mjs';
const save=(ui,name)=>{ui.get('deckNewName').value=name;ui.dispatch(ui.get('deckSaveForm'),'submit');};
async function editor(t,options={}){const ui=await loadGameUI(t,options);ui.click('introLoadout');ui.click('openDeckPresets');for(let i=0;i<6;i++)save(ui,`Deck ${i+1}`);await settle();return ui;}
const geometry=(ui,{scroll=180,bodyTop=100,detailTop=730}={})=>{const body=ui.get('deckPresetsBody');body.scrollTop=scroll;body.getBoundingClientRect=()=>({top:bodyTop});ui.get('deckDetail').getBoundingClientRect=()=>({top:detailTop});return body;};

test('Saved decks header and exit are outside its bounded content scroller',async t=>{
 const ui=await editor(t),body=ui.get('deckPresetsBody'),header=ui.get('closeDeckPresets').parentElement;assert.equal(header.classList.contains('deck-presets-header'),true);assert.equal(header.parentElement,ui.get('deckPresets'));assert.equal(body.parentElement,ui.get('deckPresets'));assert.equal(body.querySelector('#closeDeckPresets'),null);assert.equal(body.querySelector('#deckList'),ui.get('deckList'));assert.equal(body.querySelector('#deckDetail'),ui.get('deckDetail'));assert.equal(ui.get('deckTitle').getAttribute('tabindex'),'-1');
 const css=readFileSync(new URL('../site/dist/deck-presets.css',import.meta.url),'utf8');assert.match(css,/\.deck-presets\{[^}]*display:flex;flex-direction:column;[^}]*overflow:hidden/);assert.match(css,/\.deck-presets-header\{[^}]*flex:0 0 auto/);assert.match(css,/\.deck-presets-body\{[^}]*min-height:0;overflow:auto/);assert.match(css,/#deckBackToList\{min-height:44px/);
});

test('row activation reveals one existing inspector and focuses its heading without touching a text field',async t=>{
 const ui=await editor(t),body=geometry(ui),before=JSON.stringify(ui.battle.profile);let textFocus=0;for(const id of ['deckRename','deckNewName','deckImportCode'])ui.get(id).focus=()=>{textFocus++;};const row=ui.get('deckList').querySelector('[data-deck-index="4"]');row.focus();row.click();assert.equal(body.scrollTop,802);assert.equal(ui.document.activeElement,ui.get('deckTitle'));assert.equal(ui.get('deckTitle').textContent,'Deck 5');assert.equal(ui.get('deckRename').value,'Deck 5');assert.equal(textFocus,0);assert.equal(ui.document.querySelectorAll('#deckDetail').length,1);assert.equal(JSON.stringify(ui.battle.profile),before);assert.equal(ui.visible('deckDetail'),true);
});

test('Back to list restores the exact prior scroll and row focus on repeated inspector visits',async t=>{
 const ui=await editor(t),body=geometry(ui);for(const [index,scroll]of [[5,231],[1,78],[4,194]]){body.scrollTop=scroll;ui.get('deckList').querySelector(`[data-deck-index="${index}"]`).click();assert.equal(ui.document.activeElement,ui.get('deckTitle'));body.scrollTop=999;ui.click('deckBackToList');assert.equal(body.scrollTop,scroll);assert.equal(ui.document.activeElement,ui.get('deckList').querySelector(`[data-deck-index="${index}"]`));assert.equal(ui.visible('deckDetail'),true,'retaining the single inspector prevents a height-collapse scroll jump');body.scrollTop=888;ui.click('deckBackToList');assert.equal(body.scrollTop,scroll);}
});

test('late checkpoint repaint preserves inspector focus and the list return position',async t=>{
 const locks=new TestLocks(),ui=await editor(t,{storage:new MemoryStorage(),locks});locks.pauseNext=true;save(ui,'Pending checkpoint');await settle();assert.ok(locks.release);const body=geometry(ui,{scroll:167});ui.get('deckList').querySelector('[data-deck-index="3"]').click();const position=body.scrollTop;locks.release();await settle();assert.equal(ui.document.activeElement,ui.get('deckTitle'));assert.equal(body.scrollTop,position);ui.click('deckBackToList');assert.equal(body.scrollTop,167);assert.equal(ui.document.activeElement,ui.get('deckList').querySelector('[data-deck-index="3"]'));
});

test('header exit and existing Escape cancel order stay available from a scrolled inspector',async t=>{
 const ui=await editor(t),body=geometry(ui);ui.get('deckList').querySelector('[data-deck-index="2"]').click();body.scrollTop=900;ui.click('deckDelete');ui.key('keydown','Escape');assert.equal(ui.visible('deckConfirm'),false);assert.equal(ui.visible('deckPresets'),true);ui.click('closeDeckPresets');assert.equal(ui.visible('deckPresets'),false);assert.equal(ui.visible('skillsPanel'),true);assert.equal(ui.document.activeElement,ui.get('openDeckPresets'));ui.click('openDeckPresets');ui.key('keydown','Escape');assert.equal(ui.visible('deckPresets'),false);assert.equal(ui.visible('skillsPanel'),true);
});
