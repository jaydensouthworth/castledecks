/** Disposable contract trials. Recruits, targets, costs and effects use the live
 * engine. Only starting positions, a wounded escort and paused reinforcement
 * waves are fixtures. No profile/session/storage service is accepted here. */
import {PlayerProfile,SKILLS} from './engine/progression.mjs';
import {REGULAR_RECRUIT_IDS} from './engine/recruitment.mjs';
import {seededRandom,DIFFICULTY} from './engine/combat.mjs';
const supported=new Set(REGULAR_RECRUIT_IDS),profiles=new WeakSet(),prepared=new WeakSet();
const bounded=(n,min,max,fallback)=>Number.isInteger(n)?Math.max(min,Math.min(max,n)):fallback;
export const isUnitTrial=run=>run?.kind==='unit-trial';
export const supportsUnitTrial=id=>supported.has(id);
export function createUnitTrial(id,snapshot={}){
 if(!supportsUnitTrial(id))throw new RangeError('This card has no contract trial');
 const skill=snapshot.skills instanceof Map?snapshot.skills.get(id):null;
 return {kind:'unit-trial',cardId:id,rank:bounded(skill?.rank,0,10,0),heroRank:bounded(snapshot.heroRank,1,26,1),difficulty:Object.hasOwn(DIFFICULTY,snapshot.difficulty)?snapshot.difficulty:'medium',owned:!!skill,index:0,completed:new Set(),skipped:new Set(),revision:0,
  lesson:{id:'unit-trial',title:SKILLS[id].name+' field trial'}};
}
export function unitTrialOptions(run){
 if(!isUnitTrial(run)||!supportsUnitTrial(run.cardId))throw new TypeError('Expected a contract trial');
 const profile=new PlayerProfile('Contract trial');
 Object.assign(profile,{rank:run.heroRank,gold:500,cheated:true,difficulty:run.difficulty,shootingMode:'auto_aim'});
 const arrow=profile.skills.find(s=>s.id==='arrow');Object.assign(arrow,{binding:1,cooldown:0,autocast:false});
 const contract=profile.addSkill(run.cardId);Object.assign(contract,{rank:run.rank,threshold:(run.rank+1)*100,binding:0,cooldown:0,autocast:false});
 profiles.add(profile);return {profile,level:1,testing:true,random:seededRandom(62000+REGULAR_RECRUIT_IDS.indexOf(run.cardId))};
}
export function prepareUnitTrial(battle,run){
 if(!profiles.has(battle?.profile)||!battle.testing||prepared.has(battle))throw new TypeError('Expected a fresh contract-trial battle');
 prepared.add(battle);battle.protectedTesting=true;battle.shooter.angleMode=1;
 battle.enemies.step=()=>null;battle.enemies.status=()=> 'Contract trial · no reinforcements';
 battle.checkOutcome=()=>{}; // Practice never settles, unlocks a field or pays rewards.
 const contract=battle.profile.skills.find(s=>s.id===run.cardId),deployed=new Set();
 let target=null,healed=0,damage=0;
 function place(unit,x){unit.x=x;unit.y=battle.elevationAt(x);unit.visible=true;battle.updateGeometry(unit);return unit;}
 if(run.cardId==='trebuchet')target=battle.badCastle;
 else if(run.cardId==='priest'){
  target=place(battle.createUnit('archer',{team:'good',rank:0}),battle.goodCastle.x);target.attemptGarrison(battle.goodCastle);target.hp=Math.max(1,Math.floor(target.maxHp*.35));
  // A wounded garrison Archer gives normal Priest AI a stationary living patient.
  // It uses its normal garrison, stats, effects and combat behavior.
 }else{
  target=place(battle.createUnit('grunt',{team:'bad',rank:0}),1050);
  place(battle.createUnit('grunt',{team:'bad',rank:0}),1250);
 }
 const controller={run,lesson:run.lesson,battle,contract,target,complete:false,
  get snapshot(){const live=[...deployed].filter(u=>u.hp>0&&!u.dead&&!u.destroyed);return {deployed:deployed.size,alive:live.length,leadAction:live[0]?.actionMode??null,healed,damage,hp:target?.hp??null,maxHp:target?.maxHp??null};},
  targetPoint(){const box=target?.hitbox;return box?{x:box.x+box.width/2,y:box.y+box.height/2}:null;},
  observe(event){
   if(battle.paused||battle.outcome||battle.summary)return;
   if(event.type==='spawn'&&event.unit?.skill===contract&&event.unit.team==='good')deployed.add(event.unit);
   if(event.type==='heal'&&event.target===target&&event.amount>0)healed+=event.amount;
   if(event.type==='damage'&&event.target?.team==='bad'&&event.actualDamage>0){
    // Projectiles/remnants retain their owning skill or source chain. Damage
    // from the optional Basic Arrow is deliberately not credited to recruits.
    let source=event.source;const seen=new Set();
    while(source&&!seen.has(source)){seen.add(source);if(source.skill===contract||deployed.has(source)){damage+=event.actualDamage;break;}source=source.source??source.owner;}
   }
  },afterTick(){},
 };
 battle.guidedTraining=controller;return controller;
}
export function unitTrialCopy(controller){
 const {run,contract,battle}=controller,s=controller.snapshot,entry=SKILLS[run.cardId];
 const siegePhase=({move:'marching',load_ammo:'loading',aim:'aiming',release_ammo:'releasing',hold_fire:'waiting for range',attack:'close combat'})[s.leadAction]??(s.alive?'preparing':'awaiting deployment');
 const instruction=run.cardId==='priest'?'Deploy your Priests. The supplied Archer is wounded inside your keep; watch your healers march into range and restore its health.':run.cardId==='trebuchet'?'Deploy your Trebuchet. It first marches into firing position, then loads and aims before attacking the hostile keep. Siege takes time; watch the lead engine phase.':`Deploy your ${entry.name} squad. Its normal movement and combat face two rank-0 enemy Grunts. Use the map in portrait to follow the company.`;
 return {title:entry.name,tag:`Field trial · rank ${contract.rank} · ${run.owned?'your card rank':'supplied unowned card'}`,
  instruction:instruction+' Your hero is protected; troops take normal damage. No campaign progress is saved.',
  feedback:`${s.deployed} deployed · ${s.alive} alive · ${run.cardId==='priest'?Math.floor(s.healed)+' HP healed · patient '+Math.ceil(s.hp)+'/'+s.maxHp+' HP':Math.floor(s.damage)+' recruit damage'}${run.cardId==='trebuchet'?' · lead engine '+siegePhase:''} · ${battle.profile.gold} trial gold`,
  deployLabel:contract.cooldown>0?`Reloading · ${Math.ceil(contract.cooldown/66)}s`:battle.friendlyQueue.queue.length>=battle.friendlyQueue.capacity?'Queue full · wait for room':battle.profile.gold<entry.summon.cost?'Not enough trial gold':battle.friendlyQueue.population<entry.summon.amount*entry.summon.population?`Need ${entry.summon.amount*entry.summon.population} reserve`:`Deploy squad · ${entry.summon.cost} gold`,
  canDeploy:contract.cooldown<=0&&battle.friendlyQueue.queue.length<battle.friendlyQueue.capacity&&battle.profile.gold>=entry.summon.cost&&battle.friendlyQueue.population>=entry.summon.amount*entry.summon.population};
}
