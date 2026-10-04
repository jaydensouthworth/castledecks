import {stressFieldCopy,stressFieldSnapshot} from './stress-field.mjs';
/** Reuses existing Testing, Pause and battle-label surfaces. No live HUD row. */
export function renderStressField(document,battle){
 const $=id=>document.querySelector(id),snapshot=stressFieldSnapshot(battle),copy=stressFieldCopy(battle,snapshot),active=!!copy;
 $('#stressFieldEntry').classList[active?'add':'remove']('hidden');$('#stressFieldActive').classList[active?'remove':'add']('hidden');
 for(const id of ['#stressStandard','#stressVeteran'])$(id).disabled=active;
 for(const id of ['#testGoldSmall','#testGoldLarge','#testUnlock','#testReady','#testProtection','#testLevelApply','#testVictory','#testDefeat'])$(id).disabled=active||['#testVictory','#testDefeat'].includes(id)&&!!battle.outcome;
 $('#gameShell').dataset.syntheticStress=String(active);if(!active)return null;
 // Only lock while active. The origin snapshot restores exact prior controls;
 // inactive stress rendering must never unlock guided practice or field trials.
 for(const id of ['#introSave','#introLoad','#introProfiles','#saveGame','#loadGame','#openProfiles','#endingSave','#endingLoad','#endingProfiles'])$(id).disabled=true;
 $('#saveStatus').textContent='Temporary synthetic field. No campaign progress or export. Return to the playground before saving or loading.';
 $('#settingsSaveNote').textContent='These synthetic settings are temporary. Return to the playground before saving or loading.';
 $('#autoHelp').textContent='All troops are staged supplies. Auto starts off; zero reserve prevents Auto or manual replacements. Reset restages the field.';
 $('#stressFieldDetail').textContent=copy.detail;$('#stressFieldStatus').textContent=copy.status;$('#stressFieldNotice').textContent=copy.notice;
 $('#testModeBadge').textContent='SYNTHETIC';$('#testModeBadge').setAttribute('aria-label','Synthetic staged load, disposable supplies');
 $('#battleTitle').textContent=copy.title;$('#combatBattleTitle').textContent='Synthetic field';$('#combatEnemyState').textContent=`${snapshot.troops.alive} troops alive`;
 $('#enemyHud').textContent=`${snapshot.enemy.alive} enemies · staged supplies`;
 $('#waveHud').textContent='No reinforcements';$('#viewStatus').textContent=copy.title+' · '+snapshot.troops.alive+' troops alive';
 $('#pauseLobby').textContent='Return to playground';$('#battleRestart').textContent='Reset synthetic field';$('#restartDescription').textContent='Discard this synthetic attempt and stage fresh supplies. Your original playground stays unchanged.';
 $('#pauseReason').textContent=copy.status;$('#batteryObjectiveBrief').textContent=copy.detail+' '+copy.notice;$('#batteryObjectiveBrief').classList.remove('hidden');
 const standard=$('.live-battle-standard');standard?.setAttribute('aria-label',copy.title+'. '+copy.detail);
 $('#resumeGame').disabled=snapshot.stopped;
 return copy;
}
