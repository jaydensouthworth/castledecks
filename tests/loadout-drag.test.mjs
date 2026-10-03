import test from 'node:test';import assert from 'node:assert/strict';
import {createLoadoutDrag,createCardLift} from '../site/dist/loadout-drag.mjs';
function fixture(t){
 let time=0,next=0,point=null;const frames=new Map(),captures=new Map(),events={drop:[],hint:[],start:[],cancel:[],bar:[]};
 class Element{
  constructor(attributes={},parentNode=null){this.attributes=attributes;this.parentNode=parentNode;this.listeners={};this.style={};this.children=[];const classes=new Set();this.classList={add:(...names)=>names.forEach(n=>classes.add(n)),remove:(...names)=>names.forEach(n=>classes.delete(n)),contains:n=>classes.has(n)};this.ownerDocument=doc;this.scrollHeight=0;this.clientHeight=0;this.scrollTop=0;}
  getAttribute(name){return this.attributes[name]??null;}setAttribute(n,v){this.attributes[n]=v;}removeAttribute(n){delete this.attributes[n];}
  addEventListener(type,callback){(this.listeners[type]??=[]).push(callback);}
  fire(type,init={}){const event={type,target:this,button:0,pointerId:1,pointerType:'mouse',isPrimary:true,clientX:20,clientY:20,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},stopImmediatePropagation(){this.stopped=true;},...init};for(let e=this;e;e=e.parentNode){for(const fn of e.listeners[type]??[])fn(event);if(event.stopped)break;}return event;}
  setPointerCapture(id){const old=captures.get(id);captures.set(id,this);if(old&&old!==this)old.fire('lostpointercapture',{pointerId:id});}hasPointerCapture(id){return captures.get(id)===this;}releasePointerCapture(id){if(this.hasPointerCapture(id)){captures.delete(id);this.fire('lostpointercapture',{pointerId:id});}}
  appendChild(node){this.children.push(node);node.parentNode=this;return node;}remove(){this.parentNode.children=this.parentNode.children.filter(e=>e!==this);this.parentNode=null;}
  getBoundingClientRect(){return {top:0,bottom:200,left:0,right:400,width:400,height:200};}
 }
 const doc={elementFromPoint:()=>point,createElement:()=>new Element()};doc.body=new Element();const root=new Element({},doc.body),source=new Element({'data-drag-ability':'fireArrow'},root),handle=new Element({'data-drag-handle':'true'},source),slot=new Element({'data-drop-slot':'4'},root),bar=new Element({'data-loadout-bar':'1'},root),scroll=new Element({'data-loadout-scroll':''},root);
 const original=new Map(['requestAnimationFrame','cancelAnimationFrame','performance','window'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 const replacements={requestAnimationFrame:fn=>{frames.set(++next,fn);return next;},cancelAnimationFrame:id=>frames.delete(id),performance:{now:()=>time},window:new Element()};for(const [k,v] of Object.entries(replacements))Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v});
 t.after(()=>{for(const [key,desc] of original)if(desc)Object.defineProperty(globalThis,key,desc);else delete globalThis[key];});
 const adapter=createLoadoutDrag({root,getAbility:id=>({name:id,icon:'icon'}),onDrop:(...v)=>events.drop.push(v),onHint:(...v)=>events.hint.push(v),onStart:(...v)=>events.start.push(v),onCancel:(...v)=>events.cancel.push(v),onBar:(...v)=>events.bar.push(v)});
 return {root,source,handle,slot,bar,scroll,adapter,events,captures,doc,setPoint:p=>point=p,step(ms=16){time+=ms;const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn());},send(type,init={}){return (captures.get(init.pointerId??1)??source).fire(type,init);}};
}
test('mouse threshold preserves tap; real drag captures root, shows ghost and commits target exactly once',t=>{
 const f=fixture(t);f.source.fire('pointerdown');f.send('pointermove',{clientX:23});f.send('pointerup');assert.equal(f.events.drop.length,0);assert.equal(f.events.start.length,0);
 f.source.fire('pointerdown');f.setPoint(f.slot);f.send('pointermove',{clientX:40});assert.equal(f.adapter.active,true);assert.equal(f.captures.get(1),f.root);assert.equal(f.slot.classList.contains('is-drop-target'),true);assert.equal(f.doc.body.children.length,1);
 f.send('pointerup',{clientX:40});assert.deepEqual(f.events.drop,[['fireArrow',4]]);assert.equal(f.adapter.active,false);assert.equal(f.doc.body.children.length,0);assert.equal(f.slot.classList.contains('is-drop-target'),false);
});
test('outside release, Escape, pointercancel, capture loss and resize never assign',t=>{
 const f=fixture(t);
 for(const mode of ['outside','escape','pointercancel','capture','resize']){
  f.source.fire('pointerdown');f.setPoint(f.slot);f.send('pointermove',{clientX:40});
  if(mode==='outside'){f.setPoint(null);f.send('pointerup');}
  if(mode==='escape')f.source.fire('keydown',{key:'Escape'});
  if(mode==='pointercancel')f.send('pointercancel');
  if(mode==='capture')f.root.releasePointerCapture(1);
  if(mode==='resize')globalThis.window.fire('resize');
  assert.equal(f.adapter.active,false,mode);assert.equal(f.events.drop.length,0,mode);
 }
 assert.equal(f.events.cancel.length,5);
});
test('second pointer cannot move or release an active drag',t=>{
 const f=fixture(t);f.source.fire('pointerdown');f.setPoint(f.slot);f.send('pointermove',{clientX:40});f.root.fire('pointerup',{pointerId:2});assert.equal(f.adapter.active,true);assert.equal(f.events.drop.length,0);f.send('pointerup');assert.equal(f.events.drop.length,1);
});
test('touch body scroll is untouched; dotted handle enables intentional drag',t=>{
 const f=fixture(t);f.source.fire('pointerdown',{pointerType:'touch'});f.send('pointermove',{pointerType:'touch',clientY:100});f.send('pointerup',{pointerType:'touch'});assert.equal(f.events.start.length,0);assert.equal(f.captures.size,0);
 f.handle.fire('pointerdown',{pointerType:'touch'});f.setPoint(f.slot);f.send('pointermove',{pointerType:'touch',clientY:100});assert.equal(f.adapter.active,true);f.send('pointerup',{pointerType:'touch'});assert.deepEqual(f.events.drop,[['fireArrow',4]]);
});
test('bar hover switches once after dwell without dropping; empty-space cancel still preserves binding',t=>{
 const f=fixture(t);f.source.fire('pointerdown');f.setPoint(f.bar);f.send('pointermove',{clientX:40});f.step(500);assert.equal(f.events.bar.length,0);f.step(101);assert.deepEqual(f.events.bar,[[1]]);f.step(1000);assert.equal(f.events.bar.length,1);assert.equal(f.adapter.active,true);f.setPoint(f.slot);f.send('pointermove',{clientX:50});f.send('pointerup');assert.deepEqual(f.events.drop,[['fireArrow',4]]);
});
test('drag near scroll edge autoscrolls the marked pane and stops on cancel',t=>{
 const f=fixture(t);f.scroll.scrollHeight=600;f.scroll.clientHeight=200;f.source.fire('pointerdown');f.setPoint(f.scroll);f.send('pointermove',{clientY:190});f.step();assert.ok(f.scroll.scrollTop>0);f.adapter.cancel();const stopped=f.scroll.scrollTop;f.step();assert.equal(f.scroll.scrollTop,stopped);
});

test('card lift stays anchored at the initial grab point rather than chasing a cursor popup',t=>{
 const f=fixture(t);f.source.fire('pointerdown',{clientX:120,clientY:80});f.send('pointermove',{clientX:160,clientY:100});
 const ghost=f.doc.body.children[0];assert.equal(ghost.style.left,'40px');assert.equal(ghost.style.top,'20px');assert.equal(ghost.style.width,'400px');assert.equal(ghost.style.height,'200px');assert.equal(ghost.inert,true);assert.equal(ghost.getAttribute('aria-hidden'),'true');f.adapter.cancel();
});
test('drop targets outside the current editor, disabled targets and malformed indices never assign',t=>{
 const f=fixture(t);for(const invalid of ['outside','disabled','negative','overflow','fraction','text']){
  f.slot.parentNode=invalid==='outside'?f.doc.body:f.root;f.slot.disabled=invalid==='disabled';f.slot.setAttribute('data-drop-slot',({negative:'-1',overflow:'30',fraction:'2.5',text:'buy'})[invalid]??'4');
  f.source.fire('pointerdown');f.setPoint(f.slot);f.send('pointermove',{clientX:50});assert.equal(f.slot.classList.contains('is-drop-target'),false,invalid);f.send('pointerup');
 }assert.equal(f.events.drop.length,0);assert.equal(f.events.cancel.length,6);
});
test('target verbs distinguish reserve replacement, equipped swapping, returning and empty placement',t=>{
 const f=fixture(t);for(const [binding,occupant,verb] of [['-1','iceArrow','Replace'],['1','iceArrow','Swap'],['1','fireArrow','Return'],['1',null,'Place']]){
  f.source.setAttribute('data-card-binding',binding);if(occupant)f.slot.setAttribute('data-drag-ability',occupant);else f.slot.removeAttribute('data-drag-ability');
  f.source.fire('pointerdown');f.setPoint(f.slot);f.send('pointermove',{clientX:50});assert.equal(f.slot.getAttribute('data-drop-action'),verb);f.adapter.cancel();assert.equal(f.slot.getAttribute('data-drop-action'),null);
 }
});
test('rotation cancels and synthetic post-drag clicks cannot activate an unrelated button',t=>{
 const f=fixture(t);f.source.fire('pointerdown');f.setPoint(f.slot);f.send('pointermove',{clientX:50});globalThis.window.fire('orientationchange');
 assert.equal(f.adapter.active,false);assert.equal(f.events.drop.length,0);assert.equal(f.source.fire('click').defaultPrevented,true);f.step(401);assert.equal(f.source.fire('click').defaultPrevented,undefined);
});
test('lift clone preserves actual child artwork and strips identity without mutating source',()=>{
 const make=(attributes={},children=[])=>({attributes,children,style:{setProperty(k,v){this[k]=v;}},setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];},querySelectorAll(){return this.children.flatMap(c=>[c,...c.querySelectorAll('*')]);},cloneNode(){return make({...this.attributes},this.children.map(c=>c.cloneNode(true)));}});
 const image=make({src:'actual-fire-atlas.webp','data-card-atlas':'arcane'}),source=make({id:'owned-fireArrow','data-drag-ability':'fireArrow','data-card-tone':'fire'},[image]);
 const copy=createCardLift(source,{name:'Fire Arrow'});assert.equal(copy.children[0].attributes.src,'actual-fire-atlas.webp');assert.equal(copy.attributes.id,undefined);assert.equal(copy.attributes['data-drag-ability'],undefined);assert.equal(copy.attributes['data-card-tone'],'fire');assert.equal(source.attributes.id,'owned-fireArrow');assert.equal(copy.style.position,'fixed');
});
