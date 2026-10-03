import test from 'node:test';import assert from 'node:assert/strict';
import {MemoryStorage} from './helpers/local-storage.mjs';
import {CONTROL_ACTIONS,CONTROL_STORAGE_KEY,DEFAULT_CONTROL_BINDINGS,createControlBindings,controlBindingError,validControlBindings,controlEventKey,isControlComposition,isControlTextTarget} from '../site/dist/control-bindings.mjs';

test('default bindings exactly preserve the existing ten desktop actions',()=>{
 const controls=createControlBindings({getStorage:()=>new MemoryStorage()});assert.deepEqual(controls.bindings,DEFAULT_CONTROL_BINDINGS);assert.equal(CONTROL_ACTIONS.length,10);
 for(const [action,key] of Object.entries(DEFAULT_CONTROL_BINDINGS))assert.equal(controls.action({key}),action);
 assert.equal(controls.label('activate'),'Space');assert.equal(controls.action({key:'1'}),null);assert.equal(controls.action({key:'Escape'}),null);
});
test('all keys must be unique, supported, bounded, own properties; fixed and browser keys stay reserved',()=>{
 for(const key of ['0','9','Escape','Tab','Enter','F5','F12','Backspace','Home','Control','Shift','a+b','Dead','Unidentified','💥','',null])assert.notEqual(controlBindingError(DEFAULT_CONTROL_BINDINGS,'companion',key),'');
 assert.match(controlBindingError(DEFAULT_CONTROL_BINDINGS,'companion','a'),/already used.*move left/i);
 for(const key of ['h','arrowleft',' '])assert.equal(controlBindingError({...DEFAULT_CONTROL_BINDINGS,activate:'x'},'companion',key),'');
 assert.equal(validControlBindings({...DEFAULT_CONTROL_BINDINGS,arc:'g'}),false);assert.equal(validControlBindings({...DEFAULT_CONTROL_BINDINGS,extra:'x'}),false);
 const inherited=Object.create(DEFAULT_CONTROL_BINDINGS);assert.equal(validControlBindings(inherited),false);
});
test('modifiers and composition never resolve a live control',()=>{
 const controls=createControlBindings();for(const flag of ['ctrlKey','metaKey','altKey','shiftKey','isComposing'])assert.equal(controls.action({key:'g',[flag]:true}),null);
 assert.equal(controls.action({key:'g',keyCode:229}),null);assert.equal(isControlComposition({key:'Dead'}),true);assert.equal(controlEventKey({key:'G'}),'g');assert.equal(controlEventKey({key:'Spacebar'}),' ');
 assert.equal(isControlTextTarget({tagName:'INPUT'}),true);assert.equal(isControlTextTarget({isContentEditable:true}),true);assert.equal(isControlTextTarget({closest:()=>({})}),true);
});
test('preferences round-trip independently and returned snapshots cannot mutate live keys',()=>{
 const storage=new MemoryStorage(),controls=createControlBindings({getStorage:()=>storage}),draft={...controls.bindings,left:'arrowleft',companion:'h'};
 assert.equal(controls.apply(draft).persisted,true);draft.left='q';assert.equal(controls.bindings.left,'arrowleft');const snapshot=controls.bindings;snapshot.arc='h';assert.equal(controls.bindings.arc,'v');
 const loaded=createControlBindings({getStorage:()=>storage});assert.equal(loaded.label('left'),'Left Arrow');assert.equal(loaded.label('left',{compact:true}),'←');assert.equal(loaded.action({key:'h'}),'companion');assert.deepEqual([...storage.data.keys()],[CONTROL_STORAGE_KEY]);
 const before=loaded.bindings;assert.equal(loaded.apply({...before,left:'h'}).ok,false);assert.deepEqual(loaded.bindings,before);
});
test('malformed and oversized persisted controls fall back to defaults without startup writes',()=>{
 for(const raw of ['{',JSON.stringify({version:1,bindings:{}}),JSON.stringify({version:1,bindings:{...DEFAULT_CONTROL_BINDINGS,arc:'g'}}),'x'.repeat(5000)]){
  const storage=new MemoryStorage();storage.data.set(CONTROL_STORAGE_KEY,raw);const controls=createControlBindings({getStorage:()=>storage});assert.deepEqual(controls.bindings,DEFAULT_CONTROL_BINDINGS);assert.equal(storage.writes,0);assert.match(controls.message,/could not be read/);
 }
});
test('quota, blocked storage, and future formats retain session usability without changing campaign keys',()=>{
 const storage=new MemoryStorage();storage.setItem=()=>{throw new Error('QuotaExceededError');};const controls=createControlBindings({getStorage:()=>storage});const result=controls.apply({...controls.bindings,arc:'h'});assert.equal(result.ok,true);assert.equal(result.persisted,false);assert.equal(controls.action({key:'h'}),'arc');assert.match(result.message,/this tab/);
 const blocked=createControlBindings({getStorage:()=>{throw new Error('Denied');}});assert.equal(blocked.apply(DEFAULT_CONTROL_BINDINGS).persisted,false);
 const future=new MemoryStorage(),raw=JSON.stringify({version:99,bindings:{different:'format'}});future.data.set(CONTROL_STORAGE_KEY,raw);const newer=createControlBindings({getStorage:()=>future});assert.equal(newer.apply({...DEFAULT_CONTROL_BINDINGS,arc:'h'}).persisted,false);assert.equal(future.getItem(CONTROL_STORAGE_KEY),raw);assert.equal(future.writes,0);
});
