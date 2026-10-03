import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {drawGorath,gorathPose,gorathAxePose,gorathGroundY,gorathWorldToLocal,GORATH_COLORS} from '../site/dist/gorath-art.mjs';
import {BOSS_REACTION_REGIONS} from '../site/dist/engine/boss-geometry.mjs';
import {TestBoss,GORATH_ACTION as G} from '../site/dist/engine/later-enemies.mjs';
import {GorathCompanion} from '../site/dist/engine/companions.mjs';
const unit=(extra={})=>({type:'gorath',x:800,y:500,hp:100,maxHp:100,visible:true,team:'bad',facing:1,forward:-1,animation:{displayFrame:60,frame:60},...extra});
function context(){const calls=[],stack=[];let state={globalAlpha:1,fillStyle:'#000',strokeStyle:'#000',lineWidth:1,lineJoin:'miter',lineCap:'butt'};const ctx=new Proxy({}, {get:(_,key)=>key==='save'?()=>stack.push({...state}):key==='restore'?()=>{assert.ok(stack.length);state=stack.pop();}:key in state?state[key]:(...args)=>{assert.ok(args.filter(a=>typeof a==='number').every(Number.isFinite),String(key)+' received nonfinite geometry');calls.push({key,args});},set:(_,key,value)=>{state[key]=value;return true;}});return {ctx,calls,stack,state:()=>state};}
const world=(u,p)=>{const a=(u.collisionRotation??0)*Math.PI/180,f=u.facing;return {x:u.x+Math.cos(a)*f*p.x-Math.sin(a)*p.y,y:u.y+Math.sin(a)*f*p.x+Math.cos(a)*p.y};};

test('all 470 measured frames draw finite geometry with balanced state and no mutation',()=>{
 for(const team of ['good','bad'])for(let frame=1;frame<=470;frame++){
  const u=Object.freeze(unit({team,facing:team==='good'?-1:1,animation:Object.freeze({displayFrame:frame,frame}),dead:frame>=391&&frame<=420,hp:frame>=391&&frame<=420?0:100}));
  const c=context(),before=JSON.stringify(u),state={...c.state()};
  assert.equal(drawGorath(c.ctx,u,{elevationAt:x=>500+(x-800)*.07}),true);
  assert.ok(c.calls.length>100);assert.equal(c.stack.length,0);assert.deepEqual(c.state(),state);assert.equal(JSON.stringify(u),before);
 }
});
test('invalid or unrelated units do not issue Canvas calls',()=>{for(const u of [null,unit({x:NaN}),unit({y:Infinity}),unit({visible:false}),unit({type:'grunt'})]){const c=context();assert.equal(drawGorath(c.ctx,u),false);assert.equal(c.calls.length,0);}});
test('at least one sole is planted on true terrain, including slope and facing/rotation',()=>{
 for(const facing of [-1,1])for(const collisionRotation of [-18,0,21])for(let frame=5;frame<=470;frame++){
  const u=unit({facing,collisionRotation,animation:{displayFrame:frame,frame}}),elevationAt=x=>500+(x-800)*.14,p=gorathPose(u,{elevationAt});
  assert.ok(p.front.planted||p.rear.planted);for(const foot of [p.front,p.rear]){const w=world(u,foot);if(foot.planted)assert.ok(Math.abs(w.y-elevationAt(w.x))<.001,`${frame}: sole detached`);assert.ok(foot.y<=foot.ground);}
 }
});
test('named reaction panels retain exact engine regions and do not make a missing armor target',()=>{
 for(let frame=5;frame<=470;frame++){const r=BOSS_REACTION_REGIONS[frame-1],p=gorathPose(unit({animation:{displayFrame:frame,frame}}));assert.strictEqual(p.regions,r);if(r.armorbox){assert.deepEqual([p.armor.left,p.armor.right,p.armor.top,p.armor.bottom],r.armorbox);}if(r.headbox)assert.deepEqual([p.head.left,p.head.right,p.head.top,p.head.bottom],r.headbox);if(r.bellybox)assert.deepEqual([p.belly.left,p.belly.right,p.belly.top,p.belly.bottom],r.bellybox);if(!r.armorbox&&r.bellybox)assert.equal(p.hasArmor,false);}
});
test('allies use blue/ivory chevron palette and the caller mirror, rather than double mirroring',()=>{
 assert.notEqual(GORATH_COLORS.good.cloth,GORATH_COLORS.bad.cloth);assert.notEqual(GORATH_COLORS.good.crest,GORATH_COLORS.bad.crest);
 const c=context();drawGorath(c.ctx,unit({team:'good',facing:-1,isCompanion:true}));assert.equal(c.calls.some(c=>c.key==='scale'),false);
 for(const forward of [-1,1]){const u=unit({isCompanion:true,team:'good',forward,facing:-forward,actionMode:'axe_attack',signatureWindup:0}),p=gorathAxePose(u),w=world(u,p.edge);assert.equal(w.x,u.x+forward*80);assert.equal(w.y,u.y);}
});
test('long raised hold never lands even with stale displayFrame and stale axeLanded',()=>{
 for(const d of [300,200,0])for(const f of [5,85,96,117,245]){const p=gorathAxePose(unit({actionMode:'hold_up_axe',actionDuration:d,axeLanded:true,animation:{displayFrame:f}}));assert.equal(p.landed,false);assert.equal(p.drop,0);assert.ok(p.edge.y<-200);}
});
test('real hostile action emits on update7 and the weapon contact only follows the real flag',()=>{
 const requests=[],world={elevationAt:()=>500};const boss=new TestBoss({world,x:800,y:500,services:{queueSpell:r=>requests.push(r)},enemies:[],stats:{maxHp:100,speed:3,damage:20}});
 boss.transition(G.AXE_ATTACK);
 for(let tick=1;tick<=11;tick++){boss.step();const p=gorathAxePose(boss);assert.equal(p.landed,tick>=7);if(tick<7)assert.ok(p.edge.y<0);else{assert.equal(p.edge.x,-190);assert.equal(p.edge.y,0);}}
 assert.equal(requests.length,1);assert.equal(requests[0].kind,'gorath_shock_wave');assert.equal(requests[0].x,610);
});
test('companion18 tick signature, retained observer cue, and reload do not reuse hostile timing',()=>{
 for(let remaining=18;remaining>=0;remaining--){const p=gorathAxePose(unit({isCompanion:true,forward:1,facing:-1,actionMode:'axe_attack',signatureWindup:remaining}));assert.equal(p.landed,remaining===0);if(remaining>0)assert.ok(p.edge.y<0);}
 for(const impactAge of [0,1,9]){const p=gorathAxePose(unit({isCompanion:true,forward:1,facing:-1,actionMode:'companion_guard'}),{record:{impactAge}});assert.equal(p.landed,true);assert.equal(p.edge.x,-80);}
 assert.equal(gorathAxePose(unit({isCompanion:true,actionMode:'companion_guard'}),{record:{impactAge:10}}).landed,false);
 assert.equal(gorathAxePose(unit({actionMode:'reload',actionDuration:75,axeLanded:false,animation:{displayFrame:245}})).edge.y,0);
 assert.ok(gorathAxePose(unit({actionMode:'reload',actionDuration:0,axeLanded:false})).edge.y<-100);
});
test('actual blade vertex inverse-transforms to the exact unchanged world strike on sloped terrain',()=>{
 for(const facing of [-1,1])for(const collisionRotation of [-15,0,20]){
  const u=unit({facing,collisionRotation,actionMode:'axe_attack',axeLanded:true}),elevationAt=x=>500+(x-800)*.18;
  const p=gorathAxePose(u,{elevationAt}),w=world(u,p.edge);assert.ok(Math.abs(w.x-610)<1e-9);assert.ok(Math.abs(w.y-elevationAt(610))<1e-9);
  const a=p.angle,edge={x:p.head.x-46*Math.cos(a)+23*Math.sin(a),y:p.head.y-46*Math.sin(a)-23*Math.cos(a)};assert.ok(Math.abs(edge.x-p.edge.x)<1e-9);assert.ok(Math.abs(edge.y-p.edge.y)<1e-9);
 }
});
test('death retains giant-sized kneeling silhouette without changing killed lifetime',()=>{
 const values=[391,400,410,420].map(frame=>gorathPose(unit({hp:0,dead:true,actionMode:'killed',animation:{start:391,frame,displayFrame:frame}})));
 assert.ok(values.every(p=>p.armor.w>75&&p.armor.h>=70));assert.ok(values.at(-1).armor.top>values[0].armor.top);assert.ok(values.every(p=>p.front.planted&&p.rear.planted));
});
test('integration keeps the existing caller transform and intercepts Gorath before tiny-corpse fallback',()=>{
 const source=readFileSync(new URL('../site/dist/battle.mjs',import.meta.url),'utf8');
 assert.match(source,/import \{drawGorath\} from '\.\/gorath-art\.mjs'/);
 const troop=source.slice(source.indexOf('function troop(unit)'),source.indexOf('function drawArrow'));
 const special=troop.indexOf("if((unit.airUnit||unit.type==='gorath')&&unit.hp<=0)"),generic=troop.indexOf('if(unit.hp<=0)');
 assert.ok(special>=0&&generic>special,'Gorath and air death must be handled before generic corpse');
 assert.match(source,/drawGorath\(ctx,unit,\{elevationAt:x=>battle\.elevationAt\(x\),record:specialMotion\.record\(unit\)\}\)/);
 assert.match(troop,/ctx\.scale\(unit\.facing\?\?1,1\)/);assert.match(source,/elevationAt:x=>battle\.elevationAt\(x\)/);
});

test('restrained walk lifts one boot but never bobs both feet off terrain',()=>{
 const u=unit({actionMode:'left_step',vx:-2,animation:{displayFrame:20,frame:20}}),p=gorathPose(u);assert.ok(p.front.y<0);assert.equal(p.rear.y,0);assert.equal(p.rear.planted,true);
 const hold=gorathPose({...u,actionMode:'hold_left_step',vx:0});assert.equal(hold.front.y,0);assert.equal(hold.rear.y,0);
});
test('real companion wave and axe contact coincide on its18th update',()=>{
 const events=[],spells=[],world={width:2000,elevationAt:()=>500,structures:[],hero:{x:600},emit:e=>events.push(e),addSpell:s=>spells.push(s)};
 const boss=new GorathCompanion({world,x:800,y:500,team:'good',enemies:()=>[],services:{}});assert.equal(boss.beginSignature(),true);
 for(let tick=1;tick<=18;tick++){boss.step();const p=gorathAxePose(boss);assert.equal(p.landed,tick===18);assert.equal(spells.length,tick===18?1:0);}
 assert.equal(events.filter(e=>e.type==='companion-signature').length,1);assert.equal(spells[0].x,880);
});
