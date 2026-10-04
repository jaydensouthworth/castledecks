import test from 'node:test';import assert from 'node:assert/strict';
import {ARMY_JOBS,cardTactics,armyJobOptions,matchesArmyRole} from '../site/dist/card-tactics.mjs';
import {buildArmoryRecords} from '../site/dist/armory-catalog-data.mjs';
import {cardIdentity} from '../site/dist/armory-presentation.mjs';
import {createArmoryCatalogUI} from '../site/dist/armory-catalog.mjs';
import {ArmoryCatalog,createArmorySnapshot} from '../site/dist/armory-catalog-model.mjs';
import {LoadoutCollection} from '../site/dist/loadout-collection-model.mjs';
import {deckComposition} from '../site/dist/deck-composition.mjs';
import {SKILLS,PlayerProfile,serializeProfile} from '../site/dist/engine/progression.mjs';
import {COMPANIONS,REGULAR_RECRUIT_IDS} from '../site/dist/engine/recruitment.mjs';
import {FlagTroop,FLAG_ACTION as A,FLAG_STATUS as S} from '../site/dist/engine/flag-troop.mjs';
import {MountedTroop} from '../site/dist/engine/mounted-troop.mjs';
import {FlagArcher,FlagPriest,FlagTrebuchet} from '../site/dist/engine/ranged-troop.mjs';
import {AirFighter,DragonScoutFire,DragonScoutIce,DragonScoutPoison,FlagFireDemon,FlagIceDemon} from '../site/dist/engine/later-enemies.mjs';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
const records=buildArmoryRecords(SKILLS,COMPANIONS,{}),byId=new Map(records.map(x=>[x.id,x]));
const world=()=>({width:2000,goodHomeBoundary:200,badHomeBoundary:1800,elevationAt:()=>400,rotationAt:()=>0,gravity:.3,goodTeam:[],badTeam:[],airUnits:[],structures:[]});
const opts=()=>({rank:0,world:world(),random:()=>.5,x:100,y:400,height:50,width:20,friendFlag:{x:1900,y:400,status:S.AT_BASE},enemyFlag:{x:110,y:400,status:S.AT_BASE}});
const constructors={grunt:o=>new FlagTroop(o),tallGrunt:o=>new FlagTroop({...o,type:'tallGrunt'}),mount:o=>new MountedTroop(o),fireDemon:o=>new FlagFireDemon(o),iceDemon:o=>new FlagIceDemon(o)};
const change=(ui,id,value)=>{ui.get(id).value=value;ui.dispatch(ui.get(id),'change');};

test('every shipping army contract has one distinct grounded identity; other and unknown cards do not acquire fabricated jobs',()=>{
 const troops=records.filter(x=>cardTactics(x));assert.deepEqual(troops.map(x=>x.id).sort(),[...REGULAR_RECRUIT_IDS].sort());assert.equal(new Set(troops.map(x=>cardTactics(x).subtitle)).size,12);assert.equal(armyJobOptions(records).length,6);
 for(const item of troops){const t=cardTactics(item);assert.ok(Object.isFrozen(t));assert.ok(Object.isFrozen(t.jobs));assert.ok(t.strength&&t.caution);assert.equal(cardIdentity(item).headline,t.subtitle);}
 for(const id of ['future','constructor','__proto__','arrow','gorath'])assert.equal(cardTactics({id,kind:'skill',category:'army'}),null);
 assert.equal(cardTactics({id:'grunt',kind:'companion',category:'army'}),null);assert.deepEqual(armyJobOptions([{...byId.get('grunt'),id:'custom'}]),[]);assert.equal(matchesArmyRole({...byId.get('grunt'),id:'custom'},'frontline'),true);assert.equal(matchesArmyRole({...byId.get('grunt'),id:'custom'},'job:flag'),false);
});
test('flag job exactly follows actual automatic flag objective decisions, and fast runner keeps its real reactions',()=>{
 const expected=records.filter(x=>matchesArmyRole(x,'job:flag')).map(x=>x.id).sort();assert.deepEqual(expected,Object.keys(constructors).sort());
 for(const id of expected){const unit=constructors[id](opts());assert.equal(unit.chooseNextAction(),A.PICKUP_ENEMY,id);}
 const rider=new MountedTroop(opts()),foot=new FlagTroop(opts());assert.ok(rider.speed>foot.speed);assert.equal(rider.runner,1);for(const action of [A.DAZE,A.FLINCH,A.KNOCKBACK])assert.equal(rider.transition(action),null);assert.equal(rider.transition(A.FEAR),A.RETREAT);assert.equal(rider.multipliers.blunt,1.2);
});
test('garrison, purge priority and unhealable long-range siege jobs execute in their actual unit classes',()=>{
 const archer=new FlagArcher(opts()),tower={hp:100,x:100,team:'good',occupiedBy:'neutral',occupants:[],hasRoom:()=>true};assert.equal(archer.attemptGarrison(tower),true);assert.equal(archer.garrisoned(),true);
 const poisoned={x:130,y:400,hp:50,maxHp:100,isPoisoned:()=>true},wounded={x:110,y:400,hp:1,maxHp:100,getType:()=> 'living',injured:()=>true};const priest=new FlagPriest({...opts(),friends:[wounded,poisoned]});priest.healCooldown=-1;priest.chooseNextAction();assert.equal(priest.actionMode,'purge');assert.equal(priest.healTarget,poisoned);
 const siege=new FlagTrebuchet({...opts(),enemies:[{x:700,y:400,hp:100},{x:900,y:400,hp:100}]});assert.equal(siege.selectTarget().x,900);assert.equal(siege.immunities.has('heal'),true);
});
test('flying and elemental caveats match live classes, including Ice Demon fire-melee quirk',()=>{
 for(const Class of [AirFighter,DragonScoutFire,DragonScoutIce,DragonScoutPoison]){const unit=new Class(opts());assert.equal(unit.isAirUnit(),true);assert.equal(unit.holdingFlag(),false);}
 assert.equal(new AirFighter(opts()).multipliers.flak,4);assert.equal(new DragonScoutFire(opts()).multipliers.ice,4);assert.equal(new DragonScoutIce(opts()).multipliers.fire,4);
 const fire=new FlagFireDemon(opts()),ice=new FlagIceDemon(opts());assert.equal(fire.multipliers.fire,0);assert.equal(fire.multipliers.ice,4);assert.equal(ice.multipliers.ice,0);assert.equal(ice.multipliers.fire,4);
 const target={x:105,y:400,team:'bad',isFighter:true,multipliers:{fire:0,ice:4},garrisoned:()=>false};ice.attacking=[target];ice.attackEngagementTarget();assert.equal(ice.pendingImpacts[0].amount,0);assert.match(cardTactics(byId.get('iceDemon')).caution,/fire resistance, not ice/);
});
test('deployment facts use the actual record economy, and read-only job queries preserve all campaign state',()=>{
 const profile=new PlayerProfile();profile.gold=100000;for(const id of REGULAR_RECRUIT_IDS)profile.addSkill(id);const before=serializeProfile(profile),snapshot=createArmorySnapshot(profile),catalog=new ArmoryCatalog(records),collection=new LoadoutCollection(records),wrappers=profile.skills.map(skill=>({skill,binding:skill.binding}));
 for(const item of records.filter(x=>x.squad)){const identity=cardIdentity(item),entry=SKILLS[item.id];assert.match(identity.facts[1].value,new RegExp(`${entry.summon.cost} gold`));assert.match(identity.facts[1].value,new RegExp(`${entry.summon.amount*entry.summon.population} reserve`));}
 for(const [role] of ARMY_JOBS){catalog.setView({department:'army',role});collection.setView({type:'army',role});assert.deepEqual(catalog.query(snapshot).items.map(x=>x.id).sort(),collection.query(wrappers).items.map(x=>x.item.id).sort());assert.ok(catalog.query(snapshot).total>0);}
 assert.equal(serializeProfile(profile),before);catalog.setView({query:'',role:'frontline'});assert.equal(catalog.query(snapshot).total,5);catalog.setView({role:'all',query:'support'});assert.deepEqual(catalog.query(snapshot).items.map(x=>x.id),['priest']);
});
test('deck job counts refer to equipped contract identities, excluding reserves and a companion and permitting overlap',()=>{
 const profile=new PlayerProfile();for(const id of ['mount','priest','air','fireDragon','iceDemon'])profile.addSkill(id);profile.skills.find(x=>x.id==='iceDemon').binding=-1;profile.companionOwned.add('gorath');profile.companionId='gorath';
 const deck=deckComposition(records,createArmorySnapshot(profile)),count=id=>deck.jobs.find(x=>x.id==='job:'+id).count;assert.equal(count('flag'),1);assert.equal(count('runner'),1);assert.equal(count('sustain'),1);assert.equal(count('flying'),2);assert.equal(count('garrison'),0);assert.equal(deck.reserve,1);assert.equal(deck.companion.id,'gorath');
 assert.deepEqual(deckComposition([{...byId.get('mount'),id:'custom'}],createArmorySnapshot(profile)).jobs,[]);
});
test('Discover job shortcut clears stale browse filters; inspection trial and return preserve the exact filtered origin',async t=>{
 const ui=await loadGameUI(t),origin=ui.battle;ui.click('introArmory');ui.click('shopCatalogTab');change(ui,'shopDepartmentCompact','army');change(ui,'shopRole','ranged');ui.click('shopDiscoverTab');ui.get('shopDiscover').querySelector('[data-discover-job="job:flag"]').click();assert.equal(ui.get('shopRole').value,'job:flag');assert.equal(ui.get('shopGrid').querySelectorAll('article').length,5);assert.match(ui.get('shopGrid').textContent,/Fast flag runners/);assert.match(ui.get('shopGrid').textContent,/4 reserve/);
 ui.click('inspect-mount');ui.get('shopDetailDrawer').scrollTop=131;const before=serializeProfile(origin.profile),tick=origin.tick;ui.click('shopTryCard');ui.frames();assert.notEqual(ui.battle,origin);ui.click('unitTrialReturn');ui.frames();assert.equal(ui.battle,origin);assert.equal(serializeProfile(origin.profile),before);assert.equal(origin.tick,tick);assert.equal(ui.get('shopRole').value,'job:flag');assert.equal(ui.get('shopDetailDrawer').scrollTop,131);assert.equal(ui.document.activeElement.id,'shopTryCard');ui.click('shopCloseDetails');assert.equal(ui.document.activeElement.id,'inspect-mount');
});
test('Build job filtering preserves armed placement through painted inspection, cancel and repeated open',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=test'});ui.click('introTesting');ui.click('testUnlock');ui.click('closeTesting');ui.click('introLoadout');ui.get('loadoutFilters').querySelector('[data-loadout-type="army"]').click();change(ui,'loadoutRole','job:runner');assert.equal(ui.get('ownedSkillList').querySelectorAll('article').length,1);ui.click('owned-mount');const before=serializeProfile(ui.battle.profile);ui.click('loadout-inspect-mount');assert.equal(ui.get('selectedSkillIcon').querySelectorAll('img').length,1);assert.match(ui.get('selectedSkillDetails').textContent,/Fast flag runners/);ui.click('loadoutCloseInspector');assert.equal(ui.get('loadoutRole').value,'job:runner');assert.equal(ui.get('cancelBinding').disabled,false);ui.click('cancelBinding');assert.equal(serializeProfile(ui.battle.profile),before);
});
test('Compare uses two existing atlas portraits and preserves job filters; deck capability links find actual cards',async t=>{
 const ui=await loadGameUI(t);ui.click('introArmory');ui.click('shopCatalogTab');change(ui,'shopDepartmentCompact','army');change(ui,'shopRole','job:flag');ui.click('compare-mount');ui.click('compare-iceDemon');ui.click('shopCompareOpen');assert.equal(ui.get('shopCompareView').querySelectorAll('img').length,2);assert.match(ui.get('shopCompareView').textContent,/Frost-resistant flag guard/);ui.click('shopCompareBack');assert.equal(ui.get('shopRole').value,'job:flag');ui.get('shopDeckComposition').querySelector('details').setAttribute('open','');ui.get('shopDeckComposition').querySelector('[data-deck-job="job:sustain"]').click();assert.equal(ui.get('shopDeckComposition').querySelector('details').getAttribute('open'),null);assert.equal(ui.get('shopRole').value,'job:sustain');assert.ok(ui.get('inspect-priest'));assert.match(ui.get('shopDeckComposition').textContent,/Equipped contracts, not troops/);assert.ok(ui.get('shopGrid').querySelectorAll('article').length<=12);
});


test('300-card job/category/reset and paging remain bounded; copied names or artwork never confer real jobs',async t=>{
 const ui=await loadGameUI(t),root=ui.document.createElement('div');
 const fixture=[...records.map(item=>({...item,storefront:true})),...Array.from({length:300-records.length},(_,i)=>({...byId.get('mount'),id:'future-'+i,name:'Horse Riders',portraitId:'mount',storefront:true}))];
 const skills=fixture.filter(x=>x.kind==='skill').map((item,i)=>({id:item.id,rank:0,binding:i<30?i:-1,xp:0,threshold:100,cooldown:0}));
 const profile={gold:10000,rank:1,difficulty:'medium',skills,owned:new Set(skills.map(x=>x.id)),companionOwned:new Set(['gorath']),companionId:null};
 const snapshot=()=>createArmorySnapshot(profile),view=createArmoryCatalogUI({root,records:fixture,getSnapshot:snapshot,onPurchase:()=>false,onArrange:()=>{}});t.after(()=>view.dispose());view.refresh();root.querySelector('#shopCatalogTab').click();
 const bounded=()=>assert.ok(root.querySelector('#shopGrid').querySelectorAll('article').length<=12);assert.equal(view.diagnostics.resultCount,300);
 view.model.setView({sort:'name',page:17});view.refresh();bounded();
 view.model.setView({department:'army',role:'job:runner'});view.refresh();assert.deepEqual(view.model.query(snapshot()).items.map(x=>x.id),['mount']);assert.equal(view.model.view.page,0);
 view.model.setView({category:'waves'});view.refresh();assert.equal(view.diagnostics.resultCount,0);bounded();root.querySelector('#shopClear').click();assert.equal(view.model.view.role,'all');assert.equal(view.model.view.category,'all');assert.equal(view.model.view.page,0);assert.equal(view.model.view.department,'army');assert.equal(view.diagnostics.resultCount,284);bounded();
 const visited=new Set();for(let page=0;page<view.model.query(snapshot()).pageCount;page++){view.model.setView({page});view.refresh();bounded();for(const item of view.model.query(snapshot()).items)visited.add(item.id);}assert.equal(visited.size,284);
 const collection=new LoadoutCollection(fixture),wrappers=skills.map(skill=>({skill,binding:skill.binding}));collection.setView({type:'army',role:'job:runner'});assert.deepEqual(collection.query(wrappers).items.map(x=>x.item.id),['mount']);collection.setView({type:'waves'});assert.equal(collection.view.role,'all');assert.ok(collection.query(wrappers).items.every(x=>x.item.category==='waves'));collection.setView({type:'all',query:'',role:'all',trait:'all',status:'all'});assert.equal(collection.query(wrappers).total,297);assert.equal(collection.view.page,0);
});
