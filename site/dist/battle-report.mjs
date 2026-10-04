/** Local, opt-in diagnostics. Reads explicit game facts; never retains an engine
 * object, input, profile identity, browser fingerprint, save or replay payload.
 * No timers, storage, network, engine mutation, RNG calls or automatic export. */
export const REPORT_LIMITS=Object.freeze({events:96,perTick:8,perWindow:32,windowTicks:33,scan:256,actors:80,warnings:24});
const TEAMS=new Set(['good','bad','neutral']);
const CASTLE_REGIONS=new Set(['friendlyCastle','enemyCastle','friendlyHighwatchCastle','enemyHighwatchCastle']);
const TYPES=new Set(['hero','castle','tower','grunt','tallGrunt','archer','priest','mount','trebuchet','air','air_fighter','poisonDragon','fireDragon','iceDragon','fireDemon','iceDemon','gorath','dragon_scout_poison','dragon_scout_fire','dragon_scout_ice','fire_demon','ice_demon','test_boss']);
const KINDS=new Set(['hero_arrow','arrow','trebuchet_ammo','bounce_arrow','bomb_arrow','flak_arrow','fire_arrow','ice_arrow','pierce_arrow','poison_arrow','fire_wave_arrow','ice_wave_arrow','bomb_wave_arrow','heal_wave_arrow','meteor_arrow','comet_arrow','meteor','comet','fire_ball','ice_ball','sky_marker','thunder_arrow','reactive_fire','reactive_ice','reactive_poison','gorath_shock_wave']);
const EVENTS=new Set(['damage','hit','projectile-hit','heal','spawn','shot','aim-unreachable','castle-destroyed','tower-destroyed','enemy-reserves-withdrawn','outcome','summary','companion-summoned','companion-departed','companion-signature']);
const SKILLS=new Set(['arrow','fireArrow','iceArrow','pierceArrow','bombArrow','flakArrow','bombWave','iceWave','fireWave','healWave','thunderArrow','meteorArrow','cometArrow']);
const MODES=new Set(['campaign','training','midgame','allies','expedition','skirmish']);
const PHASES=new Set(['preparation','paused','running','settling','settled']);
const AIMS=new Set(['classic','anywhere','point_aim','auto_aim']);
const RESISTANCES=['lightning','fire','ice','blunt','slice','pierce','flak','poison'];
const choice=(value,allowed,fallback='unknown')=>allowed.has(value)?value:fallback;
const number=value=>Number.isFinite(value)?Math.abs(value)<1e12?Math.round(value*100)/100:value:Number.isNaN(value)?'NaN':value===Infinity?'Infinity':value===-Infinity?'-Infinity':'unavailable';
const count=value=>Number.isSafeInteger(value)&&value>=0?value:null;
const list=value=>Array.isArray(value)?value:[];
const object=value=>value!==null&&typeof value==='object';
const alive=actor=>Number.isFinite(actor?.hp)&&actor.hp>0&&!actor.dead&&!actor.destroyed;
const corpse=actor=>object(actor)&&(Number.isFinite(actor.hp)&&actor.hp<=0||actor.dead===true||actor.destroyed===true);
const team=actor=>choice(actor?.team,TEAMS);
const type=actor=>TYPES.has(actor?.type)?actor.type:CASTLE_REGIONS.has(actor?.regionKind)?'castle':choice(actor?.kind,KINDS);
const safeBuild=value=>typeof value==='string'&&/^\d{1,6}(?:\.\d{1,6}){0,3}$/.test(value)?value:Number.isSafeInteger(value)&&value>=0?String(value):'unavailable';
const saturate=value=>Math.min(Number.MAX_SAFE_INTEGER,value+1);

export function createBattleReportRecorder(){
 let enabled=false,events=[],ids=new WeakMap(),nextId=1,lastTick=null,tickCount=0,windowStart=null,windowCount=0,dropped=0,overwritten=0;
 function id(actor){if(!object(actor))return null;if(!ids.has(actor))ids.set(actor,`actor-${nextId++}`);return ids.get(actor);}
 function brief(actor){if(!object(actor))return null;return {id:id(actor),type:type(actor),team:team(actor),x:number(actor.x),y:number(actor.y),hp:number(actor.hp)};}
 function reset(){events=[];ids=new WeakMap();nextId=1;lastTick=null;tickCount=0;windowStart=null;windowCount=0;dropped=0;overwritten=0;}
 function record(event){
  // Disabled path neither inspects nor retains the incoming event.
  if(!enabled)return false;
  if(!EVENTS.has(event?.type))return false;
  const tick=count(event.tick);
  if(tick===null){dropped=saturate(dropped);return false;}
  if(lastTick!==tick){lastTick=tick;tickCount=0;}
  if(windowStart===null||tick<windowStart||tick-windowStart>=REPORT_LIMITS.windowTicks){windowStart=tick;windowCount=0;}
  if(tickCount>=REPORT_LIMITS.perTick||windowCount>=REPORT_LIMITS.perWindow){dropped=saturate(dropped);return false;}
  tickCount++;windowCount++;
  const entry={tick,type:event.type};
  if(['damage','hit','projectile-hit','heal'].includes(event.type)){
   entry.target=brief(event.target);
   if(event.type==='damage'){const applied=Number.isFinite(event.actualDamage)&&event.actualDamage>=0;entry.amount=number(applied?event.actualDamage:event.damage);entry.amountKind=applied?'hp-loss':'nominal';}
   if(event.type==='hit')entry.amount=number(event.damage);
   if(event.type==='heal')entry.amount=number(event.amount);
   entry.source=brief(event.source??(event.type==='damage'?null:event.projectile));
   if(event.type!=='damage'&&event.projectile?.owner)entry.owner=brief(event.projectile.owner);
   if(event.type==='damage')entry.sourceKnown=!!entry.source;
   if(event.critical===true)entry.critical=true;
   if(['ground','target'].includes(event.kind))entry.impact=event.kind;
  }
  if(['spawn','companion-summoned','companion-departed','companion-signature'].includes(event.type))entry.actor=brief(event.unit);
  if(event.type==='castle-destroyed'||event.type==='tower-destroyed')entry.actor=brief(event.castle??event.tower);
  if(event.type==='shot')entry.skill=choice(event.skill,SKILLS);
  if(event.type==='outcome'||event.type==='summary')entry.outcome=choice(event.outcome??event.summary?.outcome,new Set(['victory','defeat']));
  if(event.type==='enemy-reserves-withdrawn'){entry.withdrawn=count(event.withdrawn);entry.bosses=count(event.bosses);}
  if(event.type==='companion-departed')entry.reason=choice(event.reason,new Set(['defeated','recalled','battle-ended']));
  if(events.length===REPORT_LIMITS.events){events.shift();overwritten=saturate(overwritten);}
  events.push(entry);return true;
 }
 function snapshot(battle,{build,mode,phase,scenarioSeed}={}){
  const warnings=[],warn=text=>{if(warnings.length<REPORT_LIMITS.warnings&&!warnings.includes(text))warnings.push(text);};
  const scanned=(value,label)=>{const all=list(value);if(all.length>REPORT_LIMITS.scan)warn(`${label}: scan limited to ${REPORT_LIMITS.scan} entries; counts are partial.`);return all.slice(0,REPORT_LIMITS.scan);};
  const good=scanned(battle?.goodTeam,'Allies'),bad=scanned(battle?.badTeam,'Enemies'),structures=scanned(battle?.structures,'Structures');
  const unique=items=>[...new Set(items.filter(object))];
  const summarize=(items,label)=>{const units=unique(items);if(units.length!==items.length)warn(`${label}: duplicate or invalid roster references.`);return {slots:items.length,unique:units.length,alive:units.filter(alive).length,corpses:units.filter(corpse).length,invalidHealth:units.filter(u=>!Number.isFinite(u.hp)).length,garrisoned:units.filter(u=>alive(u)&&alive(u.garrisonBuilding)&&list(u.garrisonBuilding.occupants).slice(0,REPORT_LIMITS.scan).includes(u)).length};};
  const allies=summarize(good,'Allies'),enemies=summarize(bad,'Enemies');
  const goodSet=new Set(good),badSet=new Set(bad);
  if(good.some(u=>badSet.has(u)))warn('An actor appears in both team rosters.');
  if(good.some(u=>object(u)&&u.team!=='good')||bad.some(u=>object(u)&&u.team!=='bad'))warn('An actor team disagrees with its roster.');
  const actors=unique([battle?.hero,...bad,...good,...structures]);
  const snapshots=actors.map(actor=>{
   const value={...brief(actor),maxHp:number(actor.maxHp),alive:alive(actor),corpse:corpse(actor),visible:actor.visible!==false,canGetHit:actor.canGetHit!==false,garrison:id(actor.garrisonBuilding),outsideFieldX:Number.isFinite(actor.x)&&Number.isFinite(battle?.width)?actor.x<0||actor.x>battle.width:null};
   value.resistances=Object.fromEntries(RESISTANCES.filter(key=>actor.multipliers?.[key]!==undefined).map(key=>[key,number(actor.multipliers[key])]));
   const invalid=['x','y','hp','maxHp'].filter(key=>!Number.isFinite(actor[key]));
   if(invalid.length)warn(`${value.id} (${value.type}): non-finite ${invalid.join(', ')}.`);
   if(Number.isFinite(actor.maxHp)&&actor.maxHp<=0)warn(`${value.id} (${value.type}): non-positive maximum health.`);
   if(actor.garrisonBuilding&&!list(actor.garrisonBuilding.occupants).slice(0,REPORT_LIMITS.scan).includes(actor))warn(`${value.id}: garrison reference is absent from its occupant list.`);
   if(alive(actor)&&actor.garrisonBuilding&&!alive(actor.garrisonBuilding))warn(`${value.id}: living actor references an inactive shelter; this may be a transition.`);
   return value;
  });
  for(const building of unique(structures)){
   const occupants=scanned(building.occupants,'Garrison occupants');
   if(new Set(occupants).size!==occupants.length)warn(`${id(building)}: duplicate garrison occupants.`);
   if(occupants.some(u=>object(u)&&(u.garrisonBuilding!==building||!goodSet.has(u)&&!badSet.has(u))))warn(`${id(building)}: stale garrison occupant reference.`);
  }
  const director=battle?.enemies,rosterLength=list(director?.roster).length,index=count(director?.index),withdrawn=count(director?.withdrawn??0),remaining=count(director?.remaining),pending=list(director?.pending).length;
  if(index===null||withdrawn===null||remaining===null||index+withdrawn+remaining!==rosterLength)warn('Enemy reserve accounting is inconsistent or unavailable.');
  if(remaining!==null&&pending>remaining)warn('Enemy dispatch queue exceeds its remaining reserves.');
  const population=count(battle?.friendlyQueue?.population);
  if(population===null)warn('Allied reserve population is invalid or unavailable.');
  if(!Number.isFinite(battle?.tick)||!Number.isFinite(battle?.width)||battle.width<=0)warn('Battle tick or field width is invalid.');
  if(snapshots.length>REPORT_LIMITS.actors)warn(`Actor details limited to ${REPORT_LIMITS.actors}; roster counts include the scanned actors.`);
  return {schema:'castledecks-battle-diagnostics-v1',build:safeBuild(build),mode:choice(mode,MODES),phase:choice(phase,PHASES),seed:Number.isSafeInteger(scenarioSeed)&&scenarioSeed>=0&&scenarioSeed<=0xffffffff?scenarioSeed:null,level:number(battle?.level),tick:number(battle?.tick),aimMode:choice(battle?.profile?.shootingMode,AIMS),paused:battle?.paused===true,outcome:choice(battle?.outcome,new Set(['victory','defeat']),'unsettled'),fieldWidth:number(battle?.width),health:{hero:brief(battle?.hero),friendlyKeep:brief(battle?.goodCastle),enemyKeep:brief(battle?.badCastle)},counts:{allies,enemies,alliedQueued:list(battle?.friendlyQueue?.queue).length,alliedReserve:population,enemyQueued:pending,enemyReserve:remaining,enemyWithdrawn:withdrawn,structures:unique(structures).length},actors:snapshots.slice(0,REPORT_LIMITS.actors),warnings,recording:{enabled,stored:events.length,dropped,overwritten,limits:REPORT_LIMITS},events:events.map(event=>JSON.parse(JSON.stringify(event)))};
 }
 return {record,snapshot,clear:reset,setEnabled(value){enabled=value===true;if(!enabled)reset();},get enabled(){return enabled;}};
}

const fmt=value=>value===null?'unavailable':String(value);
const actorLabel=actor=>actor?`${actor.id} ${actor.type}/${actor.team} @ ${actor.x},${actor.y} HP ${actor.hp}`:'unavailable';
export function formatBattleReport(report){
 const c=report.counts,r=report.recording;
 const lines=['CASTLEDECKS · BATTLE DIAGNOSTICS','Diagnostics only. This is not a save, replay, or importable file.','Local snapshot; only copied/downloaded by your action. No automatic sending.','',`Build ${report.build} | ${report.mode} | level ${report.level} | tick ${report.tick}`,`Seed: ${fmt(report.seed)} | aim: ${report.aimMode} | ${report.phase} | ${report.outcome}`,`Hero: ${actorLabel(report.health.hero)}`,`Friendly keep: ${actorLabel(report.health.friendlyKeep)}`,`Enemy keep: ${actorLabel(report.health.enemyKeep)}`,''];
 for(const [label,side] of [['Allies',c.allies],['Enemies',c.enemies]])lines.push(`${label}: ${side.alive} alive · ${side.corpses} corpses · ${side.garrisoned} garrisoned · ${side.invalidHealth} invalid HP · ${side.unique}/${side.slots} unique/roster slots`);
 lines.push(`Allied queue: ${c.alliedQueued} | uncommitted reserve: ${fmt(c.alliedReserve)}`,`Enemy dispatch queue: ${c.enemyQueued} (included in reserve ${fmt(c.enemyReserve)}) | withdrawn: ${fmt(c.enemyWithdrawn)}`,'','CHECKS',...(report.warnings.length?report.warnings.map(x=>`! ${x}`):['No finite-value or count inconsistency found in this snapshot.']), 'Off-field X / hidden / garrisoned actors may be normal. These facts do not prove an unreachable-enemy bug.','','ACTORS (world coordinates; local IDs last only for this report session)');
 for(const actor of report.actors)lines.push(`${actorLabel(actor)} / ${actor.maxHp} | ${actor.alive?'alive':actor.corpse?'corpse':'unknown'}${actor.garrison?` | inside ${actor.garrison}`:''}${actor.visible?'':' | hidden'}${actor.canGetHit?'':' | not hittable'}${actor.outsideFieldX?' | off-field X':''}${Object.keys(actor.resistances).length?' | resistance '+Object.entries(actor.resistances).map(([key,value])=>`${key}=${value}`).join(' '):''}`);
 lines.push('',`RECENT EVENTS · recording ${r.enabled?'on':'off'} · ${r.stored}/${r.limits.events} stored · ${r.dropped} rate-limited · ${r.overwritten} older removed`,'History starts only after you enable recording. Disabling clears it.','Damage events without a supplied source say unavailable. Hits are separate events, not proof that damage was applied. Applied HP loss is shown when supplied; otherwise damage is labelled nominal and HP loss is unavailable. Status damage may have no engine event.');
 for(const event of report.events){let detail=event.target?`${actorLabel(event.target)} ← ${actorLabel(event.source)}`:event.actor?actorLabel(event.actor):event.skill??event.outcome??'';if(event.amount!==undefined)detail+=` | amount ${event.amount}${event.type==='damage'?(event.amountKind==='hp-loss'?' HP lost':' nominal; HP loss unavailable'):''}`;if(event.owner)detail+=` | owner ${actorLabel(event.owner)}`;if(event.critical)detail+=' | critical';if(event.impact)detail+=` | ${event.impact}`;if(event.reason)detail+=` | ${event.reason}`;if(event.withdrawn!==undefined)detail+=` | withdrawn ${fmt(event.withdrawn)}; bosses ${fmt(event.bosses)}`;lines.push(`${event.tick} ${event.type}${detail?' · '+detail:''}`);}
 if(!report.events.length)lines.push('No recorded events.');
 return lines.join('\n');
}
