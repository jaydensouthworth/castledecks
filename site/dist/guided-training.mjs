import {defaultControlLabel} from './control-bindings.mjs';
/** Optional assisted drills. Fixtures are explicit and local to these fresh
 * profiles: no campaign, save manager, analytics, timers or audio are touched.
 * Completion observes the ordinary engine's real projectiles/HP/spawn events.
 */
import {PlayerProfile,SKILLS} from './engine/progression.mjs';
import {seededRandom} from './engine/combat.mjs';
import {assistedAutoAim} from './engine/assisted-auto-aim.mjs';
import {slotToKey} from './keyboard-layout.mjs';

export const TRAINING_LESSONS=Object.freeze([
 Object.freeze({id:'aim',title:'Land your first arrow',brief:'Choose Basic Arrow, then tap the marked target. Auto calculates a path to that point. Arrows do not track moving targets.',success:'A real hit. In battle, aim ahead of moving targets.'}),
 Object.freeze({id:'arc',title:'Try the other arc',brief:'Switch Low arc to High arc, then hit the target. A high arc clears obstacles but takes longer to arrive.',success:'High arc landed. Switch back to Low arc whenever you need a quicker shot.'}),
 Object.freeze({id:'squad',title:'Call your first squad',brief:'Choose Grunt on the live action bar. This queues four soldiers; the first arrival completes the drill.',success:'Your squad is deploying. Gold pays for the squad; reserve population pays for each soldier.'}),
 Object.freeze({id:'counter',title:'Read a flying enemy',brief:'Hit the hovering fire dragon with Basic Arrow. Aim at its body, not its wing tips.',success:'The Ice Arrow hit caused real damage. Fire dragons resist ordinary arrows and are weak to ice.'}),
 Object.freeze({id:'companion',title:'Command Gorath',brief:'Use the separate Gorath control to summon him. Use it again to command Earthshatter.',success:'Earthshatter was cast. Gorath uses his own slot and recovery, separate from your army.'}),
]);
const profiles=new WeakSet(),prepared=new WeakSet();
const alive=u=>u?.hp>0&&!u.dead&&!u.destroyed;
export function createTrainingRun(){return {index:0,completed:new Set(),skipped:new Set(),reviewedLoadout:false,revision:0};}
export function trainingLesson(run){return TRAINING_LESSONS[run?.index]??null;}
export function createTrainingBattleOptions(run){
 if(!trainingLesson(run)&&run?.index!==TRAINING_LESSONS.length)throw new RangeError('Unknown training drill');
 const profile=new PlayerProfile('Guided practice');
 Object.assign(profile,{rank:3,gold:600,cheated:true,difficulty:'easy',shootingMode:'auto_aim'});
 for(const [binding,id] of ['arrow','grunt','iceArrow'].entries()){
  const skill=profile.skills.find(s=>s.id===id)??profile.addSkill(id);
  Object.assign(skill,{rank:1,binding,cooldown:0,autocast:false});
 }
 profile.companionOwned.add('gorath');profile.companionId='gorath';profiles.add(profile);
 return {profile,level:1,testing:true,random:seededRandom(90210+run.index)};
}

/** The visible target is a real engine unit with its original collision shape,
 * resistances and damage processing. Only this drill fixture holds its position,
 * supplies extra HP, suspends enemy waves and prevents campaign settlement.
 */
export function prepareTrainingBattle(battle,run){
 if(!profiles.has(battle?.profile)||battle.testing!==true||prepared.has(battle))throw new TypeError('Expected a fresh guided-practice battle');
 prepared.add(battle);battle.protectedTesting=true;battle.shooter.angleMode=1;
 battle.enemies.step=()=>null;battle.enemies.status=()=> 'Guided practice · waves paused';
 battle.checkOutcome=()=>{}; // Drills never settle a campaign battle or award a victory.
 const lesson=trainingLesson(run),shots=new WeakMap(),contacts=new WeakMap();
 const target=lesson&&lesson.id!=='companion'?battle.createUnit(lesson.id==='counter'?'fireDragon':'grunt',{team:'bad'}):null;
 if(target){
  target.x=850;target.y=lesson.id==='counter'?Math.min(battle.elevationAt(850)-160,470):battle.elevationAt(850);
  target.trainingFixture=true;target.hp=target.maxHp=5000;target.vx=0;target.vy=0;target.visible=true;
  target.step=()=>{if(target.destroyed)return;target.effects.step();target.animate?.();target.vx=0;target.vy=0;battle.updateGeometry(target);};
  battle.updateGeometry(target);
 }
 let stage='waiting',complete=false,arcChanged=false,companion=null,damageDealt=0,lastDamage=0;
 const controller={run,lesson,target,battle,
  get complete(){return complete;},get stage(){return stage;},
  get snapshot(){return {id:lesson?.id??'loadout',complete,stage,arcChanged,hp:target?.hp??null,maxHp:target?.maxHp??null,damageDealt,lastDamage};},
  targetPoint(){const box=target?.hitbox;return box?{x:box.x+box.width/2,y:box.y+box.height/2}:null;},
  observe(event){
   if(!lesson||complete||battle.paused||battle.summary||battle.outcome)return;
   if(event.type==='shot'){
    if(lesson.id==='arc'&&Number(battle.shooter.angleMode)===0)arcChanged=true;
    const p=battle.projectiles.at(-1);
    if(p&&(p.source===battle.hero||p.owner===battle.hero)&&p.team==='good')shots.set(p,{skill:event.skill,high:Number(battle.shooter.angleMode)===0&&arcChanged});
   }
   if(lesson.id==='squad'&&event.type==='spawn'&&event.unit?.team==='good'&&event.unit?.type==='grunt'&&event.unit.skill===battle.profile.skills.find(s=>s.id==='grunt'))finish();
   if(lesson.id==='companion'){
    if(event.type==='companion-summoned'&&event.unit===battle.companions.unit)companion=event.unit;
    if(event.type==='companion-signature'&&companion&&event.unit===companion&&event.name==='Earthshatter')finish();
   }
   // Impacts apply on the target's later effects step. Credit only actual HP
   // loss caused by an eligible contact, including that Ice Arrow's own pulses.
   if(event.type==='damage'&&event.target===target){
    const source=event.source?.kind==='reactive_ice'?event.source.source:event.source;
    const contact=source&&contacts.get(source);
    if(!contact||contact.stage!==stage||!(event.actualDamage>0))return;
    lastDamage=event.actualDamage;damageDealt+=lastDamage;
    if(lesson.id==='counter'&&stage==='waiting')stage='counter';else finish();
    return;
   }
   const p=event.projectile,shot=p&&shots.get(p);
   if(!shot||event.target!==target||!alive(target))return;
   const standard=event.type==='hit'&&p.kind==='hero_arrow',elemental=event.type==='projectile-hit'&&event.kind==='target';
   if(!standard&&!elemental)return;
   if(lesson.id==='aim'&&standard||lesson.id==='arc'&&standard&&shot.high||lesson.id==='counter'&&(stage==='waiting'&&standard||stage==='counter'&&elemental&&p.kind==='ice_arrow'))contacts.set(p,{stage});
  },
  afterTick(){
   if(!lesson||complete||battle.paused||battle.outcome||battle.summary)return;
   if(lesson.id==='arc'&&Number(battle.shooter.angleMode)===0)arcChanged=true;
  },
  /** A keyboard/touch alternative, clearly labelled aim assistance. It queues
   * the same solver result and skill as normal play; completion still needs a hit. */
  assistedShot(){
   if(!lesson||!['aim','arc','counter'].includes(lesson.id)||complete||battle.paused||battle.outcome||!alive(target))return false;
   const aim=assistedAutoAim(battle.hero.launchPosition,controller.targetPoint(),{powerPercent:battle.shooter.powerPercent,angleMode:battle.shooter.angleMode,gravity:battle.gravity});
   return battle.queuePlayerShot(aim,battle.activeSkill);
  },
 };
 function finish(){if(complete)return;complete=true;stage='complete';run.completed.add(lesson.id);run.skipped.delete(lesson.id);run.revision++;}
 battle.guidedTraining=controller;return controller;
}
export function advanceTraining(run,{skip=false}={}){
 const lesson=trainingLesson(run);if(!lesson)return false;
 if(!run.completed.has(lesson.id)&&!skip)return false;
 if(skip&&!run.completed.has(lesson.id))run.skipped.add(lesson.id);
 run.index++;run.revision++;return true;
}
export function restartTrainingLesson(run){const lesson=trainingLesson(run);if(!lesson)return false;run.completed.delete(lesson.id);run.skipped.delete(lesson.id);run.revision++;return true;}
export function trainingCopy(controller,controlLabel=defaultControlLabel){
 const {lesson,battle,run}=controller,s=controller.snapshot;
 if(!lesson)return {title:'Make the loadout yours',instruction:'Open Loadout to inspect your three supplied abilities. Then return to your lobby.',feedback:`${run.completed.size} of ${TRAINING_LESSONS.length} drills completed${run.skipped.size?` · ${run.skipped.size} skipped`:''}. Practice supplies, hits and progress stay separate from your campaign.`};
 let instruction=lesson.brief;
 if(lesson.id==='arc')instruction=`Tap the ${Number(battle.shooter.angleMode)===0?'High':'Low'} arc control (${controlLabel('arc')} on keyboard), choose High arc, then hit the marked target.`;
 if(lesson.id==='squad'){const slot=battle.profile.skills.find(s=>s.id==='grunt')?.binding;instruction=`Tap ${SKILLS.grunt.name}${Number.isInteger(slot)&&slot>=0?` (key ${slotToKey(slot%10)})`:''} to queue a squad. Watch the first soldier enter from the left.`;}
 if(lesson.id==='counter'&&s.stage==='counter')instruction=`Basic Arrow dealt ${Math.round(s.lastDamage)} damage. Select ${SKILLS.iceArrow.name}, then hit the same body. This dragon takes ×${controller.target.multipliers.ice} ice damage.`;
 if(lesson.id==='companion'&&battle.companions.status().active)instruction=`Gorath is here. Tap Earthshatter or press ${controlLabel('companion')} again. The drill checks his actual cast after its short windup.`;
 return {title:lesson.title,instruction:s.complete?lesson.success:instruction,feedback:s.complete?'Drill complete. Continue whenever you’re ready.':s.hp!==null?`Target ${Math.ceil(s.hp)} / ${s.maxHp} HP · assisted stationary fixture`:'Supplied practice gold · no campaign rewards'};
}

export function drawTrainingTarget(ctx,controller,scale=1){
 const target=controller?.target,point=controller?.targetPoint();if(!alive(target)||!point||controller.complete)return;
 const r=Math.max(22,18/scale);ctx.save();ctx.strokeStyle='#f5d878';ctx.lineWidth=2/scale;ctx.setLineDash?.([5/scale,4/scale]);ctx.beginPath();ctx.arc(point.x,point.y,r,0,Math.PI*2);ctx.stroke();ctx.setLineDash?.([]);ctx.restore();
}
