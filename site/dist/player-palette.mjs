/** Curated player heraldry only. This module has no renderer, profile or DOM effects.
 * Keep material-specific Azure tokens: unifying them would change existing art.
 */
const freeze = value => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};

export const DEFAULT_PLAYER_PALETTE_ID = 'azure';
export const PLAYER_PALETTE_IDS = Object.freeze(['azure', 'indigo-brass', 'ivory-slate']);
export const PLAYER_PALETTES = freeze({
  azure: {
    id: 'azure', name: 'Azure', price: 0,
    description: 'The original blue-green cloth, with its existing material shades.',
    tokens: {
      fortress: {cloth: '#427f90'},
      troopPose: {cloth: '#548d9b', dark: '#284951', light: '#a2c3bd'},
      fallback: {cloth: '#7eb0c5', dark: '#304a55'},
      flag: {cloth: '#93c2d1'},
    },
  },
  'indigo-brass': {
    id: 'indigo-brass', name: 'Indigo & Brass', price: 0,
    description: 'Indigo cloth with brass-colored fabric trim and standards.',
    tokens: {
      fortress: {cloth: '#5d547b'},
      troopPose: {cloth: '#766b97', dark: '#30293f', light: '#d3bd7f'},
      fallback: {cloth: '#a59bc0', dark: '#3b324b'},
      flag: {cloth: '#d0b56f'},
    },
  },
  'ivory-slate': {
    id: 'ivory-slate', name: 'Ivory & Slate', price: 0,
    description: 'Ivory cloth with slate folds and pale fabric trim.',
    tokens: {
      fortress: {cloth: '#c9c3ab'},
      troopPose: {cloth: '#dbd4bb', dark: '#414d59', light: '#f0ead7'},
      fallback: {cloth: '#ded8c4', dark: '#465160'},
      flag: {cloth: '#ede4c7'},
    },
  },
});

/** Closed IDs, never CSS, arbitrary hex, display names or coercible objects. */
export function validatePlayerPaletteId(value) {
  if (typeof value !== 'string') throw new TypeError('Choose a known player palette.');
  if (!Object.hasOwn(PLAYER_PALETTES, value)) {
    const error = new TypeError('Choose a known player palette.');
    error.code = 'unsupported-player-palette';
    throw error;
  }
  return value;
}

export function resolvePlayerPalette(id = DEFAULT_PLAYER_PALETTE_ID) {
  return PLAYER_PALETTES[validatePlayerPaletteId(id)];
}

/** Friendly identity is redundant: a fixed double-chevron shape and a text label.
 * Draw the dark outer stroke, then the light inner stroke. Neither varies by
 * palette. This dual outline stays legible on light AND dark cloth and in gray.
 * The mark means allied allegiance only, never rank, element, rarity or a buff.
 * Renderer mounts must keep this mark separate from live health/status cues.
 */
export const FRIENDLY_HERALDRY_CUE = freeze({
  id: 'allied-double-chevron', label: 'Ally', meaning: 'allegiance',
  viewBox: [0, 0, 12, 12],
  strokes: [[[2, 6], [6, 2], [10, 6]], [[2, 10], [6, 6], [10, 10]]],
  outline: '#1b2c31', ink: '#f4ecd5', outerWidth: 3.5, innerWidth: 1.5,
});

export const PLAYER_HERALDRY_SCOPE = freeze({
  affected: ['friendly keep cloth', 'friendly standard', 'own flag', 'hero cloth',
    'human allied cloth', 'existing non-elemental allied faction accents'],
  preserved: ['team and allegiance', 'enemy burgundy', 'neutral identity', 'stone',
    'metal', 'skin', 'health and status colors', 'damage', 'fire effects', 'ice effects',
    'poison effects', 'elemental creature bodies', 'all mechanics and economy'],
  neutralTower: 'Use actual current occupancy; an empty neutral tower stays neutral.',
  cosmetic: 'Free heraldry. No stat changes.',
});

/** Pass actual rendered allegiance (occupiedBy for a neutral tower). Returning
 * null means retain the existing enemy/neutral renderer colors AND identity.
 * Never infer allegiance from palette, element, owner profile or selected deck.
 */
export function playerHeraldryForTeam(team, paletteId = DEFAULT_PLAYER_PALETTE_ID) {
  const palette = resolvePlayerPalette(paletteId);
  if (!['good', 'bad', 'neutral'].includes(team)) throw new TypeError('Unknown heraldry allegiance.');
  return team === 'good' ? freeze({paletteId: palette.id, tokens: palette.tokens, cue: FRIENDLY_HERALDRY_CUE}) : null;
}
