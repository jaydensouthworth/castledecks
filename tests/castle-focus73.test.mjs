import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
import {MemoryStorage} from './helpers/local-storage.mjs';
import {createCastleLoadoutUI} from '../site/dist/castle-loadout-ui.mjs';
import {serializeProfile} from '../site/dist/engine/progression.mjs';

const source=name=>readFileSync(new URL('../site/dist/'+name,import.meta.url),'utf8');
const controls=ui=>['classic','highwatch'].map(id=>ui.get('castleEquip-'+id));
const keys=p=>p.skills.map(s=>[s,s.id,s.binding,s.cooldown,s.xp,s.rank]);
const field=b=>JSON.stringify({tick:b.tick,terrain:b.terrain.samples,roster:b.enemies.roster,flags:[b.ownFlag.x,b.ownFlag.y,b.enemyFlag.x,b.enemyFlag.y],gold:b.profile.gold,stats:b.stats,queue:b.friendlyQueue.queue,population:b.friendlyQueue.population});
async function ready(t,{owned=true,...options}={}){
 const ui=await loadGameUI(t,options);
 // Explicit funded fixture; acquiring still uses the actual purchase rule.
 if(owned){ui.battle.profile.gold=1500;assert.equal(ui.battle.profile.purchaseCastle('highwatch'),true);assert.equal(ui.battle.profile.gold,0);}
 ui.click('introLoadout');ui.get('loadoutCompanionSection').open=true;return ui;
}
function observeFocus(t,ui){
 const proto=Object.getPrototypeOf(ui.get('castleEquip-classic')),original=proto.focus,events=[];
 proto.focus=function(options){events.push([this.id,options]);return original.call(this,options);};
 t.after(()=>proto.focus=original);return events;
}
function offsets(ui){
 const placement=ui.get('skillsPanel').querySelector('.loadout-placement'),inventory=ui.get('ownedSkillList');
 placement.scrollTop=397;placement.scrollLeft=0;inventory.scrollTop=81;
 return ()=>{assert.equal(ui.get('skillsPanel').querySelector('.loadout-placement'),placement);assert.equal(ui.get('ownedSkillList'),inventory);assert.equal(placement.scrollTop,397);assert.equal(placement.scrollLeft,0);assert.equal(inventory.scrollTop,81);};
}
function keyboardActivate(ui,key){
 // The bounded DOM harness has no browser default actions. Dispatch the real
 // key events, then the native button click they would cause. Actual keyboard
 // activation, tab order, scrolling/anchoring and visible focus need native QA.
 const button=ui.document.activeElement;
 assert.equal(button.tagName,'BUTTON');assert.equal(button.disabled,false);
 const down=ui.key('keydown',key);assert.equal(down.event.defaultPrevented,false);
 if(key==='Enter')button.click();
 const up=ui.key('keyup',key);assert.equal(up.event.defaultPrevented,false);
 if(key===' ')button.click();
}

test('prepared current choice is pressed and focusable; unowned choice remains disabled with castle-specific names',async t=>{
 const ui=await ready(t,{owned:false}),[classic,highwatch]=controls(ui),before=serializeProfile(ui.battle.profile);
 assert.equal(classic.disabled,false);assert.equal(classic.getAttribute('aria-pressed'),'true');assert.equal(classic.getAttribute('aria-label'),'Equip Classic Keep');
 assert.equal(highwatch.disabled,true);assert.equal(highwatch.getAttribute('aria-pressed'),'false');assert.equal(highwatch.getAttribute('aria-label'),'Not owned: Highwatch Keep');assert.equal(highwatch.textContent,'Not owned');
 classic.focus();keyboardActivate(ui,'Enter');keyboardActivate(ui,' ');highwatch.click();highwatch.onclick();
 assert.equal(ui.get('castleEquip-classic'),classic);assert.equal(ui.document.activeElement,classic);assert.equal(serializeProfile(ui.battle.profile),before);
});

test('actual equip focuses the same card choice with preventScroll and retains independent pane offsets',async t=>{
 const ui=await ready(t),b=ui.battle,keep=b.goodCastle,before=field(b),bindings=keys(b.profile),checkOffsets=offsets(ui),events=observeFocus(t,ui);
 for(const [id,key]of [['highwatch','Enter'],['classic',' '],['highwatch','Enter']]){
  const old=ui.get('castleEquip-'+id),name=old.getAttribute('aria-label');old.focus();keyboardActivate(ui,key);
  const selected=ui.get('castleEquip-'+id);assert.ok(selected!==old);assert.ok(selected.textContent.includes(name));assert.ok(old.textContent.includes(name));assert.equal(selected.querySelector('span').getAttribute('aria-hidden'),'true');assert.ok(ui.document.activeElement===selected);assert.equal(selected.disabled,false);assert.equal(selected.getAttribute('aria-pressed'),'true');assert.equal(selected.getAttribute('aria-label'),name);
  assert.deepEqual(events.at(-1),[selected.id,{preventScroll:true}]);assert.equal(controls(ui).filter(n=>n.getAttribute('aria-pressed')==='true').length,1);checkOffsets();
  assert.equal(ui.battle,b);assert.equal(b.goodCastle,keep);assert.equal(b.profile.castleId,id);assert.equal(keep.castleId,id);assert.equal(field(b),before);assert.deepEqual(keys(b.profile),bindings);
 }
 assert.equal(ui.visible('shopPanel'),false);assert.equal(ui.visible('skillsPanel'),true);
});

test('repeated Enter/Space and stale reactivation of the selected card do not rerender, refocus, announce or checkpoint',async t=>{
 const storage=new MemoryStorage(),ui=await ready(t,{storage}),stale=ui.get('castleEquip-highwatch').onclick;
 ui.get('castleEquip-highwatch').focus();keyboardActivate(ui,'Enter');await ui.settle();
 const selected=ui.get('castleEquip-highwatch'),status=ui.get('castleLoadoutStatus'),statusText=status.textContent,b=ui.battle,save=serializeProfile(b.profile),before=field(b),bindings=keys(b.profile),writes=storage.writes,events=observeFocus(t,ui),checkOffsets=offsets(ui);
 for(const key of ['Enter',' ','Enter',' ',' '])keyboardActivate(ui,key);
 stale();stale();await ui.settle();
 assert.ok(ui.get('castleEquip-highwatch')===selected);assert.ok(ui.document.activeElement===selected);assert.ok(ui.get('castleLoadoutStatus')===status);assert.equal(status.textContent,statusText);assert.deepEqual(events,[]);assert.equal(storage.writes,writes);checkOffsets();
 assert.equal(serializeProfile(b.profile),save);assert.equal(field(b),before);assert.deepEqual(keys(b.profile),bindings);
});

test('live paused current and alternative remain disabled; stale handlers cannot equip or move focus',async t=>{
 const ui=await ready(t),stale=controls(ui).map(n=>n.onclick);ui.click('closeSkills');ui.click('start');ui.frames(2);ui.click('battlePause');ui.click('pauseSkills');
 const b=ui.battle,before=field(b),save=serializeProfile(b.profile),bindings=keys(b.profile),buttons=controls(ui),active=ui.document.activeElement,checkOffsets=offsets(ui),events=observeFocus(t,ui);
 for(const button of buttons){assert.equal(button.disabled,true);button.click();button.onclick();}for(const handler of stale)handler();
 assert.equal(buttons[0].getAttribute('aria-pressed'),'true');assert.equal(buttons[1].getAttribute('aria-pressed'),'false');assert.ok(controls(ui).every((button,i)=>button===buttons[i]));assert.ok(ui.document.activeElement===active);assert.deepEqual(events,[]);checkOffsets();
 assert.equal(field(b),before);assert.equal(serializeProfile(b.profile),save);assert.deepEqual(keys(b.profile),bindings);
});

test('settled campaign choice stays focusable, applies only to the next field and repeated activation is inert',async t=>{
 const ui=await ready(t);ui.click('closeSkills');ui.click('start');
 // Deliberate defeat fixture exercises the real settlement/UI path, not balance.
 ui.battle.hero.takeDamage(ui.battle.hero.hp);ui.frames(105);assert.equal(ui.battle.summary.outcome,'defeat');ui.click('endingLoadout');
 const b=ui.battle,keep=b.goodCastle,summary=JSON.stringify(b.summary),hp=keep.hp,before=field(b),bindings=keys(b.profile),checkOffsets=offsets(ui);
 assert.equal(ui.get('castleEquip-classic').disabled,false);ui.get('castleEquip-highwatch').focus();keyboardActivate(ui,' ');
 const selected=ui.get('castleEquip-highwatch');assert.equal(selected.getAttribute('title'),'Next castle');assert.equal(selected.getAttribute('aria-label'),'Equip Highwatch Keep');assert.match(selected.textContent,/Equip Highwatch Keep.*✓/);assert.equal(selected.disabled,false);assert.equal(selected.getAttribute('aria-pressed'),'true');assert.ok(ui.document.activeElement===selected);
 keyboardActivate(ui,'Enter');keyboardActivate(ui,' ');assert.ok(ui.get('castleEquip-highwatch')===selected);checkOffsets();
 assert.equal(b.profile.castleId,'highwatch');assert.equal(b.goodCastle,keep);assert.equal(keep.castleId,'classic');assert.equal(keep.hp,hp);assert.equal(JSON.stringify(b.summary),summary);assert.equal(field(b),before);assert.deepEqual(keys(b.profile),bindings);
});

test('settled skirmish host rejects retained chooser handlers and read-only rendering disables all choices',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=skirmish&sk=SK2:1KNH:oaks:standard:highwatch'});ui.click('closeWorkshop');ui.frames();ui.click('introLoadout');const stale=controls(ui).map(n=>n.onclick);ui.click('closeSkills');ui.click('start');ui.battle.goodCastle.takeDamage(ui.battle.goodCastle.hp);ui.frames(105);assert.equal(ui.battle.summary.outcome,'defeat');ui.click('endingLoadout');
 // Results opens the read-only Saved Decks surface, not the chooser. Retained
 // chooser handlers must still reject; render the component against that real
 // settled profile separately to check the explicit readOnly presentation.
 const profile=ui.battle.profile,before=serializeProfile(profile),active=ui.document.activeElement,events=observeFocus(t,ui);
 for(const handler of stale)handler();assert.ok(ui.document.activeElement===active);assert.deepEqual(events,[]);assert.equal(serializeProfile(profile),before);
 const root=ui.document.createElement('section');let calls=0;
 const chooser=createCastleLoadoutUI({root,getState:()=>({profile,started:true,summary:true,readOnly:true}),onEquip:()=>{calls++;},onPaletteApply:()=>{}});chooser.render();
 const buttons=['classic','highwatch'].map(id=>root.querySelector('#castleEquip-'+id));assert.equal(buttons.filter(n=>n.getAttribute('aria-pressed')==='true').length,1);
 for(const button of buttons){assert.equal(button.disabled,true);button.click();button.onclick();}assert.equal(calls,0);assert.equal(serializeProfile(profile),before);assert.match(root.querySelector('#castleLoadoutStatus').textContent,/complete.*another field/);
});

test('chooser refuses reselect, unowned, live, read-only and stale-profile calls before invoking its host',async t=>{
 const game=await ready(t),root=game.document.createElement('section'),profile=game.battle.profile;
 let state={profile,started:false,summary:false,readOnly:false},calls=0;
 const ui=createCastleLoadoutUI({root,getState:()=>state,onEquip:()=>{calls++;return {ok:false,message:'Rejected by host'};},onPaletteApply:()=>({ok:false})});ui.render();
 const current=root.querySelector('#castleEquip-classic'),candidate=root.querySelector('#castleEquip-highwatch'),handler=candidate.onclick;
 current.onclick();assert.equal(calls,0);assert.equal(root.querySelector('#castleEquip-classic'),current);
 for(const overrides of [{started:true},{readOnly:true},{profile:{...profile}}]){state={profile,started:false,summary:false,readOnly:false,...overrides};handler();assert.equal(calls,0);}
 state={profile,started:false,summary:false,readOnly:false};profile.castleLevels.delete('highwatch');handler();assert.equal(calls,0);
 profile.castleLevels.set('highwatch',1);handler();assert.equal(calls,1);assert.equal(profile.castleId,'classic');assert.equal(root.querySelector('#castleLoadoutStatus').textContent,'Rejected by host');assert.equal(root.querySelector('#castleEquip-highwatch').getAttribute('aria-pressed'),'false');
});

test('chooser keeps native button semantics, 44px controls and same-card preventScroll without key remapping',()=>{
 const js=source('castle-loadout-ui.mjs'),css=source('castle-loadout.css');
 assert.match(js,/<button id="castleEquip-\$\{item\.id\}"[^>]*aria-pressed="\$\{current\}"/);assert.match(js,/aria-label="\$\{state\.missing\?'Not owned: ':'Equip '\}\$\{esc\(item\.name\)\}"/);assert.match(js,/<span aria-hidden="true">✓<\/span>/);
 assert.match(js,/\$\('castleEquip-'\+item\.id\)\??\.focus\?\.\(\{preventScroll:true\}\)/);assert.doesNotMatch(js,/\$\('castleFindCatalog'\)\.focus|scrollIntoView|\.scrollTop\s*=|onkeydown|onkeyup|tabindex|role="radio"/);
 assert.match(css,/#castleLoadout button,#castleLoadout select\{min-height:44px;max-width:100%;white-space:normal\}/);
});
