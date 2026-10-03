/** Independent reconstruction of first-battle progression and counters.
 * No assets or recovered implementation source are included here.
 */
import {DIFFICULTY} from './combat.mjs';
export function firstBattleRoster(random=Math.random) {
  const pool=[];
  for(const [type,count] of [['grunt',19],['tallGrunt',2],['archer',3],['priest',1],['trebuchet',1],['mount',1]])for(let i=0;i<count;i++)pool.push(type);
  const shuffled=[];while(pool.length)shuffled.push(pool.splice(Math.floor(random()*pool.length),1)[0]);
  return shuffled.reverse();
}
export class WaveBudget {
  constructor({level=1,random=Math.random}={}){this.random=random;this.maximum=5+level;this.remaining=this.maximum;this.resetCountdown();}
  resetCountdown(){this.delay=900+Math.floor(this.random()*300);this.countdown=this.delay;}
  step(){if(this.remaining>0)return false;const prior=this.countdown--;if(prior>0)return false;this.remaining=this.maximum;this.resetCountdown();return true;}
  consume(){if(this.remaining<=0)return false;this.remaining--;return true;}
  get progress(){return 1-this.countdown/this.delay;}
}
export class EnemyReinforcements {
  constructor({roster,level=1,difficulty='medium'}={}){this.roster=[...roster];this.index=0;this.timer=0;this.cap=20;this.interval=Math.max(30,Math.floor((100-level)/DIFFICULTY[difficulty].speed));}
  get remaining(){return this.roster.length-this.index;}
  step({onScreen,wave}){
    this.timer-=2;
    if(this.remaining<=0||onScreen>=this.cap||wave.remaining<=0||this.timer>=0)return null;
    wave.consume();const next=this.roster[this.index++];this.timer=this.interval;return next;
  }
}
export class FriendlyReinforcements {
  constructor({population=20}={}){this.population=population;this.timer=0;this.queue=[];this.cap=10;this.capacity=15;}
  enqueue(ticket){const cost=ticket.cost??1;if(this.queue.length>=this.capacity||this.population<cost)return false;this.population-=cost;this.queue.push({...ticket,cost});return true;}
  enqueueSquad(ticket,amount){const cost=ticket.cost??1;if(this.queue.length>=this.capacity||this.population<cost*amount)return false;this.population-=cost*amount;const shared={...ticket,cost};for(let i=0;i<amount;i++)this.queue.push(shared);return true;}
  cancel(index){if(index<0||index>=this.queue.length)return null;const [ticket]=this.queue.splice(index,1);this.population+=ticket.cost;return ticket;}
  step(onScreen){this.timer-=2;if(this.timer>=0||onScreen>=this.cap)return null;this.timer=50;return this.queue.shift()??null;}
}
export function ctfOutcome({heroDead,ownFlagCaptured,enemyFlagAtBase,enemyFlagCaptured,ownFlagAtBase,reinforcementsLeft,enemiesAlive}){
 if(heroDead||(ownFlagCaptured&&enemyFlagAtBase))return 'defeat';
 if((enemyFlagCaptured&&ownFlagAtBase)||(reinforcementsLeft===0&&enemiesAlive===0))return 'victory';
 return null;
}
export function freshProfile({name='BowMaster'}={}) {return {name,heroRank:1,xp:0,gold:0,scene:1,level:1,highestScene:1,highestLevel:1,victories:0,defeats:0,population:0,difficulty:'medium',shootingMode:'classic',skills:[{type:'arrow',rank:0,xp:0,threshold:100,maxRank:10,barIndex:0}],ownedTroops:[]};}
export function firstBattleSetup(){return {scene:2,level:1,hero:{rank:1,hp:310,garrisoned:true,castleX:350},castles:{friendly:{x:350,hp:8400,shotOffset:{x:0,y:-200},occupants:4},enemy:{x:1800,hp:8266,shotOffset:{x:0,y:-200},occupants:4}},flags:{friendly:{x:325,state:'at-base'},enemy:{x:1725,state:'at-base'}},enemySpawnX:2050,friendlySpawnX:-50,friendlyPopulation:20,enemyCap:20,friendlyCap:10,towers:0};}
export function heroCanRankUp({rank,xp}){return xp>(rank>=0&&rank<=25?500*rank:undefined);}
