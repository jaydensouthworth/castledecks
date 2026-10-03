import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {EXPEDITION_FIELDS,expeditionField} from '../site/dist/expedition-data.mjs';
import {ExpeditionProfiles,ExpeditionRun,restoreExpeditions} from '../site/dist/expedition-model.mjs';
import {ExpeditionBattle} from '../site/dist/expedition-battle.mjs';
import {createExpeditionRoute} from '../site/dist/expedition-ui.mjs';
import {CHARTER_MAP_POINTS,CHARTER_ROADS,charterNodeState,charterRoadState,charterRoadPath,charterFieldBrief,canChooseCharterField} from '../site/dist/expedition-map-layout.mjs';
import {modalFocusCandidates} from '../site/dist/modal-focus.mjs';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
const finish=(run,outcome='victory')=>{const battle=new ExpeditionBattle({run});battle.finishOutcome(outcome);for(let i=0;i<110&&!battle.summary;i++)battle.step();assert.ok(battle.summary);return battle;};
const roads=(run,state={})=>Object.fromEntries(CHARTER_ROADS.map(road=>[`${road.from}:${road.to}`,charterRoadState(run,state,road)]));
const nodes=(run,state={})=>Object.fromEntries(Object.keys(CHARTER_MAP_POINTS).map(id=>[id,charterNodeState(run,state,id)]));
const node=(ui,id)=>ui.get('expeditionRouteHost').querySelector(`[data-charter-node="${id}"]`);
const road=(ui,from,to)=>ui.get('expeditionRouteHost').querySelector(`[data-charter-road="${from}:${to}"]`);
const winUI=ui=>{ui.battle.finishOutcome('victory');ui.frames(110);assert.ok(ui.battle.summary);};

test('charter map contains exactly the authored 1–2–2–1 graph and eight directed roads',()=>{
 assert.deepEqual(Object.keys(CHARTER_MAP_POINTS),Object.keys(EXPEDITION_FIELDS));
 assert.equal(CHARTER_ROADS.length,8);
 for(const {from,to} of CHARTER_ROADS){assert.ok(expeditionField(from).next.includes(to));assert.equal(expeditionField(to).leg,expeditionField(from).leg+1);}
 for(const field of Object.values(EXPEDITION_FIELDS))assert.deepEqual(CHARTER_ROADS.filter(road=>road.from===field.id).map(road=>road.to),field.next);
 assert.ok(Object.isFrozen(CHARTER_MAP_POINTS));assert.ok(Object.isFrozen(CHARTER_ROADS));
});

test('both map projections put standards and road endpoints on the same bounded coordinates',()=>{
 for(const point of Object.values(CHARTER_MAP_POINTS))for(const n of Object.values(point))assert.ok(n>=10&&n<=90);
 for(const portrait of [false,true])for(const edge of CHARTER_ROADS){const a=CHARTER_MAP_POINTS[edge.from],b=CHARTER_MAP_POINTS[edge.to],ax=portrait?a.portraitX:a.x,ay=portrait?a.portraitY:a.y,bx=portrait?b.portraitX:b.x,by=portrait?b.portraitY:b.y,path=charterRoadPath(edge,portrait);assert.ok(path.startsWith(`M${ax} ${ay} C`));assert.ok(path.endsWith(`${bx} ${by}`));assert.doesNotMatch(path,/NaN|undefined/);}
 assert.throws(()=>charterRoadPath({from:'invalid',to:'tollgate'}));
});

test('fresh map distinguishes current field from all future locked fields and roads',()=>{
 const run=new ExpeditionRun({seed:101});assert.deepEqual(nodes(run),{tollgate:'current',skyglass:'locked',sunken:'locked',ember:'locked',frost:'locked',stormcrown:'locked'});
 assert.ok(Object.values(roads(run)).every(state=>state==='locked'));
 assert.equal(canChooseCharterField(run,{},'skyglass'),false);
});

test('settled Tollgate opens precisely its two branches and shows its earned node',()=>{
 const run=new ExpeditionRun({seed:101});finish(run);
 assert.deepEqual(nodes(run),{tollgate:'complete',skyglass:'available',sunken:'available',ember:'locked',frost:'locked',stormcrown:'locked'});
 assert.equal(roads(run)['tollgate:skyglass'],'available');assert.equal(roads(run)['tollgate:sunken'],'available');
 assert.equal(roads(run)['skyglass:ember'],'locked');assert.equal(canChooseCharterField(run,{},'ember'),false);
});

test('each route retains chosen, completed and bypassed roads without advancing a branch',()=>{
 for(const second of ['skyglass','sunken'])for(const third of ['ember','frost']){
  const run=new ExpeditionRun({seed:101}),otherSecond=second==='skyglass'?'sunken':'skyglass',otherThird=third==='ember'?'frost':'ember';
  finish(run);run.choose(second);assert.equal(nodes(run)[second],'current');assert.equal(nodes(run)[otherSecond],'bypassed');assert.equal(roads(run)[`tollgate:${second}`],'chosen');assert.equal(roads(run)[`${otherSecond}:${third}`],'bypassed');
  finish(run);assert.equal(roads(run)[`tollgate:${second}`],'complete');assert.equal(roads(run)[`${second}:${third}`],'available');assert.equal(nodes(run)[third],'available');assert.equal(nodes(run)[otherThird],'available');
  run.choose(third);assert.equal(roads(run)[`${second}:${third}`],'chosen');assert.equal(nodes(run)[otherThird],'bypassed');finish(run);assert.equal(roads(run)[`${third}:stormcrown`],'available');run.choose('stormcrown');assert.equal(roads(run)[`${third}:stormcrown`],'chosen');finish(run);
  for(const id of run.state.path)assert.equal(nodes(run)[id],'complete');assert.equal(nodes(run)[otherSecond],'bypassed');assert.equal(nodes(run)[otherThird],'bypassed');assert.equal(roads(run)[`${third}:stormcrown`],'complete');assert.ok(Object.values(roads(run)).every(state=>['complete','bypassed'].includes(state)));
 }
});

test('pending outcomes cannot advertise or accept an open road',()=>{
 const run=new ExpeditionRun({seed:101});finish(run);assert.equal(canChooseCharterField(run,{pendingOutcome:true},'skyglass'),false);assert.equal(charterNodeState(run,{pendingOutcome:true},'skyglass'),'locked');assert.equal(roads(run,{pendingOutcome:true})['tollgate:skyglass'],'locked');
});

test('all field briefs derive actual terrain, enemy counts, spawn stats, objective and region art',()=>{
 const run=new ExpeditionRun({seed:102});
 for(const field of Object.values(EXPEDITION_FIELDS)){
  const brief=charterFieldBrief(run,{},field.id);assert.equal(brief.field,field);assert.equal(brief.total,Object.values(field.counts).reduce((sum,count)=>sum+count,0));assert.equal(brief.ground+brief.aerial,brief.total);assert.deepEqual(new Set(brief.enemies.map(enemy=>enemy.id)),new Set(Object.keys(field.counts)));assert.ok(brief.enemies.every(enemy=>enemy.level===field.level&&enemy.difficulty===run.profile.difficulty));assert.equal(brief.objective,field.objective==='break-keep'?'Break the keep':'Flag or elimination');assert.match(brief.art,/^\.\/images\/regions\/(hearthwood|bannerfen|frostpine|cinderlands)\.webp$/);
 }
 assert.match(charterFieldBrief(run,{},'skyglass').threats,/Winged raider ×3/);assert.equal(charterFieldBrief(run,{},'skyglass').aerial,4);assert.match(charterFieldBrief(run,{},'sunken').threats,/Cavalry ×8/);assert.equal(charterFieldBrief(run,{},'sunken').aerial,0);
});

test('read-only map projection neither mutates a save nor samples gameplay randomness',()=>{
 const profiles=new ExpeditionProfiles({seedFactory:()=>103}),before=profiles.exportBundle(),random=Math.random;
 try{Math.random=()=>{throw new Error('Map requested RNG');};for(let n=0;n<8;n++){nodes(profiles.activeRun);roads(profiles.activeRun);Object.keys(CHARTER_MAP_POINTS).forEach(id=>charterFieldBrief(profiles.activeRun,{},id));}}finally{Math.random=random;}
 assert.equal(profiles.exportBundle(),before);assert.equal(restoreExpeditions(before).exportBundle(),before);
});

test('every reachable state maps identically after a compatible charter save round-trip',()=>{
 for(const second of ['skyglass','sunken'])for(const third of ['ember','frost']){
  const profiles=new ExpeditionProfiles({seedFactory:()=>104});
  for(const next of [second,third,'stormcrown',null]){
   const run=profiles.activeRun,verify=()=>{const text=profiles.exportBundle(),restored=restoreExpeditions(text);assert.equal(restored.exportBundle(),text);assert.deepEqual(nodes(restored.activeRun),nodes(run));assert.deepEqual(roads(restored.activeRun),roads(run));};
   verify();finish(run);verify();if(next)run.choose(next);
  }
 }
});

test('all six standards are inspectable; locked inspection preserves the prepared run and save',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=expedition'}),battle=ui.battle,before=battle.expeditionRun.exportState(),gold=battle.profile.gold;ui.click('introRoute');
 assert.equal(ui.get('expeditionRouteHost').querySelectorAll('[data-charter-node]').length,6);assert.equal(ui.get('expeditionRouteHost').querySelectorAll('[data-charter-choice]').length,0);
 node(ui,'stormcrown').click();assert.equal(node(ui,'stormcrown').getAttribute('aria-pressed'),'true');assert.equal(node(ui,'stormcrown').disabled,false);assert.equal(ui.visible('charterInspector'),false);ui.click('charterInspect');assert.equal(ui.visible('charterInspector'),true);assert.equal(ui.get('charterFieldTitle').textContent,'Storm Crown');assert.match(ui.get('charterInspector').textContent,/Trebuchet ×2/);assert.match(ui.get('charterInspector').textContent,/7,600/);assert.equal(ui.get('charterInspectChoose').disabled,true);ui.click('charterInspectChoose');
 assert.equal(ui.battle,battle);assert.deepEqual(battle.expeditionRun.exportState(),before);assert.equal(battle.profile.gold,gold);assert.equal(battle.tick,0);
});

test('a paused live battlefield survives every node inspection, Back, Escape and route return',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=expedition'});ui.click('start');ui.frames(15);ui.click('battlePause');ui.click('pauseRoute');const battle=ui.battle,tick=battle.tick,before=battle.expeditionRun.exportState(),gold=battle.profile.gold;
 for(const id of Object.keys(CHARTER_MAP_POINTS)){node(ui,id).click();ui.click('charterInspect');ui.frames(8);assert.equal(ui.get('charterInspectChoose').disabled,true);ui.key('keydown','Escape');assert.equal(ui.visible('charterInspector'),false);assert.equal(ui.visible('expeditionPanel'),true);assert.equal(ui.document.activeElement.id,'charterInspect');}
 ui.click('charterReturn');assert.equal(ui.visible('intro'),true);assert.equal(ui.battle,battle);assert.equal(battle.tick,tick);assert.equal(battle.profile.gold,gold);assert.deepEqual(battle.expeditionRun.exportState(),before);ui.click('start');ui.frames(2);assert.ok(battle.tick>tick);
});

test('selecting an open node only inspects; explicit inspector choice prepares exactly that branch',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=expedition'});ui.click('start');winUI(ui);ui.click('replay');const prior=ui.battle,gold=prior.profile.gold;
 node(ui,'sunken').click();assert.equal(ui.battle,prior);assert.deepEqual(prior.expeditionRun.state.path,['tollgate']);assert.equal(road(ui,'tollgate','sunken').getAttribute('data-state'),'available');ui.click('charterInspect');assert.equal(ui.get('charterInspectChoose').disabled,false);assert.match(ui.get('charterInspector').textContent,/Cavalry ×8/);ui.click('charterInspectChoose');
 assert.equal(ui.battle.encounter.id,'sunken');assert.equal(ui.battle.tick,0);assert.equal(ui.battle.profile.gold,gold);assert.equal(ui.visible('intro'),true);ui.click('introRoute');assert.equal(node(ui,'skyglass').getAttribute('data-state'),'bypassed');assert.equal(road(ui,'tollgate','sunken').getAttribute('data-state'),'chosen');
});

test('a bypassed branch can be inspected but never replaces the current chosen road',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=expedition'});ui.click('start');winUI(ui);ui.click('replay');ui.get('expeditionRouteHost').querySelector('[data-charter-choice="skyglass"]').click();ui.click('introRoute');const battle=ui.battle,before=battle.expeditionRun.exportState();node(ui,'sunken').click();ui.click('charterInspect');assert.equal(ui.get('charterInspectChoose').disabled,true);assert.match(ui.get('charterFieldNote').textContent,/passed over/);ui.click('charterInspectChoose');assert.equal(ui.battle,battle);assert.deepEqual(battle.expeditionRun.exportState(),before);
});

test('map reset is a real confirmation layer with confined focus and safe Escape restoration',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=expedition'});ui.click('introRoute');const before=ui.battle.expeditionRun.exportState(),battle=ui.battle;ui.click('charterRestart');assert.equal(ui.visible('charterResetConfirm'),true);assert.equal(ui.document.activeElement.id,'cancelCharterReset');assert.deepEqual(modalFocusCandidates(ui.get('expeditionPanel')).map(button=>button.id),['cancelCharterReset','confirmCharterReset']);node(ui,'frost').click();assert.equal(node(ui,'tollgate').getAttribute('aria-pressed'),'true');ui.key('keydown','Escape');assert.equal(ui.visible('charterResetConfirm'),false);assert.equal(ui.document.activeElement.id,'charterRestart');assert.ok(modalFocusCandidates(ui.get('expeditionPanel')).some(button=>button.id==='closeRoute'));assert.equal(ui.battle,battle);assert.deepEqual(battle.expeditionRun.exportState(),before);
});

test('only visible inspector controls participate in modal focus and closing restores Inspect',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=expedition'});ui.click('introRoute');node(ui,'ember').click();ui.click('charterInspect');const ids=modalFocusCandidates(ui.get('expeditionPanel')).map(button=>button.id);assert.ok(ids.includes('charterCloseInspector'));assert.ok(!ids.includes('charterInspect'));assert.ok(!ids.includes('charterRestart'));ui.click('charterCloseInspector');assert.equal(ui.document.activeElement.id,'charterInspect');assert.equal(node(ui,'ember').getAttribute('aria-pressed'),'true');assert.equal(ui.visible('charterInspector'),false);
});

test('stale rendered controls, profile replacement and fresh pending state cannot dispatch a choice',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=expedition'}),host=ui.get('expeditionRouteHost');let run=new ExpeditionRun({seed:105}),state={},calls=[];finish(run);const route=createExpeditionRoute({host,getRun:()=>run,getState:()=>state,onChoose:id=>calls.push(id),onReturn:()=>{},onRestart:()=>{}});route.open();
 const first=host.querySelector('[data-charter-choice="skyglass"]');host.querySelector('[data-charter-node="sunken"]').click();first.click();assert.deepEqual(calls,[]);
 const pending=host.querySelector('[data-charter-choice="sunken"]');state={pendingOutcome:true};pending.click();assert.deepEqual(calls,[]);state={};
 const otherRun=host.querySelector('[data-charter-choice="skyglass"]');run=new ExpeditionRun({seed:106});finish(run);otherRun.click();assert.deepEqual(calls,[]);route.open();host.querySelector('[data-charter-choice="skyglass"]').click();assert.deepEqual(calls,['skyglass']);
});

test('reset confirmation cannot be activated twice or via a detached stale button',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=expedition'}),host=ui.get('expeditionRouteHost'),run=new ExpeditionRun({seed:107});let resets=0;const route=createExpeditionRoute({host,getRun:()=>run,getState:()=>({}),onChoose:()=>{},onReturn:()=>{},onRestart:()=>resets++});route.open();host.querySelector('#charterRestart').click();const confirm=host.querySelector('#confirmCharterReset');route.cancelReset();confirm.click();assert.equal(resets,0);host.querySelector('#charterRestart').click();const actual=host.querySelector('#confirmCharterReset');actual.click();actual.click();assert.equal(resets,1);assert.equal(ui.get('expeditionPanel').querySelector('.panel-head').inert,false);
});

test('map UI uses bounded event renders, original art, responsive projections and 44px targets',async()=>{
 const root=new URL('../site/dist/',import.meta.url),[css,js]=await Promise.all(['expedition.css','expedition-ui.mjs'].map(name=>readFile(new URL(name,root),'utf8')));
 assert.match(css,/#expeditionRouteHost button,#expeditionRouteHost summary\{min-height:44px;min-width:44px/);assert.match(css,/@media\(orientation:portrait\)/);assert.match(css,/@media\(max-height:600px\) and \(orientation:landscape\)/);assert.match(css,/\.charter-roads-portrait\{display:block\}/);assert.match(css,/min-height:62px/);assert.doesNotMatch(js,/requestAnimationFrame|setInterval|addEventListener\(['"]resize/);assert.doesNotMatch(js,/charter-choice-grid|charter-current/);assert.match(js,/data-charter-node/);assert.match(js,/data-charter-choice/);
});


test('charter board defers shell padding, maximum width and header spacing to shared responsive workspace',async()=>{
 const css=await readFile(new URL('../site/dist/expedition.css',import.meta.url),'utf8');
 const localPanel=css.match(/#expeditionPanel\{([^}]+)\}/)?.[1]??'';
 assert.doesNotMatch(localPanel,/padding|max-width/);
 assert.doesNotMatch(css,/#expeditionPanel>\.panel-head\{[^}]*padding/);
});
