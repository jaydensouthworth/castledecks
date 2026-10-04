/** Deterministic engine evidence only: not native/human balance acceptance.
 * Production stats, cooldowns, resources, AI and outcomes are never overridden.
 * Named standalone fixtures author terrain/roster and supplied castle ownership.
 */
import {FirstBattle, prepareCastleSelection} from '../site/dist/engine/first-battle.mjs';
import {PlayerProfile, summonSquad} from '../site/dist/engine/progression.mjs';
import {seededRandom} from '../site/dist/engine/combat.mjs';
import {SkirmishBattle, createSkirmishProfile} from '../site/dist/skirmish-battle.mjs';
import {DEFAULT_CASTLE_PRACTICE, createSkirmish} from '../site/dist/skirmish-model.mjs';

export const MATCHED_SCHEDULE = Object.freeze([
  [0, 'grunt'], [0, 'trebuchet'], [0, 'priest'], [0, 'archer'],
  [330, 'grunt'], [330, 'priest'], [330, 'archer'],
  [660, 'grunt'], [660, 'priest'], [660, 'archer'],
].map(Object.freeze));

function fixture({castleId, heights = Array(101).fill(700), roster = ['grunt'], name}) {
  const profile = new PlayerProfile('Standalone castle evidence');
  // Fixture supplies a castle choice only. All rank/economy/skill defaults stay intact.
  profile.castleLevels.set('highwatch', 1); profile.castleId = castleId;
  return new FirstBattle({profile, random: seededRandom(73421), encounter: {
    id: name, scenery: 'oaks', timeOfDay: 'noon', heights, roster,
    towers: [], enemyKeepHP: 6000, objective: 'break-keep',
  }});
}

export function manualCrest(castleId, dragY = 59) {
  const heights = Array.from({length: 101}, (_, i) =>
    700 - 310 * Math.max(0, 1 - Math.abs(i * 20 - 950) / 240));
  const b = fixture({castleId, heights, name: 'castle-balance70-manual-crest'});
  // Let the ordinary starter Basic cooldown reach readiness through real ticks.
  for (let i = 0; i < 30; i++) b.step();
  const origin = {...b.hero.launchPosition};
  const pointer = {x: origin.x - 158, y: origin.y + dragY};
  b.shooter.press(origin); b.step();
  b.shooter.move(pointer); b.step();
  b.shooter.release(pointer); b.step();
  const shot = b.projectiles.at(-1);
  const launch = {origin: {...shot.previous}, vx: shot.vx, vy: shot.vy};
  let ridge = null;
  for (let i = 0; i < 120; i++) {
    b.step();
    if (!ridge && shot.x >= 950) ridge = {x: shot.x, y: shot.y, terrain: b.elevationAt(shot.x), active: shot.active};
  }
  return {castleId, drag: [-158, dragY], launch, ridge,
    reason: shot.reason, last: {x: shot.x, y: shot.y},
    enemyKeepDamage: b.badCastle.maxHp - b.badCastle.hp,
    shots: b.stats.shotsFired, goldSpent: b.stats.goldSpent, goldEarned: b.stats.goldEarned,
    tick: b.tick, protectedTesting: b.protectedTesting};
}

export function siegeShelter(castleId) {
  const b = fixture({castleId, roster: ['trebuchet'], name: 'castle-balance70-natural-siege'});
  let destroyedAt = null, exposedAt = null, firstDamageAt = null, damageHits = 0;
  b.onEvent = event => {
    if (event.type === 'damage' && event.target === b.goodCastle) {
      firstDamageAt ??= event.tick; damageHits++;
    }
    if (event.type === 'castle-destroyed' && event.castle === b.goodCastle) destroyedAt = event.tick;
  };
  let at10318 = null;
  while (b.tick < 30000 && !b.outcome) {
    b.step();
    if (!b.hero.garrisoned()) exposedAt ??= b.tick;
    if (b.tick === 10318) at10318 = {homeKeepHP: b.goodCastle.hp, heroHP: b.hero.hp, sheltered: b.hero.garrisoned()};
  }
  return {castleId, startHP: b.goodCastle.maxHp, destroyedAt, exposedAt,
    firstDamageAt, damageHits, at10318, outcome: b.outcome, tick: b.tick,
    heroHP: b.hero.hp, goldSpent: b.stats.goldSpent, shots: b.stats.shotsFired};
}

/** Explicitly staged positions, not a claim about optional scenario behavior.
 * Three finite-roster ordinary archers and one paid rider begin near the keep.
 * No garrison call is made: real chooseNextAction decides every admission.
 */
export function stagedGallery(castleId) {
  const profile = createSkirmishProfile(createSkirmish(DEFAULT_CASTLE_PRACTICE));
  const b = new FirstBattle({profile, level: 6, random: seededRandom(73421), encounter: {
    id: 'castle-balance70-staged-gallery', scenery: 'oaks', timeOfDay: 'noon',
    heights: Array(101).fill(700), roster: ['archer', 'archer', 'archer'], towers: [],
    enemyKeepHP: 6000, enemyCastle: {id: castleId, level: 1}, objective: 'break-keep',
  }});
  const archers = [];
  for (let i = 0; i < 3; i++) {
    const archer = b.createUnit(b.enemies.take('archer'));
    archer.x = 1800; archer.y = b.elevationAt(1800); b.updateGeometry(archer);
    archers.push(archer);
  }
  const skill = profile.skills.find(s => s.id === 'mount');
  const paid = summonSquad(skill, profile, b.friendlyQueue, b.stats);
  const ticket = b.friendlyQueue.step(b.regularArmyCount);
  const rider = b.createUnit(ticket.type, {team: 'good', rank: ticket.rank, skill: ticket.skill});
  rider.x = 1300; rider.y = b.elevationAt(1300); b.updateGeometry(rider);
  const galleryShots = [], originalProjectile = b.queueProjectile.bind(b);
  b.queueProjectile = request => {
    if (request.source?.garrisonBuilding === b.badCastle) {
      galleryShots.push({tick: b.tick, x: request.x, y: request.y, damage: request.impactDamage});
    }
    return originalProjectile(request);
  };
  b.step();
  const first = {occupancy: b.badCastle.occupants.length,
    exposedArchers: archers.filter(a => a.canGetHit).length};
  let peak = first.occupancy;
  while (b.tick < 601 && !b.outcome) {b.step(); peak = Math.max(peak, b.badCastle.occupants.length);}
  return {castleId, stagedPositions: {enemyArchers: 1800, paidRider: 1300},
    paid, goldSpent: b.stats.goldSpent, reserveSpent: 70 - b.friendlyQueue.population,
    finiteEnemyReserve: b.enemies.remaining, first, peak, galleryShots,
    riderHP: rider.hp, tick: b.tick, outcome: b.outcome ?? 'observation-only'};
}

export function matchedScenario({castleId, plan = 'army', descriptor = DEFAULT_CASTLE_PRACTICE, limit = 30000} = {}) {
  const actors = [];
  const b = new SkirmishBattle({descriptor, shootingMode: 'auto_aim', onEvent: e => {
    if (e.type === 'spawn') actors.push(e.unit);
  }});
  if (castleId !== b.profile.castleId) {
    b.profile.castleId = castleId;
    prepareCastleSelection(b, {id: castleId, level: 1}, {started: false, profile: b.profile}).apply();
  }
  b.shooter.angleMode = 0;
  const initial = {rank: b.profile.rank, gold: b.profile.gold, reserve: b.friendlyQueue.population,
    skills: b.profile.skills.map(s => [s.id, s.rank, s.cooldown]),
    friendlyHP: b.goodCastle.hp, enemyHP: b.badCastle.hp,
    enemyGarrison: b.badCastle.occupants.length, heroHP: b.hero.hp};
  const target = {x: 1800, y: b.badCastle.y - 110};
  const receipts = []; let homePeak = b.goodCastle.occupants.length, enemyPeakAfterOpening = 0;
  let homeArcherTicks = 0, enemyGarrisonTicksAfterOpening = 0, enemyGalleryShots = 0;
  let homeGalleryShots = 0, peakActors = b.goodTeam.length + b.badTeam.length, peakObjects = b.objects.items.length;
  let enemyKeepDownAt = null, homeKeepDownAt = null;
  const originalProjectile = b.queueProjectile.bind(b);
  b.queueProjectile = request => {
    if (request.source?.type === 'archer') {
      if (request.source.garrisonBuilding === b.badCastle) enemyGalleryShots++;
      if (request.source.garrisonBuilding === b.goodCastle) homeGalleryShots++;
    }
    return originalProjectile(request);
  };
  while (b.tick < limit && !b.outcome) {
    const t = b.tick;
    if (plan !== 'bow-auto') for (const [at, id] of MATCHED_SCHEDULE) if (at === t) {
      const skill = b.profile.skills.find(s => s.id === id);
      const accepted = summonSquad(skill, b.profile, b.friendlyQueue, b.stats);
      receipts.push({tick: t, id, accepted});
    }
    if (plan !== 'army') {
      if (t % 32 === 0) b.shooter.press(target);
      if (t % 32 === 1) b.shooter.release();
    }
    b.step();
    homePeak = Math.max(homePeak, b.goodCastle.occupants.length);
    if (b.goodCastle.occupants.some(u => u.type === 'archer')) homeArcherTicks++;
    if (b.tick > 1) {
      enemyPeakAfterOpening = Math.max(enemyPeakAfterOpening, b.badCastle.occupants.length);
      if (b.badCastle.occupants.length) enemyGarrisonTicksAfterOpening++;
    }
    peakActors = Math.max(peakActors, b.goodTeam.length + b.badTeam.length);
    peakObjects = Math.max(peakObjects, b.objects.items.length);
    if (b.badCastle.hp <= 0) enemyKeepDownAt ??= b.tick;
    if (b.goodCastle.hp <= 0) homeKeepDownAt ??= b.tick;
  }
  return {descriptor: {...descriptor}, castleId, plan, initial, target, receipts,
    outcome: b.outcome ?? 'unresolved-at-observation-limit', tick: b.tick, secondsAt33Hz: b.tick / 33,
    homeKeepHP: b.goodCastle.hp, homeKeepDamage: initial.friendlyHP - b.goodCastle.hp,
    enemyKeepHP: b.badCastle.hp, enemyKeepDamage: initial.enemyHP - b.badCastle.hp,
    heroHP: b.hero.hp, heroDamage: initial.heroHP - b.hero.hp,
    enemyKeepDownAt, homeKeepDownAt, ownFlagStatus: b.ownFlag.status,
    goldSpent: b.stats.goldSpent, goldEarned: b.stats.goldEarned, gold: b.profile.gold,
    reserveLeft: b.friendlyQueue.population, reserveSpent: initial.reserve - b.friendlyQueue.population,
    shots: b.stats.shotsFired, hits: b.stats.bodyShots + b.stats.headShots,
    friendlyDeaths: actors.filter(u => u.team === 'good' && u.hp <= 0).length,
    enemyDeaths: actors.filter(u => u.team === 'bad' && u.hp <= 0).length,
    enemyAlive: b.badTeam.length, enemyReserve: b.enemies.remaining,
    homePeak, homeArcherTicks, homeGalleryShots, enemyPeakAfterOpening,
    enemyGarrisonTicksAfterOpening, enemyGalleryShots, peakActors, peakObjects,
    protectedTesting: b.protectedTesting};
}
