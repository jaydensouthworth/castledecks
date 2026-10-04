/** Read-only armory facts for the shipping catalog. No constructors, RNG, ticks,
 * purchases or profile writes. Formula copies below are presentation adapters;
 * regression tests compare them with the actual engine implementations.
 *
 * Sources: engine/progression.mjs (XP, cooldown and prices), combat.mjs
 * (troopStats), later-enemies.mjs (laterEnemyStats and resistances),
 * special-projectiles.mjs (each named projectile/spell), ranged-troop.mjs
 * (support and siege), companions.mjs (the allied co-hero, NOT enemy Gorath).
 */
import {SKILLS} from './engine/progression.mjs';
import {COMPANIONS} from './engine/recruitment.mjs';
import {CASTLE_CATALOG,resolveCastleConfig} from './engine/castle-catalog.mjs';
import {castleCardIdentity} from './castle-presentation.mjs';
import {DIFFICULTY,troopStats,heroArrowBaseDamage} from './engine/combat.mjs';
import {laterEnemyStats} from './engine/later-enemies.mjs';

const TICKS_PER_SECOND=33;
const idOf=item=>typeof item==='string'?item:item?.id;
const bounded=(value,min,max,fallback)=>Number.isFinite(value)?Math.min(max,Math.max(min,Math.trunc(value))):fallback;
const laterTypes={air:'air',poisonDragon:'dragon_scout_poison',fireDragon:'dragon_scout_fire',iceDragon:'dragon_scout_ice',fireDemon:'fire_demon',iceDemon:'ice_demon'};
const flyers=new Set(['air','poisonDragon','fireDragon','iceDragon']);
// A metric key always identifies the SAME measure/unit/scope, including in
// mixed-category comparisons. Never compare nominal hit damage with DPS.
const METRICS={
 keepHealth:['Starting keep health','HP','friendly mode base at the current hero rank, before battle damage'],
 keepHealthPercent:['Keep health modifier','%','of the mode pre-type base health'],
 shelterBerths:['Shelter berths','berths','total capacity including the hero'],
 launchElevation:['Firing station elevation','units','world distance above Classic Keep'],
 reloadSeconds:['Reload','s','between skill uses'],
 perUnitHp:['Health','HP','per unit'],
 perUnitSpeed:['Move speed','units/tick','ground movement before status effects'],
 perUnitMeleeDamage:['Base melee hit','damage','per unit, before variation and resistance'],
 perUnitProjectileDamage:['Base projectile hit','damage','per projectile, before variation and resistance'],
 impactDamage:['Base direct hit','damage','direct hit, before criticals and resistance'],
 blastDamageMin:['Blast roll minimum','damage','blast center, before resistance'],
 blastDamageMax:['Blast maximum','damage','blast center, before resistance'],
 blastRadius:['Effect radius','units','world distance'],
 waveDamage:['Wave hit','damage','per wave pulse, before resistance'],
 wavePulses:['Wave pulses','pulses','per cast'],
 flakBursts:['Flak bursts','bursts','per cast'],
 reactivePulseDamage:['Lingering pulse','damage','per pulse, before variation and resistance'],
 reactivePulses:['Lingering pulses','pulses','per reactive element'],
 slowPercent:['Slow','%','full-strength effect'],
 slowDuration:['Frost duration','s','full-strength effect'],
 healBasePower:['Base heal power','HP','before random bonus and missing-health cap'],
 healCooldown:['Heal recharge','s','nominal timer, before AI and cast delay'],
 healRangeMin:['Minimum heal reach','units','world distance'],
 healRangeMax:['Maximum heal reach','units','world distance'],
 poisonDuration:['Poison duration','s','per applied status'],
 poisonInitialSickness:['Initial poison roll ceiling','damage','first poison pulse, exclusive upper bound'],
 lightningDamage:['Base lightning hit','damage','per strike, before bonus and resistance'],
 cloudDuration:['Cloud duration','s','nominal spell timer'],
 shotAimTime:['Aim phase','s','per shot, before other attack phases'],
 pierceTaken:['Pierce damage taken','×','incoming damage multiplier'],
 fireTaken:['Fire damage taken','×','incoming damage multiplier'],
 iceTaken:['Ice damage taken','×','incoming damage multiplier'],
 bluntTaken:['Blunt damage taken','×','incoming damage multiplier'],
 flakTaken:['Flak damage taken','×','incoming damage multiplier'],
 signatureDamage:['Earthshatter hit','damage','per opposing ground target, before resistance'],
 signatureCooldown:['Earthshatter cooldown','s','between signature activations'],
 stompCadence:['Stomp interval','s','while in attack range'],
 summonGold:['Deployment cost','gold','per summon'],
 squadUnits:['Squad size','units','per summon'],
 reserveCost:['Reserve used','reserve','per summon']
};
const normalize=({rank=0,heroRank=1,difficulty='medium'}={})=>({rank:bounded(rank,0,10,0),heroRank:bounded(heroRank,1,26,1),difficulty:Object.hasOwn(DIFFICULTY,difficulty)?difficulty:'medium'});
function progression(id,rank,heroRank){
 if(Object.hasOwn(CASTLE_CATALOG,id??''))return {kind:'none',rank:0,maxRank:0,nextRank:null,description:'Castle types are sidegrades. Castle levels and paid upgrades are not available. Friendly base health follows hero rank.'};
 if(Object.hasOwn(COMPANIONS,id??''))return {kind:'hero',rank:heroRank,maxRank:26,nextRank:heroRank<26?heroRank+1:null,description:'Scales with your hero rank when summoned. There is no separate companion skill rank or paid upgrade.'};
 if(id==='fireDemon'||id==='iceDemon')return {kind:'skill',rank,maxRank:10,nextRank:rank<10?rank+1:null,threshold:(rank+1)*100,description:'Higher-rank values are formula previews. Demon melee currently awards no skill XP, so normal combat does not advance this skill. No paid upgrade exists.'};
 if(Object.hasOwn(SKILLS,id??''))return {kind:'skill',rank,maxRank:10,nextRank:rank<10?rank+1:null,threshold:(rank+1)*100,description:'Ranks are earned through skill XP, not bought. Passing the XP threshold advances one rank; purchase unlocks rank 0.'};
 return {kind:'none',rank:0,maxRank:0,nextRank:null,description:'No verified progression data is available for this card.'};
}

/** Accepts a catalog record or stable ID. Values are nominal, not simulated DPS.
 * Unknown/custom records are safe and intentionally receive no invented stats.
 */
export function getCardInsights(item,options={}){
 const id=idOf(item),context=normalize(options),{rank:r,heroRank,difficulty}=context;
 const metrics=[],notes=[],tactics=[];
 const add=(key,value)=>{const [label,unit,scope]=METRICS[key];metrics.push({key,label,value,unit,scope});};
 const result={id,...context,metrics,notes,tactics,progression:progression(id,r,heroRank)};
 if(Object.hasOwn(CASTLE_CATALOG,id??'')){
  const entry=CASTLE_CATALOG[id],selection={id,level:1},baseHp=8000+heroRank*400,config=resolveCastleConfig(selection,{team:'good',baseHp}),card=castleCardIdentity(selection,{baseHp});
  add('keepHealth',config.hp);add('keepHealthPercent',entry.hpMultiplier*100);add('shelterBerths',entry.berths);add('launchElevation',entry.launchElevation);
  notes.push(...card.notes,`Health shown is the starting friendly keep at hero rank ${heroRank}, not its current damage.`,id==='highwatch'?'Highwatch price and tuning are provisional.':'Classic Keep is free and already owned.');
  tactics.push(card.tradeoff,'The hero uses one shelter berth. Archers must reach and enter a free berth naturally. Keep destruction follows each mode’s own objective rules.');
  return result;
 }
 const entry=Object.hasOwn(SKILLS,id??'')?SKILLS[id]:null;
 if(id==='gorath'){
  // companions.mjs uses hero rank and overrides the enemy/difficulty stat model.
  const damage=120+heroRank*6;
  add('perUnitHp',1800+heroRank*80);add('perUnitMeleeDamage',damage);add('signatureDamage',damage*1.5);
  add('stompCadence',4);add('signatureCooldown',COMPANIONS.gorath.signatureCooldownTicks/TICKS_PER_SECOND);add('summonGold',COMPANIONS.gorath.summonCost);
  add('pierceTaken',3.5);add('bluntTaken',.1);
  notes.push('Hero-rank stats are independent of difficulty. Earthshatter hits each opposing ground unit or structure at most once and applies a 90-tick daze to fighters.', 'Uses a separate companion slot and no reserve. Cannot carry or recover flags.', 'Stays until recalled, defeated, or battle end. Recall recovery is 60s; defeat recovery is 90s.');
  tactics.push('Use Earthshatter along a ground formation while infantry pursue the flags. It does not hit airborne targets.', 'Priests can support his living-unit health. Keep him away from concentrated piercing shots: he takes 3.5× pierce damage.');
  return result;
 }
 if(!entry){
  notes.push('Detailed combat stats are not available for this catalog entry.');return result;
 }
 add('reloadSeconds',entry.cooldown/66);
 if(entry.summon){
  const stats=laterTypes[id]?laterEnemyStats(laterTypes[id],{rank:r,difficulty}):troopStats(id,{rank:r,difficulty});
  add('perUnitHp',stats.maxHp);
  if(!flyers.has(id))add('perUnitSpeed',stats.speed);
  add('summonGold',entry.summon.cost);add('squadUnits',entry.summon.amount);add('reserveCost',entry.summon.amount*entry.summon.population);
  notes.push(`Health and ground troop combat stats use skill rank ${r} and ${difficulty} difficulty. Damage is a base value before random variation, armor, criticals and limits on simultaneous effects.`);
  if(flyers.has(id))notes.push('Allied flyers are protected from player-side attacks and splash. They patrol independently and do not carry flags.');
  else if(['grunt','tallGrunt','mount','fireDemon','iceDemon'].includes(id))notes.push('Can recover the friendly flag and capture the enemy flag. Carrying a flag reduces movement speed.');
  switch(id){
   case 'grunt':
    add('perUnitMeleeDamage',stats.damage);
    tactics.push('Four inexpensive sword fighters provide bodies for a flag push. Keep a Priest behind the frontline to restore injured troops.');break;
   case 'tallGrunt':
    add('perUnitMeleeDamage',stats.damage);add('pierceTaken',1.4);
    notes.push('Can engage two opponents, but has no guaranteed two-target hit. Takes 1.4× piercing damage.');
    tactics.push('Use the heavier three-unit squad to hold ground for Archers. Enemy arrows are a particular weakness.');break;
   case 'mount':
    add('perUnitMeleeDamage',stats.damage);add('bluntTaken',1.2);
    notes.push('A dedicated flag runner. Ignores daze, flinch and knockback reactions; fear still causes retreat.');
    tactics.push('Use its faster ground movement for flag pressure. Support the runner rather than leaving it in a prolonged melee.');break;
   case 'archer':
    add('perUnitProjectileDamage',stats.damage);add('shotAimTime',(500-20*r)/66);add('fireTaken',2);
    notes.push('Projectile damage also rolls at release and on impact. Aim time is one phase, not a complete firing interval. Can garrison available structures.');
    tactics.push('Place sword troops in front while Archers shoot or occupy a tower. Keep fire attacks away: Archers take 2× fire damage.');break;
   case 'trebuchet':
    add('perUnitProjectileDamage',stats.damage);add('blastDamageMax',30+2*r);add('blastRadius',30+2*r);add('shotAimTime',(500-20*r)/66);add('fireTaken',2);
    notes.push('Favors distant troops beyond 700 world units. Recruited trebuchets also target hostile keeps and occupied enemy towers at that range when no distant troop is available. Its impact adds a small radial blast; aim time is only one attack phase.', 'A vehicle: immune to healing, poison, fear and daze. Priests cannot heal it.');
    tactics.push('Protect its long loading cycle with infantry. Keep an escort in front while it breaks distant walls; nearby targets are inside its 700-unit firing limit. Avoid fire attackers, which deal 2× fire damage to it.');break;
   case 'priest':
    add('healBasePower',50+2*r);add('healCooldown',(400-15*r)/33);add('healRangeMin',200+33*r);add('healRangeMax',249+33*r);
    notes.push('Prioritizes purging poisoned allies, then healing injured living allies. Actual healing varies and is capped at missing health. Cannot heal vehicles.');
    tactics.push('Pair with living frontline troops or Gorath. It spends actions purging poison before healing, so keep it protected.');break;
   case 'air':
    add('perUnitProjectileDamage',30);add('flakTaken',4);
    notes.push('The patrol arrow deals 30 base damage at every rank.', 'Ranks improve health, but displayed ground-movement formulas do not describe aerial patrol speed.');
    tactics.push('Adds airborne arrows without blocking your shots. Enemy flak is dangerous: Air Fighters take 4× flak damage.');break;
   case 'poisonDragon':
    add('perUnitProjectileDamage',Math.floor(30*(1+r/10)));add('poisonDuration',(165+Math.floor(33*r))/33);add('poisonInitialSickness',Math.floor(Math.floor(30*(1+r/10))*.5));add('pierceTaken',.2);
    notes.push('Poison rolls below its current sickness value each pulse; sickness grows by floor(1.5×) after a pulse. Repeated poison effects are limited by the target’s effect slots.', 'Dragon projectile formulas use skill rank, without a difficulty multiplier. Poison damage ignores poison resistance.');
    tactics.push('Useful against durable targets that survive several poison pulses. Purge can cancel poison; no guaranteed total damage is implied.');break;
   case 'fireDragon':
   case 'iceDragon': {
    const fire=id==='fireDragon',damage=Math.floor(75*(1+r/10));
    add('perUnitProjectileDamage',damage);add('reactivePulseDamage',Math.floor(damage/10));add('reactivePulses',10);
    add(fire?'fireTaken':'iceTaken',.01);add(fire?'iceTaken':'fireTaken',4);
    if(!fire){add('slowPercent',(1-1/(1.7+.4*r))*100);add('slowDuration',(500+200*r)/33);}
    notes.push('Dragon projectile formulas use skill rank, without a difficulty multiplier. Lingering damage is enemy-only.', 'Opposing fire and ice reactive elements cancel on overlap; fire and ice status effects can also cancel.');
    tactics.push(fire?'Use fire against ice-aligned enemies. Protect the dragon from ice, which deals 4× damage.':'Use frost to slow a ground push. Protect the dragon from fire, which deals 4× damage.');break;
   }
   case 'fireDemon':
   case 'iceDemon': {
    const fire=id==='fireDemon';add('perUnitMeleeDamage',stats.damage);add(fire?'fireTaken':'iceTaken',0);add(fire?'iceTaken':'fireTaken',4);add('pierceTaken',.1);
    notes.push('Demon melee currently awards no skill XP. Higher ranks show the stat formula, not progression available through normal combat.', 'Both demon variants currently calculate melee damage against the target’s fire resistance. The ice variant does not deal ice-based melee damage.', 'Resists physical hits at 0.1× and is immune to lightning damage. Elemental resistance does not guarantee immunity to status effects.');
    tactics.push(fire?'A durable flag-capable frontline against fire. Keep it away from ice damage, which is multiplied by 4.':'A durable flag-capable frontline against ice. Keep it away from fire damage, which is multiplied by 4.');break;
   }
  }
  return result;
 }
 notes.push('Values are base or full-strength effects, not guaranteed damage or DPS. Armor, criticals, distance, random rolls and effect slots can change the result.');
 if(!['healWave'].includes(id))notes.push('Allied flyers are protected from player-side attacks. Ground allies can still be caught by damaging area effects.');
 switch(id){
  case 'arrow':
   add('impactDamage',heroArrowBaseDamage(r));
   notes.push('Already owned at campaign start. Direct damage rolls from 90% to 109%; head hits double damage before piercing resistance.', 'Basic Arrow can hit friendly ground troops directly. Successful hits earn gold according to difficulty.');
   tactics.push('Use its short reload between special shots. Aim for enemy heads and keep allied ground troops out of the flight path.');break;
  case 'fireArrow': {
   const damage=Math.floor(75*(1+r/10));add('impactDamage',damage);add('reactivePulseDamage',Math.floor(damage/10));add('reactivePulses',10);
   notes.push('Direct damage varies from 90% to 109% before resistance and flooring. Lingering fire pulses vary independently.');
   tactics.push('Fire is effective against fire-vulnerable enemies such as Ice Dragons and Ice Demons. Overlapping fire and ice remnants cancel.');break;
  }
  case 'iceArrow': {
   const damage=Math.floor(75*(1+r/10));add('impactDamage',damage);add('slowPercent',(1-1/(1.7+.4*r))*100);add('slowDuration',(500+200*r)/33);add('reactivePulseDamage',Math.floor(damage/10));
   tactics.push('Slow an approaching enemy to buy your frontline time. Avoid overlapping fire and ice remnants, which cancel.');break;
  }
  case 'pierceArrow':
   add('impactDamage',50+5*r);
   notes.push('Continues through unit contacts; ground or a structure stops it. Damage rolls from 75% to 124% before resistance and flooring. A displayed hit value is not total line damage.');
   tactics.push('Aim through a line of troops. A building in the path stops the projectile, so choose a clear lane.');break;
  case 'bombArrow':
   add('blastDamageMin',Math.floor(100*(1+r/10)));add('blastDamageMax',Math.floor(149*(1+r/10)));add('blastRadius',Math.floor(50*(1+r/10)));
   notes.push('Rolls blast strength once per arrow. A direct collision adds an impact of that rolled strength; radial damage falls off with distance.');
   tactics.push('Place the blast among clustered enemies. Keep friendly ground troops outside the radius.');break;
  case 'flakArrow':
   add('blastDamageMax',Math.floor(40*(1+r/10)));add('blastRadius',50);add('flakBursts',3+Math.floor(r*.3));
   notes.push('Manual activation only: contact with a unit does not detonate it. Burst centers scatter around the activation point; damage uses flak resistance.');
   tactics.push('Activate in the air near hostile Air Fighters, which take 4× flak damage. Friendly flyers remain protected.');break;
  case 'fireWave':
   add('waveDamage',Math.floor(55*(1+r/10)));add('wavePulses',8);
   notes.push('Eight ground-following pulses, each affecting a narrow strip. Wave movement follows 1.5× the launching arrow’s horizontal velocity.');
   tactics.push('Sweep a ground formation along its travel line. Friendly ground troops in the strip can also be hit.');break;
  case 'iceWave':
   add('waveDamage',Math.floor(55*(1+r/6)));add('wavePulses',6);add('slowPercent',(1-1/(1.5+.3*r))*100);add('slowDuration',(500+200*r)/33);
   notes.push('Six ground-following pulses apply damage and frost in a narrow strip. Movement follows the launching arrow’s direction.');
   tactics.push('Use along an incoming ground column for repeated slowing. Keep friendly infantry clear of the wave.');break;
  case 'bombWave':
   add('blastDamageMax',Math.floor(55*(1+r/6)));add('blastRadius',25);add('wavePulses',6);
   notes.push('Six ground-following blasts; each pulse falls off over a 25-unit radius. A pulse count is not a guaranteed number of hits.');
   tactics.push('Send along densely packed ground enemies. Each small blast can also catch allied ground troops.');break;
  case 'healWave':
   add('healBasePower',Math.floor(75*(1+r/10)));add('wavePulses',6);add('blastRadius',25);
   notes.push('Six friendly-team healing pulses. Base healing falls off over 25 units, then receives a random bonus and is capped at missing health. Healing-immune units receive nothing.');
   tactics.push('Send through wounded living allies or Gorath. Trebuchets are healing-immune, so they do not benefit.');break;
  case 'meteorArrow':
   // SkyFallSpell passes these values into Meteor WITHOUT Meteor.setRank.
   add('blastDamageMax',Math.floor(100*(1+r/10)));add('blastRadius',150*(1+.05*r));
   notes.push('The ground marker calls one delayed meteor. Its live carrier uses this blast formula, not the alternate Meteor.setRank formula.', 'Creates three fireball debris projectiles. Direct collisions and debris can add damage; they are not included in the blast-center value.');
   tactics.push('Place the marker ahead of a ground formation. The wide blast mixes fire and blunt resistance, and can hit ground allies.');break;
  case 'cometArrow':
   add('blastDamageMax',250+41*r);add('blastRadius',100+5*r);add('slowPercent',(1-1/(1.7+.4*r))*100);add('slowDuration',(500+200*r)/33);
   notes.push('The ground marker calls one delayed comet. Radial damage and frost duration fall off with distance. Debris and a direct collision can add separate effects.');
   tactics.push('Use a wide frost blast to slow clustered enemies. Its splash mixes ice and blunt resistance; keep ground allies clear.');break;
  case 'thunderArrow':
   // first-battle.mjs intentionally omits request.rank for this skill.
   add('lightningDamage',70);add('cloudDuration',500/66);
   notes.push('Manual activation creates the cloud above the battlefield. The live launcher does not pass skill rank, so its combat stats stay at projectile rank 0.', 'Each strike adds a random 0–16 damage after resistance. Strike timing and horizontal position vary; no fixed hit count or DPS is guaranteed.');
   tactics.push('Activate above enemies to strike targets below the cloud. Ranking this skill does not currently improve the cloud’s combat values.');break;
 }
 return result;
}

/** Pure hypothetical preview. Supports createArmorySnapshot (skills Map) plus
 * heroRank/difficulty fields, or direct {rank,heroRank,difficulty} options.
 * It never awards XP, spends gold or changes a live skill/profile.
 */
export function getRankPreview(item,snapshot={},previewRank){
 const id=idOf(item),rank=snapshot.skills instanceof Map?snapshot.skills.get(id)?.rank??snapshot.rank??0:snapshot.rank??0;
 const options={rank,heroRank:snapshot.heroRank??1,difficulty:snapshot.difficulty??'medium'};
 const current=getCardInsights(item,options),p=current.progression;
 const target=p.kind==='none'?0:bounded(previewRank,p.kind==='hero'?1:0,p.maxRank,p.nextRank??p.rank);
 const preview=getCardInsights(item,{...options,[p.kind==='hero'?'heroRank':'rank']:target});
 const previous=new Map(current.metrics.map(metric=>[metric.key,metric]));
 const changes=preview.metrics.flatMap(metric=>{
  const from=previous.get(metric.key);if(!from||from.scope!==metric.scope||from.unit!==metric.unit||from.value===metric.value)return [];
  return [{...metric,from:from.value,to:metric.value,delta:metric.value-from.value}];
 });
 return {current,preview,changes,rank:target,maxRank:p.maxRank,isMax:p.nextRank===null};
}
