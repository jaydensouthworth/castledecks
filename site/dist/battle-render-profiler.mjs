/** Bounded opt-in local diagnostics. No engine mutation, retained engine/input
 * objects, timers, storage, network, RNG, device identity or automatic export.
 * Callers supply clocks and explicit facts. Timings are NOT display latency. */
export const RENDER_PROFILE_LIMITS=Object.freeze({durationMs:30000,frames:8192,renders:8192,ticks:2048,inputs:512,pendingInputs:64,countSamples:121,countEveryMs:250,scan:512});
const finite=Number.isFinite;
const round=n=>finite(n)?Math.round(n*1000)/1000:null;
const list=value=>Array.isArray(value)?value:[];
const object=value=>value!==null&&typeof value==='object';
const living=actor=>finite(actor?.hp)&&actor.hp>0&&!actor.dead&&!actor.destroyed;
const positioned=actor=>finite(actor?.x)&&finite(actor?.y);
const modes=new Set(['campaign','training','midgame','allies','expedition','skirmish']);
const reasons=new Set(['window-complete','stopped','battle-ended','clock-invalid']);
const metrics=['rafIntervalMs','renderIntervalMs','renderCpuMs','tickCpuMs','inputToRenderMs'];
export function summarizeRenderSamples(samples){
 const values=samples.filter(n=>finite(n)&&n>=0).slice().sort((a,b)=>a-b);
 const pick=p=>values.length?round(values[Math.max(0,Math.ceil(values.length*p)-1)]):null;
 return {samples:values.length,p50:pick(.5),p95:pick(.95),worst:values.length?round(values.at(-1)):null};
}
/** Actual roster/object facts sampled after a submitted render. "On-screen"
 * means anchor inside the canvas viewport, NOT full sprite bounds/occlusion.
 * The hero gallery position is supplied by the existing renderer, not inferred. */
export function sampleBattleRenderLoad(battle,camera,{heroGallery=null}={}){
 let truncated=false;
 const scan=value=>{const all=list(value);truncated ||= all.length>RENDER_PROFILE_LIMITS.scan;return all.slice(0,RENDER_PROFILE_LIMITS.scan);};
 const actors=[...new Set([...scan(battle?.goodTeam),...scan(battle?.badTeam)].filter(object))];
 const projectiles=[...new Set(scan(battle?.objects?.items).filter(object))];
 const validCamera=camera?.renderable===true&&[camera.width,camera.height,camera.scale,camera.offsetX,camera.offsetY].every(finite)&&camera.scale>0;
 const onScreen=p=>validCamera&&positioned(p)&&p.x*camera.scale+camera.offsetX>=0&&p.x*camera.scale+camera.offsetX<=camera.width&&p.y*camera.scale+camera.offsetY>=0&&p.y*camera.scale+camera.offsetY<=camera.height;
 const counts={alliesLiving:0,enemiesLiving:0,actorsLiving:0,actorsDrawable:0,livingDrawable:0,actorAnchorsInViewport:0,projectilesActive:0,projectilesDrawable:0,projectileAnchorsInViewport:0};
 for(const actor of actors){
  const alive=living(actor),gallery=actor===battle?.hero&&alive&&positioned(heroGallery),pose=gallery?heroGallery:actor;
  if(alive){counts.actorsLiving++;if(actor.team==='good')counts.alliesLiving++;if(actor.team==='bad')counts.enemiesLiving++;}
  if((actor.visible||gallery)&&positioned(pose)){counts.actorsDrawable++;if(alive)counts.livingDrawable++;if(onScreen(pose))counts.actorAnchorsInViewport++;}
 }
 for(const projectile of projectiles){
  if(!projectile.active)continue;counts.projectilesActive++;
  const pose=projectile.draw??projectile;
  // Same eligibility as battle.mjs drawArrow, including its finite-pose guard.
  if(finite(projectile.vx)&&projectile.kind&&positioned(pose)){counts.projectilesDrawable++;if(onScreen(pose))counts.projectileAnchorsInViewport++;}
 }
 return {...counts,truncated,viewportAvailable:validCamera};
}
export function createBattleRenderProfiler(){
 let state,reason,context,startedAt,deadline,lastObserved,segmentAt,segment,previousRaf,previousRender,lastCountAt;
 let data,dropped,pending,loads,coverage,anomalies,inputEvents,inputUnmatched,inputSynthetic;
 function clear(){state='idle';reason=null;context=null;startedAt=deadline=lastObserved=segmentAt=previousRaf=previousRender=lastCountAt=null;segment='paused';data=Object.fromEntries(metrics.map(k=>[k,[]]));dropped=Object.fromEntries(metrics.map(k=>[k,0]));pending=[];loads=[];coverage={liveMs:0,pausedMs:0,hiddenMs:0};anomalies=0;inputEvents=0;inputUnmatched=0;inputSynthetic=0;}
 clear();
 function breakChain(){previousRaf=null;previousRender=null;inputUnmatched+=pending.length;pending=[];}
 function finish(why){state='complete';reason=reasons.has(why)?why:'stopped';breakChain();}
 function account(now){
  if(!finite(now)||now<0||(lastObserved!==null&&now<lastObserved)){anomalies++;finish('clock-invalid');return false;}
  lastObserved=now;
  if(state!=='recording')return false;
  const boundary=Math.min(now,deadline);
  if(segmentAt!==null)coverage[segment+'Ms']+=Math.max(0,boundary-segmentAt);
  segmentAt=boundary;
  if(now>=deadline){finish('window-complete');return false;}
  return true;
 }
 function append(key,value,limit){if(!finite(value)||value<0){anomalies++;return;}if(data[key].length<limit)data[key].push(value);else dropped[key]++;}
 function arm(meta={}){
  if(state==='armed'||state==='recording')return false;
  clear();state='armed';context={build:typeof meta.build==='string'&&/^\d{1,6}$/.test(meta.build)?meta.build:'unavailable',mode:modes.has(meta.mode)?meta.mode:'unknown',kind:meta.kind==='controlled-fixture'?'controlled-fixture':'live-play',assisted:meta.assisted===true};return true;
 }
 function frame(rafTime,now,{live=false,hidden=false,ended=false}={}){
  if(state!=='armed'&&state!=='recording')return false;
  if(ended){if(state==='recording'&&!account(now))return false;finish('battle-ended');return false;}
  if(state==='armed'){
   if(!live||hidden)return false;
   if(!finite(now)||now<0){anomalies++;finish('clock-invalid');return false;}
   state='recording';startedAt=lastObserved=segmentAt=now;deadline=now+RENDER_PROFILE_LIMITS.durationMs;segment='live';
  }
  if(!account(now))return false;
  const next=hidden?'hidden':live?'live':'paused';
  if(next!=='live'||next!==segment)breakChain();segment=next;
  if(next!=='live')return false;
  if(!finite(rafTime)||rafTime<0||(previousRaf!==null&&rafTime<=previousRaf)){anomalies++;previousRaf=null;}
  else{if(previousRaf!==null)append('rafIntervalMs',rafTime-previousRaf,RENDER_PROFILE_LIMITS.frames);previousRaf=rafTime;}
  return true;
 }
 function interrupt(now,kind='paused'){
  if(state!=='recording')return;
  if(!account(now))return;
  breakChain();segment=kind==='hidden'?'hidden':'paused';
 }
 function tick(start,end){
  if(state!=='recording'||segment!=='live')return;
  if(!account(end))return;
  if(!finite(start)||start<startedAt||start>end){anomalies++;return;}
  append('tickCpuMs',end-start,RENDER_PROFILE_LIMITS.ticks);
 }
 function input(now,trusted){
  if(state!=='recording'||segment!=='live')return false;
  if(!account(now))return false;
  if(trusted!==true){inputSynthetic++;return false;}
  inputEvents++;
  if(pending.length>=RENDER_PROFILE_LIMITS.pendingInputs){inputUnmatched++;return false;}
  pending.push(now);return true;
 }
 function render(start,end){
  if(state!=='recording'||segment!=='live')return;
  if(!account(end))return;
  if(!finite(start)||start<startedAt||start>end){anomalies++;breakChain();return;}
  append('renderCpuMs',end-start,RENDER_PROFILE_LIMITS.renders);
  if(previousRender!==null)append('renderIntervalMs',end-previousRender,RENDER_PROFILE_LIMITS.renders);
  previousRender=end;
  for(const time of pending)append('inputToRenderMs',end-time,RENDER_PROFILE_LIMITS.inputs);
  pending=[];
 }
 function wantsLoad(now){return state==='recording'&&segment==='live'&&finite(now)&&now<deadline&&loads.length<RENDER_PROFILE_LIMITS.countSamples&&(lastCountAt===null||now-lastCountAt>=RENDER_PROFILE_LIMITS.countEveryMs);}
 function load(now,facts){
  if(!wantsLoad(now))return false;
  const values={};for(const key of ['alliesLiving','enemiesLiving','actorsLiving','actorsDrawable','livingDrawable','actorAnchorsInViewport','projectilesActive','projectilesDrawable','projectileAnchorsInViewport']){if(!Number.isSafeInteger(facts?.[key])||facts[key]<0){anomalies++;return false;}values[key]=facts[key];}
  lastCountAt=now;loads.push({atMs:round(now-startedAt),...values,truncated:facts.truncated===true,viewportAvailable:facts.viewportAvailable===true});return true;
 }
 function stop(now){if(state==='armed'){finish('stopped');return;}if(state==='recording'&&account(now))finish('stopped');}
 function snapshot(){
  const counts={};if(loads.length)for(const key of Object.keys(loads[0]).filter(k=>!['atMs','truncated','viewportAvailable'].includes(k))){const values=loads.map(s=>s[key]);counts[key]={first:values[0],last:values.at(-1),min:Math.min(...values),max:Math.max(...values)};}
  return {schema:'castledecks-render-profile-v1',state,reason,context:context?{...context}:null,windowMs:RENDER_PROFILE_LIMITS.durationMs,elapsedMs:startedAt===null?0:round(Math.min(deadline,lastObserved)-startedAt),coverage:Object.fromEntries(Object.entries(coverage).map(([k,v])=>[k,round(v)])),metrics:Object.fromEntries(metrics.map(key=>[key,{...summarizeRenderSamples(data[key]),dropped:dropped[key]}])),inputs:{accepted:inputEvents,unmatched:inputUnmatched,pending:pending.length,syntheticIgnored:inputSynthetic},loads:{samples:loads.length,truncatedSamples:loads.filter(s=>s.truncated).length,viewportUnavailable:loads.filter(s=>!s.viewportAvailable).length,firstAtMs:loads[0]?.atMs??null,lastAtMs:loads.at(-1)?.atMs??null,counts},clockAnomalies:anomalies,limits:RENDER_PROFILE_LIMITS};
 }
 return {arm,frame,interrupt,tick,input,render,wantsLoad,load,stop,clear,snapshot,get active(){return state==='armed'||state==='recording';},get recording(){return state==='recording';}};
}
const ms=n=>n===null?'unavailable':`${n} ms`;
export function formatBattleRenderProfile(report){
 const lines=['RENDERING SAMPLE · LOCAL ONLY',`State: ${report.state}${report.reason?' · '+report.reason:''}`];
 if(report.state==='idle')return [...lines,'Off by default. Arm a 30-second sample in Battle report.'].join('\n');
 const c=report.context;
 lines.push(`Build ${c.build} | ${c.mode} | ${c.kind==='controlled-fixture'?'Controlled fixture (operator-labelled)':'Live play (no load injected by recorder)'} | assisted field: ${c.assisted?'yes':'no'}`);
 lines.push(`Window: ${report.elapsedMs} / ${report.windowMs} ms elapsed; live ${report.coverage.liveMs} ms; paused ${report.coverage.pausedMs} ms; hidden ${report.coverage.hiddenMs} ms.`, 'Armed sampling starts on the next live callback. Pauses/background consume the fixed window but break interval chains. A throttled browser finalizes at its next callback; no missed frames are fabricated.');
 if(report.state==='armed')lines.push('No samples yet. Close this panel and start/resume the battlefield.');
 const labels={rafIntervalMs:'Animation callback intervals',renderIntervalMs:'Canvas render-submission intervals',renderCpuMs:'Render callback CPU (canvas + HUD)',tickCpuMs:'Simulation tick callback CPU',inputToRenderMs:'Accepted canvas pointer handler → next render submission'};
 for(const [key,label] of Object.entries(labels)){const m=report.metrics[key];lines.push(`${label}: n=${m.samples}; p50 ${ms(m.p50)}; p95 ${ms(m.p95)}; worst ${ms(m.worst)}; over-cap discarded ${m.dropped}.`);}
 lines.push(`Input events: ${report.inputs.accepted} accepted; ${report.inputs.unmatched} unmatched after interruption/end/queue limit; ${report.inputs.pending} pending; ${report.inputs.syntheticIgnored} untrusted/synthetic ignored.`, 'Input samples cover accepted canvas pointer press/release only. They time handler entry to completion of the next canvas/HUD submission, not confirmed visual response, browser event-queue delay, GPU presentation or end-to-end touch latency. Trusted browser automation may count: identify it as a controlled fixture. No input samples means unavailable.');
 lines.push(`Load snapshots: ${report.loads.samples}, at most 4 per second; first ${ms(report.loads.firstAtMs)}, last ${ms(report.loads.lastAtMs)}; partial scans ${report.loads.truncatedSamples}; viewport unavailable ${report.loads.viewportUnavailable}.`);
 const countLabels={alliesLiving:'Living allies (includes hero)',enemiesLiving:'Living enemies',actorsLiving:'Living roster actors',actorsDrawable:'Render-eligible actors (includes corpses)',livingDrawable:'Living render-eligible actors',actorAnchorsInViewport:'Render-eligible actor anchors inside viewport',projectilesActive:'Active object-list entries',projectilesDrawable:'Render-eligible projectiles',projectileAnchorsInViewport:'Projectile anchors inside viewport'};
 for(const [key,values] of Object.entries(report.loads.counts))lines.push(`${countLabels[key]}: first ${values.first}; last ${values.last}; range ${values.min}–${values.max}.`);
 lines.push('Actor counts deduplicate team rosters; structures, spells and effect sprites are excluded. Hidden troops are excluded from render-eligible counts; the drawn garrison hero is included at its gallery anchor. Viewport counts test anchors only, not sprite bounds, occlusion or visible pixels. Counts may miss peaks between samples. A scan cap makes counts partial, never extrapolated.',`Clock anomalies: ${report.clockAnomalies}. Quantiles use nearest rank over retained samples. A sample cap retains the earliest samples, so over-cap runs are incomplete.`,'Timing is callback/submission evidence, not guaranteed displayed FPS. The simulation is fixed-step; tick CPU is not a frame interval. Browser load, tooling, automation and this profiler add overhead. A cloud desktop result does not establish physical Android performance. Partial runs and no-sample metrics are not passes. No recording is saved or transmitted automatically.');
 return lines.join('\n');
}
