import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SkirmishBattle} from '../site/dist/skirmish-battle.mjs';
import {armyOrderMarkerLayout,drawArmyOrderMarker} from '../site/dist/army-orders-ui.mjs';
import {objectiveMarkerLayout} from '../site/dist/objective-feedback.mjs';
import {createWorldCamera,worldToScreen} from '../site/dist/world-camera.mjs';
import {createPortraitView} from '../site/dist/portrait-view.mjs';
import {frameCombatCamera} from '../site/dist/combat-camera.mjs';
import {fortificationGeometry} from '../site/dist/fortress-art.mjs';
const fresh=(overrides={})=>new SkirmishBattle({descriptor:{version:1,seed:42,biome:'oaks',threat:'scout',doctrine:'battery',...overrides}});
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const bounds=(marker,camera)=>{const anchor=worldToScreen(camera,marker),unit=camera.scale*marker.k;return {left:anchor.x+(marker.side<0?-76*unit:0),top:anchor.y-(76+marker.rise)*unit,width:76*unit,height:41*unit};};
const intersects=(a,b,gap=0)=>a.left<b.left+b.width+gap&&a.left+a.width+gap>b.left&&a.top<b.top+b.height+gap&&a.top+a.height+gap>b.top;
function landscape(b,width=740,height=320,bottomInset=24,top=8){
 return frameCombatCamera(createWorldCamera(width,height),{groundY:Math.max(...b.terrain.samples),structureTopY:Math.min(...b.structures.map(s=>fortificationGeometry(s).body.y)),aimOriginTopY:Math.min(Math.min(...b.terrain.samples)-30,...b.structures.map(s=>s.y+s.shotOffset.y)),top,bottom:height-bottomInset-62});
}
function setOrders(b,front,support){
 b.setArmyOrder('advance');if(front!=='advance')b.setArmyOrder('rally',front,'frontline');if(support!=='advance')b.setArmyOrder('rally',support,'support');
}
function noClash(b,camera){
 const objectives=objectiveMarkerLayout(b,camera),previous=[];
 for(const marker of armyOrderMarkerLayout(b,camera.scale,camera)){
  assert.equal(marker.y,b.elevationAt(marker.x));const rect=bounds(marker,camera),anchor=worldToScreen(camera,marker);
  if(anchor.x<0||anchor.x>camera.width||rect.top+rect.height<0||rect.top>camera.height)continue;
  for(const obstacle of [...objectives,...previous])assert.equal(intersects(rect,obstacle,5.9),false,JSON.stringify({camera,marker,rect,obstacle}));
  if(marker.rise||marker.side<0){assert.ok(rect.left>=8&&rect.left+rect.width<=camera.width-8);assert.ok(rect.top>=8);assert.ok(marker.rise*camera.scale*marker.k<=160);}
  previous.push(rect);
 }
}
function recorder(){
 const calls=[],ctx=new Proxy({},{get:(o,key)=>key in o?o[key]:(...args)=>{for(const n of args)if(typeof n==='number')assert.ok(Number.isFinite(n),key);calls.push([key,...args]);},set:(o,key,value)=>(o[key]=value,calls.push(['set',key,value]),true)});return {ctx,calls};
}

test('740x320 Battery seed42 Frontline Center flips left while Support Rear stays byte-equivalent in placement',()=>{
 const b=fresh(),camera=landscape(b);setOrders(b,'center','rear');
 const before=armyOrderMarkerLayout(b,camera.scale),after=armyOrderMarkerLayout(b,camera.scale,camera),objectives=objectiveMarkerLayout(b,camera);
 assert.ok(objectives.some(o=>intersects(bounds(before[0],camera),o)));
 assert.equal(after[0].label,'FRONTLINE');assert.equal(after[0].side,-1);assert.equal(after[0].rise,0);assert.equal(after[0].x,1050);
 assert.deepEqual(after[1],before[1]);assert.equal(after[1].x,500);noClash(b,camera);
});
test('390x844 Whole field unified Forward Rally clears both Battery labels with a bounded upward pole',()=>{
 const b=fresh(),camera=createPortraitView(390,844,{overview:true});b.setArmyOrder('rally','forward');
 const [before]=armyOrderMarkerLayout(b,camera.scale),[after]=armyOrderMarkerLayout(b,camera.scale,camera);
 assert.ok(objectiveMarkerLayout(b,camera).some(o=>intersects(bounds(before,camera),o)));
 assert.equal(after.label,'RALLY');assert.equal(after.x,1500);assert.equal(after.y,b.elevationAt(1500));assert.ok(after.rise>0);noClash(b,camera);
});
for(const biome of ['oaks','lowlands','pines','wasteland'])test(`${biome}: every split/unified/individual hold clears objectives in portrait and short-landscape views`,()=>{
 for(const seed of [42,73421])for(const threat of ['scout','standard','veteran']){
  const b=fresh({biome,seed,threat}),groundY=Math.max(...b.terrain.samples);
  // Side safe insets change HUD positions, not the full-canvas width. The
  // observed 44px side /24px bottom case is represented by740x320/top8/bottom234.
  const cameras=[[740,320,24],[915,360,0],[915,360,24],[1280,720,0]].map(([w,h,inset])=>landscape(b,w,h,inset));
  for(const [width,height]of [[390,844],[360,640],[412,780]])for(const center of [null,500,1000,1500,'overview'])cameras.push(createPortraitView(width,height,{heroX:b.hero.x,groundY,groundBottom:height*.58,center:typeof center==='number'?center:null,overview:center==='overview'}));
  for(const front of ['advance','rear','center','forward'])for(const support of ['advance','rear','center','forward']){
   setOrders(b,front,support);for(const camera of cameras)noClash(b,camera);
  }
 }
});
test('no-objective commands and unobstructed Battery banners retain the original draw calls',()=>{
 for(const doctrine of ['vanguard','skywatch','siege']){
  const b=fresh({doctrine});for(const front of ['advance','rear','center','forward'])for(const support of ['advance','rear','center','forward']){
   setOrders(b,front,support);for(const camera of [landscape(b),createPortraitView(390,844,{overview:true})]){const a=recorder(),z=recorder();drawArmyOrderMarker(a.ctx,b,camera.scale);drawArmyOrderMarker(z.ctx,b,camera.scale,camera);assert.deepEqual(z.calls,a.calls);}
  }
 }
 const b=fresh(),camera=landscape(b);b.setArmyOrder('rally','rear');const a=recorder(),z=recorder();drawArmyOrderMarker(a.ctx,b,camera.scale);drawArmyOrderMarker(z.ctx,b,camera.scale,camera);assert.deepEqual(z.calls,a.calls);
});
test('both active, secured and destroyed objective rectangles remain obstacles without changing target geometry',()=>{
 const b=fresh(),camera=landscape(b);setOrders(b,'center','forward');
 const original=b.objectiveMarkers.map(m=>[m.id,m.x,m.y,m.markerY]);
 for(const state of ['active','secured','neutralized']){
  const markers=b.objectiveMarkers.map(m=>({...m,state})),fixture={armyOrder:b.armyOrder,elevationAt:x=>b.elevationAt(x),objectiveProgress:b.objectiveProgress,objectiveMarkers:markers};
  noClash(fixture,camera);assert.deepEqual(markers.map(m=>[m.id,m.x,m.y,m.markerY]),original);
 }
});
test('invalid and missing cameras preserve legacy drawing; nonfinite anchors/terrain are never painted',()=>{
 const b=fresh(),camera=landscape(b);setOrders(b,'center','rear');const expected=armyOrderMarkerLayout(b,camera.scale);
 for(const invalid of [undefined,null,{}, {...camera,renderable:false},{...camera,scale:0},{...camera,scale:NaN},{...camera,width:0},{...camera,height:Infinity},{...camera,offsetX:NaN},{...camera,offsetY:Infinity}])assert.deepEqual(armyOrderMarkerLayout(b,camera.scale,invalid),expected);
 for(const x of [NaN,Infinity,-Infinity])assert.deepEqual(armyOrderMarkerLayout({armyOrder:{mode:'rally',anchorX:x},elevationAt:()=>720},1,camera),[]);
 for(const y of [NaN,Infinity,-Infinity])assert.deepEqual(armyOrderMarkerLayout({armyOrder:{mode:'rally',anchorX:600},elevationAt:()=>y},1,camera),[]);
 for(const scale of [NaN,Infinity,-Infinity,0,.05,.25,.75,1,2]){const {ctx}=recorder();drawArmyOrderMarker(ctx,b,scale,camera);}
});
test('portrait panning keeps offscreen real lines offscreen rather than inventing edge markers',()=>{
 const b=fresh();b.setArmyOrder('rally','forward');const camera=createPortraitView(390,844,{center:500,groundY:730}),before=armyOrderMarkerLayout(b,camera.scale),after=armyOrderMarkerLayout(b,camera.scale,camera);
 assert.ok(worldToScreen(camera,after[0]).x>camera.width);assert.deepEqual(after,before);assert.deepEqual(objectiveMarkerLayout(b,camera),[]);
 // A target can be visible while the selected company is offscreen.
 b.setArmyOrder('rally','rear');const far=createPortraitView(390,844,{center:1500,groundY:730});assert.ok(objectiveMarkerLayout(b,far).length);assert.deepEqual(armyOrderMarkerLayout(b,far.scale,far),armyOrderMarkerLayout(b,far.scale));
});
test('crowded cropped sky fails softly with finite original geometry instead of dragging a banner downward',()=>{
 const b=fresh();b.setArmyOrder('rally','forward');const originalCamera=createPortraitView(390,844,{overview:true}),first=objectiveMarkerLayout(b,originalCamera)[0];
 const camera={...originalCamera,offsetY:originalCamera.offsetY-first.top+10,height:110};
 const [marker]=armyOrderMarkerLayout(b,camera.scale,camera);assert.equal(marker.x,1500);assert.ok(marker.rise>=0);assert.ok(marker.rise*camera.scale*marker.k<=160);drawArmyOrderMarker(recorder().ctx,b,camera.scale,camera);
});
test('world-space draw projects banner bounds in CSS pixels at every DPR and preserves the real ground strokes',()=>{
 const b=fresh();for(const camera of [landscape(b),createPortraitView(390,844,{overview:true})]){
  setOrders(b,'center','forward');const layouts=armyOrderMarkerLayout(b,camera.scale,camera),{ctx,calls}=recorder();drawArmyOrderMarker(ctx,b,camera.scale,camera);
  assert.deepEqual(calls.filter(c=>c[0]==='translate'),layouts.map(m=>['translate',m.x,m.y]));
  const strokes=calls.filter(c=>c[0]==='lineTo');for(const m of layouts){assert.ok(strokes.some(c=>c[1]===0&&c[2]===-76-m.rise));assert.ok(strokes.some(c=>c[1]===24/m.k&&c[2]===-2));}
  for(const m of layouts)for(const dpr of [1,1.25,2,3]){
   const expected=bounds(m,camera),x=m.side<0?-76:0,y=-76-m.rise;
   close((camera.offsetX+(m.x+x*m.k)*camera.scale)*dpr/dpr,expected.left);
   close((camera.offsetY+(m.y+y*m.k)*camera.scale)*dpr/dpr,expected.top);
  }
  assert.ok(!calls.some(c=>['setTransform','resetTransform'].includes(c[0])));
 }
});
test('repeated rendering has no state effects and preserves the same subsequent simulation',()=>{
 const a=fresh(),b=fresh();setOrders(a,'center','rear');setOrders(b,'center','rear');const camera=landscape(a),{ctx}=recorder();
 const snapshot=b=>({tick:b.tick,orders:b.armyOrder,profile:b.profile.toJSON?.()??JSON.parse(JSON.stringify(b.profile)),stats:b.stats,reserve:b.enemies.remaining,outcome:b.outcome,objective:b.objectiveProgress,units:[...b.goodTeam,...b.badTeam].map(u=>({type:u.type,x:u.x,y:u.y,hp:u.hp,mode:u.actionMode,duration:u.actionDuration}))});
 const before=structuredClone(snapshot(a));for(let i=0;i<30;i++)drawArmyOrderMarker(ctx,a,camera.scale,camera);assert.deepEqual(snapshot(a),before);
 a.paused=b.paused=false;for(let i=0;i<100;i++){a.step();b.step();drawArmyOrderMarker(ctx,a,camera.scale,camera);}assert.deepEqual(snapshot(a),snapshot(b));
});
test('battle passes its current CSS camera once and placement adds no input handlers, DPR, or state writers',()=>{
 const source=readFileSync(new URL('../site/dist/army-orders-ui.mjs',import.meta.url),'utf8'),placement=source.slice(source.indexOf('const BANNER_GAP'));
 assert.doesNotMatch(placement,/addEventListener|devicePixelRatio|setTransform|createElement|setArmyOrder|setInterval|setTimeout|Math\.random/);
 const battle=readFileSync(new URL('../site/dist/battle.mjs',import.meta.url),'utf8');assert.equal((battle.match(/drawArmyOrderMarker\(ctx,battle,camera\.scale,camera\)/g)||[]).length,1);
});
