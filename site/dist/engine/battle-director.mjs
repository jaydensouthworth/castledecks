/** Modern, finite battle pacing. This is an intentional design extension, not
 * recovered Flash AI. It reads the public battlefield, never player input,
 * selected abilities, cooldowns, gold, reserve, or future RNG values. Unit stats
 * and local combat/flag behavior are unchanged. All clocks are simulation ticks.
 */
export const DIRECTOR_LIMITS=Object.freeze({squad:4,finalBossGap:12});
const strength=Object.freeze({grunt:1,tallGrunt:1.4,archer:1,priest:1,mount:1.4,trebuchet:2,air:1.5,fireDragon:2.5,iceDragon:2.5,poisonDragon:2.5,fireDemon:2.5,iceDemon:2.5,gorath:6,dragon_scout_fire:2.5,dragon_scout_ice:2.5,dragon_scout_poison:2.5,fire_demon:2.5,ice_demon:2.5,test_boss:6});
const alive=u=>u.hp>0&&!u.dead&&!u.destroyed;
const weight=u=>strength[typeof u==='string'?u:u.type]??1;
const sum=units=>units.reduce((n,u)=>n+weight(u),0);
export function battleFieldLimits(level){const bonus=level>=13?4:level>=7?2:0;return {friendly:10+bonus,enemy:20+bonus};}

/** Only facts an army can observe. Retain slot accounting separately from living
 * pressure so dying units still occupy their normal slot until actual removal. */
export function observeBattlefield(battle){
 const allies=battle.goodTeam.filter(u=>u!==battle.hero&&!u.isCompanion&&alive(u));
 const enemies=battle.badTeam.filter(alive);
 return {onScreen:battle.badTeam.length,allies:allies.length,enemyAlive:enemies.length,
  enemyStrength:sum(enemies),enemyElites:enemies.filter(u=>weight(u)>2).length,enemyApproaching:enemies.filter(u=>Number.isFinite(u.x)&&Number.isFinite(u.y)&&u.x>battle.width-10).length,enemyWounded:enemies.filter(u=>u.hp/u.maxHp<.55).length,
  enemyFront:enemies.filter(u=>u.x<800).length,allyBreach:allies.filter(u=>u.x>1450).length,
  enemyFlagThreatened:[0,1,4].includes(battle.enemyFlag.status),castleFallen:!(battle.badCastle.hp>0)};
}
const roles=Object.freeze({
 opening:{label:'Opening patrol',types:['grunt','grunt','archer','grunt']},
 assault:{label:'Infantry advance',types:['grunt','archer','mount','tallGrunt']},
 support:{label:'Supported advance',types:['grunt','priest','archer','tallGrunt']},
 siege:{label:'Siege escort',types:['tallGrunt','trebuchet','grunt','archer']},
 skirmish:{label:'Mixed patrol',types:['grunt','air','archer','mount','fireDragon','iceDragon','poisonDragon','fireDemon','iceDemon']},
 rescue:{label:'Flag relief',types:['mount','grunt','tallGrunt','archer']},
 defense:{label:'Keep defense',types:['tallGrunt','archer','priest','grunt']},
 recovery:{label:'Healer escort',types:['priest','tallGrunt','archer','grunt']},
 boss:{label:'Gorath advances',types:['gorath','grunt','archer']},
});
const rotation=['assault','support','siege','skirmish'];

export class BattleDirector {
 constructor({roster,level=1,difficulty='medium',wave}={}){
  this.roster=[...roster];this.index=0;this.withdrawn=0;this.level=level;this.cap=battleFieldLimits(level).enemy;
  this.wave=wave;this.pending=[];this.squads=0;this.closed=false;this.phase='muster';this.label='Opening patrol';this.timer=0;this.spawned=0;
  this.setDifficulty(difficulty);this.timer=this.assemblyTicks;
  this.wave.maximum=DIRECTOR_LIMITS.squad;this.wave.remaining=this.wave.maximum;this.syncWave();
 }
 setDifficulty(difficulty){
  if(!['easy','medium','hard','insane'].includes(difficulty))throw new RangeError('Unknown difficulty');
  this.difficulty=difficulty;
  this.regroupTicks=difficulty==='easy'?165:difficulty==='medium'?132:99;
  this.assemblyTicks=difficulty==='easy'?33:22;
  this.interval=difficulty==='easy'?14:11;
 }
 get remaining(){return Math.max(0,this.roster.length-this.index-this.withdrawn);}
 get finalStand(){return this.closed;}
 syncWave(){this.wave.countdown=Math.max(0,this.timer);this.wave.delay=Math.max(1,this.phase==='regroup'?this.regroupTicks:this.assemblyTicks);}
 /** Cut the supply route, not the field army. Keep an undispatched unique boss.
  * Nothing here kills units, drops flags, changes stats, or awards any reward. */
 closeReserves(){
  if(this.closed)return null;
  const reserve=this.roster.slice(this.index),bosses=reserve.filter(type=>type==='gorath');
  this.withdrawn+=reserve.length-bosses.length;
  // The remaining boss is contiguous at index. The full roster multiset remains
  // intact for audit/save diagnostics; withdrawn regulars are never dispatched.
  const tail=[...bosses,...reserve.filter(type=>type!=='gorath')];this.roster.splice(this.index,tail.length,...tail);
  this.pending=[];this.closed=true;this.phase='last-stand';this.label='Final stand';this.timer=0;this.wave.remaining=0;this.syncWave();
  return {withdrawn:this.withdrawn,bosses:bosses.length};
 }
 targetStrength(state){
  // The bow remains important even with no army. Extra army capacity is met by
  // measured pressure, not a matching wall; Easy has both a lower floor and cap.
  return Math.min(this.difficulty==='easy'?16:20,(this.difficulty==='easy'?4:6)+state.allies*.85);
 }
 chooseRole(state){
  if(this.roster[this.index]==='gorath')return 'boss';
  if(this.squads===0)return 'opening';
  if(state.enemyFlagThreatened)return 'rescue';
  if(state.allyBreach>1)return 'defense';
  if(state.enemyWounded>=3)return 'recovery';
  return rotation[this.squads%rotation.length];
 }
 plan(state){
  const role=this.chooseRole(state),template=roles[role],available=this.roster.slice(this.index,this.roster.length-this.withdrawn);
  const deficit=Math.max(0,this.targetStrength(state)-state.enemyStrength),slots=Math.min(this.cap-state.onScreen,DIRECTOR_LIMITS.squad);
  let budget=deficit,specials=0,elites=state.enemyElites??0;const selected=[];
  const choose=type=>{
   const pos=available.indexOf(type),cost=weight(type);if(pos<0||selected.length>=slots)return false;
   if(cost>budget&&!(type==='gorath'&&!selected.length))return false;
   // Easy presents one resistant dragon/demon (or boss) at a time. It stays
   // in the same finite reserve until the current elite is actually defeated.
   if(this.difficulty==='easy'&&cost>2&&elites>=1)return false;
   if(cost>=2&&specials>=1)return false;
   selected.push(type);available.splice(pos,1);budget-=cost;if(cost>=2)specials++;if(cost>2)elites++;return true;
  };
  const aerial=role==='skirmish'?available.find(type=>['air','fireDragon','iceDragon','poisonDragon','fireDemon','iceDemon'].includes(type)):null;
  for(const type of (aerial?['grunt',aerial,'archer','mount']:template.types))choose(type);
  // Composition is finite: if a role is unavailable, use the seeded reserve
  // order. Never invent a healer/flyer, replace a budget, or boost unit stats.
  for(const type of available.slice())choose(type);
  if(!selected.length)return false;
  this.pending=selected;this.label=template.label;this.phase='muster';this.timer=this.assemblyTicks;this.squads++;
  this.wave.maximum=selected.length;this.wave.remaining=selected.length;this.syncWave();return true;
 }
 take(type){
  const found=this.roster.indexOf(type,this.index);if(found<this.index||found>=this.roster.length-this.withdrawn)return null;
  [this.roster[this.index],this.roster[found]]=[this.roster[found],this.roster[this.index]];
  this.index++;this.spawned++;return type;
 }
 step(state){
  if(state.castleFallen)this.closeReserves();
  if(this.remaining<=0){this.pending=[];this.phase=this.closed?'last-stand':'spent';this.wave.remaining=0;this.syncWave();return null;}
  if(this.timer>0)this.timer--;this.syncWave();
  if(this.timer>0||state.onScreen>=this.cap)return null;
  if(this.closed){this.timer=DIRECTOR_LIMITS.finalBossGap;return this.take('gorath');}
  if(!this.pending.length){
   // An army already at the player's home consolidates instead of piling on.
   // Relief still responds to a stolen flag; the rule is the same on all levels.
   const pressuring=state.enemyFront>=Math.max(3,state.allies+1)&&!state.enemyFlagThreatened;
   if(pressuring||state.enemyStrength>=this.targetStrength(state)){
    this.phase='holding';this.label='Holding the line';this.timer=22;this.wave.remaining=0;this.syncWave();return null;
   }
   if(!this.plan(state)){this.phase='holding';this.timer=22;this.wave.remaining=0;this.syncWave();}return null;
  }
  // Recheck current difficulty at dispatch: an options change can happen
  // after planning. Defer an elite without consuming or replacing its reserve.
  if(this.difficulty==='easy'&&(state.enemyElites??0)>=1&&weight(this.pending[0])>2){
   this.pending=[];this.phase='holding';this.label='Holding the line';this.timer=22;this.wave.remaining=0;this.syncWave();return null;
  }
  const type=this.take(this.pending.shift());this.wave.remaining=this.pending.length;
  this.phase=this.pending.length?'deploying':'regroup';this.timer=this.pending.length?this.interval:this.regroupTicks;this.syncWave();return type;
 }
 status(state){
  if(this.closed){
   if(state.enemyAlive&&state.enemyApproaching===state.enemyAlive)return `Final stand · ${state.enemyAlive} approaching`;
   return state.enemyAlive?`Final stand · ${state.enemyAlive} ${state.enemyAlive===1?'enemy':'enemies'} left`:(this.remaining?'Gorath approaches':'Final stand · clearing the field');
  }
  if(!this.remaining)return `Reserves spent · ${state.enemyAlive} enemies left`;
  if(this.phase==='holding')return 'Enemy regrouping';
  if(this.phase==='regroup')return `Regrouping · ${Math.ceil(this.timer/33)}s`;
  return this.label;
 }
}
