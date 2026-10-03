/** Opt-in assisted recruitment showcase, never normal campaign progression.
 * Keeps the ordinary midgame demo intact; this variant supplies one Fire Dragon
 * and Gorath ownership, replacing at most one ordinary opening troop if full.
 */
import {createMidgameDemoBattleOptions,prepareMidgameDemoBattle} from './midgame-demo.mjs';
const showcaseProfiles=new WeakSet();
export function createRecruitShowcaseOptions(options={}){
 const launch=createMidgameDemoBattleOptions(options),p=launch.profile;
 const flyer=p.addSkill('fireDragon');flyer.rank=2;flyer.threshold=300;flyer.cooldown=0;flyer.autocast=false;
 p.companionOwned.add('gorath');p.companionId='gorath';p.cheated=true;p.name='Allies Demo';showcaseProfiles.add(p);return launch;
}
export function prepareRecruitShowcaseBattle(battle){
 if(!showcaseProfiles.has(battle?.profile))throw new TypeError('Expected an assisted recruit showcase profile');
 const opening=prepareMidgameDemoBattle(battle);
 let replaced=null;if(battle.regularArmyCount>=battle.friendlyQueue.cap){replaced=battle.goodTeam.find(u=>u!==battle.hero&&!u.isCompanion&&!u.holdingFlag?.());if(!replaced)throw new Error('No free showcase army slot');replaced.destroy();}
 const skill=battle.profile.skills.find(s=>s.id==='fireDragon'),flyer=battle.createUnit('fireDragon',{team:'good',rank:skill.rank,skill});
 flyer.x=battle.goodCastle.x+230;flyer.y=battle.elevationAt(flyer.x)-220;battle.updateGeometry(flyer);
 const fire= battle.profile.skills.find(s=>s.id==='fireArrow');battle.hotbar.bar=0;battle.hotbar.active=fire;battle.hotbar.glow=fire.binding%10;battle.activeSkill=fire;
 return {...opening,id:'recruit-companion-showcase-v1',suppliedFlyer:'fireDragon',suppliedCompanion:'gorath',replacedTroop:replaced?.type??null};
}
