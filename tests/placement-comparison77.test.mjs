import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildArmoryRecords} from '../site/dist/armory-catalog-data.mjs';
import {SKILLS,PlayerProfile,serializeProfile} from '../site/dist/engine/progression.mjs';
import {COMPANIONS} from '../site/dist/engine/recruitment.mjs';
import {ActionBarLayout} from '../site/dist/engine/action-bar-layout.mjs';
import {placeLoadoutAbility} from '../site/dist/loadout-ui-model.mjs';
import {capturePlacementComparison,isPlacementComparisonCurrent,compareInsightMetrics,placementComparison} from '../site/dist/placement-comparison.mjs';
import {getCardInsights} from '../site/dist/armory-insights.mjs';
import {createLoadoutCollectionUI} from '../site/dist/loadout-collection.mjs';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
const records=buildArmoryRecords(SKILLS,COMPANIONS,{});
const fixture=(ids=['grunt','mount','priest'])=>{const profile=new PlayerProfile();for(const id of ids)profile.addSkill(id);profile.gold=567;return {profile,layout:new ActionBarLayout(profile.skills)};};
const wrapper=(state,id)=>state.layout.dragIcons.find(w=>w.skill.id===id);
const preview=(state,id,target)=>placementComparison(records,state,id,typeof target==='string'?wrapper(state,target).binding:target);
const select=(ui,id,value)=>{ui.get(id).value=String(value);ui.dispatch(ui.get(id),'change');};
const search=(ui,value)=>{ui.get('loadoutSearch').value=value;ui.dispatch(ui.get('loadoutSearch'),'input');};
async function editor(t){const ui=await loadGameUI(t,{search:'?mode=test'});ui.click('introTesting');ui.click('testUnlock');ui.click('closeTesting');ui.click('introLoadout');return ui;}
const inspect=(ui,id)=>{search(ui,SKILLS[id].name);ui.click('loadout-inspect-'+id);};
const stateRecord=ui=>JSON.stringify({profile:serializeProfile(ui.battle.profile),timers:ui.battle.profile.skills.map(s=>[s.id,s.cooldown,s.strobe,s.autocast]),tick:ui.battle.tick,reserve:ui.battle.friendlyQueue.population,queue:ui.battle.friendlyQueue.queue,stats:ui.battle.stats});

test('reserve replacement predicts actual unique membership and last-provider loss without losing retained flag coverage',()=>{
 const state=fixture();placeLoadoutAbility(state.layout,wrapper(state,'priest'),-1);const from=serializeProfile(state.profile),p=preview(state,'priest','mount');
 assert.equal(p.kind,'replace');assert.deepEqual(p.added,['priest']);assert.deepEqual(p.removed,['mount']);assert.deepEqual(p.gained.map(x=>x.id),['job:sustain']);assert.deepEqual(p.lost.map(x=>x.id),['job:runner']);assert.deepEqual(p.retained.map(x=>[x.id,x.after]),[['job:flag',['grunt']]]);assert.equal(serializeProfile(state.profile),from);
 placeLoadoutAbility(state.layout,wrapper(state,'priest'),wrapper(state,'mount').binding);assert.deepEqual(state.layout.slots.filter(s=>s.holding).map(s=>s.holding.skill.id).sort(),p.after.sort());assert.equal(wrapper(state,'mount').skill.binding,-1);assert.equal(state.profile.owned.has('mount'),true);
});
test('already-equipped swap has exactly zero membership and job deltas, even across different jobs',()=>{
 const state=fixture(),p=preview(state,'priest','mount');assert.equal(p.kind,'swap');assert.deepEqual(p.added,[]);assert.deepEqual(p.removed,[]);assert.deepEqual(p.gained,[]);assert.deepEqual(p.lost,[]);assert.deepEqual(p.retained,[]);for(const job of p.jobs)assert.deepEqual(job.before,job.after);
 const source=wrapper(state,'priest'),target=wrapper(state,'mount'),from=source.binding,to=target.binding;placeLoadoutAbility(state.layout,source,to);assert.equal(source.binding,to);assert.equal(target.binding,from);assert.deepEqual(state.layout.slots.filter(s=>s.holding).map(s=>s.holding.skill.id).sort(),p.after.sort());
});
test('same slot, empty slot and an equipped move cannot fabricate a removed card or lost job',()=>{
 const state=fixture();for(const target of ['mount',29]){const p=preview(state,'mount',target);assert.equal(p.kind,target==='mount'?'unchanged':'move');assert.deepEqual(p.added,[]);assert.deepEqual(p.removed,[]);assert.deepEqual(p.gained,[]);assert.deepEqual(p.lost,[]);}
 placeLoadoutAbility(state.layout,wrapper(state,'priest'),-1);const added=preview(state,'priest',29);assert.deepEqual(added.added,['priest']);assert.equal(added.target,null);assert.deepEqual(added.removed,[]);assert.deepEqual(added.gained.map(x=>x.id),['job:sustain']);
});
test('replacing the last flag contract reports the actual loss but no invented bow role coverage',()=>{
 const state=fixture(['mount','fireArrow']);placeLoadoutAbility(state.layout,wrapper(state,'fireArrow'),-1);const p=preview(state,'fireArrow','mount');assert.deepEqual(p.lost.map(x=>x.id),['job:flag','job:runner']);assert.deepEqual(p.gained,[]);assert.equal(p.source.tactics,null);assert.ok(p.source.insights.metrics.some(x=>x.key==='impactDamage'));assert.equal(p.source.deployment,null);
});
test('current owned ranks and difficulty are passed to engine-grounded insights; values are not equalized',()=>{
 const state=fixture(['grunt','tallGrunt']);wrapper(state,'grunt').skill.rank=7;wrapper(state,'tallGrunt').skill.rank=2;state.profile.rank=9;state.profile.difficulty='hard';const p=preview(state,'grunt','tallGrunt');
 assert.equal(p.source.rank,7);assert.equal(p.target.rank,2);assert.deepEqual(p.source.insights,getCardInsights('grunt',{rank:7,heroRank:9,difficulty:'hard'}));assert.deepEqual(p.target.insights,getCardInsights('tallGrunt',{rank:2,heroRank:9,difficulty:'hard'}));assert.equal(p.source.deployment.gold,SKILLS.grunt.summon.cost);assert.equal(p.source.deployment.units,4);assert.equal(p.source.deployment.reserve,4);assert.equal(p.source.deployment.automatic,true);
 const hp=p.metrics.find(x=>x.key==='perUnitHp');assert.equal(hp.comparable,true);assert.equal(hp.delta,hp.source.value-hp.target.value);
});
test('metric deltas require exact key, scope and unit, retain absent values and reject nonfinite numbers',()=>{
 const m=(key,value=10,unit='damage',scope='per direct hit')=>({key,label:key,value,unit,scope});
 const rows=compareInsightMetrics({metrics:[m('same',15),m('scope'),m('unit'),m('infinite',Infinity),m('left')]},{metrics:[m('same',10),m('scope',10,'damage','per pulse'),m('unit',10,'HP'),m('infinite',10),m('right')]});
 assert.equal(rows.find(x=>x.key==='same').delta,5);for(const key of ['scope','unit','infinite','left','right']){assert.equal(rows.find(x=>x.key===key).comparable,false);assert.equal(rows.find(x=>x.key===key).delta,null);}assert.equal(rows.find(x=>x.key==='left').target,null);assert.equal(rows.find(x=>x.key==='right').source,null);
});
test('unknown IDs and copied troop artwork gain no verified jobs, deployment or combat numbers',()=>{
 const state=fixture(['mount']),unknown={id:'future-horse',rank:3,binding:-1,autocast:true};state.profile.skills.push(unknown);state.profile.owned.add(unknown.id);state.layout=new ActionBarLayout(state.profile.skills);const copy={...records.find(x=>x.id==='mount'),id:unknown.id,name:'Future Horse',portraitId:'mount'};
 const p=placementComparison([...records,copy],state,unknown.id,wrapper(state,'mount').binding);assert.equal(p.source.tactics,null);assert.equal(p.source.deployment,null);assert.deepEqual(p.source.insights.metrics,[]);assert.deepEqual(p.gained,[]);assert.deepEqual(p.unverified,[unknown.id]);assert.ok(p.metrics.every(x=>x.source===null&&x.delta===null));
});
test('closed, missing, malformed or inconsistent bindings fail safely rather than double-count roles',()=>{
 const state=fixture();for(const target of [-1,30,1.5,NaN,'1'])assert.equal(placementComparison(records,state,'priest',target),null);assert.equal(preview(state,'absent',1),null);
 wrapper(state,'mount').skill.binding=0;assert.equal(preview(state,'priest',1),null);wrapper(state,'mount').skill.binding=wrapper(state,'mount').binding;
 state.layout.slots[28].holding=wrapper(state,'mount');assert.equal(preview(state,'priest',1),null);state.layout.slots[28].holding=null;state.layout.close();assert.equal(preview(state,'priest',1),null);
});
test('comparison tokens revalidate source, target, ownership, profile and layout identities without writing',()=>{
 const state=fixture(),to=wrapper(state,'mount').binding,plan=capturePlacementComparison(state,'priest',to);assert.equal(isPlacementComparisonCurrent(plan,state),true);
 assert.equal(isPlacementComparisonCurrent(plan,{...state,profile:{...state.profile}}),false);assert.equal(isPlacementComparisonCurrent(plan,{...state,layout:new ActionBarLayout(state.profile.skills)}),false);
 state.profile.owned.delete('mount');assert.equal(isPlacementComparisonCurrent(plan,state),false);state.profile.owned.add('mount');assert.equal(isPlacementComparisonCurrent(plan,state),true);
 placeLoadoutAbility(state.layout,wrapper(state,'mount'),29);assert.equal(isPlacementComparisonCurrent(plan,state),false);
 const again=capturePlacementComparison(state,'priest',29);placeLoadoutAbility(state.layout,wrapper(state,'priest'),28);assert.equal(isPlacementComparisonCurrent(again,state),false);
});
test('actual Inspector preview is read-only and cancel preserves armed intent, filtering, bar and focus',async t=>{
 const ui=await editor(t);ui.click('owned-fireArrow');search(ui,'priest');ui.document.querySelector('[data-loadout-bar="2"]').click();ui.get('loadoutWorkspace').scrollTop=17;ui.get('ownedSkillList').scrollTop=53;ui.click('loadout-inspect-priest');
 ui.battle.profile.skills.find(s=>s.id==='priest').autocast=true;const before=stateRecord(ui),to=ui.battle.profile.skills.find(s=>s.id==='mount').binding;select(ui,'loadoutCompareTarget',to);assert.match(ui.get('loadoutCompareResult').textContent,/would swap keys/);assert.match(ui.get('loadoutCompareResult').textContent,/No equipped army jobs change/);assert.match(ui.get('loadoutCompareResult').textContent,/After Start or Resume.*repeatedly spend 30 gold and 2 reserve/);assert.equal(stateRecord(ui),before);assert.equal(ui.get('loadoutSelectionName').textContent,'Fire Arrow');
 ui.key('keydown','Escape');assert.equal(ui.visible('loadoutInspector'),false);assert.equal(ui.get('loadoutSearch').value,'priest');assert.equal(ui.get('loadoutWorkspace').scrollTop,17);assert.equal(ui.get('ownedSkillList').scrollTop,53);assert.equal(ui.document.activeElement.id,'loadout-inspect-priest');assert.equal(ui.get('loadoutSelectionName').textContent,'Fire Arrow');assert.equal(ui.document.querySelector('[data-loadout-bar="2"]').getAttribute('aria-pressed'),'true');assert.equal(stateRecord(ui),before);
});
test('comparison selection arms and focuses the reviewed key; ordinary placement still needs only its next tap or Enter',async t=>{
 const ui=await editor(t),profile=ui.battle.profile,priest=profile.skills.find(s=>s.id==='priest'),mount=profile.skills.find(s=>s.id==='mount'),from=priest.binding,to=mount.binding;
 inspect(ui,'priest');const before=stateRecord(ui);select(ui,'loadoutCompareTarget',to);ui.click('loadoutInspectorSelect');assert.equal(ui.visible('loadoutInspector'),false);assert.equal(ui.document.activeElement.id,'assign-'+to);assert.equal(ui.get('loadoutSelectionName').textContent,'Priest');assert.equal(stateRecord(ui),before);assert.equal(ui.document.querySelector(`[data-loadout-bar="${Math.floor(to/10)}"]`).getAttribute('aria-pressed'),'true');
 ui.dispatch(ui.get('assign-'+to),'click',{detail:0});assert.equal(priest.binding,to);assert.equal(mount.binding,from);assert.equal(ui.battle.tick,0);assert.equal(ui.get('cancelBinding').disabled,true);
});
test('reserve comparison shows last-provider effects and placement keeps displaced card, gold and timers',async t=>{
 const ui=await editor(t),profile=ui.battle.profile,priest=profile.skills.find(s=>s.id==='priest'),mount=profile.skills.find(s=>s.id==='mount'),to=mount.binding;
 search(ui,'priest');ui.click('owned-priest');ui.click('unbindSkill');const money=profile.gold,cooldowns=profile.skills.map(s=>s.cooldown),count=profile.owned.size;
 ui.click('loadout-inspect-priest');select(ui,'loadoutCompareTarget',to);assert.match(ui.get('loadoutCompareResult').textContent,/would move to reserve and stay owned/);assert.match(ui.get('loadoutCompareResult').textContent,/last equipped provider of Fast flag runners/);assert.match(ui.get('loadoutCompareResult').textContent,/Flag carriers still covered/);assert.doesNotMatch(ui.get('loadoutCompareResult').textContent,/last equipped provider of Flag carriers/);
 ui.click('loadoutInspectorSelect');ui.click('assign-'+to);assert.equal(priest.binding,to);assert.equal(mount.binding,-1);assert.equal(profile.gold,money);assert.equal(profile.owned.size,count);assert.deepEqual(profile.skills.map(s=>s.cooldown),cooldowns);
});
test('stale target at Select blocks arming, clears comparison, and requires a new explicit choice',async t=>{
 const ui=await editor(t);ui.click('owned-fireArrow');inspect(ui,'priest');const target=ui.battle.profile.skills.find(s=>s.id==='mount');select(ui,'loadoutCompareTarget',target.binding);target.binding=-1;ui.click('loadoutInspectorSelect');
 assert.equal(ui.visible('loadoutInspector'),true);assert.equal(ui.get('loadoutInspectorSelect').disabled,true);assert.equal(ui.get('loadoutSelectionName').textContent,'Fire Arrow');assert.match(ui.get('loadoutCompareNotice').textContent,/loadout changed/);assert.equal(ui.get('loadoutCompareTarget').value,'changed');assert.equal(ui.get('loadoutCompareResult').textContent,'');assert.equal(ui.document.activeElement.id,'loadoutCompareTarget');select(ui,'loadoutCompareTarget','');assert.equal(ui.get('loadoutInspectorSelect').disabled,false);ui.click('loadoutCloseInspector');assert.equal(ui.get('loadoutSelectionName').textContent,'Fire Arrow');
});
test('repeated inspection starts without an old target and the picker remains bounded by occupied keys',async t=>{
 const ui=await editor(t);inspect(ui,'priest');select(ui,'loadoutCompareTarget',0);ui.click('loadoutCloseInspector');ui.click('loadout-inspect-priest');assert.equal(ui.get('loadoutCompareTarget').value,'');assert.equal(ui.get('loadoutCompareResult').textContent,'');assert.equal(ui.get('loadoutInspectorSelect').disabled,false);assert.equal(ui.get('loadoutCompareTarget').querySelectorAll('option').length,25);assert.equal(ui.get('ownedSkillList').querySelectorAll('article').length,1);
});
test('single-card starting deck gives an honest empty comparison and keeps ordinary placement available',async t=>{
 const ui=await loadGameUI(t);ui.click('introLoadout');ui.click('loadout-inspect-arrow');assert.equal(ui.get('loadoutCompareTarget').disabled,true);assert.match(ui.get('loadoutCompareNotice').textContent,/No other equipped cards/);assert.equal(ui.get('loadoutInspectorSelect').disabled,false);ui.click('loadoutInspectorSelect');assert.equal(ui.document.activeElement.id,'assign-0');assert.equal(ui.get('loadoutSelectionName').textContent,'Basic Arrow');
});
test('actual component rejects an old profile Select handler and clears inspection on profile or layout replacement',async t=>{
 const ui=await editor(t),root=ui.get('skillsPanel');let current=fixture(),selected=null,armed=false,bar=0,calls=0;
 const component=createLoadoutCollectionUI({root,records,getState:()=>({...current,selected,armed,bar,message:''}),icon:()=>'',bindingLabel:n=>n<0?'Reserve':`Bar ${Math.floor(n/10)+1} · key ${n%10+1}`,onSelect:w=>{calls++;selected=w;armed=true;},onMove:()=>{},onBar:n=>{bar=n;}});t.after(()=>component.dispose());component.render();root.querySelector('#loadout-inspect-priest').click();root.querySelector('#loadoutCompareTarget').value='2';ui.dispatch(root.querySelector('#loadoutCompareTarget'),'change');const stale=root.querySelector('#loadoutInspectorSelect').onclick;
 current=fixture();stale();assert.equal(calls,0);assert.equal(root.querySelector('#loadoutInspector').classList.contains('hidden'),true);component.render();root.querySelector('#loadout-inspect-priest').click();current.layout=new ActionBarLayout(current.profile.skills);component.render();assert.equal(root.querySelector('#loadoutInspector').classList.contains('hidden'),true);assert.equal(calls,0);
});
test('large collection comparison does not infer copied jobs or render hundreds of target options',async t=>{
 const ui=await editor(t),root=ui.get('skillsPanel');const expanded=[...records,...Array.from({length:300},(_,i)=>({...records.find(x=>x.id==='mount'),id:'custom-'+i,name:'Unverified '+i}))],skills=expanded.filter(x=>x.kind==='skill').map((x,i)=>({id:x.id,rank:0,binding:i<30?i:-1,autocast:false})),profile={skills,owned:new Set(skills.map(x=>x.id)),rank:1,difficulty:'medium',gold:0},layout=new ActionBarLayout(skills);
 const component=createLoadoutCollectionUI({root,records:expanded,getState:()=>({layout,profile,bar:0,selected:null,armed:false,message:''}),icon:()=>'',bindingLabel:n=>String(n),onSelect:()=>{},onMove:()=>{},onBar:()=>{}});t.after(()=>component.dispose());component.render();root.querySelector('#loadout-inspect-arrow').click();assert.equal(root.querySelector('#loadoutCompareTarget').querySelectorAll('option').length,30);assert.equal(root.querySelector('#ownedSkillList').querySelectorAll('article').length,12);root.querySelector('#loadoutCompareTarget').value='29';ui.dispatch(root.querySelector('#loadoutCompareTarget'),'change');assert.match(root.querySelector('#loadoutCompareResult').textContent,/No verified ability details/);assert.match(root.querySelector('#loadoutCompareResult').textContent,/No verified value/);assert.match(root.querySelector('#loadoutCompareResult').textContent,/excluded from these job counts/);
});
test('comparison styles stay scoped to Inspector and stack metrics narrowly without changing drag source',async()=>{
 const css=await readFile(new URL('../site/dist/loadout-collection.css',import.meta.url),'utf8'),html=await readFile(new URL('../site/dist/battle.html',import.meta.url),'utf8');const scope=css.slice(css.indexOf('/* Optional, read-only placement comparison'));
 assert.match(scope,/@media\(max-width:480px\)/);assert.match(scope,/grid-template-columns:minmax\(0,1fr\)/);assert.match(scope,/min-height:44px/);assert.doesNotMatch(scope,/loadout-workspace|loadout-placement|loadout-inventory|position:fixed/);assert.match(html,/<section id="loadoutInspector"[\s\S]*<details id="loadoutCompareDetails"[\s\S]*<dl id="loadoutInspectorFacts"/);
});


test('comparison disclosures remain keyboard reachable inside the existing Inspector focus trap',async t=>{
 const ui=await editor(t);inspect(ui,'priest');const summary=ui.get('loadoutCompareDetails').querySelector('summary');summary.focus();let result=ui.dispatch(summary,'keydown',{key:'Tab'});assert.equal(result.event.defaultPrevented,false);assert.equal(ui.document.activeElement,summary);
 ui.get('loadoutCompareDetails').setAttribute('open','');select(ui,'loadoutCompareTarget',0);const numbers=ui.get('loadoutCompareResult').querySelector('summary');numbers.focus();result=ui.dispatch(numbers,'keydown',{key:'Tab'});assert.equal(result.event.defaultPrevented,false);
 ui.get('loadoutInspectorSelect').focus();result=ui.dispatch(ui.get('loadoutInspectorSelect'),'keydown',{key:'Tab'});assert.equal(result.event.defaultPrevented,true);assert.equal(ui.document.activeElement.id,'loadoutCloseInspector');ui.get('loadoutCloseInspector').focus();ui.dispatch(ui.get('loadoutCloseInspector'),'keydown',{key:'Tab',shiftKey:true});assert.equal(ui.document.activeElement.id,'loadoutInspectorSelect');
});
test('dismissed Inspector Select callbacks cannot replace the preserved armed intent',async t=>{
 const ui=await editor(t);ui.click('owned-fireArrow');inspect(ui,'priest');select(ui,'loadoutCompareTarget',0);const stale=ui.get('loadoutInspectorSelect').onclick,before=stateRecord(ui);ui.click('loadoutCloseInspector');stale();assert.equal(ui.get('loadoutSelectionName').textContent,'Fire Arrow');assert.equal(ui.visible('loadoutInspector'),false);assert.equal(stateRecord(ui),before);
});


test('stale comparison has a distinct clearable choice even after the last other equipped card leaves',async t=>{
 const ui=await editor(t),root=ui.get('skillsPanel'),state=fixture(['priest']);let selected=null,calls=0;
 const component=createLoadoutCollectionUI({root,records,getState:()=>({...state,selected,armed:!!selected,bar:0,message:''}),icon:()=>'',bindingLabel:n=>n<0?'Reserve':`Key ${n+1}`,onSelect:w=>{selected=w;calls++;},onMove:()=>{},onBar:()=>{}});t.after(()=>component.dispose());component.render();root.querySelector('#loadout-inspect-priest').click();select(ui,'loadoutCompareTarget',0);
 placeLoadoutAbility(state.layout,wrapper(state,'arrow'),-1);ui.click('loadoutInspectorSelect');assert.equal(calls,0);assert.equal(ui.get('loadoutCompareTarget').value,'changed');assert.equal(ui.get('loadoutCompareTarget').disabled,false);assert.equal(ui.get('loadoutInspectorSelect').disabled,true);select(ui,'loadoutCompareTarget','');assert.equal(ui.get('loadoutCompareTarget').value,'');assert.equal(ui.get('loadoutCompareTarget').disabled,true);assert.equal(ui.get('loadoutInspectorSelect').disabled,false);assert.equal(ui.document.activeElement.id,'loadoutInspectorSelect');ui.click('loadoutInspectorSelect');assert.equal(calls,1);assert.equal(selected.skill.id,'priest');
});
