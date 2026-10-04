/** Optional authored battlefield data. Default CampaignBattle construction never
 * enters this path. Data is copied and bounded before live objects are created.
 */
import {validateCastleSelection} from './castle-catalog.mjs';

const enemyTypes=new Set(['grunt','tallGrunt','archer','priest','trebuchet','mount','air','poisonDragon','fireDragon','iceDragon','iceDemon','fireDemon','gorath']);
export function validateBattleEncounter(value){
 if(value===null)return null;
 if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError('Invalid battlefield encounter');
 const keys=['id','scenery','timeOfDay','heights','roster','towers','enemyKeepHP','objective'];
 // Old eight-field encounters keep their exact output shape. The only optional
 // addition is an explicit enemy selection, never an implicit seed/type change.
 const ownKeys=Reflect.ownKeys(value);
 if (![Object.prototype,null].includes(Object.getPrototypeOf(value)) ||
     keys.some(key=>!Object.hasOwn(value,key)) ||
     ownKeys.some(key=>!keys.includes(key)&&key!=='enemyCastle') ||
     ownKeys.some(key=>{const field=Object.getOwnPropertyDescriptor(value,key);return !Object.hasOwn(field,'value')||!field.enumerable;})) {
   throw new TypeError('Invalid battlefield encounter fields');
 }
 const enemyCastle=Object.hasOwn(value,'enemyCastle')?validateCastleSelection(value.enemyCastle):null;
 if(typeof value.id!=='string'||!value.id||value.id.length>64)throw new TypeError('Invalid encounter identity');
 if(!['oaks','lowlands','pines','wasteland'].includes(value.scenery)||!['dawn','noon','default','dusk','night'].includes(value.timeOfDay))throw new RangeError('Unknown encounter scenery');
 if(!['standard','break-keep','intercept-battery'].includes(value.objective))throw new RangeError('Unknown encounter objective');
 if(!Array.isArray(value.heights)||value.heights.length!==101||value.heights.some(h=>!Number.isFinite(h)||h<300||h>850))throw new RangeError('Encounter needs 101 finite terrain heights');
 if(!Array.isArray(value.roster)||!value.roster.length||value.roster.length>500||value.roster.some(type=>!enemyTypes.has(type)))throw new RangeError('Invalid finite encounter roster');
 if(value.objective==='intercept-battery'&&value.roster.filter(type=>type==='trebuchet').length!==2)throw new RangeError('Battery interception needs exactly two finite-roster trebuchets');
 if(value.objective==='intercept-battery'&&['grunt','tallGrunt','mount','priest'].some(type=>!value.roster.includes(type)))throw new RangeError('Battery interception needs its finite opening escort');
 if(!Array.isArray(value.towers)||value.towers.length>3||new Set(value.towers).size!==value.towers.length||value.towers.some(x=>!Number.isFinite(x)||x<450||x>1550))throw new RangeError('Invalid encounter towers');
 if(!Number.isSafeInteger(value.enemyKeepHP)||value.enemyKeepHP<500||value.enemyKeepHP>40000)throw new RangeError('Invalid enemy keep health');
 return Object.freeze({...value,...(enemyCastle?{enemyCastle}:{}),heights:Object.freeze([...value.heights]),roster:Object.freeze([...value.roster]),towers:Object.freeze([...value.towers])});
}
