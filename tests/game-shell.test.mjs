import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
const markup=readFileSync(new URL('../site/dist/battle.html',import.meta.url),'utf8');
test('management has one full viewport shell and persistent workspaces',()=>{
 for(const id of ['shopPanel','skillsPanel','queuePanel','campaignPanel','expeditionPanel','skirmishPanel','settingsPanel','profilesPanel','savePanel'])for(const route of ['hall','deck','army','map','settings','profiles','vault'])assert.ok(markup.includes(`id="shell-${id}-${route}"`),`${id} ${route}`);
 assert.match(markup,/class="loadout-refine"/);assert.match(markup,/href="\.\/game-shell\.css"/);
});
test('Deck catalog and Build are adjacent tabs and keep same profile, filters and paused tick',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=test'}),profile=ui.battle.profile;
 ui.click('introArmory');ui.click('shopCatalogTab');ui.get('shopSearch').value='fire';ui.dispatch(ui.get('shopSearch'),'input');ui.dispatch(ui.get('shopSearchForm'),'submit');
 const tick=ui.battle.tick;ui.click('shopBuildTab');assert.equal(ui.visible('skillsPanel'),true);assert.equal(ui.get('closeSkills').textContent,'Back to hall');assert.equal(ui.get('skillsTitle').textContent,'Deck');
 ui.click('build-catalog');assert.equal(ui.visible('shopPanel'),true);assert.equal(ui.get('shopSearch').value,'fire');assert.equal(ui.get('closeShop').textContent,'Back to hall');
 ui.frames(30);assert.equal(ui.battle.tick,tick);assert.equal(ui.battle.profile,profile);
 ui.click('shell-shopPanel-hall');assert.equal(ui.visible('intro'),true);assert.equal(ui.visible('shopPanel'),false);
});
test('repeated workspace changes never restart or resume a paused battlefield',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=demo'});ui.click('start');ui.frames(5);ui.click('battlePause');ui.click('pauseSkills');const battle=ui.battle,tick=battle.tick;
 for(let n=0;n<6;n++){
  ui.click('shell-skillsPanel-deck');ui.click('shopCatalogTab');ui.click('shopBuildTab');
  ui.click('shell-skillsPanel-army');ui.click('shell-queuePanel-settings');ui.click('shell-settingsPanel-deck');ui.click('shopBuildTab');
  ui.frames(3);assert.equal(ui.battle,battle);assert.equal(battle.tick,tick);assert.equal(battle.paused,true);
 }
 ui.click('closeSkills');assert.equal(ui.visible('skillsPanel'),false);assert.equal(ui.visible('shopPanel'),false);assert.equal(battle.tick,tick);assert.equal(battle.paused,true);
});
test('primary navigation cancels in-progress loadout placement without hidden return loops',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=demo'});const tick=ui.battle.tick;ui.click('introLoadout');ui.click('shell-skillsPanel-deck');ui.click('shopBuildTab');ui.click('shell-skillsPanel-army');ui.click('shell-queuePanel-hall');
 assert.equal(ui.visible('intro'),true);for(const id of ['skillsPanel','shopPanel','queuePanel'])assert.equal(ui.visible(id),false);
 ui.click('introLoadout');ui.click('closeSkills');assert.equal(ui.visible('intro'),true);assert.equal(ui.visible('shopPanel'),false);assert.equal(ui.battle.tick,tick);
});
test('Refine Escape closes just the overlay and returns focus without dropping the prepared deck',async t=>{
 const ui=await loadGameUI(t);ui.click('introLoadout');const refine=ui.get('loadoutRefine');refine.setAttribute('open','');ui.get('loadoutSort').focus();ui.key('keydown','Escape',{target:ui.get('loadoutSort')});assert.equal(refine.getAttribute('open'),null);assert.equal(ui.visible('skillsPanel'),true);assert.equal(ui.document.activeElement,refine.querySelector('summary'));ui.key('keydown','Escape');assert.equal(ui.visible('skillsPanel'),false);
});
test('Army Rally can be issued while paused without time or resources advancing and persists after panel return',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=demo'});ui.click('introArmy');let rally=ui.get('armyOrders').querySelector('[data-army-order="rally"]');assert.equal(rally.disabled,true);ui.click('closeQueue');ui.click('start');ui.frames(3);ui.click('battlePause');ui.click('pauseQueue');const b=ui.battle,tick=b.tick,gold=b.profile.gold,reserve=b.friendlyQueue.population;rally=ui.get('armyOrders').querySelector('[data-army-order="rally"]');rally.click();assert.equal(b.armyOrder.mode,'rally');const anchor=b.armyOrder.anchorX;ui.frames(10);assert.equal(b.tick,tick);assert.equal(b.profile.gold,gold);assert.equal(b.friendlyQueue.population,reserve);ui.click('closeQueue');ui.click('pauseQueue');assert.equal(b.armyOrder.anchorX,anchor);assert.equal(rally.getAttribute('aria-pressed'),'true');ui.get('armyOrders').querySelector('[data-army-order="advance"]').click();assert.equal(b.armyOrder.mode,'advance');assert.equal(b.armyOrder.anchorX,null);
});
test('first Escape cancels an armed placement and second Escape leaves Build',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=demo'});ui.click('introLoadout');const b=ui.battle,before=b.profile.skills.map(s=>s.binding);ui.click('owned-fireArrow');assert.equal(ui.get('cancelBinding').disabled,false);ui.key('keydown','Escape');assert.equal(ui.visible('skillsPanel'),true);assert.equal(ui.get('cancelBinding').disabled,true);assert.deepEqual(b.profile.skills.map(s=>s.binding),before);assert.equal(ui.document.activeElement,ui.get('owned-fireArrow'));ui.key('keydown','Escape');assert.equal(ui.visible('skillsPanel'),false);
});
