import test from 'node:test';
import assert from 'node:assert/strict';
import {ArmoryCart,ARMORY_CART_CAPACITY,quoteArmoryCart,checkoutArmoryCart} from '../site/dist/armory-cart.mjs';
import {PlayerProfile,SKILLS,serializeProfile,restoreProfile} from '../site/dist/engine/progression.mjs';
import {COMPANIONS} from '../site/dist/engine/recruitment.mjs';
import {createArmorySnapshot} from '../site/dist/armory-catalog-model.mjs';
import {CampaignBattle} from '../site/dist/engine/first-battle.mjs';
import {seededRandom} from '../site/dist/engine/combat.mjs';

const card=id=>({id,kind:Object.hasOwn(COMPANIONS,id)?'companion':'skill',...(COMPANIONS[id]??SKILLS[id])});
const line=id=>{const item=card(id);return {id,kind:item.kind,quotedPrice:item.price};};
const funded=(gold=20000)=>{const profile=new PlayerProfile('Cart fixture');profile.gold=gold;return profile;};
const allow={canPurchase:()=>true};
const tracked=profile=>({save:Number.isInteger(profile.gold)?serializeProfile(profile):null,skillValues:profile.skills.map(skill=>Object.getOwnPropertyDescriptors(skill)),ownedValues:[...profile.owned],companionValues:[...profile.companionOwned],gold:profile.gold,skills:profile.skills,owned:profile.owned,companionOwned:profile.companionOwned,skillRefs:[...profile.skills],companionId:profile.companionId});
const unchanged=(profile,before)=>{
 if(before.save!==null)assert.equal(serializeProfile(profile),before.save);
 assert.deepEqual(profile.skills.map(skill=>Object.getOwnPropertyDescriptors(skill)),before.skillValues);
 assert.deepEqual([...profile.owned],before.ownedValues);assert.deepEqual([...profile.companionOwned],before.companionValues);
 for(const key of ['gold','skills','owned','companionOwned','companionId'])assert.equal(profile[key],before[key]);
 assert.deepEqual(profile.skills,before.skillRefs);
};

test('cart captures stable ID, kind and shown price without refreshing a duplicate',()=>{
 const cart=new ArmoryCart(),item=card('fireArrow');
 assert.equal(cart.add(item).changed,true);item.price=42;
 assert.deepEqual(cart.lines,[{id:'fireArrow',kind:'skill',quotedPrice:1000}]);
 assert.equal(cart.add(item).changed,false);assert.equal(cart.size,1);assert.equal(cart.has('fireArrow'),true);
 assert.equal(cart.lines[0].quotedPrice,1000);assert.ok(Object.isFrozen(cart.lines));assert.ok(Object.isFrozen(cart.lines[0]));
 assert.throws(()=>{cart.lines[0].quotedPrice=0;},TypeError);
 assert.equal(cart.add({...item,kind:'companion'}).code,'duplicate_line');
 assert.equal(cart.remove('fireArrow'),true);assert.equal(cart.remove('fireArrow'),false);
 assert.equal(cart.clear(),false);cart.add(card('iceArrow'));assert.equal(cart.clear(),true);assert.equal(cart.clear(),false);
});

test('cart size is hard-bounded; test fixtures never become live purchase inventory',()=>{
 const cart=new ArmoryCart();assert.equal(ARMORY_CART_CAPACITY,50);
 for(let i=0;i<50;i++)assert.equal(cart.add({id:`private-fixture-${i}`,kind:'skill',price:i}).ok,true);
 assert.equal(cart.size,50);assert.equal(cart.add({id:'private-overflow',kind:'skill',price:1}).code,'cart_full');
 assert.equal(cart.add({id:'private-fixture-0',kind:'skill',price:1}).changed,false);
 assert.equal(cart.quote(funded()).code,'missing_item');
 for(const capacity of [0,-1,51,Infinity,1.5,'2'])assert.throws(()=>new ArmoryCart({capacity}),RangeError);
 const small=new ArmoryCart({capacity:1});small.add(card('fireArrow'));assert.equal(small.add(card('iceArrow')).code,'cart_full');
});

test('cart rejects malformed cards and unsafe prices without changing its contents',()=>{
 const cart=new ArmoryCart();
 for(const item of [null,{},card('missing'),{id:'bad id',kind:'skill',price:1},{id:'ok',kind:'pack',price:1},...[NaN,Infinity,-1,0.5,'1',Number.MAX_SAFE_INTEGER+1].map(price=>({id:'bad',kind:'skill',price}))])assert.equal(cart.add(item).ok,false);
 assert.equal(cart.size,0);
});

test('quote uses fresh ownership and source prices while leaving every input unchanged',()=>{
 const profile=funded(),lines=Object.freeze([Object.freeze(line('fireArrow')),Object.freeze(line('gorath'))]),before=tracked(profile);
 const quote=quoteArmoryCart(lines,profile);
 assert.equal(quote.ok,true);assert.equal(quote.total,8500);assert.equal(quote.gold,20000);assert.equal(quote.remainingGold,11500);assert.equal(quote.requiredGold,8500);assert.equal(quote.shortfall,0);
 assert.deepEqual(quote.lines.map(item=>[item.id,item.code,item.currentPrice]),[['fireArrow','ready',1000],['gorath','ready',7500]]);
 unchanged(profile,before);
 assert.deepEqual(quoteArmoryCart(lines,createArmorySnapshot(profile)),quote);
});

test('skill-only quote uses the displayed total with exact and fractional balances',()=>{
 for(const [gold,ok,shortfall] of [[1999,false,1],[1999.5,false,1],[2000,true,0],[2000.5,true,0],[2001,true,0]]){
  const quote=quoteArmoryCart([line('fireArrow'),line('iceArrow')],funded(gold));
  assert.equal(quote.ok,ok);assert.equal(quote.shortfall,shortfall);assert.equal(quote.requiredGold,2000);
 }
});

test('companion-only and mixed exact-total quotes allow equality independent of add order',()=>{
 assert.equal(quoteArmoryCart([line('gorath')],funded(7500)).ok,true);
 for(const ids of [['gorath','fireArrow'],['fireArrow','gorath']]){
  const quote=quoteArmoryCart(ids.map(line),funded(8500));assert.equal(quote.ok,true);assert.equal(quote.requiredGold,8500);assert.equal(quote.remainingGold,0);
 }
});

test('quote reports owned, source-missing, price-changed and duplicate lines by stable ID',()=>{
 const p=funded();p.addSkill('iceArrow');
 const lines=[line('iceArrow'),{id:'missing',kind:'skill',quotedPrice:1},{...line('fireArrow'),quotedPrice:9},line('fireArrow')];
 const quote=quoteArmoryCart(lines,p);
 assert.equal(quote.ok,false);assert.deepEqual(quote.errors.map(item=>[item.id,item.code]),[['iceArrow','already_owned'],['missing','missing_item'],['fireArrow','price_changed'],['fireArrow','duplicate_line']]);
 assert.match(quote.errors[2].message,/Remove it and add it again/);
});

test('an already-present skill cannot be repurchased even if its owned Set is inconsistent',()=>{
 const p=funded();p.addSkill('fireArrow');p.owned.delete('fireArrow');
 assert.equal(quoteArmoryCart([line('fireArrow')],p).code,'already_owned');
});

test('malformed or over-capacity carts and invalid profiles fail closed',()=>{
 const p=funded();
 for(const [lines,code] of [[null,'invalid_cart'],[[],'empty_cart'],[[null],'invalid_line'],[[{id:'fireArrow',kind:'skill',quotedPrice:-1}],'invalid_line'],[Array(51).fill(line('fireArrow')),'cart_full']])assert.equal(quoteArmoryCart(lines,p).code,code);
 for(const gold of [NaN,Infinity,-1,Number.MAX_SAFE_INTEGER+1])assert.equal(quoteArmoryCart([line('fireArrow')],{...p,gold}).code,'invalid_profile');
 assert.equal(quoteArmoryCart([line('fireArrow')],null).code,'invalid_profile');
 assert.equal(checkoutArmoryCart(null,[],allow).code,'invalid_profile');
});

test('checkout requires a fresh synchronous host permission and never accepts absent or async approval',()=>{
 const p=funded(),before=tracked(p);
 for(const canPurchase of [undefined,()=>false,()=>Promise.resolve(true),()=>{throw Error('closed');}]){
  assert.equal(checkoutArmoryCart(p,[line('fireArrow')],{canPurchase}).code,'context_blocked');unchanged(p,before);
 }
});

test('mixed checkout calls real engine rules, charges once and puts all new cards in reserve',()=>{
 const p=funded(9500),before=tracked(p),cart=new ArmoryCart();
 for(const id of ['gorath','fireArrow','iceArrow'])cart.add(card(id));
 let calls=0;const result=cart.checkout(p,{canPurchase:current=>{assert.equal(current,p);calls++;return true;}});
 assert.equal(result.ok,true);assert.equal(result.code,'purchased');assert.match(result.message,/3 cards added/);assert.equal(calls,2);
 assert.equal(p.gold,0);assert.equal(p.companionId,null);assert.equal(p.skills[0],before.skillRefs[0]);assert.equal(p.skills[0].binding,0);
 assert.deepEqual(p.skills.slice(1).map(skill=>[skill.id,skill.binding]),[['fireArrow',-1],['iceArrow',-1]]);
 assert.equal(p.companionOwned.has('gorath'),true);assert.deepEqual(result.receipt.lines.map(item=>[item.id,item.kind,item.price]),[['gorath','companion',7500],['fireArrow','skill',1000],['iceArrow','skill',1000]]);
 assert.equal(result.receipt.goldBefore,9500);assert.equal(result.receipt.goldAfter,0);assert.equal(result.receipt.total,9500);assert.equal(cart.size,0);
 assert.equal(cart.checkout(p,allow).code,'empty_cart');assert.equal(p.gold,0);
});

test('existing progress, cooldown, binding and live skill identity survive successful checkout',()=>{
 const p=funded(12000);p.addSkill('iceArrow');const ice=p.skills.at(-1);ice.binding=8;ice.cooldown=71;ice.addXP(140.5);ice.autocast=false;
 const descriptors=Object.getOwnPropertyDescriptors(ice),basic=p.skills[0];
 const result=checkoutArmoryCart(p,[line('fireArrow')],allow);
 assert.equal(result.ok,true);assert.equal(p.skills[0],basic);assert.equal(p.skills[1],ice);assert.deepEqual(Object.getOwnPropertyDescriptors(ice),descriptors);assert.equal(p.skills[2].binding,-1);
 const restored=restoreProfile(serializeProfile(p));assert.equal(restored.gold,11000);assert.equal(restored.skills.find(skill=>skill.id==='fireArrow').binding,-1);assert.equal(restored.companionId,null);
});

test('buying skills never changes an existing companion selection',()=>{
 const p=funded(12000);assert.equal(p.recruitCompanion('gorath'),true);const result=checkoutArmoryCart(p,[line('fireArrow')],allow);
 assert.equal(result.ok,true);assert.equal(p.companionId,'gorath');assert.equal(p.companionOwned.size,1);
});

test('stale exact-total quotes reject insufficient integer or fractional funds and retain the cart',()=>{
 for(const gold of [1999,1999.5]){
  const p=funded(2000),cart=new ArmoryCart();cart.add(card('fireArrow'));cart.add(card('iceArrow'));
  assert.equal(cart.quote(p).ok,true);p.gold=gold;const before=tracked(p);
  const result=cart.checkout(p,allow);assert.equal(result.code,'insufficient_gold');assert.equal(result.shortfall,1);assert.match(result.message,/in-game gold/);assert.equal(cart.size,2);unchanged(p,before);
 }
});

test('exact-budget skill cart reaches zero, round-trips and rejects a repeated raw checkout',()=>{
 const p=funded(2000),basic=p.skills[0],cart=new ArmoryCart();cart.add(card('fireArrow'));cart.add(card('iceArrow'));const lines=cart.lines;
 const result=cart.checkout(p,allow);assert.equal(result.ok,true);assert.equal(p.gold,0);assert.equal(result.receipt.goldAfter,0);assert.equal(result.receipt.total,2000);assert.equal(result.requiredGold,2000);assert.equal(cart.size,0);
 assert.equal(p.skills[0],basic);assert.deepEqual(p.skills.slice(1).map(skill=>[skill.id,skill.binding]),[['fireArrow',-1],['iceArrow',-1]]);
 const restored=restoreProfile(serializeProfile(p));assert.equal(restored.gold,0);assert.deepEqual(restored.skills.map(skill=>[skill.id,skill.binding]),[['arrow',0],['fireArrow',-1],['iceArrow',-1]]);
 const before=tracked(p);assert.equal(checkoutArmoryCart(p,lines,allow).code,'already_owned');unchanged(p,before);
});

test('missing, stale, duplicate and now-owned lines abort the entire mixed cart',()=>{
 const failures=[
  [line('fireArrow'),{id:'missing',kind:'companion',quotedPrice:7500}],
  [line('fireArrow'),{...line('gorath'),quotedPrice:7400}],
  [line('fireArrow'),line('fireArrow')],
  [line('fireArrow'),line('arrow')]
 ];
 for(const lines of failures){const p=funded(),before=tracked(p);assert.equal(checkoutArmoryCart(p,lines,allow).ok,false);unchanged(p,before);}
});

test('price changes since adding are detected using the live source and retain the cart',t=>{
 const p=funded(),before=tracked(p),cart=new ArmoryCart(),original=SKILLS.fireArrow.price;t.after(()=>{SKILLS.fireArrow.price=original;});
 cart.add(card('fireArrow'));SKILLS.fireArrow.price=original+1;
 assert.equal(cart.checkout(p,allow).code,'price_changed');assert.equal(cart.size,1);assert.equal(cart.lines[0].quotedPrice,original);unchanged(p,before);
});

test('a repeated checkout of the same raw lines never charges twice',()=>{
 const p=funded(8500),lines=[line('fireArrow'),line('gorath')];assert.equal(checkoutArmoryCart(p,lines,allow).ok,true);assert.equal(p.gold,0);
 const before=tracked(p);assert.equal(checkoutArmoryCart(p,lines,allow).code,'already_owned');unchanged(p,before);
});

test('closing the purchase window during checkout cancels all staged changes',()=>{
 const p=funded(),before=tracked(p);let calls=0;
 const result=checkoutArmoryCart(p,[line('fireArrow'),line('gorath')],{canPurchase:()=>++calls===1});
 assert.equal(result.code,'context_blocked');assert.equal(calls,2);unchanged(p,before);
});

test('exact-budget checkout rejects integer or fractional fund changes during the final check',()=>{
 for(const gold of [1999,1999.5]){
  const p=funded(2000),originalSkills=p.skills,originalOwned=p.owned;let calls=0;
  const result=checkoutArmoryCart(p,[line('fireArrow'),line('iceArrow')],{canPurchase:()=>{if(++calls===2)p.gold=gold;return true;}});
  assert.equal(result.code,'profile_changed');assert.equal(p.gold,gold);assert.equal(p.skills,originalSkills);assert.equal(p.owned,originalOwned);assert.equal(p.owned.has('fireArrow'),false);assert.equal(p.owned.has('iceArrow'),false);
 }
});

test('checkout rejects changed existing skill contents during final context check',()=>{
 const p=funded(),originalSkills=p.skills;let calls=0;
 const result=checkoutArmoryCart(p,[line('fireArrow')],{canPurchase:()=>{if(++calls===2)p.skills[0].binding=4;return true;}});
 assert.equal(result.code,'profile_changed');assert.equal(p.gold,20000);assert.equal(p.skills,originalSkills);assert.equal(p.skills[0].binding,4);assert.equal(p.owned.has('fireArrow'),false);
});

test('checkout revalidates prices after staging before committing',t=>{
 const p=funded(),before=tracked(p),price=SKILLS.fireArrow.price;t.after(()=>{SKILLS.fireArrow.price=price;});let calls=0;
 const result=checkoutArmoryCart(p,[line('fireArrow')],{canPurchase:()=>{if(++calls===2)SKILLS.fireArrow.price++;return true;}});
 assert.equal(result.code,'price_changed');unchanged(p,before);
});

test('mutable caller line changes during checkout cannot silently change the receipt',()=>{
 const p=funded(),before=tracked(p),lines=[line('fireArrow')];let calls=0;
 const result=checkoutArmoryCart(p,lines,{canPurchase:()=>{if(++calls===2)lines[0].quotedPrice=0;return true;}});
 assert.equal(result.code,'cart_changed');unchanged(p,before);
});

test('re-entrant checkout is guarded while one transaction is active',()=>{
 const p=funded();let nested,calls=0;
 const result=checkoutArmoryCart(p,[line('fireArrow')],{canPurchase:()=>{if(++calls===1)nested=checkoutArmoryCart(p,[line('iceArrow')],allow);return true;}});
 assert.equal(nested.code,'checkout_busy');assert.equal(result.ok,true);assert.equal(p.gold,19000);assert.equal(p.owned.has('iceArrow'),false);
});

test('a source purchase failure after an earlier staged success leaves live profile unchanged',t=>{
 const p=funded(),before=tracked(p),method=PlayerProfile.prototype.recruitCompanion;t.after(()=>{PlayerProfile.prototype.recruitCompanion=method;});
 PlayerProfile.prototype.recruitCompanion=function(){assert.equal(this.owned.has('fireArrow'),true);return false;};
 assert.equal(checkoutArmoryCart(p,[line('fireArrow'),line('gorath')],allow).code,'purchase_failed');unchanged(p,before);
});

test('a throwing source purchase leaves live profile unchanged and releases transaction guard',t=>{
 const p=funded(),before=tracked(p),method=PlayerProfile.prototype.purchase;t.after(()=>{PlayerProfile.prototype.purchase=method;});
 PlayerProfile.prototype.purchase=function(){this.gold=0;this.skills[0].binding=19;throw Error('fixture failure');};
 assert.equal(checkoutArmoryCart(p,[line('fireArrow')],allow).code,'purchase_failed');unchanged(p,before);
 PlayerProfile.prototype.purchase=method;assert.equal(checkoutArmoryCart(p,[line('fireArrow')],allow).ok,true);
});

test('nonwritable profile fields and setter-backed fields are rejected before staging',()=>{
 for(const key of ['gold','skills','owned','companionOwned']){
  const p=funded();Object.defineProperty(p,key,{writable:false});const before=tracked(p);
  assert.equal(checkoutArmoryCart(p,[line('fireArrow')],allow).code,'invalid_profile');unchanged(p,before);
 }
 const p=funded();let writes=0;Object.defineProperty(p,'gold',{get:()=>20000,set:()=>{writes++;},configurable:true});
 assert.equal(checkoutArmoryCart(p,[line('fireArrow')],allow).code,'invalid_profile');assert.equal(writes,0);assert.equal(p.owned.has('fireArrow'),false);
});

test('success updates only four profile fields and leaves unrelated objects untouched',()=>{
 const p=funded();p.fixture={untouched:true};const unrelated=Object.fromEntries(Object.entries(p).filter(([key])=>!['gold','skills','owned','companionOwned'].includes(key)));
 const result=checkoutArmoryCart(p,[line('fireArrow')],allow);assert.equal(result.ok,true);
 for(const [key,value]of Object.entries(unrelated))assert.equal(p[key],value);
 assert.ok(Object.isFrozen(result.receipt));assert.ok(Object.isFrozen(result.receipt.lines));assert.ok(Object.isFrozen(result.receipt.lines[0]));
});

test('single skill and companion checkout both accept their exact displayed price',()=>{
 for(const [gold,expected]of [[999,false],[999.5,false],[1000,true],[1000.5,true],[1001,true]]){
  const p=funded(gold),before=expected?null:tracked(p),result=checkoutArmoryCart(p,[line('fireArrow')],allow);
  assert.equal(result.ok,expected);if(expected){assert.equal(p.gold,gold-1000);assert.equal(p.skills.at(-1).binding,-1);}else unchanged(p,before);
 }
 const p=funded(7500),result=checkoutArmoryCart(p,[line('gorath')],allow);
 assert.equal(result.ok,true);assert.equal(p.gold,0);assert.equal(p.companionOwned.has('gorath'),true);assert.equal(p.companionId,null);
});

test('late missing source records and a newly owned companion cancel all lines',t=>{
 const saved=SKILLS.fireArrow;t.after(()=>{SKILLS.fireArrow=saved;});
 const lines=[line('fireArrow'),line('gorath')],p=funded(),before=tracked(p);delete SKILLS.fireArrow;
 assert.equal(checkoutArmoryCart(p,lines,allow).code,'missing_item');unchanged(p,before);SKILLS.fireArrow=saved;
 assert.equal(p.recruitCompanion('gorath'),true);const owned=tracked(p);
 assert.equal(checkoutArmoryCart(p,lines,allow).code,'already_owned');unchanged(p,owned);
});

test('staged failures retain the same flat quote diagnostics as validation failures',()=>{
 const p=funded();let calls=0;
 const result=checkoutArmoryCart(p,[line('fireArrow')],{canPurchase:()=>++calls===1});
 assert.equal(result.ok,false);assert.equal(result.code,'context_blocked');assert.equal(result.total,1000);assert.equal(result.lines[0].id,'fireArrow');assert.equal(result.receipt,undefined);
});


test('host can refresh the existing hotbar after atomic array replacement without auto-equipping',()=>{
 const p=funded(),battle=new CampaignBattle({profile:p,random:seededRandom(123)}),original=battle.activeSkill;
 assert.equal(checkoutArmoryCart(p,[line('grunt')],allow).ok,true);
 const grunt=p.skills.find(skill=>skill.id==='grunt');
 battle.hotbar.skills=p.skills;battle.refreshHotbar();
 assert.equal(battle.activeSkill,original);assert.equal(grunt.binding,-1);assert.equal(battle.hotbar.bars.flat().includes(grunt),false);
 const gold=p.gold,queue=battle.friendlyQueue.queue.length,cooldown=grunt.cooldown;
 for(let i=0;i<10;i++)battle.step();
 assert.equal(grunt.cooldown,cooldown);assert.equal(p.gold,gold);assert.equal(battle.friendlyQueue.queue.length,queue);
 grunt.binding=4;battle.refreshHotbar();assert.equal(battle.hotbar.bars[0][4],grunt);
});


test('an exact-budget skill cart rolls back when its final engine purchase throws after spending',t=>{
 const p=funded(2000),before=tracked(p),method=PlayerProfile.prototype.purchase;t.after(()=>{PlayerProfile.prototype.purchase=method;});
 let stagedFinal;PlayerProfile.prototype.purchase=function(id){const result=method.call(this,id);if(id==='iceArrow'){stagedFinal={purchased:result,gold:this.gold,owned:[...this.owned]};throw Error('final staged purchase failed');}return result;};
 const cart=new ArmoryCart();cart.add(card('fireArrow'));cart.add(card('iceArrow'));
 assert.equal(cart.checkout(p,allow).code,'purchase_failed');assert.deepEqual(stagedFinal,{purchased:true,gold:0,owned:['arrow','fireArrow','iceArrow']});assert.equal(cart.size,2);unchanged(p,before);
 PlayerProfile.prototype.purchase=method;assert.equal(cart.checkout(p,allow).ok,true);assert.equal(p.gold,0);assert.equal(cart.size,0);
});
