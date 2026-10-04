import {legacyProfileBundle,legacyDeck} from './helpers/legacy-castle-fixtures.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {CampaignProfiles} from '../site/dist/engine/profile-manager.mjs';
import {createLocalCampaignStore,checkpointSlotKey,LOCAL_STORAGE_PREFIX,LOCAL_CHECKPOINT_SCHEMA,LOCAL_DECK_CHECKPOINT_SCHEMA,MAX_LOCAL_CHECKPOINT_BYTES} from '../site/dist/local-campaign-store.mjs';
import {PROFILE_DECK_SCHEMA,captureDeck} from '../site/dist/deck-presets-model.mjs';
import {campaignDisplayName,readFrontpageCampaign,createFrontpageCampaign,LOCAL_CAMPAIGN_CHOOSER} from '../site/dist/frontpage-campaign.mjs';

class Storage{
 constructor(){this.data=new Map();this.reads=[];this.writes=0;this.removes=0;}
 getItem(key){this.reads.push(key);return this.data.get(key)??null;}
 setItem(){this.writes++;throw new Error('Frontpage must never write');}
 removeItem(){this.removes++;throw new Error('Frontpage must never remove');}
}
function checkpoint({name='Oakward',level=1,phase='ready',outcome=null,assisted=false,activeIndex=0,second=false,schema=LOCAL_CHECKPOINT_SCHEMA,revision=1,writtenAt=1791079200000}={}){
 const manager=new CampaignProfiles({defaultName:name});
 if(second)manager.create('Selected company');manager.select(activeIndex);
 manager.active.highestLevel=level;manager.active.cheated=assisted;
 const payload={bundle:legacyProfileBundle(manager),activeIndex,resume:{phase,level:Math.min(30,level),outcome}};
 if(schema===LOCAL_DECK_CHECKPOINT_SCHEMA)payload.deckPresets={schema:'castledecks-profile-decks-1',profiles:manager.profiles.map(profile=>[legacyDeck(captureDeck(profile,'Field kit'))]),retired:[]};
 return JSON.stringify({schema,revision,writtenAt,transaction:'frontpage-fixture',reason:phase==='result'?'result':phase==='opening'?'battle-start':'ready',payload});
}
const seed=(storage,options={},slot=1,bank='a')=>storage.data.set(checkpointSlotKey(slot,bank),checkpoint(options));
const reader=storage=>createLocalCampaignStore({storage,locks:{request(){throw new Error('Frontpage must not request a write lock');}}});
const snapshot=storage=>[...storage.data];

for(const schema of [LOCAL_CHECKPOINT_SCHEMA,LOCAL_DECK_CHECKPOINT_SCHEMA])test(`frontpage validates ${schema} using the existing reader with zero mutations`,()=>{
 const storage=new Storage();seed(storage,{schema,second:true,activeIndex:1,level:16});const before=snapshot(storage),view=readFrontpageCampaign(reader(storage));
 assert.equal(view.status,'ready');assert.equal(view.campaign.name,'Selected company');assert.equal(view.campaign.field,'Battle 16 · Pinewatch Dawn');assert.equal(view.campaign.region,'Frostpine');assert.equal(view.campaign.provenance,'Unassisted');
 assert.deepEqual(snapshot(storage),before);assert.equal(storage.writes,0);assert.equal(storage.removes,0);assert.deepEqual(storage.reads,[1,2,3].flatMap(slot=>['a','b'].map(bank=>checkpointSlotKey(slot,bank))));
});
test('empty origin is distinct from unavailable storage and never seeds a blank profile',()=>{
 const storage=new Storage();assert.deepEqual(readFrontpageCampaign(reader(storage)),{status:'empty',campaign:null,note:''});assert.equal(storage.data.size,0);assert.equal(storage.writes,0);assert.equal(storage.removes,0);
 for(const store of [createLocalCampaignStore({storage:()=>{throw new Error('denied');}}),{list(){throw new Error('reader failed');}}]){const view=readFrontpageCampaign(store);assert.equal(view.status,'unavailable');assert.equal(view.campaign,null);assert.match(view.note,/could not be read.*may still exist/);assert.doesNotMatch(view.note,/no saves|empty|reset/i);}
});
test('corrupt bank uses only the valid recovery copy and makes no repairs',()=>{
 const storage=new Storage();seed(storage,{level:7});storage.data.set(checkpointSlotKey(1,'b'),'{broken');const before=snapshot(storage),view=readFrontpageCampaign(reader(storage));
 assert.equal(view.campaign.region,'Bannerfen');assert.match(view.note,/last valid copy.*both copies are kept/);assert.deepEqual(snapshot(storage),before);assert.equal(storage.writes,0);assert.equal(storage.removes,0);
});
for(const schema of ['castledecks-local-checkpoint-4','castledecks-local-checkpoint-99','castledecks-local-checkpoint-99999999999999999999999999'])test(`newer ${schema} hides even an otherwise valid older bank without touching either`,()=>{
 const storage=new Storage();seed(storage,{name:'Must not preview'});storage.data.set(checkpointSlotKey(1,'b'),JSON.stringify({schema,privateFutureData:{keep:true}}));const before=snapshot(storage),view=readFrontpageCampaign(reader(storage));
 assert.equal(view.status,'newer');assert.equal(view.campaign,null);assert.match(view.note,/newer game version.*Reload.*both checkpoint copies are kept/);assert.deepEqual(snapshot(storage),before);assert.equal(storage.writes,0);assert.equal(storage.removes,0);
});
for(const mutation of [
 value=>({...value,schema:'foreign-schema'}),value=>({...value,revision:0}),value=>({...value,payload:{...value.payload,activeIndex:999}}),value=>({...value,payload:{...value.payload,resume:{phase:'opening',level:30,outcome:null}}}),
 value=>({...value,payload:{...value.payload,bundle:'{"schema":"future-profiles"}'}}),value=>({...value,payload:{...value.payload,deckPresets:{}}}),value=>JSON.parse(JSON.stringify(value).replace('"reason":','"__proto__":{"polluted":true},"reason":')),
])test(`unsupported or malformed payload stays unreadable (${mutation.toString().slice(0,65)})`,()=>{
 const storage=new Storage();storage.data.set(checkpointSlotKey(1,'a'),JSON.stringify(mutation(JSON.parse(checkpoint()))));const before=snapshot(storage),view=readFrontpageCampaign(reader(storage));assert.equal(view.status,'unreadable');assert.equal(view.campaign,null);assert.match(view.note,/kept for recovery/);assert.deepEqual(snapshot(storage),before);assert.equal(storage.writes,0);assert.equal(storage.removes,0);assert.equal({}.polluted,undefined);
});
test('invalid deck metadata and oversized text cannot produce a return preview',()=>{
 const invalidDeck=JSON.parse(checkpoint({schema:LOCAL_DECK_CHECKPOINT_SCHEMA}));invalidDeck.payload.deckPresets.profiles[0][0].slots[0]='not-a-card';
 for(const raw of [JSON.stringify(invalidDeck), ' '.repeat(MAX_LOCAL_CHECKPOINT_BYTES+1), 'not JSON']){const storage=new Storage();storage.data.set(checkpointSlotKey(1,'a'),raw);assert.equal(readFrontpageCampaign(reader(storage)).status,'unreadable');assert.equal(storage.writes,0);}
});
test('latest bank follows reader revisions; most recent valid slot follows game chooser timestamp',()=>{
 const storage=new Storage();seed(storage,{name:'Old bank',revision:1,writtenAt:3000});seed(storage,{name:'Current bank',revision:2,writtenAt:1000},1,'b');seed(storage,{name:'Other slot',writtenAt:2000},2);
 const view=readFrontpageCampaign(reader(storage));assert.equal(view.campaign.name,'Other slot');assert.equal(view.campaign.slot,2);assert.equal(view.campaign.readableSlots,2);storage.data.delete(checkpointSlotKey(2,'a'));assert.equal(readFrontpageCampaign(reader(storage)).campaign.name,'Current bank');assert.equal(storage.writes,0);
});
test('another newer or unreadable slot does not hide a valid separate campaign or misstate all slots',()=>{
 const storage=new Storage();seed(storage,{level:24},2);storage.data.set(checkpointSlotKey(1,'a'),'{"schema":"castledecks-local-checkpoint-4"}');storage.data.set(checkpointSlotKey(3,'a'),'{broken');const view=readFrontpageCampaign(reader(storage));
 assert.equal(view.status,'ready');assert.equal(view.campaign.slot,2);assert.equal(view.campaign.region,'Cinderlands');assert.equal(view.campaign.readableSlots,1);assert.match(view.note,/newer game version/);assert.match(view.note,/unreadable data/);assert.equal(storage.writes,0);assert.equal(storage.removes,0);
});
test('partial read denial reports uncertainty beside a readable campaign',()=>{
 const storage=new Storage();seed(storage);const original=storage.getItem.bind(storage);storage.getItem=key=>{if(key===checkpointSlotKey(2,'a'))throw new Error('denied');return original(key);};const view=readFrontpageCampaign(reader(storage));assert.equal(view.status,'ready');assert.match(view.note,/may still exist/);assert.equal(storage.writes,0);
});
for(const [level,region] of [[1,'Hearthwood'],[6,'Hearthwood'],[7,'Bannerfen'],[15,'Bannerfen'],[16,'Frostpine'],[23,'Frostpine'],[24,'Cinderlands'],[30,'Cinderlands']])test(`saved frontier ${level} uses authored ${region} identity`,()=>{
 const storage=new Storage();seed(storage,{level});const view=readFrontpageCampaign(reader(storage));assert.equal(view.campaign.region,region);assert.ok(existsSync(new URL('../site/dist/'+view.campaign.art,import.meta.url)));assert.match(view.campaign.field,new RegExp(`^Battle ${level} · `));assert.doesNotMatch(view.campaign.checkpoint,/resume.*live|battle in progress/i);
});
for(const [phase,outcome,pattern] of [['ready',null,/Preparation checkpoint/],['opening',null,/Battle-opening checkpoint.*restarts the field/],['result','victory',/after victory.*saved frontier/],['result','defeat',/after defeat.*saved frontier/]])test(`${phase}/${outcome} copy identifies checkpoint semantics`,()=>{
 const storage=new Storage();seed(storage,{phase,outcome,level:8});assert.match(readFrontpageCampaign(reader(storage)).campaign.checkpoint,pattern);
});
test('completed and assisted frontiers do not invent a battle 31 or unassisted achievement',()=>{
 const storage=new Storage();seed(storage,{level:31,phase:'result',outcome:'victory',assisted:true});const view=readFrontpageCampaign(reader(storage));assert.equal(view.campaign.field,'The Crownroad is complete');assert.equal(view.campaign.provenance,'Assisted');assert.match(view.campaign.checkpoint,/Completed Crownroad record/);assert.doesNotMatch(JSON.stringify(view),/Battle 31|earned|cleared/i);
});
test('mixed bundle and selected campaign name stay distinguishable',()=>{
 const storage=new Storage();seed(storage,{second:true,activeIndex:1,assisted:true});const view=readFrontpageCampaign(reader(storage));assert.equal(view.campaign.name,'Selected company');assert.equal(view.campaign.provenance,'Mixed profiles');
});

const markup=readFileSync(new URL('../site/dist/index.html',import.meta.url),'utf8');
class Target{constructor(){this.listeners=new Map();}addEventListener(type,fn){const list=this.listeners.get(type)??[];list.push(fn);this.listeners.set(type,list);}removeEventListener(type,fn){this.listeners.set(type,(this.listeners.get(type)??[]).filter(item=>item!==fn));}emit(type,event={}){for(const fn of this.listeners.get(type)??[])fn(event);}}
function surface(storage){
 const document=new Target(),window=new Target(),nodes=new Map();document.hidden=false;document.getElementById=id=>nodes.get(id)??null;window.localStorage=storage;
 for(const match of markup.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)){
  const attrs=new Map([...match[0].matchAll(/([\w-]+)="([^"]*)"/g)].map(item=>[item[1],item[2]]));const classes=new Set((attrs.get('class')??'').split(' '));
  const node={hidden:/\bhidden\b/.test(match[0]),textContent:'',classList:{toggle(name,value){if(value)classes.add(name);else classes.delete(name);},contains:name=>classes.has(name)},setAttribute:(name,value)=>attrs.set(name,String(value)),getAttribute:name=>attrs.get(name)??null,removeAttribute:name=>attrs.delete(name)};
  Object.defineProperty(node,'innerHTML',{set(){throw new Error('Unsafe HTML sink');}});nodes.set(match[1],node);
 }
 return {document,window,nodes,get:id=>nodes.get(id)};
}
test('unsafe names are plain isolated text, bounded visually, with no saved-data mutation',()=>{
 const storage=new Storage(),name='<img src=x onerror=alert(1)>';seed(storage,{name});const before=snapshot(storage),ui=surface(storage);createFrontpageCampaign(ui);
 assert.equal(ui.get('returningName').textContent,name);assert.equal(ui.get('frontpagePlay').getAttribute('href'),LOCAL_CAMPAIGN_CHOOSER);assert.deepEqual(snapshot(storage),before);assert.equal(storage.writes,0);assert.equal(storage.removes,0);
 assert.equal(campaignDisplayName(' \u202e\u0000 '),'Unnamed campaign');assert.equal(Array.from(campaignDisplayName('🏹'.repeat(400))).length,65);
});
test('other-tab changes, remove/clear, BFCache pageshow and foreground return never leave a stale profile',()=>{
 const storage=new Storage();seed(storage,{name:'First'});const ui=surface(storage),view=createFrontpageCampaign(ui);assert.equal(ui.get('returningName').textContent,'First');
 seed(storage,{name:'Next',writtenAt:1800000000000});ui.window.emit('storage',{key:'unrelated'});assert.equal(ui.get('returningName').textContent,'First');ui.window.emit('storage',{key:checkpointSlotKey(1,'a')});assert.equal(ui.get('returningName').textContent,'Next');
 storage.data.clear();ui.window.emit('storage',{key:null});assert.equal(ui.get('returningCampaign').hidden,true);assert.equal(ui.get('returningName').textContent,'');assert.equal(ui.get('returningArt').getAttribute('src'),null);assert.equal(ui.get('frontpagePlay').getAttribute('href'),'./battle');assert.equal(ui.get('firstVisitTitle').hidden,false);
 seed(storage,{name:'Returned'});ui.window.emit('pageshow',{persisted:true});assert.equal(ui.get('returningName').textContent,'Returned');
 seed(storage,{name:'Foreground'});ui.document.hidden=true;ui.document.emit('visibilitychange');assert.equal(ui.get('returningName').textContent,'Returned');ui.document.hidden=false;ui.document.emit('visibilitychange');assert.equal(ui.get('returningName').textContent,'Foreground');
 seed(storage,{name:'Focused'});ui.window.emit('focus');assert.equal(ui.get('returningName').textContent,'Focused');const reads=storage.reads.length;view.dispose();view.dispose();ui.window.emit('storage',{key:null});ui.window.emit('pageshow');ui.document.emit('visibilitychange');assert.equal(storage.reads.length,reads);assert.equal(storage.writes,0);assert.equal(storage.removes,0);
});
test('storage becoming denied clears old preview but never calls it empty or starts a campaign',()=>{
 const storage=new Storage();seed(storage);const ui=surface(storage);createFrontpageCampaign(ui);Object.defineProperty(ui.window,'localStorage',{get(){throw new Error('denied');}});ui.window.emit('pageshow');
 assert.equal(ui.get('returningCampaign').hidden,true);assert.equal(ui.get('returningName').textContent,'');assert.equal(ui.get('returningTime').getAttribute('datetime'),null);assert.equal(ui.get('frontpageSaveNotice').hidden,false);assert.match(ui.get('frontpageSaveNotice').textContent,/may still exist/);assert.equal(ui.get('frontpagePlayLabel').textContent,'Review local saves');assert.equal(storage.writes,0);
});
test('all error and recovery UI states preserve raw bytes and show their warning',()=>{
 for(const kind of ['recovered','newer','unreadable']){const storage=new Storage();if(kind==='recovered')seed(storage);storage.data.set(checkpointSlotKey(1,kind==='recovered'?'b':'a'),kind==='newer'?'{"schema":"castledecks-local-checkpoint-4"}':'broken');const before=snapshot(storage),ui=surface(storage);createFrontpageCampaign(ui);assert.equal(ui.get('frontpageSaveNotice').hidden,false);assert.ok(ui.get('frontpageSaveNotice').textContent);assert.deepEqual(snapshot(storage),before);assert.equal(storage.writes,0);assert.equal(storage.removes,0);}
});
test('same-origin isolation reads only six existing Crownroad keys and no other save namespace',()=>{
 const a=new Storage(),b=new Storage();seed(a,{name:'Origin A'});b.data.set('castledecks:expedition:save','not a Crownroad checkpoint');assert.equal(readFrontpageCampaign(reader(a)).campaign.name,'Origin A');assert.equal(readFrontpageCampaign(reader(b)).status,'empty');assert.ok([...a.reads,...b.reads].every(key=>key.startsWith(LOCAL_STORAGE_PREFIX)));assert.equal(a.writes+b.writes,0);
});
test('HTML keeps four adventures and no-JavaScript entry; one heading and native same-origin chooser',()=>{
 const ids=[...markup.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);assert.equal(new Set(ids).size,ids.length);assert.equal((markup.match(/<h1\b/g)??[]).length,1);
 for(const href of ['./battle','./battle?mode=expedition','./battle?mode=skirmish','./battle?mode=test'])assert.ok(markup.includes(`href="${href}"`));
 assert.ok(markup.indexOf('id="frontpagePlay"')<markup.indexOf('id="returningCampaign"'),'The chooser action precedes the detailed saved frontier');
 assert.match(markup,/<span id="firstVisitTitle">Take aim/);assert.match(markup,/id="returningTitle" hidden/);assert.match(markup,/id="returningCampaign"[^>]* hidden/);assert.match(markup,/<bdi id="returningName">/);assert.match(markup,/id="frontpageSaveNotice" role="status" hidden/);assert.match(markup,/browser, device and website address/);assert.match(markup,/Opening the chooser does not start a battle/);assert.match(markup,/type="module" src="\.\/frontpage-campaign.mjs"/);
});
test('responsive structural rules allow wrapping, small screens, native hidden and reduced motion',()=>{
 const css=readFileSync(new URL('../site/dist/frontpage.css',import.meta.url),'utf8');assert.match(css,/\[hidden\]\{display:none!important\}/);assert.match(css,/\.returning-copy\{[^}]*min-width:0[^}]*overflow-wrap:anywhere/);assert.match(css,/@media\(max-width:600px\)\{\.has-local-campaign\{min-height:0\}/);assert.match(css,/@media\(max-height:500px\) and \(min-width:601px\).*has-local-campaign/s);assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);assert.doesNotMatch(css.slice(css.indexOf('/* The returning standard')),/animation:|height:100vh|white-space:nowrap|position:fixed/);
});
test('frontpage module has no write, network, telemetry, navigation, or HTML injection sink',()=>{
 const script=readFileSync(new URL('../site/dist/frontpage-campaign.mjs',import.meta.url),'utf8');assert.doesNotMatch(script,/\.(?:write|remove|checkpoint|setItem|removeItem)\s*\(|\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon|eval)\s*\(|innerHTML|outerHTML|insertAdjacentHTML|location\s*[.=]|setInterval|setTimeout/);assert.equal(LOCAL_CAMPAIGN_CHOOSER,'./battle?open=local-saves');
});
