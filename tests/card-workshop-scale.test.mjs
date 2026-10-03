import test from 'node:test';
import assert from 'node:assert/strict';
import {createArmoryCatalogUI} from '../site/dist/armory-catalog.mjs';
import {createLoadoutCollectionUI} from '../site/dist/loadout-collection.mjs';
import {buildArmoryRecords} from '../site/dist/armory-catalog-data.mjs';
import {createArmorySnapshot,armoryCardState} from '../site/dist/armory-catalog-model.mjs';
import {SKILLS} from '../site/dist/engine/progression.mjs';
import {COMPANIONS} from '../site/dist/engine/recruitment.mjs';
import {ActionBarLayout} from '../site/dist/engine/action-bar-layout.mjs';
import {placeLoadoutAbility} from '../site/dist/loadout-ui-model.mjs';
import {loadGameUI} from './helpers/game-ui-harness.mjs';

// Test-only copies exercise current supported anatomy, never shipping inventory.
const base=buildArmoryRecords(SKILLS,COMPANIONS,{});
const seeds=['fireArrow','iceWave','grunt','priest','air','gorath'];
const mechanics=['Fire damage and a lingering burn.','Waves of slowing frost sweep outward.','Four foot soldiers, paid squad deployment.','Two healers restore friendly living units.','Flying ranged support.','Separate companion slot with Earthshatter.'];
function fixture(){
 const records=Array.from({length:300},(_,i)=>({...base.find(x=>x.id===seeds[i%6]),id:`scale-${String(i).padStart(3,'0')}`,name:`${String(i).padStart(3,'0')} ${base.find(x=>x.id===seeds[i%6]).name} of the Very Long Northern Castle Watch and Ancient Valley`,description:mechanics[i%6],storefront:true,price:(i+1)*10}));
 const ownedRecords=records.filter((_,i)=>i%5!==4),skills=ownedRecords.filter(x=>x.kind==='skill').map((x,i)=>({id:x.id,rank:i%10,binding:i<30?i:-1,cooldown:i%9,xp:17,threshold:100}));
 const profile={gold:500,rank:3,difficulty:'medium',skills,owned:new Set(skills.map(x=>x.id)),companionOwned:new Set(ownedRecords.filter(x=>x.kind==='companion').map(x=>x.id)),companionId:null};
 return {records,profile};
}
const bindingLabel=n=>n<0?'Reserve':`Bar ${Math.floor(n/10)+1}, key ${(n%10+1)%10}`;

test('300-card market stays bounded through long names, mechanics search, type/status/sort/page and inspection round trips',async t=>{
 const ui=await loadGameUI(t),root=ui.document.createElement('div'),{records,profile}=fixture();let blocked=null,purchases=0;
 const snapshot=()=>({...createArmorySnapshot(profile),purchaseBlockedReason:blocked});
 const view=createArmoryCatalogUI({root,records,getSnapshot:snapshot,onPurchase:()=>{purchases++;return false;},onArrange:()=>{},bindingLabel});t.after(()=>view.dispose());
 view.refresh();root.querySelector('#shopCatalogTab').click();assert.equal(view.diagnostics.resultCount,300);
 const bounded=()=>{assert.ok(root.querySelector('#shopGrid').querySelectorAll('article').length<=12);assert.ok(root.querySelectorAll('article').length<=12);};
 const all=new Set();for(let page=0;page<25;page++){view.model.setView({page});view.refresh();bounded();for(const item of view.model.query(snapshot()).items)all.add(item.id);}assert.equal(all.size,300);
 for(const category of ['arrows','waves','army','companions']){view.model.setView({category,query:'',status:'all',sort:'price-desc'});view.refresh();const result=view.model.query(snapshot());assert.ok(result.total>0);assert.ok(result.items.every(x=>x.category===category));assert.ok(result.items.every((x,i,a)=>!i||a[i-1].price>=x.price));bounded();}
 view.model.setView({category:'all',query:'lingering burn',status:'all',sort:'name'});view.refresh();assert.equal(view.diagnostics.resultCount,50);assert.ok(view.model.query(snapshot()).items.every(x=>x.category==='arrows'));
 view.model.setView({query:'',category:'army',status:'owned',sort:'name'});view.model.setView({page:2});view.refresh();const saved={...view.model.view},chosen=view.model.query(snapshot()).items[3];root.querySelector('#shopCardScroll').scrollTop=153;
 root.querySelector('#inspect-'+chosen.id).click();assert.equal(view.state.drawerOpen,true);assert.match(root.querySelector('#shopDetails').textContent,/Very Long Northern Castle Watch/);assert.deepEqual(view.model.view,saved);view.back();assert.equal(view.state.drawerOpen,false);assert.deepEqual(view.model.view,saved);assert.equal(root.querySelector('#shopCardScroll').scrollTop,153);assert.equal(ui.document.activeElement.id,'inspect-'+chosen.id);bounded();
 view.model.setView({category:'all',status:'unowned',query:''});view.refresh();assert.equal(view.diagnostics.resultCount,60);assert.ok(view.model.query(snapshot()).items.every(x=>!armoryCardState(x,snapshot()).owned));
 view.model.setView({status:'unaffordable'});view.refresh();assert.ok(view.diagnostics.resultCount>0);assert.ok(view.model.query(snapshot()).items.every(x=>!armoryCardState(x,snapshot()).eligible));
 // The real product has no per-card progression locks. Exercise its actual
 // transaction lock rather than inventing a synthetic unlock mechanism.
 blocked='Finish this battle before acquiring cards';view.model.setView({status:'unowned',sort:'price'});view.refresh();for(const item of view.model.query(snapshot()).items){assert.equal(root.querySelector('#buy-'+item.id).disabled,true);assert.equal(armoryCardState(item,snapshot()).eligible,false);}assert.equal(purchases,0);
});

test('300-card market previews replacement and cancellation without spending or losing browse context',async t=>{
 const ui=await loadGameUI(t),root=ui.document.createElement('div'),{records,profile}=fixture(),layout=new ActionBarLayout(profile.skills);let applied=0;
 const view=createArmoryCatalogUI({root,records,getSnapshot:()=>createArmorySnapshot(profile),onPurchase:()=>false,onArrange:()=>{},bindingLabel,onEquip:(item,index)=>{applied++;placeLoadoutAbility(layout,layout.dragIcons.find(w=>w.skill.id===item.id),index);return true;}});t.after(()=>view.dispose());view.refresh();root.querySelector('#shopCollectionTab').click();
 const reserve=layout.dragIcons.find(w=>w.binding<0),old=layout.slots[0].holding,gold=profile.gold,count=profile.owned.size,cd=reserve.skill.cooldown;
 view.model.setView({sort:'name',status:'reserve'});view.model.setView({page:3});view.refresh();const context={...view.model.view};view.select(reserve.skill.id);root.querySelector('[data-detail-tab="equip"]').click();root.querySelector('#shop-slot-0').click();assert.match(root.querySelector('#shopEquipPreview').textContent,/replace|reserve/i);root.querySelector('#shopEquipCancel').click();assert.equal(applied,0);assert.equal(old.binding,0);assert.equal(reserve.binding,-1);
 root.querySelector('#shop-slot-0').click();root.querySelector('#shopEquipConfirm').click();assert.equal(applied,1);assert.equal(reserve.binding,0);assert.equal(old.binding,-1);assert.equal(profile.gold,gold);assert.equal(profile.owned.size,count);assert.equal(reserve.skill.cooldown,cd);view.back();assert.deepEqual(view.model.view,context);assert.ok(view.diagnostics.cardCount<=12);
});

test('300-record owned workspace retains visible deck, bounded cards and inspection/filter state',async t=>{
 const ui=await loadGameUI(t),root=ui.get('skillsPanel'),{records,profile}=fixture(),layout=new ActionBarLayout(profile.skills);let selected=null,armed=false,bar=0,view;
 view=createLoadoutCollectionUI({root,records,getState:()=>({layout,profile,selected,armed,bar}),icon:()=>'',bindingLabel,onSelect:w=>{selected=w;armed=true;view.render();},onMove:index=>{placeLoadoutAbility(layout,selected,index);armed=false;view.render();},onBar:n=>{bar=n;view.render();}});t.after(()=>view.dispose());view.render();
 assert.equal(root.querySelector('#bindingGrid').querySelectorAll('button').length,10);assert.equal(root.querySelector('#ownedSkillList').querySelectorAll('article').length,12);
 view.model.setView({query:'friendly living',type:'army',sort:'name'});view.render();assert.equal(view.model.query(layout.dragIcons).total,40);view.model.setView({page:2});view.render();const context={...view.model.view},chosen=view.model.query(layout.dragIcons).items[1].item;root.querySelector('#ownedSkillList').scrollTop=81;
 root.querySelector('#loadout-inspect-'+chosen.id).click();assert.match(root.querySelector('#selectedSkillDescription').textContent,/friendly living/);assert.equal(root.querySelector('#bindingGrid').querySelectorAll('button').length,10);view.back();assert.deepEqual(view.model.view,context);assert.equal(root.querySelector('#ownedSkillList').scrollTop,81);assert.equal(ui.document.activeElement.id,'loadout-inspect-'+chosen.id);
 const totalPages=view.model.query(layout.dragIcons).pageCount;for(let page=0;page<totalPages;page++){view.model.setView({page});view.render();assert.ok(root.querySelector('#ownedSkillList').querySelectorAll('article').length<=12);assert.equal(root.querySelector('#bindingGrid').querySelectorAll('button').length,10);}
});

test('grounded inspector rule search is available without drowning out exact subject and trait searches',async()=>{
 const {ArmoryCatalog}=await import('../site/dist/armory-catalog-model.mjs');const {LoadoutCollection}=await import('../site/dist/loadout-collection-model.mjs');
 const {profile}=fixture(),snapshot=createArmorySnapshot(profile),market=new ArmoryCatalog(base),collection=new LoadoutCollection(base),wrappers=base.filter(x=>x.kind==='skill').map(item=>({skill:{id:item.id,rank:1},binding:-1}));
 for(const model of [market,collection]){model.setView({query:'purging poisoned'});const result=model.query(model===market?snapshot:wrappers);assert.deepEqual(result.items.map(x=>x.item?.id??x.id),['priest']);model.setView({query:'frost duration'});assert.ok(model.query(model===market?snapshot:wrappers).items.some(x=>(x.item?.id??x.id)==='iceArrow'));}
 market.setView({category:'arrows',query:'fire'});assert.deepEqual(market.query(snapshot).items.map(x=>x.id),['fireArrow','meteorArrow']);
});

test('real composition preview remains bounded to one ten-key bar and survives browsing refresh',async t=>{
 const {createDeckComposition,deckComposition}=await import('../site/dist/deck-composition.mjs');const ui=await loadGameUI(t),root=ui.document.createElement('aside'),{records,profile}=fixture(),chosen=[];
 const summary=deckComposition(records,createArmorySnapshot(profile));assert.equal(summary.equipped.length,30);assert.equal(Object.values(summary.counts).reduce((a,b)=>a+b),30);assert.equal(summary.reserve,profile.skills.length-30);
 const view=createDeckComposition({root,records,getSnapshot:()=>createArmorySnapshot(profile),onArrange:item=>chosen.push(item.id)});t.after(()=>view.dispose());view.render();assert.equal(root.querySelectorAll('[data-deck-preview-slot]').length,10);assert.match(root.textContent,/30\/30 equipped/);
 root.querySelector('#deck-preview-bar-2').click();assert.equal(root.querySelectorAll('[data-deck-preview-slot]').length,10);assert.ok(root.querySelector('#deck-preview-20'));root.querySelector('#deck-preview-20').click();assert.deepEqual(chosen,[profile.skills.find(x=>x.binding===20).id]);
 const initial=root.querySelector('#deck-preview-20');view.render();assert.equal(root.querySelector('#deck-preview-20'),initial);assert.equal(root.querySelector('#deck-preview-bar-2').getAttribute('aria-pressed'),'true');
});
