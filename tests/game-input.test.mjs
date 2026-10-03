import test from 'node:test';
import assert from 'node:assert/strict';
import {CampaignProfiles} from '../site/dist/engine/profile-manager.mjs';
import {PlayerProfile} from '../site/dist/engine/progression.mjs';
import {deferredFile, loadGameUI} from './helpers/game-ui-harness.mjs';

// These tests execute the shipped UI's listeners, its fixed-rate frame loop,
// and the real engine. The bounded Node DOM does not establish visual layering,
// native inert behavior, browser focus/capture behavior, or touch-device quality.
// Run with: node --test tests/game-input.test.mjs

const bundle = name => new CampaignProfiles({defaultName: name}).exportBundle();
const fileWith = text => ({size: text.length, text: async () => text});

function startReady(ui) {
  ui.click('start');
  ui.frames(31);
  assert.equal(ui.battle.activeSkill.cooldown, 0);
}

function drawBow(ui, pointerId = 1) {
  const origin = {...ui.battle.hero.launchPosition};
  const end = {x: origin.x - 150, y: origin.y + 65};
  ui.pointer('pointerdown', pointerId, origin);
  ui.frames();
  ui.pointer('pointermove', pointerId, end);
  ui.frames();
  assert.equal(ui.battle.shooter.holding, true);
  return end;
}

function assertInputClear(ui) {
  for (const key of ['left', 'right', 'up', 'down', 'mouseDown', 'space']) assert.equal(ui.battle.input[key], false, `${key} was cleared`);
  assert.deepEqual(ui.battle.input.digits, []);
  assert.equal(ui.battle.shooter.holding, false);
  assert.equal(ui.battle.shooter.active, null);
  assert.equal(ui.battle.queuedAim, null);
  assert.equal(ui.battle.queuedSelection, null);
}

test('held Escape pauses once, and another physical press resumes', async t => {
  const ui = await loadGameUI(t);
  startReady(ui);
  ui.key('keydown', 'Escape');
  assert.equal(ui.battle.paused, true);
  assert.equal(ui.visible('pauseOverlay'), true);
  const pausedAt = ui.battle.tick;
  for (let i = 0; i < 4; i++) {
    assert.equal(ui.key('keydown', 'Escape', {repeat: true}).event.defaultPrevented, true);
    ui.frames();
    assert.equal(ui.battle.tick, pausedAt);
    assert.equal(ui.visible('pauseOverlay'), true);
  }
  ui.key('keyup', 'Escape');
  ui.key('keydown', 'Escape');
  ui.frames();
  assert.equal(ui.battle.paused, false);
  assert.equal(ui.visible('pauseOverlay'), false);
  assert.ok(ui.battle.tick > pausedAt);
});

test('window blur clears held controls and bow, pauses, and requires an explicit resume', async t => {
  const ui = await loadGameUI(t);
  startReady(ui);
  const end = drawBow(ui);
  for (const key of ['a', 'w', '3', ' ']) ui.key('keydown', key);
  assert.equal(ui.battle.input.left, true);
  assert.equal(ui.battle.input.space, true);
  assert.equal(ui.get('battlefield').hasPointerCapture(1), true);
  ui.dispatch(ui.window, 'blur');
  assertInputClear(ui);
  assert.equal(ui.battle.paused, true);
  assert.equal(ui.visible('pauseOverlay'), true);
  assert.match(ui.get('pauseReason').textContent, /focus/i);
  assert.equal(ui.get('battlefield').hasPointerCapture(1), false);
  const pausedAt = ui.battle.tick;
  ui.dispatch(ui.window, 'focus');
  ui.frames(4);
  assert.equal(ui.battle.tick, pausedAt);
  ui.click('resumeGame');
  ui.pointer('pointerup', 1, end);
  ui.frames(2);
  assert.equal(ui.battle.stats.shotsFired, 0, 'a stale release after returning must not fire');
  assertInputClear(ui);
  const freshEnd = drawBow(ui, 2);
  ui.pointer('pointerup', 2, freshEnd);
  ui.frames();
  assert.equal(ui.battle.stats.shotsFired, 1, 'a fresh draw still works after resume');
});

test('hidden-tab interruption clears input and returning does not resume automatically', async t => {
  const ui = await loadGameUI(t);
  startReady(ui);
  drawBow(ui);
  ui.key('keydown', 'd');
  ui.document.hidden = true;
  ui.dispatch(ui.document, 'visibilitychange');
  assertInputClear(ui);
  const pausedAt = ui.battle.tick;
  ui.document.hidden = false;
  ui.dispatch(ui.document, 'visibilitychange');
  ui.frames(3);
  assert.equal(ui.battle.tick, pausedAt);
  assert.equal(ui.visible('pauseOverlay'), true);
  ui.click('resumeGame');
  ui.frames();
  assert.ok(ui.battle.tick > pausedAt);
});

test('an unrelated finger cannot move, release, or cancel the accepted bow draw', async t => {
  const ui = await loadGameUI(t);
  startReady(ui);
  const end = drawBow(ui, 11);
  const otherPoint = {x: 900, y: 300};
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) {
    ui.pointer(type, 22, otherPoint);
    ui.frames();
    assert.equal(ui.battle.stats.shotsFired, 0, `${type} from the other finger must not fire`);
    assert.equal(ui.battle.shooter.holding, true, `${type} from the other finger must not cancel`);
    assert.deepEqual(ui.battle.shooter.pointer, end, `${type} from the other finger must not redirect`);
    assert.equal(ui.battle.input.mouseDown, true);
  }
  ui.pointer('pointerup', 11, end);
  ui.frames();
  assert.equal(ui.battle.stats.shotsFired, 1);
  assert.equal(ui.battle.shooter.holding, false);
  assert.equal(ui.battle.input.mouseDown, false);
  const arrow = ui.battle.objects.items.find(item => item.kind === 'hero_arrow');
  assert.ok(arrow && arrow.vx > 0 && arrow.vy < 0, 'the owner fires the intended upward/rightward shot');
});

for (const interruption of ['pointercancel', 'lostpointercapture']) {
  test(`${interruption} of the owner cancels without firing and allows a new draw`, async t => {
    const ui = await loadGameUI(t);
    startReady(ui);
    const end = drawBow(ui, 10);
    if (interruption === 'lostpointercapture') ui.get('battlefield').releasePointerCapture(10);
    else ui.pointer(interruption, 10, end);
    ui.frames();
    ui.pointer('pointerup', 10, end);
    ui.frames();
    assert.equal(ui.battle.stats.shotsFired, 0);
    assert.equal(ui.battle.shooter.holding, false);
    const nextEnd = drawBow(ui, 20);
    ui.pointer('pointerup', 20, nextEnd);
    ui.frames();
    assert.equal(ui.battle.stats.shotsFired, 1);
  });
}

test('rejected battlefield presses do not own the bow or set held mouse input', async t => {
  const ui = await loadGameUI(t);
  startReady(ui);
  const origin = {...ui.battle.hero.launchPosition};
  for (const [pointerId, point, button] of [[1, {x: 1500, y: 300}, 0], [2, {x: 350, y: 900}, 0], [3, origin, 2]]) {
    ui.dispatch(ui.get('battlefield'), 'pointerdown', {pointerId, clientX: point.x, clientY: point.y, button});
    ui.frames();
    assert.equal(ui.battle.input.mouseDown, false);
    assert.equal(ui.battle.shooter.holding, false);
    assert.equal(ui.get('battlefield').hasPointerCapture(pointerId), false);
  }
  assert.equal(ui.battle.stats.shotsFired, 0);
  const end = drawBow(ui, 4);
  ui.pointer('pointerup', 4, end);
  ui.frames();
  assert.equal(ui.battle.stats.shotsFired, 1);
});

test('panels shield the background; dismissal restores the existing pause state', async t => {
  const ui = await loadGameUI(t);
  const background = ['.topbar', '.battle-screen', '.command-deck', '#intro', '#pauseOverlay', '#ending', '#restartConfirm'];
  const assertShield = active => {
    assert.equal(ui.visible('panelShield'), active);
    for (const selector of background) assert.equal(ui.document.querySelector(selector).inert, active, `${selector} inert state`);
  };
  assertShield(false);
  ui.click('introSettings');
  assertShield(true);
  ui.key('keydown', 'd');
  ui.pointer('pointerdown', 1, {x: 350, y: 500});
  ui.frames(2);
  assert.equal(ui.battle.tick, 0);
  assert.equal(ui.battle.input.right, false);
  assert.equal(ui.battle.shooter.holding, false);
  ui.click('closeSettings');
  assertShield(false);
  assert.equal(ui.visible('intro'), true);
  startReady(ui);
  ui.key('keydown', 'Escape');
  const pausedAt = ui.battle.tick;
  ui.click('openSettings');
  assertShield(true);
  assert.equal(ui.visible('pauseOverlay'), false);
  ui.key('keydown', 'p');
  ui.key('keydown', 'd');
  ui.pointer('pointerdown', 2, ui.battle.hero.launchPosition);
  ui.frames(2);
  assert.equal(ui.battle.tick, pausedAt);
  assert.equal(ui.battle.input.right, false);
  ui.key('keydown', 'Escape');
  assertShield(false);
  assert.equal(ui.visible('settingsPanel'), false);
  assert.equal(ui.visible('pauseOverlay'), true);
  ui.key('keydown', 'Escape', {repeat: true});
  assert.equal(ui.battle.paused, true, 'holding the close key must not also resume');
  ui.click('resumeGame');
  ui.frames();
  assert.ok(ui.battle.tick > pausedAt);
});

test('a newer selected save wins when file reads finish out of order', async t => {
  const ui = await loadGameUI(t);
  const older = deferredFile();
  const oldLoad = ui.load(older.file);
  assert.equal(ui.get('saveFile').value, '', 'the same file can be selected again while reading');
  await ui.load(fileWith(bundle('Newer load')));
  const newerBattle = ui.battle;
  const message = ui.get('introNotice').textContent;
  assert.equal(newerBattle.profile.name, 'Newer load');
  older.resolve(bundle('Older load'));
  await oldLoad;
  assert.equal(ui.battle, newerBattle);
  assert.equal(ui.battle.profile.name, 'Newer load');
  assert.equal(ui.get('introNotice').textContent, message);
});

test('a stale read error cannot replace the successful newer import notice', async t => {
  const ui = await loadGameUI(t);
  const older = deferredFile();
  const oldLoad = ui.load(older.file);
  await ui.load(fileWith(bundle('Newest')));
  const message = ui.get('saveStatus').textContent;
  older.reject(new Error('old read failed'));
  await oldLoad;
  assert.equal(ui.battle.profile.name, 'Newest');
  assert.equal(ui.get('saveStatus').textContent, message);
});

for (const navigation of ['begin', 'resume', 'create profile']) {
  test(`a late import cannot overwrite a later ${navigation} choice`, async t => {
    const ui = await loadGameUI(t);
    if (navigation === 'resume') {
      startReady(ui);
      ui.key('keydown', 'Escape');
    }
    const oldFile = deferredFile();
    const pending = ui.load(oldFile.file);
    if (navigation === 'begin') ui.click('start');
    else if (navigation === 'resume') ui.click('resumeGame');
    else {
      ui.click('introProfiles');
      ui.get('newProfileName').value = 'Chosen';
      ui.click('createProfile');
    }
    const chosenBattle = ui.battle;
    const paused = chosenBattle.paused;
    const notice = ui.get('introNotice').textContent;
    oldFile.resolve(bundle('Obsolete'));
    await pending;
    assert.equal(ui.battle, chosenBattle);
    assert.notEqual(ui.battle.profile.name, 'Obsolete');
    assert.equal(ui.battle.paused, paused);
    assert.equal(ui.get('introNotice').textContent, notice);
    ui.frames();
    if (navigation === 'create profile') {
      assert.equal(ui.battle.profile.name, 'Chosen');
      assert.equal(ui.battle.tick, 0);
      assert.equal(ui.visible('intro'), true);
    } else {
      assert.ok(ui.battle.tick > 0);
      assert.equal(ui.visible('intro'), false);
      assert.equal(ui.visible('pauseOverlay'), false);
    }
  });
}

test('retiring a completed campaign with another profile requires choosing before battle starts', async t => {
  const ui = await loadGameUI(t);
  const completed = new PlayerProfile('Champion');
  Object.assign(completed, {level: 31, highestLevel: 31, scene: 32, highestScene: 32, victories: 30, gold: 800});
  const next = new PlayerProfile('Next campaign');
  Object.assign(next, {level: 6, highestLevel: 6, scene: 7, highestScene: 7});
  await ui.load(fileWith(new CampaignProfiles({profiles: [completed, next]}).exportBundle()));
  assert.equal(ui.visible('ending'), true);
  assert.equal(ui.get('replay').textContent, 'Retire and choose campaign');
  ui.click('replay');
  ui.frames(4);
  assert.equal(ui.visible('profilesPanel'), true);
  assert.equal(ui.visible('panelShield'), true);
  assert.equal(ui.battle.profile.name, 'Next campaign');
  assert.equal(ui.battle.tick, 0, 'retirement must not silently start the remaining campaign');
  assert.match(ui.get('profileStatus').textContent, /1 of 9 active profiles · 1 completed/);
  assert.match(ui.get('retiredProfiles').textContent, /Champion/);
  ui.click('switchProfile');
  assert.equal(ui.visible('profilesPanel'), false);
  assert.equal(ui.visible('panelShield'), false);
  assert.equal(ui.visible('intro'), true);
  assert.equal(ui.battle.level, 6);
  ui.frames(2);
  assert.equal(ui.battle.tick, 0);
  ui.click('start');
  ui.frames();
  assert.equal(ui.battle.tick, 1);
});
