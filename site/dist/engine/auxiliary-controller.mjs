/** Optional finite, battle-only levies. Never buys, refunds or persists anything.
 * Corpses and converted actors retain this controller's slots until world removal.
 */
export const LEVY_WAVE=Object.freeze(['grunt','grunt','grunt','archer','priest']);
export const LEVY_LIMITS=Object.freeze({waves:4,waveSize:5,cap:10,interval:20,rank:2});
export class AuxiliaryController{
 #battle;#tickets;#actors=new Map();#owned=new WeakSet();#waves=0;#closed=false;#nextTick=0;#lastTick=-1;#spawning=null;
 constructor(battle){
  if(battle?.skirmish?.descriptor?.doctrine!=='levy')throw new TypeError('Levies require their own practice encounter');
  this.#battle=battle;this.#tickets=Array.from({length:LEVY_LIMITS.waves},(_,wave)=>LEVY_WAVE.map((type,index)=>({id:`levy-${wave+1}-${index+1}`,wave:wave+1,type,rank:LEVY_LIMITS.rank,state:'reserve'}))).flat();
 }
 owns(unit){return this.#owned.has(unit);}
 #prune(){for(const [id,unit]of this.#actors)if(!this.#battle.objects.items.includes(unit)){this.#actors.delete(id);this.#tickets.find(t=>t.id===id).state='cleared';}}
 get snapshot(){
  this.#prune();const b=this.#battle,pending=this.#tickets.filter(t=>t.state==='pending'),occupied=this.#actors.size,closed=this.#closed||!!b.outcome||!!b.summary||!(b.hero.hp>0)||b.hero.dead||!(b.goodCastle.hp>0);
  const code=closed?'closed':b.tick===0?'preparation':pending.length?'dispatching':this.#waves===LEVY_LIMITS.waves?'spent':LEVY_LIMITS.cap-occupied<LEVY_LIMITS.waveSize?'slots':!b.paused?'pause':'ready';
  return Object.freeze({cap:LEVY_LIMITS.cap,rank:LEVY_LIMITS.rank,total:20,wavesCalled:this.#waves,wavesLeft:LEVY_LIMITS.waves-this.#waves,occupied,pending:pending.length,free:LEVY_LIMITS.cap-occupied-pending.length,closed,code,canCall:code==='ready',nextWave:this.#waves+1,
   tickets:Object.freeze(this.#tickets.map(t=>Object.freeze({...t}))),units:Object.freeze([...this.#actors.values()])});
 }
 callWave(expectedWave){
  const before=this.snapshot;if(!before.canCall||expectedWave!==before.nextWave)return false;
  // Commit all five finite tickets before notifying UI. Old handlers cannot
  // consume another wave when dispatch has finished: expectedWave is exact.
  this.#waves++;for(const ticket of this.#tickets)if(ticket.wave===this.#waves)ticket.state='pending';
  this.#nextTick=this.#battle.tick+LEVY_LIMITS.interval;
  this.#battle.emit({type:'levy-called',wave:this.#waves,units:LEVY_LIMITS.waveSize});return true;
 }
 step(){
  const b=this.#battle;this.#prune();if(b.outcome||b.summary||!(b.hero.hp>0)||b.hero.dead||!(b.goodCastle.hp>0)){this.close();return;}
  if(this.#closed||b.paused||b.tick===this.#lastTick)return;this.#lastTick=b.tick;
  if(b.tick<this.#nextTick||this.#actors.size>=LEVY_LIMITS.cap)return;
  const ticket=this.#tickets.find(t=>t.state==='pending');if(!ticket)return;
  this.#spawning=ticket;try{b.createUnit(ticket.type,{team:'good',rank:ticket.rank,skill:null});}finally{this.#spawning=null;}
  this.#nextTick=b.tick+LEVY_LIMITS.interval;
 }
 /** Called by this adapter's spawn event before observers see the actor. */
 claimSpawn(unit){
  const ticket=this.#spawning;if(!ticket||ticket.state!=='pending'||unit?.world!==this.#battle||unit.team!=='good'||unit.type!==ticket.type||unit.skill!==null)return false;
  Object.defineProperty(unit,'auxiliaryIdentity',{value:Object.freeze({id:ticket.id,wave:ticket.wave,label:`Levy ${ticket.wave}`,type:ticket.type,rank:ticket.rank}),enumerable:true});
  this.#owned.add(unit);this.#actors.set(ticket.id,unit);ticket.state='field';return true;
 }
 close(){if(this.#closed)return false;this.#closed=true;for(const ticket of this.#tickets)if(ticket.state==='pending'||ticket.state==='reserve')ticket.state='discarded';return true;}
}
