/** Independent active/retired profile management, using live PlayerProfile objects.
 * Profile lifecycle is modeled independently.
 * This module has no browser storage, filesystem, network, autosave or submission.
 * Export returns own-format JSON text. Import replaces in-memory state only and
 * reconstructs skills at constructor cooldown/strobe; it never resumes a battle.
 */
import {PlayerProfile,serializeProfile,restoreProfile} from './progression.mjs';

export const MAX_ACTIVE_PROFILES=9;
export const PROFILE_NAME_INPUT_LIMIT=12;
export const MAX_PROFILE_BUNDLE_BYTES=1024*1024;
export const PROFILE_BUNDLE_SCHEMA='bowmaster-reconstruction-profiles-1';
const SINGLE_PROFILE_SCHEMAS=new Set(['bowmaster-reconstruction-1','bowmaster-reconstruction-2']);
const aimingModes=new Set(['classic','anywhere','point_aim','auto_aim']);
const byteLength=text=>new TextEncoder().encode(text).byteLength;

/** A modern text-field boundary, counting UTF-16 units like HTML maxlength.
 * No trimming: spaces and duplicate names are allowed. Imported historic names
 * are NOT passed through this helper. Flash Unicode edge parity is unmeasured.
 */
export function profileNameInput(value) {
  if(typeof value!=='string')throw new TypeError('Profile name must be text');
  return value.slice(0,PROFILE_NAME_INPUT_LIMIT);
}

/** Preserve the observed arithmetic order, including NaN for zero games.
 * Retirement normally follows campaign completion, so that edge is unreachable
 * through the original normal flow. Invalid scores cannot be exported by the
 * existing validated single-profile serializer; do not silently turn them into0.
 */
export function retirementScore(profile) {
  if(profile.cheated)return 1;
  return profile.gold-Math.floor(profile.defeats*(profile.gold/(profile.defeats+profile.victories)));
}

function checkInstances(profiles,retired) {
  if(!Array.isArray(profiles)||!Array.isArray(retired))throw new TypeError('Profile lists must be arrays');
  if(profiles.length>MAX_ACTIVE_PROFILES)throw new RangeError('At most nine active profiles are allowed');
  const all=[...profiles,...retired];
  if(all.some(profile=>!(profile instanceof PlayerProfile)))throw new TypeError('Expected live PlayerProfile objects');
  if(new Set(all).size!==all.length)throw new TypeError('A live profile cannot occupy two records');
}

export class CampaignProfiles {
  #profiles;
  #retired;
  #activeIndex=0;
  /** Neutral default-name presentation is independent of the source's14-name
   * pool. Supply a factory for different fresh names. No original global RNG
   * sequence is claimed, including on imported/refitted profile construction.
   * activeIndex is an in-memory convenience only; it is never serialized.
   */
  constructor({profiles=[],retired=[],activeIndex=0,defaultName='BowMaster'}={}) {
    checkInstances(profiles,retired);
    if(typeof defaultName!=='string'&&typeof defaultName!=='function')throw new TypeError('Default name must be text or a name factory');
    this.defaultName=defaultName;
    this.#profiles=[...profiles];this.#retired=[...retired];
    if(this.#profiles.length===0)this.#profiles.push(this.#freshDefault());
    this.select(activeIndex);
  }
  #freshDefault() {
    const name=typeof this.defaultName==='function'?this.defaultName():this.defaultName;
    if(typeof name!=='string'||name==='')throw new TypeError('Default profile name must be nonempty text');
    const profile=new PlayerProfile(name);profile.cheated=false;return profile;
  }
  // Lists are shallow snapshots; their profile and skill objects remain live.
  get profiles(){return [...this.#profiles];}
  get retired(){return [...this.#retired];}
  get active(){return this.#profiles[this.#activeIndex];}
  get activeIndex(){return this.#activeIndex;}
  get canCreate(){return this.#profiles.length<MAX_ACTIVE_PROFILES;}
  get canDelete(){return this.#profiles.length>1;}

  create(name,{shootingMode='classic'}={}) {
    if(typeof name!=='string')throw new TypeError('Profile name must be text');
    if(name===''||!this.canCreate)return null;
    if(!aimingModes.has(shootingMode))throw new RangeError('Unknown shooting mode');
    // maxLength12 belongs to the input field, not the source model. Keep direct
    // caller/historical names unchanged. The nine-profile menu gate is enforced
    // here so the modern manager cannot bypass its active-profile limit.
    const profile=this.#freshDefault();profile.name=name;profile.shootingMode=shootingMode;
    this.#profiles.push(profile);this.#activeIndex=this.#profiles.length-1;
    return profile;
  }
  select(index) {
    if(!Number.isInteger(index)||index<0||index>=this.#profiles.length)throw new RangeError('Unknown active profile index');
    this.#activeIndex=index;return this.active;
  }
  deleteCurrent() {
    if(!this.canDelete)return null;
    const [removed]=this.#profiles.splice(this.#activeIndex,1);
    this.#activeIndex=0;
    return removed;
  }
  retireCurrent() {
    const completed=this.active;
    // Prepare a replacement first so a failing caller-supplied name factory
    // cannot leave the manager empty. The normal lifecycle uses one new profile.
    const replacement=this.#profiles.length===1?this.#freshDefault():null;
    this.#profiles.splice(this.#activeIndex,1);
    if(replacement)this.#profiles.push(replacement);
    this.#activeIndex=0;this.#retired.push(completed);
    completed.gold=retirementScore(completed);
    if(completed.cheated)completed.name=completed.name.substring(0,1)+'. Cheater';
    return completed;
  }
  /** Source sorting mutates retired order; it does not truncate stored records.
   * Modern JavaScript preserves insertion order for equal gold comparisons.
   */
  getSortedRetiredProfiles() {
    this.#retired.sort((a,b)=>a.gold>b.gold?-1:a.gold<b.gold?1:0);
    return this.retired;
  }
  highScores(){return this.getSortedRetiredProfiles().slice(0,10);}
  exportBundle(){return serializeProfiles(this);}
  importBundle(text) {
    // Parsing, all nested validation, and fallback creation finish before commit.
    const replacement=restoreProfiles(text,{defaultName:this.defaultName});
    this.#profiles=replacement.#profiles;this.#retired=replacement.#retired;this.#activeIndex=0;
    return this.active;
  }
  static fromBundle(text,options={}){return restoreProfiles(text,options);}
}

function ensureBounded(text) {
  if(typeof text!=='string')throw new TypeError('Profile bundle must be JSON text');
  if(text.length>MAX_PROFILE_BUNDLE_BYTES||byteLength(text)>MAX_PROFILE_BUNDLE_BYTES)
    throw new RangeError('Profile bundle exceeds 1 MiB');
}
function shape(record,keys,label) {
  if(record===null||typeof record!=='object'||Array.isArray(record)||Object.keys(record).length!==keys.length||
    keys.some(key=>!Object.hasOwn(record,key)))throw new TypeError(`Invalid ${label} fields`);
}
function recordText(profile) {
  const cheated=profile.cheated??false;
  if(typeof cheated!=='boolean')throw new TypeError('Invalid profile cheated flag');
  // Compose an existing validated own-format payload rather than redefining it.
  return `{"profile":${serializeProfile(profile)},"cheated":${cheated}}`;
}

/** Export is a pure snapshot: it does not clone or replace any live game object,
 * reorder retired records, reset timers, or record the current selection.
 */
export function serializeProfiles(manager) {
  if(!(manager instanceof CampaignProfiles))throw new TypeError('Expected a CampaignProfiles manager');
  const chunks=[];let bytes=0;
  const append=text=>{
    bytes+=byteLength(text);
    if(bytes>MAX_PROFILE_BUNDLE_BYTES)throw new RangeError('Profile bundle exceeds 1 MiB');
    chunks.push(text);
  };
  append(`{"schema":"${PROFILE_BUNDLE_SCHEMA}","profiles":[`);
  manager.profiles.forEach((profile,index)=>{if(index)append(',');append(recordText(profile));});
  append('],"retired":[');
  manager.retired.forEach((profile,index)=>{if(index)append(',');append(recordText(profile));});
  append(']}');return chunks.join('');
}

/** Import accepts this bundle or one existing v1 reconstruction profile.
 * It does not accept original Flash SharedObjects. Selection restarts at0;
 * active and retired skills both receive fresh constructor cooldown/strobe.
 */
export function restoreProfiles(text,options={}) {
  ensureBounded(text);
  const value=JSON.parse(text);
  if(SINGLE_PROFILE_SCHEMAS.has(value?.schema))
    return new CampaignProfiles({...options,profiles:[restoreProfile(text)],retired:[],activeIndex:0});
  shape(value,['schema','profiles','retired'],'profile bundle');
  if(value.schema!==PROFILE_BUNDLE_SCHEMA)throw new TypeError('Unsupported profile bundle');
  if(!Array.isArray(value.profiles)||!Array.isArray(value.retired))throw new TypeError('Invalid profile bundle lists');
  if(value.profiles.length>MAX_ACTIVE_PROFILES)throw new RangeError('At most nine active profiles are allowed');
  const restore=record=>{
    shape(record,['profile','cheated'],'profile record');
    if(typeof record.cheated!=='boolean')throw new TypeError('Invalid profile cheated flag');
    const profile=restoreProfile(JSON.stringify(record.profile));
    profile.cheated=record.cheated;return profile;
  };
  const profiles=value.profiles.map(restore),retired=value.retired.map(restore);
  return new CampaignProfiles({...options,profiles,retired,activeIndex:0});
}
