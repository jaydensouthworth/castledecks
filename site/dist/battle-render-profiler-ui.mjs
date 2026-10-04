import {formatBattleRenderProfile} from './battle-render-profiler.mjs';
/** Existing report utility only. No timer, automatic copy, permanent HUD, or
 * editable text is read as evidence. Choosing a fixture label injects no load. */
export function createBattleRenderProfilerUI({document,getState,now,onChange}){
 const $=id=>document.querySelector(id);
 function render(){
  const {renderProfiler,renderContext}=getState(),report=renderProfiler.snapshot();
  $('#renderProfileStart').disabled=renderProfiler.active||renderContext.ended;
  $('#renderProfileStop').disabled=!renderProfiler.active;
  $('#renderProfileClear').disabled=report.state==='idle';
  if(renderContext.synthetic)$('#renderProfileKind').value='controlled-fixture';
  $('#renderProfileKind').disabled=renderProfiler.active||renderContext.synthetic;
  $('#renderProfileStatus').textContent=report.state==='idle'?'Off. Recording stays only in this tab.':report.state==='armed'?'Armed. Close this panel, then start or resume play.':report.state==='recording'?'Sampling a fixed 30-second window. Reopen or refresh this report to inspect it.':`Sample ended: ${report.reason}. ${report.elapsedMs} ms observed window.`;
  return formatBattleRenderProfile(report);
 }
 $('#renderProfileStart').onclick=()=>{const state=getState();if(state.renderContext.ended)return;state.renderProfiler.arm({...state.renderContext,kind:state.renderContext.synthetic?'controlled-fixture':$('#renderProfileKind').value});onChange();};
 $('#renderProfileStop').onclick=()=>{getState().renderProfiler.stop(now());onChange();};
 $('#renderProfileClear').onclick=()=>{getState().renderProfiler.clear();onChange();};
 return {render};
}
