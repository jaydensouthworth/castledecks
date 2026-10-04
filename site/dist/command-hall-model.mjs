import {LEVY_BRIEF} from './levy-presentation.mjs';
/** Read-only preparation view. Browsing never changes a profile, route or battle. */
import {BATTERY_BRIEF} from './objective-feedback.mjs';
import {SKILLS} from './engine/progression.mjs';
import {COMPANIONS} from './engine/recruitment.mjs';
import {CASTLE_CATALOG} from './engine/castle-catalog.mjs';
import {campaignProgress,encounterBrief} from './campaign-atlas-model.mjs';
export const HALL_REALMS=Object.freeze({campaign:{label:'The Crownroad',crest:'♜',subtitle:'Thirty fields · earned campaign'},expedition:{label:'Wayfarer Charter',crest:'⚑',subtitle:'Four legs · branching expedition'},skirmish:{label:'Seeded Skirmish',crest:'⚔',subtitle:'Repeatable fields · supplied kit'},training:{label:'Training grounds',crest:'◎',subtitle:'Guided drills · assisted practice'}});
export const hallRealm=id=>['allies','midgame'].includes(id)?'training':id;
export function hallPreparation({profile,battle,destination='campaign',run=null,decks=[]}={}){
 if(!profile||!battle)return null;
 const equipped=(profile.skills??[]).filter(s=>Number.isInteger(s.binding)&&s.binding>=0&&s.binding<30).sort((a,b)=>a.binding-b.binding),contracts=equipped.filter(s=>SKILLS[s.id]?.summon),arrows=equipped.filter(s=>!SKILLS[s.id]?.summon),slots=Array(30).fill(null);
 for(const s of equipped)slots[s.binding]=s.id;
 const matched=decks.find(d=>d.companion===(profile.companionId??null)&&(d.castle?.id??'classic')===(profile.castleId??'classic')&&d.slots?.length===30&&d.slots.every((id,i)=>id===slots[i]));
 const brief=destination==='campaign'?encounterBrief(Math.min(30,Math.max(1,battle.level)),{profile,battle}):null;
 let title=brief?.name??run?.current?.name??battle.skirmish?.name??`Battle ${battle.level}`,objective=brief?.objective??run?.current?.objectiveText??'Protect your flag and hero. Defeat the company or bring the enemy flag home.',advice=brief?.advice??run?.current?.tradeoff??'Practice supplies belong to this session. Inspect the field and arrange your action bars before departing.';
 if(destination==='skirmish'&&battle.objectiveProgress?.type==='intercept-battery'){title=`${battle.skirmish.name} · ${BATTERY_BRIEF.title}`;objective=BATTERY_BRIEF.goal;advice=`${BATTERY_BRIEF.opening} ${BATTERY_BRIEF.counterplay}`;}
 if(destination==='skirmish'&&battle.skirmish?.castlePractice){title=`${battle.skirmish.name} · Highwatch comparison`;objective='Break their keep, clear the deployed company and recover your home flag. Protect your hero, home keep and flag; enemy flag capture alone cannot win.';advice='Both castle cards are supplied. Compare their firing station, health and shelter in Build before Start. Ordinary enemy archers may leave their opening shelter immediately; this is not a stationary turret challenge.';}
 if(destination==='skirmish'&&battle.auxiliaries){title=`${battle.skirmish.name} · ${LEVY_BRIEF.title}`;objective=LEVY_BRIEF.goal;advice=LEVY_BRIEF.advice;}
 const roster=battle.enemies?.roster??battle.skirmish?.encounter?.roster??[],threats=brief?.threats.filter(t=>(t.count??t.maximum)>0).map(t=>({name:t.name,count:t.count}))??Object.entries(roster.reduce((a,id)=>(a[id]=(a[id]??0)+1,a),{})).map(([id,count])=>({name:SKILLS[id]?.name??id.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase()),count}));
 const progress=brief?campaignProgress(profile):null;
 const queue=battle.friendlyQueue;
 return {name:profile.name,rank:profile.rank,gold:Math.floor(profile.gold),equipped,contracts,arrows,deckName:matched?.name??'Current arrangement',savedDecks:decks.length,castle:CASTLE_CATALOG[profile.castleId??'classic'].name,companion:COMPANIONS[profile.companionId]?.name??null,title,objective,advice,threats,progress,run,region:brief?.region.name??(destination==='expedition'?'Border country':destination==='skirmish'?'Practice field':'Training grounds'),reserve:queue?.population??0,fieldCap:queue?.cap??0,fieldCount:battle.regularArmyCount??0,waiting:queue?.queue?.length??0,automatic:contracts.filter(s=>s.autocast).length,phase:battle.summary?'settled':battle.paused&&battle.tick>0?'paused':'ready',hasAttack:arrows.length>0};
}
