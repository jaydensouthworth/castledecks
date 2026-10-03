import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {SkirmishBattle} from '../site/dist/skirmish-battle.mjs';
import {createSkirmish} from '../site/dist/skirmish-model.mjs';
import {skirmishBriefHTML} from '../site/dist/skirmish-ui.mjs';
import {FLAG_STATUS as FS} from '../site/dist/engine/flag-troop.mjs';
import {objectiveFeedbackState,objectiveMarkerLayout,drawObjectiveMarkers,updateObjectiveFeedback,BATTERY_BRIEF} from '../site/dist/objective-feedback.mjs';
import {createWorldCamera,worldToScreen} from '../site/dist/world-camera.mjs';
import {createPortraitView} from '../site/dist/portrait-view.mjs';
import {frameCombatCamera} from '../site/dist/combat-camera.mjs';
import {fortificationGeometry} from '../site/dist/fortress-art.mjs';
const descriptor=(doctrine='battery',overrides={})=>({version:1,seed:73421,biome:'oaks',threat:'standard',doctrine,...overrides});
const battle=overrides=>new SkirmishBattle({descriptor:descriptor('battery',overrides)});
const targets=b=>b.badTeam.filter(u=>u.type==='trebuchet');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const canvas=()=>{const calls=[],ctx=new Proxy({},{get:(o,key)=>key in o?o[key]:(...args)=>{for(const n of args)if(typeof n==='number')assert.ok(Number.isFinite(n),key);calls.push({name:key,args});},set:(o,key,value)=>(o[key]=value,true)});return{ctx,calls};};
function documentFixture(){
 const nodes=new Map();for(const id of ['.live-battle-standard','#combatBattleTitle','#combatEnemyState','#viewStatus','#batteryObjectiveBrief']){
  const classes=new Set(['hidden']),attrs={};nodes.set(id,{textContent:'default',dataset:{},classList:{add:n=>classes.add(n),remove:n=>classes.delete(n),contains:n=>classes.has(n)},setAttribute:(k,v)=>attrs[k]=v,getAttribute:k=>attrs[k]});
 }
 return {querySelector:selector=>nodes.get(selector),get:selector=>nodes.get(selector)};
}
function framed(b,width,height,bottomInset=0){
 const samples=b.terrain.samples;return frameCombatCamera(createWorldCamera(width,height),{groundY:Math.max(...samples),structureTopY:Math.min(...b.structures.map(s=>fortificationGeometry(s).body.y)),aimOriginTopY:Math.min(Math.min(...samples)-30,...b.structures.map(s=>s.y+s.shotOffset.y)),top:61,bottom:height-bottomInset-62});
}

test('real prepared battery starts at 0/2 with two original labeled targets and no simulation advance',()=>{
 const b=battle(),state=objectiveFeedbackState(b),markers=objectiveMarkerLayout(b,createWorldCamera(915,360));
 assert.equal(state.title,'Battery · 0/2');assert.equal(state.status,'Silence both guns');assert.equal(b.tick,0);
 assert.deepEqual(markers.map(m=>[m.id,m.label,m.caption]),[['battery-1','Battery I','TARGET'],['battery-2','Battery II','TARGET']]);
 assert.equal(targets(b).length,2);assert.equal(b.badTeam.length,6);
 for(const [index,marker] of markers.entries()){const unit=targets(b)[index];close(marker.anchorX,worldToScreen(createWorldCamera(915,360),unit).x);}
});
test('first real hostile destruction shows 1/2 and labels exactly that target destroyed',()=>{
 const b=battle(),[one]=targets(b);one.hp=0;b.checkOutcome();
 const state=objectiveFeedbackState(b);assert.equal(state.title,'Battery · 1/2');assert.equal(state.status,'Silence last gun');assert.equal(state.neutralized,1);assert.equal(state.secured,0);
 assert.deepEqual(objectiveMarkerLayout(b,createWorldCamera(915,360)).map(m=>m.caption),['DESTROYED','TARGET']);assert.equal(b.outcome,null);
});
test('unrelated allied siege never counts; secured original is distinct from destroyed',()=>{
 const b=battle();b.createUnit('trebuchet',{team:'good'});assert.equal(objectiveFeedbackState(b).resolved,0);
 const [one]=targets(b);one.team='good';one.permanentTeam='good';
 const state=objectiveFeedbackState(b),markers=objectiveMarkerLayout(b,createWorldCamera(915,360));
 assert.equal(state.resolved,1);assert.equal(state.secured,1);assert.equal(state.neutralized,0);assert.match(state.brief,/0 destroyed · 1 secured/);
 assert.equal(markers[0].caption,'SECURED');assert.equal(markers[0].symbol,'check');
 one.team='bad';one.permanentTeam='bad';one.hp=0;b.checkOutcome();
 const destroyed=objectiveMarkerLayout(b,createWorldCamera(915,360))[0];assert.equal(destroyed.symbol,'cross');assert.notEqual(markers[0].edge,destroyed.edge);
});
for(const flagState of [FS.GROUNDED,FS.HELD_BY_ENEMY,FS.HELD_BY_FRIEND])test(`2/2 explicitly requires home flag recovery for state ${flagState}`,()=>{
 const b=battle();b.ownFlag.status=flagState;for(const unit of targets(b))unit.hp=0;b.checkOutcome();
 const state=objectiveFeedbackState(b);assert.equal(state.title,'Battery · 2/2');assert.equal(state.status,'Recover home flag');assert.equal(state.portrait,'Battery 2/2 · Recover home flag');assert.equal(b.outcome,null);assert.doesNotMatch(state.status,/cleared|victory/);
 b.ownFlag.status=FS.AT_BASE;b.checkOutcome();assert.equal(b.outcome,'victory');assert.equal(objectiveFeedbackState(b).status,'Battery cleared');
});
for(const cause of ['hero','flag'])test(`actual ${cause} loss overrides completed objective feedback`,()=>{
 const b=battle();for(const u of targets(b))u.hp=0;if(cause==='hero')b.hero.hp=0;else b.ownFlag.status=FS.CAPTURED;b.checkOutcome();
 assert.equal(b.outcome,'defeat');const state=objectiveFeedbackState(b);assert.equal(state.title,'Battery · 2/2');assert.equal(state.status,'Attempt lost');assert.equal(state.reason,cause==='hero'?'Your hero fell.':'Your home flag was captured.');assert.ok(state.brief.includes(state.reason));assert.doesNotMatch(state.status,/cleared|resolved|victory/);
});
test('live standard, portrait status and Pause brief reuse existing UI and reset cleanly',()=>{
 const b=battle(),root=documentFixture();updateObjectiveFeedback(b,root);
 assert.equal(root.get('#combatBattleTitle').textContent,'Battery · 0/2');assert.equal(root.get('#viewStatus').textContent,'Battery 0/2 · Silence both guns');assert.equal(root.get('#batteryObjectiveBrief').classList.contains('hidden'),false);assert.match(root.get('.live-battle-standard').getAttribute('aria-label'),/0 destroyed · 0 secured/);
 targets(b)[0].hp=0;b.checkOutcome();updateObjectiveFeedback(b,root);assert.equal(root.get('#combatBattleTitle').textContent,'Battery · 1/2');
 const fresh=battle();updateObjectiveFeedback(fresh,root);assert.equal(root.get('#combatBattleTitle').textContent,'Battery · 0/2');assert.match(root.get('#batteryObjectiveBrief').textContent,/0\/2 engines resolved/);
 // Ordinary HUD writers run first in integration; this helper must not erase them.
 root.get('#combatBattleTitle').textContent='Battle 6';root.get('#combatEnemyState').textContent='Ordinary enemies';root.get('#viewStatus').textContent='Hero off-screen · tap Hero';
 const other=new SkirmishBattle({descriptor:descriptor('vanguard')});assert.equal(updateObjectiveFeedback(other,root),null);
 assert.equal(root.get('#combatBattleTitle').textContent,'Battle 6');assert.equal(root.get('#combatEnemyState').textContent,'Ordinary enemies');assert.equal(root.get('#viewStatus').textContent,'Hero off-screen · tap Hero');assert.equal(root.get('#batteryObjectiveBrief').textContent,'');assert.equal(root.get('#batteryObjectiveBrief').classList.contains('hidden'),true);assert.equal(root.get('.live-battle-standard').dataset.objective,undefined);assert.equal(root.get('.live-battle-standard').getAttribute('aria-label'),'Battle progress');
});
for(const [width,height,inset] of [[1280,720,0],[915,360,0],[740,320,24]])test(`${width}x${height} fixed-size real markers remain above hitboxes and do not overlap`,()=>{
 for(const biome of ['oaks','lowlands','pines','wasteland']){
  const b=battle({biome}),camera=framed(b,width,height,inset),markers=objectiveMarkerLayout(b,camera);assert.equal(markers.length,2);
  for(const marker of markers){assert.equal(marker.width,106);assert.equal(marker.height,32);assert.ok(marker.left>=8);assert.ok(marker.left+marker.width<=width-8);assert.ok(marker.top>=0);assert.ok(marker.top+marker.height<=marker.anchorY-8);
   const actual=b.objectiveMarkers.find(m=>m.id===marker.id);close(marker.anchorY,worldToScreen(camera,{x:actual.x,y:Math.min(actual.markerY,actual.y-160)}).y);assert.ok(marker.top+marker.height<worldToScreen(camera,{x:actual.x,y:actual.markerY+20}).y);
  }
  const [a,z]=markers;assert.ok(a.left+a.width<=z.left||z.left+z.width<=a.left||a.top+a.height<=z.top||z.top+z.height<=a.top);
 }
});
test('portrait map pan reveals actual targets at 390x844 and overview keeps both distinct',()=>{
 const b=battle(),near=createPortraitView(390,844,{center:550,groundY:730}),far=createPortraitView(390,844,{center:1450,groundY:730}),overview=createPortraitView(390,844,{overview:true});
 assert.equal(objectiveMarkerLayout(b,near).length,0);
 for(const camera of [far,overview]){const markers=objectiveMarkerLayout(b,camera);assert.equal(markers.length,2);assert.ok(markers.every(m=>m.width===106&&m.height===32));assert.ok(markers.every(m=>m.top>=0));}
});
test('CSS-pixel painting keeps 11px labels at every camera zoom and adds no transform or event target',()=>{
 const b=battle();for(const scale of [.195,.25,.4,.75,1,2]){const {ctx,calls}=canvas(),camera={width:4000,height:2200,scale,offsetX:0,offsetY:0,renderable:true};assert.equal(drawObjectiveMarkers(ctx,b,camera),2);assert.equal(calls.filter(c=>c.name==='fillText').length,4);assert.equal(calls.filter(c=>c.name==='fillRect'&&c.args[2]===106&&c.args[3]===32).length,2);assert.ok(!calls.some(c=>['translate','scale','setTransform'].includes(c.name)));assert.equal(ctx.font,'bold 10px system-ui,sans-serif');}
 const source=readFileSync(new URL('../site/dist/objective-feedback.mjs',import.meta.url),'utf8');assert.doesNotMatch(source,/addEventListener\s*\(|createElement\s*\(|setPointerCapture\s*\(|setInterval\s*\(|setTimeout\s*\(/);
});
test('invalid, pending, duplicated, offscreen or unrelated marker records never invent targets',()=>{
 const good=battle(),camera=createWorldCamera(915,360),base=good.objectiveMarkers[0],progress=good.objectiveProgress;
 for(const bad of [{...base,state:'pending'},{...base,id:'other-allied'},{...base,x:NaN},{...base,y:Infinity},{...base,markerY:undefined},{...base,x:9000}])assert.deepEqual(objectiveMarkerLayout({objectiveProgress:progress,objectiveMarkers:[bad]},camera),[]);
 assert.equal(objectiveMarkerLayout({objectiveProgress:progress,objectiveMarkers:[base,base]},camera).length,1);
 for(const badCamera of [null,{...camera,scale:0},{...camera,scale:NaN},{...camera,width:0},{...camera,renderable:false}])assert.deepEqual(objectiveMarkerLayout(good,badCamera),[]);
 for(const other of [{},new SkirmishBattle({descriptor:descriptor('siege')})]){const {ctx,calls}=canvas();assert.equal(drawObjectiveMarkers(ctx,other,camera),0);assert.equal(calls.length,0);}
});
test('dead marker follows its original only, next preparation has no stale destroyed marks',()=>{
 const first=battle(),[unit]=targets(first);unit.hp=0;first.checkOutcome();const original=first.objectiveMarkers[0];
 first.badTeam.splice(first.badTeam.indexOf(unit),1);first.createUnit('trebuchet');const dead=objectiveMarkerLayout(first,createWorldCamera(915,360))[0];assert.equal(dead.caption,'DESTROYED');close(dead.anchorX,worldToScreen(createWorldCamera(915,360),original).x);
 const next=battle({seed:42});assert.ok(objectiveMarkerLayout(next,createWorldCamera(915,360)).every(m=>m.caption==='TARGET'));assert.equal(objectiveFeedbackState(next).resolved,0);
});
test('read-only presentation leaves actual future combat and finite reserves unchanged',()=>{
 const a=battle(),b=battle(),root=documentFixture(),camera=createWorldCamera(915,360),{ctx}=canvas();
 const snapshot=b=>({tick:b.tick,gold:b.profile.gold,reserve:b.enemies.remaining,outcome:b.outcome,ownFlag:b.ownFlag.status,units:[...b.goodTeam,...b.badTeam].map(u=>({type:u.type,x:u.x,y:u.y,hp:u.hp,mode:u.actionMode,duration:u.actionDuration})),objective:b.objectiveProgress});
 const before=snapshot(a);for(let i=0;i<50;i++){objectiveFeedbackState(a);drawObjectiveMarkers(ctx,a,camera);updateObjectiveFeedback(a,root);}assert.deepEqual(snapshot(a),before);
 a.paused=b.paused=false;for(let i=0;i<100;i++){a.step();b.step();drawObjectiveMarkers(ctx,a,camera);}assert.deepEqual(snapshot(a),snapshot(b));
});
test('battery briefing gives real counterplay, home-flag rule and unchanged practice save boundaries',()=>{
 const markup=skirmishBriefHTML(createSkirmish(descriptor()));for(const text of [BATTERY_BRIEF.title,BATTERY_BRIEF.goal,BATTERY_BRIEF.counterplay,BATTERY_BRIEF.opening,'Every retry resets to these supplies.','No campaign progress or save is changed.','Export their deck codes before a fresh retry, restart or new field.','Ordinary costs, damage and cooldowns apply.'])assert.ok(markup.includes(text),text);
 assert.doesNotMatch(markup,/<strong>Win the field<\/strong>|or defeat the remaining army/);
});
test('all three preexisting doctrine briefings remain byte-exact across 72 baseline scenarios',()=>{
 const markup=[];for(const doctrine of ['vanguard','skywatch','siege'])for(const biome of ['oaks','lowlands','pines','wasteland'])for(const threat of ['scout','standard','veteran'])for(const seed of [73421,42])markup.push(skirmishBriefHTML(createSkirmish({version:1,seed,biome,threat,doctrine})));
 assert.equal(createHash('sha256').update(markup.join('\n')).digest('hex'),'840a0ce257edc11ab3860e1e92c1c08dd03f5513412261ed898f7e0bcb82e570');
});

test('short-landscape battery commands use left sky offsets without new controls or altered portrait layout',async()=>{
 const css=readFileSync(new URL('../site/dist/objective-feedback.css',import.meta.url),'utf8');
 for(const id of ['liveArmyOrder','liveRallyPosition'])assert.ok(css.includes(`.live-hud:has(.live-battle-standard[data-objective="intercept-battery"]) #${id}`));
 assert.match(css,/min-width:700px\) and \(max-height:500px/);
 assert.ok(css.includes('right:calc(100vw - var(--lh-r) - var(--lh-l) - 94px)'));
 assert.ok(css.includes('right:calc(100vw - var(--lh-r) - var(--lh-l) - 199px)'));
 assert.ok(css.includes('bottom:calc(100vh - var(--lh-b) - var(--lh-t) - 106px)'));
 // The arsenal is anchored to safe right/bottom. Its width cannot change these
 // world-independent docking coordinates; both retained targets are44px tall.
 for(const [width,height,left,right,top,bottom] of [[740,320,44,44,8,24],[915,360,12,12,8,10],[812,375,24,24,8,24]]){
  const firstX=width-right-(width-right-left-94)-94,secondX=width-right-(width-right-left-199)-100;
  const y=height-bottom-(height-bottom-top-106)-44;
  assert.equal(firstX,left);assert.equal(secondX,left+99);assert.equal(y,top+62);
  assert.ok(secondX+100<width/2+44);assert.ok(y+44<height*.5);
 }
});

test('forced unknown defeat does not invent a physical cause',()=>{
 const b=battle();b.finishOutcome('defeat');assert.equal(objectiveFeedbackState(b).reason,null);
});
