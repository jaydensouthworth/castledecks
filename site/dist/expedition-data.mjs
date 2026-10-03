/** Original authored four-leg expedition. Geometry, compositions and route
 * choices are independent game content, not renamed campaign/test levels. */
export const EXPEDITION_ID='wayfarer-charter';
export const EXPEDITION_NAME='The Wayfarer Charter';
export const EXPEDITION_LENGTH=4;
export const EXPEDITION_STARTER=Object.freeze({rank:4,basicRank:3,skillRank:1,gold:1000,skills:Object.freeze(['arrow','grunt','archer','fireArrow','iceArrow','bombArrow','flakArrow'])});
const terrain=fn=>Object.freeze(Array.from({length:101},(_,i)=>Math.round(fn(i/100)*100)/100));
const fields={
 tollgate:{id:'tollgate',name:'The Tollgate',leg:1,level:4,objective:'standard',scenery:'oaks',timeOfDay:'dawn',enemyKeepHP:5200,towers:[],next:['skyglass','sunken'],
  counts:{grunt:14,tallGrunt:2,archer:3,priest:1,mount:2},
  heights:terrain(x=>690+42*Math.sin(Math.PI*x)-16*Math.sin(3*Math.PI*x)),
  description:'Win a foothold and open two roads into the border country.',
  tradeoff:'A ground-only opening. Protect your first companies and earn supplies for the road.',
  objectiveText:'Bring their flag home while yours is safe, or defeat every remaining enemy.'},
 skyglass:{id:'skyglass',name:'Skyglass Watch',leg:2,level:6,objective:'break-keep',scenery:'pines',timeOfDay:'noon',enemyKeepHP:4300,towers:[1000],next:['ember','frost'],
  counts:{grunt:8,archer:3,air:3,fireDragon:1},
  heights:terrain(x=>690-155*Math.exp(-(((x-.53)/.18)**2))+18*Math.sin(4*Math.PI*x)),
  description:'Cut the watchtower’s signal by destroying its keep. The high route is exposed to aerial fire.',
  tradeoff:'Smaller reserve; resistant flyers. The battle ends as soon as the enemy keep falls.',
  objectiveText:'Destroy the enemy keep. Clearing its army alone does not complete this siege.'},
 sunken:{id:'sunken',name:'The Sunken Road',leg:2,level:5,objective:'standard',scenery:'lowlands',timeOfDay:'dusk',enemyKeepHP:6200,towers:[],next:['ember','frost'],
  counts:{grunt:17,tallGrunt:3,archer:4,priest:2,mount:8},
  heights:terrain(x=>635+115*Math.sin(Math.PI*x)+19*Math.sin(3*Math.PI*x)),
  description:'Escort your banner through the valley before the mounted patrols reach home.',
  tradeoff:'Larger ground reserve; fast flag runners. More targets can mean more combat earnings, but every arrow still has to land.',
  objectiveText:'Bring their flag home while yours is safe, or defeat every remaining enemy.'},
 ember:{id:'ember',name:'Ember Gate',leg:3,level:7,objective:'break-keep',scenery:'wasteland',timeOfDay:'dusk',enemyKeepHP:5600,towers:[900],next:['stormcrown'],
  counts:{grunt:11,tallGrunt:3,archer:3,priest:2,fireDemon:2,fireDragon:1},
  heights:terrain(x=>700-54*Math.sin(2*Math.PI*x)-25*Math.sin(5*Math.PI*x)),
  description:'The southern gate is guarded by fire. Hold the ground long enough to break its walls.',
  tradeoff:'Fire defenders strongly resist physical damage. Ice counters them; fire remains effective against the keep.',
  objectiveText:'Destroy the enemy keep. A safe flag return alone does not complete this siege.'},
 frost:{id:'frost',name:'Frost Hollow',leg:3,level:7,objective:'standard',scenery:'pines',timeOfDay:'night',enemyKeepHP:6600,towers:[1200],next:['stormcrown'],
  counts:{grunt:13,tallGrunt:2,archer:4,priest:2,mount:3,iceDemon:1,iceDragon:1},
  heights:terrain(x=>680+69*Math.sin(Math.PI*x)-50*Math.sin(3*Math.PI*x)),
  description:'Take the colder northern hollow and keep the standard moving through the pines.',
  tradeoff:'Ice defenders are vulnerable to fire. Standard victory permits a flag run or a complete army defeat.',
  objectiveText:'Bring their flag home while yours is safe, or defeat every remaining enemy.'},
 stormcrown:{id:'stormcrown',name:'Storm Crown',leg:4,level:9,objective:'break-keep',scenery:'wasteland',timeOfDay:'dawn',enemyKeepHP:7600,towers:[820,1320],next:[],
  counts:{grunt:18,tallGrunt:4,archer:4,priest:2,trebuchet:2,air:2,fireDragon:1,iceDragon:1},
  heights:terrain(x=>695-70*Math.sin(2*Math.PI*x)+35*Math.sin(4*Math.PI*x)),
  description:'The charter ends at the storm fortress. Break the keep while your banner and hero remain safe.',
  tradeoff:'Mixed aerial and siege pressure. Both elemental counters matter, and two towers offer forward positions.',
  objectiveText:'Destroy the enemy keep to complete the charter.'},
};
for(const field of Object.values(fields)){Object.freeze(field.counts);Object.freeze(field.next);Object.freeze(field.towers);Object.freeze(field);}
export const EXPEDITION_FIELDS=Object.freeze(fields);
export function expeditionField(id){if(typeof id!=='string'||!Object.hasOwn(EXPEDITION_FIELDS,id))throw new RangeError('Unknown charter field');return EXPEDITION_FIELDS[id];}
export function encounterSeed(seed,id){expeditionField(id);let value=seed>>>0;for(const character of id)value=Math.imul(value^character.charCodeAt(0),16777619)>>>0;return value||1;}
export function createExpeditionEncounter(id,random){
 const field=expeditionField(id),roster=Object.entries(field.counts).flatMap(([type,count])=>Array(count).fill(type));
 for(let i=roster.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[roster[i],roster[j]]=[roster[j],roster[i]];}
 return {id:field.id,scenery:field.scenery,timeOfDay:field.timeOfDay,heights:field.heights,roster,towers:field.towers,enemyKeepHP:field.enemyKeepHP,objective:field.objective};
}
