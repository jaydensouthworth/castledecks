import test from 'node:test';
import assert from 'node:assert/strict';
import {scoutCard,scoutThreat} from '../site/dist/hall-scout.mjs';
import {hallPreparation} from '../site/dist/command-hall-model.mjs';
import {serializeProfile} from '../site/dist/engine/progression.mjs';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
const threat=(ui,id)=>ui.get('hallScoutRoster').querySelector(`[data-scout-threat="${id}"]`);
test('counter cards distinguish equipped, reserve and unowned without mutation or invented alternatives',()=>{
 const p={skills:[{id:'arrow',binding:29},{id:'fireArrow',binding:-1}]},before=JSON.stringify(p);
 assert.match(scoutCard(p,'grunt').status,/bar 3, key 0/);assert.match(scoutCard(p,'iceDragon').status,/reserve/);assert.equal(scoutCard(p,'fireDragon').owned,false);assert.equal(scoutCard(p,'mount'),null);assert.equal(scoutCard(p,'unknown'),null);assert.equal(JSON.stringify(p),before);
 const alias=scoutThreat({...p,difficulty:'medium'},{level:10},'dragon_scout_fire');assert.equal(alias.intel.id,'fireDragon');assert.equal(alias.card.id,'iceArrow');assert.equal(scoutThreat(p,{level:1},'unknown').intel,null);
});
test('Hall scouts every actual threat, shares verified advice, and never advances the prepared field',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=demo'}),b=ui.battle,tick=b.tick,code=serializeProfile(b.profile),view=hallPreparation({profile:b.profile,battle:b,destination:'midgame'});
 assert.equal(ui.get('hallScout').getAttribute('open'),null);assert.equal(ui.get('hallScoutRoster').children.length,view.threats.length);
 for(const row of view.threats){threat(ui,row.id).click();assert.equal(threat(ui,row.id).getAttribute('aria-pressed'),'true');assert.equal(ui.get('hallScoutCounter').textContent,scoutThreat(b.profile,b,row.id).intel.counter);}
 assert.equal(serializeProfile(b.profile),code);assert.equal(b.tick,tick);
});
test('owned counter opens exact unarmed Build inspector and returns to selected threat without losing browsed world',async t=>{
 const ui=await loadGameUI(t),b=ui.battle,code=serializeProfile(b.profile);ui.get('hallScout').setAttribute('open','');threat(ui,'grunt').click();
 ui.get('hubDestinations').querySelector('[data-hub-destination="expedition"]').click();ui.click('hallScoutReview');
 assert.equal(ui.visible('skillsPanel'),true);assert.equal(ui.visible('loadoutInspector'),true);assert.equal(ui.get('selectedSkillName').textContent,'Basic Arrow');assert.equal(ui.get('loadoutSelectionName').textContent,'Choose an ability');
 ui.key('keydown','Escape');assert.equal(ui.visible('loadoutInspector'),false);ui.click('closeSkills');
 assert.equal(ui.document.activeElement,ui.get('hallScoutReview'));assert.equal(ui.get('hallScout').getAttribute('open'),'');assert.equal(threat(ui,'grunt').getAttribute('aria-pressed'),'true');assert.match(ui.get('hallSelectedName').textContent,/Wayfarer/);assert.equal(ui.battle,b);assert.equal(serializeProfile(b.profile),code);assert.equal(b.tick,0);
});
test('unowned counter opens matching Armory inspection, cancellation returns without buying',async t=>{
 const ui=await loadGameUI(t),b=ui.battle; // Controlled actual-roster fixture, not an invented encounter.
 b.enemies.roster.push('archer');ui.click('introSettings');ui.click('closeSettings');
 const code=serializeProfile(b.profile);ui.get('hallScout').setAttribute('open','');threat(ui,'archer').click();assert.match(ui.get('hallScoutCard').textContent,/Not owned/);ui.click('hallScoutReview');
 assert.equal(ui.visible('shopPanel'),true);assert.equal(ui.visible('shopDetailDrawer'),true);assert.match(ui.get('shopDetailDrawer').textContent,/Fire Arrow/);ui.click('shopCartSelected');ui.click('shopCartOpen');ui.click('shopCartClear');ui.click('shopCartBack');ui.key('keydown','Escape');ui.click('closeShop');assert.equal(ui.document.activeElement,ui.get('hallScoutReview'));assert.equal(threat(ui,'archer').getAttribute('aria-pressed'),'true');assert.equal(serializeProfile(b.profile),code);assert.equal(b.tick,0);
});
test('scout state resets on destination activation and does not display prior company card',async t=>{
 const ui=await loadGameUI(t),original=ui.battle;ui.get('hallScout').setAttribute('open','');threat(ui,'grunt').click();ui.get('hubDestinations').querySelector('[data-hub-destination="expedition"]').click();ui.click('start');assert.notEqual(ui.battle,original);assert.equal(ui.get('hallScout').getAttribute('open'),null);const view=hallPreparation({profile:ui.battle.profile,battle:ui.battle,destination:'expedition'});assert.equal(ui.get('hallScoutRoster').children.length,view.threats.length);assert.equal(ui.battle.tick,0);
});
test('scout return survives an explicit detour through contract trial and cart',async t=>{
 const ui=await loadGameUI(t),origin=ui.battle;origin.enemies.roster.push('archer');ui.click('introSettings');ui.click('closeSettings');ui.get('hallScout').setAttribute('open','');threat(ui,'archer').click();ui.click('hallScoutReview');
 ui.click('shopCatalogTab');ui.get('shopSearch').value='Grunt';ui.dispatch(ui.get('shopSearch'),'input');ui.dispatch(ui.get('shopSearchForm'),'submit');ui.click('inspect-grunt');const before=serializeProfile(origin.profile),tick=origin.tick;ui.click('shopTryCard');ui.frames(5);assert.notEqual(ui.battle,origin);ui.click('unitTrialReturn');ui.frames(5);assert.equal(ui.battle,origin);ui.click('closeShop');assert.equal(ui.document.activeElement,ui.get('hallScoutReview'));assert.equal(threat(ui,'archer').getAttribute('aria-pressed'),'true');assert.equal(serializeProfile(origin.profile),before);assert.equal(origin.tick,tick);
});
test('owned reserve counter opens inspection without equipping and new roster invalidates removed threat',async t=>{
 const ui=await loadGameUI(t),b=ui.battle;b.profile.skills[0].binding=-1;ui.click('introSettings');ui.click('closeSettings');assert.match(ui.get('hallScoutCard').textContent,/in reserve/);ui.click('hallScoutReview');assert.equal(ui.visible('loadoutInspector'),true);assert.equal(b.profile.skills[0].binding,-1);ui.click('closeSkills');
 b.enemies.roster.splice(0,b.enemies.roster.length,'priest');ui.click('introSettings');ui.click('closeSettings');assert.equal(threat(ui,'grunt'),null);assert.equal(threat(ui,'priest').getAttribute('aria-pressed'),'true');assert.match(ui.get('hallScoutName').textContent,/Priest/);assert.match(ui.get('hallScoutCard').textContent,/Fire Arrow/);
});
