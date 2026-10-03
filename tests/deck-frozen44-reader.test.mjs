import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {CampaignProfiles} from '../site/dist/engine/profile-manager.mjs';
import {CampaignBattle} from '../site/dist/engine/first-battle.mjs';
import {createLocalCampaignStore,snapshotCampaign,checkpointSlotKey} from '../site/dist/local-campaign-store.mjs';
import {captureDeck,createProfileDecks} from '../site/dist/deck-presets-model.mjs';
import {MemoryStorage,TestLocks} from '../tests/helpers/local-storage.mjs';
const distURL=new URL('../site/dist/',import.meta.url);
// Exact frozen44 source bytes, retained so this guard test survives repository migration.
const frozenSourceSha256='85430c184ba9559f3386fd2753f1b47945c4802f0dac00f8ba85d0c57a097ee3';

test('unaltered frozen44 reader blocks candidate v2 metadata writes and deletion while retaining both banks',async t=>{
 const source=await readFile(new URL('./fixtures/frozen44-local-campaign-store.mjs.txt',import.meta.url));
 assert.equal(createHash('sha256').update(source).digest('hex'),frozenSourceSha256);
 // Resolve only import locations; keep the pinned source fixture unchanged.
 // This avoids directory-symlink privileges on Windows test environments.
 const moduleSource=source.toString('utf8').replace(/from '(\.\/[^']+)'/g,(_,specifier)=>`from '${new URL(specifier,distURL).href}'`);
 const frozenReader=await import('data:text/javascript;base64,'+Buffer.from(moduleSource).toString('base64'));
 const profiles=new CampaignProfiles(),battle=new CampaignBattle({profile:profiles.active}),storage=new MemoryStorage(),locks=new TestLocks(),store=createLocalCampaignStore({storage,locks}),oldStore=frozenReader.createLocalCampaignStore({storage,locks});
 const payload=snapshotCampaign({profiles,battle}),first=await store.write(1,payload);assert.equal(oldStore.read(1).status,'ready');
 const decks=createProfileDecks();decks.set(profiles.active,[captureDeck(profiles.active,'New metadata')]);await store.write(1,snapshotCampaign({profiles,battle,deckPresets:decks.snapshot(profiles)}),{expected:first.expected});
 const before=[...storage.data],read=oldStore.read(1);assert.equal(read.status,'newer');assert.equal(read.latest,null);assert.deepEqual(read.newer,['b']);
 assert.equal((await oldStore.write(1,payload,{expected:read.raw})).code,'newer-version');assert.equal((await oldStore.write(1,payload,{expected:first.expected})).code,'newer-version');assert.equal((await oldStore.remove(1,{expected:read.raw,confirmed:true})).code,'newer-version');assert.deepEqual([...storage.data],before);
 assert.equal(store.read(1).latest.payload.deckPresets.profiles[0][0].name,'New metadata');assert.equal(JSON.parse(storage.getItem(checkpointSlotKey(1,'a'))).schema,'castledecks-local-checkpoint-1');
});
