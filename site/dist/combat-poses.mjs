/** Original procedural poses for the current JS engine, not recovered SWF art.
 * Engine actions/timers own pose progress. The controller only observes requests
 * and keeps presentation state; the renderer never writes into a unit.
 */
const TYPES = new Set(['grunt', 'tallGrunt', 'archer', 'priest', 'mount', 'hero']);
const REACTIONS = new Set(['die', 'rot', 'knock_back', 'daze', 'get_up_daze', 'flinch']);
const clamp = value => Math.max(0, Math.min(1, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const smooth = value => { const p = clamp(value); return p * p * (3 - 2 * p); };
const mix = (a, b, p) => a + (b - a) * p;
const wrap = value => ((value % 1) + 1) % 1;
const HEIGHTS = Object.freeze({hero: 55, tallGrunt: 60, priest: 36, archer: 40, grunt: 43, mount: 60});
const isWalking = unit => !unit.dead && unit.hp !== 0 && !unit.garrisonBuilding &&
  (unit.type === 'hero' || unit.actionMode === 'move') && Math.abs(finite(unit.vx)) > 0;

/** Original travel-driven walk, independent of the engine's action-frame loops.
 * The support foot moves back exactly one local pixel per world pixel traveled.
 * A short overlap gives two planted feet during each weight transfer. */
export function walkCycle(unit, record = {}) {
  const moving = isWalking(unit), cycle = unit.type === 'mount' ? 52 : (HEIGHTS[unit.type] ?? 43) * .6;
  const distance = finite(record.walkDistance), phase = wrap(distance / cycle);
  return {moving, distance, cycle, phase, bob: moving ? Math.sin(phase * Math.PI * 2) ** 2 * .8 : 0};
}

export function walkFoot(walk, phaseOffset = 0) {
  const phase = wrap(walk.phase + phaseOffset), support = .58, reach = walk.cycle * support / 2;
  if (phase < support) return {x: reach - phase * walk.cycle, y: -2, planted: true};
  const swing = (phase - support) / (1 - support);
  return {x: mix(-reach, reach, smooth(swing)), y: -2 - Math.sin(swing * Math.PI) ** 2 * 3.5,
    planted: false};
}

/** Equal-length two-segment leg. Both segments retain their length in every
 * supported stance; the knee bends instead of changing the limb's scale. */
export function jointedLeg(hip, foot, length) {
  const dx = foot.x - hip.x, dy = foot.y - hip.y;
  const distance = Math.max(.001, Math.hypot(dx, dy));
  const bend = Math.sqrt(Math.max(0, length * length - distance * distance / 4));
  return {hip, knee: {x: (hip.x + foot.x) / 2 + dy / distance * bend,
    y: (hip.y + foot.y) / 2 - dx / distance * bend}, foot};
}

export function personRig(pose, height, rider = false) {
  const walking = !rider && pose.walk?.moving && !pose.dead && !pose.down;
  const legHeight = height * .4, length = rider ? legHeight * .67 : (legHeight - 2) * .54;
  const knee = 3 * pose.crouch;
  const rear = walking ? walkFoot(pose.walk, .5) : {x:rider ? -8 : -3 + knee, y:-2};
  const front = walking ? walkFoot(pose.walk) : {x:rider ? 8 : 4 - knee, y:-2};
  const hipXs = [-.75,.75], feet = [rear,front];
  let hipY = -legHeight + 5 * pose.crouch;
  if (walking) {
    // Let the pelvis rise over the support foot. The grounded leg stays nearly
    // straight while the free knee bends, avoiding a permanent crouched march.
    hipY = Math.max(...feet.map((foot,index) => foot.y -
      Math.sqrt(Math.max(1, (2 * length - .3) ** 2 - (foot.x-hipXs[index]) ** 2))));
  }
  return {hipY, bodyY:hipY + legHeight - 5 * pose.crouch, length,
    legs:feet.map((foot,index) => jointedLeg({x:hipXs[index],y:hipY},foot,length))};
}
// 10 ticks outlast the UI's largest capped catch-up batch (at most 9 ticks).
export const POSE_CUE_TICKS = Object.freeze({strike: 10, release: 10, cast: 9, hurt: 4, heroCollapse: 12});
export const supportsCombatPose = unit => TYPES.has(unit?.type);

/** Attack rate is captured by the engine on entry. Current speedFactor can be
 * changed by ice during an action, so it must not be used to reconstruct D. */
export function actionSpan(unit) {
  const mode = unit.actionMode, rate = unit.animation?.rate;
  if (mode === 'attack' && rate > 0) return (unit.type === 'mount' ? 22 : unit.type === 'archer' ? 31 : 12) / rate;
  if (mode === 'die') return ['archer', 'mount'].includes(unit.type) ? 24 : 36;
  if (mode === 'load_arrow') return finite(unit.shotLoadTime, 60);
  if (mode === 'aim') return finite(unit.shotAimTime, 1);
  if (mode === 'release_arrow') return finite(unit.releaseTime, 33);
  return ({block: 30, knock_back: 11, daze: 240, get_up_daze: 96,
    flinch: 9, rot: 100, heal: 34, purge: 34, pickup_friend_flag: 36,
    pickup_enemy_flag: 36, capture_flag: 36})[mode] ?? Math.max(1, finite(unit.actionDuration, 1));
}

const pulseStrength = (record, kind) => record.pulse?.kind === kind
  ? 1 - clamp(record.pulse.age / POSE_CUE_TICKS[kind]) : 0;

/** Pure state-to-pose function. record and shooter are read-only inputs. */
export function combatPose(unit, record = {}, shooter = null) {
  const hero = unit.type === 'hero', mode = unit.actionMode ?? (unit.vx ? 'move' : 'idle');
  const duration = record.animation === unit.animation && record.mode === mode
    ? record.duration : actionSpan(unit);
  const progress = clamp(1 - finite(unit.actionDuration, duration) / Math.max(1, duration));
  const walk = walkCycle(unit, record), gait = walk.moving ? Math.sin(walk.phase * Math.PI * 2) : 0;
  const pose = {mode, progress, gait, walk, down: 0, lean: 0, crouch: 0, windup: 0, strike: 0,
    guard: mode === 'block', bowDraw: 0, bowRelease: 0, nocked: false, aimAngle: 0,
    casting: 0, castBurst: 0, castKind: mode, flag: mode.includes('flag'),
    dead: mode === 'die' || mode === 'rot' || unit.hp <= 0 || !!unit.dead,
    hurt: pulseStrength(record, 'hurt'), alpha: 1};

  // Death takes priority over stale knockedDown and short-lived action cues.
  if (hero && pose.dead) {
    pose.down = smooth(finite(record.heroDeathAge) / POSE_CUE_TICKS.heroCollapse);
    pose.crouch = Math.sin(pose.down * Math.PI) * .25;
    pose.alpha = mix(1, .75, pose.down);
    return pose;
  }
  if (mode === 'die') {
    pose.down = mix(finite(record.deathFromDown), 1, smooth(progress));
    pose.crouch = Math.sin(progress * Math.PI) * .25;
    pose.alpha = mix(1, .75, progress);
    return pose;
  }
  if (mode === 'rot' || pose.dead) { pose.down = 1; pose.alpha = .75; return pose; }
  if (mode === 'knock_back') { pose.down = smooth(progress); pose.lean = -.15 * (1 - pose.down); return pose; }
  if (mode === 'daze') { pose.down = 1; return pose; }
  if (mode === 'get_up_daze') {
    pose.down = 1 - smooth(progress); pose.crouch = Math.sin(progress * Math.PI) * .6; return pose;
  }
  if (mode === 'flinch') { pose.lean = -.26 * Math.sin(Math.PI * Math.max(.12, progress)); return pose; }

  pose.strike = pulseStrength(record, 'strike');
  pose.windup = mode === 'attack' ? smooth(progress) : 0;
  pose.lean = -.1 * pose.windup + .16 * pose.strike;
  pose.bowRelease = pulseStrength(record, 'release');
  if (unit.type === 'archer') {
    if (mode === 'load_arrow') { pose.bowDraw = smooth(progress); pose.nocked = progress > .15; }
    if (mode === 'aim' || (mode === 'release_arrow' && !unit.fired)) { pose.bowDraw = 1; pose.nocked = true; }
    if (mode === 'release_arrow' && unit.fired) pose.bowRelease = Math.max(pose.bowRelease, 1 - progress);
  }
  if (hero && shooter?.holding && shooter.active?.aim) {
    const aim = shooter.active.aim;
    pose.bowDraw = clamp(finite(aim.power)); pose.nocked = true;
    if (Math.hypot(finite(aim.vx), finite(aim.vy)) > 0)
      pose.aimAngle = Math.max(-1.25, Math.min(1.25, Math.atan2(aim.vy, aim.vx * (unit.facing ?? 1))));
  }
  if (pose.bowRelease > 0) { pose.bowDraw = 0; pose.nocked = false; }
  if (mode === 'heal' || mode === 'purge') pose.casting = smooth(progress);
  pose.castBurst = pulseStrength(record, 'cast');
  if (pose.castBurst) { pose.casting = Math.max(pose.casting, pose.castBurst); pose.castKind = record.pulse.effect; }
  if (pose.flag) { pose.crouch = .25 * Math.sin(progress * Math.PI); pose.guard = false; }
  return pose;
}

/** Install once per battle. Calls original service exactly once, with its this,
 * arguments, return and exception behavior intact. Only supported troop request
 * hooks are wrapped, not transition(), step(), damage, RNG or geometry methods.
 * Call observeTick after EACH battle.step; pass the actor-running state captured
 * BEFORE step, because an outcome may be declared during that active tick. */
export function createCombatPoseController() {
  const records = new WeakMap();
  let battle = null, lastTick = 0;
  const mark = (unit, kind, extra = {}) => {
    const record = records.get(unit);
    if (record) record.pulse = {kind, age: 0, fresh: true, ...extra};
  };
  function track(unit) {
    if (!supportsCombatPose(unit) || records.has(unit)) return;
    const record = {animation: unit.animation, mode: unit.actionMode, duration: actionSpan(unit),
      generation: 0, lastX: finite(unit.x), lastVx: finite(unit.vx), wasWalking: isWalking(unit),
      walkDistance: 0, wasDead: false,
      heroDeathAge: 0, deathFromDown: unit.knockedDown ? 1 : 0, pulse: null};
    records.set(unit, record);
    record.lastPose = combatPose(unit, record, battle?.shooter);
    if (unit.type === 'hero') return;
    for (const [key, kind] of [['queueImpact', 'strike'], ['queueProjectile', 'release'], ['queueEffect', 'cast']]) {
      const original = unit.services?.[key];
      if (typeof original !== 'function') continue;
      unit.services[key] = function (...args) {
        const result = original.apply(this, args), request = args[0];
        if (request?.source === unit &&
          ((kind === 'strike' && unit.actionMode === 'attack') ||
           (kind === 'release' && unit.actionMode === 'release_arrow') ||
           (kind === 'cast' && ['heal', 'purge'].includes(unit.actionMode))))
          mark(unit, kind, {effect: request.kind});
        return result;
      };
    }
  }
  function observeUnit(unit, actorsAdvanced, elapsed) {
    track(unit);
    const record = records.get(unit);
    if (!record) return;
    if (unit.animation !== record.animation || unit.actionMode !== record.mode) {
      if (unit.actionMode === 'die') record.deathFromDown = record.lastPose?.down ?? (unit.knockedDown ? 1 : 0);
      record.animation = unit.animation; record.mode = unit.actionMode;
      record.duration = actionSpan(unit); record.generation++;
      if (REACTIONS.has(unit.actionMode)) record.pulse = null;
    }
    if (actorsAdvanced) {
      const distance = Math.abs(finite(unit.x) - record.lastX);
      // Garrison changes and placement/teleport jumps are not footsteps. Preserve
      // phase through repeated move actions and count a final moving tick even
      // when the engine enters attack at the end of that tick.
      if ((isWalking(unit) || record.wasWalking) && unit.visible !== false && !unit.garrisonBuilding &&
          distance <= Math.max(4, Math.abs(finite(unit.vx)), Math.abs(record.lastVx)) * Math.max(1, elapsed) * 1.5)
        record.walkDistance += distance;
      if (record.pulse) {
        if (record.pulse.fresh) record.pulse.fresh = false;
        else record.pulse.age += elapsed;
      }
    }
    record.lastX = finite(unit.x);
    record.lastVx = finite(unit.vx); record.wasWalking = isWalking(unit);
    const dead = unit.hp <= 0 || !!unit.dead;
    if (unit.type === 'hero') {
      // Hero has no mechanical die duration. This 12-tick visual collapse can
      // continue through the summary countdown; it never delays the outcome.
      record.heroDeathAge = dead ? record.wasDead ? record.heroDeathAge + elapsed : 0 : 0;
      record.wasDead = dead;
    }
    record.lastPose = combatPose(unit, record, battle?.shooter);
  }
  return {
    attach(nextBattle) {
      battle = nextBattle; lastTick = battle.tick;
      for (const unit of [...battle.goodTeam, ...battle.badTeam]) track(unit);
    },
    event(event) {
      if (event.type === 'spawn') track(event.unit);
      if (event.type === 'shot' && battle?.hero) mark(battle.hero, 'release');
      if (event.type === 'damage' && event.target?.type === 'hero' && event.damage > 0) mark(event.target, 'hurt');
    },
    observeTick({actorsAdvanced = true} = {}) {
      if (!battle) return;
      const elapsed = Math.max(0, battle.tick - lastTick); lastTick = battle.tick;
      for (const unit of [...battle.goodTeam, ...battle.badTeam]) observeUnit(unit, actorsAdvanced && elapsed > 0, elapsed);
    },
    pose(unit) { return combatPose(unit, records.get(unit), battle?.shooter); },
    draw(ctx, unit) { return supportsCombatPose(unit) ? drawCombatTroop(ctx, unit, this.pose(unit)) : false; },
  };
}

function line(ctx, x1, y1, x2, y2, color, width = 3) {
  ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}
function circle(ctx, x, y, radius, color) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
}
function poly(ctx, points, color) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.closePath(); ctx.fill();ctx.strokeStyle='#1c2c31';ctx.lineWidth=1.4;ctx.stroke();
}

function drawBow(ctx, pose, shoulderY, palette) {
  const x = 17 + 8 * pose.strike - 2 * pose.bowRelease, y = shoulderY + 6;
  const backX = x - 4 - 13 * pose.bowDraw;
  line(ctx, -3, shoulderY, backX - 3, y + 5, palette.dark, 4);
  line(ctx, backX - 3, y + 5, backX, y, palette.skin, 3);
  line(ctx, 4, shoulderY, x, y, palette.skin, 3);
  ctx.save(); ctx.translate(x, y); ctx.rotate(pose.aimAngle);
  ctx.strokeStyle = palette.wood; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(0, -14); ctx.quadraticCurveTo(13, 0, 0, 14); ctx.stroke();
  line(ctx, 0, -14, backX - x, 0, palette.metal, 1);
  line(ctx, backX - x, 0, 0, 14, palette.metal, 1);
  if (pose.nocked) {
    line(ctx, backX - x, 0, 14, 0, palette.wood, 1.5);
    poly(ctx, [[17, 0], [12, -2.5], [12, 2.5]], palette.metal);
  }
  ctx.restore();
}

function drawWeapon(ctx, unit, pose, shoulderY, palette) {
  const priest = unit.type === 'priest', tall = unit.type === 'tallGrunt';
  const cast = Math.max(pose.casting, pose.castBurst);
  const handX = mix(12 - 10 * pose.windup, 24, pose.strike) + cast * 2;
  const handY = shoulderY + mix(10 - 8 * pose.windup, 12, pose.strike) - 10 * cast;
  const angle = mix(-Math.PI / 2 - .95 * pose.windup, .15, pose.strike) + .3 * cast;
  const length = priest ? 31 : tall ? 30 : 25;
  const tipX = handX + Math.cos(angle) * length, tipY = handY + Math.sin(angle) * length;
  line(ctx, 4, shoulderY, handX, handY, palette.skin, 3);
  line(ctx, handX - Math.cos(angle) * 9, handY - Math.sin(angle) * 9, tipX, tipY, palette.dark, priest ? 4 : 4.5);
  line(ctx, handX - Math.cos(angle) * 9, handY - Math.sin(angle) * 9, tipX, tipY, priest ? palette.wood : palette.metal, priest ? 3 : 3.5);
  if (priest) {
    circle(ctx, tipX, tipY, 3.5, '#d6dfaa');
    if (cast > 0) {
      ctx.save(); ctx.globalAlpha *= .3 + .7 * Math.max(cast, pose.castBurst);
      const tint = pose.castKind === 'purge' ? '#b6d5e0' : '#e4dfa0';
      ctx.strokeStyle = tint; ctx.lineWidth = 1.5; ctx.beginPath();
      ctx.arc(tipX, tipY, 5 + 7 * pose.castBurst, 0, Math.PI * 2); ctx.stroke();
      line(ctx, tipX - 7, tipY, tipX + 7, tipY, tint, 1.5);
      line(ctx, tipX, tipY - 7, tipX, tipY + 7, tint, 1.5); ctx.restore();
    }
  } else {
    const sideX = -Math.sin(angle), sideY = Math.cos(angle);
    if (tall) poly(ctx, [[tipX, tipY], [tipX + sideX * 11, tipY + sideY * 11],
      [tipX - Math.cos(angle) * 12 + sideX * 10, tipY - Math.sin(angle) * 12 + sideY * 10],
      [tipX - Math.cos(angle) * 12, tipY - Math.sin(angle) * 12]], palette.metal);
    line(ctx, handX - sideX * 4, handY - sideY * 4, handX + sideX * 4, handY + sideY * 4, palette.dark, 2);
    const shieldX = mix(pose.guard ? 8 : -12, 8, pose.down), shieldY = shoulderY + (pose.guard ? 8 : 15);
    line(ctx, -5, shoulderY, shieldX, shieldY, palette.skin, 3);
    const sw=tall?10:7;poly(ctx,[[shieldX-sw,shieldY-sw],[shieldX+sw,shieldY-sw],[shieldX+sw*.8,shieldY+sw*.45],[shieldX,shieldY+sw*1.25],[shieldX-sw*.8,shieldY+sw*.45]],palette.cloth);line(ctx,shieldX,shieldY-sw+2,shieldX,shieldY+sw*.8,palette.gold,2);line(ctx,shieldX-sw+2,shieldY-2,shieldX+sw-2,shieldY-2,palette.gold,2);
  }
}

function drawLeg(ctx, leg, palette, front = true) {
  for (const [color, width] of [[palette.edge, 5.5], [front ? palette.dark : palette.edge, 3.4]]) {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
    ctx.moveTo(leg.hip.x, leg.hip.y); ctx.lineTo(leg.knee.x, leg.knee.y);
    ctx.lineTo(leg.foot.x, leg.foot.y); ctx.stroke();
  }
  line(ctx, leg.foot.x - 1, leg.foot.y, leg.foot.x + 3, leg.foot.y, palette.edge, 4);
}

function drawPerson(ctx, unit, pose, height, palette, rider = false) {
  ctx.save(); ctx.translate(0, -8 * pose.down);
  ctx.rotate(pose.lean - Math.PI / 2 * pose.down);
  const rig = personRig(pose,height,rider), headY = -height + 7 + 8 * pose.crouch + rig.bodyY;
  const shoulderY = headY + 9, hipY = rig.hipY;
  const gait = pose.gait * (1 - pose.down);
  drawLeg(ctx,rig.legs[0],palette,false);drawLeg(ctx,rig.legs[1],palette);
  if(['hero','archer','priest'].includes(unit.type))poly(ctx,[[-8,shoulderY-3],[-13,shoulderY+8],[-17-gait*2,hipY+10],[-4,hipY+4],[4,shoulderY]],palette.dark);
  poly(ctx,[[-8,shoulderY-2],[8,shoulderY-2],[11,hipY],[-10,hipY]],palette.cloth);
  poly(ctx,[[1,shoulderY-1],[8,shoulderY],[10,hipY],[1,hipY]],palette.light);
  line(ctx,-7,hipY-2,9,hipY-2,palette.dark,4);line(ctx,2,shoulderY+2,2,hipY-4,palette.gold,2);
  if(unit.type==='priest')poly(ctx,[[-7,shoulderY+5],[8,shoulderY+5],[11,-6+rig.bodyY],[-11,-6+rig.bodyY]],palette.cloth);
  if(unit.type==='tallGrunt'){poly(ctx,[[-11,shoulderY],[-8,shoulderY-6],[-1,shoulderY-4],[-1,shoulderY+4]],palette.metal);poly(ctx,[[3,shoulderY-4],[11,shoulderY-5],[14,shoulderY+2],[4,shoulderY+5]],palette.metal);}
  circle(ctx,0,headY,6,palette.edge);circle(ctx,1,headY,4.7,palette.skin);
  const hood=['hero','archer','priest'].includes(unit.type);
  poly(ctx,[[-6,headY+1],[-6,headY-5],[0,headY-8],[6,headY-4],[6,headY-1]],hood?palette.cloth:palette.metal);
  line(ctx,-5,headY-3,5,headY-3,hood?palette.light:palette.gold,1.7);
  line(ctx,5,headY,7,headY+1,palette.skin,2);
  if(unit.type==='tallGrunt')line(ctx,4,headY-2,4,headY+5,palette.metal,2);
  if(unit.type==='priest'){poly(ctx,[[-7,headY-3],[0,headY-15],[7,headY-3]],palette.metal);line(ctx,0,headY-11,0,headY-3,palette.gold,2);}
  if (unit.type === 'archer' || unit.type === 'hero') drawBow(ctx, pose, shoulderY, palette);
  else drawWeapon(ctx, unit, pose, shoulderY, palette);
  if (pose.flag) line(ctx, -5, shoulderY, 13, shoulderY + 9 - 12 * pose.progress, palette.skin, 3);
  if (pose.hurt > 0 && !pose.dead) {
    ctx.globalAlpha *= pose.hurt * .5;
    circle(ctx, 0, shoulderY + 4, 10, '#fff0c2');
  }
  ctx.restore();
}

function drawMount(ctx, unit, pose, palette) {
  const down = pose.down, walking = pose.walk?.moving && !pose.dead && !down;
  const y = -22 + 14 * down + (walking ? pose.walk.bob : 0), gait = pose.gait * (1 - down);
  const horse = unit.team === 'good' ? '#bdad85' : '#a28b66';
  // Four staggered contacts make a walking mount rather than two legs spreading
  // apart in unison. Hooves remain at ground level during their support phase.
  for (const [legX, offset, front] of [[-16, .5, false], [16, .75, false], [-16, 0, true], [16, .25, true]]) {
    const step = walking ? walkFoot(pose.walk, offset) : {x: legX < 0 ? -4 : 4, y: -2};
    const foot = {x: mix(legX + step.x, Math.sign(legX) * 29, down), y: mix(step.y, -3, down)};
    drawLeg(ctx, jointedLeg({x: legX, y: y + 3}, foot, 12.2), palette, front);
  }
  ctx.fillStyle = horse; ctx.beginPath(); ctx.ellipse(0, y, 25, 11 - down * 4, 0, 0, Math.PI * 2); ctx.fill();
  poly(ctx, [[17, y - 3], [29 + down * 5, y - 23 + down * 17],
    [38, y - 18 + down * 14], [31, y + 2]], horse);
  line(ctx, -22, y - 2, -33, y + 4 + gait * 3, palette.dark, 3);
  circle(ctx, 34, y - 17 + down * 15, 1.5, palette.dark);
  ctx.save(); ctx.translate(-2, -26 + down * 17 + (walking ? pose.walk.bob : 0));
  drawPerson(ctx, unit, {...pose, down: down * .8, gait: 0}, 35, palette, true); ctx.restore();
}

/** Handles all supported units, including invisible/garrisoned units. Existing
 * renderer remains responsible for siege, air units, demons and boss geometry. */
export function drawCombatTroop(ctx, unit, pose = combatPose(unit)) {
  if (!supportsCombatPose(unit)) return false;
  if (!unit.visible || !Number.isFinite(unit.x) || !Number.isFinite(unit.y)) return true;
  const good = unit.team === 'good';
  const palette = {cloth:good?'#548d9b':'#a45d59',dark:good?'#284951':'#572f37',light:good?'#a2c3bd':'#d3987e',edge:'#1b2c31',gold:'#d4b778',metal:'#bfbeab',skin:'#dcc59f',wood:'#bca578'};
  const height = HEIGHTS[unit.type];
  ctx.save();ctx.globalAlpha*=.22*pose.alpha;ctx.beginPath();ctx.ellipse(unit.x,unit.y+1,unit.type==='mount'?30:15,3,0,0,Math.PI*2);ctx.fillStyle='#162827';ctx.fill();ctx.restore();
  ctx.save(); ctx.translate(unit.x, unit.y);
  ctx.rotate(finite(unit.collisionRotation ?? unit.rotation) * Math.PI / 180);
  ctx.scale(unit.facing ?? 1, 1); ctx.globalAlpha *= pose.alpha;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (unit.type === 'mount') drawMount(ctx, unit, pose, palette);
  else drawPerson(ctx, unit, pose, height, palette);
  ctx.restore();
  if (unit.type !== 'hero' && unit.type !== 'mount' && !pose.dead && unit.hp<unit.maxHp) {
    ctx.save(); ctx.fillStyle = '#253124'; ctx.fillRect(unit.x - 14, unit.y - height - 11, 28, 3);
    ctx.fillStyle = good ? '#94c7cc' : '#d29a78';
    ctx.fillRect(unit.x - 14, unit.y - height - 11, 28 * clamp(unit.hp / Math.max(1, unit.maxHp)), 3); ctx.restore();
  }
  return true;
}
