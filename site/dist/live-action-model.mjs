/** Presentation-only view of the real three-by-ten engine hotbar.
 * No pinning, reordering, binding arithmetic, state mutation, or skill cap. */
export function liveBarState(hotbar, catalog = {}) {
  const bar = hotbar.bar;
  if (!Number.isInteger(bar) || bar < 0 || bar >= hotbar.bars.length)
    throw new RangeError('The engine selected an invalid action bar');
  const entries = hotbar.bars[bar].flatMap((skill, slot) => skill
    ? [{bar, slot, skill, id: skill.id, key: `${bar}:${slot}:${skill.id}`,
      summon: !!catalog[skill.id]?.summon}]
    : []);
  const populatedBars = hotbar.bars.flatMap((slots, index) =>
    slots.some(Boolean) ? [index] : []);
  const offset = populatedBars.indexOf(bar);
  const nextBar = populatedBars.length > 1
    ? populatedBars[(offset + 1 + populatedBars.length) % populatedBars.length]
    : null;
  return {
    bar, entries, populatedBars, canCycle: populatedBars.length > 1, nextBar,
    currentHasSummons: entries.some(entry => entry.summon),
    portraitColumns: Math.max(1, Math.min(5, entries.length)),
    // No frame/rank/cooldown in signature: update those in place.
    signature: `${bar}|${entries.map(entry => entry.key).join('|')}`,
    label: `${bar + 1} / ${hotbar.bars.length}`,
    cycleLabel: nextBar === null ? 'Only one equipped bar'
      : `Bar ${bar + 1} of ${hotbar.bars.length}. Switch to bar ${nextBar + 1}`
  };
}

// Keep the object identity as well as bar/slot. A stale binding, bar switch,
// new profile, or rearrangement must never change which skill a queued tap uses.
export function captureLiveSelection(hotbar, slot) {
  const skill = hotbar.bars[hotbar.bar]?.[slot];
  return skill ? {kind: 'select', bar: hotbar.bar, slot, id: skill.id, skill} : null;
}
export function isCurrentLiveSelection(hotbar, intent) {
  return !!intent && intent.kind === 'select' &&
    hotbar.bars[intent.bar]?.[intent.slot] === intent.skill &&
    intent.skill.id === intent.id;
}

export function liveSlotStatus(skill, catalog, profile, queue) {
  const config = catalog[skill.id], summon = config?.summon;
  const remainingSeconds = Math.max(0, Math.ceil(skill.cooldown / 66));
  const fraction = skill.maximum > 0
    ? Math.max(0, Math.min(1, 1 - skill.cooldown / skill.maximum)) : 1;
  const cost = summon?.cost ?? 0;
  const population = summon ? summon.population * summon.amount : 0;
  let reason = remainingSeconds ? `Ready in ${remainingSeconds} seconds` : 'Ready';
  let affordable = true;
  if (summon) {
    affordable = profile.gold >= cost && queue.population >= population && queue.queue.length < queue.capacity;
    if (!remainingSeconds && profile.gold < cost) reason = `Need ${cost} gold`;
    else if (!remainingSeconds && queue.population < population) reason = `Need ${population} population`;
    else if (!remainingSeconds && queue.queue.length >= queue.capacity) reason = 'Queue full';
  }
  return {remainingSeconds, fraction, cost, population, affordable, reason,
    ariaLabel: `${summon ? 'Summon ' : ''}${config?.name ?? skill.id}${summon ? `, ${cost} gold and ${population} population` : ''}, ${reason}`};
}
