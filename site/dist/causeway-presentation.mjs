/** Optional, read-only ground-control presentation. Uses the existing canvas,
 * progress text and Pause paragraph; never adds an aim-intercepting overlay. */
import {CAUSEWAY_OBJECTIVE,CAUSEWAY_RULES} from './engine/causeway-objective.mjs';
import {flagRecoveryOptions} from './engine/flag-recovery-options.mjs';
import {SKILLS} from './engine/progression.mjs';
export const CAUSEWAY_BRIEF=Object.freeze({title:'Causeway Hold',goal:'Hold the marked ground for 30 cumulative seconds with a living ground fighter and your home flag safe. The on-foot hero can occupy it. Enemies, an empty strip or a displaced home flag pause progress without erasing it. Garrisoned troops, aircraft, siege and friendly flag carriers cannot occupy.',finish:'Securing the strip withdraws only undeployed reserves and orders both companies to Advance. Clear deployed enemies with your home flag safe to win. Enemy keep destruction cuts reserves but cannot replace occupation. Taking their flag cannot win. Hero, home flag or home keep loss ends the attempt.',advice:'Frontline Center holds the strip; Support Center stands behind it. Leave your keep to lead from the ground, or send infantry and protect them with real arrows and healing. Five ordinary guards are already deployed from the finite company. Grunts and Riders recover a dropped home flag; your hero cannot. Basic arrows can hit friendly ground troops: keep a clear shot when supporting the line.'});
const causes=Object.freeze({hero:'Your hero fell.',flag:'Your home flag was captured.',keep:'Your home keep fell.','unrecoverable-home-flag':'Your flag is stranded. No recovery troops or prepaid reinforcements remain, and your reserve cannot fund another recovery squad. Retry with fresh practice supplies.'});
function recoveryGuidance(b){
 const r=flagRecoveryOptions(b);
 if(r.reason==='living-recoverer')return 'A recovery troop is on the field. Home-flag recovery takes priority over Rally.';
 if(r.reason==='recovery-arriving')return 'A recovery squad is arriving.';
 if(r.reason==='cancel-to-recover-reserve')return `Cancel queued units in Army to refund up to ${r.refundable} reserve, then recruit a recovery squad.`;
 const eligible=(r.options??[]).filter(o=>o.reserve<=r.reserve),affordable=eligible.filter(o=>o.gold<=b.profile.gold);
 if(affordable.length){
  const immediate=affordable.filter(o=>o.reserve<=b.friendlyQueue.population);
  if(!immediate.length)return `Cancel queued units in Army to refund up to ${r.refundable} reserve, then recruit a recovery squad.`;
  const option=immediate.find(o=>o.bound&&o.cooldown<=0)??immediate.find(o=>o.bound)??immediate[0],name=SKILLS[option.id].name;
  if(!option.bound)return `Equip ${name} in Loadout, then ${option.cooldown>0?'let it reload and ':''}recruit a recovery squad.`;
  if(option.cooldown>0)return `Wait for ${name} to reload, then recruit a recovery squad.`;
  return `Recruit ${name} in Army to recover your home flag (${option.gold} gold / ${option.reserve} reserve).`;
 }
 if(eligible.length){const option=eligible.reduce((a,c)=>a.gold<=c.gold?a:c);return `Need ${Math.ceil(option.gold-b.profile.gold)} more gold for a ${SKILLS[option.id].name} recovery squad. Your hero cannot return the flag.`;}
 return 'Ground recovery troops can return your flag; your hero cannot. Check Army and Loadout for a recovery route, or Retry with fresh practice supplies.';
}
export function causewayFeedbackState(b){
 if(!b?.causewayObjective||b.encounter?.objective!==CAUSEWAY_OBJECTIVE)return null;
 const p=b.objectiveProgress,outcome=b.outcome??b.summary?.outcome,seconds=Math.floor(p.seconds*10)/10,meter=`${seconds.toFixed(1)}/30s`;
 const phase=outcome==='defeat'?'defeat':outcome==='victory'?'victory':p.phase;
 const status={empty:'Move onto causeway',holding:'Holding ground',contested:'Contested · progress paused','recover-flag':'Recover home flag',cleanup:'Clear deployed enemies',victory:'Causeway secured',defeat:'Causeway lost'}[phase];
 const reason=phase==='defeat'?(b.causewayDefeatCauses?.map(c=>causes[c]).filter(Boolean).join(' ')||'This attempt was lost.'):null;
 const recovery=phase==='recover-flag'?recoveryGuidance(b):null;
 const remaining=`${p.liveEnemies} deployed · ${p.reserves} reserve`;
 return Object.freeze({phase,meter,title:`Causeway · ${meter}`,status,reason,recovery,portrait:`Causeway ${meter} · ${status}`,ariaLabel:`Causeway Hold. ${meter}. ${status}. ${remaining}.`,brief:`${meter}. ${status}. ${remaining}. ${reason??recovery??''} ${CAUSEWAY_BRIEF.goal} ${CAUSEWAY_BRIEF.finish}`,result:phase==='victory'?'Ground secured, finite company cleared and home flag safe.':reason??`${meter}. ${status}.`});
}
export function updateCausewayFeedback(b,root=globalThis.document){
 const s=causewayFeedbackState(b),standard=root?.querySelector('.live-battle-standard'),brief=root?.querySelector('#batteryObjectiveBrief');
 if(!s){if(standard?.dataset.objective===CAUSEWAY_OBJECTIVE){delete standard.dataset.objective;standard.setAttribute('aria-label','Battle progress');brief?.classList.add('hidden');if(brief)brief.textContent='';}return null;}
 if(standard){standard.dataset.objective=CAUSEWAY_OBJECTIVE;standard.setAttribute('aria-label',s.ariaLabel);}
 for(const [selector,text]of [['#combatBattleTitle',s.title],['#combatEnemyState',s.status],['#viewStatus',s.portrait],['#batteryObjectiveBrief',s.brief]]){const node=root?.querySelector(selector);if(node&&node.textContent!==text)node.textContent=text;}
 brief?.classList.remove('hidden');return s;
}
/** Draw in world transform before actors. End posts mark the exact inclusive
 * occupation interval on terrain. Hatching/diamond distinguish it without
 * relying solely on color; actual actors remain on top and pointer-safe. */
export function drawCausewayGround(ctx,b,scale=1){
 const s=causewayFeedbackState(b);if(!s||!Number.isFinite(scale)||scale<=0)return false;
 const {left,right}=CAUSEWAY_RULES,color=s.phase==='contested'?'#f3c584':s.phase==='cleanup'||s.phase==='victory'?'#afdec2':'#e7d9a3';
 ctx.save();ctx.strokeStyle='#1b3034';ctx.lineWidth=8/scale;ctx.beginPath();for(let x=left;x<=right;x+=5){const y=b.elevationAt(x);if(x===left)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();ctx.strokeStyle=color;ctx.lineWidth=3/scale;ctx.stroke();
 ctx.lineWidth=2/scale;for(const x of [left,right]){const y=b.elevationAt(x);ctx.beginPath();ctx.moveTo(x,y+5/scale);ctx.lineTo(x,y-24/scale);ctx.moveTo(x-5/scale,y-19/scale);ctx.lineTo(x,y-24/scale);ctx.lineTo(x+5/scale,y-19/scale);ctx.stroke();}
 for(let x=left+10;x<right;x+=20){const y=b.elevationAt(x);ctx.beginPath();ctx.moveTo(x-3/scale,y+4/scale);ctx.lineTo(x+3/scale,y+10/scale);ctx.stroke();}
 ctx.restore();return true;
}
