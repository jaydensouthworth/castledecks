/** Versioned, bounded practice fields. No campaign state, storage or live actors.
 * A seed fixes terrain, finite company, light and towers; combat still reacts to
 * the player's actions. The sampled Auto check is not a promise of an easy win.
 */
import {levyStages} from './engine/levy-encounter.mjs';
import {seededRandom} from './engine/combat.mjs';
import {validateBattleEncounter} from './engine/battle-encounter.mjs';
import {BATTERY_OBJECTIVE} from './engine/battery-objective.mjs';
import {validateAutoAimZones} from './engine/assisted-auto-aim.mjs';
export const SKIRMISH_VERSION=1;
export const SKIRMISH_BIOMES=Object.freeze({
 oaks:Object.freeze({name:'Oak March',color:'#afbd80',description:'Long rolling lanes with broad sheltering crests.'}),
 lowlands:Object.freeze({name:'Sunken Fen',color:'#74bfb4',description:'Low bowls and raised causeways change the line of sight.'}),
 pines:Object.freeze({name:'Pine Divide',color:'#a7bdcf',description:'Sharper paired ridges make forward positions matter.'}),
 wasteland:Object.freeze({name:'Cinder Reach',color:'#d79b78',description:'Uneven mesas and a broken central saddle.'}),
});
export const SKIRMISH_THREATS=Object.freeze({
 scout:Object.freeze({name:'Scouting force',level:4,difficulty:'easy',base:17,variance:6,keepHP:4400,description:'A shorter company and gentler pressure. A good first field.'}),
 standard:Object.freeze({name:'Border company',level:6,difficulty:'medium',base:25,variance:8,keepHP:6000,description:'A mixed company that rewards leading shots and a balanced army.'}),
 veteran:Object.freeze({name:'Veteran company',level:8,difficulty:'hard',base:33,variance:9,keepHP:7400,description:'More reserves and faster pressure. Counters and flag defense matter.'}),
});
export const SKIRMISH_DOCTRINES=Object.freeze({
 levy:Object.freeze({name:'Levy defense',description:'Four manual five-unit levy waves join an ordinary paid army. Hold against a timed rider and siege counterattack, break their keep, then clear the field. Losing your hero, home flag or home keep defeats this practice attempt.'}),
 vanguard:Object.freeze({name:'Vanguard',description:'Mounted flag runners backed by heavy infantry. Watch the ground lanes.'}),
 skywatch:Object.freeze({name:'Skywatch',description:'A smaller ground escort with aerial pressure. Lead flyers and keep elemental counters ready.'}),
 siege:Object.freeze({name:'Siege train',description:'Slow artillery and healer-supported infantry. Disrupt the escort before it reaches your keep.'}),
 battery:Object.freeze({name:'Battery interception',description:'Silence two marked ordinary trebuchets. Infantry, healers and riders screen the battery. Protect your hero and home flag; taking their flag or breaking their keep does not finish this challenge.'}),
});
export const SKIRMISH_KIT=Object.freeze({rank:6,basicRank:5,skillRank:2,gold:1200,reserve:70,skills:Object.freeze(['arrow','fireArrow','iceArrow','bombArrow','flakArrow','grunt','archer','priest','mount','trebuchet']),autoRecruit:Object.freeze([])});
export const DEFAULT_SKIRMISH=Object.freeze({version:1,seed:73421,biome:'oaks',threat:'standard',doctrine:'vanguard'});
const keys=['version','seed','biome','threat','doctrine'];
const has=(object,key)=>typeof key==='string'&&Object.hasOwn(object,key);
export function validateSkirmishDescriptor(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError('Use a complete Skirmish seed code.');
 const properties=Object.getOwnPropertyDescriptors(value);
 if(Reflect.ownKeys(properties).length!==keys.length||keys.some(key=>!Object.hasOwn(properties,key)||!Object.hasOwn(properties[key],'value')))throw new TypeError('Use a complete Skirmish seed code.');
 value=Object.fromEntries(keys.map(key=>[key,properties[key].value]));
 if(value.version!==SKIRMISH_VERSION)throw new RangeError('This seed code belongs to a different Skirmish version.');
 if(!Number.isSafeInteger(value.seed)||value.seed<1||value.seed>0xffffffff)throw new RangeError('Seed must be a whole number from 1 to 4294967295.');
 if(!has(SKIRMISH_BIOMES,value.biome)||!has(SKIRMISH_THREATS,value.threat)||!has(SKIRMISH_DOCTRINES,value.doctrine))throw new RangeError('Unknown Skirmish biome, company size or doctrine.');
 return Object.freeze(Object.fromEntries(keys.map(key=>[key,value[key]])));
}
export function encodeSkirmishDescriptor(value){const d=validateSkirmishDescriptor(value);return `SK${d.version}:${d.seed.toString(36).toUpperCase()}:${d.biome}:${d.threat}:${d.doctrine}`;}
export function decodeSkirmishDescriptor(text){
 if(typeof text!=='string'||text.length>100)throw new TypeError('Enter a Skirmish seed code under 100 characters.');
 const match=/^SK([1-9][0-9]*):([0-9A-Z]{1,7}):(oaks|lowlands|pines|wasteland):(scout|standard|veteran):(vanguard|skywatch|siege|battery|levy)$/i.exec(text.trim());
 if(!match)throw new TypeError('That is not a complete Skirmish seed code.');
 const seed=parseInt(match[2],36),value=validateSkirmishDescriptor({version:Number(match[1]),seed,biome:match[3].toLowerCase(),threat:match[4].toLowerCase(),doctrine:match[5].toLowerCase()});
 if(encodeSkirmishDescriptor(value).split(':')[1]!==match[2].toUpperCase())throw new TypeError('Seed code has a noncanonical number.');
 return value;
}
export function skirmishFromSearch(search){const params=new URLSearchParams(search);return params.has('sk')?decodeSkirmishDescriptor(params.get('sk')):DEFAULT_SKIRMISH;}
export function skirmishURL(value){return './battle?mode=skirmish&sk='+encodeURIComponent(encodeSkirmishDescriptor(value));}
export function randomSkirmishSeed(random=Math.random){const sample=random();if(!Number.isFinite(sample)||sample<0||sample>=1)throw new RangeError('Invalid random sample');return 1+Math.floor(sample*0xffffffff);}
function stream(d,tag){let seed=d.seed;for(const c of `${d.version}:${d.biome}:${d.threat}:${d.doctrine}:${tag}`)seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;return seededRandom(seed||1);}
export function skirmishCombatRandom(d){return stream(validateSkirmishDescriptor(d),'combat');}
const lerp=(a,b,t)=>a+(b-a)*t;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function skirmishElevation(heights,x){const index=clamp(x/20,0,100),i=Math.min(99,Math.floor(index));return lerp(heights[i],heights[i+1],index-i);}
function makeTerrain(d,attenuation=1){
 const r=stream(d,'terrain'),baseline=665+Math.round(r()*45),phase=r()*Math.PI*2,roll=24+r()*34,frequency=1+r()*1.2;
 const leftCenter=.34+r()*.11,rightCenter=.61+r()*.12,leftHeight=35+r()*60,rightHeight=35+r()*70;
 const gaussian=(x,c,w)=>Math.exp(-(((x-c)/w)**2));
 let raw=Array.from({length:101},(_,i)=>{
  const x=i/100,base=roll*Math.sin(frequency*2*Math.PI*x+phase);
  const shape=d.biome==='oaks'?-leftHeight*gaussian(x,leftCenter,.20)+rightHeight*.45*gaussian(x,rightCenter,.18):d.biome==='lowlands'?90*Math.sin(Math.PI*x)-45*gaussian(x,leftCenter,.11):d.biome==='pines'?-leftHeight*gaussian(x,leftCenter,.11)-rightHeight*gaussian(x,rightCenter,.12):-leftHeight*gaussian(x,leftCenter,.16)+rightHeight*.6*gaussian(x,.53,.09)-rightHeight*gaussian(x,rightCenter,.13);
  return clamp(baseline+(base+shape)*attenuation,530,800);
 });
 // Keep castle footprints and flags on wide, level home aprons. There are no
 // discontinuous cliffs: blend the approach through a bounded smoothstep.
 const plateau=(center,radius)=>{const y=raw[center];raw=raw.map((h,i)=>{const distance=Math.abs(i-center);if(distance<=radius)return y;if(distance>=radius+6)return h;const t=(distance-radius)/6,w=t*t*(3-2*t);return lerp(y,h,w);});};
 plateau(17,5);plateau(90,6);
 // Pin both full home aprons first. Clamp every other sample to the
 // intersection of their slope cones, then project neighboring slopes. This
 // preserves the level castle/flag pads even when the unconstrained land rises
 // steeply beside one; a plain sequential slope clamp would move the pads.
 const anchors=[...Array.from({length:11},(_,i)=>[12+i,raw[17]]),...Array.from({length:13},(_,i)=>[84+i,raw[90]])];
 raw=raw.map((h,i)=>clamp(h,Math.max(...anchors.map(([a,y])=>y-8*Math.abs(i-a))),Math.min(...anchors.map(([a,y])=>y+8*Math.abs(i-a)))));
 for(let i=1;i<raw.length;i++)raw[i]=clamp(raw[i],raw[i-1]-8,raw[i-1]+8);
 for(let i=raw.length-2;i>=0;i--)raw[i]=clamp(raw[i],raw[i+1]-8,raw[i+1]+8);
 return raw.map(h=>Math.round(h*100)/100);
}
function makeCompany(d){
 const r=stream(d,'company'),tier=Object.keys(SKIRMISH_THREATS).indexOf(d.threat),spec=SKIRMISH_THREATS[d.threat],count=spec.base+Math.floor(r()*(spec.variance+1));
 if(d.doctrine==='battery'){
  // Original optional challenge: a smaller, finite escort around two ordinary
  // predeployed engines. No extra armor, enemy buffs, reinforcements or kit.
  const counts={grunt:5+tier*2+Math.floor(r()*3),tallGrunt:1+tier,archer:1+tier,priest:1+(tier>0?1:0),mount:2+tier,trebuchet:2};
  const roster=Object.entries(counts).flatMap(([type,n])=>Array(n).fill(type));
  for(let i=roster.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[roster[i],roster[j]]=[roster[j],roster[i]];}
  return {counts,roster};
 }
 const counts={grunt:Math.max(8,count-8-2*tier),archer:2+Math.floor(r()*3),priest:1+(tier>0?1:0),tallGrunt:1+Math.floor(r()*3)};
 if(d.doctrine==='vanguard'){counts.mount=3+tier+Math.floor(r()*3);counts.tallGrunt+=tier;}
 if(d.doctrine==='skywatch'){counts.air=2+tier;counts.mount=1;if(tier>0)counts[d.biome==='pines'?'iceDragon':d.biome==='wasteland'?'fireDragon':r()<.5?'iceDragon':'fireDragon']=tier;counts.grunt-=2;}
 if(d.doctrine==='siege'){counts.trebuchet=1+tier;counts.tallGrunt+=2;counts.priest+=tier>0?1:0;}
 const roster=Object.entries(counts).flatMap(([type,n])=>Array(n).fill(type));
 for(let i=roster.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[roster[i],roster[j]]=[roster[j],roster[i]];}
 return {counts,roster};
}
function sampledReach(heights,towers){
 const ground=x=>skirmishElevation(heights,x),origins=[{x:350,y:ground(350)-200},...towers.map(x=>({x,y:ground(x)-130}))];
 // Check ground-defense band, enemy keep, and aerial routes from the actual
 // friendly keep/tower shooting heights. Obstacles/actors are not simulated.
 const zones=[550,950,1400,1770].map(x=>({name:`ground-${x}`,x,y:Math.min(ground(x),ground(x+25))-82,width:25,height:24}));
 zones.push({name:'enemy-keep',x:1760,y:ground(1800)-205,width:75,height:95},{name:'aerial-route',x:1300,y:260,width:550,height:90});
 return validateAutoAimZones({origins,zones,angleMode:0,powerPercent:100,elevationAt:ground});
}
export function createSkirmish(value=DEFAULT_SKIRMISH){
 const descriptor=validateSkirmishDescriptor(value),r=stream(descriptor,'landmarks'),spec=SKIRMISH_THREATS[descriptor.threat];
 const sites=[760+Math.round(r()*90),1080+Math.round(r()*90),1370+Math.round(r()*70)],towerCount=Math.floor(r()*3),towers=sites.slice(0,towerCount===2?3:towerCount).filter((_,i)=>towerCount!==2||i!==1);
 let heights,reach,attempt=0;
 for(const scale of [1,.72,.4,0]){heights=makeTerrain(descriptor,scale);reach=sampledReach(heights,towers);attempt++;if(reach.ok)break;}
 if(!reach.ok)throw new Error('The bounded fallback did not pass the sampled reach check.');
 const levy=descriptor.doctrine==='levy',stages=levy?levyStages(descriptor.threat):null,company=levy?{roster:stages.flatMap(s=>s.types),counts:Object.fromEntries([...new Set(stages.flatMap(s=>s.types))].map(type=>[type,stages.flatMap(s=>s.types).filter(t=>t===type).length]))}:makeCompany(descriptor),light=['dawn','noon','dusk'][Math.floor(r()*3)],enemyKeepHP=Math.round(spec.keepHP*(.9+r()*.2)/100)*100;
 const code=encodeSkirmishDescriptor(descriptor),encounter=validateBattleEncounter({id:`skirmish-${descriptor.seed.toString(36)}-${descriptor.biome}-${descriptor.threat}-${descriptor.doctrine}`,scenery:descriptor.biome,timeOfDay:light,heights,roster:company.roster,towers,enemyKeepHP,objective:descriptor.doctrine==='battery'?BATTERY_OBJECTIVE:levy?'break-keep':'standard'});
 const nameR=stream(descriptor,'name'),prefix=['Amber','Broken','Hidden','Last','Quiet','Silver','Windward','Red'],suffix=['Crossing','Watch','Hollow','Rise','Causeway','Pass','Reach','Vale'];
 return Object.freeze({descriptor,code,name:`${prefix[Math.floor(nameR()*prefix.length)]} ${suffix[Math.floor(nameR()*suffix.length)]}`,level:spec.level,difficulty:spec.difficulty,encounter,counts:Object.freeze({...company.counts}),reach:Object.freeze({...reach,attempts:attempt}),kit:SKIRMISH_KIT,...(levy?{levyStages:stages}:{})});
}
