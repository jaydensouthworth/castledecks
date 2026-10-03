/** Independently drawn combat feedback. Read-only presentation of existing
 * projectile events, reactive elements and resistance values; no simulation
 * mutations, random draws or new combat decisions. These are original shapes,
 * not recovered Flash artwork or a claim of original-runtime visual parity.
 */
const finitePoint = point => Number.isFinite(point?.x) && Number.isFinite(point?.y);
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = value => Math.max(0, Math.min(1, value));
const viewScale = scale => Number.isFinite(scale) && scale > 0 ? scale : 1;
const ELEMENTS = Object.freeze({
  fire: Object.freeze({body: '#c56837', dark: '#653d2f', light: '#ffe5a0', edge: '#f39b49'}),
  ice: Object.freeze({body: '#77baca', dark: '#355a6a', light: '#e0fbff', edge: '#8edceb'}),
  poison: Object.freeze({body: '#9eae58', dark: '#4c5940', light: '#e5eead', edge: '#c0d567'}),
});
const DRAGONS = Object.freeze({dragon_scout_fire: 'fire', dragon_scout_ice: 'ice', dragon_scout_poison: 'poison'});
const ARROWS = Object.freeze({fire_arrow: 'fire', ice_arrow: 'ice', poison_arrow: 'poison'});

export const dragonElement = unit => DRAGONS[unit?.type] ?? null;

/** A resistance cue describes the live target multiplier, not an invented
 * damage result. Contact events can precede rejection by a full effect queue. */
export function dragonResistanceNotice(event) {
  if (event?.type !== 'projectile-hit' || event.kind !== 'target' || !dragonElement(event.target)) return null;
  const element = ARROWS[event.projectile?.kind], multiplier = event.target.multipliers?.[element];
  if (!element || !Number.isFinite(multiplier) || multiplier === 1 || !finitePoint(event.target)) return null;
  return {kind: 'resistance', element, x: event.target.x, y: event.target.y - finite(event.target.height, 40),
    text: `${element.toUpperCase()} ${multiplier < 1 ? 'RESISTANCE' : 'WEAKNESS'}`,
    tick: event.tick, life: 40};
}

export function elementalNotice(event) {
  if (!Number.isFinite(event?.tick)) return null;
  const resistance = dragonResistanceNotice(event);
  if (resistance) return resistance;
  if (!finitePoint(event)) return null;
  if (event.type === 'critical' || (event.type === 'visual' && event.kind === 'critical-marker'))
    return {kind: 'critical', x: event.x, y: event.y, rotation: finite(event.rotation), tick: event.tick, life: 24};
  if (event.type !== 'visual') return null;
  const waveElement={'fire-wave-trail':'fire','ice-wave-trail':'ice'}[event.kind];
  if(waveElement&&Number.isFinite(event.angle)&&Number.isFinite(event.duration)&&event.duration>0)return {kind:'wave-carrier-trail',element:waveElement,x:event.x,y:event.y,angle:event.angle,tick:event.tick,life:event.duration};
  const element = {'fire_arrow-tracer': 'fire', 'ice_arrow-tracer': 'ice'}[event.kind];
  if (element && Number.isFinite(event.width) && event.width > 0 && Number.isFinite(event.angle) && Number.isFinite(event.duration) && event.duration > 0)
    return {kind: 'elemental-trail', element, x: event.x, y: event.y, angle: event.angle,
      width: event.width, tick: event.tick, life: event.duration};
  return null;
}

function path(ctx, points, fill, stroke, width = 1) {
  ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}
function line(ctx, x, y, x2, y2, color, width = 2) {
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}
function circle(ctx, x, y, radius, color) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
}

/** Returns false for unknown or expired cues, allowing the existing presenter
 * to keep rendering its wave, damage and heal notices unchanged. */
export function drawElementalNotice(ctx, notice, tick, scale = 1) {
  if (!['elemental-trail', 'wave-carrier-trail', 'critical', 'resistance'].includes(notice.kind)) return false;
  const age = tick - notice.tick;
  if (!finitePoint(notice) || age < 0 || !(notice.life > 0) || age >= notice.life) return false;
  const phase = age / notice.life, fade = 1 - phase, screen = viewScale(scale);
  ctx.save(); ctx.translate(notice.x, notice.y);
  if(notice.kind==='wave-carrier-trail'){
    const colors=ELEMENTS[notice.element],size=Math.max(4,1.7/screen)*(1+phase*.8);
    ctx.rotate(notice.angle);ctx.globalAlpha=fade*.65;
    path(ctx,[[-size*2,0],[-size,-size*.7],[size*.6,0],[-size,size*.7]],colors.edge);
    circle(ctx,0,0,size*.4,colors.light);
  } else if (notice.kind === 'elemental-trail') {
    const colors = ELEMENTS[notice.element], half = Math.max(2, .85 / screen) * (1 - phase * .65);
    ctx.rotate(notice.angle); ctx.globalAlpha = fade * .65;
    // The engine supplies precisely the segment from the previous to current
    // projectile position. Do not extend it or compute a new flight path.
    path(ctx, [[-notice.width, 0], [-notice.width * .65, -half], [0, -half * .45], [0, half * .45], [-notice.width * .65, half]], colors.edge);
    ctx.globalAlpha = fade * .85;
    line(ctx, -notice.width * .8, 0, 0, 0, colors.light, Math.max(.7, .65 / screen));
    if (notice.element === 'ice') {
      const x = -notice.width * .5, size = Math.min(half * 1.5, notice.width * .18);
      path(ctx, [[x - size, 0], [x, -size], [x + size, 0], [x, size]], colors.light);
    }
  } else if (notice.kind === 'critical') {
    ctx.scale(1 / screen, 1 / screen); ctx.globalAlpha = fade;
    ctx.rotate(notice.rotation * Math.PI / 180);
    const radius = 7 + Math.sin(Math.PI * Math.min(1, phase * 2)) * 5;
    const points = Array.from({length: 16}, (_, i) => {
      const angle = i * Math.PI / 8, r = i % 2 ? radius * .48 : radius;
      return [Math.cos(angle) * r, Math.sin(angle) * r];
    });
    path(ctx, points, '#ffdc85', '#593a23', 1.5);
    circle(ctx, 0, 0, 3, '#fff7d4');
  } else {
    ctx.scale(1 / screen, 1 / screen); ctx.globalAlpha = Math.min(1, fade * 2);
    const y = -14 - phase * 10;
    ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // Fixed cap avoids measuring text or changing the canvas/font cache in the
    // simulation. The longest cue fits in 132 screen pixels.
    ctx.fillStyle = '#162528e8'; ctx.fillRect(-66, y - 8, 132, 16);
    ctx.fillStyle = ELEMENTS[notice.element].light; ctx.fillText(notice.text, 0, y);
  }
  ctx.restore(); return true;
}

/** Sticky fire/ice uses the actual reactive object's drawn pose and lifetime.
 * The shrinking/dimming end follows its existing dying timer. */
export function drawReactiveElement(ctx, element, scale = 1) {
  const colors = ELEMENTS[element?.element], pose = element?.draw ?? element;
  if (!colors || !element.active || !finitePoint(pose)) return false;
  const screen = viewScale(scale), fade = element.dying ? clamp(element.actionDuration / (element.waitTime || 33)) : 1;
  if (!fade) return false;
  const phase = finite(element.animation?.displayFrame, 1), pulse = Math.sin(phase * .7);
  ctx.save(); ctx.translate(pose.x, pose.y); ctx.scale(Math.max(1, .45 / screen), Math.max(1, .45 / screen));
  ctx.globalAlpha = .18 * fade; circle(ctx, 0, -10, 15, colors.edge);
  ctx.globalAlpha = fade * .94;
  if (element.element === 'fire') {
    const top = -27 - pulse * 3;
    path(ctx, [[-11, 0], [-12, -11], [-7, -19], [-6, -10], [-1, top], [4, -16], [8, -20], [12, -7], [9, 0]], colors.edge);
    path(ctx, [[-5, 0], [-6, -8], [-1, -18 - pulse * 2], [4, -9], [6, 0]], colors.light);
  } else {
    for (const [x, h] of [[-8, 19], [0, 29], [8, 22]]) {
      path(ctx, [[x - 5, 1], [x - 4, -h * .55], [x, -h], [x + 4, -h * .5], [x + 5, 1]], colors.body, colors.light, 1);
      line(ctx, x, 0, x, -h + 3, colors.edge, 1);
    }
  }
  ctx.restore(); return true;
}

/** Local-space dragon art. Strongest contrast stays inside the measured torso
 * and head; translucent wing membranes remain visibly decorative. */
export function drawElementalDragon(ctx, unit, motion = {}) {
  const element = dragonElement(unit);
  if (!element) return false;
  const c = ELEMENTS[element], flap = finite(motion.wingLift, Math.sin(finite(unit.animation?.frame) * .35) * 9), alpha = finite(ctx.globalAlpha, 1);
  ctx.save();
  ctx.globalAlpha = .36 * alpha;
  path(ctx, [[7, -7], [33, -37 - flap], [3, -22], [-14, -35 - flap], [-7, -6]], c.body);
  ctx.globalAlpha = .58 * alpha;
  line(ctx, -6, -6, -14, -35 - flap, c.dark, 1.5); line(ctx, 5, -7, 33, -37 - flap, c.dark, 1.5);
  line(ctx, 18, 11, 40, 19, c.body, 3);
  ctx.globalAlpha = alpha;
  path(ctx, [[26, 7], [10, -11], [-7, -13], [-18, -5], [-27, -2], [-27, 10], [-12, 12], [9, 16]], c.body, c.dark, 1.5);
  path(ctx, [[-12, 8], [-6, -1], [11, 0], [20, 10], [8, 14]], c.dark);
  circle(ctx, -19, 2, 8, c.body); circle(ctx, -23, 0, 2.5, c.light);
  line(ctx, -27, 7, -16, 8, c.dark, 1.5);
  if (element === 'fire') {
    // Tall ember fins and a bright throat distinguish fire without hue alone.
    path(ctx, [[-8, -11], [-7, -22], [-2, -13], [3, -23], [7, -10], [12, -17], [16, -5]], c.edge);
    path(ctx, [[-16, 8], [-11, -1], [-8, 9], [-3, 11], [-12, 12]], c.light);
  } else if (element === 'ice') {
    // Broad crystalline plates and a forked crown.
    path(ctx, [[-7, -11], [-10, -20], [-1, -17], [5, -24], [10, -12], [16, -11], [12, -4]], c.light, c.edge, 1);
    path(ctx, [[-23, -4], [-25, -12], [-19, -7], [-14, -12], [-15, -3]], c.light);
    line(ctx, -4, -12, 9, -3, c.edge, 1.5);
  } else {
    // Rounded venom sacs and a spotted ridge distinguish poison.
    for (const [x, y, r] of [[-4, -12, 4], [6, -10, 4], [14, -4, 3], [-11, 8, 4]]) {
      circle(ctx, x, y, r, c.dark); circle(ctx, x - .7, y - .8, r * .6, c.edge);
    }
    path(ctx, [[-19, 9], [-16, 15], [-14, 9]], c.light);
  }
  ctx.restore(); return true;
}
