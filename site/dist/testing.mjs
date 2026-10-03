/** Explicit modern QA aids. All mutations require a marked, separate test battle.
 * They are not original mechanics, earned achievements, or authentication.
 */
import {COMPANIONS} from './engine/recruitment.mjs';
import {SKILLS} from './engine/progression.mjs';
const requireTest=battle=>{
  if(battle?.testing!==true||battle.profile?.cheated!==true)throw new Error('Assisted testing is not enabled for this battle');
};
export function markTestingProfiles(manager){for(const profile of [...manager.profiles,...manager.retired])profile.cheated=true;}
export function grantTestGold(battle,amount=10000){requireTest(battle);if(![1000,10000].includes(amount))throw new RangeError('Unsupported testing grant');battle.profile.gold=Math.min(Number.MAX_SAFE_INTEGER,battle.profile.gold+amount);return battle.profile.gold;}
export function unlockTestSkills(battle){requireTest(battle);for(const id of Object.keys(SKILLS)){if(!battle.profile.owned.has(id))battle.profile.addSkill(id);}for(const id of Object.keys(COMPANIONS))battle.profile.companionOwned.add(id);battle.profile.companionId??=Object.keys(COMPANIONS)[0];for(const skill of battle.profile.skills)skill.autocast=false;battle.refreshHotbar();readyTestSkills(battle);}
export function readyTestSkills(battle){requireTest(battle);for(const skill of battle.profile.skills)skill.cooldown=0;if(battle.companions){battle.companions.recoveryTicks=0;if(battle.companions.unit)battle.companions.unit.signatureCooldown=0;}}
export function protectTestBattle(battle,enabled){requireTest(battle);battle.protectedTesting=!!enabled;return battle.protectedTesting;}
export function finishTestBattle(battle,outcome){requireTest(battle);if(!['victory','defeat'].includes(outcome))throw new RangeError('Unsupported testing outcome');return battle.finishOutcome(outcome);}
export function selectTestLevel(profile,level){if(profile.cheated!==true)throw new Error('An assisted profile is required');if(!Number.isInteger(level)||level<1||level>30)throw new RangeError('Choose battle 1 through 30');profile.level=profile.highestLevel=level;profile.scene=profile.highestScene=level+1;return level;}
