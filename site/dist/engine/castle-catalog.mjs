/** Castle sidegrades share mechanical data across player and authored enemies.
 * Levels are represented for portable selections, but only level 1 is playable.
 * Prices are provisional in-game gold. This module never draws RNG or owns
 * profile progression, purchase logic, renderer state, or encounter generation.
 */
import {COLLISION_REGIONS} from './collision.mjs';

export const DEFAULT_CASTLE_ID = 'classic';
export const DEFAULT_CASTLE_SELECTION = Object.freeze({id: DEFAULT_CASTLE_ID, level: 1});
export const CASTLE_CATALOG = Object.freeze({
  classic: Object.freeze({
    id: 'classic', name: 'Classic Keep', price: 0, maxLevel: 1,
    launchElevation: 0, berths: 4, hpMultiplier: 1,
  }),
  highwatch: Object.freeze({
    id: 'highwatch', name: 'Highwatch Keep', price: 1500, maxLevel: 1,
    launchElevation: 50, berths: 2, hpMultiplier: .8,
  }),
});
export const CASTLE_IDS = Object.freeze(Object.keys(CASTLE_CATALOG));

/** Strict portable data: no coercion, inherited fields, extra keys or getters.
 * Missing old fields must be migrated by their owning reader, not accepted here.
 */
export function validateCastleSelection(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new TypeError('Invalid castle selection');
  }
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 2 || !keys.includes('id') || !keys.includes('level')) {
    throw new TypeError('Invalid castle selection fields');
  }
  const id = Object.getOwnPropertyDescriptor(value, 'id');
  const level = Object.getOwnPropertyDescriptor(value, 'level');
  if (!Object.hasOwn(id, 'value') || !Object.hasOwn(level, 'value') ||
      !id.enumerable || !level.enumerable) {
    throw new TypeError('Castle selection needs plain data fields');
  }
  if (typeof id.value !== 'string' || !Object.hasOwn(CASTLE_CATALOG, id.value)) {
    throw Object.assign(new RangeError('Unknown castle'), {code: 'unsupported-castle'});
  }
  if (level.value !== 1) {
    const error = new RangeError('Unsupported castle level');
    if (Number.isSafeInteger(level.value) && level.value > 1) error.code = 'unsupported-castle-level';
    throw error;
  }
  return Object.freeze({id: id.value, level: level.value});
}

/** baseHp is the mode's pre-type health, never a previously adjusted maxHp.
 * Both teams receive exactly the same trait operation on their original bounds.
 */
export function resolveCastleConfig(selection, {team, baseHp} = {}) {
  const {id, level} = validateCastleSelection(selection);
  if (team !== 'good' && team !== 'bad') throw new RangeError('Unknown castle team');
  if (!Number.isSafeInteger(baseHp) || baseHp <= 0) throw new RangeError('Invalid base castle health');
  const entry = CASTLE_CATALOG[id];
  const regionKind = (team === 'good' ? 'friendly' : 'enemy') +
    (id === 'highwatch' ? 'HighwatchCastle' : 'Castle');
  const [left, right, top, bottom] = COLLISION_REGIONS[regionKind].hitbox;
  return Object.freeze({
    id, level, baseHp, hp: Math.floor(baseHp * entry.hpMultiplier),
    maxOccupants: entry.berths,
    shotOffset: Object.freeze({x: 0, y: -200 - entry.launchElevation}),
    regionKind, width: right - left, height: bottom - top,
  });
}
