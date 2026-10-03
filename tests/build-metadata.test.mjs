import test from 'node:test';
import {SKIRMISH_DOCTRINES} from '../site/dist/skirmish-model.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('public progress, runtime diagnostics, visible label and top-level cache keys name the same build',async()=>{
 const root=new URL('../site/dist/',import.meta.url);
 const [script,html,json]=await Promise.all(['battle.mjs','battle.html','progress.json'].map(name=>readFile(new URL(name,root),'utf8')));
 const runtime=script.match(/const GAME_BUILD='(\d+)';/)?.[1];assert.ok(runtime);
 const progress=JSON.parse(json);assert.equal(progress.build,Number(runtime));assert.equal(progress.skirmish.doctrines,Object.keys(SKIRMISH_DOCTRINES).length);
 assert.match(html,new RegExp('id="buildLabel">Build '+runtime+'<'));
 const keys=[...html.matchAll(/[?&]build=(\d+)/g)].map(match=>match[1]);assert.ok(keys.length>=4);
 assert.ok(keys.every(build=>build===runtime));
 assert.equal(Object.hasOwn(progress,'modern_extension_scope'),false,'Use one existing extension_scope field');
 assert.equal(typeof progress.extension_scope,'string');
});
