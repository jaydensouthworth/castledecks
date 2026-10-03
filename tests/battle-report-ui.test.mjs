import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
const text=ui=>ui.get('battleReportText').value;
const enable=ui=>{ui.get('battleReportRecording').checked=true;ui.dispatch(ui.get('battleReportRecording'),'change');};
function switchTo(ui,id){ui.document.querySelector(`[data-hub-destination="${id}"]`).click();ui.click('start');if(ui.visible('switchSessionConfirm'))ui.click('confirmSessionSwitch');ui.frames();}

test('lobby report works with recording off, retains frozen game and closes via Escape',async t=>{
 const ui=await loadGameUI(t),b=ui.battle;ui.click('introBattleReport');assert.equal(ui.visible('battleReportPanel'),true);assert.ok(text(ui).includes(ui.get('buildLabel').textContent+' | campaign'));assert.match(text(ui),/No recorded events/);assert.equal(ui.get('battleReportRecording').checked,false);ui.frames(3);assert.equal(b.tick,0);ui.key('keydown','Escape');assert.equal(ui.visible('battleReportPanel'),false);assert.equal(ui.visible('intro'),true);assert.equal(ui.document.activeElement,ui.get('start'));
});

test('pause report does not resume on Back and observes events only after opting in',async t=>{
 const ui=await loadGameUI(t);ui.click('start');ui.frames(2);ui.click('battlePause');const tick=ui.battle.tick;ui.click('pauseBattleReport');enable(ui);ui.frames(2);assert.equal(ui.battle.tick,tick);ui.click('closeBattleReport');assert.equal(ui.visible('pauseOverlay'),true);assert.equal(ui.battle.paused,true);ui.click('resumeGame');ui.battle.queueImpact({source:ui.battle.badCastle,target:ui.battle.hero,amount:2});ui.frames(2);ui.click('battlePause');ui.click('pauseBattleReport');assert.match(text(ui),/\d+ damage ·/);assert.match(text(ui),/amount 2/);ui.click('battleReportClear');assert.match(text(ui),/No recorded events/);assert.equal(ui.get('battleReportRecording').checked,true);
});

test('Testing return, Escape and report focus trap retain correct parent panel',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=test'});ui.click('introTesting');ui.click('testBattleReport');assert.equal(ui.visible('testingPanel'),false);assert.equal(ui.visible('battleReportPanel'),true);assert.match(text(ui),/\| training \|/);
 ui.get('closeBattleReport').focus();ui.key('keydown','Tab',{shiftKey:true});assert.equal(ui.document.activeElement,ui.get('battleReportText'));ui.key('keydown','Tab');assert.equal(ui.document.activeElement,ui.get('closeBattleReport'));
 ui.key('keydown','Escape');assert.equal(ui.visible('battleReportPanel'),false);assert.equal(ui.visible('testingPanel'),true);ui.click('closeTesting');assert.equal(ui.visible('intro'),true);
});

test('copy sends the rendered snapshot only on click, ignores modified text, and reports failure safely',async t=>{
 const ui=await loadGameUI(t),copied=[];ui.window.navigator.clipboard={writeText:async value=>copied.push(value)};ui.click('introBattleReport');const rendered=text(ui);ui.get('battleReportText').value='USER_PRIVATE_TEXT';assert.equal(copied.length,0);await ui.click('battleReportCopy').completed;assert.deepEqual(copied,[rendered]);assert.match(ui.get('battleReportStatus').textContent,/Report copied/);
 ui.window.navigator.clipboard.writeText=async()=>{throw new Error('NO');};await ui.click('battleReportCopy').completed;assert.match(ui.get('battleReportStatus').textContent,/Copy was unavailable/);assert.equal(ui.visible('battleReportPanel'),true);
});

test('copy completion from a dismissed report cannot replace a newer report status',async t=>{
 const ui=await loadGameUI(t);let finish;ui.window.navigator.clipboard={writeText:()=>new Promise(resolve=>finish=resolve)};ui.click('introBattleReport');const pending=ui.click('battleReportCopy').completed;ui.click('closeBattleReport');ui.click('introBattleReport');finish();await pending;assert.match(ui.get('battleReportStatus').textContent,/Snapshot ready/);
});

test('download creates a text-only file and revokes its local blob without transmitting',async t=>{
 const ui=await loadGameUI(t),blobs=[],revoked=[],files=[];ui.document.body=ui.document.querySelector('body');const originalCreate=ui.document.createElement;ui.document.createElement=tag=>{const n=originalCreate(tag);if(tag==='a'){n.click=()=>files.push(n.download);n.remove=()=>n.parentNode.children.splice(n.parentNode.children.indexOf(n),1);}return n;};ui.window.URL={createObjectURL:blob=>{blobs.push(blob);return 'blob:local';},revokeObjectURL:url=>revoked.push(url)};ui.window.setTimeout=fn=>fn();
 ui.click('introBattleReport');assert.equal(blobs.length,0);const expected=text(ui);ui.click('battleReportDownload');assert.equal(blobs.length,1);assert.equal(blobs[0].type,'text/plain;charset=utf-8');assert.equal(await blobs[0].text(),expected);assert.deepEqual(files,['castledecks-battle-diagnostics.txt']);assert.deepEqual(revoked,['blob:local']);assert.match(ui.get('battleReportStatus').textContent,/download requested/);
});

test('disable clears history, reset creates a clean recorder, and recording is isolated by session',async t=>{
 const ui=await loadGameUI(t);ui.click('introBattleReport');enable(ui);ui.battle.emit({type:'shot',skill:'arrow'});ui.click('battleReportRefresh');assert.match(text(ui),/0 shot/);ui.click('closeBattleReport');switchTo(ui,'training');ui.click('introBattleReport');assert.equal(ui.get('battleReportRecording').checked,false);assert.match(text(ui),/No recorded events/);ui.click('closeBattleReport');switchTo(ui,'campaign');ui.click('introBattleReport');assert.equal(ui.get('battleReportRecording').checked,true);assert.match(text(ui),/0 shot/);
 ui.get('battleReportRecording').checked=false;ui.dispatch(ui.get('battleReportRecording'),'change');assert.match(text(ui),/recording off/);assert.match(text(ui),/No recorded events/);enable(ui);ui.click('closeBattleReport');ui.click('start');ui.click('battlePause');ui.click('battleRestart');ui.click('confirmRestart');ui.click('battlePause');ui.click('pauseBattleReport');assert.equal(ui.get('battleReportRecording').checked,false);
});

test('Wayfarer seed uses the approved numeric hook; no run or profile identity is included',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=expedition'});ui.battle.profile.name='PRIVATE_BANNER';ui.click('introBattleReport');assert.match(text(ui),new RegExp(`Seed: ${ui.battle.expeditionSeed}`));assert.ok(!text(ui).includes('PRIVATE_BANNER'));assert.match(text(ui),/\| expedition \|/);
});

test('integration adds only utility controls, local read-only hooks and one supplied build metadata path',async()=>{
 const html=await readFile(new URL('../site/dist/battle.html',import.meta.url),'utf8'),source=await readFile(new URL('../site/dist/battle.mjs',import.meta.url),'utf8'),adapter=await readFile(new URL('../site/dist/battle-report-ui.mjs',import.meta.url),'utf8');
 assert.equal((html.match(/id="battleReportPanel"/g)??[]).length,1);assert.match(html,/id="battleReportText" tabindex="0" readonly/);assert.match(source,/build:GAME_BUILD/);assert.match(source,/battleReport\.record\(event\)/);assert.doesNotMatch(adapter,/fetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|profile\??\.name|keydown|keyup/);assert.ok(adapter.includes('writeText(currentText)'));
});
