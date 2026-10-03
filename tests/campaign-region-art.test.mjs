import test from 'node:test';
import assert from 'node:assert/strict';
import {REGION_ART,REGION_ART_LIMITS,campaignScene,sceneBackingSize,createCampaignRegionArt} from '../site/dist/campaign-region-art.mjs';
import {getLevel} from '../site/dist/engine/levels.mjs';

function context() {
 const calls=[];
 const c={calls,createLinearGradient(...args){calls.push(['gradient',...args]);return {addColorStop(...s){calls.push(['stop',...s]);}};}};
 for(const name of ['save','restore','setTransform','fillRect','drawImage','beginPath','moveTo','lineTo','closePath','fill','clip','stroke'])c[name]=(...args)=>calls.push([name,...args]);
 return c;
}
function harness({canvasNull=false}={}) {
 const images=[],canvases=[],screen=context();let invalidations=0;
 const art=createCampaignRegionArt({createImage(){
  const i={naturalWidth:1774,naturalHeight:887,removed:0,removeAttribute(name){if(name==='src')this.removed++;}};images.push(i);return i;
 },createCanvas(){if(canvasNull)return null;const c={width:1,height:1,context:context(),getContext(){return this.context;}};canvases.push(c);return c;},onInvalidate(){invalidations++;}});
 const draw=(data={scenery:'oaks',timeOfDay:'dawn'},size=[1440,720],opts={pixelRatio:2})=>art.drawBackdrop(screen,...size,data,opts);
 return {art,images,canvases,screen,draw,get invalidations(){return invalidations;}};
}

test('all 30 actual levels resolve their real region and daypart',()=>{
 for(let level=1;level<=30;level++){
  const data=getLevel(level),scene=campaignScene(data),expected=level<=6?'oaks':level<=15?'lowlands':level<=23?'pines':'wasteland';
  assert.equal(scene.scenery,expected);assert.equal(scene.timeOfDay,data.timeOfDay);assert.equal(scene.region,REGION_ART[expected]);
  assert.equal(scene,campaignScene(data),'no new descriptor per frame');
 }
});
test('malformed metadata has deterministic bounded fallback, including inherited keys',()=>{
 assert.equal(campaignScene(null).key,'oaks:default');
 assert.equal(campaignScene({level:30,scenery:'unknown',timeOfDay:'unknown'}).key,'wasteland:default');
 assert.equal(campaignScene({level:16,scenery:'__proto__',timeOfDay:'constructor'}).key,'pines:default');
 assert.equal(campaignScene({level:7,scenery:'oaks',timeOfDay:'night'}).key,'oaks:night','explicit metadata wins');
});
test('four distinct source paintings and bounded backing store at desktop/phone/huge DPR',()=>{
 assert.equal(new Set(Object.values(REGION_ART).map(r=>r.url)).size,4);
 for(const [w,h,dpr] of [[1440,900,2],[390,844,3],[844,390,3],[4096,4096,5],[2560,1080,2],[1,1,.5]]){
  const s=sceneBackingSize(w,h,dpr);assert.ok(s.width<=1774&&s.height<=1774);assert.ok(s.width*s.height<=REGION_ART_LIMITS.canvasPixels);
 }
 for(const [w,h] of [[0,720],[1440,0],[-1,720],[Infinity,720],[NaN,720]])assert.equal(sceneBackingSize(w,h),null);
});
test('warm redraws reuse the active composite and do not allocate another image/canvas/gradient',()=>{
 const h=harness();h.draw();h.images[0].onload();h.draw();
 const count=h.canvases[0].context.calls.length;
 for(let i=0;i<300;i++)h.draw();
 assert.equal(h.art.diagnostics().loads,1);assert.equal(h.art.diagnostics().compositions,2);
 assert.equal(h.canvases.length,1);assert.equal(h.canvases[0].context.calls.length,count);
});
test('daypart/resolution/contrast changes overwrite one composite without another image',()=>{
 const h=harness();h.draw();h.images[0].onload();h.draw();
 h.draw({scenery:'oaks',timeOfDay:'night'});h.draw({scenery:'oaks',timeOfDay:'night'},[390,844]);
 h.draw({scenery:'oaks',timeOfDay:'night'},[390,844],{contrast:true});
 assert.equal(h.images.length,1);assert.equal(h.canvases.length,1);assert.equal(h.art.diagnostics().compositions,5);
});
test('LRU evicts before third region load and drops stale callbacks',()=>{
 const h=harness();h.draw();const stale=h.images[0].onload;
 h.draw({scenery:'lowlands'});h.images[1].onload();h.draw({scenery:'pines'});
 assert.equal(h.art.diagnostics().imageEntries,2);assert.equal(h.images[0].removed,1);assert.equal(h.images[0].onload,null);
 const before=h.invalidations;stale();assert.equal(h.invalidations,before);assert.equal(h.art.diagnostics().decodedBytes,1774*887*4);
});
test('recently reused region survives eviction and every switch remains within byte budget',()=>{
 const h=harness();
 for(const scenery of ['oaks','lowlands','oaks','pines','wasteland','lowlands','pines','oaks']){
  h.draw({scenery,timeOfDay:'night'});const i=h.images.at(-1);if(i.onload)i.onload();h.draw({scenery,timeOfDay:'night'});
  const d=h.art.diagnostics();assert.ok(d.imageEntries<=2);assert.ok(d.decodedBytes+d.canvasBytes<=1774*887*4*3);
 }
 assert.equal(h.canvases.length,1);assert.ok(h.art.diagnostics().evictions>=4);
});
test('failed/oversized image uses fallback without retry loops or retaining bad image',()=>{
 const h=harness();h.draw();h.images[0].onerror();for(let i=0;i<30;i++)h.draw();
 assert.equal(h.images.length,1);assert.equal(h.art.diagnostics().failures,1);assert.equal(h.art.diagnostics().decodedBytes,0);
 h.draw({scenery:'pines'});h.images[1].naturalWidth=8192;h.images[1].onload();h.draw({scenery:'pines'});
 assert.equal(h.art.diagnostics().failures,2);assert.equal(h.images[1].removed,1);
});
test('dispose closes bitmap when supplied, cancels image handlers, shrinks canvas, ignores late callback',()=>{
 const h=harness();h.draw();const late=h.images[0].onload;let closed=0;h.images[0].close=()=>closed++;
 const canvas=h.canvases[0];h.art.dispose();late();assert.equal(closed,1);assert.equal(h.invalidations,0);
 assert.equal(canvas.width,1);assert.equal(canvas.height,1);assert.equal(h.art.diagnostics().imageEntries,0);
 assert.equal(h.art.diagnostics().canvasBytes,0);assert.equal(h.draw(),false);
});
test('headless canvas/image failure still paints fallback and accepts disposal',()=>{
 const h=harness({canvasNull:true});assert.equal(h.draw(),false);assert.ok(h.screen.calls.some(c=>c[0]==='fillRect'));h.art.dispose();
 const art=createCampaignRegionArt({createImage:()=>null,createCanvas:()=>null});assert.equal(art.drawBackdrop(context(),640,360,{}),false);art.dispose();
});
test('terrain starts with exact caller geometry, does not mutate it, and reuses gradient',()=>{
 const h=harness(),c=context(),view={surface:[[0,600],[20,590],[40,610],[60,625]],polygon:[[0,600],[20,590],[40,610],[60,625],[60,1000],[0,1000]]};
 const before=JSON.stringify(view);h.art.drawTerrain(c,view,getLevel(1));
 assert.equal(JSON.stringify(view),before);assert.deepEqual(c.calls.filter(v=>v[0]==='lineTo').slice(0,5).map(v=>v.slice(1)),view.polygon.slice(1));
 const gradients=c.calls.filter(v=>v[0]==='gradient').length;h.art.drawTerrain(c,view,getLevel(1));assert.equal(c.calls.filter(v=>v[0]==='gradient').length,gradients);
});
test('contrast mode omits material marks while preserving exact surface and bright rim',()=>{
 const h=harness(),c=context(),view={surface:[[0,600],[20,590],[40,610]],polygon:[[0,600],[20,590],[40,610],[40,1000],[0,1000]]};
 h.art.drawTerrain(c,view,getLevel(25),{contrast:true});assert.equal(c.calls.filter(v=>v[0]==='stroke').length,1);assert.equal(c.strokeStyle,'#e4dcb5');assert.equal(c.lineWidth,4);
});
test('camera and DPR transform changes invalidate cached terrain gradient',()=>{
 const h=harness(),c=context(),view={surface:[[0,600],[20,590]],polygon:[[0,600],[20,590],[20,1000],[0,1000]]};
 let transform={a:1,b:0,c:0,d:1,e:0,f:0};c.getTransform=()=>transform;
 h.art.drawTerrain(c,view,getLevel(1));h.art.drawTerrain(c,view,getLevel(1));
 assert.equal(c.calls.filter(v=>v[0]==='gradient').length,1);
 transform={...transform,a:.4,d:.4,e:-50,f:210};h.art.drawTerrain(c,view,getLevel(1));
 assert.equal(c.calls.filter(v=>v[0]==='gradient').length,2);
});
test('presentation never invokes global or injected battle RNG',()=>{
 const original=Math.random;Math.random=()=>{throw new Error('presentation touched RNG');};
 try {const h=harness();for(const scenery of Object.keys(REGION_ART))h.draw({scenery,timeOfDay:'night',random:Math.random});h.art.dispose();}
 finally {Math.random=original;}
});
