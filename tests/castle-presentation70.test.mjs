import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CASTLE_IDS, CASTLE_CATALOG, resolveCastleConfig} from '../site/dist/engine/castle-catalog.mjs';
import {COLLISION_REGIONS} from '../site/dist/engine/collision.mjs';
import {DEFAULT_PLAYER_PALETTE_ID, PLAYER_PALETTE_IDS, PLAYER_PALETTES,
  validatePlayerPaletteId, resolvePlayerPalette, FRIENDLY_HERALDRY_CUE,
  PLAYER_HERALDRY_SCOPE, playerHeraldryForTeam} from '../site/dist/player-palette.mjs';
import {castleCardIdentity, castlePreviewGeometry, castlePreviewSvg,
  CASTLE_PREVIEW_FRAME} from '../site/dist/castle-presentation.mjs';

const selection = id => ({id, level: 1});
const read = file => readFileSync(new URL(`../site/dist/${file}`, import.meta.url), 'utf8');
function deeplyFrozen(value) {
  if (!value || typeof value !== 'object') return;
  assert.ok(Object.isFrozen(value));
  for (const child of Object.values(value)) deeplyFrozen(child);
}
function luminance(hex) {
  return hex.slice(1).match(/../g).map(byte => parseInt(byte, 16)/255)
    .map(c => c <= .04045 ? c/12.92 : ((c+.055)/1.055)**2.4)
    .reduce((sum, c, i) => sum+c*[.2126, .7152, .0722][i], 0);
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)];
  return (Math.max(...values)+.05)/(Math.min(...values)+.05);
}

test('palette catalog is exactly three free cosmetic choices with closed IDs', () => {
  assert.equal(DEFAULT_PLAYER_PALETTE_ID, 'azure');
  assert.deepEqual(PLAYER_PALETTE_IDS, ['azure', 'indigo-brass', 'ivory-slate']);
  assert.deepEqual(Object.keys(PLAYER_PALETTES), PLAYER_PALETTE_IDS);
  for (const id of PLAYER_PALETTE_IDS) {
    assert.equal(validatePlayerPaletteId(id), id);
    assert.equal(resolvePlayerPalette(id), PLAYER_PALETTES[id]);
    assert.equal(PLAYER_PALETTES[id].price, 0);
    assert.deepEqual(Object.keys(PLAYER_PALETTES[id]).sort(), ['description', 'id', 'name', 'price', 'tokens']);
    deeplyFrozen(PLAYER_PALETTES[id]);
  }
  assert.equal(resolvePlayerPalette(), PLAYER_PALETTES.azure);
  for (const bad of [undefined, null, false, 0, '', 'Azure', '#427f90', 'toString', '__proto__', 'highwatch', [], {}, new String('azure')]) {
    assert.throws(() => validatePlayerPaletteId(bad), TypeError);
  }
  let coerced = false;
  assert.throws(() => validatePlayerPaletteId({toString() {coerced = true; return 'azure';}}));
  assert.equal(coerced, false);
  assert.throws(() => validatePlayerPaletteId('future-palette'), {code: 'unsupported-player-palette'});
  assert.throws(() => validatePlayerPaletteId(null), error => error instanceof TypeError && error.code === undefined);
});

test('Azure preserves every current material-specific renderer default byte-for-byte', () => {
  const azure = resolvePlayerPalette().tokens;
  assert.deepEqual(azure, {
    fortress: {cloth: '#427f90'},
    troopPose: {cloth: '#548d9b', dark: '#284951', light: '#a2c3bd'},
    fallback: {cloth: '#7eb0c5', dark: '#304a55'},
    flag: {cloth: '#93c2d1'},
  });
  assert.ok(read('fortress-art.mjs').includes("resolvePlayerPalette(paletteId).tokens.fortress.cloth"));
  const pose = read('combat-poses.mjs');
  assert.ok(pose.includes('resolvePlayerPalette(paletteId).tokens.troopPose'));
  const fallback = read('battle.mjs');
  assert.ok(fallback.includes('resolvePlayerPalette(profile.paletteId).tokens.fallback'));
  assert.ok(fallback.includes('resolvePlayerPalette(profile.paletteId).tokens.flag.cloth'));
  assert.equal(new Set([azure.fortress.cloth, azure.troopPose.cloth, azure.fallback.cloth, azure.flag.cloth]).size, 4);
});

test('palette tokens never contain mechanics, status, creature body or enemy colors', () => {
  for (const palette of Object.values(PLAYER_PALETTES)) {
    assert.deepEqual(Object.keys(palette.tokens).sort(), ['fallback', 'flag', 'fortress', 'troopPose']);
    for (const group of Object.values(palette.tokens)) for (const token of Object.values(group)) {
      assert.match(token, /^#[a-f0-9]{6}$/);
      assert.notEqual(token, '#914654');
    }
    assert.equal(playerHeraldryForTeam('bad', palette.id), null);
    assert.equal(playerHeraldryForTeam('neutral', palette.id), null);
    const good = playerHeraldryForTeam('good', palette.id);
    assert.equal(good.tokens, palette.tokens);
    assert.equal(good.cue, FRIENDLY_HERALDRY_CUE);
    assert.equal(good.paletteId, palette.id);
    deeplyFrozen(good);
  }
  assert.throws(() => playerHeraldryForTeam('enemy'));
  assert.throws(() => playerHeraldryForTeam('good', '#ffffff'));
  for (const identity of ['enemy burgundy', 'health and status colors', 'elemental creature bodies', 'all mechanics and economy']) {
    assert.ok(PLAYER_HERALDRY_SCOPE.preserved.includes(identity));
  }
  assert.match(PLAYER_HERALDRY_SCOPE.neutralTower, /actual current occupancy/);
  deeplyFrozen(PLAYER_HERALDRY_SCOPE);
});

test('friendly identification is non-color and remains legible by luminance', () => {
  const cue = FRIENDLY_HERALDRY_CUE;
  assert.equal(cue.meaning, 'allegiance');
  assert.equal(cue.label, 'Ally');
  assert.equal(cue.strokes.length, 2);
  assert.ok(cue.outerWidth > cue.innerWidth);
  assert.ok(contrast(cue.outline, cue.ink) > 12);
  for (const palette of Object.values(PLAYER_PALETTES)) {
    // These are relative-luminance checks, not merely different RGB values/hues.
    assert.ok(contrast(palette.tokens.troopPose.cloth, palette.tokens.troopPose.dark) >= 2.5);
    assert.ok(contrast(palette.tokens.fallback.cloth, palette.tokens.fallback.dark) >= 3.9);
    for (const tokens of Object.values(palette.tokens)) for (const fill of Object.values(tokens)) {
      assert.ok(Math.max(contrast(fill, cue.outline), contrast(fill, cue.ink)) >= 3.4,
        `${palette.id} ${fill} needs a contrasting cue edge`);
    }
  }
  deeplyFrozen(cue);
});

test('castle identity derives HP, launch, shelter and unlock facts from the shared resolver', () => {
  for (const id of CASTLE_IDS) for (const team of ['good', 'bad']) for (const baseHp of [6000, 8400, 9999]) {
    const card = castleCardIdentity(selection(id), {team, baseHp});
    const config = resolveCastleConfig(selection(id), {team, baseHp});
    assert.deepEqual(card.config, config);
    assert.equal(card.name, CASTLE_CATALOG[id].name);
    assert.equal(card.price, CASTLE_CATALOG[id].price);
    assert.equal(card.slot, 'Castle');
    assert.equal(card.kind, 'castle');
    assert.equal(card.facts.length, 5);
    assert.match(card.facts.find(f => f.id === 'health').value, new RegExp(config.hp.toLocaleString('en-US')));
    assert.match(card.facts.find(f => f.id === 'shelter').value, new RegExp(`^${config.maxOccupants} total berths · hero uses 1$`));
    assert.match(card.facts.find(f => f.id === 'shelter').detail, new RegExp(`At most ${config.maxOccupants-1} sheltered`));
    assert.equal(card.facts.find(f => f.id === 'resistance').value, 'Unchanged');
    assert.equal(card.provisionalTuning, id === 'highwatch');
    deeplyFrozen(card);
  }
  const highwatch = castleCardIdentity(selection('highwatch'), {baseHp: 8400});
  assert.equal(highwatch.config.hp, 6720);
  assert.equal(highwatch.priceLabel, '1,500 gold · one-time unlock');
  assert.equal(highwatch.summary, 'Higher firing station; 2 shelter berths; 20% less keep health.');
  assert.equal(highwatch.facts[0].value, '+50 world units');
  assert.match(highwatch.notes.join(' '), /does not guarantee extra bow range/);
  assert.match(highwatch.notes.join(' '), /No extra defenders/);
  assert.match(highwatch.notes.join(' '), /without equipping/);
  assert.match(highwatch.notes.join(' '), /Castle levels are not available/);
  assert.equal(castleCardIdentity(selection('classic'), {baseHp: 8400}).priceLabel, 'Free default');
});

test('presentation rejects unsupported levels, malformed selections and missing mode HP', () => {
  for (const fn of [castleCardIdentity, castlePreviewGeometry, castlePreviewSvg]) {
    for (const bad of [null, 'classic', {}, {id: 'classic'}, {id: 'classic', level: 0},
      {id: 'classic', level: 2}, {id: 'classic', level: '1'}, {id: 'classic', level: NaN},
      {id: 'highwatch', level: 99}, {id: 'future', level: 1}, {id: 'classic', level: 1, hp: 99999}]) {
      assert.throws(() => fn(bad, {baseHp: 8400}));
    }
    for (const baseHp of [undefined, null, '8400', 0, -1, Infinity, NaN, 1.5]) {
      assert.throws(() => fn(selection('classic'), {baseHp}));
    }
    assert.throws(() => fn(selection('classic'), {baseHp: 8400, team: 'neutral'}));
    let invoked = false;
    assert.throws(() => fn({get id() {invoked = true; return 'classic';}, level: 1}, {baseHp: 8400}));
    assert.equal(invoked, false);
  }
});

test('preview shares exact historical side bounds and a common scale; Highwatch only extends top', () => {
  for (const team of ['good', 'bad']) {
    const classic = castlePreviewGeometry(selection('classic'), {team, baseHp: 8400});
    const highwatch = castlePreviewGeometry(selection('highwatch'), {team, baseHp: 8400});
    for (const g of [classic, highwatch]) {
      const [left, right, top, bottom] = COLLISION_REGIONS[g.config.regionKind].hitbox;
      assert.deepEqual(g.worldBounds, {left, right, top, bottom});
      assert.equal(g.body.width, g.config.width*CASTLE_PREVIEW_FRAME.scale);
      assert.equal(g.body.height, g.config.height*CASTLE_PREVIEW_FRAME.scale);
      assert.equal(g.launch.y, CASTLE_PREVIEW_FRAME.origin.y+g.config.shotOffset.y*CASTLE_PREVIEW_FRAME.scale);
      deeplyFrozen(g);
    }
    assert.equal(highwatch.worldBounds.left, classic.worldBounds.left);
    assert.equal(highwatch.worldBounds.right, classic.worldBounds.right);
    assert.equal(highwatch.worldBounds.bottom, classic.worldBounds.bottom);
    assert.equal(highwatch.worldBounds.top, classic.worldBounds.top-50);
    assert.ok(Math.abs(highwatch.body.y-(classic.body.y-35)) < 1e-10);
    assert.equal(highwatch.launch.y, classic.launch.y-35);
  }
  assert.notEqual(castlePreviewGeometry(selection('classic'), {team: 'good', baseHp: 8400}).body.width,
    castlePreviewGeometry(selection('classic'), {team: 'bad', baseHp: 8400}).body.width);
});

test('SVG is bounded, code-native, deterministic and safe for repeated inline mounting', () => {
  const all = new Set();
  for (const id of CASTLE_IDS) for (const team of ['good', 'bad']) for (const paletteId of PLAYER_PALETTE_IDS) {
    const options = {team, baseHp: 8400, paletteId};
    const svg = castlePreviewSvg(selection(id), options);
    assert.equal(svg, castlePreviewSvg(selection(id), options));
    assert.ok(svg.length < 15000);
    assert.match(svg, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
    assert.match(svg, /viewBox="0 0 240 240"/);
    assert.match(svg, new RegExp(`data-castle-preview="${id}"`));
    assert.match(svg, new RegExp(`data-team="${team}"`));
    assert.match(svg, /<title>.*<\/title><desc>.*<\/desc>/);
    assert.doesNotMatch(svg, /\bid=|url\(|href=|<image|<script|<style|<animate|foreignObject|onload=|NaN|Infinity/);
    const geometries = [...svg.matchAll(/\b(?:d|points)="([^"]*)"/g)].map(match => match[1]);
    for (const geometry of geometries) for (const value of geometry.match(/-?\d+(?:\.\d+)?/g) ?? []) {
      assert.ok(+value >= 0 && +value <= 240, `${id}/${team}: off-canvas coordinate ${value}`);
    }
    for (const match of svg.matchAll(/<(?:rect|circle)\b[^>]*>/g)) {
      const attrs = Object.fromEntries([...match[0].matchAll(/\b(x|y|width|height|cx|cy|r)="([\d.]+)"/g)].map(a => [a[1], +a[2]]));
      if (match[0].startsWith('<rect')) {
        assert.ok(attrs.x >= 0 && attrs.y >= 0 && attrs.width > 0 && attrs.height > 0);
        assert.ok(attrs.x+attrs.width <= 240.001 && attrs.y+attrs.height <= 240.001);
      } else {
        assert.ok(attrs.cx-attrs.r >= 0 && attrs.cx+attrs.r <= 240);
        assert.ok(attrs.cy-attrs.r >= 0 && attrs.cy+attrs.r <= 240);
      }
    }
    if (team === 'good') all.add(svg);
  }
  assert.equal(all.size, 6, 'each castle/palette has a distinct portrait');
});

test('SVG escapes text and refuses caller-provided invalid labels/colors', () => {
  const payload = '</title><script>alert("x")</script>&\'"';
  const svg = castlePreviewSvg(selection('classic'), {baseHp: 8400, label: payload});
  assert.doesNotMatch(svg, /<script>/);
  assert.match(svg, /&lt;\/title&gt;&lt;script&gt;/);
  assert.match(svg, /&quot;x&quot;/);
  assert.match(svg, /&amp;&apos;&quot;/);
  assert.equal((svg.match(/<title>/g) ?? []).length, 1);
  for (const label of [null, {}, 12, 'a'.repeat(181), '\u0000', '\u001f', '\ud800', '\udc00', '\ufffe']) {
    assert.throws(() => castlePreviewSvg(selection('classic'), {baseHp: 8400, label}));
  }
  assert.match(castlePreviewSvg(selection('classic'), {baseHp: 8400, label: '旗 🏰'}), /旗 🏰/u);
  assert.throws(() => castlePreviewSvg(selection('classic'), {baseHp: 8400, paletteId: '#ffffff'}));
});

test('enemy preview identity does not change with player palette; allies retain shape and label', () => {
  for (const id of CASTLE_IDS) {
    const enemy = PLAYER_PALETTE_IDS.map(paletteId => castlePreviewSvg(selection(id), {team: 'bad', baseHp: 6000, paletteId}));
    assert.equal(new Set(enemy).size, 1);
    assert.match(enemy[0], /fill="#914654"/);
    assert.match(enemy[0], />ENEMY<\/text>/);
    assert.doesNotMatch(enemy[0], />ALLY<\/text>/);
    for (const paletteId of PLAYER_PALETTE_IDS) {
      const ally = castlePreviewSvg(selection(id), {team: 'good', baseHp: 6000, paletteId});
      assert.match(ally, />ALLY<\/text>/);
      assert.match(ally, /stroke="#1b2c31"/);
      assert.match(ally, /stroke="#f4ecd5"/);
      assert.doesNotMatch(ally, /fill="#914654"/);
    }
  }
});

test('all presentation functions are pure and consume no RNG', () => {
  const oldRandom = Math.random;
  const before = JSON.stringify({catalog: CASTLE_CATALOG, palettes: PLAYER_PALETTES, regions: COLLISION_REGIONS});
  const input = Object.freeze({id: 'highwatch', level: 1});
  const options = Object.freeze({team: 'good', baseHp: 8400, paletteId: 'indigo-brass'});
  try {
    Math.random = () => {throw new Error('Presentation consumed RNG');};
    castleCardIdentity(input, options);
    castlePreviewGeometry(input, options);
    castlePreviewSvg(input, options);
    playerHeraldryForTeam('good', 'indigo-brass');
  } finally {
    Math.random = oldRandom;
  }
  assert.equal(JSON.stringify({catalog: CASTLE_CATALOG, palettes: PLAYER_PALETTES, regions: COLLISION_REGIONS}), before);
  assert.deepEqual(input, {id: 'highwatch', level: 1});
});
