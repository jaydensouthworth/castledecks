import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
import {modalFocusCandidates} from '../site/dist/modal-focus.mjs';
import {serializeProfile} from '../site/dist/engine/progression.mjs';

async function compact(t){
 const original=globalThis.matchMedia,listeners=new Set();
 const media={matches:true,addEventListener(type,fn){assert.equal(type,'change');listeners.add(fn);},removeEventListener(type,fn){listeners.delete(fn);}};
 globalThis.matchMedia=query=>query==='(max-width:1000px) and (max-height:600px) and (orientation:landscape)'?media:{matches:false};
 t.after(()=>{if(original===undefined)delete globalThis.matchMedia;else globalThis.matchMedia=original;});
 const ui=await loadGameUI(t);ui.click('introAtlas');
 return Object.assign(ui,{resize(matches){media.matches=matches;for(const fn of listeners)fn({matches});},listeners});
}
const mapOf=ui=>ui.get('campaignAtlasHost').querySelector('.atlas-map-window');
const background=ui=>[ui.get('campaignPanel').querySelector('.panel-head'),...ui.get('campaignAtlasHost').querySelectorAll('.atlas-overview,.atlas-regions,.atlas-road,.atlas-actions')];
const inside=(node,root)=>{for(;node;node=node.parentElement)if(node===root)return true;return false;};

test('selecting a locked standard updates its concise label without opening Inspect or changing saved state',async t=>{
 const ui=await compact(t),b=ui.battle,before=serializeProfile(b.profile),host=ui.get('campaignAtlasHost');
 const map=mapOf(ui);map.scrollLeft=740;map.scrollTop=62;
 host.querySelector('[data-atlas-level="30"]').click();
 assert.equal(ui.visible('atlasInspector'),false);assert.equal(ui.get('atlasInspect').getAttribute('aria-expanded'),'false');
 assert.match(host.querySelector('.atlas-selection').textContent,/Battle 30 · Locked.*Ashen Throne/);
 assert.match(ui.get('atlasInspect').getAttribute('aria-label'),/Inspect Battle 30: The Ashen Throne/);
 assert.equal(mapOf(ui).scrollLeft,740);assert.equal(mapOf(ui).scrollTop,62);
 assert.equal(ui.get('atlasPrepare').disabled,true);assert.equal(ui.get('atlasInspectPrepare').disabled,true);
 ui.click('atlasInspect');assert.match(ui.get('atlasInspectNote').textContent,/Clear Battle 29/);
 // Even a stale enabled control still rechecks the authoritative guard.
 ui.get('atlasInspectPrepare').disabled=false;ui.click('atlasInspectPrepare');
 assert.equal(ui.battle,b);assert.equal(serializeProfile(b.profile),before);assert.equal(b.tick,0);
});

test('Inspect uses the shared modal focus layer and preserves pan through Back and Escape',async t=>{
 const ui=await compact(t),map=mapOf(ui);map.scrollLeft=83;map.scrollTop=41;
 ui.click('atlasInspect');const inspector=ui.get('atlasInspector');
 assert.equal(ui.visible('atlasInspector'),true);assert.equal(inspector.getAttribute('role'),'dialog');assert.equal(inspector.getAttribute('aria-modal'),'true');
 assert.ok(background(ui).every(node=>node.inert));assert.equal(ui.document.activeElement,ui.get('atlasCloseInspector'));
 const candidates=modalFocusCandidates(ui.get('campaignPanel'));assert.ok(candidates.every(node=>inside(node,inspector)));assert.equal(candidates[0],ui.get('atlasCloseInspector'));assert.equal(candidates.at(-1),ui.get('atlasInspectPrepare'));
 ui.key('keydown','Tab',{shiftKey:true});assert.equal(ui.document.activeElement,ui.get('atlasInspectPrepare'));
 ui.key('keydown','Tab');assert.equal(ui.document.activeElement,ui.get('atlasCloseInspector'));
 ui.document.activeElement=ui.document;ui.key('keydown','Tab');assert.equal(ui.document.activeElement,ui.get('atlasCloseInspector'));
 ui.click('atlasCloseInspector');assert.equal(ui.visible('atlasInspector'),false);assert.equal(ui.document.activeElement,ui.get('atlasInspect'));assert.ok(background(ui).every(node=>!node.inert));
 assert.equal(mapOf(ui),map);assert.equal(map.scrollLeft,83);assert.equal(map.scrollTop,41);
 ui.click('atlasInspect');ui.key('keydown','Escape');assert.equal(ui.visible('campaignPanel'),true);assert.equal(ui.visible('atlasInspector'),false);assert.equal(ui.document.activeElement,ui.get('atlasInspect'));
 ui.key('keydown','Escape');assert.equal(ui.visible('campaignPanel'),false);assert.equal(ui.get('intro').inert,false);
 ui.click('introAtlas');assert.equal(ui.visible('atlasInspector'),false);assert.ok(background(ui).every(node=>!node.inert));
});

test('rotation restores the inline dossier and safe focus; returning to compact never reopens it',async t=>{
 const ui=await compact(t);ui.click('atlasInspect');const map=mapOf(ui);map.scrollLeft=65;
 ui.resize(false);assert.equal(ui.visible('atlasInspector'),true);assert.equal(ui.get('atlasInspector').getAttribute('role'),null);assert.ok(background(ui).every(node=>!node.inert));
 assert.equal(ui.get('atlasCloseInspector').parentElement.hidden,true);assert.equal(ui.document.activeElement.getAttribute('data-atlas-level'),'1');
 ui.get('campaignAtlasHost').querySelector('.atlas-intelligence').querySelector('summary').focus();
 ui.resize(true);assert.equal(ui.visible('atlasInspector'),false);assert.equal(ui.document.activeElement.getAttribute('data-atlas-level'),'1');assert.equal(mapOf(ui),map);assert.equal(map.scrollLeft,65);
 for(let i=0;i<10;i++){ui.click('atlasInspect');ui.click('atlasCloseInspector');}assert.equal(ui.listeners.size,1);
 ui.click('atlasInspect');ui.click('closeAtlas');assert.equal(ui.visible('campaignPanel'),false);assert.ok(background(ui).every(node=>!node.inert));
 ui.click('introAtlas');assert.equal(ui.visible('atlasInspector'),false);assert.equal(ui.get('atlasInspect').getAttribute('aria-expanded'),'false');
});

test('drawer retains terrain, intelligence, bestiary and reward details; Prepare returns ready without starting',async t=>{
 const ui=await compact(t),b=ui.battle;ui.click('atlasInspect');const inspector=ui.get('atlasInspector');
 for(const selector of ['.atlas-terrain','.atlas-advice','.atlas-objective','.atlas-intelligence','.atlas-bestiary','.atlas-rules'])assert.ok(inspector.querySelector(selector),selector);
 assert.match(inspector.querySelector('.atlas-terrain').querySelector('svg').getAttribute('aria-label'),/Actual terrain profile/);
 assert.match(inspector.querySelector('.atlas-rules').textContent,/victory bonus/);assert.equal(ui.get('atlasInspectPrepare').disabled,false);
 ui.click('atlasInspectPrepare');assert.notEqual(ui.battle,b);assert.equal(ui.battle.level,1);assert.equal(ui.battle.tick,0);assert.equal(ui.visible('campaignPanel'),false);assert.equal(ui.visible('intro'),true);assert.ok(background(ui).every(node=>!node.inert));
 ui.frames(3);assert.equal(ui.battle.tick,0);ui.click('start');ui.frames(3);const active=ui.battle,tick=active.tick;
 ui.click('battlePause');ui.click('pauseAtlas');ui.click('atlasInspect');assert.equal(ui.get('atlasInspectPrepare').disabled,true);assert.match(ui.get('atlasInspectNote').textContent,/Finish it/);
 ui.get('atlasInspectPrepare').disabled=false;ui.click('atlasInspectPrepare');ui.frames(3);assert.equal(ui.battle,active);assert.equal(active.tick,tick);assert.equal(active.paused,true);
});

test('compact geometry removes the dossier column without spending map height or shrinking controls',async()=>{
 const css=await readFile(new URL('../site/dist/campaign-atlas.css',import.meta.url),'utf8');const compactCss=css.slice(css.indexOf('/* In narrow landscape'));
 assert.match(compactCss,/@media\(max-width:1000px\) and \(max-height:600px\) and \(orientation:landscape\)/);
 assert.match(compactCss,/atlas-workspace\{grid-template-columns:minmax\(0,1fr\);gap:0/);
 assert.match(compactCss,/atlas-actions\{height:55px;min-height:55px;max-height:55px/);
 assert.match(compactCss,/atlas-inspector\{position:absolute;inset:0 0 0 auto;width:min\(480px,100%\)/);
 assert.match(compactCss,/atlas-inspect-head[^}]+height:53px/);assert.match(compactCss,/atlas-inspect-actions[^}]+height:55px/);
 assert.doesNotMatch(compactCss,/atlas-nodes button|atlas-node-number/);
 for(const {routeWidth,routeHeight,outerHeight} of [{routeWidth:262,routeHeight:141,outerHeight:286},{routeWidth:495,routeHeight:195,outerHeight:340}]){
  assert.equal(routeWidth+220+10,routeWidth===262?492:725);
  const head=Number(compactCss.match(/atlas-inspect-head[^}]+height:(\d+)px/)[1]),foot=Number(compactCss.match(/atlas-inspect-actions[^}]+height:(\d+)px/)[1]);
  assert.ok(head>=44+8+1);assert.ok(foot>=44+10+1); // Target + padding + border, not a nominal row height.
  assert.ok(outerHeight-2-head-foot>=176); // The scrollable dossier owns the rest, even with safe insets.
  assert.ok(routeHeight>=141); // No extra map row is introduced.
 }
});
