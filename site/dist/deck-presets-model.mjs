/** Named arrangements, never card grants, resources, or combat snapshots. */
import {SKILLS} from './engine/progression.mjs';
import {COMPANIONS} from './engine/recruitment.mjs';
import {DEFAULT_CASTLE_SELECTION,validateCastleSelection} from './engine/castle-catalog.mjs';
import {selectedCastle,previewCastleEquip} from './castle-loadout-model.mjs';
export const MAX_DECK_PRESETS=12;
export const MAX_DECK_CODE_BYTES=32768;
export const DECK_CODE_SCHEMA='castledecks-deck-presets-2';
export const PROFILE_DECK_SCHEMA='castledecks-profile-decks-2';
const shape=(value,keys,label)=>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))throw new TypeError(`Invalid ${label}.`);};
export function deckName(value){if(typeof value!=='string'||value.trim().length<1||value.trim().length>40||/[\u0000-\u001f\u007f]/.test(value))throw new TypeError('Use a deck name of 1–40 characters.');return value.trim();}
export function validateDeck(value,{legacy=false}={}){
 shape(value,legacy?['name','slots','companion']:['name','slots','companion','castle'],'deck');const name=deckName(value.name);
 const castle=validateCastleSelection(legacy?DEFAULT_CASTLE_SELECTION:value.castle);
 if(!Array.isArray(value.slots)||value.slots.length!==30)throw new TypeError('A deck must contain exactly 30 keys.');
 const seen=new Set();for(const id of value.slots){if(id===null)continue;if(typeof id!=='string'||!Object.hasOwn(SKILLS,id)||seen.has(id))throw new TypeError('Deck keys must contain known, non-duplicate ability IDs.');seen.add(id);}
 if(value.companion!==null&&(typeof value.companion!=='string'||!Object.hasOwn(COMPANIONS,value.companion)))throw new TypeError('Unknown companion.');
 return {name,slots:[...value.slots],companion:value.companion,castle:{...castle}};
}
export function validateDeckLibrary(value,options={}){
 if(!Array.isArray(value)||value.length>MAX_DECK_PRESETS)throw new TypeError('Keep at most 12 saved decks per profile.');
 const decks=value.map(deck=>validateDeck(deck,options)),names=new Set();for(const deck of decks){const key=deck.name.toLocaleLowerCase();if(names.has(key))throw new TypeError('Deck names must be unique within this profile.');names.add(key);}return decks;
}
export function captureDeck(profile,name){
 const slots=Array(30).fill(null);for(const skill of profile.skills){if(!profile.owned.has(skill.id)||!Number.isInteger(skill.binding)||skill.binding< -1||skill.binding>29)throw new TypeError('The current loadout is invalid. Reopen Loadout before saving.');if(skill.binding>=0){if(slots[skill.binding])throw new TypeError('Resolve overlapping keys before saving a deck.');slots[skill.binding]=skill.id;}}
 if(profile.companionId&&!profile.companionOwned.has(profile.companionId))throw new TypeError('The equipped companion is not owned.');
 return validateDeck({name:deckName(name),slots,companion:profile.companionId??null,castle:selectedCastle(profile)});
}
export function previewDeck(value,profile,{started=false,paused=false,summary=false,activeCompanion=false}={}){
 const deck=validateDeck(value),current=captureDeck(profile,'Current loadout'),byId=new Map(profile.skills.map(skill=>[skill.id,skill]));
 const missing=deck.slots.filter(id=>id!==null&&(!profile.owned.has(id)||!byId.has(id)));
 if(deck.companion&&!profile.companionOwned.has(deck.companion))missing.push(deck.companion);
 const changes=deck.slots.flatMap((id,slot)=>id===current.slots[slot]?[]:[{slot,from:current.slots[slot],to:id}]);
 const returns=current.slots.filter(id=>id!==null&&!deck.slots.includes(id));
 const companionChanged=deck.companion!==current.companion;
 const castlePreview=previewCastleEquip(deck.castle,profile,{started,summary}),castleChanged=castlePreview.changed;
 if(castlePreview.missing)missing.push(deck.castle.id);
 const blockers=[];if(missing.length)blockers.push('Acquire every missing card before applying this deck.');if(started&&!paused&&!summary)blockers.push('Pause the battle before applying a deck.');if(activeCompanion&&companionChanged)blockers.push('Recall the active companion before changing its slot.');
  if(castleChanged&&started&&!summary)blockers.push('Change your castle before starting or after the battle.');
 const hasBow=deck.slots.some(id=>id!==null&&!SKILLS[id].summon);
 return {deck,current,missing,changes,returns,companionChanged,castleChanged,blockers,hasBow,canApply:blockers.length===0};
}
/** All validation finishes before any live field changes. No callbacks or ticks
 * run during the synchronous commit; only bindings and dedicated companion/castle selections are touched. The
 * optional prepared-castle transaction changes the pristine tick-zero keep. */
export function applyDeck(value,profile,context={}){
 const preview=previewDeck(value,profile,context);if(!preview.canApply)return {ok:false,...preview};
 // Finish every potentially throwing validation before either live or profile commit.
 const castleTransaction=preview.castleChanged&&!context.summary&&context.prepareCastle?context.prepareCastle(preview.deck.castle):null;
 if(preview.castleChanged&&context.battle&&!context.summary&&!castleTransaction)throw new TypeError('Prepared castle transaction is required.');
 for(const [object,key] of [[profile,'companionId'],[profile,'castleId'],...profile.skills.map(skill=>[skill,'binding'])]){const field=Object.getOwnPropertyDescriptor(object,key);if(!field||!Object.hasOwn(field,'value')||!field.writable)throw new TypeError('Deck fields cannot be changed safely.');}
 const bindings=new Map(preview.deck.slots.flatMap((id,index)=>id===null?[]:[[id,index]]));
 if(castleTransaction)castleTransaction.apply();
 for(const skill of profile.skills)skill.binding=bindings.get(skill.id)??-1;
 profile.companionId=preview.deck.companion;profile.castleId=preview.deck.castle.id;
 return {ok:true,...preview};
}
export function exportDeckCode(decks){return JSON.stringify({schema:DECK_CODE_SCHEMA,decks:validateDeckLibrary(decks)},null,2);}
export function parseDeckCode(text){
 if(typeof text!=='string'||text.length>MAX_DECK_CODE_BYTES||new TextEncoder().encode(text).byteLength>MAX_DECK_CODE_BYTES)throw new TypeError('Deck code must be at most 32 KiB.');
 const value=JSON.parse(text);shape(value,['schema','decks'],'deck code');if(!['castledecks-deck-presets-1',DECK_CODE_SCHEMA].includes(value.schema))throw new TypeError('This is not a supported deck code. Campaign files belong in the campaign vault.');return validateDeckLibrary(value.decks,{legacy:value.schema==='castledecks-deck-presets-1'});
}
export function uniqueDeckName(name,decks){const used=new Set(decks.map(deck=>deck.name.toLocaleLowerCase()));let candidate=deckName(name),n=2;while(used.has(candidate.toLocaleLowerCase())){const suffix=` (${n++})`;candidate=name.slice(0,40-suffix.length).trimEnd()+suffix;}return candidate;}
export function mergeDeckLibraries(current,incoming){
 const existing=validateDeckLibrary(current),added=validateDeckLibrary(incoming);if(existing.length+added.length>MAX_DECK_PRESETS)throw new TypeError(`Import needs ${added.length} free deck slots; ${MAX_DECK_PRESETS-existing.length} available. No decks were added.`);
 for(const deck of added)existing.push({...deck,name:uniqueDeckName(deck.name,existing)});return existing;
}
/** Profile identity owns each library, including retired records. No global
 * library or name-based cross-profile matching. Portable campaigns stay intact. */
export function createProfileDecks(){
 const libraries=new WeakMap();
 const get=profile=>validateDeckLibrary(libraries.get(profile)??[]);
 const set=(profile,decks)=>{const safe=validateDeckLibrary(decks);libraries.set(profile,safe);return get(profile);};
 const snapshot=manager=>{const value={schema:PROFILE_DECK_SCHEMA,profiles:manager.profiles.map(get),retired:manager.retired.map(get)};return [...value.profiles,...value.retired].some(list=>list.length)?value:undefined;};
 const restore=(manager,value)=>{if(value===undefined)return;const safe=validateProfileDecks(value,manager);manager.profiles.forEach((profile,i)=>set(profile,safe.profiles[i]));manager.retired.forEach((profile,i)=>set(profile,safe.retired[i]));};
 return {get,set,snapshot,restore};
}
export function validateProfileDecks(value,manager){
 shape(value,['schema','profiles','retired'],'profile decks');if(!['castledecks-profile-decks-1',PROFILE_DECK_SCHEMA].includes(value.schema)||!Array.isArray(value.profiles)||!Array.isArray(value.retired)||value.profiles.length!==manager.profiles.length||value.retired.length!==manager.retired.length)throw new TypeError('Deck metadata does not match its campaign profiles.');
 return {schema:PROFILE_DECK_SCHEMA,profiles:value.profiles.map(decks=>validateDeckLibrary(decks,{legacy:value.schema==='castledecks-profile-decks-1'})),retired:value.retired.map(decks=>validateDeckLibrary(decks,{legacy:value.schema==='castledecks-profile-decks-1'}))};
}
