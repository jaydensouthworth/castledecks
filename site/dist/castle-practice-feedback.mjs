/** Read-only optional Highwatch field labels. Ordinary Skirmish/HUD stays owned
 * by its existing writers. No timers, actors, RNG or gameplay changes here. */
import {FLAG_STATUS as FS} from './engine/flag-troop.mjs';
const labels={hero:'Your hero fell.',flag:'Your home flag was captured.',keep:'Your home keep fell.'};
export function castlePracticeFeedbackState(battle){
 if(!battle?.skirmish?.castlePractice)return null;
 const outcome=battle.outcome??battle.summary?.outcome,fallen=!(battle.badCastle?.hp>0),homeSafe=battle.ownFlag?.status===FS.AT_BASE;
 const phase=outcome??(!fallen?'break-keep':!homeSafe?'recover-flag':'clear-field');
 const remaining=(battle.enemies?.remaining??0)+(battle.badTeam?.length??0);
 const status=phase==='defeat'?'Highwatch attempt lost':phase==='victory'?'Highwatch field cleared':phase==='break-keep'?'Break Highwatch keep':phase==='recover-flag'?'Recover home flag':`Clear ${remaining} remaining ${remaining===1?'enemy':'enemies'}`;
 const reason=phase==='defeat'?(battle.castlePracticeDefeatCauses??[]).map(cause=>labels[cause]).filter(Boolean).join(' '):'';
 const title='Highwatch · Practice';
 const result=phase==='victory'?'Enemy keep broken, deployed company cleared and home flag safe.':reason||'Break their keep, clear the field and recover your home flag.';
 const brief=`${status}. ${result} Losing your hero, home flag or home keep defeats this attempt. Enemy flag capture alone cannot win. Both sides use ordinary castle resistances. Highwatch has a 50-unit higher station, 2 total berths and 20% less starting keep HP. Supplied Classic has 4 berths and full keep HP. Change your castle in Build before Start; retry supplies both again and selects Highwatch.`;
 return Object.freeze({phase,title,status,reason,result,brief,portrait:`Highwatch · ${status}`,ariaLabel:`Highwatch comparison. ${status}. ${result}`});
}
const write=(node,text)=>{if(node&&node.textContent!==text)node.textContent=text;};
export function updateCastlePracticeFeedback(battle,root=globalThis.document){
 const state=castlePracticeFeedbackState(battle),standard=root?.querySelector('.live-battle-standard'),brief=root?.querySelector('#castlePracticeBrief');
 if(standard){if(state){standard.dataset.objective='highwatch';standard.setAttribute('aria-label',state.ariaLabel);}else if(standard.dataset.objective==='highwatch'){delete standard.dataset.objective;standard.setAttribute('aria-label','Battle progress');}}
 if(brief){brief.classList[state?'remove':'add']('hidden');write(brief,state?.brief??'');}
 if(!state)return null;
 write(root?.querySelector('#combatBattleTitle'),state.title);write(root?.querySelector('#combatEnemyState'),state.status);write(root?.querySelector('#viewStatus'),state.portrait);
 return state;
}
