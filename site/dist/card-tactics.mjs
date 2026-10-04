/** Read-only battlefield identities for verified shipping contracts.
 * Sources: flag-troop.mjs (melee objectives and mounted reactions),
 * ranged-troop.mjs (Archer garrisons, Priest purge/heal, vehicle siege),
 * later-enemies.mjs (non-flag flyers, element multipliers, demon melee), and
 * recruitment.mjs. These describe capabilities, never deployed populations,
 * rarity, strength scores, or promised combat outcomes. Unknown IDs get none.
 */
export const ARMY_JOBS=Object.freeze([
 ['job:flag','Flag carriers'],['job:runner','Fast flag runners'],
 ['job:garrison','Tower garrison'],['job:sustain','Healing & poison purge'],
 ['job:siege','Long-range siege'],['job:flying','Flying support']
].map(Object.freeze));
const entries={
 grunt:{subtitle:'Sword-and-shield flag push',jobs:['flag'],strength:'Four sword fighters can recover and capture flags.',caution:'Close-range fighters need to reach their target.'},
 tallGrunt:{subtitle:'Heavy flag escort',jobs:['flag'],strength:'Three heavier infantry can hold ground and carry flags.',caution:'Takes 1.4× piercing damage.'},
 mount:{subtitle:'Fast flag runners',jobs:['flag','runner'],strength:'Faster ground movement, with no daze, flinch or knockback reactions.',caution:'Takes 1.2× blunt damage; fear can still force a retreat.'},
 archer:{subtitle:'Tower-garrison bowmen',jobs:['garrison'],strength:'Ranged troops can occupy available structures.',caution:'Takes 2× fire damage. Keep a frontline ahead of them.'},
 priest:{subtitle:'Healer & poison cleanser',jobs:['sustain'],strength:'Purges poisoned allies before healing injured living allies.',caution:'Cannot heal vehicles, including Trebuchets.'},
 trebuchet:{subtitle:'Long-range wall breaker',jobs:['siege'],strength:'Siege shots can reach distant troops, hostile keeps and occupied enemy towers.',caution:'Targets must be beyond 700 world units. Cannot be healed.'},
 air:{subtitle:'Airborne arrow patrol',jobs:['flying'],strength:'Two aerial archers patrol without blocking allied shots.',caution:'Takes 4× flak damage. Cannot carry flags.'},
 poisonDragon:{subtitle:'Poison from above',jobs:['flying'],strength:'Poison can pressure durable targets over several pulses.',caution:'Purge can cancel its poison. Cannot carry flags.'},
 fireDragon:{subtitle:'Burning air support',jobs:['flying'],strength:'Fire projectiles leave lingering enemy-only damage.',caution:'Cannot carry flags. Takes 4× ice damage; overlapping fire and frost cancel.'},
 iceDragon:{subtitle:'Slowing frost from above',jobs:['flying'],strength:'Frost projectiles slow targets and leave lingering enemy-only damage.',caution:'Cannot carry flags. Takes 4× fire damage; overlapping fire and frost cancel.'},
 fireDemon:{subtitle:'Fire-resistant flag guard',jobs:['flag'],strength:'A durable flag carrier immune to fire damage and resistant to physical hits.',caution:'Takes 4× ice damage. Melee currently earns no skill XP.'},
 iceDemon:{subtitle:'Frost-resistant flag guard',jobs:['flag'],strength:'A durable flag carrier immune to ice damage and resistant to physical hits.',caution:'Takes 4× fire damage. Its melee uses fire resistance, not ice.'}
};
const identities=Object.freeze(Object.fromEntries(Object.entries(entries).map(([id,value])=>[id,Object.freeze({...value,jobs:Object.freeze(value.jobs.map(job=>'job:'+job))})])));
export function cardTactics(item){return item?.kind==='skill'&&item?.category==='army'&&Object.hasOwn(identities,item.id)?identities[item.id]:null;}
export function armyJobOptions(records){const present=new Set(records.flatMap(item=>cardTactics(item)?.jobs??[]));return ARMY_JOBS.filter(([id])=>present.has(id));}
export function matchesArmyRole(item,role){return role==='all'||(typeof role==='string'&&role.startsWith('job:')?!!cardTactics(item)?.jobs.includes(role):item.role===role);}
export function cardTacticSearchText(item){const identity=cardTactics(item);return identity?[identity.subtitle,identity.strength,identity.caution,...ARMY_JOBS.filter(([id])=>identity.jobs.includes(id)).map(([,label])=>label)].join(' '):'';}
