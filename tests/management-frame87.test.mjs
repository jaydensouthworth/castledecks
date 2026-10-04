/**
 * Isolated management audit tests. No canonical source is modified.
 * Default source: the canonical recovery checkout. Override CASTLEDECKS_ROOT
 * to run against a copied fixture with site/dist and tests-recovered siblings.
 * These are DOM/lifecycle tests, not proof of computed CSS geometry.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=new URL('../',import.meta.url).pathname;
const {loadGameUI}=await import(pathToFileURL(resolve(root,'tests/helpers/game-ui-harness.mjs')));
const markup=readFileSync(resolve(root,'site/dist/battle.html'),'utf8');
const routes=['hall','deck','army','map','settings','profiles','vault'];
const panels=['shopPanel','skillsPanel','queuePanel','campaignPanel','expeditionPanel','skirmishPanel','settingsPanel','profilesPanel','savePanel'];

test('Hall exposes the same seven management destinations as every workspace',async t=>{
 const ui=await loadGameUI(t);
 const hall=ui.get('intro');
 const actual=hall.querySelectorAll('[data-menu-route]').map(button=>button.getAttribute('data-menu-route'));
 assert.deepEqual(actual,routes,'Hall currently has separate preparation stations, so the management navigation disappears');
 assert.equal(hall.querySelector('[data-menu-route="hall"]')?.getAttribute('aria-current'),'page');
});

test('all seven primary destinations preserve one paused session across repeated round trips',async t=>{
 const ui=await loadGameUI(t);
 ui.click('start');ui.frames(5);ui.click('battlePause');ui.click('pauseSkills');
 const battle=ui.battle,profile=battle.profile,tick=battle.tick,gold=profile.gold;
 for(let round=0;round<3;round++){
  let source=round===0?'skillsPanel':'shopPanel';
  for(const [route,target] of [['army','queuePanel'],['map','campaignPanel'],['settings','settingsPanel'],['profiles','profilesPanel'],['vault','savePanel'],['deck','shopPanel']]){
   ui.click(`shell-${source}-${route}`);
   for(const id of panels)assert.equal(ui.visible(id),id===target,`${round} ${route}: ${id}`);
   assert.equal(ui.get('intro').inert,true,'background Hall must not compete for focus');
   ui.frames(2);assert.equal(ui.battle,battle);assert.equal(ui.battle.profile,profile);
   assert.equal(battle.tick,tick);assert.equal(battle.paused,true);assert.equal(profile.gold,gold);
   source=target;
  }
  ui.click('shell-shopPanel-hall');
  assert.equal(ui.visible('intro'),true);assert.equal(ui.get('intro').inert,false);
  for(const id of panels)assert.equal(ui.visible(id),false,`Hall leaves stale ${id}`);
  ui.frames(2);assert.equal(ui.battle,battle);assert.equal(battle.tick,tick);assert.equal(battle.paused,true);
  ui.click('introArmory');
 }
});

test('Build subviews retain catalog search without purchase or battle mutations',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=demo'}),battle=ui.battle,profile=battle.profile;
 const gold=profile.gold,bindings=profile.skills.map(skill=>skill.binding),tick=battle.tick;
 ui.click('introArmory');ui.click('shopCatalogTab');
 ui.get('shopSearch').value='fire';ui.dispatch(ui.get('shopSearch'),'input');ui.dispatch(ui.get('shopSearchForm'),'submit');
 for(let round=0;round<4;round++){
  ui.click('shopBuildTab');assert.equal(ui.visible('skillsPanel'),true);
  ui.click('build-catalog');assert.equal(ui.visible('shopPanel'),true);
  assert.equal(ui.get('shopSearch').value,'fire');
 }
 ui.frames(15);assert.equal(ui.battle,battle);assert.equal(profile.gold,gold);assert.equal(battle.tick,tick);
 assert.deepEqual(profile.skills.map(skill=>skill.binding),bindings);
});

test('all management screens live in the same frame and background Hall is hidden from assistive technology',async t=>{
 const ui=await loadGameUI(t),frame=ui.get('managementFrame');
 for(const id of ['intro',...panels])assert.equal(ui.get(id).parentElement,frame,id);
 assert.equal(frame.getAttribute('data-workspace'),'intro');
 ui.click('shell-intro-deck');
 assert.equal(frame.getAttribute('data-workspace'),'shopPanel');
 assert.equal(ui.get('intro').getAttribute('aria-hidden'),'true');
 assert.equal(ui.get('intro').classList.contains('workspace-covered'),true);
 assert.equal(ui.get('shopPanel').getAttribute('aria-hidden'),'false');
 ui.click('shell-shopPanel-hall');
 assert.equal(frame.getAttribute('data-workspace'),'intro');
 assert.equal(ui.get('intro').getAttribute('aria-hidden'),'false');
});
test('frame clears for battle, remains through workspace navigation, and returns for paused Hall',async t=>{
 const ui=await loadGameUI(t),frame=ui.get('managementFrame');
 ui.click('start');assert.equal(frame.classList.contains('hidden'),true);
 ui.frames(4);ui.click('battlePause');ui.click('pauseLobby');
 assert.equal(frame.classList.contains('hidden'),false);assert.equal(frame.getAttribute('data-workspace'),'intro');
 const tick=ui.battle.tick;
 ui.click('shell-intro-settings');ui.key('keydown','Escape');
 assert.equal(frame.getAttribute('data-workspace'),'intro');
 ui.frames(10);assert.equal(ui.battle.tick,tick);assert.equal(ui.battle.paused,true);
 ui.click('start');assert.equal(frame.classList.contains('hidden'),true);assert.equal(ui.battle.paused,false);
});
test('nested Controls closes back to the same Settings frame',async t=>{
 const ui=await loadGameUI(t);ui.click('shell-intro-settings');ui.click('openControls');
 assert.equal(ui.get('managementFrame').classList.contains('hidden'),true);
 ui.key('keydown','Escape');assert.equal(ui.visible('settingsPanel'),true);
 assert.equal(ui.get('managementFrame').getAttribute('data-workspace'),'settingsPanel');
});
test('geometry is owned by the frame boundary and all workspace roots explicitly reset legacy bounds',()=>{
 const css=readFileSync(resolve(root,'site/dist/management-frame.css'),'utf8');
 for(const id of ['intro',...panels])assert.ok(css.includes('#'+id),id);
 assert.match(css,/max-width:none;max-height:none;margin:0;transform:none/);
 assert.match(css,/\.workspace-covered\{display:none\}/);
 assert.match(css,/min-height:var\(--shell-head\);max-height:var\(--shell-head\)/);
 assert.ok(markup.indexOf('management-frame.css')>markup.indexOf('castle-loadout.css'));
});
