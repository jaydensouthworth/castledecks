import test from 'node:test';import assert from 'node:assert/strict';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
class Storage{data=new Map();getItem(k){return this.data.get(k)??null;}setItem(k,v){this.data.set(k,String(v));}removeItem(k){this.data.delete(k);}}
const response=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
test('shared temporary predicate blocks stale cloud controls inside synthetic field and retains guest saves',async t=>{
 const storage=new Storage(),calls=[],ui=await loadGameUI(t,{storage,accounts:true,fetch:async path=>{calls.push(path);if(path==='/api/health')return response({accountsEnabled:true});if(path==='/api/account')return response({id:'A',csrfToken:'a'.repeat(43),expiresAt:Date.now()+100000});if(path==='/api/saves')return response({saves:[]});throw Error('Unexpected save request');}});
 ui.click('introSave');await ui.settle();ui.click('cloud-refresh');await ui.settle();const upload=ui.get('cloud-upload').onclick,restore=ui.get('cloud-restore').onclick;
 ui.click('closeSave');ui.get('hubDestinations').querySelector('[data-hub-destination="training"]').click();ui.click('start');ui.frames();ui.click('introTesting');ui.click('stressStandard');ui.frames();const original=ui.battle,before=[...storage.data],count=calls.length;
 await upload();await restore();await ui.settle();assert.equal(calls.length,count);assert.equal(ui.get('cloudAccounts').hidden,true);assert.equal(ui.get('openCloudAccounts').hidden,true);assert.equal(ui.battle,original);assert.deepEqual([...storage.data],before);
 ui.click('pauseLobby');ui.frames();assert.equal(ui.battle.profile.name,'Playground');ui.click('closeTesting');ui.click('introSave');await ui.settle();assert.equal(ui.get('cloud-upload').disabled,true);assert.equal(ui.get('cloud-restore').disabled,true);
});
