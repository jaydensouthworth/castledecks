/** Assisted, temporary Battle 13 demonstration. No storage or campaign manager.
 * The supplied rank, unlocks, ready cooldowns, starting gold and elapsed opening
 * are a demo setup, never evidence of earned campaign victories.
 * Hero/basic rank8 is calibrated against one reproducible twelve-victory earned
 * path. Other purchased skills stay rank2. The1500 gold is a deliberate testing
 * budget, not a claim about a typical human campaign.
 */
import {PlayerProfile, summonSquad} from './engine/progression.mjs';
import {seededRandom} from './engine/combat.mjs';

export const MIDGAME_DEMO = Object.freeze({
  id: 'midgame-13-v3',
  label: 'Midgame Demo · Assisted',
  level: 13,
  rank: 8,
  basicRank: 8,
  skillRank: 2,
  startingGold: 1500,
  seed: 131,
  prerollTicks: 1350,
  tickHz: 33,
  skills: Object.freeze(['arrow','fireArrow','iceArrow','bombArrow','flakArrow','grunt','archer','priest','tallGrunt','mount','trebuchet']),
  initialSquads: Object.freeze(['tallGrunt','archer','priest','trebuchet']),
  autoRecruit: Object.freeze(['tallGrunt','archer','priest','trebuchet']),
});
const demoProfiles = new WeakSet();
const preparedBattles = new WeakSet();
const demoRandoms = new WeakMap();
const shootingModes = new Set(['classic','anywhere','point_aim','auto_aim']);

/** Always returns a fresh profile, without copying or modifying a campaign. */
export function createMidgameDemoProfile({shootingMode = 'classic'} = {}) {
  if (!shootingModes.has(shootingMode)) throw new RangeError('Unknown demo aiming mode');
  const profile = new PlayerProfile('Midgame Demo');
  Object.assign(profile, {
    rank: MIDGAME_DEMO.rank,
    gold: MIDGAME_DEMO.startingGold,
    level: MIDGAME_DEMO.level,
    scene: MIDGAME_DEMO.level + 1,
    highestLevel: MIDGAME_DEMO.level,
    highestScene: MIDGAME_DEMO.level + 1,
    difficulty: 'medium',
    shootingMode,
    cheated: true,
  });
  for (const id of MIDGAME_DEMO.skills) {
    const skill = profile.skills.find(s => s.id === id) ?? profile.addSkill(id);
    skill.rank = id==='arrow'?MIDGAME_DEMO.basicRank:MIDGAME_DEMO.skillRank;
    skill.threshold = (skill.rank + 1) * 100;
    skill.cooldown = 0;
    skill.autocast = MIDGAME_DEMO.autoRecruit.includes(id);
  }
  // Victories, defeats, player XP and skill XP start at zero. Only real actions
  // during the simulated opening can add skill XP. No completed battles added.
  demoProfiles.add(profile);
  return profile;
}

export function isMidgameDemoProfile(profile) {
  return demoProfiles.has(profile);
}

/** Pass to the existing CampaignBattle constructor, adding onEvent if needed.
 * Each call has independent profile and RNG state. Do not replace this RNG after
 * construction: roster and wave generation already consume it in the constructor.
 */
export function createMidgameDemoBattleOptions(options = {}) {
  const profile = createMidgameDemoProfile(options);
  const random = seededRandom(MIDGAME_DEMO.seed);
  demoRandoms.set(profile, random);
  return {profile, level: MIDGAME_DEMO.level, random, testing: false};
}

/** Prepare only a fresh battle owned by this demo helper. No hidden invulnerability,
 * health refill, unit teleport, roster replacement, kill, outcome or score edit.
 * Supply UI event listeners after preparation if opening event effects should not
 * be replayed. Returns a small setup receipt; the battle remains the passed object.
 */
export function prepareMidgameDemoBattle(battle) {
  if (!battle || !demoProfiles.has(battle.profile))
    throw new TypeError('Expected a fresh temporary midgame demo profile');
  if (battle.random !== demoRandoms.get(battle.profile))
    throw new Error('Construct the demo using its fresh seeded battle options');
  if (preparedBattles.has(battle) || battle.tick !== 0 || battle.outcome || battle.summary)
    throw new Error('The midgame demo opening has already started');
  if (battle.level !== MIDGAME_DEMO.level || battle.profile.rank !== MIDGAME_DEMO.rank ||
      battle.profile.difficulty !== 'medium' || battle.protectedTesting || battle.paused)
    throw new Error('The midgame demo requires its ordinary unprotected Battle 13 setup');
  if (battle.profile.gold !== MIDGAME_DEMO.startingGold || battle.friendlyQueue.population !== 10+MIDGAME_DEMO.rank*10 ||
      battle.friendlyQueue.queue.length || battle.goodTeam.length !== 1 || battle.badTeam.length)
    throw new Error('The midgame demo requires a fresh battle before squads are deployed');
  const skills = MIDGAME_DEMO.initialSquads.map(id => battle.profile.skills.find(s => s.id === id));
  if (skills.some(skill => !skill || skill.cooldown !== 0 || skill.autocast!==MIDGAME_DEMO.autoRecruit.includes(skill.id)))
    throw new Error('The midgame demo initial squads must be ready with its configured recruitment');

  // Use the ordinary queue:3 heavy soldiers +4 archers +2 priests +1 trebuchet
  // cost150 gold and10 reserve recruits. The configured auto mix keeps recruiting
  // through ordinary cooldown/queue/cap limits during the elapsed opening.
  for (const skill of skills) {
    if (!summonSquad(skill, battle.profile, battle.friendlyQueue, battle.stats))
      throw new Error(`Could not summon the midgame demo ${skill.id} squad`);
  }
  preparedBattles.add(battle);
  for (let tick = 0; tick < MIDGAME_DEMO.prerollTicks; tick++) {
    battle.step();
    if (battle.outcome || battle.summary)
      throw new Error('The midgame demo ended during its opening; rebuild a fresh demo');
  }
  // A fresh multi-page Hotbar defaults to its last populated page. Start this
  // demonstration on the ten-slot core page, with Basic Arrow ready.
  if(battle.hotbar.bar!==0)battle.hotbar.change(1);
  battle.activeSkill=battle.hotbar.active;
  return Object.freeze({
    id: MIDGAME_DEMO.id,
    assisted: true,
    level: battle.level,
    seed: MIDGAME_DEMO.seed,
    ticks: battle.tick,
    simulatedSeconds: battle.tick / MIDGAME_DEMO.tickHz,
    squadGoldSpent: battle.stats.goldSpent,
    remainingGold: battle.profile.gold,
    populationGiven: battle.stats.populationGiven,
    populationRemaining: battle.friendlyQueue.population,
  });
}
