import test from 'node:test';
import assert from 'node:assert/strict';
import {levyBadgeLayout,drawLevyBadges} from '../site/dist/levy-badges.mjs';
import {levyMusterEntryState} from '../site/dist/levy-presentation.mjs';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
const troop=(i,patch={})=>({x:500+i*3,y:600,height:65,hp:200,team:'good',visible:true,auxiliaryIdentity:{id:`levy-1-${i}`},...patch});
const owned=units=>({owns:unit=>units.includes(unit)});
test('ten crowded temporary troops become one counted pennant with ten individual markers',()=>{
 const units=Array.from({length:10},(_,i)=>troop(i)),before=JSON.stringify(units),view=levyBadgeLayout(units,owned(units));
 assert.equal(view.marks.length,10);assert.equal(view.badges.length,1);assert.equal(view.badges[0].label,'L×10');assert.equal(view.badges[0].count,10);assert.equal(JSON.stringify(units),before);
});
test('distant troops and steep height changes never disappear into one unbounded cluster',()=>{
 const units=[troop(0),troop(1,{x:600}),troop(2,{x:610,y:640}),troop(3,{x:630,y:660})];
 const view=levyBadgeLayout(units,owned(units));assert.equal(view.marks.length,4);assert.ok(view.badges.length>=3);assert.equal(view.badges.reduce((sum,b)=>sum+b.count,0),4);
 for(const badge of view.badges){assert.ok(Math.max(...badge.marks.map(m=>m.x))-Math.min(...badge.marks.map(m=>m.x))<=38);assert.ok(Math.max(...badge.marks.map(m=>m.y))-Math.min(...badge.marks.map(m=>m.y))<=16);}
});
test('ownership, duplicate rosters, death, visibility, garrison and invalid positions are filtered exactly',()=>{
 const units=[troop(0),troop(1,{hp:0}),troop(2,{dead:true}),troop(3,{destroyed:true}),troop(4,{visible:false}),troop(5,{garrisonBuilding:{}}),troop(6,{x:NaN}),troop(7,{y:Infinity})],forged=troop(9);
 const view=levyBadgeLayout([...units,units[0],forged],owned(units));assert.deepEqual(view.marks.map(m=>m.unit),[units[0]]);assert.equal(view.badges[0].label,'L');
});
test('converted hostile and neutral temporary actors keep distinct counted pennants',()=>{
 const units=[troop(0),troop(1,{team:'bad'}),troop(2,{team:'neutral'})],view=levyBadgeLayout(units,owned(units));
 assert.equal(view.badges.length,3);assert.deepEqual(new Set(view.badges.map(b=>b.team)),new Set(['good','bad','neutral']));
 for(let i=0;i<view.badges.length;i++)for(let j=i+1;j<view.badges.length;j++)assert.ok(Math.abs(view.badges[i].y-view.badges[j].y)>=17);
});
test('roster order cannot change badge membership or position',()=>{
 const units=Array.from({length:10},(_,i)=>troop(i,{x:100+i*19,y:500+i%3*4})),controller=owned(units);
 const signature=input=>levyBadgeLayout(input,controller).badges.map(b=>[b.x,b.y,b.label,b.marks.map(m=>m.id)]);
 assert.deepEqual(signature(units),signature([...units].reverse()));
});
for(const scale of [.12,.3,1,2])test(`camera scale ${scale} keeps screen-sized labels and exact visible membership`,()=>{
 const units=[troop(0,{x:0}),troop(1,{x:100}),troop(2,{x:5000})],camera={scale,offsetX:5,offsetY:0,width:740,height:900},view=levyBadgeLayout(units,owned(units),camera);
 assert.ok(view.marks.every(m=>m.x>=0&&m.x<=740));assert.equal(view.badges.reduce((n,b)=>n+b.count,0),view.marks.length);
 for(const badge of view.badges){assert.ok(badge.x-badge.width/2>=0);assert.ok(badge.x+badge.width/2<=740);assert.ok(badge.y>=8);}
 const calls=[],ctx=new Proxy({},{get:(_,key)=>(...args)=>calls.push([key,...args]),set:()=>true});assert.deepEqual(drawLevyBadges(ctx,units,owned(units),camera).badges.map(b=>b.label),view.badges.map(b=>b.label));assert.equal(calls.filter(c=>c[0]==='fillText').length,view.badges.length);
});
test('empty and ordinary fields render no temporary markers',()=>{
 const ctx=new Proxy({},{get:()=>()=>assert.fail('ordinary field must not paint levy marks')});assert.equal(drawLevyBadges(ctx,[troop(0)],undefined).marks.length,0);assert.equal(levyMusterEntryState({}),null);assert.equal(levyMusterEntryState({auxiliaries:{},stressField:true}),null);
});
const search='?mode=skirmish&sk=SK1:16:oaks:scout:levy';
test('paused levy Army entry opens Muster directly without committing or charging',async t=>{
 const ui=await loadGameUI(t,{search});ui.click('skirmishPrepare');ui.click('start');ui.frames(2);ui.click('battlePause');
 assert.match(ui.get('pauseQueue').textContent,/Call 5 levies/);assert.match(ui.get('pauseQueue').getAttribute('aria-label'),/4 levy waves remain/);
 const b=ui.battle,gold=b.profile.gold,reserve=b.friendlyQueue.population;ui.click('pauseQueue');assert.equal(ui.visible('armyMusterView'),true);assert.equal(ui.get('armyMusterTab').getAttribute('aria-pressed'),'true');assert.equal(b.auxiliaries.snapshot.wavesCalled,0);assert.equal(b.profile.gold,gold);assert.equal(b.friendlyQueue.population,reserve);
 ui.click('armyCallLevies');ui.click('closeQueue');assert.match(ui.get('pauseQueue').textContent,/5 levies arriving/);assert.equal(b.auxiliaries.snapshot.wavesCalled,1);assert.equal(b.profile.gold,gold);assert.equal(b.friendlyQueue.population,reserve);
});
test('ordinary and synthetic Army entry retains normal copy and its contract navigation',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=test'});ui.click('start');ui.frames(2);ui.click('battlePause');assert.equal(ui.get('pauseQueue').textContent,'Army & ground line');assert.equal(ui.get('pauseQueue').getAttribute('aria-label'),null);ui.click('pauseQueue');assert.equal(ui.visible('armyContractsView'),true);ui.click('closeQueue');ui.click('pauseTesting');ui.click('stressVeteran');assert.equal(ui.get('pauseQueue').textContent,'Army & ground line');ui.click('pauseLobby');ui.click('closeTesting');assert.equal(ui.get('pauseQueue').textContent,'Army & ground line');
});
test('full slots communicate the real shortage without calling a third wave',async t=>{
 const ui=await loadGameUI(t,{search});ui.click('skirmishPrepare');ui.click('start');ui.frames(2);ui.click('battlePause');ui.click('pauseQueue');ui.click('armyCallLevies');ui.click('closeQueue');ui.click('resumeGame');ui.frames(105);ui.click('battlePause');ui.click('pauseQueue');ui.click('armyCallLevies');ui.click('closeQueue');ui.click('resumeGame');ui.frames(105);ui.click('battlePause');assert.match(ui.get('pauseQueue').textContent,/Levy slots needed/);assert.match(ui.get('pauseQueue').getAttribute('aria-label'),/0 are free/);ui.click('pauseQueue');assert.equal(ui.get('armyCallLevies').disabled,true);assert.equal(ui.battle.auxiliaries.snapshot.wavesCalled,2);
});

const bounds=b=>({left:b.x-b.width/2,right:b.x+b.width/2,top:b.y-7,bottom:b.y+10});
const hit=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
function clearLabels(view,width,height){assert.equal(view.omittedLabels,0);for(const b of view.badges){assert.equal(b.visible,true);const r=bounds(b);assert.ok(r.left>=0&&r.right<=width&&r.top>=0&&r.bottom<=height);for(const band of view.statusBands)assert.equal(hit(r,band),false);for(const other of view.badges)if(other!==b)assert.equal(hit(r,bounds(other)),false);}}
test('independent six-actor varied-height negative control has no overlapping labels',()=>{
 const units=[[150,287],[154,315],[118,302],[139,276],[158,273],[168,300]].map(([x,y],i)=>troop(i,{x,y})),camera={scale:1,width:740,height:360};
 const a=levyBadgeLayout(units,owned(units),camera);assert.equal(a.badges.length,3);clearLabels(a,740,360);assert.equal(a.badges.reduce((n,b)=>n+b.count,0),6);
 const b=levyBadgeLayout([...units].reverse(),owned(units),camera);assert.deepEqual(a.badges.map(b=>[b.x,b.y,b.label]),b.badges.map(b=>[b.x,b.y,b.label]));
});
for(const scale of [.12,.3,1,2])test(`pennants and markers preserve real status bands at scale ${scale}`,()=>{
 const units=[troop(0,{x:120,y:140,effects:{effects:[{kind:'ice',duration:10}]}}),troop(1,{x:124,y:144,effects:{effects:[{kind:'poison',duration:10}]}}),troop(2,{x:128,y:160})],ordinary=troop(99,{x:125,y:150,height:undefined,effects:{effects:[{kind:'fear',duration:10}]}}),reactiveElements=[{active:true,stuckTo:units[2],element:'fire'}];
 const view=levyBadgeLayout([...units,ordinary],owned(units),{scale,offsetY:100,width:740,height:360,reactiveElements});assert.equal(view.statusBands.length,4);clearLabels(view,740,360);
 for(const mark of view.marks)for(const band of view.statusBands)assert.equal(hit({left:mark.x-2.5,right:mark.x+2.5,top:mark.markerY-2,bottom:mark.markerY+2.5},band),false);
});
test('ten actors crowded against the top edge use clear in-bounds fallback positions',()=>{
 const units=Array.from({length:10},(_,i)=>troop(i,{x:350+(i%3)*2,y:65+5+Math.floor(i/3)*18,team:['good','bad','neutral'][i%3],effects:{effects:[{kind:'ice',duration:10}]}}));
 const view=levyBadgeLayout(units,owned(units),{scale:1,width:740,height:240});assert.equal(view.marks.length,10);clearLabels(view,740,240);assert.equal(view.badges.reduce((n,b)=>n+b.count,0),10);
});
test('an impossible tiny viewport exposes omitted labels and never paints overlaps as valid',()=>{
 const units=[troop(0,{x:2,y:66})],view=levyBadgeLayout(units,owned(units),{width:5,height:5});assert.equal(view.marks.length,1);assert.equal(view.omittedLabels,1);assert.equal(view.badges[0].visible,false);assert.equal(view.badges[0].count,1);
});

test('height-separated pennants never cover another levy marker',()=>{
 const units=[troop(0,{x:500,y:265}),troop(1,{x:500,y:295})],view=levyBadgeLayout(units,owned(units),{scale:1,width:740,height:360});clearLabels(view,740,360);
 for(const b of view.badges)for(const mark of view.marks)assert.equal(hit(bounds(b),{left:mark.x-2.5,right:mark.x+2.5,top:mark.markerY-2,bottom:mark.markerY+2.5}),false);
});
test('deterministic mixed-height status sweep preserves marker and label positions under roster reversal',()=>{
 let seed=69;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
 for(let sample=0;sample<300;sample++){
  const width=sample%2?740:320,height=240,units=Array.from({length:10},(_,i)=>troop(i,{x:12+Math.floor(random()*(width-24)),y:70+Math.floor(random()*220),team:i%3?'good':'bad',effects:{effects:random()<.5?[{kind:['ice','fire','poison'][i%3],duration:10}]:[]}})),camera={width,height,scale:1},controller=owned(units);
  const a=levyBadgeLayout(units,controller,camera),b=levyBadgeLayout([...units].reverse(),controller,camera),signature=view=>({marks:view.marks.map(m=>[m.id,m.x,m.markerY]),badges:view.badges.map(b=>[b.x,b.y,b.label,b.visible])});
  assert.deepEqual(signature(a),signature(b),`sample ${sample}`);clearLabels(a,width,height);
  for(const badge of a.badges)for(const mark of a.marks)assert.equal(hit(bounds(badge),{left:mark.x-2.5,right:mark.x+2.5,top:mark.markerY-2,bottom:mark.markerY+2.5}),false,`sample ${sample}`);
 }
});
test('independent 240px clipping negative control stays fully in bounds',()=>{
 const points=[[120,186,'good'],[116,183,'bad'],[111,130,'bad'],[124,145,'good'],[123,218,'good'],[126,98,'good'],[128,179,'good'],[101,112,'bad'],[122,98,'bad'],[122,131,'good']],units=points.map(([x,y,team],i)=>troop(i,{x,y,team})),view=levyBadgeLayout(units,owned(units),{scale:1,width:740,height:240});assert.equal(view.marks.length,10);clearLabels(view,740,240);
});
