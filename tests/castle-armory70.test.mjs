import test from 'node:test';
import assert from 'node:assert/strict';
import {PlayerProfile,SKILLS,serializeProfile,restoreProfile} from '../site/dist/engine/progression.mjs';
import {COMPANIONS} from '../site/dist/engine/recruitment.mjs';
import {CASTLE_CATALOG} from '../site/dist/engine/castle-catalog.mjs';
import {ArmoryCart,quoteArmoryCart,checkoutArmoryCart} from '../site/dist/armory-cart.mjs';
import {ArmoryCatalog,armoryCardState,createArmorySnapshot} from '../site/dist/armory-catalog-model.mjs';
import {buildArmoryRecords,ARMORY_DEPARTMENTS} from '../site/dist/armory-catalog-data.mjs';
import {budgetPicks,discoveryPlans,ARMORY_PLANS} from '../site/dist/armory-discovery.mjs';
import {cardIdentity} from '../site/dist/armory-presentation.mjs';
import {getCardInsights,getRankPreview} from '../site/dist/armory-insights.mjs';
import {createArmoryCatalogUI} from '../site/dist/armory-catalog.mjs';
import {loadGameUI} from './helpers/game-ui-harness.mjs';

const records=buildArmoryRecords(SKILLS,COMPANIONS,{}),item=id=>records.find(record=>record.id===id);
const line=id=>({id,kind:item(id).kind,quotedPrice:item(id).price});
const funded=(gold=20000)=>{const profile=new PlayerProfile('Castle market');profile.gold=gold;return profile;};
const allow={canPurchase:()=>true};
const capture=profile=>({save:serializeProfile(profile),refs:Object.fromEntries(['skills','owned','companionOwned','castleLevels'].map(key=>[key,profile[key]])),skills:profile.skills.map(skill=>[skill,Object.getOwnPropertyDescriptors(skill)])});
const unchanged=(profile,before)=>{assert.equal(serializeProfile(profile),before.save);for(const [key,ref]of Object.entries(before.refs))assert.equal(profile[key],ref);for(const [skill,descriptors]of before.skills)assert.deepEqual(Object.getOwnPropertyDescriptors(skill),descriptors);};

test('shipping catalog adds exactly the two closed-enum castle types and a dedicated department',()=>{
 assert.equal(records.length,Object.keys(SKILLS).length+Object.keys(COMPANIONS).length+Object.keys(CASTLE_CATALOG).length);
 assert.deepEqual(records.filter(record=>record.kind==='castle').map(record=>[record.id,record.price,record.category,record.department]),[['classic',0,'castles','castles'],['highwatch',1500,'castles','castles']]);
 assert.equal(ARMORY_DEPARTMENTS.filter(department=>department.id==='castles').length,1);
 assert.throws(()=>new ArmoryCatalog([{id:'unknown',kind:'castle',price:1}]),/Unknown castle/);
 assert.throws(()=>new ArmoryCatalog([{id:'unknown',kind:'structure',price:1}]),/kind/);
 assert.match(item('highwatch').description,/Higher firing station; 2 shelter berths; 20% less keep health/);
 assert.deepEqual(records.filter(record=>record.alliedProtection).map(record=>record.id),['air','poisonDragon','fireDragon','iceDragon']);
});

test('Classic starts owned and equipped; exact-price Highwatch eligibility never grants ownership',()=>{
 for(const gold of [1499,1500,1501]){
  const profile=funded(gold),before=capture(profile),snapshot=createArmorySnapshot(profile);
  assert.deepEqual([...snapshot.castleLevels],[['classic',1]]);
  assert.equal(armoryCardState(item('classic'),snapshot).owned,true);assert.equal(armoryCardState(item('classic'),snapshot).equipped,true);assert.equal(armoryCardState(item('classic'),snapshot).eligible,false);
  const highwatch=armoryCardState(item('highwatch'),snapshot);assert.equal(highwatch.eligible,gold>=1500);assert.equal(highwatch.owned,false);assert.equal(highwatch.equipped,false);assert.equal(highwatch.skill,null);
  unchanged(profile,before);
 }
 const snapshot=createArmorySnapshot(funded());snapshot.castleLevels.set('highwatch',2);assert.equal(armoryCardState(item('highwatch'),snapshot).eligible,false);
});

test('castle catalog filters, ownership and order use dedicated state without ability bindings',()=>{
 const profile=funded(),catalog=new ArmoryCatalog(records),snapshot=createArmorySnapshot(profile);
 catalog.setView({department:'castles'});assert.deepEqual(catalog.query(snapshot).items.map(record=>record.id),['classic','highwatch']);
 catalog.setView({status:'equipped'});assert.deepEqual(catalog.query(snapshot).items.map(record=>record.id),['classic']);
 catalog.setView({status:'available'});assert.deepEqual(catalog.query(snapshot).items.map(record=>record.id),['highwatch']);
 profile.purchaseCastle('highwatch');const owned=createArmorySnapshot(profile);catalog.setView({status:'reserve'});assert.deepEqual(catalog.query(owned).items.map(record=>record.id),['highwatch']);
 catalog.setView({status:'all',query:'20% less'});assert.deepEqual(catalog.query(owned).items.map(record=>record.id),['highwatch']);
 catalog.setView({query:'',sort:'price-desc'});assert.deepEqual(catalog.query(owned).items.map(record=>record.id),['highwatch','classic']);
});

test('castle identity and insights expose truthful, compare-safe sidegrades without level progression',()=>{
 for(const id of ['classic','highwatch']){
  const identity=cardIdentity(item(id)),facts=getCardInsights(item(id),{heroRank:1,rank:10});
  assert.equal(identity.label,'Castle sidegrade');assert.ok(!identity.facts.some(fact=>/Reload|Deploy|rank/i.test(fact.label)));
  assert.equal(facts.progression.kind,'none');assert.equal(facts.progression.nextRank,null);
  assert.equal(facts.metrics.find(metric=>metric.key==='keepHealth').value,id==='classic'?8400:6720);
  assert.equal(facts.metrics.find(metric=>metric.key==='shelterBerths').value,id==='classic'?4:2);
  assert.match(facts.notes.join(' '),/does not guarantee extra bow range/);
  assert.deepEqual(getRankPreview(item(id),{heroRank:1},10).changes,[]);
 }
 assert.match(getCardInsights('highwatch').notes.join(' '),/provisional/);
});

test('budget discovery honors castle ownership, exact budget and current purchase window; four plans remain unchanged',()=>{
 const profile=funded(1500),snapshot=createArmorySnapshot(profile);
 assert.ok(budgetPicks(records,snapshot,1500,12).some(record=>record.id==='highwatch'));
 assert.ok(!budgetPicks(records,snapshot,1499,12).some(record=>record.id==='highwatch'));
 assert.ok(!budgetPicks(records,snapshot,1500,12).some(record=>record.id==='classic'));
 assert.deepEqual(budgetPicks(records,{...snapshot,purchaseBlockedReason:'Finish this battle'},1500,12),[]);
 const plans=discoveryPlans(records,snapshot);assert.deepEqual(plans.map(plan=>plan.id),ARMORY_PLANS.map(plan=>plan.id));assert.equal(plans.length,4);
});

test('single castle checkout accepts 1500 exactly, leaves Classic selected and survives a profile round-trip',()=>{
 for(const gold of [1499,1500,1501]){
  const profile=funded(gold),before=capture(profile),cart=new ArmoryCart();cart.add(item('highwatch'));
  assert.equal(cart.quote(profile).ok,gold>=1500);assert.deepEqual(cart.quote(createArmorySnapshot(profile)),cart.quote(profile));
  const result=cart.checkout(profile,allow);assert.equal(result.ok,gold>=1500);
  if(gold<1500){assert.equal(cart.size,1);unchanged(profile,before);continue;}
  assert.equal(profile.gold,gold-1500);assert.equal(profile.castleLevels.get('highwatch'),1);assert.equal(profile.castleId,'classic');assert.equal(profile.companionId,null);assert.equal(cart.size,0);
  assert.deepEqual(result.receipt.castleIds,['highwatch']);assert.deepEqual(result.receipt.skillIds,[]);assert.deepEqual(result.receipt.companionIds,[]);
  const restored=restoreProfile(serializeProfile(profile));assert.deepEqual([...restored.castleLevels],[['classic',1],['highwatch',1]]);assert.equal(restored.castleId,'classic');
  const after=capture(profile);assert.equal(checkoutArmoryCart(profile,[line('highwatch')],allow).code,'already_owned');unchanged(profile,after);
 }
});

test('exact-budget mixed skill, companion and castle cart charges once and preserves all selected slots and live timers',()=>{
 for(const ids of [['highwatch','gorath','fireArrow'],['fireArrow','gorath','highwatch']]){
  const profile=funded(10000),basic=profile.skills[0];basic.cooldown=70;basic.binding=4;basic.addXP(17);basic.autocast=false;
  const descriptors=Object.getOwnPropertyDescriptors(basic),cart=new ArmoryCart();ids.forEach(id=>cart.add(item(id)));
  const result=cart.checkout(profile,allow);assert.equal(result.ok,true);assert.equal(profile.gold,0);assert.equal(result.receipt.total,10000);assert.deepEqual(result.receipt.lines.map(line=>line.id),ids);
  assert.equal(profile.skills[0],basic);assert.deepEqual(Object.getOwnPropertyDescriptors(basic),descriptors);assert.equal(profile.skills[1].binding,-1);assert.equal(profile.skills[1].id,'fireArrow');
  assert.equal(profile.companionOwned.has('gorath'),true);assert.equal(profile.companionId,null);assert.equal(profile.castleLevels.get('highwatch'),1);assert.equal(profile.castleId,'classic');
 }
});

test('unknown, wrong-kind, duplicated, stale-price and already-owned castle lines abort the whole cart',()=>{
 const invalid=[{id:'unknown',kind:'castle',quotedPrice:1},{id:'constructor',kind:'castle',quotedPrice:1},{id:'__proto__',kind:'castle',quotedPrice:1},{id:'highwatch',kind:'skill',quotedPrice:1500},{...line('highwatch'),quotedPrice:1499},line('classic')];
 for(const bad of invalid){const profile=funded(),before=capture(profile);assert.equal(checkoutArmoryCart(profile,[line('fireArrow'),bad],allow).ok,false);unchanged(profile,before);}
 const profile=funded(),before=capture(profile);assert.equal(checkoutArmoryCart(profile,[line('highwatch'),line('highwatch')],allow).code,'duplicate_line');unchanged(profile,before);
 assert.ok(Object.isFrozen(CASTLE_CATALOG));assert.ok(Object.isFrozen(CASTLE_CATALOG.highwatch));
 const cart=new ArmoryCart();assert.equal(cart.add(item('highwatch')).changed,true);assert.equal(cart.add(item('highwatch')).changed,false);assert.equal(cart.size,1);
});

test('a staged castle purchase throwing after earlier skill and companion success rolls the mixed cart back',t=>{
 const profile=funded(10000),before=capture(profile),original=PlayerProfile.prototype.purchaseCastle,cart=new ArmoryCart();['fireArrow','gorath','highwatch'].forEach(id=>cart.add(item(id)));
 t.after(()=>{PlayerProfile.prototype.purchaseCastle=original;});
 PlayerProfile.prototype.purchaseCastle=function(id){assert.equal(this.owned.has('fireArrow'),true);assert.equal(this.companionOwned.has('gorath'),true);assert.equal(original.call(this,id),true);assert.equal(this.gold,0);throw Error('after final staged purchase');};
 assert.equal(cart.checkout(profile,allow).code,'purchase_failed');assert.equal(cart.size,3);unchanged(profile,before);
 PlayerProfile.prototype.purchaseCastle=original;assert.equal(cart.checkout(profile,allow).ok,true);assert.equal(profile.gold,0);assert.equal(cart.size,0);
});

test('fresh purchase-window checks close a mixed cart before any live commit',()=>{
 const profile=funded(10000),before=capture(profile);let calls=0;
 assert.equal(checkoutArmoryCart(profile,[line('highwatch'),line('gorath'),line('fireArrow')],{canPurchase:()=>++calls===1}).code,'context_blocked');assert.equal(calls,2);unchanged(profile,before);
});

test('ownership additions, future levels, replaced map and changed selected castle make checkout stale',()=>{
 for(const mutate of [profile=>profile.castleLevels.set('highwatch',1),profile=>profile.castleLevels.set('classic',2),profile=>{profile.castleLevels=new Map(profile.castleLevels);}]){
  const profile=funded(),skills=profile.skills,owned=profile.owned;let calls=0;
  const result=checkoutArmoryCart(profile,[line('fireArrow'),line('highwatch')],{canPurchase:()=>{if(++calls===2)mutate(profile);return true;}});
  assert.equal(result.code,'profile_changed');assert.equal(profile.gold,20000);assert.equal(profile.skills,skills);assert.equal(profile.owned,owned);assert.equal(profile.owned.has('fireArrow'),false);
 }
 const profile=funded();profile.purchaseCastle('highwatch');const balance=profile.gold;let calls=0;
 assert.equal(checkoutArmoryCart(profile,[line('fireArrow')],{canPurchase:()=>{if(++calls===2)profile.castleId='highwatch';return true;}}).code,'profile_changed');assert.equal(profile.gold,balance);assert.equal(profile.castleId,'highwatch');
});

test('mixed checkout revalidates source prices and input quotes after staging',t=>{
 const original=SKILLS.fireArrow.price;t.after(()=>{SKILLS.fireArrow.price=original;});
 const profile=funded(),before=capture(profile);let calls=0;
 assert.equal(checkoutArmoryCart(profile,[line('highwatch'),line('fireArrow')],{canPurchase:()=>{if(++calls===2)SKILLS.fireArrow.price++;return true;}}).code,'price_changed');unchanged(profile,before);SKILLS.fireArrow.price=original;
 const lines=[line('highwatch')];calls=0;
 assert.equal(checkoutArmoryCart(profile,lines,{canPurchase:()=>{if(++calls===2)lines[0].quotedPrice=0;return true;}}).code,'cart_changed');unchanged(profile,before);
});

test('castle checkout rejects protected and accessor ownership before staging and without running getters',()=>{
 const profile=funded();Object.defineProperty(profile,'castleLevels',{writable:false});const before=capture(profile);
 assert.equal(checkoutArmoryCart(profile,[line('highwatch')],allow).code,'invalid_profile');unchanged(profile,before);
 for(const key of ['castleLevels','castleId']){
  const bad=funded();let reads=0;Object.defineProperty(bad,key,{get(){reads++;throw Error('must not run');}});
  assert.equal(checkoutArmoryCart(bad,[line('highwatch')],allow).code,'invalid_profile');assert.equal(reads,0);assert.equal(bad.gold,20000);
 }
});

test('castle reentrant checkout fails busy while the original completes exactly once',()=>{
 const profile=funded(1500);let nested,calls=0;
 const result=checkoutArmoryCart(profile,[line('highwatch')],{canPurchase:()=>{if(++calls===1)nested=checkoutArmoryCart(profile,[line('highwatch')],allow);return true;}});
 assert.equal(nested.code,'checkout_busy');assert.equal(result.ok,true);assert.equal(profile.gold,0);assert.equal(profile.castleId,'classic');
});

async function localArmory(t,options={}){
 const ui=await loadGameUI(t),root=ui.document.createElement('div'),profile=options.profile??funded();
 let current=profile,blocked=null,equipBlocked=null,purchaseCalls=0;const events=[];
 const view=createArmoryCatalogUI({root,records,getSessionKey:()=>current,getSnapshot:()=>({...createArmorySnapshot(current),purchaseBlockedReason:blocked,castleEquipBlockedReason:equipBlocked,castleSelectionLabel:'Next castle'}),onPurchase:()=>{purchaseCalls++;return false;},onCheckout:lines=>{events.push({type:'checkout',lines});return checkoutArmoryCart(current,lines,{canPurchase:()=>!blocked});},onCastleEquip:(selection,context)=>{events.push({type:'equip',selection,context});return {ok:false,message:'Host deliberately left the field unchanged.'};},onArrange:item=>events.push({type:'arrange',id:item.id})});
 view.refresh();view.openDepartment('castles');t.after(()=>view.dispose());
 return {ui,root,profile,view,events,click:id=>root.querySelector('#'+id).click(),get:id=>root.querySelector('#'+id),switch:profile=>{current=profile;},block:reason=>{blocked=reason;},blockEquip:reason=>{equipBlocked=reason;},get purchaseCalls(){return purchaseCalls;}};
}

test('castle cards use native castle art, dedicated filters and no nonexistent stats or rank controls',async t=>{
 const ui=await localArmory(t);assert.equal(ui.view.state.mode,'catalog');assert.equal(ui.get('shopDepartmentCompact').value,'castles');assert.equal(ui.get('shopGrid').querySelectorAll('article').length,2);
 assert.equal(ui.get('shopGrid').querySelectorAll('[data-castle-preview]').length,2);assert.equal(ui.get('shopGrid').querySelectorAll('img').length,0);
 ui.click('inspect-highwatch');assert.match(ui.get('shopDetails').textContent,/20% less keep health/);assert.match(ui.get('shopDetails').textContent,/hero uses 1/);assert.match(ui.get('shopDetails').textContent,/provisional/);assert.doesNotMatch(ui.get('shopDetails').textContent,/Ability rank|NaN|undefined/);
 ui.get('shopDetailMode').value='stats';ui.ui.dispatch(ui.get('shopDetailMode'),'change');assert.equal(ui.get('shopPreviewRank'),null);assert.match(ui.get('shopDetails').textContent,/Castle levels and paid upgrades are not available/);
 ui.click('shopCloseDetails');ui.click('compare-classic');ui.click('compare-highwatch');ui.click('shopCompareOpen');assert.equal(ui.get('shopCompareRank'),null);assert.match(ui.get('shopCompareView').textContent,/Castle sidegrade · no levels/);assert.doesNotMatch(ui.get('shopCompareView').textContent,/Ability rank 0/);
});

test('single castle Acquire uses atomic checkout and an equip click sends a typed host request without direct assignment',async t=>{
 const ui=await localArmory(t,{profile:funded(1500)});ui.click('buy-highwatch');assert.equal(ui.purchaseCalls,0);assert.deepEqual(ui.events[0],{type:'checkout',lines:[line('highwatch')]});assert.equal(ui.profile.gold,0);assert.equal(ui.profile.castleId,'classic');assert.equal(ui.profile.castleLevels.get('highwatch'),1);
 assert.match(ui.get('shopDetails').textContent,/Your Castle slot/);assert.match(ui.get('shopDetails').textContent,/Next castle: Classic Keep/);ui.click('shopCastleEquip');
 assert.deepEqual(ui.events[1].selection,{id:'highwatch',level:1});assert.equal(ui.events[1].context.sessionKey,ui.profile);assert.equal(ui.events[1].context.equippedId,'classic');assert.equal(ui.profile.castleId,'classic');ui.click('shopOpenCastleBuild');assert.deepEqual(ui.events[2],{type:'arrange',id:'highwatch'});
});

test('stale castle purchase/equip nodes and newly blocked host windows cannot act',async t=>{
 const ui=await localArmory(t),oldBuy=ui.get('buy-highwatch');ui.switch(funded());oldBuy.click();assert.equal(ui.events.length,0);ui.view.openDepartment('castles');ui.block('Finish this battle to purchase');ui.get('buy-highwatch').click();assert.equal(ui.events.length,0);
 ui.block(null);ui.switch(ui.profile);ui.view.refresh();ui.view.openDepartment('castles');ui.click('buy-highwatch');const equip=ui.get('shopCastleEquip'),eventCount=ui.events.length;ui.blockEquip('Change your castle before starting or after the battle.');equip.click();assert.equal(ui.events.length,eventCount);assert.equal(ui.profile.castleId,'classic');
 ui.blockEquip(null);ui.view.refresh();const stale=ui.get('shopCastleEquip');ui.switch(funded());stale.click();assert.equal(ui.events.length,eventCount);
});

test('castle SVGs stay bounded to the current page in a 300-record mixed catalog',async t=>{
 const ui=await loadGameUI(t),root=ui.document.createElement('div'),profile=funded(),fixtures=Array.from({length:298},(_,index)=>({id:'private-castle-bound-'+index,name:'Private card '+index,kind:'skill',department:'bow',role:'bow',category:'arrows',price:10,reloadSeconds:2,traits:[]}));
 const view=createArmoryCatalogUI({root,records:[...records.filter(record=>record.kind==='castle'),...fixtures],getSnapshot:()=>createArmorySnapshot(profile),onPurchase:()=>false,onArrange:()=>{}});t.after(()=>view.dispose());view.refresh();view.openDepartment('all');assert.equal(view.diagnostics.resultCount,300);assert.equal(root.querySelector('#shopGrid').querySelectorAll('article').length,12);assert.equal(root.querySelector('#shopGrid').querySelectorAll('[data-castle-preview]').length,2);root.querySelector('#shopNext').click();assert.equal(root.querySelector('#shopGrid').querySelectorAll('article').length,12);assert.equal(root.querySelector('#shopGrid').querySelectorAll('[data-castle-preview]').length,0);
});


test('same-state profile switches remount castle actions rather than leaving stale handlers on current buttons',async t=>{
 const ui=await localArmory(t),second=funded(),stale=ui.get('buy-highwatch');ui.switch(second);ui.view.refresh();assert.notEqual(ui.get('buy-highwatch'),stale);ui.click('buy-highwatch');assert.equal(second.castleLevels.get('highwatch'),1);assert.equal(second.castleId,'classic');assert.equal(ui.profile.castleLevels.has('highwatch'),false);assert.equal(ui.events.length,1);
 ui.switch(ui.profile);ui.view.refresh();stale.click();assert.equal(ui.profile.castleLevels.has('highwatch'),false);assert.equal(ui.events.length,1);ui.click('shopCloseDetails');ui.click('buy-highwatch');assert.equal(ui.profile.castleLevels.get('highwatch'),1);assert.equal(ui.events.length,2);
});
