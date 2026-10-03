/** Original, code-native BowMaster ability icons. No fonts, emoji, external
 * resources, script, IDs, or input interpolation. The host names each button;
 * these decorative SVGs intentionally remain hidden from assistive tech. */
import {RECRUIT_ICONS} from './recruit-icons.mjs';
const brass = '#e6c27d';
const parchment = '#f3e4bd';
const ember = '#efac72';
const frost = '#a9d8df';
const sage = '#b9d39c';

const svg = drawing => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="26" height="26" fill="none" stroke="${parchment}" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" class="skill-svg">${drawing}</svg>`;

// A common directional shaft makes the elemental arrow family recognizable,
// while each head/effect has a distinct outline as well as a semantic accent.
const shaft = `<path d="M5 27 26 6M20 6h6v6M5 22v5h5" stroke="${brass}"/>`;
const ground = `<path d="M3 27c4-4 6 4 10 0s6 4 10 0 4 0 6 0" stroke="${brass}"/>`;

const icons = Object.freeze({
  ...RECRUIT_ICONS,
  arrow: svg(`<path d="M7 4c15 7 15 17 0 24M7 4l6 12-6 12" stroke="${brass}"/><path d="M5 16h23m-5-5 5 5-5 5"/>`),

  fireArrow: svg(`${shaft}<path d="M21 14c1 4-3 4-3 7 0 2 2 5 5 5s6-3 6-6c0-3-2-5-3-6 0 3-2 4-2 3 0-2-2-3-3-3Z" fill="${ember}" fill-opacity=".18" stroke="${ember}"/><path d="M23 20c-3 3-1 5 1 5" stroke="${parchment}"/>`),

  iceArrow: svg(`${shaft}<g stroke="${frost}"><path d="M9 3v14M3 6l12 8M3 14l12-8M6 4l3 2 3-2M6 16l3-2 3 2"/></g>`),

  pierceArrow: svg(`<path d="m5 27 13-13M3 23l6 6" stroke="${brass}"/><path d="m16 12 12-9-6 14-6-5Z" fill="${parchment}" fill-opacity=".2"/><path d="m15 6-7 4v7l3 3m1-11 3 3-3 4 4 4m-1 4c4-2 7-5 7-9" stroke="${brass}"/>`),

  bombArrow: svg(`${shaft}<circle cx="12" cy="21" r="7" fill="#282824"/><path d="m14 14 2-4c1-2 4-1 4-4M10 17l-2 2" stroke="${ember}"/><path d="m20 3 1 2 3-1" stroke="${ember}"/>`),

  flakArrow: svg(`<path d="m5 11 5-6 2 8-7-2Zm14-7 8 2-6 5-2-7Zm4 16 6 5-8 3 2-8Z" stroke="${brass}" fill="${brass}" fill-opacity=".18"/><path d="m13 16-3-4m6 2 5-5m-3 10 6 5M5 25l5-4"/><circle cx="14" cy="19" r="3" stroke="${ember}"/>`),

  bombWave: svg(`${ground}<circle cx="16" cy="17" r="5" fill="${ember}" fill-opacity=".18" stroke="${ember}"/><path d="M16 5v5M5 12l5 2m12 0 5-2M8 21l-4 2m20-2 4 2m-18-17 3 4m9-4-3 4" stroke="${ember}"/>`),

  fireWave: svg(`${ground}<path d="M7 24c-6-4-2-8 0-11 0 3 4 4 3 7m7 4c-10-5-3-13-2-20 2 4 6 6 6 11 0 4-2 6-4 9Zm8 0c-4-2-4-5-2-8 0 2 5 3 4 6" stroke="${ember}" fill="${ember}" fill-opacity=".12"/>`),

  iceWave: svg(`${ground}<path d="m4 24 2-12 6 12m-1 0 4-20 6 20m-1 0 6-14 2 14" fill="${frost}" fill-opacity=".16" stroke="${frost}"/><path d="m15 4 1 20m10-14-2 14" stroke="${parchment}" stroke-width="1.3"/>`),

  healWave: svg(`${ground}<path d="M13 5h6v6h6v6h-6v6h-6v-6H7v-6h6V5Z" fill="${sage}" fill-opacity=".18" stroke="${sage}"/>`),

  thunderArrow: svg(`<path d="m6 26 5-5m11-11 5-5m-6 0h6v6" stroke="${brass}"/><path d="m18 3-10 15h8l-2 11 11-16h-8l1-10Z" fill="${brass}" fill-opacity=".2" stroke="${parchment}"/>`),

  meteorArrow: svg(`<path d="m4 4 13 9M3 11l10 6M10 3l9 10" stroke="${ember}"/><path d="m23 13 6 7-3 8-9 1-6-7 4-8 8-1Z" fill="${ember}" fill-opacity=".2" stroke="${ember}"/><path d="m20 17-4 5 4 3m4-8 1 4" stroke="${parchment}"/>`),

  cometArrow: svg(`<path d="M3 5c4 1 9 2 15 10M3 12c4-1 8 0 12 6M10 3c0 4 2 8 8 12" stroke="${frost}"/><path d="m21 13 8 9-8 8-8-9 8-8Z" fill="${frost}" fill-opacity=".17" stroke="${frost}"/><path d="m21 13-1 10 9-1m-16-1 7 2 1 7" stroke="${parchment}" stroke-width="1.3"/>`),

  grunt: svg(`<path d="M9 10c0-8 12-8 12 0M8 10h14M11 10v4l5 3 5-3v-4" stroke="${brass}"/><path d="m7 17 9 3 9-3v7l-9 6-9-6v-7Z" fill="${brass}" fill-opacity=".12"/><path d="M16 20v7M4 15v12m-2-8h4" stroke="${brass}"/>`),

  archer: svg(`<circle cx="10" cy="8" r="3" stroke="${brass}"/><path d="m9 12-3 9 7 1 2 7M7 21l-3 8M10 13l8 4M21 5c12 8 12 16 0 24M21 5l4 12-4 12" stroke="${brass}"/><path d="M14 17h16m-3-3 3 3-3 3"/>`),

  tallGrunt: svg(`<path d="m6 6 9-3 6 4v7H6V6ZM6 10h15m-8 0v4" fill="${brass}" fill-opacity=".15"/><path d="m4 17 11-2 5 5-6 9-10-4v-8Z" fill="${brass}" fill-opacity=".15" stroke="${brass}"/><path d="M10 18v7M25 7v23"/><path d="M25 6c7 1 6 8 0 10m0-10-3 2m3 8-3-2" stroke="${brass}"/>`),

  mount: svg(`<path d="M6 28h22M9 26v-5c0-3 2-6 6-8l-1-8 5 3 3-1 7 8-4 4-5-2-3 8 8 3" fill="${brass}" fill-opacity=".12"/><path d="m15 13 6-2M10 22l5 1" stroke="${brass}"/><circle cx="23" cy="13" r="1" fill="${parchment}" stroke="none"/>`),

  trebuchet: svg(`<path d="M5 25h23M10 24l7-13 7 13M7 5l21 14M17 11l-2-5" stroke="${brass}"/><path d="M3 4h8v6H3z" fill="${brass}" fill-opacity=".16"/><circle cx="7" cy="27" r="3"/><circle cx="26" cy="27" r="3"/><path d="m25 15 5 2-2 4" stroke="${brass}"/><circle cx="28" cy="8" r="2" fill="${parchment}" fill-opacity=".25"/>`),

  priest: svg(`<path d="m7 12 6-9 6 9M9 12v4l4 3 4-3v-4M8 18l-4 11h18l-5-11" fill="${sage}" fill-opacity=".1" stroke="${brass}"/><path d="M13 19v10M26 4v25m-4-19h8" stroke="${sage}"/><path d="m19 20 7-3"/>`)
});

export const SKILL_ICON_IDS = Object.freeze(Object.keys(icons));

/** Unknown IDs deliberately produce no markup and are never echoed. */
export function skillIcon(id) {
  return typeof id === 'string' && Object.hasOwn(icons, id) ? icons[id] : '';
}
