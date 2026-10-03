import test from 'node:test';
import assert from 'node:assert/strict';
import {CampaignBattle} from '../site/dist/engine/first-battle.mjs';
import {PlayerProfile,SKILLS,summonSquad,serializeProfile,restoreProfile} from '../site/dist/engine/progression.mjs';
import {REGULAR_RECRUIT_IDS} from '../site/dist/engine/recruitment.mjs';
import {ExpeditionProfiles,restoreExpeditions} from '../site/dist/expedition-model.mjs';
import {ExpeditionBattle} from '../site/dist/expedition-battle.mjs';

const contracts=p=>JSON.parse(serializeProfile(p)).skills;
const profile=()=>{const p=new PlayerProfile('Army continuity proof');p.rank=8;p.gold=100000;for(const id of REGULAR_RECRUIT_IDS){p.purchase(id);const s=p.skills.find(s=>s.id===id);Object.assign(s,{rank:2,xp:17.5,threshold:300,cooldown:0,autocast:false});}return p;};
const settle=b=>{for(let i=0;i<105&&!b.summary;i++)b.step();assert.ok(b.summary);};

for(const id of REGULAR_RECRUIT_IDS)test(`${id}: deployed casualties and defeat preserve owned contract and earned skill progress`,()=>{
 const p=profile(),b=new CampaignBattle({profile:p}),s=p.skills.find(s=>s.id===id),before=contracts(p),gold=p.gold,reserve=b.friendlyQueue.population,config=SKILLS[id].summon;
 assert.equal(summonSquad(s,p,b.friendlyQueue,b.stats),true);
 assert.equal(p.gold,gold-config.cost);assert.equal(b.friendlyQueue.population,reserve-config.amount*config.population);
 const casualties=[];while(b.friendlyQueue.queue.length){const ticket=b.friendlyQueue.queue.shift(),u=b.createUnit(ticket.type,{team:'good',rank:ticket.rank,skill:ticket.skill});u.takeDamage(u.maxHp+1000);casualties.push(u);}
 for(let i=0;i<1200&&casualties.some(u=>!u.destroyed);i++)for(const u of casualties)u.step();
 assert.ok(casualties.every(u=>u.destroyed),'real death/clearing removes every casualty');assert.equal(b.regularArmyCount,0);
 b.finishOutcome('defeat');settle(b);assert.deepEqual(contracts(p),before);assert.ok(p.owned.has(id));assert.equal(p.gold,gold-config.cost);
 const restored=restoreProfile(serializeProfile(p)),retry=new CampaignBattle({profile:restored});
 assert.deepEqual(contracts(restored),before);assert.equal(retry.friendlyQueue.population,90);assert.equal(restored.gold,gold-config.cost);assert.equal(retry.regularArmyCount,0);
});

test('every valid hero rank gets a fresh battle reserve, independent of prior casualties or spent supply',()=>{
 for(let rank=1;rank<=26;rank++){const p=new PlayerProfile();p.rank=rank;const first=new CampaignBattle({profile:p});first.friendlyQueue.population=0;first.finishOutcome('defeat');settle(first);assert.equal(new CampaignBattle({profile:p}).friendlyQueue.population,10+rank*10);}
});

test('contract and companion ownership survive a defeat with no live roster in the save',()=>{
 const p=profile();p.recruitCompanion('gorath');const b=new CampaignBattle({profile:p}),owned=[...p.owned];b.finishOutcome('defeat');settle(b);
 const text=serializeProfile(p),saved=JSON.parse(text),restored=restoreProfile(text);
 assert.deepEqual([...restored.owned],owned);assert.ok(restored.companionOwned.has('gorath'));assert.equal(restored.companionId,'gorath');
 for(const key of ['population','units','casualties','roster','friendlyQueue','reserve'])assert.equal(Object.hasOwn(saved,key),false);
});

test('legacy schema 1 restores all existing troop ranks without retroactive losses or a save migration',()=>{
 const p=profile(),value=JSON.parse(serializeProfile(p));value.schema='bowmaster-reconstruction-1';delete value.companions;
 const restored=restoreProfile(JSON.stringify(value));assert.deepEqual(contracts(restored),contracts(p));assert.equal(new CampaignBattle({profile:restored}).friendlyQueue.population,90);
});

test('Wayfarer defeat, export/import and retry retain paid contract upgrades and replenish battle reserve',()=>{
 const manager=new ExpeditionProfiles({seedFactory:()=>403}),p=manager.active;p.gold=10000;p.purchase('priest');const s=p.skills.find(s=>s.id==='priest');Object.assign(s,{rank:2,xp:29,threshold:300,autocast:false,cooldown:0});
 const b=new ExpeditionBattle({run:manager.activeRun}),before=contracts(p),reserve=b.friendlyQueue.population;assert.equal(summonSquad(s,p,b.friendlyQueue,b.stats),true);const gold=p.gold;
 b.finishOutcome('defeat');settle(b);const recovered=restoreExpeditions(manager.exportBundle());assert.equal(recovered.activeRun.state.lastResult.outcome,'defeat');assert.equal(recovered.activeRun.retry(),true);
 const retry=new ExpeditionBattle({run:recovered.activeRun});assert.deepEqual(contracts(retry.profile),before);assert.equal(retry.profile.gold,gold);assert.equal(retry.friendlyQueue.population,reserve);
});

test('queue cancellation restores only committed reserve, never gold or cooldown',()=>{
 const p=profile(),b=new CampaignBattle({profile:p}),s=p.skills.find(s=>s.id==='grunt'),initial=b.friendlyQueue.population;
 summonSquad(s,p,b.friendlyQueue,b.stats);const gold=p.gold,cooldown=s.cooldown;while(b.friendlyQueue.queue.length)b.friendlyQueue.cancel(0);
 assert.equal(b.friendlyQueue.population,initial);assert.equal(p.gold,gold);assert.equal(s.cooldown,cooldown);assert.equal(b.friendlyQueue.cancel(0),null);assert.equal(b.friendlyQueue.population,initial);
});
