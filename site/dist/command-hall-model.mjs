/** Read-only preparation view. Browsing never changes a profile, route or battle. */
import {SKILLS} from './engine/progression.mjs';
import {COMPANIONS} from './engine/recruitment.mjs';
import {campaignProgress,encounterBrief} from './campaign-atlas-model.mjs';
export const HALL_REALMS=Object.freeze({campaign:{label:'The Crownroad',crest:'♜',subtitle:'Thirty fields · earned campaign'},expedition:{label:'Wayfarer Charter',crest:'⚑',subtitle:'Four legs · branching expedition'},skirmish:{label:'Seeded Skirmish',crest:'⚔',subtitle:'Repeatable fields · supplied kit'},training:{label:'Training grounds',crest:'◎',subtitle:'Guided drills · assisted practice'}});
export const hallRealm=id=>['allies','midgame'].includes(id)?'training':id;
export function hallPreparation({profile,battle,destination='campaign',run=null,decks=[]}={}){
 if(!profile||!battle)return null;
 const equipped=(profile.skills??[]).filter(s=>Number.isInteger(s.binding)&&s.binding>=0&&s.binding<30).sort((a,b)=>a.binding-b.binding),contracts=equipped.filter(s=>SKILLS[s.id]?.summon),arrows=equipped.filter(s=>!SKILLS[s.id]?.summon),slots=Array(30).fill(null);
 for(const s of equipped)slots[s.binding]=s.id;
 const matched=decks.find(d=>d.companion===(profile.companionId??null)&&d.slots?.length===30&&d.slots.every((id,i)=>id===slots[i]));
 const brief=destination==='campaign'?encounterBrief(Math.min(30,Math.max(1,battle.level)),{profile,battle}):null;
 let title=brief?.name??run?.current?.name??battle.skirmish?.name??`Battle ${battle.level}`,objective=brief?.objective??run?.current?.objectiveText??'Protect your flag and hero. Defeat the company or bring the enemy flag home.',advice=brief?.advice??run?.current?.tradeoff??'Practice supplies belong to this session. Inspect the field and arrange your action bars before departing.';
 const roster=battle.enemies?.roster??battle.skirmish?.encounter?.roster??[],threats=brief?.threats.filter(t=>(t.count??t.maximum)>0).map(t=>({name:t.name,count:t.count}))??Object.entries(roster.reduce((a,id)=>(a[id]=(a[id]??0)+1,a),{})).map(([id,count])=>({name:SKILLS[id]?.name??id.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase()),count}));
 const progress=brief?campaignProgress(profile):null;
 const queue=battle.friendlyQueue;
 return {name:profile.name,rank:profile.rank,gold:Math.floor(profile.gold),equipped,contracts,arrows,deckName:matched?.name??'Current arrangement',savedDecks:decks.length,companion:COMPANIONS[profile.companionId]?.name??null,title,objective,advice,threats,progress,run,region:brief?.region.name??(destination==='expedition'?'Border country':destination==='skirmish'?'Practice field':'Training grounds'),reserve:queue?.population??0,fieldCap:queue?.cap??0,fieldCount:battle.regularArmyCount??0,waiting:queue?.queue?.length??0,automatic:contracts.filter(s=>s.autocast).length,phase:battle.summary?'settled':battle.paused&&battle.tick>0?'paused':'ready',hasAttack:arrows.length>0};
}
