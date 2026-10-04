import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Element,child,gameFixture} from './helpers/viewport-lab-fixture.mjs';
let instance=0;
async function harness(){
 const game=gameFixture(),outer=new Element('document'),measurement=child(outer,'section',{class:'measurement'}),window=new Element('window');
 outer.getElementById=id=>outer.querySelector('#'+id);outer.createElementNS=(_ns,tag)=>new Element(tag);
 for(const id of ['gameFrame','device','previewStage','scaledBox','inspection','scaleMeasure','viewWidth','viewHeight','status','simulateWideCutout','simulateCutout','simulateBottomInset','hudMeasure','zoneMeasure','touchMeasure','details','showZones','showSurfaces','preset','applySize','rotate','reloadPreview','midgamePreview','cloudReviewPreview','showCollision','refreshMetrics'])child(outer,'div',{id});
 const get=id=>outer.getElementById(id),frame=get('gameFrame'),intervals=[],frames=[],posts=[];frame.contentDocument=game.doc;frame.contentWindow=game.win;game.win.postMessage=(...args)=>posts.push(args);game.win.dispatchEvent=()=>{};game.doc.documentElement={style:{setProperty(){}}};
 const env={document:outer,window,innerHeight:800,location:{origin:'https://viewport.test'},requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},setInterval:fn=>{intervals.push(fn);return intervals.length;}};
 async function run(action){const previous=new Map(Object.keys(env).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));try{for(const [key,value] of Object.entries(env))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});return await action();}finally{for(const [key,value] of previous)value?Object.defineProperty(globalThis,key,value):delete globalThis[key];}}
 const dispatch=(node,type,event={})=>run(()=>{for(const listener of node.listeners.get(type)??[])listener({target:node,...event});});
 await run(()=>import(`../site/dist/phone-preview.mjs?cloud-phone91=${++instance}`));
 return {get,game,frame,measurement,posts,run,click:id=>run(()=>get(id).click()),dispatch,interval:()=>run(()=>intervals.forEach(fn=>fn())),animation:()=>run(()=>{while(frames.length)frames.shift()();}),resize:()=>dispatch(window,'resize'),exit:()=>dispatch(window,'message',{source:frame.contentWindow,origin:'https://viewport.test',data:{type:'bowmaster-preview-exit-demo'}})};
}
function synthetic(h){
 assert.match(h.get('status').textContent,/^Synthetic cloud review · \d+ × \d+ CSS pixels · no network or persistent saves$/);
 assert.doesNotMatch(h.get('status').textContent,/Build|Waiting for the game/);
 for(const id of ['hudMeasure','zoneMeasure','touchMeasure'])assert.equal(h.get(id).textContent,'Not measured');
 assert.equal(h.measurement.dataset.state,'synthetic');assert.equal(h.get('inspection').children.length,0);
}

test('viewport lab offers only the fixed synthetic fixture URL and wraps its bounded action row',()=>{
 const markup=readFileSync(new URL('../site/dist/phone-preview.html',import.meta.url),'utf8'),script=readFileSync(new URL('../site/dist/phone-preview.mjs',import.meta.url),'utf8'),css=readFileSync(new URL('../site/dist/phone-preview.css',import.meta.url),'utf8');
 assert.match(markup,/<button id="cloudReviewPreview">Try synthetic cloud review<\/button>/);
 assert.match(markup,/network-free fixture with no persistent saves/);assert.match(script,/frame\.src='\.\/cloud-review-lab\.html'/);assert.doesNotMatch(script,/URLSearchParams|prompt\(/);assert.match(css,/\.actions\{display:flex;flex-wrap:wrap;gap:8px\}/);
});

test('synthetic selection clears stale build/metrics and all later measurement paths stay synthetic',async()=>{
 const h=await harness();await h.click('refreshMetrics');assert.match(h.get('status').textContent,/Build 80/);
 child(h.get('inspection'),'rect');await h.click('cloudReviewPreview');assert.equal(h.frame.src,'./cloud-review-lab.html');assert.equal(h.frame.title,'Synthetic cloud review viewport preview');synthetic(h);
 // Even while the old iframe document remains loaded, no game inspection or
 // collision/cutout hooks may read it after explicit synthetic selection.
 let reads=0;Object.defineProperty(h.frame,'contentDocument',{get(){reads++;throw new Error('Synthetic mode must not inspect the prior game document');}});
 await h.click('refreshMetrics');synthetic(h);await h.interval();synthetic(h);await h.dispatch(h.frame,'load');synthetic(h);await h.resize();synthetic(h);
 for(const id of ['showZones','showSurfaces','showCollision','simulateCutout','simulateWideCutout','simulateBottomInset']){await h.dispatch(h.get(id),'change');synthetic(h);}
 h.get('preset').value='390,844';await h.dispatch(h.get('preset'),'change');await h.animation();assert.match(h.get('status').textContent,/390 × 844/);synthetic(h);
 await h.click('rotate');await h.animation();assert.match(h.get('status').textContent,/844 × 390/);synthetic(h);
 h.get('viewWidth').value='915';h.get('viewHeight').value='360';await h.click('applySize');await h.animation();assert.match(h.get('status').textContent,/915 × 360/);synthetic(h);
 await h.exit();assert.equal(h.frame.src,'./cloud-review-lab.html');synthetic(h);assert.equal(reads,0);assert.deepEqual(h.posts,[]);
});

for(const [action,path] of [['reloadPreview','./battle?mode=test'],['midgamePreview','./battle?mode=demo']])test(`${action} returns to its original game route and restores inspection`,async()=>{
 const h=await harness();await h.click('cloudReviewPreview');synthetic(h);await h.click(action);assert.equal(h.frame.src,path);assert.equal(h.frame.title,'Castledecks game viewport preview');
 await h.dispatch(h.frame,'load');assert.match(h.get('status').textContent,/Build 80/);assert.notEqual(h.measurement.dataset.state,'synthetic');assert.notEqual(h.get('touchMeasure').textContent,'Not measured');assert.equal(h.posts.length,1);
 await h.exit();assert.equal(h.frame.src,'./battle?mode=test');await h.click('refreshMetrics');assert.match(h.get('status').textContent,/Build 80/);
});
