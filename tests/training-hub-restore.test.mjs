import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGameUI} from './helpers/game-ui-harness.mjs';

const select = (ui, id) => ui.get('hubDestinations')
  .querySelector(`[data-hub-destination="${id}"]`).click();
const route = (ui, panel, name) => ui.get(panel)
  .querySelector(`[data-menu-route="${name}"]`).click();

function switchTo(ui, id) {
  select(ui, id);
  ui.click('start');
  if (ui.visible('switchSessionConfirm')) ui.click('confirmSessionSwitch');
  ui.frames();
}

function returnToHub(ui) {
  ui.click('battlePause');
  ui.click('pauseLobby');
  ui.frames();
}

function snapshot(battle) {
  return JSON.stringify({
    tick: battle.tick,
    profile: battle.profile,
    stats: battle.stats,
    good: battle.goodTeam.map(unit => [unit.id, unit.type, unit.x, unit.y, unit.hp]),
    bad: battle.badTeam.map(unit => [unit.id, unit.type, unit.x, unit.y, unit.hp]),
    projectiles: battle.projectiles.map(shot => [shot.kind, shot.x, shot.y, shot.vx, shot.vy]),
    queue: battle.friendlyQueue.queue,
    population: battle.friendlyQueue.population,
    outcome: battle.outcome,
    summary: battle.summary,
  });
}

function assertGuidedHub(ui, launch) {
  assert.equal(ui.visible('intro'), true);
  assert.equal(ui.visible('trainingEntry'), true);
  assert.match(ui.get('start').textContent, new RegExp(`${launch} guided`, 'i'));
  assert.match(ui.get('hubSessionResources').textContent, /practice.*0\/5.*no campaign rewards/i);
  assert.match(ui.get('hubSessionState').textContent, /training.*paused.*no earned progression/i);
  assert.equal(ui.visible('introTesting'), false);
  assert.equal(ui.get('introProfiles').disabled, true);
  assert.equal(ui.get('introSave').disabled, true);
  assert.equal(ui.visible('trainingCoach'), false);
}

function assertNoHeldInput(ui, battle) {
  for (const key of ['left', 'right', 'up', 'down', 'mouseDown', 'space']) {
    assert.equal(battle.input[key], false, `${key} must be released`);
  }
  assert.deepEqual(battle.input.digits, []);
  assert.equal(battle.playerShots.length, 0);
  assert.equal(battle.shooter.holding, false);
  assert.equal(ui.document.captures.size, 0);
}

test('cached guided hub copy survives repeated destination selection and modal closes', async t => {
  const ui = await loadGameUI(t, {search: '?mode=test&guide=1'});
  const drill = ui.battle;
  const before = snapshot(drill);
  for (let repeat = 0; repeat < 3; repeat++) {
    select(ui, 'campaign');
    assert.match(ui.get('start').textContent, /^Open /i);
    assert.doesNotMatch(ui.get('start').textContent, /guided/i);
    assert.equal(ui.visible('trainingEntry'), false);
    select(ui, 'training');
    assertGuidedHub(ui, 'Start');
    ui.click('introSettings');
    ui.click('openControls');
    ui.click('cancelControls');
    assert.equal(ui.visible('settingsPanel'), true);
    ui.click('closeSettings');
    ui.frames(4);
    assertGuidedHub(ui, 'Start');
    ui.click('introLoadout');
    route(ui, 'skillsPanel', 'settings');
    ui.click('closeSettings');
    ui.frames(4);
    assertGuidedHub(ui, 'Start');
    assert.equal(ui.battle, drill);
    assert.equal(snapshot(drill), before);
  }
  ui.click('start');
  ui.frames(2);
  returnToHub(ui);
  const paused = snapshot(drill);
  for (let repeat = 0; repeat < 3; repeat++) {
    ui.click('introSettings');
    ui.key('keydown', 'Escape');
    select(ui, 'training');
    ui.frames(4);
    assertGuidedHub(ui, 'Resume');
    assert.equal(snapshot(drill), paused);
  }
});

test('nested controls return to a paused guided drill without replaying input or starting a battle', async t => {
  const ui = await loadGameUI(t, {search: '?mode=test&guide=1'});
  ui.click('start');
  ui.frames(31);
  const drill = ui.battle;
  const point = drill.guidedTraining.targetPoint();
  const movement = ui.document.querySelector('[data-key="right"]');
  ui.pointer('pointerdown', 51, {x: 0, y: 0}, movement);
  ui.key('keydown', ' ', {code: 'Space', target: ui.get('battlefield')});
  ui.pointer('pointerdown', 52, point);
  ui.pointer('pointerup', 52, point);
  assert.ok(drill.playerShots.length > 0);
  ui.click('battlePause');
  const paused = snapshot(drill);
  ui.click('openSettings');
  ui.click('openControls');
  assertNoHeldInput(ui, drill);
  ui.click('control-right');
  ui.key('keydown', 'l', {code: 'KeyL'});
  ui.click('applyControls');
  assert.equal(ui.visible('settingsPanel'), true);
  assert.equal(ui.visible('controlsPanel'), false);
  ui.key('keydown', 'Escape');
  assert.equal(ui.visible('pauseOverlay'), true);
  assert.equal(ui.visible('panelShield'), false);
  ui.frames(20);
  assert.equal(snapshot(drill), paused);
  assert.equal(drill.guidedTraining.complete, false);
  ui.click('resumeGame');
  ui.key('keyup', ' ', {code: 'Space'});
  ui.pointer('pointerup', 51, {x: 0, y: 0}, movement);
  ui.key('keydown', 'd', {code: 'KeyD', repeat: true});
  assertNoHeldInput(ui, drill);
  ui.frames(10);
  assert.equal(drill.stats.shotsFired, 0);
  assert.equal(drill.guidedTraining.complete, false);
  ui.key('keydown', 'l', {code: 'KeyL'});
  assert.equal(drill.input.right, true);
  ui.key('keyup', 'l', {code: 'KeyL'});
  assert.equal(drill.input.right, false);
});

test('Training session round trips preserve the paused drill and original playground independently', async t => {
  const ui = await loadGameUI(t, {search: '?mode=test'});
  const playground = ui.battle;
  playground.profile.gold = 713;
  ui.click('start');
  ui.frames(4);
  returnToHub(ui);
  const playgroundBefore = snapshot(playground);
  ui.click('introGuidedTraining');
  ui.click('start');
  ui.frames(4);
  const drill = ui.battle;
  returnToHub(ui);
  const drillBefore = snapshot(drill);
  let campaign;
  for (let repeat = 0; repeat < 2; repeat++) {
    switchTo(ui, 'campaign');
    campaign ??= ui.battle;
    assert.equal(ui.battle, campaign);
    assert.equal(ui.visible('introTesting'), false);
    assert.equal(ui.get('introSave').disabled, false);
    ui.click('introLoadout');
    ui.click('closeSkills');
    switchTo(ui, 'training');
    assert.equal(ui.battle, drill);
    assert.equal(snapshot(drill), drillBefore);
    assert.equal(snapshot(playground), playgroundBefore);
    assertGuidedHub(ui, 'Resume');
  }
  ui.click('introExitTraining');
  ui.frames(20);
  assert.equal(ui.battle, playground);
  assert.equal(snapshot(playground), playgroundBefore);
  assert.equal(ui.visible('introTesting'), true);
  assert.equal(ui.visible('introGuidedTraining'), true);
  assert.equal(ui.visible('introExitTraining'), false);
  assert.equal(ui.get('introSave').disabled, false);
  assert.match(ui.get('start').textContent, /Resume battle/i);
  ui.click('introTesting');
  ui.click('closeTesting');
  assert.equal(snapshot(playground), playgroundBefore);
});

test('campaign invitation returns through menus to the exact campaign on repeated practice exits', async t => {
  const ui = await loadGameUI(t);
  const campaign = ui.battle;
  campaign.profile.gold = 347;
  const before = snapshot(campaign);
  for (let repeat = 0; repeat < 2; repeat++) {
    ui.click('introGuidedTraining');
    ui.frames();
    assert.notEqual(ui.battle, campaign);
    assertGuidedHub(ui, 'Start');
    ui.click('introSettings');
    ui.click('openControls');
    ui.click('closeControls');
    ui.click('closeSettings');
    ui.click('introExitTraining');
    ui.frames(20);
    assert.equal(ui.battle, campaign);
    assert.equal(snapshot(campaign), before);
    assert.equal(ui.get('introProfiles').disabled, false);
    assert.equal(ui.get('introSave').disabled, false);
    assert.equal(ui.get('aimMode').disabled, false);
    assert.equal(ui.visible('introTesting'), false);
    assert.equal(ui.get('gameShell').dataset.guidedTraining, 'false');
    assert.doesNotMatch(ui.get('start').textContent, /guided/i);
    ui.click('introSave');
    assert.equal(ui.visible('savePanel'), true);
    ui.click('closeSave');
  }
});

test('queued shots and captured movement never cross a Training entry or exit', async t => {
  const ui = await loadGameUI(t, {search: '?mode=test'});
  ui.click('introSettings');
  ui.get('aimMode').value = 'auto_aim';
  ui.click('applySettings');
  ui.click('start');
  ui.frames(31);
  const playground = ui.battle;
  const movement = ui.document.querySelector('[data-key="right"]');
  ui.pointer('pointerdown', 71, {x: 0, y: 0}, movement);
  ui.key('keydown', ' ', {code: 'Space', target: ui.get('battlefield')});
  ui.pointer('pointerdown', 72, {x: 1200, y: 400});
  ui.pointer('pointerup', 72, {x: 1200, y: 400});
  assert.ok(playground.playerShots.length > 0);
  returnToHub(ui);
  assertNoHeldInput(ui, playground);
  const playgroundBefore = snapshot(playground);
  ui.click('introGuidedTraining');
  ui.click('start');
  ui.frames(31);
  const drill = ui.battle;
  assertNoHeldInput(ui, drill);
  const point = drill.guidedTraining.targetPoint();
  ui.pointer('pointerdown', 73, {x: 0, y: 0}, movement);
  ui.key('keydown', ' ', {code: 'Space', target: ui.get('battlefield')});
  ui.pointer('pointerdown', 74, point);
  ui.pointer('pointerup', 74, point);
  assert.ok(drill.playerShots.length > 0);
  ui.click('trainingExit');
  ui.frames(10);
  assert.equal(ui.battle, playground);
  assert.equal(snapshot(playground), playgroundBefore);
  assertNoHeldInput(ui, playground);
  assertNoHeldInput(ui, drill);
  ui.click('start');
  ui.pointer('pointerup', 71, {x: 0, y: 0}, movement);
  ui.pointer('pointerup', 73, {x: 0, y: 0}, movement);
  ui.key('keyup', ' ', {code: 'Space'});
  ui.frames(15);
  assertNoHeldInput(ui, playground);
  assert.equal(playground.stats.shotsFired, 0);
  assert.equal(drill.stats.shotsFired, 0);
  assert.equal(drill.guidedTraining.complete, false);
});
