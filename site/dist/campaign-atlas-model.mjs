/** Original Crownroad campaign identity, derived from the real 30 battle tables.
 * No progress store: the existing profile frontier remains the source of truth.
 * Inspecting/replaying a battle never awards progress, gold, cards or badges.
 */
import {getLevel} from './engine/levels.mjs';
export const CAMPAIGN_ID='crownroad';
export const CAMPAIGN_NAME='The Crownroad';
export const CAMPAIGN_REGIONS=Object.freeze([
 {id:'hearthwood',name:'Hearthwood',first:1,last:6,scenery:'oaks',color:'#88a873',landmark:'The Oak Gate',description:'Oak valleys give way to steep ridges. Hold the first road against foot soldiers, cavalry and the first winged raiders.'},
 {id:'bannerfen',name:'Bannerfen',first:7,last:15,scenery:'lowlands',color:'#d2b471',landmark:'The Lowland Crossing',description:'Rolling lowlands and larger siege companies. Dragons begin to join the reserve as the road turns north.'},
 {id:'frostpine',name:'Frostpine',first:16,last:23,scenery:'pines',color:'#8fb8bc',landmark:'The Pinewatch',description:'Broken pine country guarded by mixed elemental forces. Choose your damage types and keep the flag route open.'},
 {id:'cinderlands',name:'Cinderlands',first:24,last:30,scenery:'wasteland',color:'#cc8c73',landmark:'The Ashen Throne',description:'The final wasteland road. Large finite reserves defend the keep, with Gorath waiting at the last stronghold.'},
].map(Object.freeze));
const names=[
 'First Light','The Long Meadow','Oak Hollow','Crown Ridge','Nightwatch Hill','The Oak Gate',
 'The Lowland Crossing','Speargrass Rise','Sunken Road','Ember Overwatch','Reedguard','The King’s Mile','Bannerfall','The Drake Road','Last Light at the Fen',
 'Pinewatch Dawn','The Elemental Pass','Needlewood','The Broken Ridge','Cold Vigil','Northwind Road','The Frostbound Gate','Beyond the Pines',
 'Ashfall','Cinder Watch','The Black Road','Coalwater','Broken Crown','The Last Approach','The Ashen Throne',
];
const advice=[
 'Start with the bow. Earn gold from hits, defend your home flag, and watch the first mixed patrols.',
 'The ground rises toward the enemy. Adjust your arc rather than repeating the opening shot.',
 'More heavy infantry join the reserve. Head shots and sustained fire help break their advance.',
 'A high central ridge blocks low shots. Use a lofted arc to reach the far side.',
 'Cavalry and winged raiders arrive here. Watch the sky while protecting the flag route.',
 'The healer contingent expands. Pick off priests before their escorts turn into a long fight.',
 'Siege escorts become more common. Protect your keep and cut off the enemy’s supply line.',
 'A broad central rise changes long shots. Use the terrain preview to plan your firing position.',
 'Mixed companies cover the road. Guard against cavalry slipping past your front line.',
 'Elemental dragons can now join the reserve. Inspect the actual company before choosing your loadout.',
 'Air and ground pressure overlap. Keep an answer for targets above your infantry.',
 'A deep valley separates the strongholds. High shots can reach beyond the near ridge.',
 'Both armies can field more units here. Spend reserve recruits deliberately; they are finite.',
 'The lowlands are crowded with support troops. Removing healers weakens a defended advance.',
 'The last lowland field mixes dragons and siege engines. Elemental counters reward preparation.',
 'Your first pine-country position faces a broken skyline. Check that your arrow clears each rise.',
 'Elemental demons can join the enemy reserve. Inspect resistances and avoid relying on one damage type.',
 'A mixed elemental host can emerge. Keep both air coverage and a ground defense ready.',
 'The rough middle ground shelters approaching troops. Reposition only when your home flag is secure.',
 'The night road holds a deep reserve. Destroying the keep prevents regular reinforcements from entering.',
 'Priests, siege engines and flyers all support this army. Focus a threat rather than spreading every shot.',
 'Protect your flag carrier on the return journey. The enemy can rally a relief company around its flag.',
 'The final pine battle precedes the wasteland. Check your reserve and arrange your strongest cards.',
 'The first ash field is sharply broken. Aim above nearby ground before judging distant range.',
 'Dense mixed reserves defend the road. Closing the keep’s supply route avoids fighting every regular unit.',
 'Use the high points carefully. Your hero is vulnerable outside a friendly garrison.',
 'Elemental forces support a large infantry reserve. Change tools when resistance feedback appears.',
 'A deeply cut central valley makes flat shots unreliable. Follow the actual terrain line in the brief.',
 'The final approach offers little easy ground. Preserve recruits for a coordinated push to the keep.',
 'Gorath guards the final field. Breaking the keep cuts regular reserves, but the boss still makes a final stand.',
];
const labels={grunt:'Foot soldiers',tallGrunt:'Heavy infantry',archer:'Archers',priest:'Priests',trebuchet:'Trebuchets',mount:'Cavalry',air:'Winged raiders',fireDragon:'Fire dragons',iceDragon:'Ice dragons',poisonDragon:'Poison dragons',fireDemon:'Fire demons',iceDemon:'Ice demons',gorath:'Gorath'};
export function regionForBattle(level){getLevel(level);return CAMPAIGN_REGIONS.find(region=>level>=region.first&&level<=region.last);}
export function campaignFrontier(profile){const level=Number.isSafeInteger(profile?.highestLevel)?profile.highestLevel:1;return Math.min(31,Math.max(1,level));}
export function campaignProgress(profile){const frontier=campaignFrontier(profile),cleared=frontier-1;return {frontier,cleared,complete:frontier===31,assisted:profile?.cheated===true,regions:CAMPAIGN_REGIONS.map(region=>({...region,cleared:Math.max(0,Math.min(region.last-region.first+1,cleared-region.first+1)),total:region.last-region.first+1,state:frontier>region.last?'complete':frontier>=region.first?'current':'locked'}))};}
export function encounterBrief(level,{profile=null,battle=null}={}){
 const data=getLevel(level),region=regionForBattle(level),frontier=campaignFrontier(profile);
 const actual=battle?.level===level?battle.enemies?.roster:null;
 const count=actual?actual.reduce((counts,type)=>(counts[type]=(counts[type]??0)+1,counts),{}):null;
 const threats=Object.keys(labels).flatMap(id=>{const fixed=data.fixedCounts[id]??0,random=data.randomCounts[id],maximum=fixed+(random?.draw?Math.max(0,random.limit-1):0),minimum=fixed;if(!maximum)return [];return [{id,name:labels[id],minimum,maximum,count:count?(count[id]??0):null}];});
 return {level,name:names[level-1],advice:advice[level-1],region,timeOfDay:data.timeOfDay==='default'?'Daylight':data.timeOfDay[0].toUpperCase()+data.timeOfDay.slice(1),
  status:frontier>level?'cleared':frontier===level?'frontier':'locked',replay:level<frontier,unlocked:level<=frontier,complete:frontier===31,
  threats,armySize:actual?actual.length:null,enemyBounds:[...data.enemyBounds],heights:[...data.heights],
  objective:'Bring their flag home while yours is safe, or defeat all remaining enemies.',
  failure:'Keep your hero alive and stop the enemy returning your home flag.',
  siege:'Destroying the enemy keep cuts off regular reserves. The field army still has to be defeated.',
  reward:level===30?'Final victory completes the Crownroad. Combat earnings stay with your profile; this final battle has no summary bonus.':'Gold and experience from combat, plus a victory bonus based on accuracy, head shots, spending and unused reserve.',
 };
}
export function canPrepareEncounter({profile,level,started=false,summary=null,destination='campaign'}={}){
 return destination==='campaign'&&Number.isInteger(level)&&level>=1&&level<=30&&level<=campaignFrontier(profile)&&campaignFrontier(profile)<=30&&(!started||!!summary);
}
export function campaignBattleSnapshot(profile){return {frontier:campaignFrontier(profile),rank:profile.rank,gold:profile.gold};}
/** Feedback only. Rewards have already been applied exactly once by the engine. */
export function campaignSettlement(battle,before={}){
 if(!battle?.summary)return null;
 const {summary,profile}=battle,won=summary.outcome==='victory',region=regionForBattle(battle.level),frontier=campaignFrontier(profile),oldFrontier=before.frontier??Math.min(frontier,battle.level),advanced=won&&frontier>oldFrontier;
 const combatGold=battle.stats.goldEarned??0,spentGold=battle.stats.goldSpent??0,bonusGold=summary.gold??0,bonusXP=summary.xp??0;
 const nextRegion=advanced&&battle.level===region.last&&battle.level<30?regionForBattle(battle.level+1):null;
 return {won,assisted:profile.cheated===true,name:names[battle.level-1],level:battle.level,region,combatGold,spentGold,bonusGold,bonusXP,netGold:combatGold+bonusGold-spentGold,rankGained:Math.max(0,profile.rank-(before.rank??profile.rank)),frontier,advanced,nextRegion,
  headline:summary.campaignComplete?'The Crownroad is complete':nextRegion?`${region.name} secured · ${nextRegion.name} opens`:won?advanced?`Battle ${frontier} is now open`:'Replay complete · frontier preserved':'Regroup and try again',
  nextLabel:summary.campaignComplete?'Campaign complete':won&&battle.level<oldFrontier?`Return to frontier · Battle ${frontier}`:won?`Continue to battle ${frontier}`:'Retry battle',
 };
}
export function terrainProfilePoints(heights){const min=Math.min(...heights),max=Math.max(...heights),span=Math.max(120,max-min);return heights.map((height,index)=>`${(index/(heights.length-1)*600).toFixed(1)},${(22+(height-min)/span*100).toFixed(1)}`).join(' ');}
