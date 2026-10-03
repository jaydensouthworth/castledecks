/** Player-facing summaries of existing state; no simulation mutations. */
import {FLAG_STATUS as F} from './engine/flag-troop.mjs';
import {SKILLS} from './engine/progression.mjs';
export function flagDescription(flag){
 if(flag.status===F.AT_BASE)return 'at base';
 if(flag.status===F.GROUNDED)return 'on the ground';
 if(flag.status===F.CAPTURED)return 'captured';
 return flag.holder?.team==='good'?'allied carrier':flag.holder?.team==='bad'?'enemy carrier':'being carried';
}
export function heroExperience(profile){const threshold=profile.rank<=25?profile.rank*500:null;return {text:threshold?`${profile.xp} / ${threshold} XP`:'Rank cap reached',fraction:threshold?Math.max(0,Math.min(1,profile.xp/threshold)):1};}
export function summonMessage(skill,profile,queue){const config=SKILLS[skill.id]?.summon;if(!config)return '';if(skill.cooldown>0)return `${SKILLS[skill.id].name} reloads in ${Math.ceil(skill.cooldown/66)}s`;if(profile.gold<config.cost)return `Need ${config.cost} gold to summon ${SKILLS[skill.id].name}`;if(queue.queue.length>=queue.capacity)return 'Reinforcement queue is full';if(queue.population<config.population*config.amount)return `Need ${config.population*config.amount} population for this squad`;return `${SKILLS[skill.id].name} squad queued · ${config.cost} gold`;}
