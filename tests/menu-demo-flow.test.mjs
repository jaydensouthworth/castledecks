import test from 'node:test';import assert from 'node:assert/strict';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
const route=(ui,panel,name)=>{if(name==='loadout'){ui.get(panel).querySelector('[data-menu-route="deck"]').click();ui.click('shopBuildTab');}else ui.get(panel).querySelector(`[data-menu-route="${name}"]`).click();};

test('optional separate demo launch opens separate route and does not mutate a prepared campaign',async t=>{
 const ui=await loadGameUI(t),b=ui.battle,before=JSON.stringify({profile:b.profile,level:b.level,tick:b.tick});let opened=null;const target={opener:'old'};ui.window.open=(url,name)=>{opened={url,name};return target;};
 ui.click('introDemo');ui.click('hubOpenSeparate');assert.deepEqual(opened,{url:'./battle?mode=demo',name:'_blank'});assert.equal(target.opener,null);assert.equal(ui.battle,b);assert.equal(JSON.stringify({profile:b.profile,level:b.level,tick:b.tick}),before);assert.match(ui.get('introNotice').textContent,/separate tab/);
});
test('blocked demo popup leaves campaign intact and shows direct separate-tab link',async t=>{
 const ui=await loadGameUI(t),b=ui.battle;ui.window.open=()=>null;ui.click('introDemo');ui.click('hubOpenSeparate');assert.equal(ui.battle,b);const link=ui.get('introNotice').querySelector('a');assert.equal(link.getAttribute('href'),'./battle?mode=demo');assert.equal(link.getAttribute('target'),'_blank');assert.equal(ui.visible('intro'),true);
});
test('demo route prepares its real midpoint behind the lobby until explicitly started',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=demo'}),b=ui.battle;assert.equal(b.level,13);assert.equal(b.tick,1350);assert.equal(b.paused,false);assert.equal(ui.visible('intro'),true);assert.equal(ui.visible('pauseOverlay'),false);assert.equal(b.profile.cheated,true);assert.equal(b.testing,false);assert.equal(!!b.protectedTesting,false);assert.equal(b.goodTeam.length,19);assert.equal(b.badTeam.length,16);assert.equal(b.profile.gold,1100);assert.equal(b.profile.skills.length,11);assert.equal(ui.get('testModeBadge').textContent,'DEMO');ui.frames(30);assert.equal(b.tick,1350);ui.click('start');ui.frames();assert.ok(b.tick>1350);assert.equal(b.paused,false);
});
test('demo restart creates a fresh identical handoff, and return has a visible fallback',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=demo'}),first=ui.battle;ui.click('start');ui.frames(20);ui.click('battlePause');ui.click('demoRestart');assert.notEqual(ui.battle,first);assert.equal(ui.battle.tick,1350);assert.equal(ui.battle.profile.gold,1100);assert.equal(ui.battle.goodTeam.length,19);assert.equal(ui.battle.paused,false);assert.equal(ui.visible('intro'),true);ui.click('start');ui.click('battlePause');let closes=0;ui.window.close=()=>closes++;ui.click('demoReturn');assert.equal(closes,1);assert.match(ui.get('demoReturnNote').textContent,/close it to return/);
});
test('preparation management routes never advance battle or spend and have one visible panel',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=test'});ui.click('introTesting');ui.click('testGoldLarge');ui.click('testUnlock');ui.click('closeTesting');ui.click('introLoadout');const b=ui.battle,gold=b.profile.gold;
 for(const [from,to,visible]of[['skillsPanel','army','queuePanel'],['queuePanel','settings','settingsPanel'],['settingsPanel','profiles','profilesPanel'],['profilesPanel','vault','savePanel'],['savePanel','loadout','skillsPanel']]){route(ui,from,to);ui.frames(5);assert.equal(ui.visible(visible),true);assert.equal(ui.visible(from),false);assert.equal(b.tick,0);assert.equal(b.profile.gold,gold);}
 ui.click('closeSkills');assert.equal(ui.visible('intro'),true);assert.equal(b.tick,0);
});
test('paused navigation and precision Back preserve explicit Pause and bindings',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=demo'});ui.click('start');ui.click('battlePause');ui.click('pauseSkills');const tick=ui.battle.tick;route(ui,'skillsPanel','settings');ui.click('openAim');ui.key('keydown','Escape');assert.equal(ui.visible('settingsPanel'),true);assert.equal(ui.visible('aimPanel'),false);ui.frames(5);assert.equal(ui.battle.tick,tick);route(ui,'settingsPanel','loadout');ui.click('closeSkills');assert.equal(ui.visible('pauseOverlay'),true);assert.equal(ui.battle.paused,true);
});

test('embedded demo returns to its lab without attempting to close the parent tab',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=demo'});ui.window.location.origin='https://example.test';const sent=[];ui.window.parent={postMessage:(message,origin)=>sent.push({message,origin})};let closes=0;ui.window.close=()=>closes++;ui.click('battlePause');ui.click('demoReturn');assert.equal(closes,0);assert.deepEqual(sent,[{message:{type:'bowmaster-preview-exit-demo'},origin:'https://example.test'}]);
});
test('demo initial aiming choice and restart preserve its chosen controls',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=demo&aim=point_aim'});assert.equal(ui.battle.profile.shootingMode,'point_aim');ui.click('battlePause');ui.click('demoRestart');assert.equal(ui.battle.profile.shootingMode,'point_aim');assert.equal(ui.battle.tick,1350);
});

test('trajectory control is available only for the selected Auto aim mode',async t=>{
 const ui=await loadGameUI(t);ui.click('introSettings');assert.equal(ui.get('trajectory').disabled,true);
 ui.get('aimMode').value='auto_aim';ui.dispatch(ui.get('aimMode'),'change');assert.equal(ui.get('trajectory').disabled,false);assert.equal(ui.battle.profile.shootingMode,'classic','draft choice is not yet applied');
 ui.get('aimMode').value='point_aim';ui.dispatch(ui.get('aimMode'),'change');assert.equal(ui.get('trajectory').disabled,true);
 ui.click('applySettings');assert.equal(ui.battle.profile.shootingMode,'point_aim');assert.equal(ui.get('aimGuideTitle').textContent,'Choose your target.');
});

test('reopening Settings shows applied preferences, while nested Precision keeps the current draft',async t=>{
 const ui=await loadGameUI(t);ui.click('introSettings');ui.get('aimMode').value='auto_aim';ui.dispatch(ui.get('aimMode'),'change');ui.click('openAim');ui.click('closeAim');assert.equal(ui.get('aimMode').value,'auto_aim');ui.click('closeSettings');ui.click('introSettings');assert.equal(ui.get('aimMode').value,'classic');assert.equal(ui.get('trajectory').disabled,true);
});
