import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('legacy short-screen sticky menus cannot capture shared game-management shells',async()=>{
 const css=await readFile(new URL('../site/dist/menus.css',import.meta.url),'utf8');
 const block=css.slice(css.indexOf('/* These footers are status/copy'),css.indexOf('/* Pause owns one scroll surface'));
 for(const id of ['queuePanel','profilesPanel','savePanel','testingPanel']){
  const refs=[...block.matchAll(new RegExp('#'+id+'([^,{ ]*)','g'))];assert.ok(refs.length);
  for(const [,tail] of refs)assert.ok(tail.startsWith(':not(.game-management)'),id+tail);
 }
});
test('short Army left rail starts below its actual52px ledger header',async()=>{
 const css=await readFile(new URL('../site/dist/game-shell.css',import.meta.url),'utf8');
 assert.match(css,/#queuePanel\.game-management>\.game-shell-nav\{top:52px\}/);
});

test('legacy short-screen Build hiding cannot remove the shared global navigation',async()=>{
 const css=await readFile(new URL('../site/dist/loadout-collection.css',import.meta.url),'utf8');
 assert.doesNotMatch(css,/#skillsPanel \.menu-nav\{display:none\}/);
 assert.equal((css.match(/#skillsPanel:not\(\.game-management\) \.menu-nav\{display:none\}/g)??[]).length,2);
});

test('shared compact header Back controls retain a44px target and empty status-only footers collapse',async()=>{
 const css=await readFile(new URL('../site/dist/game-shell.css',import.meta.url),'utf8');
 assert.doesNotMatch(css,/game-management>\.panel-head \.menu-back\{min-height:40px/);
 assert.match(css,/game-management>\.panel-head \.menu-back\{min-height:44px;font-size:11px/);
 for(const id of ['profilesPanel','savePanel'])assert.ok(css.includes('#'+id+'.game-management>.menu-footer:has(>.footnote:empty)'));
});

test('compact profile and save status remains readable instead of reserving a blank row',async()=>{
 const css=await readFile(new URL('../site/dist/game-shell.css',import.meta.url),'utf8');
 assert.match(css,/#profilesPanel\.game-management>\.menu-footer>\.footnote,#savePanel\.game-management>\.menu-footer>\.footnote\{display:block;margin:0;font-size:11px;line-height:1.3;max-width:none\}/);
});
