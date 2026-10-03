/** Presentation adaptation only. All simulation coordinates remain unchanged. */
export const WORLD_WIDTH = 2000;
export const WORLD_HEIGHT = 1000;
export const OVERVIEW_HEIGHT = 850;

const positiveFinite = value => typeof value === 'number' && Number.isFinite(value) && value > 0;

/** CSS-pixel camera. Invalid or hidden measurements yield a non-renderable identity. */
export function createWorldCamera(width, height) {
  let renderable = positiveFinite(width) && positiveFinite(height);
  let scale = renderable ? Math.min(width / WORLD_WIDTH, height / OVERVIEW_HEIGHT) : 1;
  let offsetX = renderable ? width / 2 - WORLD_WIDTH / 2 * scale : 0;
  let offsetY = renderable ? height / 2 - WORLD_HEIGHT / 2 * scale : 0;
  // Also reject underflow/overflow in otherwise finite, non-browser-sized input.
  renderable &&= positiveFinite(scale) && Number.isFinite(offsetX) && Number.isFinite(offsetY)
    && Number.isFinite(width / scale) && Number.isFinite(height / scale);
  if (!renderable) {
    width = WORLD_WIDTH;
    height = WORLD_HEIGHT;
    scale = 1;
    offsetX = offsetY = 0;
  }
  return Object.freeze({width, height, scale, offsetX, offsetY, renderable});
}

/** Input/output points are canvas-local CSS pixels, never backing-store pixels. */
export function worldToScreen(camera, point) {
  return {x: point.x * camera.scale + camera.offsetX, y: point.y * camera.scale + camera.offsetY};
}

export function screenToWorld(camera, point) {
  return {x: (point.x - camera.offsetX) / camera.scale, y: (point.y - camera.offsetY) / camera.scale};
}

export function visibleWorldBounds(camera) {
  const left = -camera.offsetX / camera.scale;
  const top = -camera.offsetY / camera.scale;
  const right = (camera.width - camera.offsetX) / camera.scale;
  const bottom = (camera.height - camera.offsetY) / camera.scale;
  return {left: left || 0, top: top || 0, right, bottom, width: right - left, height: bottom - top};
}

/**
 * Bound rendering cost, retaining exact CSS alignment after integer rounding.
 * Use pixelRatioX/Y for ctx.setTransform, not requestedDpr or a rounded DPR.
 * The dimensions are backing-store pixels. CSS canvas size stays 100% × 100%.
 */
export function getBackingStoreSize(camera, requestedDpr = 1) {
  if (!camera.renderable) return {width: 1, height: 1, pixelRatioX: 1, pixelRatioY: 1, renderable: false};
  const dpr = positiveFinite(requestedDpr) ? requestedDpr : 1;
  const ratio = Math.min(dpr, 2, 4096 / camera.width, 4096 / camera.height);
  const width = Math.max(1, Math.min(4096, Math.round(camera.width * ratio)));
  const height = Math.max(1, Math.min(4096, Math.round(camera.height * ratio)));
  return {width, height, pixelRatioX: width / camera.width, pixelRatioY: height / camera.height, renderable: true};
}

/**
 * Extend decorative ground to the viewport with one CSS pixel of overscan.
 * Interior samples are copied exactly; only rendering endpoints are extended.
 * Never pass this polygon to the physics HeightField or use it for collision.
 */
export function extendTerrainForCamera(samples, camera, interval = 20) {
  if (!samples?.length || !positiveFinite(interval) || !Array.from(samples).every(Number.isFinite)) {
    throw new TypeError('Terrain rendering requires finite height samples and a positive interval');
  }
  const bounds = visibleWorldBounds(camera);
  const bleed = 1 / camera.scale;
  const lastX = (samples.length - 1) * interval;
  const left = Math.min(0, bounds.left) - bleed;
  const right = Math.max(WORLD_WIDTH, lastX, bounds.right) + bleed;
  const bottom = Math.max(WORLD_HEIGHT, bounds.bottom, ...samples) + bleed;
  const surface = [[left, samples[0]], ...Array.from(samples, (y, i) => [i * interval, y]), [right, samples[samples.length - 1]]];
  return {surface, polygon: [...surface, [right, bottom], [left, bottom]]};
}
