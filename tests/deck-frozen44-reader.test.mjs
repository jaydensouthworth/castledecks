import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {CampaignProfiles} from '../site/dist/engine/profile-manager.mjs';
import {CampaignBattle} from '../site/dist/engine/first-battle.mjs';
import {createLocalCampaignStore,snapshotCampaign,checkpointSlotKey} from '../site/dist/local-campaign-store.mjs';
import {captureDeck,createProfileDecks} from '../site/dist/deck-presets-model.mjs';
import {MemoryStorage,TestLocks} from './helpers/local-storage.mjs';
const frozenSourceSha256='85430c184ba9559f3386fd2753f1b47945c4802f0dac00f8ba85d0c57a097ee3';
for(const version of [2,3])test(`unaltered independent frozen44 reader preserves both banks against v${version} metadata writes/deletion`,async t=>{
 const directory=await mkdtemp(path.join(tmpdir(),'castledecks44-reader-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const source=await readFile(new URL('./fixtures/frozen44-local-campaign-store.mjs.txt',import.meta.url));assert.equal(createHash('sha256').update(source).digest('hex'),frozenSourceSha256);await writeFile(path.join(directory,'local-campaign-store.mjs'),source);
 const manifest=JSON.parse(await readFile(new URL('./fixtures/frozen69-codecs/SHA256.json',import.meta.url),'utf8'));
 for(const [name,hash] of Object.entries(manifest).filter(([name])=>name.startsWith('engine/'))){const data=await readFile(new URL('./fixtures/frozen69-codecs/'+name,import.meta.url));assert.equal(createHash('sha256').update(data).digest('hex'),hash);await mkdir(path.dirname(path.join(directory,name)),{recursive:true});await writeFile(path.join(directory,name),data);}
 const frozenReader=await import(pathToFileURL(path.join(directory,'local-campaign-store.mjs'))),storage=new MemoryStorage(),locks=new TestLocks(),store=createLocalCampaignStore({storage,locks}),oldStore=frozenReader.createLocalCampaignStore({storage,locks});
 const legacy=await readFile(new URL('./cloud-fixtures/crownroad.json',import.meta.url),'utf8');storage.setItem(checkpointSlotKey(1,'a'),legacy);assert.equal(oldStore.read(1).status,'ready');const expected=store.read(1).raw;
 if(version===2){const value=JSON.parse(legacy);value.schema='castledecks-local-checkpoint-2';value.revision=2;value.payload.deckPresets={schema:'castledecks-profile-decks-1',profiles:[JSON.parse(await readFile(new URL('./cloud-fixtures/decks.json',import.meta.url),'utf8')).decks],retired:[]};storage.setItem(checkpointSlotKey(1,'b'),JSON.stringify(value));}
 else{const profiles=new CampaignProfiles(),battle=new CampaignBattle({profile:profiles.active}),decks=createProfileDecks();decks.set(profiles.active,[captureDeck(profiles.active,'New metadata')]);assert.equal((await store.write(1,snapshotCampaign({profiles,battle,deckPresets:decks.snapshot(profiles)}),{expected})).ok,true);}
 const before=[...storage.data],read=oldStore.read(1);assert.equal(read.status,'newer');assert.equal(read.latest,null);assert.deepEqual(read.newer,['b']);const payload=JSON.parse(legacy).payload;
 assert.equal((await oldStore.write(1,payload,{expected:read.raw})).code,'newer-version');assert.equal((await oldStore.write(1,payload,{expected})).code,'newer-version');assert.equal((await oldStore.remove(1,{expected:read.raw,confirmed:true})).code,'newer-version');assert.deepEqual([...storage.data],before);assert.equal(storage.getItem(checkpointSlotKey(1,'a')),legacy);assert.ok(store.read(1).latest.payload.deckPresets);
});
