import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {mountCloudReviewLab} from '../site/dist/cloud-review-lab.mjs';

// Bounded DOM contract only. Native rendering, scroll geometry, focus traversal,
// and browser history are deliberately left to browser QA of this same page.
class Node {
 constructor(tag,document){this.tagName=tag;this.ownerDocument=document;this.children=[];this.attributes=new Map();this.listeners=new Map();this.className='';this.hidden=false;this.disabled=false;this.value='';this.ownText='';}
 append(...nodes){for(const node of nodes){node.parentNode=this;this.children.push(node);}}
 replaceChildren(...nodes){this.children=[];this.ownText='';this.append(...nodes);}
 set textContent(value){this.ownText=String(value);this.children=[];}
 get textContent(){return this.ownText+this.children.map(node=>node.textContent).join(' ');}
 setAttribute(key,value){this.attributes.set(key,String(value));}
 getAttribute(key){return this.attributes.get(key)??null;}
 removeAttribute(key){this.attributes.delete(key);if(key==='href')delete this.href;}
 addEventListener(type,fn){const set=this.listeners.get(type)??new Set();set.add(fn);this.listeners.set(type,set);}
 removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
 dispatch(type,event={}){for(const fn of this.listeners.get(type)??[])fn({type,preventDefault(){},...event});}
 walk(){return this.children.flatMap(node=>[node,...node.walk()]);}
 querySelector(selector){return this.walk().find(node=>selector.startsWith('#')?node.id===selector.slice(1):node.tagName===selector)??null;}
 focus(){this.ownerDocument.activeElement=this;}
}
function harness(){
 const document=new Node('document',null);document.ownerDocument=document;document.createElement=tag=>new Node(tag,document);document.visibilityState='visible';
 const root=document.createElement('main');document.append(root);const lab=mountCloudReviewLab({root,document}),get=id=>root.querySelector('#'+id);
 return {document,root,lab,get,click:id=>{const node=get(id);assert.ok(node,id);if(!node.disabled)return node.onclick?.();},async preview(){await this.click('cloud-restore');assert.equal(get('cloud-preview').hidden,false);}};
}
const settle=async()=>{for(let i=0;i<16;i++)await Promise.resolve();};
const source=path=>readFileSync(new URL(path,import.meta.url),'utf8');

function denyCapabilities(t){
 const attempts=[];
 for(const key of ['fetch','XMLHttpRequest','WebSocket','EventSource','localStorage','sessionStorage','indexedDB','open','window']){
  const previous=Object.getOwnPropertyDescriptor(globalThis,key);
  Object.defineProperty(globalThis,key,{configurable:true,get(){attempts.push(key);throw new Error('Forbidden capability: '+key);}});
  t.after(()=>previous?Object.defineProperty(globalThis,key,previous):delete globalThis[key]);
 }
 return attempts;
}

test('lab is an explicit developer-only entry with a network-blocking CSP and bounded Saves surface',()=>{
 const page=source('../site/dist/cloud-review-lab.html'),lab=source('../site/dist/cloud-review-lab.mjs'),css=source('../site/dist/cloud-review-lab.css');
 assert.match(source('../site/dist/lab.html'),/href="\.\/cloud-review-lab\.html"/);
 for(const name of readdirSync(new URL('../site/dist/',import.meta.url)).filter(name=>name.endsWith('.html')&&!['lab.html','cloud-review-lab.html'].includes(name)))assert.doesNotMatch(source('../site/dist/'+name),/cloud-review-lab/);
 assert.match(page,/connect-src 'none'/);assert.match(page,/form-action 'none'/);assert.match(page,/script-src 'self'/);assert.match(page,/SYNTHETIC QA · NO REAL SAVES/);
 assert.deepEqual([...lab.matchAll(/from '(.+?)'/g)].map(match=>match[1]),['./cloud-account-panel.mjs','./cloud-account-model.mjs','./cloud-game-bridge.mjs','./cloud-upload-journal.mjs']);
 assert.doesNotMatch(lab,/cloud-account-client|cloud-account-integration|battle\.mjs|\bfetch\s*\(|localStorage|sessionStorage|indexedDB|\/api\//);
 assert.match(lab,/window:Object\.freeze\(\{open:\(\)=>null\}\)/);
 assert.match(css,/#lab-workspace\{[^}]*100dvh[^}]*overflow:hidden/);assert.match(css,/#lab-cloud-panel\{overflow:auto;[^}]*min-height:0/);
 assert.match(lab,/addEventListener\('pagehide',\(\)=>lab\.back\(\)\)/);
});

test('fixture mounts the actual renderer and real protocol against visibly synthetic account, slot, and source data',async t=>{
 const attempts=denyCapabilities(t),h=harness();t.after(()=>h.lab.dispose());
 assert.equal(h.get('lab-workspace').hidden,true);assert.equal(h.lab.snapshot().reads,0);
 assert.match(h.root.textContent,/All accounts, slots, sources, data, and actions on this page are synthetic/);
 assert.match(h.root.textContent,/No sign-in, network transfer, persistent saves/);assert.match(h.root.textContent,/Nothing is saved to browser storage/);
 await h.click('lab-open');assert.match(h.get('lab-cloud-panel').className,/cloud-account-panel/);
 assert.equal(h.get('cloud-identity').textContent,'Synthetic account: synthetic-cloud-review-lab-account · no sign-in');
 assert.match(h.get('cloud-slot-1').textContent,/Synthetic Crownroad slot 1/);
 assert.equal(h.get('cloud-restore').textContent,'Load from cloud');
 await h.preview();const state=h.lab.snapshot().state;
 assert.equal(state.review.accountID,'synthetic-cloud-review-lab-account');assert.match(state.review.remote.document,/synthetic-cloud-slot-crownroad-1/);
 assert.match(state.review.captured.document,/synthetic-source-0-crownroad-1/);
 assert.match(h.get('cloud-preview').className,/cloud-account-review/);assert.equal(h.get('cloud-preview').getAttribute('role'),null);
 assert.equal(h.get('cloud-confirm').textContent,'Load into device slot 2');assert.equal(h.get('cloud-session').textContent,'Load for this session only');assert.equal(h.get('cloud-cancel').textContent,'Keep current session');
 assert.equal(h.get('cloud-confirm').getAttribute('aria-describedby'),'cloud-review-effect');assert.equal(h.document.activeElement,h.get('cloud-preview'));
 assert.match(h.get('cloud-review-effect').textContent,/Existing device saves and the cloud copy stay unchanged/);
 assert.deepEqual(attempts,[]);assert.deepEqual(h.lab.snapshot().journal,[]);
});

for(const choice of ['cloud-confirm','cloud-session'])test(`${choice} records only a synthetic receipt and cannot adopt a real save`,async t=>{
 const attempts=denyCapabilities(t),h=harness();t.after(()=>h.lab.dispose());await h.lab.open();await h.preview();const sourceDocument=h.lab.snapshot().state.review.captured.document;
 await h.click(choice);assert.equal(h.lab.snapshot().simulations,1);assert.equal(h.lab.snapshot().reads,2);assert.equal(h.get('cloud-preview').hidden,true);
 assert.match(h.get('lab-result').textContent,/Synthetic only:.*No device save, cloud copy, profile, or card was changed/);
 assert.match(h.get('cloud-status').textContent,/^Synthetic fixture:/);assert.deepEqual(h.lab.snapshot().journal,[]);
 await h.preview();assert.equal(h.lab.snapshot().state.review.captured.document,sourceDocument);assert.deepEqual(attempts,[]);
});

test('full synthetic device slots disable only the primary choice and keep session-only available',async t=>{
 const h=harness();t.after(()=>h.lab.dispose());h.get('lab-full').checked=true;h.get('lab-full').onchange();await h.lab.open();await h.preview();
 assert.equal(h.get('cloud-confirm').textContent,'No empty device slot');assert.equal(h.get('cloud-confirm').disabled,true);assert.equal(h.get('cloud-session').disabled,false);
 await h.get('cloud-confirm').onclick();assert.equal(h.lab.snapshot().simulations,0);assert.equal(h.lab.snapshot().reads,1);
 assert.match(h.get('cloud-review-effect').textContent,/No safely writable empty device slot/);await h.click('cloud-session');assert.equal(h.lab.snapshot().simulations,1);
});

test('mode switching invalidates old handlers and renders Wayfarer/deck choices in the actual panel',async t=>{
 const h=harness();t.after(()=>h.lab.dispose());await h.lab.open();await h.preview();const stale=h.get('cloud-confirm').onclick;
 h.get('lab-mode').value='wayfarer';h.get('lab-mode').onchange();await settle();await stale();assert.equal(h.lab.snapshot().simulations,0);assert.equal(h.get('cloud-preview').hidden,true);
 await h.preview();assert.equal(h.get('cloud-confirm').textContent,'Replace this charter session');assert.equal(h.get('cloud-session').hidden,true);assert.match(h.get('cloud-review-effect').textContent,/current Wayfarer charter session/);await h.click('cloud-confirm');
 h.lab.setMode('decks');await settle();await h.preview();assert.equal(h.get('cloud-kind').value,'decks');assert.equal(h.get('cloud-confirm').textContent,'Add 2 saved decks');assert.equal(h.get('cloud-session').hidden,true);
 assert.match(h.get('cloud-preview').textContent,/Synthetic Bow \(2\)/);assert.match(h.get('cloud-review-effect').textContent,/No cards are unlocked or equipped/);await h.click('cloud-confirm');assert.equal(h.lab.snapshot().simulations,2);assert.deepEqual(h.lab.snapshot().journal,[]);
});

test('Cancel restores Load focus and a stale choice cannot accept a newer review',async t=>{
 const h=harness();t.after(()=>h.lab.dispose());await h.lab.open();await h.preview();const stale=h.get('cloud-session').onclick;
 await h.click('cloud-cancel');assert.equal(h.get('cloud-preview').hidden,true);assert.equal(h.document.activeElement,h.get('cloud-restore'));
 await h.preview();await stale();assert.equal(h.lab.snapshot().simulations,0);assert.equal(h.lab.snapshot().reads,2);assert.equal(h.get('cloud-preview').hidden,false);
});

for(const phase of ['preview','final'])for(const action of ['Cancel','Back','Escape','mode','slot','type'])test(`${action} discards a late synthetic ${phase} read`,async t=>{
 // Slot/type controls are intentionally disabled during checks, matching the
 // renderer. Their pre-existing callbacks still must invalidate a late read.
 const attempts=denyCapabilities(t),h=harness();t.after(()=>h.lab.dispose());await h.lab.open();
 if(phase==='final')await h.preview();h.lab.holdNextRead();const request=h.click(phase==='final'?'cloud-session':'cloud-restore');await settle();
 assert.equal(h.lab.snapshot().held,true);assert.equal(h.lab.snapshot().state.phase,'loading');
 if(action==='Cancel')h.get('cloud-cancel').onclick();
 else if(action==='Back')h.click('lab-back');
 else if(action==='Escape'){h.document.dispatch('keydown',{key:'Escape'});assert.equal(h.lab.snapshot().opened,false);}
 else if(action==='mode'){h.lab.setMode('wayfarer');await settle();}
 else if(action==='slot'){assert.equal(h.get('cloud-slot-2').disabled,true);h.get('cloud-slot-2').onclick();h.click('lab-back');}
 else{assert.equal(h.get('cloud-kind').disabled,true);h.get('cloud-kind').value='decks';h.get('cloud-kind').onchange();}
 h.lab.releaseRead();await request;await settle();assert.equal(h.lab.snapshot().simulations,0);assert.deepEqual(h.lab.snapshot().journal,[]);assert.equal(h.get('cloud-preview').hidden,true);
 if(['Back','Escape'].includes(action)&&!h.lab.snapshot().opened){assert.equal(h.get('lab-workspace').hidden,true);await h.lab.open();assert.equal(h.get('cloud-preview').hidden,true);}
 assert.deepEqual(attempts,[]);
});

test('real slot and save-type changes clear a review without running captured final callbacks',async t=>{
 const h=harness();t.after(()=>h.lab.dispose());await h.lab.open();await h.preview();const first=h.get('cloud-confirm').onclick;
 await h.click('cloud-slot-2');await first();assert.equal(h.get('cloud-slot').value,'2');assert.equal(h.lab.snapshot().simulations,0);assert.equal(h.lab.snapshot().reads,1);
 await h.preview();const second=h.get('cloud-session').onclick;h.get('cloud-kind').value='decks';h.get('cloud-kind').onchange();await second();assert.equal(h.get('cloud-preview').hidden,true);assert.equal(h.lab.snapshot().reads,2);
 await h.preview();assert.equal(h.get('cloud-confirm').textContent,'Add 2 saved decks');assert.equal(h.lab.snapshot().state.review.kind,'decks');assert.equal(h.get('cloud-slot-2').getAttribute('aria-label'),'Synthetic Saved decks slot 2, sample copy');
});

test('repeated final clicks cause one recheck and one synthetic receipt',async t=>{
 const h=harness();t.after(()=>h.lab.dispose());await h.lab.open();await h.preview();h.lab.holdNextRead();const accept=h.get('cloud-confirm').onclick;
 const a=accept(),b=accept();await settle();assert.equal(h.lab.snapshot().reads,2);h.lab.releaseRead();await Promise.all([a,b]);assert.equal(h.lab.snapshot().simulations,1);
});

test('all unavailable auth/upload handlers are inert even when invoked directly',async t=>{
 const attempts=denyCapabilities(t),h=harness();t.after(()=>h.lab.dispose());await h.lab.open();
 for(const id of ['cloud-login','cloud-link','cloud-logout','cloud-upload','cloud-reconcile']){const node=h.get(id);assert.equal(node.hidden,true);assert.equal(node.disabled,true);assert.equal(node.getAttribute('href'),null);await node.onclick();}
 assert.equal(h.lab.snapshot().reads,0);assert.equal(h.lab.snapshot().simulations,0);assert.deepEqual(h.lab.snapshot().journal,[]);assert.deepEqual(attempts,[]);
});

test('Back, reopen, and dispose never revive a review or an in-flight choice',async t=>{
 const h=harness();await h.lab.open();await h.preview();const stale=h.get('cloud-session').onclick;
 h.lab.back();assert.equal(h.get('lab-workspace').hidden,true);assert.equal(h.document.activeElement,h.get('lab-open'));await h.lab.open();await stale();assert.equal(h.lab.snapshot().simulations,0);assert.equal(h.get('cloud-preview').hidden,true);
 await h.preview();h.lab.holdNextRead();const pending=h.click('cloud-session');await settle();h.lab.dispose();await pending;assert.equal(h.lab.snapshot().simulations,0);assert.equal(h.lab.snapshot().opened,false);assert.equal(h.lab.snapshot().held,false);
 assert.equal(h.document.listeners.get('keydown').size,0);assert.equal(h.document.listeners.get('visibilitychange').size,0);assert.equal(h.get('lab-open').disabled,true);
});
