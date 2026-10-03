/** Charter-specific outcome/progression adapter. The ordinary battle engine,
 * damage, AI, finite director, recruit cost and bonus formula are unchanged. */
import {CampaignBattle} from './engine/first-battle.mjs';
import {seededRandom} from './engine/combat.mjs';
import {FLAG_STATUS as FS} from './engine/flag-troop.mjs';
import {ExpeditionRun} from './expedition-model.mjs';
import {createExpeditionEncounter,encounterSeed} from './expedition-data.mjs';
const progressSnapshot=profile=>Object.fromEntries(['level','scene','highestLevel','highestScene'].map(key=>[key,profile[key]]));
export class ExpeditionBattle extends CampaignBattle{
 constructor({run,onEvent=()=>{},restoreResult=true}={}){
  if(!(run instanceof ExpeditionRun))throw new TypeError('A charter battle requires a live run');
  const field=run.current,random=seededRandom(encounterSeed(run.state.seed,field.id)),openingProgress=progressSnapshot(run.profile);
  const encounter=createExpeditionEncounter(field.id,random);
  let liveBattle;
  super({profile:run.profile,level:field.level,random,encounter,onEvent:event=>{
   if(event.type==='summary'){
    run.record(liveBattle);
    event.summary.campaignComplete=run.complete;
    event.summary.expeditionComplete=run.complete;
    event.summary.expeditionField=field.id;
   }
   onEvent(event);
  }});
  liveBattle=this;this.expeditionRun=run;this.expeditionOpeningRank=run.profile.rank;
  this.expeditionSeed=encounterSeed(run.state.seed,field.id);
  Object.assign(run.profile,openingProgress);
  if(restoreResult&&run.state.lastResult){
   const receipt=run.state.lastResult;
   this.outcome=receipt.outcome;this.stats={...receipt.stats};this.expeditionOpeningRank=receipt.rankBefore;
   this.summary={outcome:receipt.outcome,gold:receipt.gold,xp:receipt.xp,campaignComplete:run.complete,expeditionComplete:run.complete,expeditionField:field.id};
   this.endCountdown=0;
  }
 }
 checkOutcome(){
  if(this.outcome||!this.ownFlag||!this.enemyFlag)return;
  if(this.encounter.objective==='standard'){super.checkOutcome();return;}
  const lost=this.hero.dead||this.ownFlag.status===FS.CAPTURED;
  if(lost){this.finishOutcome('defeat');return;}
  if(this.badCastle?.destroyed||this.badCastle?.hp<=0)this.finishOutcome('victory');
 }
 finishOutcome(outcome){
  const progress=progressSnapshot(this.profile),accepted=super.finishOutcome(outcome);
  Object.assign(this.profile,progress);return accepted;
 }
}
