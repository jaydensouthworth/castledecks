import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createBattleReportRecorder,formatBattleReport,REPORT_LIMITS} from '../site/dist/battle-report.mjs';
import {CampaignBattle} from '../site/dist/engine/first-battle.mjs';
import {seededRandom} from '../site/dist/engine/combat.mjs';
import {PlayerProfile} from '../site/dist/engine/progression.mjs';
const context={build:'999.2',mode:'campaign'};
const setup=()=>new CampaignBattle({level:1,random:seededRandom(42)});

test('recording defaults off while a complete current snapshot remains available',()=>{
 const recorder=createBattleReportRecorder(),battle=setup();
 assert.equal(recorder.record({type:'damage',tick:1,target:battle.hero,damage:10}),false);
 const report=recorder.snapshot(battle,context);assert.equal(report.build,'999.2');assert.equal(report.level,1);assert.equal(report.seed,null);assert.equal(report.events.length,0);assert.equal(report.recording.enabled,false);
 assert.equal(report.counts.allies.alive,1);assert.equal(report.counts.allies.garrisoned,1);assert.deepEqual(report.warnings,[]);
 const text=formatBattleReport(report);assert.match(text,/not a save, replay, or importable/);assert.match(text,/recording off/);assert.match(text,/No recorded events/);assert.match(text,/Seed: unavailable/);
});

test('disabled observer never touches incoming event payload',()=>{
 const recorder=createBattleReportRecorder();const event=new Proxy({},{get(){throw new Error('must not inspect');}});assert.equal(recorder.record(event),false);
});

test('only validated owner metadata supplies deterministic seed; arbitrary fields are excluded',()=>{
 const b=setup(),r=createBattleReportRecorder();b.expeditionSeed=123;b.expeditionRun={privateName:'PRIVATE_SECRET'};b.profile.name='PROFILE_SECRET';b.profile.token='TOKEN_SECRET';b.input.privateText='INPUT_SECRET';
 const report=r.snapshot(b,{...context,scenarioSeed:99,scenarioName:'PRIVATE_SECRET',save:'SAVE_SECRET',fingerprint:'DEVICE_SECRET'});assert.equal(report.seed,99);
 assert.equal(r.snapshot(b,context).seed,null);for(const seed of [-1,2**32,Infinity,NaN,'98'])assert.equal(r.snapshot(b,{...context,scenarioSeed:seed}).seed,null);
 const output=JSON.stringify(report)+formatBattleReport(report);for(const token of ['PRIVATE_SECRET','PROFILE_SECRET','TOKEN_SECRET','INPUT_SECRET','SAVE_SECRET','DEVICE_SECRET'])assert.ok(!output.includes(token));
 assert.equal(r.snapshot(b,{build:'PRIVATE_SECRET',mode:'PROFILE_SECRET'}).build,'unavailable');assert.equal(r.snapshot(b,{build:'42',mode:'PROFILE_SECRET'}).mode,'unknown');
});

test('normalizes actual event source and owner without inferring a damage source',()=>{
 const b=setup(),r=createBattleReportRecorder();r.setEnabled(true);const target=b.createUnit('fireDragon'),projectile={kind:'hero_arrow',team:'good',x:1000,y:400,owner:b.hero};
 r.record({type:'hit',tick:1,target,projectile,damage:12,critical:true});r.record({type:'damage',tick:2,target,damage:12});
 const report=r.snapshot(b,context);assert.equal(report.events[0].source.type,'hero_arrow');assert.equal(report.events[0].owner.type,'hero');assert.equal(report.events[1].source,null);assert.equal(report.events[1].sourceKnown,false);
 assert.equal(report.events[0].target.id,report.events[1].target.id);assert.equal(report.actors.find(x=>x.type==='dragon_scout_fire').resistances.ice,4);
 assert.match(formatBattleReport(report),/Hits are separate events, not proof/);assert.match(formatBattleReport(report),/Status damage may have no engine event/);
});

test('event snapshots are detached and use only allowlisted primitive game fields',()=>{
 const b=setup(),r=createBattleReportRecorder();r.setEnabled(true);const u=b.hero;u.name='PROFILE_SECRET';
 r.record({type:'damage',tick:0,target:u,damage:10,source:{kind:'TOKEN_SECRET',team:'EMAIL_SECRET',x:0,y:0,hp:1,name:'PROFILE_SECRET'},key:'a',text:'INPUT_SECRET',token:'TOKEN_SECRET'});
 const originalHP=u.hp;u.hp=originalHP-2;const first=r.snapshot(b,context);assert.equal(first.events[0].target.hp,originalHP);assert.equal(first.events[0].source.type,'unknown');first.events[0].target.hp=9999;
 assert.equal(r.snapshot(b,context).events[0].target.hp,originalHP);assert.ok(!JSON.stringify(first).includes('SECRET'));
});

test('ignores raw input, sound and visual trails even with recording enabled',()=>{
 const r=createBattleReportRecorder();r.setEnabled(true);for(const type of ['keydown','input','sound','visual','profile','save'])assert.equal(r.record({type,tick:1,text:'PRIVATE'}),false);
 assert.equal(r.snapshot(setup(),context).events.length,0);
});

test('event history is capped and rate limiting is explicit',()=>{
 const r=createBattleReportRecorder();r.setEnabled(true);
 for(let tick=0;tick<132;tick++)for(let n=0;n<20;n++)r.record({type:'shot',tick,skill:'arrow'});
 const report=r.snapshot(setup(),context);assert.equal(report.events.length,REPORT_LIMITS.events);assert.equal(report.recording.overwritten,32);assert.equal(report.recording.dropped,132*20-128);
 for(let tick=0;tick<132;tick++)assert.ok(report.events.filter(e=>e.tick===tick).length<=REPORT_LIMITS.perTick);
 assert.match(formatBattleReport(report),/rate-limited/);
});

test('invalid tick drops are bounded while clear and disable erase history',()=>{
 const r=createBattleReportRecorder();r.setEnabled(true);for(const tick of [NaN,Infinity,-1,'1'])r.record({type:'shot',tick});assert.equal(r.snapshot(setup(),context).recording.dropped,4);
 r.record({type:'shot',tick:1,skill:'arrow'});r.clear();assert.equal(r.enabled,true);assert.equal(r.snapshot(setup(),context).events.length,0);
 r.record({type:'shot',tick:1,skill:'arrow'});r.setEnabled(false);const report=r.snapshot(setup(),context);assert.equal(report.events.length,0);assert.equal(report.recording.dropped,0);assert.equal(r.enabled,false);
});

test('snapshot highlights non-finite health/coordinates and detached garrison references',()=>{
 const b=setup(),r=createBattleReportRecorder(),u=b.createUnit('grunt');u.x=NaN;u.y=Infinity;u.hp=NaN;u.garrisonBuilding=b.badCastle;
 const report=r.snapshot(b,context);assert.equal(report.counts.enemies.invalidHealth,1);assert.equal(report.counts.enemies.alive,0);assert.ok(report.warnings.some(x=>x.includes('non-finite x, y, hp')));assert.ok(report.warnings.some(x=>x.includes('absent from its occupant list')));
 assert.equal(report.actors.find(x=>x.type==='grunt').x,'NaN');assert.equal(report.actors.find(x=>x.type==='grunt').y,'Infinity');
});

test('counts corpses, garrisons and queued actors separately without flagging expected off-field entries',()=>{
 const b=setup(),r=createBattleReportRecorder(),a=b.createUnit('archer'),g=b.createUnit('grunt');a.x=1800;a.y=b.badCastle.y;a.transition('aim');assert.ok(a.attemptGarrison(b.badCastle));g.hp=0;
 b.friendlyQueue.enqueueSquad({type:'grunt',cost:1},4);const incoming=b.createUnit('grunt');assert.equal(incoming.x,2050);
 const report=r.snapshot(b,context);assert.equal(report.counts.enemies.alive,2);assert.equal(report.counts.enemies.corpses,1);assert.equal(report.counts.enemies.garrisoned,1);assert.equal(report.counts.alliedQueued,4);assert.deepEqual(report.warnings,[]);assert.match(formatBattleReport(report),/do not prove an unreachable-enemy bug/);
});

test('reports inconsistent reserve and duplicate roster accounting',()=>{
 const b=setup(),r=createBattleReportRecorder(),u=b.createUnit('grunt');b.badTeam.push(u);b.goodTeam.push(u);b.enemies.index=10000;b.enemies.pending=['grunt'];b.friendlyQueue.population=NaN;
 const report=r.snapshot(b,context);assert.equal(report.counts.enemies.unique,1);assert.equal(report.counts.enemies.slots,2);assert.ok(report.warnings.some(x=>x.includes('duplicate')));assert.ok(report.warnings.some(x=>x.includes('both team')));assert.ok(report.warnings.some(x=>x.includes('reserve accounting')));assert.ok(report.warnings.some(x=>x.includes('population')));
});

test('large malformed rosters have bounded scans, actor details and warnings',()=>{
 const b=setup(),r=createBattleReportRecorder();b.badTeam=Array.from({length:1000},()=>({type:'grunt',team:'bad',x:NaN,y:0,hp:1,maxHp:2}));
 const report=r.snapshot(b,context);assert.equal(report.counts.enemies.slots,REPORT_LIMITS.scan);assert.equal(report.actors.length,REPORT_LIMITS.actors);assert.ok(report.warnings.length<=REPORT_LIMITS.warnings);assert.ok(report.warnings.some(x=>x.includes('partial')));
});

test('frozen model data is never mutated and huge finite numbers remain finite',()=>{
 const hero=Object.freeze({type:'hero',team:'good',x:1e308,y:0,hp:1,maxHp:1,multipliers:Object.freeze({pierce:1})});const b=Object.freeze({hero,goodTeam:Object.freeze([hero]),badTeam:Object.freeze([]),structures:Object.freeze([]),tick:0,width:2000,profile:Object.freeze({shootingMode:'classic'}),friendlyQueue:Object.freeze({queue:Object.freeze([]),population:2}),enemies:Object.freeze({roster:Object.freeze([]),index:0,withdrawn:0,remaining:0,pending:Object.freeze([])})});
 assert.doesNotThrow(()=>createBattleReportRecorder().snapshot(b,context));assert.equal(createBattleReportRecorder().snapshot(b,context).health.hero.x,1e308);
});

test('enabled event observation and repeated snapshots preserve deterministic simulation',()=>{
 const recorder=createBattleReportRecorder();recorder.setEnabled(true);const profile=()=>new PlayerProfile({name:'private'});
 const a=new CampaignBattle({level:16,profile:profile(),random:seededRandom(909)}),b=new CampaignBattle({level:16,profile:profile(),random:seededRandom(909),onEvent:recorder.record});
 for(let n=0;n<600;n++){a.step();b.step();if(n%30===0)recorder.snapshot(b,context);}
 const facts=x=>({tick:x.tick,hp:x.hero.hp,enemy:x.badTeam.map(u=>[u.type,u.x,u.y,u.hp]),ally:x.goodTeam.map(u=>[u.type,u.x,u.y,u.hp]),queue:x.friendlyQueue.queue.length,stats:x.stats,remaining:x.enemies.remaining});assert.deepEqual(facts(a),facts(b));assert.equal(a.random(),b.random(),'diagnostics never consume RNG');
});

test('model source has no storage, transmission, input, profile identity or global scheduling APIs',async()=>{
 const source=await readFile(new URL('../site/dist/battle-report.mjs',import.meta.url),'utf8');for(const pattern of [/\bfetch\s*\(/,/XMLHttpRequest/,/WebSocket/,/sendBeacon/,/localStorage/,/sessionStorage/,/\.input\b/,/profile\??\.name/,/navigator/,/setInterval/,/setTimeout/,/Date\.now/,/Math\.random/])assert.doesNotMatch(source,pattern);
});

test('inactive shelter is reported as a possible transition rather than a healthy garrison',()=>{
 const b=setup(),r=createBattleReportRecorder();b.goodCastle.hp=0;const report=r.snapshot(b,context);assert.equal(report.counts.allies.garrisoned,0);assert.ok(report.warnings.some(x=>x.includes('inactive shelter; this may be a transition')));
});


test('damage amounts distinguish explicit applied HP loss from legacy nominal values',()=>{
 const b=setup(),r=createBattleReportRecorder();r.setEnabled(true);
 r.record({type:'damage',tick:0,target:b.hero,source:b.badCastle,damage:99,actualDamage:7});
 r.record({type:'damage',tick:1,target:b.hero,damage:50,actualDamage:0});
 r.record({type:'damage',tick:2,target:b.hero,damage:12});
 const report=r.snapshot(b,context);assert.deepEqual(report.events.map(e=>[e.amount,e.amountKind]),[[7,'hp-loss'],[0,'hp-loss'],[12,'nominal']]);
 assert.equal(report.events[0].source.type,'castle');assert.equal(report.events[0].sourceKnown,true);
 assert.equal(report.events[1].source,null);assert.equal(report.events[1].sourceKnown,false);
 const text=formatBattleReport(report);assert.match(text,/amount 7 HP lost/);assert.match(text,/amount 0 HP lost/);assert.match(text,/amount 12 nominal; HP loss unavailable/);
});

test('malformed applied amounts cannot replace a finite nominal event amount',()=>{
 const b=setup(),r=createBattleReportRecorder();r.setEnabled(true);
 for(const [tick,actualDamage]of [NaN,Infinity,-1,'9'].entries())r.record({type:'damage',tick,target:b.hero,damage:9,actualDamage});
 const report=r.snapshot(b,context);assert.ok(report.events.every(e=>e.amount===9&&e.amountKind==='nominal'&&e.source===null&&!e.sourceKnown));
});


test('explicit projectile sources become detached primitives without retaining owner or private graphs',()=>{
 const b=setup(),r=createBattleReportRecorder();r.setEnabled(true);
 const owner={type:'hero',name:'PRIVATE_NAME',token:'PRIVATE_TOKEN'};
 const projectile={kind:'fire_arrow',team:'good',x:12,y:34,hp:0,owner,privateText:'PRIVATE_TEXT'};projectile.parent=projectile;owner.projectile=projectile;
 r.record({type:'damage',tick:0,target:b.hero,source:projectile,damage:99,actualDamage:7});
 projectile.x=999;owner.name='CHANGED_PRIVATE_NAME';
 const report=r.snapshot(b,context),entry=report.events[0];assert.notEqual(entry.source,projectile);assert.equal(entry.source.x,12);assert.equal(entry.source.type,'fire_arrow');
 assert.ok(Object.values(entry.source).every(value=>value===null||['string','number','boolean'].includes(typeof value)));
 const encoded=JSON.stringify(report)+formatBattleReport(report);for(const secret of ['PRIVATE_NAME','PRIVATE_TOKEN','PRIVATE_TEXT','CHANGED_PRIVATE_NAME'])assert.ok(!encoded.includes(secret));
 assert.doesNotThrow(()=>JSON.stringify(report));assert.equal(entry.owner,undefined);
 r.record({type:'damage',tick:1,target:b.hero,projectile,damage:2,actualDamage:2});assert.equal(r.snapshot(b,context).events[1].source,null,'damage attribution requires an explicit source field, not a correlated contact');
});
