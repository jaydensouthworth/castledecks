import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
import {captureDeck,exportDeckCode} from '../site/dist/deck-presets-model.mjs';
import {serializeProfile} from '../site/dist/engine/progression.mjs';
const source=name=>readFileSync(new URL('../site/dist/'+name,import.meta.url),'utf8');
const shell=source('game-shell.css'),legacy=source('loadout-collection.css');

// A deliberately bounded source-cascade regression, not a layout engine. It
// evaluates these sheets' class/ID/attribute selectors and media conditions for
// the three known Build scroll owners. Pixels/painting need native acceptance.
function rules(css,media=[]){
 const result=[];css=css.replace(/\/\*[\s\S]*?\*\//g,'');let start=0;
 while(start<css.length){const open=css.indexOf('{',start);if(open<0)break;let depth=1,end=open+1;for(;depth&&end<css.length;end++){if(css[end]==='{')depth++;if(css[end]==='}')depth--;}
  const head=css.slice(start,open).trim(),body=css.slice(open+1,end-1);start=end;
  if(head.startsWith('@media'))result.push(...rules(body,[...media,head.slice(6).trim()]));
  else if(!head.startsWith('@'))for(const selector of head.split(','))result.push({selector:selector.trim(),body,media});
 }return result;
}
const allRules=rules(legacy).concat(rules(shell));
function mediaMatches(query,{width,height}){return query.split(',').some(part=>[...part.matchAll(/\(([^:]+):([^)]*)\)/g)].every(([,key,value])=>{key=key.trim();value=value.trim();if(key==='orientation')return value===(height>=width?'portrait':'landscape');if(/^(min|max)-(width|height)$/.test(key)){const [edge,axis]=key.split('-'),n=parseFloat(value);return edge==='max'?({width,height}[axis]<=n):({width,height}[axis]>=n);}return false;}));}
function matches(selector,target,state){
 if(!selector.startsWith('#skillsPanel'))return false;
 if(selector.includes(':not(.game-management)'))return false;
 if(selector.includes(':not(:has(#cancelBinding:not(:disabled)))')){if(state.armed)return false;}
 else if(selector.includes(':has(#cancelBinding:not(:disabled))')&&!state.armed)return false;
 if(selector.includes(':has(.loadout-companion-section[open])')&&!state.castle)return false;
 if(selector.includes(':has(.loadout-help[open])')&&!state.help)return false;
 const tail=selector.replace(/:has\(\.loadout-(?:companion-section|help)\[open\]\)/g,'');
 return tail.endsWith(' .'+target);
}
function specificity(selector){return [(selector.match(/#[\w-]+/g)??[]).length,(selector.match(/\.[\w-]+|\[[^\]]+\]|:(?!has\(|not\()[\w-]+/g)??[]).length,0];}
function cascade(target,state){const values={},winners={};for(const [order,rule]of allRules.entries()){
 if(!rule.media.every(m=>mediaMatches(m,state))||!matches(rule.selector,target,state))continue;
 for(const field of rule.body.split(';')){const colon=field.indexOf(':');if(colon<0)continue;const property=field.slice(0,colon).trim(),value=field.slice(colon+1).trim();const props=property==='overflow'?['overflow-x','overflow-y']:[property],rank=[Number(value.includes('!important')),...specificity(rule.selector),order];
  for(const prop of props){const prior=winners[prop];if(!prior||rank.some((n,i)=>n>prior[i]&&rank.slice(0,i).every((x,j)=>x===prior[j]))){values[prop]=value;winners[prop]=rank;}}
 }}return values;}

for(const [width,height]of [[360,640],[412,780],[620,900]])test(`portrait ${width}x${height}: open castle/help and armed states retain independent bounded scroll owners`,()=>{
 for(const castle of [false,true])for(const help of [false,true])for(const armed of [false,true]){
  const state={width,height,castle,help,armed},placement=cascade('loadout-placement',state),inventory=cascade('loadout-inventory',state),cards=cascade('loadout-owned-list',state);
  assert.equal(placement['overflow-x'],'auto',JSON.stringify(state));assert.equal(placement['overflow-y'],'auto',JSON.stringify(state));assert.equal(placement['min-height'],'0');
  assert.equal(inventory['overflow-x'],'auto');assert.equal(inventory['overflow-y'],'auto');assert.equal(inventory['overscroll-behavior'],'contain');assert.equal(cards['overflow-y'],'visible');assert.equal(cards['min-height'],'0');
  if(castle||help)assert.equal(placement['overscroll-behavior'],'contain');
 }
});
test('disclosure correction only applies inside fixed portrait grid and outranks each legacy open selector without important',()=>{
 const fixed=allRules.filter(r=>r.selector.includes('.game-management .loadout-placement:has('));assert.equal(fixed.length,2);
 for(const rule of fixed){assert.deepEqual(rule.media,['(max-width:620px) and (orientation:portrait)']);assert.equal(rule.body,'overflow:auto;overscroll-behavior:contain');assert.equal(specificity(rule.selector).join(','),'1,4,0');const old=allRules.filter(r=>r.selector===rule.selector.replace('.game-management',''));assert.equal(old.length,2);for(const r of old){assert.match(r.body,/overflow:visible/);assert.equal(specificity(r.selector).join(','),'1,3,0');}}
 assert.match(shell,/grid-template-rows:minmax\(170px,\.72fr\) minmax\(235px,1fr\);overflow:hidden/);
 assert.match(legacy,/#skillsPanel button,#skillsPanel input,#skillsPanel select,#skillsPanel summary,#skillsPanel \.ability-drag-handle\{min-height:44px!important\}/);
});
test('desktop and short landscape retain their original placement scroll owner and compact70 deployment row',()=>{
 for(const [width,height]of [[1280,720],[915,360],[740,320]])for(const castle of [false,true])for(const help of [false,true]){
  const state={width,height,castle,help,armed:true},placement=cascade('loadout-placement',state);assert.equal(placement['overflow-y'],'auto');assert.equal(placement['overflow-x'],'auto');assert.equal(placement['overscroll-behavior'],undefined);assert.equal(placement.position,'static');
 }
 assert.match(shell,/\.loadout-card-facts\.loadout-unit-deployment\{display:block;grid-column:1\/-1;grid-row:5/);
});
const change=(ui,value)=>{ui.get('playerPalette').value=value;ui.dispatch(ui.get('playerPalette'),'change');};
async function ready(t){const ui=await loadGameUI(t);ui.battle.profile.gold=1500;ui.battle.profile.purchaseCastle('highwatch');ui.click('introLoadout');ui.get('loadoutCompanionSection').open=true;return ui;}
function observeFocus(t,ui){const proto=Object.getPrototypeOf(ui.get('castleEquip-highwatch')),original=proto.focus,events=[];proto.focus=function(options){events.push([this.id,options]);return original.call(this,options);};t.after(()=>proto.focus=original);return events;}
test('actual Equip rerender restores same-card selected focus with preventScroll and preserves independent pane offsets',async t=>{
 const ui=await ready(t),b=ui.battle,keep=b.goodCastle,keys=b.profile.skills.map(s=>[s,s.binding]),placement=ui.get('skillsPanel').querySelector('.loadout-placement'),cards=ui.get('ownedSkillList');placement.scrollTop=397;cards.scrollTop=81;const events=observeFocus(t,ui);
 for(const id of ['highwatch','classic','highwatch']){const old=ui.get('castleEquip-'+id);old.focus();old.click();assert.notEqual(ui.get('castleEquip-'+id),old);assert.ok(ui.document.activeElement===ui.get('castleEquip-'+id),'Equip returns focus to the same card choice');assert.deepEqual(events.at(-1),['castleEquip-'+id,{preventScroll:true}]);assert.equal(ui.document.activeElement.getAttribute('aria-pressed'),'true');assert.equal(ui.document.activeElement.disabled,false);assert.equal(placement.scrollTop,397);assert.equal(cards.scrollTop,81);assert.equal(ui.battle,b);assert.equal(b.goodCastle,keep);assert.equal(b.profile.castleId,id);assert.deepEqual(b.profile.skills.map(s=>[s,s.binding]),keys);}
 ui.document.activeElement.click();assert.equal(ui.visible('skillsPanel'),true);ui.click('castleFindCatalog');assert.equal(ui.visible('shopPanel'),true);assert.equal(ui.visible('skillsPanel'),false);
});
test('actual expanded Build Equip, preview Cancel and Apply retain keys, pane identity and preparation across resize events',async t=>{
 const ui=await ready(t),b=ui.battle,p=b.profile,placement=ui.get('skillsPanel').querySelector('.loadout-placement'),cards=ui.get('ownedSkillList'),keys=p.skills.map(s=>s.binding);placement.scrollTop=450;cards.scrollTop=90;
 ui.click('castleEquip-highwatch');const selected=serializeProfile(p);change(ui,'indigo-brass');ui.click('cancelPlayerPalette');assert.equal(serializeProfile(p),selected);change(ui,'ivory-slate');ui.click('applyPlayerPalette');assert.equal(p.paletteId,'ivory-slate');
 for(const [width,height]of [[1280,720],[360,640],[740,320],[412,780]]){ui.window.innerWidth=width;ui.window.innerHeight=height;ui.dispatch(ui.window,'resize');ui.frames();assert.equal(ui.battle,b);assert.equal(b.tick,0);assert.equal(ui.get('skillsPanel').querySelector('.loadout-placement'),placement);assert.equal(ui.get('ownedSkillList'),cards);assert.equal(placement.scrollTop,450);assert.equal(cards.scrollTop,90);assert.equal(ui.get('loadoutCompanionSection').open,true);assert.equal(p.castleId,'highwatch');assert.equal(p.paletteId,'ivory-slate');assert.deepEqual(p.skills.map(s=>s.binding),keys);}
});
test('saved-deck introduction and castle-only apply name both dedicated slots and retain no-grant/no-auto-equip language',async t=>{
 const ui=await ready(t),p=ui.battle.profile;ui.click('openDeckPresets');assert.match(ui.get('deckPresetsBody').textContent,/all three bars, plus your separate companion and castle slots/);assert.match(ui.get('deckPresetsBody').textContent,/Saving or importing a deck never equips, buys or upgrades cards/);assert.match(ui.get('deckPresetsBody').textContent,/They grant no cards, gold, ranks, companions, or campaign progress/);assert.equal(ui.get('deckApply').textContent,'Apply all 3 bars + companion + castle');
 const deck=captureDeck(p,'Castle only');deck.castle={id:'highwatch',level:1};ui.get('deckImportCode').value=exportDeckCode([deck]);ui.click('deckImportPrepare');ui.click('deckConfirmAccept');assert.equal(p.castleId,'classic');assert.equal(ui.get('deckApply').disabled,false);ui.click('deckApply');assert.equal(p.castleId,'highwatch');assert.equal(ui.battle.goodCastle.castleId,'highwatch');
 assert.match(source('deck-presets.css'),/#skillsPanel #deckApply\{min-height:44px;max-width:100%;white-space:normal;overflow-wrap:anywhere\}/);
});

test('actual optional Highwatch battle report recognizes both keeps in snapshots and recorded events',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=skirmish&sk=SK2:1KNH:oaks:standard:highwatch'});ui.click('closeWorkshop');ui.frames();const b=ui.battle;assert.equal(b.goodCastle.regionKind,'friendlyHighwatchCastle');assert.equal(b.badCastle.regionKind,'enemyHighwatchCastle');ui.click('introBattleReport');const before=ui.get('battleReportText').value;assert.match(before,/castle\/good/);assert.match(before,/castle\/bad/);assert.doesNotMatch(before,/unknown\/(?:good|bad)/);
 ui.get('battleReportRecording').checked=true;ui.dispatch(ui.get('battleReportRecording'),'change');for(const target of [b.goodCastle,b.badCastle])b.emit({type:'damage',target,actualDamage:1,source:null});ui.click('battleReportRefresh');const after=ui.get('battleReportText').value;assert.match(after,/damage.*castle\/good/);assert.match(after,/damage.*castle\/bad/);assert.equal(b.tick,0);
});
test('report castle classification stays an explicit allowlist with bounded unknown fallback',async()=>{
 const {createBattleReportRecorder,REPORT_LIMITS}=await import('../site/dist/battle-report.mjs'),r=createBattleReportRecorder();r.setEnabled(true);const untrusted='friendlyHighwatchCastle<script>PRIVATE</script>';
 for(const regionKind of ['friendlyCastle','enemyCastle','friendlyHighwatchCastle','enemyHighwatchCastle',untrusted,'otherCastle'])r.record({type:'castle-destroyed',tick:0,castle:{regionKind,team:'good',x:0,y:0,hp:0}});
 const report=r.snapshot({},{});assert.deepEqual(report.events.map(e=>e.actor.type),['castle','castle','castle','castle','unknown','unknown']);assert.ok(report.events.length<=REPORT_LIMITS.events);assert.ok(report.warnings.length<=REPORT_LIMITS.warnings);assert.doesNotMatch(JSON.stringify(report),/PRIVATE|script|otherCastle/);
});
