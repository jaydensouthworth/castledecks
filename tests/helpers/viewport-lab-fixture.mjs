// Geometry-only test adapter. Runtime markup/state come from the real game
// harness; supplied rectangles are not browser/device measurements.
export const box=(x=0,y=0,width=1000,height=600)=>({x,y,left:x,top:y,width,height});
const simple=(node,selector)=>{
 const tag=selector.match(/^[a-z]+/i)?.[0];if(tag&&node.tagName!==tag.toUpperCase())return false;
 for(const [,id] of selector.matchAll(/#([\w-]+)/g))if(node.id!==id)return false;
 for(const [,name] of selector.matchAll(/\.([\w-]+)/g))if(!node.classList.contains(name))return false;
 for(const [,name,,quoted,bare] of selector.matchAll(/\[([\w-]+)(?:=(['"])(.*?)\2|=([^\]]+))?\]/g)){const value=node.getAttribute(name);if(value===null)return false;if((quoted??bare)!==undefined&&value!==(quoted??bare))return false;}
 return true;
};
function matches(selector){return selector.split(',').some(part=>{const tokens=part.trim().split(/\s+/);let current=this;if(!simple(current,tokens.pop()))return false;for(const token of tokens.reverse()){do{current=current.parentElement;}while(current&&!simple(current,token));if(!current)return false;}return true;});}
function querySelectorAll(selector){const result=[];const walk=node=>{for(const child of node.children){if(matches.call(child,selector))result.push(child);walk(child);}};walk(this);return result;}
export function adaptNode(node){
 node.matches=matches;node.querySelectorAll=querySelectorAll;node.querySelector=function(selector){return this.querySelectorAll(selector)[0]??null;};node.closest=function(selector){for(let current=this;current;current=current.parentElement)if(current.matches(selector))return current;return null;};
 node.getClientRects=function(){return this.noRects?[]:[this.getBoundingClientRect()];};node.getBoundingClientRect=function(){return this.rect??box();};
 if(node.tagName==='DETAILS')Object.defineProperty(node,'open',{configurable:true,get(){return this.getAttribute('open')!==null;},set(value){if(value)this.setAttribute('open','');else this.removeAttribute('open');}});
 for(const child of node.children)adaptNode(child);return node;
}
export class Element {
 constructor(tag='div',attrs={}){this.tagName=tag.toUpperCase();this.children=[];this.parentElement=null;this.attributes=new Map(Object.entries(attrs));this.id=attrs.id??'';this.dataset={};this.style={};this.textContent='';this.listeners=new Map();this.checked=false;this.disabled=false;this.clientWidth=1000;this.clientHeight=600;this.classList={contains:name=>(this.attributes.get('class')??'').split(' ').includes(name)};adaptNode(this);}
 getAttribute(name){return this.attributes.get(name)??null;}setAttribute(name,value){this.attributes.set(name,String(value));}removeAttribute(name){this.attributes.delete(name);}
 append(...nodes){for(const node of nodes){node.parentElement=this;this.children.push(node);}return nodes.at(-1);}replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 addEventListener(type,listener){this.listeners.set(type,[...(this.listeners.get(type)??[]),listener]);}click(){for(const listener of this.listeners.get('click')??[])listener({target:this});}
}
export function child(parent,tag,attrs={},bounds){const node=new Element(tag,attrs);if(bounds)node.rect=bounds;parent.append(node);return node;}
export function computedStyle(node){const hidden=(node.hidden??(node.getAttribute('hidden')!==null))||node.classList.contains('hidden');return {display:hidden?'none':'block',visibility:'visible',opacity:'1',overflow:'visible',overflowX:'visible',overflowY:'visible',zIndex:'0',...node.style};}
export function gameFixture(width=1000,height=600){const doc=new Element('document');doc.getElementById=id=>doc.querySelector('#'+id);const battlefield=child(doc,'canvas',{id:'battlefield'},box(0,0,width,height)),screen=child(doc,'main',{class:'battle-screen'});screen.dataset.heroMode='garrisoned';child(doc,'b',{id:'testingBuild'}).textContent='Build 80';doc.elementFromPoint=()=>battlefield;return {doc,win:{innerWidth:width,innerHeight:height,getComputedStyle:computedStyle},battlefield,screen};}
let instance=0;
export async function loadViewportLab(game){
 const outer=new Element('document'),measurement=child(outer,'section',{class:'measurement'});outer.getElementById=id=>outer.querySelector('#'+id);outer.createElementNS=(ns,tag)=>new Element(tag);
 for(const id of ['gameFrame','device','previewStage','scaledBox','inspection','scaleMeasure','viewWidth','viewHeight','status','simulateWideCutout','simulateCutout','simulateBottomInset','hudMeasure','zoneMeasure','touchMeasure','details','showZones','showSurfaces','preset','applySize','rotate','reloadPreview','midgamePreview','showCollision','refreshMetrics'])child(outer,'div',{id});
 outer.getElementById('gameFrame').contentDocument=game.doc;outer.getElementById('gameFrame').contentWindow=game.win;
 const env={document:outer,window:new Element('window'),innerHeight:800,location:{origin:'https://viewport.test'},requestAnimationFrame:()=>1,setInterval:()=>1};
 async function withGlobals(action){const previous=new Map(Object.keys(env).map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));try{for(const [name,value] of Object.entries(env))Object.defineProperty(globalThis,name,{configurable:true,writable:true,value});return await action();}finally{for(const [name,descriptor] of previous){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}}}
 await withGlobals(()=>import(`../../site/dist/phone-preview.mjs?viewport-test=${++instance}`));
 return {get:id=>outer.getElementById(id),measurement,refresh:()=>withGlobals(()=>outer.getElementById('refreshMetrics').click())};
}
