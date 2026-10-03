/** Independent profile, purchase, reward and cooldown logic.
 * Catalog is numeric gameplay data; no original icons, help text or assets.
 */
import {RECRUIT_SKILLS,COMPANIONS} from './recruitment.mjs';
export const SKILLS={
  "arrow": {
    "name": "Basic Arrow",
    "price": 0,
    "cooldown": 60
  },
  "fireArrow": {
    "name": "Fire Arrow",
    "price": 1000,
    "cooldown": 660
  },
  "pierceArrow": {
    "name": "Pierce Arrow",
    "price": 3000,
    "cooldown": 660
  },
  "bombWave": {
    "name": "Bomb Wave Arrow",
    "price": 3000,
    "cooldown": 1980
  },
  "cometArrow": {
    "name": "Comet Arrow",
    "price": 5000,
    "cooldown": 7920
  },
  "fireWave": {
    "name": "Fire Wave Arrow",
    "price": 3000,
    "cooldown": 3960
  },
  "healWave": {
    "name": "Heal Wave Arrow",
    "price": 1500,
    "cooldown": 700
  },
  "iceArrow": {
    "name": "Ice Arrow",
    "price": 1000,
    "cooldown": 660
  },
  "meteorArrow": {
    "name": "Meteor Arrow",
    "price": 5000,
    "cooldown": 7920
  },
  "thunderArrow": {
    "name": "Thunder Arrow",
    "price": 5000,
    "cooldown": 3960
  },
  "iceWave": {
    "name": "Ice Wave Arrow",
    "price": 3000,
    "cooldown": 1980
  },
  "flakArrow": {
    "name": "Flak Bomb Arrow",
    "price": 2000,
    "cooldown": 330
  },
  "bombArrow": {
    "name": "Bomb Arrow",
    "price": 2000,
    "cooldown": 990
  },
  "archer": {
    "name": "Archer",
    "price": 1000,
    "cooldown": 660,
    "summon": {
      "cost": 20,
      "amount": 4,
      "population": 1
    }
  },
  "grunt": {
    "name": "Grunt",
    "price": 1000,
    "cooldown": 660,
    "summon": {
      "cost": 20,
      "amount": 4,
      "population": 1
    }
  },
  "tallGrunt": {
    "name": "Heavy Soldiers",
    "price": 1500,
    "cooldown": 660,
    "summon": {
      "cost": 30,
      "amount": 3,
      "population": 1
    }
  },
  "mount": {
    "name": "Horse Riders",
    "price": 1500,
    "cooldown": 660,
    "summon": {
      "cost": 30,
      "amount": 4,
      "population": 1
    }
  },
  "trebuchet": {
    "name": "Trebuchet",
    "price": 2500,
    "cooldown": 1980,
    "summon": {
      "cost": 70,
      "amount": 1,
      "population": 1
    }
  },
  "priest": {
    "name": "Priest",
    "price": 2000,
    "cooldown": 660,
    "summon": {
      "cost": 30,
      "amount": 2,
      "population": 1
    }
  }
};
Object.assign(SKILLS,RECRUIT_SKILLS);
export class SkillProgress {
 constructor(id){if(!SKILLS[id])throw new RangeError('Unknown skill');this.id=id;this.rank=0;this.xp=0;this.threshold=100;this.maxRank=10;this.maximum=SKILLS[id].cooldown;this.cooldown=this.maximum;this.autocast=!!SKILLS[id].summon;this.strobe=33;this.binding=-1;this.passive=false;}
 addXP(amount){if(this.rank>=this.maxRank)return;this.xp+=amount;if(this.xp>this.threshold){this.xp-=this.threshold;this.rank++;this.threshold+=100;}}
 step(activate=()=>{}){this.cooldown-=2;if(this.cooldown<=0){this.cooldown=0;if(this.autocast){const old=this.strobe--;if(old<=0){this.strobe=33;activate(this);}}}}
 use(){if(this.cooldown>0)return false;this.cooldown=this.maximum;return true;}
}
export class PlayerProfile {
 constructor(name='BowMaster'){this.name=name;this.rank=1;this.xp=0;this.gold=0;this.scene=1;this.level=1;this.highestScene=1;this.highestLevel=1;this.victories=0;this.defeats=0;this.difficulty='medium';this.shootingMode='classic';this.skills=[];this.owned=new Set();this.companionOwned=new Set();this.companionId=null;this.addSkill('arrow');}
 addXP(amount){const total=this.xp+Math.floor(amount),threshold=this.rank>=0&&this.rank<=25?this.rank*500:undefined;if(total>threshold){this.xp=Math.floor(total-threshold);this.rank++;}else this.xp=Math.floor(total);}
 addSkill(id){const skill=new SkillProgress(id),used=new Set(this.skills.map(s=>s.binding));for(let i=0;i<30;i++)if(!used.has(i)){skill.binding=i;break;}this.skills.push(skill);this.owned.add(id);return skill;}
 recruitCompanion(id){const item=COMPANIONS[id];if(!item||this.companionOwned.has(id)||this.gold<item.price)return false;this.gold-=item.price;this.companionOwned.add(id);this.companionId=id;return true;}
 equipCompanion(id){if(id!==null&&!this.companionOwned.has(id))return false;this.companionId=id;return true;}
 // Intentional modern rule: displayed-price purchases may spend the full balance.
 purchase(id){const item=SKILLS[id];if(!item||this.owned.has(id)||!(this.gold>=item.price))return false;this.gold-=item.price;this.addSkill(id);return true;}
}
export function summonSquad(skill,profile,queue,levelStats={}){const config=SKILLS[skill.id]?.summon;if(!config||skill.cooldown>0||profile.gold<config.cost)return false;if(!queue.enqueueSquad({type:skill.id,cost:config.population,rank:skill.rank,skill},config.amount))return false;profile.gold-=config.cost;levelStats.goldSpent=(levelStats.goldSpent??0)+config.cost;skill.cooldown=skill.maximum;return true;}
export function basicHitGold(difficulty){return ({easy:8,medium:10,med:10,hard:12,insane:16})[difficulty]??0;}
export function travelXp(flightUnits,target){return target?.isFighter&&target.team==='bad'?Math.floor(Math.min(flightUnits,300)/300*30):0;}
export function summaryBonuses({level,bodyShots=0,headShots=0,shotsFired=0,populationLeft=0,populationGiven=0,goldSpent=0,goldEarned=0}){const hits=bodyShots+headShots,accuracy=shotsFired>0?hits/shotsFired:0,civility=populationGiven>0?populationLeft/populationGiven:0,efficiency=Math.max(0,goldEarned>0?1-goldSpent/goldEarned:0),salvage=hits>0?headShots/hits:0;return {accuracy,civility,efficiency,salvage,gold:Math.floor((500+5*level)*(efficiency+salvage)),xp:Math.floor((100+2*level)*(accuracy+civility))};}
/** Portable own-format save, intentionally excluding live cooldown state. */
export function serializeProfile(profile){
 if(profile===null||typeof profile!=='object'||Array.isArray(profile)||!Array.isArray(profile.skills)||profile.skills.length<1||profile.skills.length>Object.keys(SKILLS).length)throw new TypeError('Invalid reconstruction profile');
 const value={schema:'bowmaster-reconstruction-2',companions:{owned:[...profile.companionOwned],selected:profile.companionId},name:profile.name,rank:profile.rank,xp:profile.xp,gold:profile.gold,scene:profile.scene,level:profile.level,highestScene:profile.highestScene,highestLevel:profile.highestLevel,victories:profile.victories,defeats:profile.defeats,difficulty:profile.difficulty,shootingMode:profile.shootingMode,skills:profile.skills.map(s=>{
  if(s===null||typeof s!=='object'||Array.isArray(s))throw new TypeError('Invalid saved skill');
  return {id:s.id,rank:s.rank,xp:s.xp,threshold:s.threshold,passive:s.passive,binding:s.binding,autocast:s.autocast};
 })};
 // Check raw scalar types before JSON can coerce objects through toJSON, or
 // silently omit undefined/function/symbol values. Restoration supplies all
 // shared schema/range checks, including non-finite values serialized as null.
 const scalar=value=>['string','number','boolean'].includes(typeof value);
 if(!value.companions.owned.every(id=>typeof id==='string')||(value.companions.selected!==null&&typeof value.companions.selected!=='string'))throw new TypeError('Invalid saved companion scalar');
 if(!Object.entries(value).every(([key,item])=>key==='skills'||key==='companions'||scalar(item))||!value.skills.every(record=>Object.values(record).every(scalar)))throw new TypeError('Invalid saved scalar field');
 const text=JSON.stringify(value);restoreProfile(text);return text;
}

/** Validate a bounded JSON document completely before constructing a profile.
 * This is the reconstruction's own schema, not an original Flash save importer.
 */
export function restoreProfile(text){
 const maximumBytes=64*1024;
 if(typeof text!=='string')throw new TypeError('Save must be JSON text');
 // UTF-16 length is a cheap lower bound on UTF-8 bytes and bounds the encoder's
 // allocation for hostile large input. The importer should check File.size too.
 if(text.length>maximumBytes||new TextEncoder().encode(text).byteLength>maximumBytes)throw new RangeError('Save exceeds 64 KiB');
 const value=JSON.parse(text);
 const shape=(record,keys,label)=>{
  if(record===null||typeof record!=='object'||Array.isArray(record)||Object.keys(record).length!==keys.length||keys.some(key=>!Object.hasOwn(record,key)))throw new TypeError(`Invalid ${label} fields`);
 };
 const integer=(value,minimum,maximum,label)=>{
  if(!Number.isSafeInteger(value)||value<minimum||value>maximum)throw new TypeError(`Invalid ${label}`);
 };
 const maximum=Number.MAX_SAFE_INTEGER;
 const version1=value?.schema==='bowmaster-reconstruction-1';
 if(!version1&&value?.schema!=='bowmaster-reconstruction-2')throw new TypeError('Unsupported reconstruction save');
 shape(value,['schema','name','rank','xp','gold','scene','level','highestScene','highestLevel','victories','defeats','difficulty','shootingMode','skills',...(!version1?['companions']:[])],'save');
 const companions=version1?{owned:[],selected:null}:value.companions;
 shape(companions,['owned','selected'],'companions');
 if(!Array.isArray(companions.owned)||companions.owned.length>Object.keys(COMPANIONS).length||companions.owned.some(id=>typeof id!=='string'||!Object.hasOwn(COMPANIONS,id))||new Set(companions.owned).size!==companions.owned.length)throw new TypeError('Invalid companion roster');
 if(companions.selected!==null&&(typeof companions.selected!=='string'||!companions.owned.includes(companions.selected)))throw new TypeError('Invalid selected companion');
 if(typeof value.name!=='string')throw new TypeError('Invalid saved name');
 if(!['easy','medium','hard','insane'].includes(value.difficulty))throw new TypeError('Invalid saved difficulty');
 if(!['classic','anywhere','point_aim','auto_aim'].includes(value.shootingMode))throw new TypeError('Invalid saved aiming mode');
 integer(value.rank,1,26,'saved rank');
 integer(value.xp,-maximum,maximum,'saved XP');
 for(const key of ['gold','victories','defeats'])integer(value[key],0,maximum,`saved ${key}`);
 // Final victory advances to level31/scene32; retirement reaches scene33.
 for(const key of ['level','highestLevel'])integer(value[key],1,31,`saved ${key}`);
 for(const key of ['scene','highestScene'])integer(value[key],1,33,`saved ${key}`);
 if(!Array.isArray(value.skills)||value.skills.length<1||value.skills.length>Object.keys(SKILLS).length)throw new TypeError('Invalid saved skills');
 const ids=new Set();
 for(const record of value.skills){
  shape(record,['id','rank','xp','threshold','passive','binding','autocast'],'saved skill');
  if(typeof record.id!=='string'||!Object.hasOwn(SKILLS,record.id)||ids.has(record.id))throw new TypeError('Unknown or duplicate saved skill');
  ids.add(record.id);
  integer(record.rank,0,10,'saved skill rank');
  // Skill.addXP deliberately does not floor its argument. Keep signed and
  // fractional carry, including carry above the next rank's threshold.
  if(!Number.isFinite(record.xp)||Math.abs(record.xp)>maximum)throw new TypeError('Invalid saved skill XP');
  integer(record.threshold,100,1100,'saved skill threshold');
  if(record.threshold!==(record.rank+1)*100)throw new TypeError('Inconsistent saved skill threshold');
  integer(record.binding,-1,29,'saved skill binding');
  // Original Action Bar Setup can leave duplicate bindings after eviction.
  // Preserve acquisition order; the later skill wins when the hotbar rebuilds.
  if(typeof record.passive!=='boolean'||typeof record.autocast!=='boolean')throw new TypeError('Invalid saved skill flags');
 }
 if(!ids.has('arrow'))throw new TypeError('Save is missing the basic arrow skill');
 const profile=new PlayerProfile(value.name);
 for(const key of ['rank','xp','gold','scene','level','highestScene','highestLevel','victories','defeats','difficulty','shootingMode'])profile[key]=value[key];
 profile.skills=[];profile.owned.clear();profile.companionOwned=new Set(companions.owned);profile.companionId=companions.selected;
 for(const record of value.skills){const skill=profile.addSkill(record.id);for(const key of ['rank','xp','threshold','binding','autocast','passive'])skill[key]=record[key];}
 return profile;
}
