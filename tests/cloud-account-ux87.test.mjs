import test from 'node:test';
import assert from 'node:assert/strict';
import {mountCloudAccountPanel} from '../site/dist/cloud-account-panel.mjs';
import {createCloudAccountModel} from '../site/dist/cloud-account-model.mjs';
import {loadGameUI} from './helpers/game-ui-harness.mjs';

class Node {
 constructor(tag){this.tagName=tag;this.children=[];this.value='';this.hidden=false;this.disabled=false;this.className='';this.attributes={};this.ownText='';}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=[...nodes];this.ownText='';}
 set textContent(text){this.ownText=String(text);this.children=[];}
 get textContent(){return this.ownText+this.children.map(x=>x.textContent).join(' ');}
 setAttribute(name,value){this.attributes[name]=String(value);}
 removeAttribute(name){delete this.attributes[name];if(name==='href')delete this.href;}
 focus(){this.focused=true;}
 walk(){return this.children.flatMap(x=>[x,...x.walk()]);}
}
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const account={id:'synthetic-A',expiresAt:2000000000};
const saved=(kind='crownroad',slot=1,document='REMOTE CHECKPOINT')=>({kind,slot,document,revision:2,updatedAt:1791138600000,trust:'client-reported'});
function harness({guest=false,popupBlocked=false,pending=null}={}){
 const events=[],timers=new Map(),listeners=new Map(),root=new Node('section'),document={visibilityState:'visible',createElement:tag=>new Node(tag),addEventListener:(key,fn)=>listeners.set('doc:'+key,fn),removeEventListener:key=>listeners.delete('doc:'+key)};
 let signedIn=guest?null:account,heldLogin=null,kinds=['crownroad','decks'],restores=0,uploads=0,remote=saved(),list=[saved()];
 const popup={closed:false,opener:{},document:{title:'',body:{textContent:''}},location:{replace(url){events.push(['navigate',url]);}},close(){events.push(['close']);this.closed=true;}};
 const window={open(url,target){events.push(['open',url,target]);return popupBlocked?null:popup;},addEventListener:(key,fn)=>listeners.set(key,fn),removeEventListener:key=>listeners.delete(key),setTimeout(fn){const id=timers.size+1;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);}};
 const journal={read:()=>({pending,blocked:false}),save(note){pending=note;return note;},clear(){pending=null;}};
 const client={async account(){events.push(['account']);if(!signedIn){const e=new Error('sign-in-required');e.status=401;throw e;}return signedIn;},async list(){events.push(['list']);if(list instanceof Error)throw list;return list;},async login(){events.push(['login']);return heldLogin?heldLogin.promise:'https://accounts.google.com/o/oauth2/v2/auth?state=synthetic';},async logout(){events.push(['logout']);signedIn=null;},async download(kind,slot){events.push(['download',kind,slot]);return remote;},async upload(kind,slot,document){uploads++;return {...saved(kind,slot,document),revision:3};}};
 const bridge={kinds:()=>kinds,capture:kind=>({kind,document:'LOCAL CHECKPOINT'}),matches:()=>true,restore(){restores++;}};
 const model=createCloudAccountModel({client,bridge,journal,enabled:true}),panel=mountCloudAccountPanel({root,document,window,model,enabled:true,describeDocument:(_kind,text)=>text});
 const get=id=>root.walk().find(x=>x.id==='cloud-'+id),click=id=>get(id).onclick?.();
 return {root,popup,panel,model,window,document,listeners,events,timers,get,click,setIdentity(value){signedIn=value;},holdLogin(){heldLogin=deferred();return heldLogin;},setKinds(value){kinds=value;model.sync();},setList(value){list=value;},setRemote(value){remote=value;},get uploads(){return uploads;},get restores(){return restores;}};
}
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};

test('opening detects an existing account and names three cloud slots without upload',async()=>{
 const h=harness();await h.panel.open();assert.equal(h.get('identity').textContent,'Signed in with Google');assert.equal(h.get('login').hidden,true);assert.equal(h.get('logout').hidden,false);assert.equal(h.get('workspace').hidden,false);assert.match(h.get('slot-1').textContent,/Crownroad slot 1.*Saved copy/);assert.match(h.get('slot-2').textContent,/Crownroad slot 2.*Empty slot/);assert.equal(h.uploads,0);assert.equal(h.restores,0);assert.deepEqual(h.events.map(x=>x[0]),['account','list']);h.panel.dispose();
});
test('guest sees one direct Google sign-in action with local play allowed',async()=>{
 const h=harness({guest:true});await h.panel.open();assert.equal(h.get('identity').textContent,'Guest');assert.equal(h.get('login').textContent,'Sign in with Google');assert.equal(h.get('workspace').hidden,true);assert.equal(h.get('refresh').hidden,true);assert.equal(h.get('link').hidden,true);assert.doesNotMatch(h.root.textContent,/Prepare Google|Check cloud account/);assert.match(h.root.textContent,/without an account/);h.panel.dispose();
});
test('Google window is reserved synchronously before async URL generation and opener is detached',async()=>{
 const h=harness({guest:true});await h.panel.open();h.events.length=0;const held=h.holdLogin(),login=h.click('login');assert.deepEqual(h.events.map(x=>x[0]),['open','login']);assert.equal(h.popup.opener,null);assert.equal(h.events.some(x=>x[0]==='navigate'),false);held.resolve('https://accounts.google.com/o/oauth2/v2/auth?state=synthetic');await login;assert.equal(h.events.at(-1)[0],'navigate');assert.equal(h.get('link').hidden,true);h.panel.dispose();
});
test('repeated sign-in clicks cannot dispatch a second OAuth start',async()=>{
 const h=harness({guest:true});await h.panel.open();const held=h.holdLogin(),login=h.click('login');await h.click('login');assert.equal(h.events.filter(x=>x[0]==='open').length,1);assert.equal(h.events.filter(x=>x[0]==='login').length,1);held.resolve('https://accounts.google.com/o/oauth2/v2/auth?state=synthetic');await login;h.panel.dispose();
});
test('returning from Google refreshes the account automatically without a write',async()=>{
 const h=harness({guest:true});await h.panel.open();await h.click('login');h.setIdentity(account);h.listeners.get('focus')();await settle();assert.equal(h.get('identity').textContent,'Signed in with Google');assert.equal(h.get('workspace').hidden,false);assert.equal(h.get('link').hidden,true);assert.equal(h.uploads,0);assert.equal(h.restores,0);assert.equal(h.timers.size,0);h.panel.dispose();
});
test('closing the Google popup checks the account even without a focus event',async()=>{
 const h=harness({guest:true});await h.panel.open();await h.click('login');h.setIdentity(account);h.popup.closed=true;const callback=[...h.timers.values()][0];h.timers.clear();await callback();assert.equal(h.get('identity').textContent,'Signed in with Google');assert.equal(h.uploads,0);h.panel.dispose();
});
test('popup-blocked fallback is only exposed after the direct action fails',async()=>{
 const h=harness({guest:true,popupBlocked:true});await h.panel.open();assert.equal(h.get('link').hidden,true);await h.click('login');assert.equal(h.get('link').hidden,false);assert.equal(h.get('link').target,'_blank');assert.equal(h.get('link').rel,'noopener noreferrer');assert.match(h.get('link').href,/accounts.google.com/);assert.match(h.get('status').textContent,/browser blocked/);h.setIdentity(account);h.listeners.get('focus')();await settle();assert.equal(h.get('link').hidden,true);assert.equal(h.get('link').href,undefined);h.panel.dispose();
});
test('leaving during async login closes reserved window and never navigates stale URL',async()=>{
 const h=harness({guest:true});await h.panel.open();const held=h.holdLogin(),login=h.click('login');h.panel.leave();held.resolve('https://accounts.google.com/o/oauth2/v2/auth?state=old');await login;assert.equal(h.events.some(x=>x[0]==='navigate'),false);assert.equal(h.get('link').hidden,true);assert.equal(h.popup.closed,true);h.panel.dispose();
});
test('disposed panel removes focus/visibility hooks and scheduled popup polling',async()=>{
 const h=harness({guest:true});await h.panel.open();await h.click('login');assert.equal(h.listeners.size,2);assert.equal(h.timers.size,1);h.panel.dispose();assert.equal(h.listeners.size,0);assert.equal(h.timers.size,0);assert.equal(h.root.hidden,true);
});
test('switching accounts does not finish merely because the old account is still signed in',async()=>{
 const h=harness({pending:{kind:'crownroad',slot:1,accountID:'synthetic-B'}});await h.panel.open();await h.click('login');h.listeners.get('focus')();await settle();assert.equal(h.popup.closed,false);assert.equal(h.timers.size,1);h.setIdentity({...account,id:'synthetic-B'});h.listeners.get('focus')();await settle();assert.equal(h.popup.closed,true);assert.equal(h.model.snapshot().pending.accountID,'synthetic-B');assert.equal(h.uploads,0);h.panel.dispose();
});
test('upload review displays the captured local data separately from the copy being replaced',async()=>{
 const h=harness();await h.panel.open();await h.click('upload');const text=h.get('preview').textContent;assert.match(text,/From this device LOCAL CHECKPOINT/);assert.match(text,/Replace Crownroad slot 1 REMOTE CHECKPOINT/);assert.match(text,/Only Crownroad slot 1 will change/);assert.equal(h.uploads,0);assert.equal(h.get('preview').focused,true);await h.click('confirm');assert.equal(h.uploads,1);h.panel.dispose();
});
test('slot and type choices cancel an old transfer review and preserve chosen type',async()=>{
 const h=harness();await h.panel.open();await h.click('upload');h.click('slot-2');assert.equal(h.model.snapshot().review,null);assert.equal(h.get('slot').value,'2');assert.equal(h.get('slot-2').attributes['aria-pressed'],'true');h.get('kind').value='decks';h.get('kind').onchange();h.setKinds(['wayfarer','decks']);assert.equal(h.get('kind').value,'decks');assert.match(h.get('slot-2').textContent,/Decks slot 2/);assert.equal(h.uploads,0);h.panel.dispose();
});
test('download review states native import step while Wayfarer names its immediate replacement',async()=>{
 const h=harness();await h.panel.open();await h.click('restore');assert.match(h.get('preview').textContent,/new empty device slot or load for this session only/);assert.equal(h.get('confirm').textContent,'Review downloaded campaign');assert.equal(h.restores,0);h.click('cancel');assert.equal(h.get('restore').focused,true);h.setKinds(['wayfarer','decks']);h.setRemote(saved('wayfarer'));await h.click('restore');assert.match(h.get('preview').textContent,/replaces your current Wayfarer charter session/);assert.equal(h.get('confirm').textContent,'Replace this charter session');assert.equal(h.restores,0);h.panel.dispose();
});
test('failed slot discovery never labels unknown slots as empty',async()=>{
 const h=harness();h.setList(new Error('request-failed'));await h.panel.open();assert.equal(h.model.snapshot().slotsLoaded,false);assert.match(h.get('slot-1').textContent,/Not checked/);assert.doesNotMatch(h.get('slot-1').textContent,/Empty slot/);assert.match(h.get('status').textContent,/could not be reached/);h.panel.dispose();
});
test('sign-out clears cloud metadata and leaves the pending recovery copy intact',async()=>{
 const h=harness({pending:{kind:'crownroad',slot:2,accountID:account.id}});await h.panel.open();assert.equal(h.get('upload').disabled,true);assert.match(h.get('recovery').textContent,/Crownroad slot 2/);await h.click('logout');assert.equal(h.get('identity').textContent,'Guest');assert.equal(h.get('workspace').hidden,true);assert.equal(h.model.snapshot().slotsLoaded,false);assert.ok(h.model.snapshot().pending);assert.equal(h.uploads,0);h.panel.dispose();
});
test('automatic account discovery is read-only in the actual Saves integration',async t=>{
 const calls=[],storage={getItem:()=>null,setItem(){},removeItem(){}},json=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
 const ui=await loadGameUI(t,{search:'?open=local-saves',storage,accounts:true,fetch:async(path,options)=>{calls.push([path,options.method]);if(path==='/api/health')return json({accountsEnabled:true});if(path==='/api/account')return json({...account,csrfToken:'a'.repeat(43)});if(path==='/api/saves')return json({saves:[saved()]});throw new Error(path);}});await ui.settle();assert.equal(ui.get('cloud-identity').textContent,'Signed in with Google');assert.equal(ui.document.querySelectorAll('#cloud-status').length,1);assert.equal(ui.document.querySelector('#cloud-retry'),null);assert.doesNotMatch(ui.get('cloudAccounts').textContent,/Connecting to cloud saves/);assert.match(ui.get('cloud-slot-1').textContent,/Saved copy/);assert.deepEqual(calls.map(x=>x[0]),['/api/health','/api/account','/api/saves']);assert.equal(calls.some(x=>x[1]==='PUT'),false);ui.click('closeSave');ui.click('introSave');await ui.settle();assert.equal(calls.filter(x=>x[0]==='/api/health').length,1);assert.equal(calls.filter(x=>x[0]==='/api/account').length,2);
});

test('failed later refresh stops calling previously empty slots empty',async()=>{
 const h=harness();await h.panel.open();assert.match(h.get('slot-2').textContent,/Empty slot/);h.setList(new Error('request-failed'));await h.click('refresh');assert.match(h.get('slot-2').textContent,/Not checked/);assert.equal(h.model.snapshot().slotsLoaded,false);h.panel.dispose();
});
test('popup observation alone never repeatedly requests the account endpoint',async()=>{
 const h=harness({guest:true});await h.panel.open();await h.click('login');const before=h.events.filter(x=>x[0]==='account').length;for(let n=0;n<5;n++){const callback=[...h.timers.values()][0];h.timers.clear();await callback();}assert.equal(h.events.filter(x=>x[0]==='account').length,before);assert.equal(h.events.filter(x=>x[0]==='login').length,1);h.panel.dispose();
});
test('repeated focus and visibility events cannot supersede an in-flight account check',async()=>{
 const h=harness({guest:true});await h.panel.open();await h.click('login');h.setIdentity(account);const before=h.events.filter(x=>x[0]==='account').length;h.listeners.get('focus')();h.listeners.get('focus')();h.listeners.get('doc:visibilitychange')();await settle();assert.equal(h.events.filter(x=>x[0]==='account').length,before+1);assert.equal(h.get('identity').textContent,'Signed in with Google');h.panel.dispose();
});
test('leaving or disposing a completed Google URL prevents later focus reads',async()=>{
 for(const action of ['leave','dispose']){const h=harness({guest:true});await h.panel.open();await h.click('login');const focus=h.listeners.get('focus'),before=h.events.filter(x=>x[0]==='account').length;h.panel[action]();focus();await settle();assert.equal(h.events.filter(x=>x[0]==='account').length,before);assert.equal(h.get('link')?.href,undefined);h.panel.dispose();}
});

test('enabled backend failure shows an honest retry and recovers through a read-only retry',async t=>{
 let available=false;const calls=[],storage={getItem:()=>null,setItem(){},removeItem(){}},json=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
 const ui=await loadGameUI(t,{search:'?open=local-saves',storage,accounts:true,fetch:async(path,options)=>{calls.push([path,options.method]);if(path==='/api/health')return available?json({accountsEnabled:true}):new Response('offline',{status:503});if(path==='/api/account')return json({...account,csrfToken:'a'.repeat(43)});if(path==='/api/saves')return json({saves:[]});throw new Error(path);}});await ui.settle();assert.equal(ui.get('cloudAccounts').hidden,false);assert.match(ui.get('cloud-status').textContent,/unavailable.*local play still work/);assert.equal(ui.get('cloud-retry').hidden,false);available=true;ui.click('cloud-retry');await ui.settle();assert.equal(ui.get('cloud-identity').textContent,'Signed in with Google');assert.equal(ui.document.querySelector('#cloud-retry'),null);assert.equal(ui.document.querySelectorAll('#cloud-status').length,1);assert.doesNotMatch(ui.get('cloudAccounts').textContent,/Connecting to cloud saves/);assert.deepEqual(calls.map(x=>x[0]),['/api/health','/api/health','/api/account','/api/saves']);assert.equal(calls.some(x=>x[1]==='PUT'),false);
});
test('health completion after closing Saves never exposes a stale failure or account panel',async t=>{
 const held=deferred(),storage={getItem:()=>null,setItem(){},removeItem(){}};let calls=0;
 const ui=await loadGameUI(t,{storage,accounts:true,fetch:async()=>{calls++;return held.promise;}});ui.click('introSave');await ui.settle();ui.click('closeSave');held.resolve(new Response('offline',{status:503}));await ui.settle();assert.equal(ui.get('cloudAccounts').hidden,true);assert.equal(calls,1);assert.equal(ui.document.querySelector('#cloud-retry').hidden,true);
});
test('failed OAuth start closes the reserved blank window and clears its link',async()=>{
 const h=harness({guest:true});await h.panel.open();const held=h.holdLogin(),login=h.click('login');held.resolve('');await login;assert.equal(h.popup.closed,true);assert.equal(h.get('link').hidden,true);assert.equal(h.timers.size,0);h.panel.dispose();
});
