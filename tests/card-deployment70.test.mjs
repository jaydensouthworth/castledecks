import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SKILLS,serializeProfile} from '../site/dist/engine/progression.mjs';
import {REGULAR_RECRUIT_IDS,COMPANIONS} from '../site/dist/engine/recruitment.mjs';
import {buildArmoryRecords} from '../site/dist/armory-catalog-data.mjs';
import {createLoadoutCollectionUI} from '../site/dist/loadout-collection.mjs';
import {ActionBarLayout} from '../site/dist/engine/action-bar-layout.mjs';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
const path=file=>new URL('../site/dist/'+file,import.meta.url);
const selectType=(ui,type)=>ui.get('loadoutFilters').querySelector(`[data-loadout-type="${type}"]`).click();
const change=(ui,id,value)=>{ui.get(id).value=value;ui.dispatch(ui.get(id),'change');};
async function ready(t){const ui=await loadGameUI(t,{search:'?mode=test'});ui.click('introTesting');ui.click('testUnlock');ui.click('closeTesting');ui.click('introLoadout');return ui;}

test('compact unit deployment explicitly outranks the late shared-shell hiding rule within the same media scope',async()=>{
 const [css,html]=await Promise.all([readFile(path('game-shell.css'),'utf8'),readFile(path('battle.html'),'utf8')]);
 assert.ok(html.indexOf('./game-shell.css')>html.indexOf('./loadout-collection.css'));
 const start=css.indexOf('/* Native 915×360 acceptance:'),end=css.indexOf('\n}',start),block=css.slice(start,end);
 assert.match(block,/@media\(max-height:600px\) and \(orientation:landscape\)/);
 const hidden='#skillsPanel.game-management .loadout-card-facts{display:none}',visible='#skillsPanel.game-management .loadout-card-facts.loadout-unit-deployment{display:block';
 assert.ok(block.includes(hidden));assert.ok(block.indexOf(visible)>block.indexOf(hidden));
 // The visible selector adds a class to the exact selector which hid the facts,
 // so it wins by specificity and source order. No early-sheet-only fix.
 assert.match(block,/\.loadout-card-facts\.loadout-unit-deployment\{display:block;grid-column:1\/-1;grid-row:5;min-width:0/);
 assert.match(block,/\.loadout-card-purpose\{grid-column:1\/-1;grid-row:4;min-height:0;text-align:left\}/);
 assert.match(block,/\.loadout-unit-deployment>span:first-child\{display:none\}/);
 assert.match(block,/\.loadout-unit-deployment>span:last-child\{display:flex;flex-wrap:wrap/);
 assert.match(block,/\.loadout-unit-deployment>span:last-child small\{display:inline/);
 assert.doesNotMatch(css.slice(end),/loadout-unit-deployment[^{}]*\{[^}]*display:none/);
});

test('correction preserves touch targets and the existing short-landscape and portrait scroll owners',async()=>{
 const [shell,collection]=await Promise.all([readFile(path('game-shell.css'),'utf8'),readFile(path('loadout-collection.css'),'utf8')]);
 assert.match(shell,/#skillsPanel\.game-management \.loadout-card-tools>button,#skillsPanel\.game-management \.loadout-card-tools \.ability-drag-handle\{height:44px;min-height:44px\}/);
 assert.match(collection,/#skillsPanel button,#skillsPanel input,#skillsPanel select,#skillsPanel summary,#skillsPanel \.ability-drag-handle\{min-height:44px!important\}/);
 assert.match(shell,/#skillsPanel\.game-management \.loadout-owned-list\{overflow:auto;min-height:0\}/);
 assert.match(shell,/#skillsPanel\.game-management \.loadout-workspace\{display:flex;flex-direction:column;overflow:auto\}/);
 assert.match(shell,/\.loadout-owned-list\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\);overflow:visible;flex:none\}/);
 assert.doesNotMatch(shell,/loadout-unit-deployment[^{}]*\{[^}]*(?:height|max-height):\d/);
});

test('all 12 unit cards expose one source-grounded deployment entry and price in the accessible button name',async t=>{
 const ui=await ready(t);selectType(ui,'army');assert.equal(ui.get('ownedSkillList').querySelectorAll('article').length,12);
 for(const id of REGULAR_RECRUIT_IDS){const card=ui.get('owned-'+id),facts=card.querySelector('.loadout-card-facts'),entry=SKILLS[id].summon,price=`${entry.cost} gold · ${entry.amount*entry.population} reserve`;
  assert.equal(facts.classList.contains('loadout-unit-deployment'),true,id);assert.equal(facts.children.length,2);assert.ok(facts.children[1].textContent.includes(price));assert.equal(facts.children[1].querySelector('small').textContent,'Deploy');assert.equal(card.querySelectorAll('.loadout-unit-deployment').length,1);assert.ok(card.getAttribute('aria-label').includes('Deploy '+price+'.'),id);
 }
});

test('shots and waves gain no compact deployment rows or deployment claims',async t=>{
 const ui=await ready(t);
 for(const type of ['arrows','waves']){selectType(ui,type);assert.equal(ui.get('ownedSkillList').querySelectorAll('.loadout-unit-deployment').length,0);for(const card of ui.get('ownedSkillList').querySelectorAll('.loadout-card-select')){assert.doesNotMatch(card.getAttribute('aria-label'),/Deploy /);assert.equal(card.querySelector('.loadout-card-facts').children.length,2);}}
});

test('job filtering, inspection, cancel and placement preserve campaign economy, cooldowns and reserve',async t=>{
 const ui=await ready(t),profile=ui.battle.profile;selectType(ui,'army');change(ui,'loadoutRole','job:runner');const mount=profile.skills.find(s=>s.id==='mount'),before=serializeProfile(profile),economy={gold:profile.gold,population:ui.battle.friendlyQueue.population,cooldown:mount.cooldown};
 ui.click('owned-mount');ui.click('loadout-inspect-mount');ui.click('loadoutCloseInspector');assert.equal(ui.get('loadoutRole').value,'job:runner');ui.click('cancelBinding');assert.equal(serializeProfile(profile),before);
 ui.click('owned-mount');ui.click('assign-29');assert.equal(mount.binding,29);assert.deepEqual({gold:profile.gold,population:ui.battle.friendlyQueue.population,cooldown:mount.cooldown},economy);assert.match(ui.get('owned-mount').getAttribute('aria-label'),/Deploy 30 gold · 4 reserve/);
});

test('300-record renderer remains bounded and uses explicit squad data, never card name or artwork to infer deployment',async t=>{
 const ui=await loadGameUI(t),root=ui.get('skillsPanel'),base=buildArmoryRecords(SKILLS,COMPANIONS,{}),mount=base.find(x=>x.id==='mount'),arrow=base.find(x=>x.id==='arrow');
 const records=Array.from({length:300},(_,i)=>({...(i%2?mount:arrow),id:'future-'+i,name:'Horse Riders',portraitId:'mount',squad:i%2?{gold:81,size:3,reserve:9}:null}));
 const skills=records.map((item,i)=>({id:item.id,rank:0,binding:i<30?i:-1,xp:0,threshold:100,cooldown:0})),profile={rank:1,gold:1000,difficulty:'medium',skills,companionId:null},layout=new ActionBarLayout(skills);
 const view=createLoadoutCollectionUI({root,records,getState:()=>({layout,profile,bar:0,selected:null,armed:false}),icon:()=>'',bindingLabel:x=>x<0?'Reserve':String(x),onSelect:()=>{},onMove:()=>{},onBar:()=>{}});t.after(()=>view.dispose());
 const counts=[];for(let page=0;page<25;page++){view.model.setView({page,sort:'name'});view.render();const list=root.querySelector('#ownedSkillList');assert.equal(list.querySelectorAll('article').length,12);for(const card of list.querySelectorAll('.loadout-card-select')){const id=card.id.slice(6),record=records.find(x=>x.id===id),facts=card.querySelector('.loadout-card-facts');assert.equal(facts.classList.contains('loadout-unit-deployment'),!!record.squad);if(record.squad){assert.ok(facts.children[1].textContent.includes('81 gold · 9 reserve'));assert.equal(facts.children[1].querySelector('small').textContent,'Deploy');}else assert.doesNotMatch(card.getAttribute('aria-label'),/Deploy /);}counts.push(list.querySelectorAll('.loadout-card-facts').length);}
 assert.deepEqual(new Set(counts),new Set([12]));
});
