/** Conservative reserve-exhaustion proof for the disposable Causeway objective.
 * Gold, cooldown, battlefield slots and menu assignments are never impossibility
 * proofs. Unknown actors/producers fail open. No resources or queues are edited. */
import {FlagTroop,FlagState,FLAG_STATUS as FS} from './flag-troop.mjs';
import {MountedTroop} from './mounted-troop.mjs';
import {FlagArcher,FlagPriest,FlagTrebuchet} from './ranged-troop.mjs';
import {AirFighter,DragonScoutPoison,DragonScoutFire,DragonScoutIce,FlagFireDemon,FlagIceDemon,TestBoss} from './later-enemies.mjs';
import {GorathCompanion,CompanionController} from './companions.mjs';
import {Hero,Castle} from './actors.mjs';
import {Tower} from './tower.mjs';
import {FriendlyReinforcements} from './campaign.mjs';
import {BattleDirector} from './battle-director.mjs';
import {SKILLS,SkillProgress} from './progression.mjs';
const recoveryIds=new Set(['grunt','tallGrunt','mount','fireDemon','iceDemon']);
const knownFactories={grunt:FlagTroop,tallGrunt:FlagTroop,mount:MountedTroop,archer:FlagArcher,priest:FlagPriest,trebuchet:FlagTrebuchet,air:AirFighter,poisonDragon:DragonScoutPoison,fireDragon:DragonScoutFire,iceDragon:DragonScoutIce,fireDemon:FlagFireDemon,iceDemon:FlagIceDemon,gorath:TestBoss};
const prototypes=new Set([...Object.values(knownFactories),Hero,GorathCompanion].map(C=>C.prototype));
const live=u=>u?.hp>0&&!u.dead&&!u.destroyed;
const answer=(state,reason,extra={})=>Object.freeze({state,reason,...extra});
export function flagRecoveryOptions(b){
 if(!b?.ownFlag)return answer('unknown','invalid-state');
 if(b.ownFlag.status===FS.AT_BASE)return answer('safe','home');
 if(b.ownFlag.status===FS.CAPTURED)return answer('lost','captured');
 if([FS.HELD_BY_ENEMY,FS.HELD_BY_FRIEND].includes(b.ownFlag.status))return answer('possible','carried');
 if(b.ownFlag.status!==FS.GROUNDED)return answer('unknown','invalid-flag');
 // The reserve proof applies only to an ordinary, genuinely grounded flag.
 // A stale holder, invalid terrain or assisted fixture cannot prove a loss.
 const flag=b.ownFlag;
 if(b.testing||b.protectedTesting)return answer('unknown','testing-fixture');
 if(Object.getPrototypeOf(flag)!==FlagState.prototype||flag.holder!=null||![flag.x,flag.y,b.width].every(Number.isFinite)||b.width<=0||flag.x<0||flag.x>b.width||typeof b.elevationAt!=='function'||!Number.isFinite(b.elevationAt(flag.x)))return answer('unknown','invalid-flag');
 const objects=b.objects?.items,good=b.goodTeam,bad=b.badTeam,q=b.friendlyQueue;
 if(!Array.isArray(objects)||!Array.isArray(good)||!Array.isArray(bad)||!q||!Array.isArray(q.queue)||!Number.isSafeInteger(q.population)||q.population<0)return answer('unknown','invalid-state');
 if(Object.getPrototypeOf(q)!==FriendlyReinforcements.prototype||['step','cancel','enqueue','enqueueSquad'].some(key=>q[key]!==FriendlyReinforcements.prototype[key]))return answer('unknown','unrecognized-producer');
 for(const u of new Set([...good,...bad,...objects.filter(u=>u?.isFighter)])){
  if(!u||!objects.includes(u)||!prototypes.has(Object.getPrototypeOf(u))||u.world!==b||!good.includes(u)&&!bad.includes(u)||['step','chooseNextAction','transition','destroy'].some(key=>u[key]!==Object.getPrototypeOf(u)[key]))return answer('unknown','unrecognized-actor');
  if(!live(u))continue;
  // These ordinary grounded classes share the actual flag-recovery AI. Their
  // current allegiance is authoritative, independent of recruitment provenance.
  if(u.team==='good'&&u.chooseNextAction===FlagTroop.prototype.chooseNextAction)return answer('possible','living-recoverer');
 }
 // WorldObjects is another future-work queue. An unrecognized nonfighter or
 // dead actor can still spawn/transform a recoverer on a later tick. Whitelist
 // only the actual ordinary flags and structures, with unchanged behavior.
 for(const u of objects){
  if(u?.isFighter)continue;
  const proto=u&&Object.getPrototypeOf(u);
  if(proto===FlagState.prototype&&(u===b.ownFlag||u===b.enemyFlag)&&u.step===FlagState.prototype.step)continue;
  if((proto===Castle.prototype||proto===Tower.prototype)&&b.structures?.includes(u)&&['step','destroy','takeDamage'].every(key=>u[key]===proto[key]))continue;
  return answer('unknown','unrecognized-producer');
 }
 let refundable=0;
 for(const ticket of q.queue){
  if(!ticket||!Object.hasOwn(knownFactories,ticket.type)||!Number.isSafeInteger(ticket.cost)||ticket.cost<0)return answer('unknown','unrecognized-ticket');
  if(recoveryIds.has(ticket.type))return answer('possible','recovery-arriving');
  refundable+=ticket.cost;
 }
 // An auxiliary controller may have private undispatched tickets. Do not use
 // its mutating presentation snapshot in a supposedly read-only proof.
 if(b.auxiliaries)return answer('unknown','auxiliary-reserves');
 if(Object.getPrototypeOf(b.enemies??{})!==BattleDirector.prototype||b.enemies.step!==BattleDirector.prototype.step||Object.getPrototypeOf(b.companions??{})!==CompanionController.prototype||b.companions.step!==CompanionController.prototype.step)return answer('unknown','unrecognized-producer');
 if(Object.keys(b.unitFactories??{}).length!==Object.keys(knownFactories).length||Object.entries(knownFactories).some(([id,C])=>b.unitFactories[id]!==C))return answer('unknown','unrecognized-producer');
 for(const key of ['spells','projectiles','activationObjects','reactiveElements','playerShots'])if(!Array.isArray(b[key])||b[key].length)return answer('unknown','pending-effects');
 if(objects.some(u=>u.effects?.effects?.length))return answer('unknown','pending-effects');
 if(b.queuedAim||b.queuedSelection!=null)return answer('unknown','pending-input');
 const options=[];
 if(!Array.isArray(b.profile?.skills))return answer('unknown','invalid-contracts');
 for(const skill of b.profile.skills){
  if(!skill||!Object.hasOwn(SKILLS,skill.id)||Object.getPrototypeOf(skill)!==SkillProgress.prototype||skill.step!==SkillProgress.prototype.step||skill.use!==SkillProgress.prototype.use)return answer('unknown','unrecognized-contract');
  if(!recoveryIds.has(skill.id))continue;
  const s=SKILLS[skill.id].summon,reserve=s?.amount*s?.population;
  if(!Number.isSafeInteger(reserve)||reserve<=0||!Number.isFinite(s.cost)||s.cost<0)return answer('unknown','invalid-contract');
  options.push(Object.freeze({id:skill.id,reserve,gold:s.cost,cooldown:skill.cooldown,bound:!!b.hotbar?.bars?.some(bar=>bar.includes(skill))}));
 }
 const available=q.population+refundable;
 if(!Number.isSafeInteger(available))return answer('unknown','invalid-reserve');
 const data={reserve:available,refundable,options:Object.freeze(options)};
 if(!options.length||options.every(o=>o.reserve>available))return answer('impossible','reserve-exhausted',data);
 return answer('possible',refundable&&options.every(o=>o.reserve>q.population)?'cancel-to-recover-reserve':options.some(o=>o.reserve<=available&&o.gold<=b.profile.gold)?'recruit-recoverer':'earn-gold',data);
}
