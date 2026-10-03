import test from 'node:test';
import assert from 'node:assert/strict';
import {drawAlternateAimGuide} from '../site/dist/alternate-aim-guides.mjs';
import {PointShooter, AutoShooter} from '../site/dist/engine/alternate-shooter.mjs';
import {createWorldCamera, getBackingStoreSize, worldToScreen} from '../site/dist/world-camera.mjs';

const near = (actual, expected, message = '') => assert.ok(Math.abs(actual - expected) < 1e-8, `${message}: ${actual} ≈ ${expected}`);
const nearPoint = (actual, expected) => { near(actual.x, expected.x, 'x'); near(actual.y, expected.y, 'y'); };

/** Records CSS-projected path geometry and saved state without a browser or
 * package dependency. Matrix operations are normal Canvas2D affine composition.
 */
class RecordingContext {
  constructor(camera = createWorldCamera(2000, 1000), dpr = 1) {
    const store = getBackingStoreSize(camera, dpr);
    this.ratioX = store.pixelRatioX;
    this.ratioY = store.pixelRatioY;
    this.state = {
      matrix: [camera.scale * this.ratioX, 0, 0, camera.scale * this.ratioY,
        camera.offsetX * this.ratioX, camera.offsetY * this.ratioY],
      strokeStyle: '#123456', fillStyle: '#654321', lineWidth: 7,
      globalAlpha: .35, lineCap: 'butt', lineJoin: 'bevel', dash: [4, 8],
    };
    for (const property of ['strokeStyle', 'fillStyle', 'lineWidth', 'globalAlpha', 'lineCap', 'lineJoin']) {
      Object.defineProperty(this, property, {
        get: () => this.state[property], set: value => { this.state[property] = value; },
      });
    }
    this.calls = [];
    this.stack = [];
    this.path = [];
    this.paints = [];
  }
  record(name, ...args) {
    assert.ok(args.filter(value => typeof value === 'number').every(Number.isFinite), `${name} received finite numbers`);
    this.calls.push({name, args});
  }
  project(x, y) {
    const [a, b, c, d, e, f] = this.state.matrix;
    const point = {x: (a * x + c * y + e) / this.ratioX, y: (b * x + d * y + f) / this.ratioY};
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
    return point;
  }
  save() { this.record('save'); this.stack.push(structuredClone(this.state)); }
  restore() { this.record('restore'); this.state = this.stack.pop(); }
  setLineDash(dash) { this.record('setLineDash', ...dash); this.state.dash = [...dash]; }
  translate(x, y) {
    this.record('translate', x, y);
    const [a, b, c, d, e, f] = this.state.matrix;
    this.state.matrix = [a, b, c, d, a * x + c * y + e, b * x + d * y + f];
  }
  scale(x, y) {
    this.record('scale', x, y);
    const [a, b, c, d, e, f] = this.state.matrix;
    this.state.matrix = [a * x, b * x, c * y, d * y, e, f];
  }
  rotate(angle) {
    this.record('rotate', angle);
    const [a, b, c, d, e, f] = this.state.matrix, cos = Math.cos(angle), sin = Math.sin(angle);
    this.state.matrix = [a * cos + c * sin, b * cos + d * sin, c * cos - a * sin, d * cos - b * sin, e, f];
  }
  beginPath() { this.record('beginPath'); this.path = []; }
  moveTo(x, y) { this.record('moveTo', x, y); this.path.push({kind: 'move', ...this.project(x, y)}); }
  lineTo(x, y) { this.record('lineTo', x, y); this.path.push({kind: 'line', ...this.project(x, y)}); }
  arc(x, y, radius, start, end) {
    this.record('arc', x, y, radius, start, end);
    const [a, b, c, d] = this.state.matrix;
    this.path.push({kind: 'arc', ...this.project(x, y),
      radiusX: radius * Math.hypot(a / this.ratioX, b / this.ratioY),
      radiusY: radius * Math.hypot(c / this.ratioX, d / this.ratioY)});
  }
  paint(kind) {
    const [a, b] = this.state.matrix;
    this.paints.push({kind, path: structuredClone(this.path), state: structuredClone(this.state),
      cssLineWidth: this.lineWidth * Math.hypot(a / this.ratioX, b / this.ratioY)});
  }
  stroke() { this.record('stroke'); this.paint('stroke'); }
  fill() { this.record('fill'); this.paint('fill'); }
}

const draw = (ctx, options = {}) => drawAlternateAimGuide(ctx, {
  mode: 'point_aim', guide: {x: 350, y: 560, rotation: 180}, scale: .422, visible: true, ...options,
});
const cameras = [
  [2000, 1000], [1920, 1080], [844, 390], [390, 844], [2400, 850], [390.25, 843.75],
].map(([width, height]) => createWorldCamera(width, height));

test('requires explicit visibility, a supported mode, and all finite sampled fields', () => {
  const invalid = [
    {visible: false}, {visible: undefined}, {visible: 1}, {mode: 'classic'}, {mode: 'anywhere'},
    {mode: 'point'}, {guide: null}, {guide: undefined}, {guide: {}},
    ...['x', 'y', 'rotation'].flatMap(field => [NaN, Infinity, -Infinity, undefined, null, '0'].map(value => ({guide: {x: 1, y: 2, rotation: 0, [field]: value}}))),
    ...[undefined, null, '1', 0, -1, NaN, Infinity, -Infinity, Number.MIN_VALUE].map(scale => ({scale})),
    {guide: {x: Number.MAX_VALUE, y: 0, rotation: 0}, scale: 2},
    {guide: {x: 0, y: -Number.MAX_VALUE, rotation: 0}, scale: 2},
  ];
  for (const options of invalid) {
    const ctx = new RecordingContext();
    assert.equal(draw(ctx, options), false, JSON.stringify(options));
    assert.deepEqual(ctx.calls, [], 'invalid samples must not touch the canvas');
  }
  const ctx = new RecordingContext();
  assert.equal(drawAlternateAimGuide(ctx), false);
  assert.deepEqual(ctx.calls, []);
});

test('point arrow matches real shot velocity in every quadrant and both vertical-axis cases', () => {
  const origin = {x: 350, y: 560};
  const targets = [
    {x: 650, y: 460}, {x: 650, y: 660}, {x: 50, y: 460}, {x: 50, y: 660},
    {x: 350, y: 460}, {x: 350, y: 660}, {x: 650, y: 560}, {x: 50, y: 560},
  ];
  for (const target of targets) for (const powerPercent of [50, 100]) for (const camera of cameras) {
    const shooter = new PointShooter({origin, powerPercent});
    shooter.press(target);
    const shot = shooter.step();
    const ctx = new RecordingContext(camera, 2);
    assert.equal(draw(ctx, {mode: shooter.mode, guide: shooter.guide, scale: camera.scale}), true);
    const [start, end] = ctx.paints[0].path;
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    near((end.x - start.x) / length, shot.vx / shot.speed, 'arrow velocity x');
    near((end.y - start.y) / length, shot.vy / shot.speed, 'arrow velocity y');
    near(length, 33, 'shaft CSS length');
    const onScreen = worldToScreen(camera, origin);
    near(Math.hypot(end.x - onScreen.x, end.y - onScreen.y), 43, 'tip distance from launch point');
    nearPoint(ctx.paints[2].path[0], onScreen);
  }
});

test('zero-vector point guide remains hidden without sanitizing controller state', () => {
  const shooter = new PointShooter({origin: {x: 350, y: 560}});
  shooter.step();
  assert.ok(Number.isNaN(shooter.guide.rotation));
  const ctx = new RecordingContext();
  assert.equal(draw(ctx, {guide: shooter.guide}), false);
  assert.ok(Number.isNaN(shooter.guide.rotation));
  assert.deepEqual(ctx.calls, []);
});

test('renderer uses the retained sampled guide, without resampling a moved pointer', () => {
  const shooter = new PointShooter({origin: {x: 350, y: 560}});
  shooter.move({x: 900, y: 560});
  shooter.step();
  const sampled = {...shooter.guide};
  shooter.move({x: 10, y: 100});
  const ctx = new RecordingContext();
  draw(ctx, {guide: shooter.guide, scale: 1});
  const [start, end] = ctx.paints[0].path;
  assert.ok(end.x > start.x);
  near(end.y, start.y);
  assert.deepEqual(shooter.guide, sampled);
});

test('auto reticle follows actual sampled target with constant CSS radius across camera and DPR', () => {
  const target = {x: 1340, y: 740};
  const shooter = new AutoShooter({origin: {x: 350, y: 560}, solveAngles: () => { throw new Error('renderer must not solve an arc'); }});
  shooter.move(target);
  shooter.step();
  for (const camera of cameras) for (const dpr of [1, 1.5, 2]) {
    const ctx = new RecordingContext(camera, dpr);
    assert.equal(draw(ctx, {mode: shooter.mode, guide: shooter.guide, scale: camera.scale}), true);
    const ring = ctx.paints[0].path[0];
    nearPoint(ring, worldToScreen(camera, target));
    near(ring.radiusX, 9); near(ring.radiusY, 9);
    const centerDot = ctx.paints.at(-1).path[0];
    near(centerDot.radiusX, 1.25); near(centerDot.radiusY, 1.25);
    near(ctx.paints[0].cssLineWidth, 4.5);
    near(ctx.paints[1].cssLineWidth, 1.75);
    assert.equal(ctx.calls.some(call => call.name === 'rotate'), false);
  }
});

test('guides preserve controller state and restore caller transform, styles and dash', () => {
  const freeze = value => {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      for (const child of Object.values(value)) freeze(child);
      Object.freeze(value);
    }
    return value;
  };
  for (const Shooter of [PointShooter, AutoShooter]) {
    const shooter = new Shooter({origin: {x: 350, y: 560}});
    shooter.move({x: 900, y: 440});
    shooter.step();
    const serialized = JSON.stringify(shooter);
    freeze(shooter);
    const ctx = new RecordingContext(cameras[2], 2);
    const previous = structuredClone(ctx.state);
    assert.equal(draw(ctx, {mode: shooter.mode, guide: shooter.guide, scale: cameras[2].scale}), true);
    assert.deepEqual(ctx.state, previous);
    assert.equal(ctx.stack.length, 0);
    assert.equal(JSON.stringify(shooter), serialized);
    assert.ok(ctx.paints.every(paint => paint.state.globalAlpha === 1 && paint.state.dash.length === 0));
  }
});

test('restores canvas state when a paint operation throws', () => {
  const ctx = new RecordingContext();
  const previous = structuredClone(ctx.state);
  ctx.stroke = () => { throw new Error('paint failure'); };
  assert.throws(() => draw(ctx), /paint failure/);
  assert.deepEqual(ctx.state, previous);
  assert.equal(ctx.stack.length, 0);
});

test('blocked Auto reticle has a distinct slash and warning ink without changing its sampled location or CSS size',()=>{
 const target={x:1800,y:100},guide=Object.freeze({...target,rotation:0});
 for(const camera of cameras){
  const ctx=new RecordingContext(camera,2),before=structuredClone(ctx.state);
  assert.equal(draw(ctx,{mode:'auto_aim',guide,scale:camera.scale,blocked:true}),true);
  const ring=ctx.paints[0].path[0];nearPoint(ring,worldToScreen(camera,target));near(ring.radiusX,9);near(ring.radiusY,9);
  assert.ok(ctx.paints.some(p=>p.state.strokeStyle==='#ffab9b'));
  const slash=ctx.paints.find(p=>p.path.length===2&&p.path[0].kind==='move'&&p.path[1].kind==='line');
  near(Math.hypot(slash.path[1].x-slash.path[0].x,slash.path[1].y-slash.path[0].y),Math.hypot(14,14));
  assert.deepEqual(ctx.state,before);assert.equal(ctx.stack.length,0);
 }
});
