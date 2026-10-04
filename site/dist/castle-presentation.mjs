/** Standalone castle-card facts and code-native portraits. No UI is mounted here.
 * Battle still owns rendering/collision; these previews never configure actors.
 */
import {CASTLE_CATALOG, resolveCastleConfig} from './engine/castle-catalog.mjs';
import {COLLISION_REGIONS} from './engine/collision.mjs';
import {DEFAULT_PLAYER_PALETTE_ID, FRIENDLY_HERALDRY_CUE, resolvePlayerPalette} from './player-palette.mjs';

const freeze = value => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
const number = value => value.toLocaleString('en-US');
const percent = value => Math.round(value * 100);
const escape = text => text.replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'}[char]));
const n = value => Number(value.toFixed(3));
const ink = Object.freeze({edge: '#24343a', shadow: '#45585b', stone: '#899a98', light: '#bdc7b4',
  warm: '#d4bd88', mortar: '#627675', wood: '#534435', door: '#283838', enemy: '#914654'});

/** The caller supplies the mode's ORIGINAL pre-type HP. Never use current HP or
 * the already-adjusted maximum. A level is validated but never sold/displayed as
 * a progression control: only the engine's level-1 selection exists in this slice.
 */
export function castleCardIdentity(selection, {team = 'good', baseHp} = {}) {
  const config = resolveCastleConfig(selection, {team, baseHp});
  const entry = CASTLE_CATALOG[config.id];
  const elevated = entry.launchElevation > 0;
  const hpPercent = percent(entry.hpMultiplier);
  const summary = elevated
    ? `Higher firing station; ${config.maxOccupants} shelter berths; ${100 - hpPercent}% less keep health.`
    : `${config.maxOccupants} shelter berths; full keep health; original firing station.`;
  return freeze({
    id: entry.id, kind: 'castle', slot: 'Castle', name: entry.name,
    price: entry.price, priceLabel: entry.price === 0 ? 'Free default' : `${number(entry.price)} gold · one-time unlock`,
    provisionalTuning: elevated, summary,
    tradeoff: elevated
      ? 'A higher firing station and a taller exposed wall, with less health and shelter.'
      : 'More health and shelter than Highwatch, with a lower firing station.',
    facts: [
      {id: 'launch', label: 'Firing station', value: elevated ? `+${number(entry.launchElevation)} world units` : 'Original height'},
      {id: 'shelter', label: 'Shelter', value: `${config.maxOccupants} total berths · hero uses 1`,
        detail: `At most ${config.maxOccupants - 1} sheltered ${config.maxOccupants - 1 === 1 ? 'archer' : 'archers'} while the hero is inside.`},
      {id: 'health', label: 'Keep health', value: `${number(config.hp)} HP · ${hpPercent}% of mode base`,
        detail: `Mode base: ${number(config.baseHp)} HP. Type modifier is rounded down once.`},
      {id: 'masonry', label: 'Masonry', value: elevated ? `Damageable top extended ${number(entry.launchElevation)} world units` : 'Original collision bounds'},
      {id: 'resistance', label: 'Resistances and economy', value: 'Unchanged'},
    ],
    notes: [
      'Height changes firing angles and terrain clearance; it does not guarantee extra bow range, safety or a hit.',
      'Archers must naturally reach and enter an available berth. No extra defenders are supplied.',
      'Castle purchase adds ownership without equipping. Castle type changes belong before a battle or at settled camp.',
      'Castle levels are not available.',
    ],
    config,
  });
}

export const CASTLE_PREVIEW_FRAME = freeze({width: 240, height: 240, scale: .7, origin: {x: 120, y: 218}});

/** A common world scale keeps Highwatch visibly taller rather than shrinking it
 * into Classic's silhouette. Stone uses the resolver's exact side-specific box.
 * Bedrock below the historical bottom is visually distinct, just as in live art.
 */
export function castlePreviewGeometry(selection, {team = 'good', baseHp} = {}) {
  const config = resolveCastleConfig(selection, {team, baseHp});
  const [left, right, top, bottom] = COLLISION_REGIONS[config.regionKind].hitbox;
  const {origin, scale} = CASTLE_PREVIEW_FRAME;
  const body = {x: origin.x + left * scale, y: origin.y + top * scale,
    width: (right - left) * scale, height: (bottom - top) * scale};
  const launch = {x: origin.x + config.shotOffset.x * scale, y: origin.y + config.shotOffset.y * scale};
  return freeze({body, launch, groundY: origin.y, centerX: body.x + body.width / 2,
    worldBounds: {left, right, top, bottom}, config});
}

function rect(x, y, width, height, fill, extra = '') {
  return `<rect x="${n(x)}" y="${n(y)}" width="${n(width)}" height="${n(height)}" fill="${fill}"${extra}/>`;
}
function line(x1, y1, x2, y2, stroke, width = 1) {
  return `<path d="M${n(x1)} ${n(y1)}L${n(x2)} ${n(y2)}" fill="none" stroke="${stroke}" stroke-width="${width}"/>`;
}
function poly(points, fill) {
  return `<polygon points="${points.map(([x, y]) => `${n(x)},${n(y)}`).join(' ')}" fill="${fill}"/>`;
}
function arch(x, bottom, width, height, fill) {
  const r = width / 2;
  return `<path d="M${n(x-r)} ${n(bottom)}V${n(bottom-height+r)}Q${n(x)} ${n(bottom-height-r*.3)} ${n(x+r)} ${n(bottom-height+r)}V${n(bottom)}Z" fill="${fill}"/>`;
}
function allyMark(x, y, scale = 1) {
  const cue = FRIENDLY_HERALDRY_CUE;
  const path = cue.strokes.map(points => points.map(([px, py], i) => `${i ? 'L' : 'M'}${n(x+px*scale)} ${n(y+py*scale)}`).join('')).join('');
  return `<path d="${path}" fill="none" stroke="${cue.outline}" stroke-width="${cue.outerWidth*scale}" stroke-linejoin="round"/><path d="${path}" fill="none" stroke="${cue.ink}" stroke-width="${cue.innerWidth*scale}" stroke-linejoin="round"/>`;
}

/** Safe to repeat inline: no element IDs, CSS, URL references, images, animation,
 * document access, randomness or counters. User-facing labels are escaped and
 * bounded; no caller-supplied color/style/markup is accepted. Not a live renderer.
 */
export function castlePreviewSvg(selection, {team = 'good', baseHp, paletteId = DEFAULT_PLAYER_PALETTE_ID, label = ''} = {}) {
  if (typeof label !== 'string' || label.length > 180) throw new TypeError('Preview label must be at most 180 characters.');
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/u.test(label) ||
      [...label].some(char => char.codePointAt(0) >= 0xd800 && char.codePointAt(0) <= 0xdfff)) {
    throw new TypeError('Preview label must contain valid text.');
  }
  const palette = resolvePlayerPalette(paletteId);
  const card = castleCardIdentity(selection, {team, baseHp});
  const g = castlePreviewGeometry(selection, {team, baseHp});
  const {x, y, width: w, height: h} = g.body;
  const bottom = y + h, cx = g.centerX, allied = team === 'good';
  const cloth = allied ? palette.tokens.fortress.cloth : ink.enemy;
  const name = `${allied ? 'Allied' : 'Enemy'} ${card.name}`;
  const title = label ? `${label} · ${name}` : name;
  const description = `${card.summary} ${card.facts.find(f => f.id === 'health').value}. Decorative card preview; live collision comes from the battle.`;
  const art = [
    rect(1, 1, 238, 238, '#182c31', ' rx="14" stroke="#887a59" stroke-width="2"'),
    rect(8, 8, 224, 224, '#243b40', ' rx="10"'),
    `<circle cx="179" cy="59" r="28" fill="#a89262" opacity=".17"/>`,
    poly([[8, 191], [42, 173], [79, 193], [153, 179], [198, 163], [232, 188], [232, 232], [8, 232]], '#34484a'),
    poly([[8, 211], [63, 198], [120, 205], [181, 194], [232, 210], [232, 232], [8, 232]], '#42534f'),
    // A continuous filled rectangle: the recesses are dark stone, not cut-outs.
    rect(x, y, w, h, ink.stone), rect(x, y, w*.18, h, ink.shadow), rect(x+w-4, y, 4, h, ink.light),
  ];
  for (let row = 1; row * 15 < h; row++) {
    const sy = y + row * 15;
    art.push(line(x+1, sy, x+w-1, sy, ink.mortar, .7));
    for (let column = 1; column * 17 < w; column++) {
      const sx = x + column * 17 + (row % 2 ? 7 : 0);
      if (sx < x+w-1) art.push(line(sx, sy, sx, Math.min(sy+15, bottom), ink.mortar, .7));
    }
  }
  art.push(rect(x, y, w, 12, ink.light), rect(x, y+11, w, 4, ink.shadow));
  const bays = Math.max(3, Math.round(w / 12));
  for (let i = 0; i < bays; i++) art.push(rect(x+i*w/bays+w/bays*.3, y+3, w/bays*.4, 6, ink.shadow));
  art.push(line(x+1, y+1, x+w-1, y+1, ink.warm, 1.4));
  const galleryWidth = Math.min(w-8, 26), floorY = g.launch.y+18;
  art.push(arch(g.launch.x, floorY, galleryWidth, Math.max(12, floorY-y-17), ink.edge),
    line(g.launch.x-galleryWidth/2, floorY, g.launch.x+galleryWidth/2, floorY, ink.warm, 2),
    rect(g.launch.x-galleryWidth/2, floorY+1, galleryWidth, 3, ink.wood));
  if (card.id === 'highwatch') {
    // The additional watch-gallery frame is wholly inside the taller wall.
    art.push(line(x+3, y+17, x+w-3, y+17, ink.warm, 1.5),
      line(x+3, y+17, x+3, floorY+7, ink.light, 1.5),
      line(x+w-3, y+17, x+w-3, floorY+7, ink.light, 1.5));
  }
  const bannerTop = floorY+15, bannerWidth = Math.min(w-12, 18), bannerBottom = bannerTop+34;
  art.push(poly([[cx-bannerWidth/2, bannerTop], [cx+bannerWidth/2, bannerTop],
    [cx+bannerWidth/2, bannerBottom], [cx, bannerBottom-5], [cx-bannerWidth/2, bannerBottom]], cloth),
    line(cx-bannerWidth/2, bannerTop, cx+bannerWidth/2, bannerTop, ink.warm, 2));
  if (allied) art.push(allyMark(cx-6, bannerTop+6));
  else art.push(poly([[cx, bannerTop+7], [cx+4, bannerTop+13], [cx, bannerTop+19], [cx-4, bannerTop+13]], ink.warm));
  const doorWidth = Math.min(w*.5, 25);
  art.push(arch(cx, bottom-1, doorWidth+4, 38, ink.light), arch(cx, bottom-1, doorWidth, 34, ink.door),
    arch(cx, bottom-1, doorWidth-5, 30, ink.wood), line(cx, bottom-3, cx, bottom-23, ink.edge, 1.5),
    line(cx-doorWidth*.35, bottom-12, cx+doorWidth*.35, bottom-12, ink.warm, 1.5),
    line(x+1, y+1, x+1, bottom, ink.edge, 1.5), line(x+w-1, y+1, x+w-1, bottom, ink.edge, 1.5),
    rect(x, bottom-4, w, 4, ink.shadow),
    // Thin cloth/wood above the box is plainly decoration, never extra masonry.
    line(cx, y+1, cx, y-22, ink.warm, 1.5),
    poly([[cx+1, y-22], [cx+21, y-17], [cx+1, y-10]], cloth),
    poly([[x, bottom], [x+w, bottom], [x+w+8, g.groundY], [cx+8, g.groundY-2],
      [cx-7, g.groundY+2], [x-8, g.groundY]], '#596b60'),
    poly([[x+w*.6, bottom], [x+w, bottom], [x+w+8, g.groundY], [cx+7, g.groundY-2]], '#819080'),
    line(x-8, g.groundY+2, x+w+8, g.groundY+2, '#9aa581', 1.5));
  if (allied) art.push(allyMark(20, 17, 1.1));
  art.push(`<text x="${allied ? 38 : 20}" y="29" fill="#f4ecd5" font-family="system-ui,sans-serif" font-size="10" font-weight="700">${allied ? 'ALLY' : 'ENEMY'}</text>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240" role="img" aria-label="${escape(title)}" data-castle-preview="${card.id}" data-team="${team}"><title>${escape(title)}</title><desc>${escape(description)}</desc>${art.join('')}</svg>`;
}
