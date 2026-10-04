import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
import {modalFocusCandidates} from '../site/dist/modal-focus.mjs';
import {buildArmoryRecords} from '../site/dist/armory-catalog-data.mjs';
import {SKILLS,serializeProfile} from '../site/dist/engine/progression.mjs';
import {COMPANIONS} from '../site/dist/engine/recruitment.mjs';
import {createLoadoutCollectionUI} from '../site/dist/loadout-collection.mjs';
const records=buildArmoryRecords(SKILLS,COMPANIONS,{});
const query=(ui,text)=>{ui.get('loadoutSearch').value=text;ui.dispatch(ui.get('loadoutSearch'),'input');};
const choose=(ui,value)=>{ui.get('loadoutCompareDetails').setAttribute('open','');ui.get('loadoutCompareTarget').value=String(value);ui.dispatch(ui.get('loadoutCompareTarget'),'change');};
const skill=(ui,id)=>ui.battle.profile.skills.find(s=>s.id===id);
const inspect=(ui,id)=>{query(ui,SKILLS[id].name);ui.click('loadout-inspect-'+id);};
const numberDetails=ui=>ui.get('loadoutCompareResult').querySelector('.loadout-compare-numbers');
const orders=ui=>ui.get('loadoutCompareResult').querySelector('.loadout-compare-orders').querySelectorAll('article');
const unchanged=ui=>JSON.stringify({profile:serializeProfile(ui.battle.profile),tick:ui.battle.tick,queue:ui.battle.friendlyQueue.queue,reserve:ui.battle.friendlyQueue.population,stats:ui.battle.stats});
async function editor(t){const ui=await loadGameUI(t,{search:'?mode=test'});ui.click('introTesting');ui.click('testUnlock');ui.click('closeTesting');ui.click('introLoadout');return ui;}
function disclosureAncestor(node){for(let a=node.parentElement;a;a=a.parentElement)if(a.tagName==='DETAILS')return a;return null;}

test('comparison flow: ordinary inspection retains expanded source facts, notes, description and placement label',async t=>{
 const ui=await editor(t);inspect(ui,'priest');
 assert.equal(ui.get('loadoutInspector').getAttribute('data-comparing'),'false');assert.equal(ui.get('loadoutInspectorSource').getAttribute('open'),'');
 assert.equal(ui.get('loadoutInspectorSourceSummary').hidden,true);assert.equal(ui.get('loadoutInspectorSourceDescription').hidden,true);
 assert.match(ui.get('selectedSkillDescription').textContent,/Two healers/);assert.match(ui.get('loadoutInspectorFacts').textContent,/Base heal power/);assert.match(ui.get('loadoutInspectorNotes').textContent,/Cannot heal vehicles/);
 assert.equal(ui.get('loadoutInspectorSelect').textContent,'Select Priest for placement');assert.equal(ui.get('loadoutCompareDetails').getAttribute('open'),null);
 assert.ok(!modalFocusCandidates(ui.get('loadoutInspector')).includes(ui.get('loadoutInspectorSourceSummary')));
});

test('comparison flow: default decision contains consequence, job delta and both current-rank costs before closed detail',async t=>{
 const ui=await editor(t);query(ui,'Priest');ui.click('owned-priest');ui.click('unbindSkill');skill(ui,'priest').rank=3;skill(ui,'priest').threshold=400;skill(ui,'mount').rank=7;skill(ui,'mount').threshold=800;ui.click('loadout-inspect-priest');
 const before=unchanged(ui);choose(ui,skill(ui,'mount').binding);const result=ui.get('loadoutCompareResult'),children=result.children;
 assert.deepEqual(children.slice(0,3).map(n=>n.classList.contains('loadout-compare-summary')?'consequence':n.classList.contains('loadout-compare-jobs')?'jobs':n.classList.contains('loadout-compare-orders')?'costs':'other'),['consequence','jobs','costs']);
 assert.match(children[0].textContent,/Horse Riders would move to reserve and stay owned/);assert.match(children[1].textContent,/Gained: Healing/);assert.match(children[1].textContent,/Lost last provider: Fast flag runners/);assert.match(children[1].textContent,/Retained: Flag carriers \(4 providers\)/);
 const [source,target]=orders(ui);assert.match(source.textContent,/PriestRank 3/);assert.match(target.textContent,/Horse RidersRank 7/);assert.match(source.textContent,/30 gold · 2 reserve \/ 2-unit squad/);assert.match(target.textContent,/30 gold · 4 reserve \/ 4-unit squad/);assert.match(target.textContent,/In reserve: no reload or Auto-recruit. Deployed troops stay/);
 assert.equal(numberDetails(ui).getAttribute('open'),null);assert.equal(ui.get('loadoutInspectorSource').getAttribute('open'),null);assert.equal(ui.get('loadoutInspectorSourceSummary').hidden,false);
 assert.equal(disclosureAncestor(result.querySelector('.loadout-compare-cards')),numberDetails(ui));assert.equal(disclosureAncestor(ui.get('loadoutInspectorFacts')),ui.get('loadoutInspectorSource'));
 assert.equal(ui.get('loadoutInspector').getAttribute('data-comparing'),'true');assert.equal(ui.get('loadoutCompareNotice').classList.contains('hidden'),true);assert.equal(unchanged(ui),before);
});

test('comparison flow: Auto on and off warnings stay immediate with exact per-squad costs on an equipped swap',async t=>{
 const ui=await editor(t);skill(ui,'priest').autocast=true;inspect(ui,'priest');choose(ui,skill(ui,'mount').binding);
 const [source,target]=orders(ui);assert.match(source.textContent,/30 gold · 2 reserve \/ 2-unit squadAuto on: after Start or Resume, repeats when ready and resources allow/);assert.match(target.textContent,/30 gold · 4 reserve \/ 4-unit squadAuto off · manual squads only/);
 assert.match(ui.get('loadoutCompareResult').children[0].textContent,/would swap keys/);assert.match(ui.get('loadoutCompareResult').children[1].textContent,/No equipped army jobs change/);assert.equal(source.querySelector('details'),null);assert.equal(target.querySelector('details'),null);
});

test('comparison flow: bow identities and unequal current ranks remain immediate without invented squad costs',async t=>{
 const ui=await editor(t);skill(ui,'fireArrow').rank=4;skill(ui,'iceArrow').rank=2;inspect(ui,'fireArrow');choose(ui,skill(ui,'iceArrow').binding);
 const [source,target]=orders(ui);assert.match(source.textContent,/Fire ArrowRank 4No squad deployment cost/);assert.match(target.textContent,/Ice ArrowRank 2No squad deployment cost/);assert.doesNotMatch(source.textContent+target.textContent,/0 gold|0 reserve|Auto on|Auto off/);
 assert.match(numberDetails(ui).textContent,/same measure, unit and scope only/);assert.match(numberDetails(ui).textContent,/not a total damage or strength rating/);assert.ok(ui.get('selectedSkillIcon').children.length>0);
});

test('comparison flow: current-rank scopes, missing measures and both tactics remain available in closed numeric detail',async t=>{
 const ui=await editor(t);inspect(ui,'priest');choose(ui,skill(ui,'mount').binding);const detail=numberDetails(ui);detail.setAttribute('open','');
 assert.match(detail.textContent,/50 HPper unit/);assert.match(detail.textContent,/125 HPper unit/);assert.match(detail.textContent,/No verified value/);assert.match(detail.textContent,/before random bonus and missing-health cap/);assert.match(detail.textContent,/Cannot heal vehicles/);assert.match(detail.textContent,/Takes 1.2× blunt damage/);
 ui.get('loadoutInspectorSource').setAttribute('open','');assert.equal(ui.get('loadoutInspectorSourceDescription').textContent,ui.get('selectedSkillDescription').textContent);assert.match(ui.get('loadoutInspectorNotes').textContent,/Know the tradeoff/);assert.equal(ui.battle.tick,0);
});

test('comparison flow: every disclosure summary remains in the trap, with Select last and Back first',async t=>{
 const ui=await editor(t);inspect(ui,'priest');choose(ui,skill(ui,'mount').binding);const root=ui.get('loadoutInspector'),summaries=root.querySelectorAll('summary');
 for(const summary of summaries){assert.ok(modalFocusCandidates(root).includes(summary));summary.focus();const event=ui.dispatch(summary,'keydown',{key:'Tab'}).event;assert.equal(event.defaultPrevented,false);assert.equal(ui.document.activeElement,summary);}
 ui.get('loadoutInspectorSelect').focus();assert.equal(ui.dispatch(ui.get('loadoutInspectorSelect'),'keydown',{key:'Tab'}).event.defaultPrevented,true);assert.equal(ui.document.activeElement.id,'loadoutCloseInspector');
 ui.get('loadoutCloseInspector').focus();ui.dispatch(ui.get('loadoutCloseInspector'),'keydown',{key:'Tab',shiftKey:true});assert.equal(ui.document.activeElement.id,'loadoutInspectorSelect');
});

test('comparison flow: No comparison restores full ordinary inspection and hides only the extra source summary',async t=>{
 const ui=await editor(t);inspect(ui,'priest');const oldFacts=ui.get('loadoutInspectorFacts').textContent,oldNotes=ui.get('loadoutInspectorNotes').textContent;choose(ui,skill(ui,'mount').binding);choose(ui,'');
 assert.equal(ui.get('loadoutInspector').getAttribute('data-comparing'),'false');assert.equal(ui.get('loadoutInspectorSource').getAttribute('open'),'');assert.equal(ui.get('loadoutInspectorSourceSummary').hidden,true);assert.equal(ui.get('loadoutInspectorSourceDescription').hidden,true);
 assert.equal(ui.get('loadoutInspectorFacts').textContent,oldFacts);assert.equal(ui.get('loadoutInspectorNotes').textContent,oldNotes);assert.equal(ui.get('loadoutCompareResult').textContent,'');assert.equal(ui.get('loadoutCompareNotice').classList.contains('hidden'),false);assert.equal(ui.get('loadoutInspectorSelect').textContent,'Select Priest for placement');assert.equal(ui.document.activeElement.id,'loadoutCompareTarget');
});

test('comparison flow: collapse and Escape retain prior arm, search, scroll, resources and return focus',async t=>{
 const ui=await editor(t);ui.click('owned-fireArrow');inspect(ui,'priest');ui.get('ownedSkillList').scrollTop=71;ui.get('loadoutWorkspace').scrollTop=29;const before=unchanged(ui);choose(ui,skill(ui,'mount').binding);numberDetails(ui).setAttribute('open','');ui.get('loadoutInspectorSource').setAttribute('open','');ui.get('loadoutCompareDetails').removeAttribute('open');ui.key('keydown','Escape');
 assert.equal(ui.visible('loadoutInspector'),false);assert.equal(ui.get('loadoutSelectionName').textContent,'Fire Arrow');assert.equal(ui.get('loadoutSearch').value,'Priest');assert.equal(ui.get('ownedSkillList').scrollTop,71);assert.equal(ui.get('loadoutWorkspace').scrollTop,29);assert.equal(ui.document.activeElement.id,'loadout-inspect-priest');assert.equal(unchanged(ui),before);
 ui.click('loadout-inspect-priest');assert.equal(ui.get('loadoutInspector').getAttribute('data-comparing'),'false');assert.equal(ui.get('loadoutCompareTarget').value,'');assert.equal(ui.get('loadoutInspectorSource').getAttribute('open'),'');choose(ui,skill(ui,'mount').binding);assert.equal(numberDetails(ui).getAttribute('open'),null);assert.equal(ui.get('loadoutInspectorSource').getAttribute('open'),null);
});

test('comparison flow: stale review exits compact mode and cannot arm until an explicit fresh choice',async t=>{
 const ui=await editor(t);ui.click('owned-fireArrow');inspect(ui,'priest');choose(ui,skill(ui,'mount').binding);skill(ui,'mount').binding=-1;ui.click('loadoutInspectorSelect');
 assert.equal(ui.get('loadoutInspector').getAttribute('data-comparing'),'false');assert.equal(ui.get('loadoutInspectorSource').getAttribute('open'),'');assert.equal(ui.get('loadoutCompareNotice').classList.contains('hidden'),false);assert.match(ui.get('loadoutCompareNotice').textContent,/loadout changed/);assert.equal(ui.get('loadoutInspectorSelect').disabled,true);assert.equal(ui.get('loadoutSelectionName').textContent,'Fire Arrow');assert.equal(ui.document.activeElement.id,'loadoutCompareTarget');choose(ui,'');assert.equal(ui.get('loadoutInspectorSelect').disabled,false);
});

test('comparison flow: harmless actual-component render preserves opened comparisons and focused summary identity',async t=>{
 const ui=await editor(t),root=ui.get('skillsPanel');let layout;const profile=ui.battle.profile;
 const {ActionBarLayout}=await import('../site/dist/engine/action-bar-layout.mjs');layout=new ActionBarLayout(profile.skills);
 const component=createLoadoutCollectionUI({root,records,getState:()=>({layout,profile,selected:null,armed:false,bar:0,message:''}),icon:()=>'',bindingLabel:n=>n<0?'Reserve':`Key ${n+1}`,onSelect:()=>{},onMove:()=>{},onBar:()=>{}});t.after(()=>component.dispose());component.render();inspect(ui,'priest');choose(ui,skill(ui,'mount').binding);
 const detail=numberDetails(ui),summary=detail.querySelector('summary');detail.setAttribute('open','');ui.get('loadoutInspectorSource').setAttribute('open','');summary.focus();component.render();assert.equal(numberDetails(ui),detail);assert.equal(detail.getAttribute('open'),'');assert.equal(ui.get('loadoutInspectorSource').getAttribute('open'),'');assert.equal(ui.document.activeElement,summary);
});

test('comparison flow: compact styling is Inspector-scoped, non-sticky, touch-sized and leaves ordinary source wrapper boxless',async()=>{
 const css=await readFile(new URL('../site/dist/loadout-collection.css',import.meta.url),'utf8'),scope=css.slice(css.indexOf('/* Decision-first comparison;'));
 assert.match(scope,/data-comparing=false[\s\S]*display:contents/);assert.match(scope,/>#selectedSkillIcon\{width:48px;height:48px/);assert.match(scope,/loadout-compare-orders\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);assert.match(scope,/@media\(max-width:480px\)/);assert.match(scope,/grid-template-columns:minmax\(0,1fr\)/);assert.match(scope,/min-height:44px/);assert.match(scope,/loadout-compare-cost\{font-size:14px/);
 assert.doesNotMatch(scope,/position:|loadout-workspace|loadout-placement|loadout-inventory|height:100|overflow:hidden/);
});

test('comparison flow: unknown copied artwork keeps its name and rank but no fabricated default cost or jobs',async t=>{
 const ui=await editor(t),root=ui.get('skillsPanel'),profile=ui.battle.profile,id='future-horse';profile.skills.push({id,rank:3,binding:-1,autocast:true});profile.owned.add(id);
 const {ActionBarLayout}=await import('../site/dist/engine/action-bar-layout.mjs'),layout=new ActionBarLayout(profile.skills),unknown={...records.find(r=>r.id==='mount'),id,name:'Future Horse',portraitId:'mount'};
 const component=createLoadoutCollectionUI({root,records:[...records,unknown],getState:()=>({layout,profile,selected:null,armed:false,bar:0,message:''}),icon:()=>'',bindingLabel:n=>n<0?'Reserve':`Key ${n+1}`,onSelect:()=>{},onMove:()=>{},onBar:()=>{}});t.after(()=>component.dispose());component.render();query(ui,'Future Horse');ui.click('loadout-inspect-'+id);choose(ui,skill(ui,'mount').binding);
 assert.match(orders(ui)[0].textContent,/Future HorseRank 3No verified squad cost/);assert.doesNotMatch(orders(ui)[0].textContent,/0 gold|0 reserve|Auto on|Auto off/);assert.match(ui.get('loadoutCompareResult').textContent,/excluded from these job counts/);assert.match(numberDetails(ui).textContent,/No verified value/);assert.match(numberDetails(ui).textContent,/No verified ability details/);
});
