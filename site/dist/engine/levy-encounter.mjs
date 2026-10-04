/** Authored original practice defense. Timings are public simulation seconds,
 * never adaptive hidden buffs. Ordinary troop constructors supply all stats.
 */
import {battleFieldLimits} from './battle-director.mjs';
const stage=(id,label,second,types)=>Object.freeze({id,label,second,tick:second*33,types:Object.freeze(types)});
export function levyStages(threat='standard'){
 const extra=threat==='veteran'?['tallGrunt','archer']:threat==='standard'?['grunt']:[];
 return Object.freeze([
  stage('screen','Opening screen',0,['grunt','grunt','archer','grunt','priest',...extra]),
  stage('riders','Rider counterattack',45,['mount','mount','tallGrunt','grunt','archer','priest',...extra]),
  stage('battery','Siege counterattack',100,['trebuchet','tallGrunt','tallGrunt','archer','priest','grunt',...extra]),
  stage('last','Final reserve',160,['mount','tallGrunt','archer','priest','grunt','trebuchet',...extra]),
 ]);
}
/** Same narrow director surface as CampaignBattle. A stage joins the finite
 * queue at its advertised time; occupied corpses can delay entry past that time.
 * Destroying the enemy keep cuts all undispatched reserves, as the brief says.
 */
export class LevyEncounterDirector{
 constructor({stages,wave,level}){this.stages=stages;this.wave=wave;this.roster=stages.flatMap(s=>s.types);this.index=0;this.withdrawn=0;this.spawned=0;this.cap=battleFieldLimits(level).enemy;this.closed=false;this.pending=[];this.timer=0;this.elapsed=0;this.phase='muster';this.label=stages[0].label;this.nextStage=0;this.syncWave();}
 get remaining(){return this.roster.length-this.index-this.withdrawn;}
 get finalStand(){return this.closed;}
 setDifficulty(){} // Descriptor fixes difficulty; schedule is disclosed and fixed.
 syncWave(){this.wave.maximum=Math.max(1,this.pending.length);this.wave.remaining=this.pending.length;this.wave.delay=20;this.wave.countdown=Math.max(0,this.timer);}
 closeReserves(){if(this.closed)return null;this.withdrawn+=this.remaining;this.closed=true;this.pending=[];this.phase='last-stand';this.label='Keep broken · clear the field';this.syncWave();return {withdrawn:this.withdrawn,bosses:0};}
 step(state){
  this.elapsed++;if(state.castleFallen)this.closeReserves();if(this.closed)return null;
  while(this.nextStage<this.stages.length&&this.elapsed>=this.stages[this.nextStage].tick){const stage=this.stages[this.nextStage++];this.pending.push(...stage.types);this.label=stage.label;this.phase='deploying';}
  if(this.timer>0)this.timer--;this.syncWave();if(this.timer>0||state.onScreen>=this.cap||!this.pending.length)return null;
  const type=this.pending.shift();this.index++;this.spawned++;this.timer=20;this.syncWave();return type;
 }
 status(state){if(this.closed)return `Keep broken · ${state.enemyAlive} enemies left`;const next=this.stages[this.nextStage];return this.pending.length?`${this.label} · ${this.pending.length} entering`:next?`${next.label} in ${Math.max(0,Math.ceil((next.tick-this.elapsed)/33))}s`:`Reserves spent · ${state.enemyAlive} enemies left`;}
 get snapshot(){const next=this.stages[this.nextStage];return Object.freeze({stage:this.label,next:next?Object.freeze({label:next.label,seconds:Math.max(0,Math.ceil((next.tick-this.elapsed)/33))}):null,remaining:this.remaining,closed:this.closed,stages:this.stages});}
}
