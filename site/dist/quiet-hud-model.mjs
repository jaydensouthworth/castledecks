/** Presentation-only model for the proposed HUD. No engine state mutations.
 * The parent integration supplies the existing SKILLS catalog. */
export const shortNames = {
  arrow: 'Arrow', fireArrow: 'Fire', iceArrow: 'Ice', pierceArrow: 'Pierce',
  bombArrow: 'Bomb', flakArrow: 'Flak', bombWave: 'Bomb wave',
  fireWave: 'Fire wave', iceWave: 'Ice wave', healWave: 'Heal',
  thunderArrow: 'Thunder', meteorArrow: 'Meteor', cometArrow: 'Comet',
  grunt: 'Soldiers', archer: 'Archers', tallGrunt: 'Heavy', mount: 'Cavalry',
  trebuchet: 'Siege', priest: 'Healers'
};

// Use the ACTUAL resolved bars, not skill.binding. ActionBarLayout deliberately
// permits displaced skills with stale bindings, so arithmetic on binding alone
// can select a different skill from the one named on the button.
export function boundSkillRefs(hotbar) {
  const seen = new Set();
  return hotbar.bars.flatMap((bar, barIndex) => bar.flatMap((skill, slot) => {
    if (!skill || seen.has(skill.id)) return [];
    seen.add(skill.id);
    return [{skill, id: skill.id, bar: barIndex, slot}];
  }));
}

// Stable initial order, then ensure the actual selected skill can be seen.
// All existing positions are retained except the final occupied slot when a
// new selected skill needs room. Never reorder on cooldown or HP changes.
export function quickSkillRefs(refs, activeId, preferredIds = [], limit = 4) {
  const count = Math.max(1, Math.min(4, limit));
  const byId = new Map(refs.map(ref => [ref.id, ref]));
  const ordered = [...new Set([...preferredIds, ...refs.map(ref => ref.id)])]
    .map(id => byId.get(id)).filter(Boolean);
  const result = ordered.slice(0, count);
  const active = byId.get(activeId);
  if (active && !result.some(ref => ref.id === active.id)) {
    if (result.length < count) result.push(active);
    else result[result.length - 1] = active;
  }
  return result;
}

export function contextualHudState(battle) {
  const hero = battle.hero;
  const garrisoned = hero.garrisoned();
  const nearGarrison = !garrisoned && battle.garrisons.some(building =>
    Math.abs(building.x - hero.x) < 20 && building.hp > 0 &&
    building.hasRoom() &&
    (building.occupiedBy === hero.team || building.occupiedBy === 'neutral'));
  const objects = battle.activationObjects;
  const kinds = new Set(objects.map(object => object.kind));
  const activationLabel = kinds.size === 1 && kinds.has('flak_arrow') ? 'Burst'
    : kinds.size === 1 && kinds.has('thunder_arrow') ? 'Storm' : 'Activate';
  return {heroMode: garrisoned ? 'garrisoned' : 'foot', nearGarrison,
    showActivation: objects.length > 0 && !battle.outcome, activationLabel};
}

// Flag ownership changes the meaning of held status. Use carrier team; never
// infer enemy/allied carrier just from the two owner-relative held constants.
export function priorityFlagAlert(battle) {
  if (battle.outcome || battle.summary) return '';
  const own = battle.ownFlag, enemy = battle.enemyFlag;
  if (own.status !== 3) {
    if (own.holder?.team === 'bad') return 'Your flag taken · Stop the carrier';
    if (own.status === 0) return 'Recover your flag';
    if (own.holder?.team === 'good') return 'Your flag is returning';
  }
  if (enemy.holder?.team === 'good') return 'Escort your flag carrier';
  if (enemy.status === 0) return 'Enemy flag dropped';
  return '';
}

export function ownedSkillGroup(skill, catalog) {
  return catalog[skill.id]?.summon ? 'army' : 'bow';
}

