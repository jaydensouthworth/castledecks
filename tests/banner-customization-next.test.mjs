import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {modalFocusCandidates} from '../site/dist/modal-focus.mjs';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
import {MemoryStorage,TestLocks} from './helpers/local-storage.mjs';
import {PlayerProfile,serializeProfile,restoreProfile} from '../site/dist/engine/progression.mjs';
import {CampaignProfiles} from '../site/dist/engine/profile-manager.mjs';
import {applyBannerIdentity,bannerIdentity,validateBannerDraft,BANNER_NAME_LIMIT} from '../site/dist/banner-customization-model.mjs';
import {playerBannerSvg} from '../site/dist/player-banner-render.mjs';
import {PLAYER_PALETTE_IDS,FRIENDLY_HERALDRY_CUE,resolvePlayerPalette} from '../site/dist/player-palette.mjs';
import {createLocalCampaignStore,createLocalCheckpointEnvelope,parseLocalCheckpoint} from '../site/dist/local-campaign-store.mjs';
import {createGameSaveCodecs} from '../site/dist/cloud-save-codecs.mjs';
import {restoreExpeditions,ExpeditionProfiles} from '../site/dist/expedition-model.mjs';
import {parseDeckCode,captureDeck} from '../site/dist/deck-presets-model.mjs';
const input=(ui,name)=>{ui.get('bannerName').value=name;ui.dispatch(ui.get('bannerName'),'input');};
const palette=(ui,id)=>ui.get('hallBannerEditor').querySelector(`[data-banner-palette="${id}"]`).click();
const draft=(ui,{name='Dawn Guard',color='indigo-brass'}={})=>{ui.click('hallCustomizeBanner');input(ui,name);palette(ui,color);};
const choose=(ui,id)=>ui.get('hubDestinations').querySelector(`[data-hub-destination="${id}"]`).click();
const open=(ui,id)=>{choose(ui,id);ui.click('start');if(ui.visible('switchSessionConfirm'))ui.click('confirmSessionSwitch');if(ui.visible('skirmishPanel'))ui.click('closeWorkshop');ui.frames();};
const field=b=>JSON.stringify({tick:b.tick,terrain:b.terrain.samples,roster:b.enemies.roster,flags:[b.ownFlag.x,b.ownFlag.y,b.enemyFlag.x,b.enemyFlag.y],stats:b.stats,queue:b.friendlyQueue.queue,population:b.friendlyQueue.population,hero:[b.hero.hp,b.hero.x,b.hero.y],keep:[b.goodCastle.hp,b.goodCastle.maxHp,b.goodCastle.castleId]});

test('Hall exposes named banner and a complete customization surface without opening Deck',async t=>{
 const ui=await loadGameUI(t);assert.equal(ui.get('hallBannerName').textContent,'Castledecks');assert.match(ui.get('hallBannerColors').textContent,/Azure · Ally double-chevron/);
 ui.click('hallCustomizeBanner');assert.equal(ui.visible('hallBannerEditor'),true);assert.equal(ui.visible('skillsPanel'),false);assert.equal(ui.get('intro').getAttribute('data-banner-editing'),'true');assert.equal(ui.get('hallHome').inert,true);assert.equal(ui.document.activeElement,ui.get('bannerName'));assert.equal(ui.get('bannerApply').disabled,true);assert.equal(ui.get('hallBannerEditor').querySelectorAll('[data-banner-palette]').length,3);
});
test('name and every palette preview are draft-only; all preview contexts refresh without saving or requests',async t=>{
 const storage=new MemoryStorage();let requests=0;const ui=await loadGameUI(t,{storage,accounts:true,fetch:async()=>{requests++;throw new Error('No requests expected');}}),p=ui.battle.profile,before=serializeProfile(p),world=field(ui.battle),saved=[...storage.data],writes=storage.writes;
 draft(ui);for(const id of PLAYER_PALETTE_IDS){palette(ui,id);assert.equal(serializeProfile(p),before);assert.equal(field(ui.battle),world);assert.equal(ui.get('bannerPreviewName').textContent,'Dawn Guard');assert.equal(ui.get('bannerPreviewColors').textContent,resolvePlayerPalette(id).name);assert.equal(ui.get('bannerPreviewKeep').querySelector('svg').getAttribute('data-castle-preview'),p.castleId);}
 await ui.settle();assert.deepEqual([...storage.data],saved);assert.equal(storage.writes,writes);assert.equal(requests,0);
});
for(const action of ['bannerCancel','bannerBack','escape'])test(`${action} discards both drafts, restores home focus and scroll, and reopening starts clean`,async t=>{
 const ui=await loadGameUI(t),p=ui.battle.profile,before=serializeProfile(p),scroll=ui.get('intro').querySelector('.hall-orders-scroll');scroll.scrollTop=251;draft(ui);
 if(action==='escape')ui.key('keydown','Escape');else ui.click(action);
 assert.equal(ui.visible('hallBannerEditor'),false);assert.equal(ui.get('hallHome').inert,false);assert.equal(scroll.scrollTop,251);assert.equal(ui.document.activeElement,ui.get('hallCustomizeBanner'));assert.equal(serializeProfile(p),before);assert.match(ui.get('hallBannerStatus').textContent,/cancelled/);ui.click('hallCustomizeBanner');assert.equal(ui.get('bannerName').value,p.name);assert.equal(ui.get('bannerPreviewColors').textContent,'Azure');
});
test('Apply changes exactly existing name and palette once and retains battle, decks, stats, gold and focus',async t=>{
 const ui=await loadGameUI(t),b=ui.battle,p=b.profile,before=JSON.parse(serializeProfile(p)),world=field(b),deck=captureDeck(p,'Kept');draft(ui);const apply=ui.get('bannerApply').onclick;ui.click('bannerApply');apply();
 assert.equal(ui.battle,b);assert.equal(p.name,'Dawn Guard');assert.equal(p.paletteId,'indigo-brass');assert.equal(ui.visible('hallBannerEditor'),false);assert.equal(ui.document.activeElement,ui.get('hallCustomizeBanner'));assert.equal(ui.get('hallBannerName').textContent,p.name);assert.doesNotMatch(ui.get('hubSessionTitle').textContent,/Dawn Guard/);assert.match(ui.get('hubSessionTitle').title,/Dawn Guard/);assert.match(ui.get('hallCurrentBanner').textContent,/Dawn Guard/);assert.match(ui.get('hallBannerStatus').textContent,/applied to this profile/);assert.equal(field(b),world);assert.deepEqual(captureDeck(p,'Kept'),deck);
 const after=JSON.parse(serializeProfile(p));after.name=before.name;after.appearance=before.appearance;assert.deepEqual(after,before);
 ui.click('introLoadout');assert.equal(ui.get('playerPalette').value,'indigo-brass');
});
test('invalid name blocks Apply atomically; trimming commits only on Apply and never truncates imported names',async t=>{
 const ui=await loadGameUI(t),p=ui.battle.profile,before=serializeProfile(p);draft(ui);
 for(const name of ['   ','x'.repeat(BANNER_NAME_LIMIT+1),'two\nlines','bad\u202ename','\ud800']){input(ui,name);assert.equal(ui.get('bannerApply').disabled,true);ui.get('bannerApply').onclick();assert.equal(serializeProfile(p),before);assert.match(ui.get('bannerNameError').textContent,/1–32 characters/);}
 input(ui,'  Gate Wardens  ');assert.equal(p.name,'Castledecks');ui.click('bannerApply');assert.equal(p.name,'Gate Wardens');
 p.name='A preserved imported banner with a name longer than thirty-two characters';ui.click('hallCustomizeBanner');assert.equal(ui.get('bannerName').value,p.name);palette(ui,'ivory-slate');ui.click('bannerApply');assert.equal(p.name,'A preserved imported banner with a name longer than thirty-two characters');
});
test('reverted draft stays no-op and stale handlers cannot apply the next preview',async t=>{
 const ui=await loadGameUI(t),p=ui.battle.profile,before=serializeProfile(p);draft(ui);const stale=ui.get('bannerApply').onclick;ui.click('bannerCancel');draft(ui,{name:'Second',color:'ivory-slate'});stale();assert.equal(serializeProfile(p),before);input(ui,p.name);palette(ui,p.paletteId);assert.equal(ui.get('bannerApply').disabled,true);ui.get('bannerApply').onclick();assert.equal(serializeProfile(p),before);
});
for(const route of ['hallCampaignsTab','hallPracticeTab','hallHomeTab','shell-intro-hall','shell-intro-deck','shell-intro-map','shell-intro-army','shell-intro-settings','shell-intro-profiles','shell-intro-vault'])test(`navigation via ${route} discards preview and stale Apply`,async t=>{
 const ui=await loadGameUI(t),p=ui.battle.profile,before=serializeProfile(p);draft(ui);const apply=ui.get('bannerApply').onclick;ui.click(route);apply();assert.equal(ui.visible('hallBannerEditor'),false);assert.equal(ui.get('intro').getAttribute('data-banner-editing'),null);assert.equal(serializeProfile(p),before);
});
for(const event of ['pagehide','popstate'])test(`${event} drops uncommitted preview`,async t=>{
 const ui=await loadGameUI(t),before=serializeProfile(ui.battle.profile);draft(ui);const apply=ui.get('bannerApply').onclick;ui.dispatch(ui.window,event);apply();assert.equal(ui.visible('hallBannerEditor'),false);assert.equal(serializeProfile(ui.battle.profile),before);
});
test('session switch discards drafts and maintains separate applied identities',async t=>{
 const ui=await loadGameUI(t),campaign=ui.battle;draft(ui);ui.click('bannerApply');draft(ui,{name:'Never commit'});const apply=ui.get('bannerApply').onclick;open(ui,'expedition');apply();assert.notEqual(ui.battle,campaign);assert.notEqual(ui.battle.profile.name,'Never commit');assert.equal(campaign.profile.name,'Dawn Guard');assert.equal(ui.visible('hallBannerEditor'),false);assert.match(ui.get('hallBannerScope').textContent,/Export your charter/);draft(ui,{name:'Road Guard',color:'ivory-slate'});ui.click('bannerApply');open(ui,'campaign');assert.equal(ui.battle,campaign);assert.equal(ui.get('hallBannerName').textContent,'Dawn Guard');assert.equal(campaign.profile.paletteId,'indigo-brass');
});
test('profile replacement discards drafts and an old Apply cannot affect either profile',async t=>{
 const ui=await loadGameUI(t),old=ui.battle.profile;draft(ui);const apply=ui.get('bannerApply').onclick;ui.click('introProfiles');ui.get('newProfileName').value='Second';ui.click('createProfile');apply();assert.equal(old.name,'Castledecks');assert.equal(old.paletteId,'azure');assert.equal(ui.battle.profile.name,'Second');assert.equal(ui.battle.profile.paletteId,'azure');assert.equal(ui.visible('hallBannerEditor'),false);
});
test('same-object external edits invalidate draft rather than overwriting newer identity',async t=>{
 const ui=await loadGameUI(t);draft(ui);const apply=ui.get('bannerApply').onclick;ui.battle.profile.name='Newer name';apply();assert.equal(ui.battle.profile.name,'Newer name');assert.equal(ui.battle.profile.paletteId,'azure');assert.equal(ui.visible('hallBannerEditor'),false);
});
test('Start discards preview and paused-field Apply is cosmetic without advancing or checkpointing battle',async t=>{
 const storage=new MemoryStorage(),ui=await loadGameUI(t,{storage});draft(ui);const stale=ui.get('bannerApply').onclick;ui.click('start');stale();ui.frames(4);assert.equal(ui.battle.profile.name,'Castledecks');ui.click('battlePause');ui.click('pauseLobby');await ui.settle();const b=ui.battle,world=field(b),saved=[...storage.data];draft(ui);assert.match(ui.get('bannerScopeNote').textContent,/Paused-field changes/);ui.click('bannerApply');await ui.settle();assert.equal(field(b),world);assert.equal(b.paused,true);assert.equal(b.profile.name,'Dawn Guard');assert.deepEqual([...storage.data],saved);
});
test('Apply uses existing local checkpoint and cloud codec, then synthetic reload restores both fields',async t=>{
 const storage=new MemoryStorage(),ui=await loadGameUI(t,{storage}),store=createLocalCampaignStore({storage,locks:new TestLocks()});draft(ui);ui.click('bannerApply');await ui.settle();const saved=store.read(1).latest;assert.equal(saved.manager.active.name,'Dawn Guard');assert.equal(saved.manager.active.paletteId,'indigo-brass');
 const codecs=createGameSaveCodecs({parseLocalCheckpoint,restoreExpeditions,parseDeckCode}),payload=JSON.stringify(createLocalCheckpointEnvelope(saved.payload)),parsed=codecs.validate('crownroad',payload);assert.equal(parsed.manager.active.name,'Dawn Guard');assert.equal(parsed.manager.active.paletteId,'indigo-brass');assert.equal(parsed.schema,'castledecks-local-checkpoint-3');
 ui.click('hallOpenSaves');ui.get('localSlots').querySelector('[data-local-continue="1"]').click();await ui.settle();ui.click('localConfirmAccept');await ui.settle();assert.equal(ui.battle.profile.name,'Dawn Guard');assert.equal(ui.battle.profile.paletteId,'indigo-brass');assert.equal(ui.get('hallBannerName').textContent,'Dawn Guard');
});
test('charter existing export/restore codec retains name and palette without extra appearance fields',()=>{
 const profiles=new ExpeditionProfiles(),p=profiles.active;applyBannerIdentity(p,{name:'Road Guard',paletteId:'ivory-slate'},bannerIdentity(p));const restored=restoreExpeditions(profiles.exportBundle());assert.equal(restored.active.name,'Road Guard');assert.equal(restored.active.paletteId,'ivory-slate');const saved=JSON.parse(serializeProfile(p));assert.deepEqual(Object.keys(saved.appearance),['palette']);assert.equal(restoreProfile(serializeProfile(p)).name,p.name);
});
test('read-only completed practice cannot start or commit customization',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=skirmish'});if(ui.visible('skirmishPanel'))ui.click('closeWorkshop');draft(ui);const apply=ui.get('bannerApply').onclick,before=serializeProfile(ui.battle.profile);ui.battle.summary={outcome:'victory'};apply();assert.equal(serializeProfile(ui.battle.profile),before);ui.click('hallHomeTab');ui.click('hallCustomizeBanner');assert.equal(ui.visible('hallBannerEditor'),false);
});
test('model rejects unsupported palette and read-only fields before any identity mutation',()=>{
 const p=new PlayerProfile('Keeper'),before=serializeProfile(p);assert.throws(()=>applyBannerIdentity(p,{name:'Changed',paletteId:'enemy'},bannerIdentity(p)));assert.equal(serializeProfile(p),before);Object.defineProperty(p,'paletteId',{writable:false});assert.equal(applyBannerIdentity(p,{name:'Changed',paletteId:'ivory-slate'},bannerIdentity(p)).ok,false);assert.equal(p.name,'Keeper');assert.equal(p.paletteId,'azure');
});
test('banner art uses fixed ally contrast and distinct curated cloth without user markup or altered cue tokens',()=>{
 const cue=JSON.stringify(FRIENDLY_HERALDRY_CUE);for(const id of PLAYER_PALETTE_IDS){const svg=playerBannerSvg(id),p=resolvePlayerPalette(id);assert.match(svg,/Allied double-chevron banner/);assert.ok(svg.includes(p.tokens.fortress.cloth));assert.ok(svg.includes(FRIENDLY_HERALDRY_CUE.outline));assert.ok(svg.includes(FRIENDLY_HERALDRY_CUE.ink));assert.doesNotMatch(svg,/id=|script|url\(|href=|animation|#914654/);}assert.equal(JSON.stringify(FRIENDLY_HERALDRY_CUE),cue);assert.throws(()=>playerBannerSvg('<img>'));
});
test('customization CSS keeps common frame geometry and one Hall scroll owner with accessible targets',async()=>{
 const css=await readFile(new URL('../site/dist/banner-customization.css',import.meta.url),'utf8');assert.doesNotMatch(css,/#managementFrame\s*\{|\.game-shell-nav|\.panel-head|overflow:auto|text-overflow:ellipsis|line-clamp|transform:scale|font-size:(?:[6-9]|10|11)px/);assert.match(css,/min-height:48px/);assert.match(css,/\.banner-obscured.*display:none/);assert.match(css,/\.banner-editor-actions\{position:sticky/);
});

test('editor exposes only usable controls to the Hall focus loop and Escape takes precedence over hidden card inspection',async t=>{
 const ui=await loadGameUI(t);ui.get('hallDeckCards').querySelector('[data-hall-card]').click();assert.equal(ui.visible('hallCardInspect'),true);draft(ui);const focus=modalFocusCandidates(ui.get('intro'));assert.ok(focus.includes(ui.get('bannerName')));assert.ok(focus.includes(ui.get('bannerCancel')));assert.ok(!focus.includes(ui.get('start')));assert.ok(!focus.includes(ui.get('hallCloseCard')));
 ui.get('hallHomeTab').focus();ui.dispatch(ui.get('hallHomeTab'),'keydown',{key:'Escape'});assert.equal(ui.visible('hallBannerEditor'),false);assert.equal(ui.document.activeElement,ui.get('hallCustomizeBanner'));assert.equal(ui.visible('hallCardInspect'),true);assert.equal(ui.battle.profile.name,'Castledecks');
});
test('markup-like names are plain text in preview and no draft creates an executable element',async t=>{
 const ui=await loadGameUI(t);draft(ui,{name:'<img src=x> & \"guard\"'});assert.equal(ui.get('bannerPreviewName').textContent,'<img src=x> & \"guard\"');assert.equal(ui.get('bannerPreviewName').querySelector('img'),null);ui.click('bannerApply');assert.equal(ui.get('hallBannerName').querySelector('img'),null);ui.click('hallCustomizeBanner');assert.equal(ui.get('hallBannerEditor').querySelector('img'),null);
});

test('banner action bar stays inside the bounded scrolling viewport at every breakpoint',async()=>{
 const css=await readFile(new URL('../site/dist/banner-customization.css',import.meta.url),'utf8');
 assert.match(css,/\.banner-editor-actions\{position:sticky;bottom:0/);
 assert.doesNotMatch(css,/bottom:-\d/);
});

test('32-character identity remains full in Hall without expanding its compact destination heading',async t=>{
 const ui=await loadGameUI(t,{search:'?mode=test'}),name='W'.repeat(32);
 ui.click('hallCustomizeBanner');ui.get('bannerName').value=name;ui.get('bannerName').oninput();ui.click('bannerApply');
 assert.equal(ui.battle.profile.name,name);assert.equal(ui.get('hallBannerName').textContent,name);assert.match(ui.get('hallCurrentBanner').textContent,new RegExp(name));assert.ok(!ui.get('hubSessionTitle').textContent.includes(name));assert.ok(ui.get('hubSessionTitle').title.includes(name));
 const css=await readFile(new URL('../site/dist/banner-customization.css',import.meta.url),'utf8');assert.match(css,/\.local-slot p[^}]*overflow-wrap:anywhere;white-space:normal/);assert.match(css,/\.record-row strong\{min-width:0\}/);
});
