import test from 'node:test';
import assert from 'node:assert/strict';
import {createUnitTrial,unitTrialOptions,prepareUnitTrial,unitTrialCopy,supportsUnitTrial} from '../site/dist/unit-trial.mjs';
import {CampaignBattle} from '../site/dist/engine/first-battle.mjs';
import {REGULAR_RECRUIT_IDS} from '../site/dist/engine/recruitment.mjs';
import {SKILLS} from '../site/dist/engine/progression.mjs';
function trial(id,snapshot){
 const run=createUnitTrial(id,snapshot),options=unitTrialOptions(run);let controller;
 const battle=new CampaignBattle({...options,onEvent:event=>controller?.observe(event)});controller=prepareUnitTrial(battle,run);
 return {run,battle,controller};
}
for(const id of REGULAR_RECRUIT_IDS)test(`${id}: supplied field uses actual contract, payment, reserve and live behavior`,()=>{
 const {battle,controller,run}=trial(id);const skill=controller.contract,entry=SKILLS[id],reserve=battle.friendlyQueue.population;
 assert.equal(run.owned,false);assert.equal(skill.rank,0);assert.equal(skill.autocast,false);
 assert.equal(battle.profile.cheated,true);assert.equal(battle.profile.gold,500);
 assert.equal(battle.profile.owned.has(id),true);assert.deepEqual([...battle.profile.owned],['arrow',id]);
 assert.match(unitTrialCopy(controller).tag,/supplied unowned card/);
 const initialHp=controller.target.hp;assert.equal(battle.hotbar.select(0),true);
 assert.equal(battle.profile.gold,500-entry.summon.cost);
 for(let n=0;n<6000;n++)battle.step();
 assert.equal(controller.snapshot.deployed,entry.summon.amount);
 assert.equal(battle.friendlyQueue.population,reserve-entry.summon.amount*entry.summon.population);
 assert.equal(battle.profile.victories,0);assert.equal(battle.profile.defeats,0);assert.equal(battle.profile.highestLevel,1);
 assert.equal(battle.outcome,null);assert.equal(battle.summary,null);
 if(id==='priest'){assert.ok(controller.snapshot.healed>0,'Priests must genuinely heal the wounded escort');assert.ok(controller.target.hp>initialHp);}
 else {assert.ok(controller.snapshot.damage>0,`${id} must cause real attributed damage, got ${JSON.stringify(controller.snapshot)}`);assert.ok(controller.target.hp<initialHp);}
});
test('trial rank is copied by value with no source profile, skill, XP, ownership or difficulty mutation',()=>{
 const original={rank:7,xp:238,threshold:800,binding:17,autocast:true};const snapshot={skills:new Map([['archer',original]]),heroRank:9,difficulty:'hard'};
 const {run,battle,controller}=trial('archer',snapshot);assert.equal(run.owned,true);assert.equal(controller.contract.rank,7);assert.notEqual(controller.contract,original);assert.equal(battle.profile.rank,9);assert.equal(battle.profile.difficulty,'hard');
 controller.contract.addXP(2000);battle.profile.gold=0;assert.deepEqual(original,{rank:7,xp:238,threshold:800,binding:17,autocast:true});
 const restarted=unitTrialOptions(run);assert.equal(restarted.profile.gold,500);assert.equal(restarted.profile.skills.find(s=>s.id==='archer').rank,7);
});
test('unsupported and repeated preparation cannot become real campaign progress',()=>{
 assert.equal(supportsUnitTrial('gorath'),false);assert.equal(supportsUnitTrial('arrow'),false);assert.throws(()=>createUnitTrial('arbitrary'));
 const {battle,run}=trial('grunt');assert.throws(()=>prepareUnitTrial(battle,run));assert.throws(()=>prepareUnitTrial(new CampaignBattle(),run));
});

test('trial explains protected hero while ordinary recruits still take damage',()=>{
 const {battle,controller}=trial('grunt');const heroHp=battle.hero.hp;battle.hero.takeDamage(40);assert.equal(battle.hero.hp,heroHp);
 const unit=battle.createUnit('grunt',{team:'good',rank:0}),hp=unit.hp;unit.takeDamage(1);assert.equal(unit.hp,hp-1);
 assert.match(unitTrialCopy(controller).instruction,/Your hero is protected; troops take normal damage/);
});
test('Deploy readiness matches actual queue gate, funds and reserve without changing them',()=>{
 const {battle,controller}=trial('grunt',{heroRank:26});const q=battle.friendlyQueue;
 for(let i=0;i<q.capacity;i++)assert.equal(q.enqueue({type:'grunt',cost:1}),true);
 const before=[q.queue.length,q.population,battle.profile.gold];assert.equal(unitTrialCopy(controller).canDeploy,false);assert.match(unitTrialCopy(controller).deployLabel,/Queue full/);assert.deepEqual([q.queue.length,q.population,battle.profile.gold],before);
 q.cancel(0);assert.equal(unitTrialCopy(controller).canDeploy,true);
 battle.profile.gold=0;assert.equal(unitTrialCopy(controller).canDeploy,false);assert.match(unitTrialCopy(controller).deployLabel,/Not enough trial gold/);
 battle.profile.gold=500;q.population=3;assert.equal(unitTrialCopy(controller).canDeploy,false);assert.equal(unitTrialCopy(controller).deployLabel,'Need 4 reserve');
});

test('Priest trial uses a real wounded garrison patient and demonstrates healing within15seconds',()=>{
 const {battle,controller}=trial('priest');assert.equal(controller.target.type,'archer');assert.equal(controller.target.garrisonBuilding,battle.goodCastle);assert.ok(controller.target.hp<controller.target.maxHp);
 battle.hotbar.select(0);for(let i=0;i<495&&!controller.snapshot.healed;i++)battle.step();assert.ok(controller.snapshot.healed>0);assert.match(unitTrialCopy(controller).feedback,/patient \d+\/75 HP/);assert.match(unitTrialCopy(controller).instruction,/Archer.*inside your keep/);
});
test('Siege trial retains the normal keep and windup while explaining actual lead-engine phases',()=>{
 const {battle,controller}=trial('trebuchet');assert.equal(controller.target.x,1800);assert.equal(controller.target.maxHp,8266);
 battle.hotbar.select(0);const phases=new Set();for(let i=0;i<2500&&!controller.snapshot.damage;i++){battle.step();const action=controller.snapshot.leadAction;if(action)phases.add(action);}
 for(const phase of ['move','load_ammo','aim','release_ammo'])assert.ok(phases.has(phase),phase);
 assert.ok(controller.snapshot.damage>0);assert.match(unitTrialCopy(controller).feedback,/lead engine/);assert.match(unitTrialCopy(controller).instruction,/Siege takes time/);
});
