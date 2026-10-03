/** Read-only enemy intelligence for the actual campaign roster. HP uses live
 * engine stat functions. Resistance records mirror current fighter constructors
 * and are parity-tested against real units across every level and difficulty.
 * No RNG, actor construction, save mutation or future-roster prediction here.
 */
import {troopStats,TROOPS,DIFFICULTY} from './engine/combat.mjs';
import {laterEnemyStats} from './engine/later-enemies.mjs';
import {getLevel} from './engine/levels.mjs';
const later={air:'air',poisonDragon:'dragon_scout_poison',fireDragon:'dragon_scout_fire',iceDragon:'dragon_scout_ice',fireDemon:'fire_demon',iceDemon:'ice_demon',gorath:'gorath'};
const aliases=Object.fromEntries(Object.entries(later).map(([id,type])=>[type,id]));
const damageKinds=Object.freeze([
 ['pierce','Arrow'],['slice','Slash'],['blunt','Blunt'],['fire','Fire'],['ice','Ice'],['lightning','Lightning'],['flak','Flak'],
].map(Object.freeze));
const special={
 air:{flak:4},
 poisonDragon:{ice:.1,blunt:.2,slice:.2,pierce:.2},
 fireDragon:{lightning:.1,fire:.01,ice:4,blunt:.1,slice:.1,pierce:.1},
 iceDragon:{lightning:.1,fire:4,ice:.01,blunt:.1,slice:.1,pierce:.1},
 fireDemon:{lightning:0,fire:0,ice:4,blunt:.1,slice:.1,pierce:.1},
 iceDemon:{lightning:0,fire:4,ice:0,blunt:.1,slice:.1,pierce:.1},
 gorath:{fire:.5,ice:.5,lightning:.5,pierce:3.5,blunt:.1,slice:.5},
};
const data={
 grunt:{name:'Foot soldier',role:'Flag infantry',counter:'Basic Arrow and head shots.',notes:['Can carry either flag. Prioritize an enemy returning your home flag.']},
 tallGrunt:{name:'Heavy infantry',role:'Front line',counter:'Basic Arrow: arrow hits deal 1.4× damage.',notes:['A heavier ground fighter with more health than a foot soldier.']},
 archer:{name:'Archer',role:'Ranged support',counter:'Fire Arrow deals 2× direct damage.',notes:['Can occupy keeps and towers. A garrison hides the occupant from direct targeting.']},
 priest:{name:'Priest',role:'Healer',counter:'Focus the healer before its escort. Fire and Ice each deal 1.2× direct damage.',notes:['Restores injured living allies and purges poison. Lightning deals only 0.1× damage.']},
 mount:{name:'Cavalry',role:'Fast flag runner',counter:'Intercept the carrier. Blunt damage has a modest 1.2× advantage.',notes:['Moves quickly and resists slash damage. Cannot be interrupted by ordinary flinch, knockback or daze.']},
 trebuchet:{name:'Trebuchet',role:'Long-range siege',counter:'Fire Arrow deals 2× direct damage; ordinary arrows deal 0.5×.',notes:['Prefers distant targets beyond 700 world units. Poison and healing do not affect this vehicle.']},
 air:{name:'Winged raider',role:'Aerial archer',counter:'Flak deals 4× damage. Activate the arrow near the flyer.',notes:['Aim at the body, not the wing tips. Cannot carry flags.']},
 poisonDragon:{name:'Poison dragon',role:'Aerial poison',counter:'Fire Arrow is a reliable direct-damage choice; Ice deals only 0.1×.',notes:['Ordinary arrows deal 0.2× damage. Lead the moving body. Cannot carry flags.','Poison status damage does not consult the displayed elemental resistance multipliers.']},
 fireDragon:{name:'Fire dragon',role:'Aerial fire',counter:'Ice Arrow deals 4× direct damage. Fire deals only 0.01×.',notes:['Ordinary arrows deal 0.1× damage. Lead the moving body. Cannot carry flags.']},
 iceDragon:{name:'Ice dragon',role:'Aerial frost',counter:'Fire Arrow deals 4× direct damage. Ice deals only 0.01×.',notes:['Ordinary arrows deal 0.1× damage. Lead the moving body. Cannot carry flags.']},
 fireDemon:{name:'Fire demon',role:'Elemental front line',counter:'Ice deals 4× damage. Fire and Lightning direct damage are ineffective.',notes:['Physical damage is reduced to 0.1×. Can carry flags; do not let it slip past.','Damage immunity is separate from status-effect immunity.']},
 iceDemon:{name:'Ice demon',role:'Elemental front line',counter:'Fire deals 4× damage. Ice and Lightning direct damage are ineffective.',notes:['Physical damage is reduced to 0.1×. Can carry flags; do not let it slip past.','Damage immunity is separate from status-effect immunity.']},
 gorath:{name:'Gorath',role:'Final guardian',counter:'Aim arrows at the exposed head or belly. A bomb to the head can knock him down.',notes:['Exposed-region arrow hits use a 3.5× multiplier; armor and feet can deflect them.','Destroying the keep cuts regular reserves but does not remove Gorath. A safe flag return can still win.']},
};
export const ENEMY_INTEL_IDS=Object.freeze(Object.keys(data));
function validate(level,difficulty){if(!Number.isInteger(level)||level<1||level>30)throw new RangeError('Enemy intelligence needs battle 1–30');if(!DIFFICULTY[difficulty])throw new RangeError('Unknown difficulty');}
export function enemyIntel(type,{level=1,difficulty='medium'}={}){
 validate(level,difficulty);const id=aliases[type]??type,record=data[id];if(!record)throw new RangeError('Unknown enemy type');
 const stats=Object.hasOwn(TROOPS,id)?troopStats(id,{level,difficulty}):laterEnemyStats(later[id],{level,difficulty});
 const multipliers=Object.freeze(Object.fromEntries(damageKinds.map(([key])=>[key,special[id]?.[key]??TROOPS[id]?.[key]??1])));
 const entry=([id,name])=>Object.freeze({id,name,multiplier:multipliers[id],text:`${name} ${multipliers[id]}×`});
 return Object.freeze({id,name:record.name,role:record.role,level,difficulty,maxHp:stats.maxHp,air:['air','poisonDragon','fireDragon','iceDragon'].includes(id),
  multipliers,resistances:Object.freeze(damageKinds.filter(([key])=>multipliers[key]<1).map(entry)),weaknesses:Object.freeze(damageKinds.filter(([key])=>multipliers[key]>1).map(entry)),
  counter:record.counter,notes:Object.freeze([...record.notes]),hpBasis:'spawn',statNote:'HP for a new enemy at this battle and difficulty; existing units keep their spawn stats. Multipliers are before critical hits and effect handling.'});
}
/** Pass exact known roster IDs from an already-created battle or threat grid.
 * Omitting types returns possible current-stage types from authored bounds; it
 * never draws the random roster or claims that a possible specialist will spawn.
 */
export function encounterEnemyIntel({level=1,difficulty='medium',types=null}={}){
 validate(level,difficulty);let ids;
 if(types===null){const stage=getLevel(level);ids=ENEMY_INTEL_IDS.filter(id=>(stage.fixedCounts[id]??0)>0||(stage.randomCounts[id]?.draw&&stage.randomCounts[id].limit>1));}
 else{if(!Array.isArray(types))throw new TypeError('Enemy types must be an array');ids=[...new Set(types.map(type=>aliases[type]??type))];for(const id of ids)if(!Object.hasOwn(data,id))throw new RangeError('Unknown enemy type');ids.sort((a,b)=>ENEMY_INTEL_IDS.indexOf(a)-ENEMY_INTEL_IDS.indexOf(b));}
 return Object.freeze(ids.map(type=>enemyIntel(type,{level,difficulty})));
}
