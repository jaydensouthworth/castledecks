import test from 'node:test';import assert from 'node:assert/strict';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
import {ActionBarLayout} from '../site/dist/engine/action-bar-layout.mjs';
import {placeLoadoutAbility,recoverDuplicateBindings,armoryEligibility,abilityCategory} from '../site/dist/loadout-ui-model.mjs';
import {PlayerProfile,SKILLS,serializeProfile,restoreProfile} from '../site/dist/engine/progression.mjs';
const unlock=ui=>{ui.click('introTesting');ui.click('testUnlock');ui.click('closeTesting');};
test('swap-safe model preserves ownership, cooldown, rank and serialization with no duplicate bindings',()=>{
 const profile=new PlayerProfile();profile.addSkill('fireArrow');const layout=new ActionBarLayout(profile.skills);const [a,b]=layout.dragIcons;
 a.skill.cooldown=41;b.skill.cooldown=117;b.skill.rank=3;b.skill.threshold=400;
 let result=placeLoadoutAbility(layout,b,0);assert.equal(result.kind,'swap');assert.equal(a.binding,1);assert.equal(a.skill.binding,1);assert.equal(b.skill.binding,0);assert.equal(layout.pending.length,0);
 result=placeLoadoutAbility(layout,b,0);assert.equal(result.kind,'unchanged');assert.equal(layout.pending.length,0);
 placeLoadoutAbility(layout,b,27);assert.equal(b.skill.binding,27);assert.equal(a.skill.binding,1);
 placeLoadoutAbility(layout,b,-1);result=placeLoadoutAbility(layout,b,1);assert.equal(result.kind,'replace');assert.equal(a.skill.binding,-1);assert.equal(b.skill.binding,1);assert.equal(layout.pending.length,1);
 assert.deepEqual(profile.skills.map(s=>s.cooldown),[41,117]);assert.equal(b.skill.rank,3);assert.equal(profile.owned.size,2);
 const restored=restoreProfile(serializeProfile(profile));assert.deepEqual(restored.skills.map(s=>s.binding),[-1,1]);
});
test('legacy overlapping bindings recover only hidden losers while preserving last-wins incumbent',()=>{
 const skills=[{id:'arrow',binding:0,rank:2,cooldown:7},{id:'fireArrow',binding:0,rank:3,cooldown:9},{id:'iceArrow',binding:12,rank:1,cooldown:8}];
 assert.deepEqual(recoverDuplicateBindings(skills).map(s=>s.id),['arrow']);assert.deepEqual(skills.map(s=>s.binding),[-1,0,12]);assert.deepEqual(skills.map(s=>[s.rank,s.cooldown]),[[2,7],[3,9],[1,8]]);
 assert.equal(new ActionBarLayout(skills).dragIcons.length,3);
});
test('gallery shows every legacy owned ability, safe swaps, reserve, re-open and tab selection do not run combat',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=test'});unlock(ui);
 const p=ui.battle.profile;p.skills[1].binding=0;const cd=p.skills[1].cooldown;
 ui.click('introLoadout');assert.equal(ui.get('ownedSkillList').querySelectorAll('article').length,12);assert.match(ui.get('bindingStatus').textContent,/restored to reserve/);assert.equal(p.skills[0].binding,-1);
 ui.document.querySelector('[data-loadout-bar="0"]').click();ui.get('loadoutSearch').value='basic arrow';ui.dispatch(ui.get('loadoutSearch'),'input');ui.click('owned-arrow');ui.click('assign-0');assert.equal(p.skills[0].binding,0);assert.equal(p.skills[1].binding,-1);assert.match(ui.get('bindingStatus').textContent,/Fire Arrow is now in reserve/);
 ui.get('loadoutSearch').value='fire arrow';ui.dispatch(ui.get('loadoutSearch'),'input');ui.click('owned-fireArrow');ui.document.querySelector('[data-loadout-bar="2"]').click();ui.click('assign-29');assert.equal(p.skills[1].binding,29);assert.match(ui.get('assign-29').getAttribute('aria-label'),/key 0/);
 ui.click('closeSkills');ui.click('introLoadout');assert.match(ui.get('owned-fireArrow').textContent,/key 0/);assert.equal(p.skills[1].cooldown,cd);assert.equal(ui.battle.tick,0);assert.equal(ui.battle.stats.shotsFired,0);
 const bound=p.skills.map(s=>s.binding).filter(n=>n>=0);assert.equal(new Set(bound).size,bound.length);
});
test('tapping filled bar selects first, second tap swaps; cancelling does not change binding',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=test'});unlock(ui);ui.click('introLoadout');
 const p=ui.battle.profile,fire=p.skills.find(s=>s.id==='fireArrow');ui.document.querySelector('[data-loadout-bar="0"]').click();
 ui.click('assign-1');assert.equal(fire.binding,1);assert.match(ui.get('slotInstruction').textContent,/Fire Arrow selected/);ui.click('cancelBinding');assert.equal(fire.binding,1);
 ui.click('assign-1');ui.click('assign-0');assert.equal(fire.binding,0);assert.equal(p.skills[0].binding,1);
 ui.click('assign-0');ui.click('assign-0');assert.equal(fire.binding,0);assert.match(ui.get('bindingStatus').textContent,/stays/);
});
test('armory categories, exact-price purchases, rank and visible feedback reflect the modern rule',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=test'});ui.click('introTesting');ui.click('testVictory');ui.frames(105);
 ui.battle.profile.gold=999;ui.click('endingShop');assert.equal(ui.get('buy-fireArrow').disabled,true);assert.match(ui.get('shopGrid').textContent,/Need 1 more gold/);
 assert.match(ui.get('shopDetails').textContent,/No hero rank requirement/);assert.doesNotMatch(ui.get('shopDetails').textContent,/Keep at least 1 gold/);
 ui.click('closeShop');ui.battle.profile.gold=1000;ui.click('endingShop');assert.equal(ui.get('buy-fireArrow').disabled,false);ui.click('buy-fireArrow');assert.equal(ui.battle.profile.gold,0);assert.match(ui.get('shopStatus').textContent,/Fire Arrow unlocked/);assert.match(ui.get('shopDetails').textContent,/Rank 0/);
 ui.get('shopFilters').querySelector('[data-ability-filter="army"]').click();assert.equal(ui.get('shopGrid').querySelectorAll('article').length,12);assert.ok(!ui.document.querySelector('#buy-fireArrow'));assert.match(ui.get('shopDetails').textContent,/Fire Arrow/);assert.match(ui.get('shopDetails').textContent,/Selected outside these filters/);ui.click('inspect-grunt');assert.match(ui.get('shopDetails').textContent,/Per squad/);
 ui.click('shopLoadout');ui.click('loadoutArmory');assert.equal(ui.get('closeShop').textContent,'Back to loadout');ui.click('closeShop');assert.equal(ui.visible('skillsPanel'),true);
});
test('category and eligibility helper stays catalog-grounded',()=>{const profile=new PlayerProfile();profile.gold=999.5;assert.equal(armoryEligibility(profile,'fireArrow',SKILLS).shortfall,1);assert.equal(armoryEligibility(profile,'fireArrow',SKILLS).eligible,false);profile.gold=1000;assert.equal(armoryEligibility(profile,'fireArrow',SKILLS).eligible,true);assert.equal(armoryEligibility(profile,'fireArrow',SKILLS).shortfall,0);assert.equal(abilityCategory('healWave',SKILLS),'waves');assert.equal(abilityCategory('priest',SKILLS),'army');});
test('editor refresh and close preserve selected bow through swaps and never reset to last populated bar',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=test'});unlock(ui);const p=ui.battle.profile,fire=p.skills.find(s=>s.id==='fireArrow');
 ui.battle.activeSkill=fire;ui.battle.hotbar.active=fire;ui.battle.hotbar.bar=0;ui.battle.hotbar.glow=1;
 ui.click('start');ui.click('battlePause');ui.click('pauseSkills');assert.equal(ui.battle.activeSkill,fire);assert.equal(ui.battle.hotbar.bar,0);
 ui.click('owned-fireArrow');ui.click('assign-4');assert.equal(ui.battle.activeSkill,fire);assert.equal(ui.battle.hotbar.bar,0);assert.equal(ui.battle.hotbar.glow,4);
 ui.click('loadoutContinue');assert.equal(ui.battle.activeSkill,fire);assert.equal(ui.battle.hotbar.bar,0);assert.equal(ui.battle.paused,true);
});
test('a purchased card immediately offers Arrange and opens that exact ability without another charge',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=test'});ui.click('introTesting');ui.click('testGoldLarge');ui.click('testVictory');ui.frames(105);ui.click('endingShop');
 ui.click('buy-fireArrow');assert.match(ui.get('buy-fireArrow').textContent,/Arrange in loadout/);assert.equal(ui.battle.profile.gold,9000);
 ui.click('buy-fireArrow');assert.equal(ui.visible('shopDetailDrawer'),true);assert.match(ui.get('shopDetails').textContent,/Place in your loadout/);ui.click('shopOpenFullLoadout');assert.equal(ui.visible('skillsPanel'),true);assert.match(ui.get('slotInstruction').textContent,/Fire Arrow selected/);assert.equal(ui.battle.profile.gold,9000);assert.equal(ui.battle.profile.skills.filter(s=>s.id==='fireArrow').length,1);assert.equal(ui.battle.summary.outcome,'victory');
});
