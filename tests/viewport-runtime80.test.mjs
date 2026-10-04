import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
import {adaptNode,box,computedStyle,loadViewportLab} from './helpers/viewport-lab-fixture.mjs';
import {paintedVisible,interactionVisible} from '../site/dist/viewport-visibility.mjs';
const selector='button,input,select,a,summary';
async function editor(t){const ui=await loadGameUI(t,{search:'?mode=test'});ui.click('introTesting');ui.click('testUnlock');ui.click('closeTesting');ui.click('introLoadout');return ui;}
function geometry(ui){
 adaptNode(ui.document);Object.assign(ui.window,{innerWidth:1280,innerHeight:720,getComputedStyle:computedStyle});
 for(const node of ui.document.querySelectorAll('*'))node.rect=box(0,0,1280,720);
 ui.get('battlefield').rect=box(0,0,1280,720);ui.document.elementFromPoint=()=>ui.get('battlefield');
}
function active(ui){return ui.get('skillsPanel').querySelectorAll(selector).filter(node=>interactionVisible(node,ui.window));}
function space(ui,nodes=active(ui)){nodes.forEach((node,i)=>node.rect=box(20+(i%8)*140,20+Math.floor(i/8)*64,100,44));}

test('accepted80 runtime Inspector contributes exactly six active controls including three summaries',async t=>{
 const ui=await editor(t);ui.get('loadoutSearch').value='Priest';ui.dispatch(ui.get('loadoutSearch'),'input');ui.click('owned-priest');ui.click('unbindSkill');ui.click('loadout-inspect-priest');
 ui.get('loadoutCompareDetails').setAttribute('open','');ui.get('loadoutCompareTarget').value=String(ui.battle.profile.skills.find(s=>s.id==='mount').binding);ui.dispatch(ui.get('loadoutCompareTarget'),'change');geometry(ui);
 const controls=active(ui),inspector=ui.get('loadoutInspector');assert.equal(controls.length,6);assert.equal(controls.filter(n=>n.tagName==='SUMMARY').length,3);
 assert.deepEqual(controls.filter(n=>n.id).map(n=>n.id),['loadoutCloseInspector','loadoutCompareTarget','loadoutInspectorSourceSummary','loadoutInspectorSelect']);
 const underlying=ui.get('loadoutSearch');assert.equal(paintedVisible(underlying,ui.window),true);assert.equal(interactionVisible(underlying,ui.window),false);underlying.rect=box(20,20,14,44);space(ui,controls);
 const lab=await loadViewportLab({doc:ui.document,win:ui.window});await lab.refresh();assert.equal(lab.get('touchMeasure').textContent,'0 / 0');assert.match(lab.get('status').textContent,/menu inspection/);
 // A genuine exposed Inspector defect must still reach the user-facing count.
 ui.get('loadoutInspectorSelect').rect=box(40,20,14,44);await lab.refresh();assert.equal(lab.get('touchMeasure').textContent,'1 / 1');space(ui,controls);
 ui.get('loadoutCompareDetails').open=false;assert.equal(active(ui).length,4);assert.equal(active(ui).filter(n=>n.tagName==='SUMMARY').length,2);await lab.refresh();assert.equal(lab.get('touchMeasure').textContent,'0 / 0');
 ui.get('loadoutCompareDetails').open=true;inspector.querySelector('.loadout-compare-numbers').open=true;ui.get('loadoutInspectorSource').open=true;assert.equal(active(ui).length,6);await lab.refresh();assert.equal(lab.get('touchMeasure').textContent,'0 / 0');
});

test('accepted80 runtime closed Refine excludes stale 14 by 44 trait rectangle; opening restores genuine warning',async t=>{
 const ui=await editor(t);geometry(ui);const refine=ui.get('loadoutRefine'),trait=ui.get('loadoutTrait');assert.equal(refine.open,false);space(ui);trait.rect=box(1150,500,14,44);
 assert.equal(paintedVisible(trait,ui.window),true);assert.equal(interactionVisible(trait,ui.window),false);assert.equal(interactionVisible(refine.querySelector('summary'),ui.window),true);
 const lab=await loadViewportLab({doc:ui.document,win:ui.window});await lab.refresh();assert.equal(lab.get('touchMeasure').textContent,'0 / 0');
 refine.open=true;space(ui);trait.rect=box(1150,500,14,44);assert.equal(interactionVisible(trait,ui.window),true);await lab.refresh();assert.equal(lab.get('touchMeasure').textContent,'1 / 0');
 refine.open=false;await lab.refresh();assert.equal(lab.get('touchMeasure').textContent,'0 / 0');
});

test('accepted80 runtime ordinary Inspector hides source summary and respects closed comparison contents',async t=>{
 const ui=await editor(t);ui.click('loadout-inspect-arrow');geometry(ui);space(ui);const controls=active(ui);
 assert.equal(controls.length,3);assert.equal(controls.filter(n=>n.tagName==='SUMMARY').length,1);assert.equal(ui.get('loadoutInspectorSource').open,true);assert.equal(ui.get('loadoutInspectorSourceSummary').hidden,true);assert.equal(interactionVisible(ui.get('loadoutInspectorSourceSummary'),ui.window),false);assert.equal(interactionVisible(ui.get('loadoutCompareTarget'),ui.window),false);
 const lab=await loadViewportLab({doc:ui.document,win:ui.window});await lab.refresh();assert.equal(lab.get('touchMeasure').textContent,'0 / 0');
});
