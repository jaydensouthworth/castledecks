import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldCamera, worldToScreen, screenToWorld, visibleWorldBounds, getBackingStoreSize, extendTerrainForCamera} from '../site/dist/world-camera.mjs';
import {aimVector, Arrow} from '../site/dist/engine/ballistics.mjs';
import {HeightField} from '../site/dist/engine/terrain.mjs';

const near = (actual, expected, label = '') => assert.ok(Math.abs(actual - expected) < 1e-8, `${label}: ${actual} ≈ ${expected}`);
const nearPoint = (actual, expected) => { near(actual.x, expected.x, 'x'); near(actual.y, expected.y, 'y'); };

// Expected values are explicit geometric fixtures, not a second copy of the implementation.
const fixtures = [
  {name: 'original harness', width: 2000, height: 1000, scale: 1, offsetX: 0, offsetY: 0, bounds: [0, 0, 2000, 1000]},
  {name: 'desktop 16:9', width: 1920, height: 1080, scale: .96, offsetX: 0, offsetY: 60, bounds: [0, -62.5, 2000, 1062.5]},
  {name: 'phone landscape', width: 844, height: 390, scale: .422, offsetX: 0, offsetY: -16, bounds: [0, 8000 / 211, 2000, 203000 / 211]},
  {name: 'phone portrait', width: 390, height: 844, scale: .195, offsetX: 0, offsetY: 324.5, bounds: [0, -64900 / 39, 2000, 103900 / 39]},
  {name: 'very wide', width: 2400, height: 850, scale: 1, offsetX: 200, offsetY: -75, bounds: [-200, 75, 2200, 925]},
  {name: 'tablet portrait', width: 768, height: 1024, scale: .384, offsetX: 0, offsetY: 320, bounds: [0, -2500 / 3, 2000, 5500 / 3]},
];

for (const fixture of fixtures) {
  test(`${fixture.name}: anchored overview geometry and invertible viewport corners`, () => {
    const camera = createWorldCamera(fixture.width, fixture.height);
    assert.equal(camera.renderable, true);
    for (const field of ['scale', 'offsetX', 'offsetY']) near(camera[field], fixture[field], field);
    const bounds = visibleWorldBounds(camera);
    for (const [i, field] of ['left', 'top', 'right', 'bottom'].entries()) near(bounds[field], fixture.bounds[i], field);
    nearPoint(worldToScreen(camera, {x: 1000, y: 500}), {x: fixture.width / 2, y: fixture.height / 2});
    nearPoint(screenToWorld(camera, {x: 0, y: 0}), {x: bounds.left, y: bounds.top});
    nearPoint(screenToWorld(camera, {x: fixture.width, y: fixture.height}), {x: bounds.right, y: bounds.bottom});
    nearPoint(worldToScreen(camera, {x: bounds.right, y: bounds.bottom}), {x: fixture.width, y: fixture.height});
    assert.ok(bounds.left <= 0 && bounds.right >= 2000, 'both world edges remain visible');
    assert.ok(bounds.top <= 75 && bounds.bottom >= 925, 'central 850 world units remain visible');
  });
}

test('the 2000×1000 harness remains exactly identity for original pointer coordinates', () => {
  const camera = createWorldCamera(2000, 1000);
  const points = [{x: 0, y: 0}, {x: 145.3, y: 638.7}, {x: -30, y: 870}, {x: 2000, y: 1000}];
  for (const point of points) {
    assert.deepEqual(worldToScreen(camera, point), point);
    assert.deepEqual(screenToWorld(camera, point), point);
  }
  assert.deepEqual(getBackingStoreSize(camera), {width: 2000, height: 1000, pixelRatioX: 1, pixelRatioY: 1, renderable: true});
});

test('uniform camera preserves distances, angles, and real aim velocities across resizes', () => {
  const origin = {x: 165, y: 650};
  const pointer = {x: 15, y: 715};
  const original = aimVector(origin, pointer);
  const baseline = new Arrow({x: origin.x, y: origin.y, ...original});
  for (let i = 0; i < 9; i++) baseline.step();
  for (const fixture of [...fixtures, fixtures[0]]) {
    const camera = createWorldCamera(fixture.width, fixture.height);
    const originOnScreen = worldToScreen(camera, origin);
    const pointerOnScreen = worldToScreen(camera, pointer);
    near(Math.hypot(pointerOnScreen.x - originOnScreen.x, pointerOnScreen.y - originOnScreen.y) / camera.scale, Math.hypot(150, 65));
    const fromInput = screenToWorld(camera, pointerOnScreen);
    const converted = aimVector(origin, fromInput);
    for (const field of ['vx', 'vy', 'speed', 'power']) near(converted[field], original[field], field);
    assert.equal(converted.canFire, original.canFire);
    const arrow = new Arrow({x: origin.x, y: origin.y, ...converted});
    for (let i = 0; i < 9; i++) arrow.step();
    nearPoint(arrow, baseline);
  }
});

test('known client coordinates subtract the canvas offset before inverse projection', () => {
  const camera = createWorldCamera(390, 844);
  const rect = {left: 17, top: 23};
  // World (1000, 500) is the known center, at local CSS (195, 422).
  nearPoint(screenToWorld(camera, {x: 212 - rect.left, y: 445 - rect.top}), {x: 1000, y: 500});
  // Do not clamp a captured bow pointer back into the gameplay area.
  nearPoint(screenToWorld(camera, {x: -19.5, y: 519.5}), {x: -100, y: 1000});
});

test('hidden, invalid, and pathological measurements never create invalid transforms', () => {
  for (const bad of [undefined, null, '', '390', NaN, Infinity, -Infinity, 0, -10]) {
    for (const dimensions of [[bad, 844], [390, bad]]) {
      const camera = createWorldCamera(...dimensions);
      assert.deepEqual(camera, {width: 2000, height: 1000, scale: 1, offsetX: 0, offsetY: 0, renderable: false});
      assert.deepEqual(visibleWorldBounds(camera), {left: 0, top: 0, right: 2000, bottom: 1000, width: 2000, height: 1000});
      assert.equal(getBackingStoreSize(camera).renderable, false);
    }
  }
  for (const dimensions of [[Number.MIN_VALUE, 844], [1e-200, 1e200]]) assert.equal(createWorldCamera(...dimensions).renderable, false);
  const resumed = createWorldCamera(390, 844);
  assert.equal(resumed.renderable, true, 'invalid layout does not poison subsequent layout');
});

test('integer backing store uses exact per-axis CSS mapping with bounded DPR and size', () => {
  const camera = createWorldCamera(390.25, 843.75);
  const store = getBackingStoreSize(camera, 3);
  assert.equal(store.width, 781);
  assert.equal(store.height, 1688);
  near(camera.width * store.pixelRatioX, store.width);
  near(camera.height * store.pixelRatioY, store.height);
  assert.equal(getBackingStoreSize(createWorldCamera(844, 390), 1.5).width, 1266);
  for (const bad of [0, -1, NaN, Infinity, '2', undefined]) assert.equal(getBackingStoreSize(createWorldCamera(390, 844), bad).width, 390);
  const huge = getBackingStoreSize(createWorldCamera(20000, 10000), 4);
  assert.equal(huge.width, 4096);
  assert.equal(huge.height, 2048);
});

test('decorative terrain covers exposed edges/bottom without changing collision samples', () => {
  const terrain = new HeightField();
  const before = structuredClone(terrain.samples);
  const interiorCollision = terrain.elevationAt(800);
  for (const fixture of fixtures) {
    const camera = createWorldCamera(fixture.width, fixture.height);
    const bounds = visibleWorldBounds(camera);
    const {surface, polygon} = extendTerrainForCamera(terrain.samples, camera, terrain.interval);
    assert.deepEqual(surface.slice(1, -1), before.map((y, i) => [i * 20, y]));
    assert.ok(surface[0][0] < Math.min(0, bounds.left));
    assert.ok(surface.at(-1)[0] > Math.max(2000, bounds.right));
    assert.equal(surface[0][1], before[0]);
    assert.equal(surface.at(-1)[1], before.at(-1));
    assert.ok(polygon.at(-1)[1] > Math.max(1000, bounds.bottom));
    assert.ok(polygon.flat().every(Number.isFinite));
    assert.ok(worldToScreen(camera, {x: surface[0][0], y: 0}).x <= -1 + 1e-8);
    assert.ok(worldToScreen(camera, {x: surface.at(-1)[0], y: 0}).x >= camera.width + 1 - 1e-8);
  }
  assert.deepEqual(terrain.samples, before);
  assert.equal(terrain.elevationAt(800), interiorCollision);
  assert.ok(Number.isNaN(terrain.elevationAt(2000)), 'existing physics boundary semantics were not silently clamped');
});

test('render-only terrain helper rejects malformed data without modifying its input', () => {
  const camera = createWorldCamera(2000, 1000);
  for (const samples of [[], [100, NaN], [100, Infinity]]) assert.throws(() => extendTerrainForCamera(samples, camera), TypeError);
  assert.throws(() => extendTerrainForCamera([100, 110], camera, 0), TypeError);
});
