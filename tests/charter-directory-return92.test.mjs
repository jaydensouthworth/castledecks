import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
import {serializeProfile} from '../site/dist/engine/progression.mjs';
const scroll=ui=>ui.get('intro').querySelector('.hall-orders-scroll');
const inspect=ui=>{
 ui.click('hallCampaignsTab');ui.get('hallStageSearch').value='Storm';ui.get('hallStageSearch').oninput();scroll(ui).scrollTop=180;ui.click('hallInspectField');assert.equal(ui.visible('expeditionPanel'),true);
};
const returned=ui=>{
 assert.equal(ui.get('intro').getAttribute('data-hall-view'),'campaigns');assert.equal(ui.visible('hallBrowse'),true);assert.equal(ui.get('hallStageSearch').value,'Storm');assert.equal(ui.get('hallCampaignBrowser').querySelector('[data-hall-stage="stormcrown"]').getAttribute('aria-pressed'),'true');assert.equal(scroll(ui).scrollTop,180);assert.equal(ui.document.activeElement,ui.get('hallInspectField'));
};
test('Wayfarer directory returns visible search, selected field, scroll and focus through all map dismissal routes',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=expedition'});ui.click('closeRoute');const battle=ui.battle,profile=serializeProfile(battle.profile);
 for(const close of ['charterReturn','closeRoute','Escape']){inspect(ui);if(close==='Escape')ui.key('keydown','Escape');else ui.click(close);returned(ui);assert.equal(ui.battle,battle);assert.equal(battle.tick,0);assert.equal(serializeProfile(battle.profile),profile);}
});
test('explicit Hall navigation discards Wayfarer directory return ownership',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=expedition'});ui.click('closeRoute');inspect(ui);ui.click('shell-expeditionPanel-hall');assert.equal(ui.get('intro').getAttribute('data-hall-view'),'home');assert.equal(scroll(ui).scrollTop,0);ui.click('shell-intro-map');ui.click('closeRoute');assert.equal(ui.get('intro').getAttribute('data-hall-view'),'home');assert.equal(ui.document.activeElement,ui.get('start'));
});
test('leaving Wayfarer map for another workspace cannot resurrect a stale directory focus target',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=expedition'});ui.click('closeRoute');inspect(ui);ui.click('shell-expeditionPanel-settings');ui.click('closeSettings');assert.equal(ui.document.activeElement,ui.get('start'));ui.click('shell-intro-map');ui.click('closeRoute');assert.equal(ui.get('intro').getAttribute('data-hall-view'),'home');assert.equal(ui.document.activeElement,ui.get('start'));
});
