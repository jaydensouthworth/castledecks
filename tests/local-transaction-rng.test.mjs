import test from 'node:test';import assert from 'node:assert/strict';
import {CampaignProfiles} from '../site/dist/engine/profile-manager.mjs';
import {CampaignBattle} from '../site/dist/engine/first-battle.mjs';
import {createLocalCampaignStore,snapshotCampaign} from '../site/dist/local-campaign-store.mjs';
import {MemoryStorage,TestLocks} from './helpers/local-storage.mjs';
const payload=()=>{const profiles=new CampaignProfiles({defaultName:'No RNG'}),battle=new CampaignBattle({profile:profiles.active});return snapshotCampaign({profiles,battle});};
test('fallback tokens are monotonic and distinct across stores without consuming gameplay randomness',async t=>{
 const captured=payload(),crypto=Object.getOwnPropertyDescriptor(globalThis,'crypto'),random=Math.random,date=Date.now;
 t.after(()=>{if(crypto)Object.defineProperty(globalThis,'crypto',crypto);else delete globalThis.crypto;Math.random=random;Date.now=date;});
 Object.defineProperty(globalThis,'crypto',{configurable:true,value:undefined});let calls=0;Math.random=()=>{calls++;throw new Error('Persistence consumed gameplay randomness');};Date.now=()=>1791000000000;
 const storage=new MemoryStorage(),locks=new TestLocks(),a=createLocalCampaignStore({storage,locks}),b=createLocalCampaignStore({storage,locks});
 let first=await a.write(1,captured);assert.equal(first.ok,true);const ids=[first.record.transaction];
 for(let i=0;i<10;i++){first=await (i%2?a:b).write(1,captured,{expected:first.expected});assert.equal(first.ok,true);ids.push(first.record.transaction);}
 assert.equal(calls,0);assert.equal(new Set(ids).size,ids.length);const values=ids.map(id=>{assert.match(id,/^[a-z0-9]+-[a-z0-9]+$/);assert.equal(id.split('-')[0],Date.now().toString(36));return parseInt(id.split('-')[1],36);});assert.deepEqual(values,values.map((_,i)=>values[0]+i));
});
test('native UUID remains preferred without touching the gameplay random source',async t=>{
 const captured=payload(),crypto=Object.getOwnPropertyDescriptor(globalThis,'crypto'),random=Math.random;
 t.after(()=>{if(crypto)Object.defineProperty(globalThis,'crypto',crypto);else delete globalThis.crypto;Math.random=random;});
 let calls=0;Object.defineProperty(globalThis,'crypto',{configurable:true,value:{randomUUID:()=>{calls++;return 'native-test-uuid';}}});Math.random=()=>{throw new Error('Unexpected random');};
 const result=await createLocalCampaignStore({storage:new MemoryStorage(),locks:new TestLocks()}).write(1,captured);assert.equal(result.ok,true);assert.equal(result.record.transaction,'native-test-uuid');assert.equal(calls,1);
});
